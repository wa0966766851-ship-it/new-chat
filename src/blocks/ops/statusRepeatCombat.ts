import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import {statusDurationSum} from '../../effects/statusCollection';
import {queueHpDrain} from '../../battle/hpDrain';

export const STATUS_REPEAT_COMBAT_FIELDS:Record<string,readonly string[]>={
 status_turn_drains:['ratio','perTurn'],
 self_stat_recoil:['stat','ratio','type','floor'],
 random_streak_power:['min','max','step','cap','stageMultiplier'],
};
export function statusRepeatCombatIssue(op:string,p:any,trig:string):string|null{
 if(op==='status_turn_drains'&&(!Number.isFinite(p.ratio)||p.ratio<=0||p.ratio>1||!Number.isSafeInteger(p.perTurn)||p.perTurn<0))return '逐異常回合吸取需最大體力比例與非負整數次數';
 if(op==='self_stat_recoil'&&(!['atk','def','spatk','spdef','speed'].includes(p.stat)||!Number.isFinite(p.ratio)||p.ratio<=0||p.ratio>1||!['真實','百分比','固定'].includes(p.type)||!Number.isSafeInteger(p.floor)||p.floor<0))return '自身能力反噬需能力鍵、正比例、傷害類型與非負體力下限';
 if(op==='random_streak_power'&&(trig!=='outgoing_power'||!['min','max','step','cap'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0)||p.min>p.max||p.max>p.cap||p.cap>10000||!Number.isFinite(p.stageMultiplier)||p.stageMultiplier<1))return '隨機連續威力需正式威力節點、有序整數範圍與強化倍率';
 return null;
}
export function statusRepeatCombatOperations(h:{liveElf:Function}){return {
 status_turn_drains:(ctx:BattleEventContext,p:any)=>{
  const n=statusDurationSum(ctx,[h.liveElf(ctx,ctx.actor),h.liveElf(ctx,ctx.targetSide)]);
  const amount=Math.floor(h.liveElf(ctx,ctx.targetSide).maxHp*p.ratio);
  // 回合數與單份體力取觸發快照；每次都經正式傷害與恢復，不能先合併。
  for(let i=0;i<1+n*p.perTurn;i++)queueHpDrain(ctx,ctx.targetSide,amount,'percent','逐回合獨立吸取');
  return amount>0;
 },
 self_stat_recoil:(ctx:BattleEventContext,p:any)=>{
  const self=h.liveElf(ctx,ctx.actor),amount=Math.floor((self.calculatedStats?.[p.stat]||0)*p.ratio);
  if(!(amount>0))return false;
  const opts={minimumRemainingHp:p.floor};
  if(p.type==='真實')ctx.applyTrueDamage(ctx.actor,amount,'自身能力反噬',undefined,undefined,opts);
  else ctx.applyPinkDamage(ctx.actor,amount,'自身能力反噬',undefined,undefined,p.type==='固定'?'fixed':'percent',opts);
  return true;
 },
 random_streak_power:(ctx:BattleEventContext,p:any,st:RunState)=>{
  const comp=(ctx as any).powerComp||st.event?.data?.powerComp;if(!comp)return false;
  const self=h.liveElf(ctx,ctx.actor),count=Math.max(1,Number(ctx.getPlayerState('skillUseSequence')?.count)||1);
  const mult=Object.values(self.statStages||{}).some(v=>Number(v)>0)?p.stageMultiplier:1;
  const min=Math.floor(Math.min(p.cap,p.min+(count-1)*p.step)*mult),max=Math.floor(p.max*mult);
  const saved=ctx.getPlayerState('randomPowerThisAction');
  const value=saved?.actionId===ctx.actionId&&ctx.actionId!==undefined?saved.value:min+Math.floor((ctx.rng||Math.random)()*(max-min+1));
  ctx.setPlayerState('randomPowerThisAction',{actionId:ctx.actionId,value});comp.power=value;return true;
 },
};}
