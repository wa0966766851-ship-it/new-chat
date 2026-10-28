/** 可編輯的面板轉移、期限壓縮與數值查詢積木；不依精靈名稱分派。 */
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { StatusRegistry } from '../../effects/statusRegistry';
import {statusDurationSum} from '../../effects/statusCollection';

const stats = ['hp','atk','def','spatk','spdef','speed'] as const;
const id = (e:any) => String(e.battleId || e.id);
export const PANEL_DURATION_FIELDS:Record<string,readonly string[]> = {
  panel_pool_transfer:['ratio','unit','gain'],
  compress_turn_effects:['side','remaining'],
  query_number:['side','kind','status'],
  pending_damage_write:['key','ratio'], pending_damage_use:['key','type'],
  status_extend_by_last:['status'],
  stat_by_status_duration:['status','base','factor'],
  damage_scale_by_status:['side','base','perTurn','kind'],
  power_per_full_pp:['amount'],
  effect_end_watch:['turns','mode','count','status'],
  status_convert_uses:['count','status'],
  bound_penalty:['turns','ppMultiplier','ppKind','sealKind'],
  stop_action:['side'],
  status_guard_instance:['status','kind'],
  survive_uses:['uses'],
};
export function panelDurationIssue(op:string,p:any,trig?:string):string|null {
  if(op==='power_per_full_pp'&&trig!==undefined&&trig!=='outgoing_power')return '滿PP威力必須接至公式前的輸出威力事件';
  if(op==='damage_scale_by_status'&&trig!==undefined&&!['outgoing_attack','outgoing_skill'].includes(trig))return '異常回合增傷必須接至輸出傷害事件';
  if(op==='panel_pool_transfer' && (!(p.ratio>0&&p.ratio<=1)||!(p.unit>0)||!(p.gain>0)))return '面板轉移需降低比例、換算單位與每單位增益';
  if(op==='compress_turn_effects'&&(!['self','opp','both'].includes(p.side)||!Number.isInteger(p.remaining)||p.remaining<1))return '期限壓縮需目標及正整數剩餘回合';
  if(op==='query_number'&&(!['self','opp'].includes(p.side)||!['status_turns','full_pp'].includes(p.kind)))return '數值查詢需目標與已知來源';
  if(op==='pending_damage_write'&&(!(p.ratio>0)||!p.key))return '待用傷害需比例與儲存鍵';
  if(op==='pending_damage_use'&&(!p.key||!['百分比','固定','真實'].includes(p.type)))return '待用傷害需儲存鍵與傷害種類';
  if(['status_extend_by_last','stat_by_status_duration','status_convert_uses'].includes(op)&&!StatusRegistry[p.status])return '需已登記的異常';
  if(op==='stat_by_status_duration'&&(!(p.base>0)||!(p.factor>=1)))return '強化需正值與逐回合倍率';
  if(op==='damage_scale_by_status'&&(!['self','opp'].includes(p.side)||!(p.base>0)||!(p.perTurn>=0)||!['攻擊','技能'].includes(p.kind)))return '傷害倍率需目標、基礎倍率與每異常回合增量';
  if(op==='power_per_full_pp'&&!(p.amount>0))return '滿PP威力需正增量';
  if(op==='effect_end_watch'&&(!(p.turns>0)||!(p.count>0)||!['immune','convert'].includes(p.mode)||(p.mode==='convert'&&!StatusRegistry[p.status])))return '效果結束監控需期限、次數與免疫／轉化模式';
  if(op==='status_convert_uses'&&!(p.count>0))return '異常轉化需正次數';
  if(op==='bound_penalty'&&(!(p.turns>0)||!(p.ppMultiplier>=1)||!['攻擊','屬性','all'].includes(p.ppKind)||!['攻擊','屬性','all'].includes(p.sealKind)))return '綁定懲罰需期限、PP倍率及各自技能範圍';
  if(op==='stop_action'&&!['self','opp'].includes(p.side))return '行動阻止需明確目標';
  if(op==='status_guard_instance'&&(!StatusRegistry[p.status]||p.kind!=='技能'))return '異常期間抵擋需已知異常與技能傷害範圍';
  if(op==='survive_uses'&&(!Number.isInteger(p.uses)||p.uses<1))return '致死存活需正整數次數';
  return null;
}

