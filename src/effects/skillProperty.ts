import type { KitEntry } from './effectSystem.schema';
import { evalCond } from '../blocks/runtime';
import { skillPropertyIssue } from './sequenceContract';
import { additionalAllowed } from './additionalGate';
import { prdPercent } from '../utils/prd';
export { skillPropertyIssue } from './sequenceContract';

export function readAttachedSureHit(skill:any,ctx:any):boolean {
  // 純命中預覽的pseudoCtx沒有狀態API；正式引擎已在前置轉換讀過完整上下文。
  // 缺少API時不能擅自假定附加封印為0，也不能為不含此屬性的普通Kit拋錯。
  if(skill?.effectMode!=='kit'||typeof ctx.getPlayerState!=='function')return false;
  return additionalAllowed(ctx)&&(skill.kit||[]).some((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='conditional_sure_hit'&&!skillPropertyIssue(e)&&e.params.conditions.every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true));
}

/** 僅改本次公式視圖／命中輸入，不修改技能原件或任何真實能力等級。 */
export function applyFormulaProperties(skill:any,ctx:any) {
  const accuracy=readSkillProperty(skill,'base_accuracy',ctx);
  const stage=readSkillProperty(skill,'stage_view',ctx);
  if(stage==='opp_up_as_down')ctx.setPlayerState('oppBoostAsDropThisAction',true);
  if(stage==='self_down_as_opp_down')ctx.setPlayerState('selfDropAsOppDropThisAction',true);
  return accuracy===undefined?skill:{...skill,accuracy};
}

/** 固有查詢不靠原文再次猜測；來源切成Kit後仍必須在先制／命中判定前讀取。 */
export function readSkillProperty(skill:any,property:string,ctx:any) {
  if(skill.effectMode!=='kit'||ctx.self?.isInherentInvalid)return undefined;
  const entries:KitEntry[]=skill.kit || [];
  const found=entries.filter(e=>e.codeId==='skill_property'&&e.params.property===property&&!skillPropertyIssue(e))
    .sort((a,b)=>a.order-b.order).find(e=>(e.params.conditions || []).every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true));
  return found?.params.value;
}

/**
 * 基礎先制：無條件的先制句取代欄位先制；條件式先制句（「X時先制+N」）成立時加在其上，
 * 與描述路徑（skill.priority || 無條件先制 + 條件加成）一致，多句可疊加。
 */
export function readBasePriority(skill:any,ctx:any):number {
  if(skill.effectMode!=='kit'||ctx.self?.isInherentInvalid)return skill.priority ?? 0;
  const entries:KitEntry[]=(skill.kit || []).filter((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='base_priority'&&!skillPropertyIssue(e))
    .sort((a:KitEntry,b:KitEntry)=>a.order-b.order);
  const flat=entries.find(e=>!(e.params.conditions || []).length);
  let total=flat?flat.params.value:(skill.priority ?? 0);
  for(const e of entries)if((e.params.conditions || []).length&&e.params.conditions.every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true))total+=e.params.value;
  return total;
}

/** 舊編輯／查詢入口的相容投影：只回傳積木所列先制，不擲機率、不借原文。 */
export function readListedPriority(skill:any,ctx:any,conditionalOnly=false):number {
  return (skill.kit||[]).filter((e:KitEntry)=>e.codeId==='skill_property'&&['base_priority','conditional_priority'].includes(e.params.property)&&!skillPropertyIssue(e))
    .reduce((sum:number,e:KitEntry)=>{
      if(e.role==='innate'?ctx.self.isInherentInvalid:!additionalAllowed(ctx))return sum;
      if(conditionalOnly&&!e.params.conditions.length)return sum;
      return sum+(e.params.conditions.every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true)?e.params.value:0);
    },0);
}

/**
 * 「使用時N%機率先制+M」：附加效果（可被附加效果失效封印），先制判定前擲一次，同回合同技能的重複查詢沿用同一結果。
 * 機率為 100% 時不消耗亂數。
 */
export function readChancePriority(skill:any,ctx:any,roll:(key:string,percent:number)=>boolean=prdPercent):number {
  if(skill?.effectMode!=='kit'||!additionalAllowed(ctx))return 0;
  const conditional=(skill.kit || []).filter((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='conditional_priority'&&!skillPropertyIssue(e))
    .reduce((sum:number,e:KitEntry)=>sum+(e.params.conditions.every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true)?e.params.value:0),0);
  const entry:KitEntry|undefined=(skill.kit || []).filter((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='chance_priority'&&!skillPropertyIssue(e))
    .sort((a:KitEntry,b:KitEntry)=>a.order-b.order)[0];
  if(!entry)return conditional;
  const cache=ctx.getPlayerState('conditionalSkillPriorityRoll'),id=`${ctx.roundNumber}:${skill.name}`;
  if(cache?.id===id)return conditional+cache.bonus;
  const bonus=roll(`${ctx.actor}:${ctx.self.battleId || ctx.self.id}:${skill.name}:chance_priority`,entry.params.pct)?entry.params.value:0;
  ctx.setPlayerState('conditionalSkillPriorityRoll',{id,bonus});
  return conditional+bonus;
}
