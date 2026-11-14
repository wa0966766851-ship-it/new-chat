import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import {combineSettlementCallbacks} from '../../battle/settlementReceipt';
import {queueHpDrain} from '../../battle/hpDrain';
export const FORMULA_VIEW_FIELDS:Record<string,readonly string[]>={formula_stats:['stats','stats2'],base_damage_drain:['type','threshold','body'],exchange_current_hp:[]};
const statKeys=['atk','def','spatk','spdef','speed'];
export function formulaViewIssue(op:string,p:any,trig:string,nested:(body:any[],trig:string)=>string|null):string|null{
 if(op==='formula_stats'&&['stats','stats2'].some(k=>!Array.isArray(p[k])||!p[k].length||p[k].length>5||new Set(p[k]).size!==p[k].length||p[k].some((s:string)=>!statKeys.includes(s))))return '公式視圖需明確且不重複的能力清單';
 if(op==='base_damage_drain'){
  if(!['outgoing_attack','incoming_attack'].includes(trig)||!['fixed','percent','true'].includes(p.type)||!Number.isFinite(p.threshold)||p.threshold<=0||!Array.isArray(p.body)||!p.body.length)return '原始攻擊傷害吸取需公式事件、明確類型、正門檻與後續';
  return nested(p.body,trig);
 }
 if(op==='exchange_current_hp'&&trig!=='before_skill')return '交換當前體力需出手前';
 return null;
}
export function formulaViewOperations(h:{liveElf:Function;runStmts:Function}){return {
 formula_stats:(ctx:BattleEventContext,p:any)=>{ctx.setPlayerState('formulaStatView',{attackStats:[...p.stats],defenseAddStats:[...p.stats2]});return true;},
 base_damage_drain:(ctx:BattleEventContext,p:any,st:RunState)=>{
  const comp=st.event?.data?.damageComp||(ctx as any).damageComp;
  if(!comp||comp.damageCategory!=='skill_attack'||!(comp.base>0))return false;
  const amount=Math.floor(comp.base),owner=String(ctx.self.battleId||ctx.self.id);
  comp.afterDamage=combineSettlementCallbacks(comp.afterDamage,()=>{
   const self=h.liveElf(ctx,ctx.actor);if(String(self.battleId||self.id)!==owner||self.isVanished)return;
   queueHpDrain(ctx,ctx.targetSide,amount,p.type,'原始攻擊傷害吸取');
   if(amount<p.threshold)h.runStmts(ctx,p.body,{sourceKind:st.sourceKind,event:st.event,last:null,lastAmount:amount});
  });return true;
 },
 exchange_current_hp:(ctx:BattleEventContext)=>{
  const self=h.liveElf(ctx,ctx.actor),opp=h.liveElf(ctx,ctx.targetSide),a=self.currentHp,b=opp.currentHp;
  if(a===b)return false;
  // 交換當前值不等同恢復，也不截斷到原最大體力。
  ctx.updateElf(ctx.actor,{currentHp:b});ctx.updateElf(ctx.targetSide,{currentHp:a});return true;
 },
};}
