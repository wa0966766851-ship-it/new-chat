import type {BattleEventContext} from './types';
import {readMarkStacks} from './markQueries';

/** 只縮放動作的數量；目標、期限、事件及印記原始層數保持不變。 */
export const MARK_SCALE_FIELDS:Record<string,readonly string[]>={
  dmg:['flat','ratio'],drain:['flat','ratio','ratioCur'],heal:['ratio','missingRatio'],heal_missing:['ratio'],heal_flat:['amount'],
  pp_drain:['v'],shield:['flat','ratio'],dmg_mod:['boost'],stat_steal:['v'],resource_mark_add:['amount'],
  power_mod:['boost'],
};
type Threshold={side:'self'|'opp';id:string;min:number};
type Rule={when:Threshold[];factor:number};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function actionMarkScaleIssue(op:string,p:Record<string,any>):string|null{
  if(p.scaleByMarks===undefined)return null;
  const fields=MARK_SCALE_FIELDS[op];
  if(!fields||!fields.some(k=>typeof p[k]==='number'))return '印記倍率必須對應已接通的動作數量欄位';
  const rules=p.scaleByMarks;
  if(!Array.isArray(rules)||!rules.length||rules.length>4)return '印記倍率需1至4條條件';
  let maximum=1;
  for(const rule of rules){
    if(!object(rule)||Object.keys(rule).some(k=>!['when','factor'].includes(k))||!Number.isInteger(rule.factor)||rule.factor<1||rule.factor>16||!Array.isArray(rule.when)||!rule.when.length||rule.when.length>4)return '印記倍率需1至16整數及1至4個共同門檻';
    for(const q of rule.when)if(!object(q)||Object.keys(q).some(k=>!['side','id','min'].includes(k))||!['self','opp'].includes(q.side)||typeof q.id!=='string'||!q.id||q.id.length>200||!Number.isSafeInteger(q.min)||q.min<1||q.min>1e6)return '印記倍率門檻需單一持有者、識別碼與正整數層數';
    maximum*=rule.factor;
  }
  if(fields.some(k=>p[k]!==undefined&&(!Number.isFinite(p[k])||p[k]<0||p[k]*maximum>1e6)))return '倍率後數量需為有限非負數值且不超過1000000';
  return null;
}
export function scaleActionByMarks(ctx:BattleEventContext,op:string,p:Record<string,any>):Record<string,any>{
  if(p.scaleByMarks===undefined)return p;
  const issue=actionMarkScaleIssue(op,p);if(issue)throw new Error(issue);
  let multiplier=1;
  for(const rule of p.scaleByMarks as Rule[])if(rule.when.every(q=>readMarkStacks(ctx,q)>=q.min))multiplier*=rule.factor;
  const next={...p};delete next.scaleByMarks;
  for(const field of MARK_SCALE_FIELDS[op])if(typeof p[field]==='number')next[field]=p[field]*multiplier;
  return next;
}
