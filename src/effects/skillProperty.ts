import {portableSkillCapabilities} from '../battle/portableSkillMarks';
import type { KitEntry } from './effectSystem.schema';
import { fifthPpDiff } from '../blocks/ops/arenaShared';
import { evalCond } from '../blocks/runtime';
import { skillPropertyIssue } from './sequenceContract';
import { additionalAllowed,innateAllowed } from './additionalGate';
import { prdPercent } from '../utils/prd';
import { readMarkStacks } from './markQueries';
import {readStageLevels} from './stageQueries';
import type {ReductionPolicy} from '../battle/damageReduction';
import {skillTransformPatch} from '../blocks/ops/thunderGod';
import {getTypeMatchup} from '../utils/statCalculator';
export { skillPropertyIssue } from './sequenceContract';

export function readAttachedSureHit(skill:any,ctx:any):boolean {
  // 純命中預覽的pseudoCtx沒有狀態API；正式引擎已在前置轉換讀過完整上下文。
  // 缺少API時不能擅自假定附加封印為0，也不能為不含此屬性的普通Kit拋錯。
  if(skill?.effectMode!=='kit'||typeof ctx.getPlayerState!=='function')return false;
  return additionalAllowed(ctx)&&(skill.kit||[]).some((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='conditional_sure_hit'&&!skillPropertyIssue(e)&&e.params.conditions.every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true));
}

/** 使用前固有查詢：本次連擊次數寫入既有行動計數，其餘只改公式視圖，不改技能原件或能力等級。 */
export function applyFormulaProperties(skill:any,ctx:any) {
  const hits=readSkillProperty(skill,'attack_hits',ctx);
  if(hits){const r=hits.min===hits.max?0:(ctx.rng||Math.random)();ctx.setPlayerState('attackHitCountThisAction',hits.min+Math.min(hits.max-hits.min,Math.max(0,Math.floor(r*(hits.max-hits.min+1)))));}
  const extrema=readSkillProperty(skill,'combat_stat_extrema',ctx);
  const values=extrema?[ctx.self,ctx.target].flatMap(e=>['atk','def','spatk','spdef','speed'].map(k=>Number(e.calculatedStats[k]))):[];
  const resolvedCombatStats=extrema?{attack:Math.max(...values)*extrema.attackScale,defense:Math.min(...values)*extrema.defenseScale}:undefined;
  const resolvedTypeMultiplier=readSkillProperty(skill,'fixed_type_multiplier',ctx);
  const accuracy=readSkillProperty(skill,'base_accuracy',ctx);
  const power=readSkillProperty(skill,'base_power',ctx);
  const resolvedAttackStats=readSkillProperty(skill,'attack_stat_sum',ctx);
  const resolvedForceStab=readSkillProperty(skill,'force_stab',ctx)===true;
  const preferred=readSkillProperty(skill,'preferred_types',ctx) as string[]|undefined;
  const type=preferred?.reduce((best,next)=>getTypeMatchup(next,ctx.target.type)>getTypeMatchup(best,ctx.target.type)?next:best);
  const resolvedStageViews=!innateAllowed(ctx)?[]:(skill.kit||[]).filter((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='stage_view'&&!skillPropertyIssue(e)&&e.params.conditions.every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true)).map((e:KitEntry)=>e.params.value);
  if(resolvedStageViews.includes('opp_up_as_down'))ctx.setPlayerState('oppBoostAsDropThisAction',true);
  if(resolvedStageViews.includes('self_down_as_opp_down'))ctx.setPlayerState('selfDropAsOppDropThisAction',true);
  return {...skill,resolvedCombatStats,resolvedTypeMultiplier,resolvedStageViews,resolvedAttackStats,resolvedForceStab,...(type?{type}:{}),...(accuracy===undefined?{}:{accuracy}),...(power===undefined?{}:{power}),...(skillTransformPatch(skill,ctx,evalCond)||{})};
}

/** 「只有…才能命中」先於必中判定；條件不符時不能被必中繞過。 */
export function skillHitRequirementsMet(skill:any,ctx:any):boolean {
  if(skill?.effectMode!=='kit'||!innateAllowed(ctx))return true;
  return (skill.kit || []).filter((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='hit_requirement'&&!skillPropertyIssue(e))
    .every((e:KitEntry)=>e.params.conditions.every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true));
}

/** 固有查詢不靠原文再次猜測；來源切成Kit後仍必須在先制／命中判定前讀取。 */
export function readSkillProperty(skill:any,property:string,ctx:any) {
  if(skill?.effectMode!=='kit'||!innateAllowed(ctx))return undefined;
  const entries:KitEntry[]=skill.kit || [];
  const found=entries.filter(e=>e.codeId==='skill_property'&&e.params.property===property&&!skillPropertyIssue(e))
    .sort((a,b)=>a.order-b.order).find(e=>(e.params.conditions || []).every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true));
  return found?.params.value;
}

