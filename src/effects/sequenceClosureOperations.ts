import { queueActionPowerAdd } from '../battle/actionDamageModifiers';
import { getMaxPp } from '../utils/battleHelpers';
import type { BattleEventContext } from './types';
import type { RunState } from '../blocks/runtime';
import { canonicalStatusName } from './statusIdentity';
import { StatusRegistry } from './statusRegistry';

/** 所有路由使用同一技能槽連續紀錄；不讀名字來冒充同一個槽。 */
export function recordConsecutiveUse(ctx: BattleEventContext) {
  // 唯讀預覽／既有原子測試可只提供需要的部分API；不能為了輔助紀錄讓普通技能崩潰。
  if(typeof ctx.getPlayerState!=='function'||typeof ctx.setPlayerState!=='function')return;
  const slot = ctx.skill?.battleSlot ?? (ctx.self.skills || []).findIndex(s => s === ctx.skill || s.name === ctx.skill?.name);
  const previous = ctx.getPlayerState('skillUseSequence');
  if(ctx.actionId!==undefined && previous?.actionId===ctx.actionId)return;
  const resolvedName=ctx.skill?.name;
  const key=JSON.stringify([slot,resolvedName]);
  const totals={...(ctx.getPlayerState('skillUsageCounts') || {})};
  const totalUses=(Number(totals[key]) || 0)+1;totals[key]=totalUses;
  ctx.setPlayerState('skillUsageCounts',totals);
  ctx.setPlayerState('skillUseSequence', { slot,resolvedName, actionId:ctx.actionId,totalUses, count: previous?.slot === slot && previous?.resolvedName===resolvedName ? previous.count + 1 : 1 });
}
export function closureOperations(helpers: { liveElf: (ctx: BattleEventContext, side: 'p1' | 'p2') => any;
  addTimer: (...args: any[]) => void; damage: (ctx: BattleEventContext, side: 'p1' | 'p2', amount: number, type: string, elem?: string, state?: RunState) => number }) {
  const adjust=(ctx:BattleEventContext,side:'p1'|'p2',amount:number):boolean=>{
    const recipient=helpers.liveElf(ctx,side),active=side==='p1'?ctx.activeP1:ctx.activeP2;
    if((recipient.battleId||recipient.id)!==(active.battleId||active.id)) {
      if(!ctx.adjustHpToElf)return false;
      ctx.adjustHpToElf(side,recipient.battleId||recipient.id,amount);
    } else ctx.adjustHp(side,amount);
    return amount!==0;
  };
  return {
    stat_transfer:(ctx:BattleEventContext)=>{
      const from=helpers.liveElf(ctx,ctx.actor),changes:Record<string,number>={};
      for(const [key,value] of Object.entries(from.statStages || {}))if(Number(value)<0)changes[key]=Number(value);
      if(!Object.keys(changes).length)return false;
      const applied=ctx.applyStatChange(ctx.targetSide,changes)?.applied || {};
      const stages={...helpers.liveElf(ctx,ctx.actor).statStages};let moved=false;
      // 只轉移實際通過免疫／上下限的等級；未轉走的弱化仍留在來源。
      for(const key of Object.keys(changes))if(Number(applied[key])<0){stages[key]=Math.min(0,Number(stages[key] || 0)-Number(applied[key]));moved=true;}
      if(moved){ctx.updateElf(ctx.actor,{statStages:stages});ctx.addLog('🔄 能力下降狀態已轉移給對手！','status');}
      return moved;
    },
    hp_match:(ctx:BattleEventContext,p:any)=>{
      const side=p.side==='self'?ctx.actor:ctx.targetSide,other=side===ctx.actor?ctx.targetSide:ctx.actor;
      const elf=helpers.liveElf(ctx,side),value=helpers.liveElf(ctx,other).currentHp,delta=value-elf.currentHp;
      return adjust(ctx,side,delta);
    },
    status_guard:(ctx:BattleEventContext,p:any)=>{
      const data=(ctx as any).effectEventData;
      if(!data?.status)return false;
      const cats=StatusRegistry[canonicalStatusName(data.status)]?.categories || [];
      if(p.cls && !(p.cls==='控制類'?cats.includes('CONTROL'):p.cls==='弱化類'?cats.includes('WEAKENING'):!cats.some(c=>['AUXILIARY','BOSS_ONLY','NO_EFFECT'].includes(c))))return false;
      data.prevented=true;data.prevent=true;data.immunized=true;return true;
    },
    power_streak: (ctx: BattleEventContext, p: any) => {
      const uses = Math.max(1, Number(ctx.getPlayerState('skillUseSequence')?.count) || 1);
      const base = Math.max(0, Number(ctx.skill?.power) || 0);
      queueActionPowerAdd(ctx, Math.max(0, Math.min(p.cap, base + (uses - 1) * p.step) - base)); return true;
    },
    hp_adjust: (ctx: BattleEventContext, p: any, st:RunState) => {
      const side = p.side === 'self' ? ctx.actor : ctx.targetSide, elf = helpers.liveElf(ctx, side);
      const amount = p.delta ?? (p.base === '當前體力' ? elf.currentHp : elf.maxHp) * p.ratio * (p.direction === 'subtract' ? -1 : 1);
      if(p.perStack && !Number.isInteger(st.markStacks))return false;
      return adjust(ctx,side,Math.trunc(amount*(p.perStack?st.markStacks!:1)));
    },
    rebirth_once: (ctx: BattleEventContext) => {
      helpers.addTimer(ctx, ctx.actor, '下次死亡重生', 1, 'uses', { rebirth: true }); return true;
    },
    stat_mirror: (ctx: BattleEventContext, p: any) => {
      const other = p.side === 'self' ? ctx.targetSide : ctx.actor, side = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const from = helpers.liveElf(ctx, other)?.statStages || {}, values: Record<string, number> = {};
      for (const [key, value] of Object.entries(from)) if (p.fromKind==='down'?Number(value)<0:Number(value)>0)
        values[key] = (p.kind === 'down' ? -1 : 1) * Math.abs(Number(value)) * (p.mult ?? 1);
      if (!Object.keys(values).length) return false;
      return ctx.applyStatChange(side, values)?.success ?? true;
    },
    pp_lost_damage: (ctx: BattleEventContext, p: any, state: RunState) => {
      const opponent = helpers.liveElf(ctx, ctx.targetSide);
      const lost = opponent.skills.reduce((sum: number, s: any) => sum + Math.max(0, getMaxPp(s, opponent) - s.pp), 0);
      state.lastAmount = helpers.damage(ctx, ctx.targetSide, lost * p.mult, p.type, undefined, state); return lost > 0;
    },
  };
}
