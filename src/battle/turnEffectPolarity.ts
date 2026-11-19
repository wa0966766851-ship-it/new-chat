import type {Timer} from './timers';
/** 依執行參數分類，不讀顯示文字；混合正負效果保守視為負面，不拆半個計時器。 */
export function turnEffectPolarity(t:Timer):'positive'|'negative'|'neutral'{
 if(t.polarity==='positive'||t.polarity==='negative'||t.polarity==='neutral')return t.polarity;
 const q=t.payload||{},p={...q,...q.block};
 if(p.invalid||p.addInvalid||p.boostInvalid||p.prio<0||p.priorityBoostValue<0||p.ppMult>1||p.dmgIn>0||p.dmgOut<0||p.dmgOutReduce>0||p.dmgOutMult<1||p.recoveryReductionPercent||p.ppRecoveryReductionPercent||p.lockSwitch||p.preventAction||p.inherentInvalid||p.disablePriority||p.incomingAttackCritical||p.incomingPhysicalSkillMultiplier>1||p.priorityDelta<0||p.statusInflictGuard)return 'negative';
 if(p.immune||p.reflect||p.immuneStatus||p.immuneStatusTurns||p.reflectStatusTurns||p.immuneStatDownTurns||p.statusGuard||p.prio>0||p.priorityDelta>0||p.priorityBoostTurns||p.dmgOut>0||p.dmgOutMult>1||p.dmgIn<0||p.crit||p.first||p.rebirth||p.survive||p.stageGuard||p.incomingSkillDmgCapTurns||p.immuneAttackTurns)return 'positive';
 // 已知的定時回復／吸取／向敵方施加效果屬於持有者收益；未知程式保持中性。
 const acts=(p.body||[]).flatMap((s:any)=>[...(s.acts||[]),...(s.elseActs||[])]);
 if(acts.length&&acts.every((a:any)=>
  ['heal','heal_flat','cure_status','pp_op'].includes(a.op)&&a.p?.side!=='opp'||
  ['drain','drain_checked_then','dmg','pp_drain_slots'].includes(a.op)&&a.p?.side!=='self'||
  a.op==='status'&&a.p?.side==='opp'||a.op==='stat'&&a.p?.side==='self'&&a.p?.v>0))return 'positive';
 return 'neutral';
}