export function panelDurationOperations(h:{liveElf:Function;dealDamage:Function;runStmts:Function;addBlockTimer:Function;ops:()=>any}) {
  const side=(ctx:BattleEventContext,s:string)=>s==='self'?ctx.actor:ctx.targetSide;
  return {
    panel_pool_transfer:(ctx:BattleEventContext,p:any,st:RunState)=>{
      let reduced=0;
      for(const elf of ctx.getFullTeam(ctx.targetSide)||[]){
        if(elf.isVanished)continue;
        const next={...elf.calculatedStats,hp:elf.maxHp};
        for(const k of stats){const loss=Math.min(Math.max(0,next[k]-1),Math.floor(next[k]*p.ratio));next[k]-=loss;reduced+=loss;}
        ctx.updateAnyElf?.(ctx.targetSide,id(elf),{calculatedStats:next,maxHp:next.hp,currentHp:Math.min(elf.currentHp,next.hp)});
      }
      st.lastAmount=reduced;
      const bonus=Math.floor(reduced/p.unit)*p.gain;
      if(bonus>0){const self=h.liveElf(ctx,ctx.actor),next={...self.calculatedStats,hp:self.maxHp};for(const k of stats)next[k]+=bonus;
        ctx.updateElf(ctx.actor,{calculatedStats:next,maxHp:next.hp});}
      ctx.addLog(`面板轉移：敵方六項實際降低合計 ${reduced}，自身六項各增加 ${bonus}。`,'effect');
      return reduced>0;
    },
    compress_turn_effects:(ctx:BattleEventContext,p:any,st:RunState)=>{
      let n=0;
      for(const s of (p.side==='both'?[ctx.actor,ctx.targetSide]:[side(ctx,p.side)])){
        const list=[...(s==='p1'?ctx.p1Timers:ctx.p2Timers)||[]];
        const get=s===ctx.actor?ctx.getPlayerState:ctx.getOpponentState;
        const set=s===ctx.actor?ctx.setPlayerState:ctx.setOpponentState;
        for(const t of list){
          if(t.kind!=='turn_effect'||t.remaining<=p.remaining)continue;
          n+=t.remaining-p.remaining;
          // 次數消耗 API 每次扣一點；先完整移除再加入，避免 refresh 取最大值而無法縮短。
          for(let i=0;i<t.remaining;i++)ctx.consumeTimer?.(s,t.id);
          ctx.addTimerTo(s,{...t,remaining:p.remaining,lateMoverPending:false,stackRule:'refresh'},false);
          for(const key of t.payload?.mirrorRegistryKeys||[])if(Number(get(key))>p.remaining)set(key,p.remaining);
        }
      }
      st.lastAmount=n;return n>0;
    },
    query_number:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const e=h.liveElf(ctx,side(ctx,p.side));
      st.lastAmount=p.kind==='full_pp'?e.skills.filter((s:any)=>s.pp>0&&s.pp===(s.maxPp??s.pp)).length:
        p.status?Math.max(0,Number(ctx.getStatuses(e)?.[p.status])||0):statusDurationSum(ctx,[e]);
      return st.lastAmount>0;
    },
    pending_damage_write:(ctx:BattleEventContext,p:any,st:RunState)=>{
      // 最近一次覆寫，包含 n=0；不把不同結算的獎勵疊加。
      ctx.setPlayerState(`pendingDamage:${p.key}`,Math.max(0,st.lastAmount)*p.ratio);return true;
    },
    pending_damage_use:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const key=`pendingDamage:${p.key}`,ratio=Number(ctx.getPlayerState(key))||0;
      ctx.setPlayerState(key,0);
      if(!ratio)return false;
      h.dealDamage(ctx,ctx.targetSide,h.liveElf(ctx,ctx.actor).maxHp*ratio,p.type,undefined,st);return true;
    },
    status_extend_by_last:(ctx:BattleEventContext,p:any,st:RunState)=>st.lastAmount>0&&h.ops().status_or_extend(ctx,{side:'self',status:p.status,turns:st.lastAmount,extend:st.lastAmount},st),
    stat_by_status_duration:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const n=Number(ctx.getStatuses(h.liveElf(ctx,ctx.actor))?.[p.status])||0;
      return h.ops().stat(ctx,{side:'self',stats:['全屬性'],v:Math.min(12,p.base*Math.pow(p.factor,n))},st);
    },
    damage_scale_by_status:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const n=statusDurationSum(ctx,[h.liveElf(ctx,side(ctx,p.side))]);
      return h.ops().damage_scale(ctx,{kind:p.kind,mult:p.base+p.perTurn*n},st);
    },
    power_per_full_pp:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const n=h.liveElf(ctx,ctx.actor).skills.filter((s:any)=>s.pp>0&&s.pp===(s.maxPp??s.pp)).length;
      return h.ops().boost(ctx,{power:true,add:n*p.amount},st);
    },
    effect_end_watch:(ctx:BattleEventContext,p:any,st:RunState)=>{
      h.addBlockTimer(ctx,ctx.actor,'回合效果結束監控',p.turns,'turns',{effectEndWatch:{mode:p.mode,count:p.count,status:p.status},sourceKind:st.sourceKind},false,undefined,true);return true;
    },
    status_convert_uses:(ctx:BattleEventContext,p:any)=>{
      h.addBlockTimer(ctx,ctx.actor,'異常轉化',p.count,'uses',{statusConversion:{status:p.status}},false);return true;
    },
    bound_penalty:(ctx:BattleEventContext,p:any)=>{
      const e=h.liveElf(ctx,ctx.targetSide);
      ctx.addTimerTo(ctx.targetSide,{id:`boundPenalty:${ctx.actor}:${id(ctx.self)}`,name:'附加效果封印／PP消耗',kind:'turn_effect',source:'skill',remaining:p.turns,tickAt:'round_end',scope:'elf',ownerBattleId:id(e),persistsOffField:true,payload:{block:{ppMult:p.ppMultiplier,kind:p.ppKind,addInvalid:p.sealKind}}},false);return true;
    },
    stop_action:(ctx:BattleEventContext,p:any)=>{
      const s=side(ctx,p.side),set=s===ctx.actor?ctx.setPlayerState:ctx.setOpponentState;
      set('actionPreventedRound',ctx.roundNumber??0);return true;
    },
    status_guard_instance:(ctx:BattleEventContext,p:any)=>{
      if(!(ctx.getStatuses(h.liveElf(ctx,ctx.actor))?.[p.status]>0))return false;
      h.addBlockTimer(ctx,ctx.actor,'本次異常期間抵擋',1,'uses',{statusInstanceGuard:p.status,kind:p.kind},false);return true;
    },
    survive_uses:(ctx:BattleEventContext,p:any)=>{h.addBlockTimer(ctx,ctx.actor,'下次致死存活',p.uses,'uses',{survive:true},false);return true;},
  };
}
