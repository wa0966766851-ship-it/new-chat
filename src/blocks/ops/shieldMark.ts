import type { BattleEventContext } from '../../effects/types';
import { armConditionalRebirth } from '../../effects/conditionalRebirth';
import { multiplyDamageReduction } from '../../battle/damageReduction';
import { markAppliesToElf } from '../../battle/marks';
import type { RunState } from '../runtime';
type S = 'p1' | 'p2';
const idOf = (e:any) => String(e?.battleId || e?.id || '');
export const SHIELD_MARK_ACTION_FIELDS:Record<string,readonly string[]>={
 shield_change_mark:['perStep','markId','markName','displayChar','maxCount','side'],
 conditional_rebirth:['afterRounds','ratio'],shield_entry_copy:['flat'],
 shield_guard_snapshot:['step','turns','capRatio'],shield_guard_damage:['halves','capRatio'],
 mark_pair_rebirth:['selfId','selfCost','oppId','oppCost','ratio'],
};
export function shieldMarkActionIssue(op:string,p:any):string|null {
 if(op==='shield_change_mark'&&(!Number.isInteger(p.perStep)||p.perStep<1||!p.markId||!p.markName||!Number.isInteger(p.maxCount)||p.maxCount<1||!['self','opp'].includes(p.side)))return '護盾變化需步進、印記、上限及對象';
 if(op==='conditional_rebirth'&&(!Number.isInteger(p.afterRounds)||p.afterRounds<0||!(p.ratio>0&&p.ratio<=1)))return '條件重生需回合與體力比例';
 if(op==='shield_entry_copy'&&!(p.flat>=0))return '登場護盾需非負固定量';
 if(op==='shield_guard_snapshot'&&(!(p.step>0)||!Number.isInteger(p.turns)||p.turns<1||!(p.capRatio>0&&p.capRatio<=1)))return '護盾減傷快照需步進、回合及上限比例';
 if(op==='shield_guard_damage'&&(!Number.isInteger(p.halves)||p.halves<0||!(p.capRatio>0&&p.capRatio<=1)))return '護盾減傷需非負次數與上限比例';
 if(op==='mark_pair_rebirth'&&(!p.selfId||!p.oppId||!Number.isInteger(p.selfCost)||p.selfCost<1||!Number.isInteger(p.oppCost)||p.oppCost<1||!(p.ratio>0&&p.ratio<=1)))return '配對重生需雙方印記、道數及體力比例';
 return null;
}
export function shieldMarkOperations(h:{liveElf:(ctx:BattleEventContext,side:S)=>any;addBlockTimer:(...args:any[])=>any;runAct:(ctx:BattleEventContext,act:any,st:RunState)=>any}) {
 const total=(ctx:BattleEventContext)=>[ctx.actor,ctx.targetSide].reduce((v,side)=>v+Math.max(0,Number(h.liveElf(ctx,side as S)?.shield)||0),0);
 return {
 shield_change_mark:(ctx:BattleEventContext,p:any)=>{ctx.updateAnyElf(ctx.actor,idOf(h.liveElf(ctx,ctx.actor)),{shieldChangeMarkRule:{...p}} as any);return true;},
 shield_entry_copy:(ctx:BattleEventContext,p:any)=>{const before=ctx.getPlayerState('entryFieldShieldTotal');ctx.setPlayerState('entryFieldShieldTotal',undefined);ctx.applyShield(ctx.actor,p.flat+(Number.isFinite(before)?before:total(ctx)));return true;},
 shield_guard_snapshot:(ctx:BattleEventContext,p:any)=>{
 const halves=Math.floor(total(ctx)/p.step);if(halves<1)return false;
 h.addBlockTimer(ctx,ctx.actor,'護盾量減傷快照',p.turns,'turns',{trig:'incoming',body:[{acts:[{op:'shield_guard_damage',p:{halves,capRatio:p.capRatio},label:'逐次減半與動態上限'}]}]},false,'round_counter',true,'elf','shieldGuard:'+idOf(ctx.self));return true;},
 shield_guard_damage:(ctx:BattleEventContext,p:any,st:RunState)=>{const comp=st.event?.data?.damageComp||st.event?.data;if(!comp?.isIncoming||!['fixed','percent'].includes(comp.damageCategory)||comp.pure)return false;multiplyDamageReduction(comp,0.5**p.halves);comp.limit=Math.min(comp.limit??Infinity,Math.floor(total(ctx)*p.capRatio));return true;},
 mark_pair_rebirth:(ctx:BattleEventContext,p:any,st:RunState)=>{
 if(st.event?.trig!=='fatal')return false;
 const get=(side:S,id:string)=>ctx.getMarks(side).find(m=>m.id===id&&markAppliesToElf(m,h.liveElf(ctx,side)));
 const own=get(ctx.actor,p.selfId),opp=get(ctx.targetSide,p.oppId);if(!own||!opp||own.count<p.selfCost||opp.count<p.oppCost)return false;
 for(const [side,mark,cost] of [[ctx.actor,own,p.selfCost],[ctx.targetSide,opp,p.oppCost]] as const){if(mark.count===cost)ctx.clearMark(mark.id,side,mark.ownerBattleId||null);else ctx.setMark({...mark,count:mark.count-cost},side);}
 ctx.updateElf(ctx.actor,{currentHp:Math.max(1,Math.floor(ctx.self.maxHp*p.ratio))});h.runAct(ctx,{op:'cure_status',p:{side:'self'},label:'重生解除異常'},st);st.survived=true;return true;},
 conditional_rebirth:(ctx:BattleEventContext,p:any)=>armConditionalRebirth(ctx,p),
 };}
