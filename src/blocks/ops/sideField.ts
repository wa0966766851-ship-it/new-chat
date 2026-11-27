import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import {SIDE_FIELD_KEY,PENDING_SIDE_FIELD_KEY,validSideField,activeSideField} from '../../battle/sideFieldModel';
import {reportFatalResult} from '../../battle/fatalHold';

export const SIDE_FIELD_FIELDS:Record<string,readonly string[]>={
 side_field_set:['field','evenField','onlyEmpty','next'],side_field_refresh:['turns','excludeForced','body'],
 side_field_branch:['id','body','elseBody'],survive_per_stay:['key','hp','reset'],
 skill_properties_uses:['uses','sureHit','first'],
};
export function sideFieldIssue(op:string,p:any):string|null{
 if(op==='side_field_set'&&(!validSideField(p.field)||p.evenField!==undefined&&!validSideField(p.evenField)))return '場地需有效識別、說明、期限及效果參數';
 if(op==='side_field_refresh'&&(!Number.isInteger(p.turns)||p.turns<1||p.turns>1000))return '場地刷新需有效期限';
 if(op==='side_field_branch'&&(typeof p.id!=='string'||!Array.isArray(p.body)||!Array.isArray(p.elseBody)))return '場地分支需識別及兩條子流程';
 if(op==='survive_per_stay'&&(typeof p.key!=='string'||!Number.isInteger(p.hp)||p.hp<1))return '每次在場存活需識別及正保留體力';
 if(op==='skill_properties_uses'&&(!Number.isInteger(p.uses)||p.uses<1||typeof p.sureHit!=='boolean'||typeof p.first!=='boolean'))return '技能屬性需明確次數、必中與先手';
 return null;
}
export function sideFieldOperations(runStmts:(ctx:BattleEventContext,body:any[],st:RunState)=>any){return {
 side_field_set:(ctx:BattleEventContext,p:any)=>{
  if(!validSideField(p.field)||p.evenField&&!validSideField(p.evenField))return false;
  if(p.onlyEmpty&&activeSideField(ctx.getPlayerState(SIDE_FIELD_KEY),ctx.roundNumber))return false;
  const field=structuredClone(p.evenField&&(ctx.roundNumber??1)%2===0?p.evenField:p.field);
  if(p.next)ctx.setPlayerState(PENDING_SIDE_FIELD_KEY,{round:(ctx.roundNumber??0)+1,field});
  else ctx.setPlayerState(SIDE_FIELD_KEY,{...field,expiresRound:(ctx.roundNumber??1)+field.remaining-1});
  return true;
 },
 side_field_refresh:(ctx:BattleEventContext,p:any,st:RunState)=>{
  if(p.excludeForced&&st.event?.data?.forced===true)return false;
  const field=activeSideField(ctx.getPlayerState(SIDE_FIELD_KEY),ctx.roundNumber);
  if(field)ctx.setPlayerState(SIDE_FIELD_KEY,{...field,remaining:p.turns,expiresRound:(ctx.roundNumber??1)+p.turns-1});
  if(p.body)runStmts(ctx,p.body,st);return true;
 },
 side_field_branch:(ctx:BattleEventContext,p:any,st:RunState)=>{
  const field=activeSideField(ctx.getPlayerState(SIDE_FIELD_KEY),ctx.roundNumber);
  runStmts(ctx,field?.remaining>0&&field.id===p.id?p.body:p.elseBody,st);return st.last===true;
 },
 survive_per_stay:(ctx:BattleEventContext,p:any,st:RunState)=>{
  const key=`perStaySurvival:${p.key}`;
  if(p.reset){ctx.setPlayerState(key,false);return true;}
  if(st.event?.trig!=='fatal'||ctx.getPlayerState(key))return false;
  ctx.setPlayerState(key,true);reportFatalResult(ctx,'hold');
  ctx.updateAnyElf(ctx.actor,ctx.self.battleId||ctx.self.id,{currentHp:Math.min(ctx.self.maxHp,p.hp)});
  st.survived=true;return true;
 },
 skill_properties_uses:(ctx:BattleEventContext,p:any)=>{
  ctx.addTimerTo(ctx.actor,{id:'next-skill-properties',name:'技能先手／必中',kind:'use_counter',source:'soulmark',remaining:p.uses,tickAt:'never',scope:'elf',stackRule:'refresh',
   payload:{block:{sureHit:p.sureHit,allSkills:true,first:p.first,prio:0}}},false);return true;
 },
};}
