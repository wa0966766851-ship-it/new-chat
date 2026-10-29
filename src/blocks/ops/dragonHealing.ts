// 通用傷害儲存、下一次分類轉換、完整技能重播與下場前PP選招豁免。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const DRAGON_HEALING_ACTION_FIELDS: Record<string, readonly string[]> = {
  immune_success_bonus: ['kind'],
attack_absorb_store: ['capRatio','key'],
  stored_damage_release:['key','type'],
  stored_damage_reset:['key'],
  stored_damage_convert_next:['key','type'],
  extra_use_times: ['times'],
  pp_unlimited_until_switch: [],
};

export function dragonHealingActionIssue(op: string, p: any): string | null {
  if(['attack_absorb_store','stored_damage_release','stored_damage_convert_next','stored_damage_reset'].includes(op)&&p.key!==undefined&&(typeof p.key!=='string'||!p.key.trim()))return '儲存傷害需明確鍵';
  if(op==='immune_success_bonus'&&!['gold','mystic','azure'].includes(p.kind))return '免疫成功追加需指定金龍／玄龍／蒼龍';
if(op==='stored_damage_reset'&&!p.key)return '傷害儲存清除需識別鍵';
  if(['stored_damage_release','stored_damage_convert_next'].includes(op)&&(!p.key||!['固定','真實'].includes(p.type)))return '儲存傷害釋放需明確鍵與固定或真實分類';
  if (op === 'attack_absorb_store') {
    if (!(p.capRatio > 0 && p.capRatio <= 10)) return '攻擊累計需0至1000%上限比例';
    return null;
  }
  if (op === 'extra_use_times') {
    if (!Number.isInteger(p.times) || p.times < 1 || p.times > 10) return '額外使用次數需1至10整數';
    return null;
  }
  if (op === 'pp_unlimited_until_switch') return null;
  return null;
}

export function dragonHealingOperations(helpers: { liveElf: (ctx: BattleEventContext, side: S) => any }) {
  return {
    // 通用抵擋／儲存，於正式傷害增減與上限之後記錄實際被抵擋量。
    // 2026-10-28 四龍追加效果：由 DAMAGE_IMMUNIZED 事件觸發（引擎在真正 100% 免傷時派發）。
  immune_success_bonus: (ctx: BattleEventContext, p: any): boolean => {
    const kind = String(p.kind || '');
    if (kind === 'gold') {
      ctx.clearTurnEffectsOf?.(ctx.targetSide);
      ctx.addLog?.('🐉 【金龍】：免疫成功，消除對手回合類效果！', 'effect');
      return true;
    }
    if (kind === 'mystic') {
      ctx.setPlayerState('mysticDmgBoostTurns', 3);
      ctx.addLog?.('🐉 【玄龍】：免疫成功，下 3 回合固定與百分比傷害 +50%！', 'effect');
      return true;
    }
    if (kind === 'azure') {
      const stamp = String(ctx.roundNumber) + ':' + String(ctx.skill?.name || '');
      if (ctx.getPlayerState('azureDrainRound') === stamp) return false;
      ctx.setPlayerState('azureDrainRound', stamp);
      const oppElf = ctx.actor === 'p1' ? ctx.activeP2 : ctx.activeP1;
      const amount = Math.floor((oppElf?.maxHp || 0) * 0.5);
      if (amount > 0) { ctx.applyTrueDamage(ctx.targetSide, amount, '蒼龍吸取'); ctx.applyHeal(ctx.actor, amount); }
      ctx.addLog?.('🐉 【蒼龍】：免疫能力下降成功，吸取對手最大體力 1/2！', 'effect');
      return true;
    }
    return false;
  },
  attack_absorb_store: (ctx: BattleEventContext, p: any,st:RunState): boolean => {
      const elf=helpers.liveElf(ctx,ctx.actor),comp=st.event?.data?.damageComp;
      if(!elf||!comp?.isIncoming||comp.damageCategory!=='skill_attack')return false;
      const key='damageStore:'+(p.key||'arena.red');
      comp.damageBlocks??=new Map();
      comp.damageBlocks.set(key,(amount:number)=>ctx.setPlayerState(key,Math.min(Math.floor(elf.maxHp*p.capRatio),Math.max(0,Number(ctx.getPlayerState(key))||0)+amount)));
      return true;
    },
    stored_damage_reset:(ctx:BattleEventContext,p:any):boolean=>{ctx.setPlayerState('damageStore:'+p.key,0);ctx.setPlayerState('damageStore:'+p.key+':type',undefined);return true;},
    stored_damage_convert_next:(ctx:BattleEventContext,p:any):boolean=>{ctx.setPlayerState('damageStore:'+p.key+':type',p.type);return true;},
    stored_damage_release:(ctx:BattleEventContext,p:any):boolean=>{
      const key='damageStore:'+p.key,amount=Number(ctx.getPlayerState(key))||0;
      if(amount<=0)return false;
      const type=ctx.getPlayerState(key+':type')||p.type;
      ctx.setPlayerState(key,0);ctx.setPlayerState(key+':type',undefined);
      if(type==='真實')ctx.applyTrueDamage(ctx.targetSide,amount,'累計傷害釋放');
      else ctx.applyFixedDamage(ctx.targetSide,amount,'累計傷害釋放');
      return true;
    },
    // 通用額外使用請求，由引擎在死亡節點一之前走完整的同一技能流程。
    extra_use_times:(ctx:BattleEventContext,p:any):boolean=>{
      if(!ctx.skill||ctx.actionId===undefined||ctx.getPlayerState('executingSkillRepeat'))return false;
      ctx.setPlayerState('pendingSkillRepeats',{times:p.times,actionId:ctx.actionId,ownerBattleId:ctx.self.battleId||ctx.self.id});return true;
    },
    // 只授予選招豁免，普通使用仍按正常成本扣PP；下場由共用生命周期解除。
    pp_unlimited_until_switch: (ctx: BattleEventContext): boolean => {
      ctx.updateElf(ctx.actor,{ppLimitIgnoredUntilSwitch:true} as any);
      return true;
    },
  };
}