/** 兩側先制均結算後，套用所選技能的固有排序規則；不寫入跨回合旗標。 */
export function resolveSelectedPriorityPolicies(p1:number,p2:number,s1:any,s2:any,c1:any,c2:any):[number,number]{
  const ignore1=readSkillProperty(s1,'ignore_positive_priority',c1)===true;
  const ignore2=readSkillProperty(s2,'ignore_positive_priority',c2)===true;
  if(readSkillProperty(s1,'cap_opponent_priority',c1)===true)p2=Math.min(p2,p1);
  if(readSkillProperty(s2,'cap_opponent_priority',c2)===true)p1=Math.min(p1,p2);
  return [Math.min(ignore2?Math.min(0,p1):p1,portableSkillCapabilities(c2.self).priorityCeiling??Infinity),Math.min(ignore1?Math.min(0,p2):p2,portableSkillCapabilities(c1.self).priorityCeiling??Infinity)];
}

/** 每場一次用後的衰變讀取：once_used_degrade 已用過則回傳其參數（v＝對方先制懲罰），否則 null。 */
export function readOnceDegraded(skill:any,ctx:any):{v:number}|null {
  if(skill?.effectMode!=='kit')return null;
  for(const entry of skill.kit||[]){
    if(entry.codeId!=='effect_sequence')continue;
    for(const stmt of entry.params?.clause?.body||[]){
      for(const act of (stmt.acts||[])){
        if(act.op==='once_used_degrade'&&ctx.getPlayerState?.(`${act.p.key}:degraded`))return{v:act.p.v};
      }
    }
  }
  return null;
}

/** 在真正傷害公式前讀原始能力等級；不借描述、附加動作或上次行動旗標。 */
export function applyPowerProperties(skill:any,ctx:any){
  if(skill.effectMode!=='kit'||!innateAllowed(ctx))return skill;
  const bonus=(skill.kit||[]).filter((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='stage_power'&&!skillPropertyIssue(e))
    .reduce((sum:number,e:KitEntry)=>sum+e.params.value*readStageLevels(ctx,e.params.perStage),0);
  return bonus?{...skill,power:(skill.power||0)+bonus}:skill;
}

/** 先於裝備／魂印／狀態減傷，僅攻擊傷害，不等於繞過傷害上限、抵擋或護盾。 */
export function skillReductionPolicy(ctx:any,skill:any,policy:ReductionPolicy):ReductionPolicy{
  return readSkillProperty(skill,'ignore_damage_reduction',ctx)===true?{...policy,attenuation:0}:policy;
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
  for(const e of skill.kit||[])if(e.codeId==='skill_property'&&e.params.property==='mark_priority'&&!skillPropertyIssue(e)&&(e.params.conditions||[]).every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true))total+=e.params.value*readMarkStacks(ctx,e.params.perMark);
  return total;
}

/** 舊編輯／查詢入口的相容投影：只回傳積木所列先制，不擲機率、不借原文。 */
export function readListedPriority(skill:any,ctx:any,conditionalOnly=false):number {
  return (skill.kit||[]).filter((e:KitEntry)=>e.codeId==='skill_property'&&['base_priority','conditional_priority','mark_priority'].includes(e.params.property)&&!skillPropertyIssue(e))
    .reduce((sum:number,e:KitEntry)=>{
      if(e.role==='innate'?ctx.self.isInherentInvalid:!additionalAllowed(ctx))return sum;
      if(conditionalOnly&&!(e.params.conditions||[]).length)return sum;
      const conds = (e.params.conditions || []).every((c: any) => evalCond(ctx, c, { last: null, lastAmount: 0 }) === true);
      const mult = e.params.property === 'mark_priority' ? readMarkStacks(ctx, e.params.perMark) : (e.params as any).perPPDiff ? fifthPpDiff(ctx) : 1;
      return sum + (conds ? e.params.value * mult : 0);
    },0);
}

/**
 * 「使用時N%機率先制+M」：附加效果（可被附加效果失效封印），先制判定前擲一次，同回合同技能的重複查詢沿用同一結果。
 * 機率為 100% 時不消耗亂數。
 */
export function readChancePriority(skill:any,ctx:any,roll:(key:string,percent:number)=>boolean=prdPercent):number {
  if(skill?.effectMode!=='kit'||!additionalAllowed(ctx))return 0;
  const conditional=(skill.kit || []).filter((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='conditional_priority'&&!skillPropertyIssue(e))
    .reduce((sum:number,e:KitEntry)=>sum+((e.params.conditions||[]).length&&e.params.conditions.every((c:any)=>evalCond(ctx,c,{last:null,lastAmount:0})===true)?e.params.value:0),0); // 無 conditions 者（如 perPPDiff 第五技能PP差）由其自身讀取端處理，此處不重複計入也不得拋錯
  const entry:KitEntry|undefined=(skill.kit || []).filter((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='chance_priority'&&!skillPropertyIssue(e))
    .sort((a:KitEntry,b:KitEntry)=>a.order-b.order)[0];
  if(!entry)return conditional;
  const cache=ctx.getPlayerState('conditionalSkillPriorityRoll'),id=`${ctx.roundNumber}:${skill.name}`;
  if(cache?.id===id)return conditional+cache.bonus;
  const bonus=roll(`${ctx.actor}:${ctx.self.battleId || ctx.self.id}:${skill.name}:chance_priority`,entry.params.pct)?entry.params.value:0;
  ctx.setPlayerState('conditionalSkillPriorityRoll',{id,bonus});
  return conditional+bonus;
}
