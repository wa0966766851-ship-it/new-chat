import type { Clause } from '../blocks/model';
import { eventTriggers, recordSkillUse, runClause, snapshotConditions, type RunState } from '../blocks/runtime';
import type { BattleEventContext, DamageComputation } from './types';
import { EffectTiming } from './types';
import { sequenceIssue } from './sequenceContract';
import type { KitEntry, Node } from './effectSystem.schema';

/** 狀態只存在於一次definition／node執行中；不寫入隊伍，不能串給下一隻。 */
export function prepareSequenceFrame(entries: KitEntry[], node: Node, ctx: BattleEventContext) {
  const clauses=entries.filter(e=>e.codeId==='effect_sequence'&&!sequenceIssue(e.params.clause,node)).map(e=>e.params.clause as Clause);
  const state: RunState={last:null,lastAmount:0,sourceKind:entries[0]?.source==='skill'?'skill':entries[0]?.source==='soulmark'?'soul':'trait',event:{trig:clauses[0]?.trig || 'custom',data:ctx}};
  snapshotConditions(ctx,clauses,state);
  // 連鎖版技能的「每次使用增加」計數：每次使用技能（附加效果未被封印而實際執行時）記一次。
  if(node==='on_skill_use'&&entries[0]?.source==='skill'&&ctx.skill?.name&&clauses.some(c=>c.trig==='use')) {
    const ramps=clauses.flatMap(c=>c.body.flatMap(b=>[...b.acts,...(b.elseActs||[])])).filter(a=>a.p?.rampInc!==undefined);
    if(ramps.length)recordSkillUse(ctx,ramps.some(a=>a.p.rampReset==='switch'));
  }
  return state;
}
export function runEffectSequence(clause: Clause, ctx: BattleEventContext & {effectNode?: Node;sequenceFrame?: RunState;damageComp?: DamageComputation;damageType?: string;typedSkill?: boolean;effectEntrySource?: KitEntry['source']}) {
  const issue=sequenceIssue(clause,ctx.effectNode);if(issue)throw new Error(issue);
  if(ctx.effectNode==='before_damage'&&!eventTriggers(ctx,EffectTiming.BEFORE_DAMAGE,{damageComp:ctx.damageComp}).includes(clause.trig))return;
  if(ctx.effectNode==='on_damaged'&&!eventTriggers(ctx,EffectTiming.ON_DAMAGED,{targetSide:ctx.actor,damageType:ctx.damageType,typedSkill:ctx.typedSkill}).includes(clause.trig))return;
  const category=ctx.skill?.category;
  if(/(?:self|opp)(?:_after)?_attack$/.test(clause.trig)&&(!category||category==='屬性'))return;
  if(/(?:self|opp)(?:_after)?_status$/.test(clause.trig)&&category!=='屬性')return;
  if(clause.trig==='self_after_physical'&&category!=='物理')return;
  if(clause.trig==='self_after_special'&&category!=='特殊')return;
  if(ctx.effectNode==='passive_always'&&!ctx.damageComp)return;
  const state=ctx.sequenceFrame || prepareSequenceFrame([{codeId:'effect_sequence',params:{clause},node:ctx.effectNode!,source:'skill',order:0}],ctx.effectNode!,ctx);
  if(ctx.effectEntrySource)state.sourceKind=ctx.effectEntrySource==='skill'?'skill':ctx.effectEntrySource==='soulmark'?'soul':'trait';
  state.event={trig:clause.trig,data:ctx};
  runClause(ctx,clause,state);
}
