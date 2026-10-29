import type { BattleEventContext } from './types';

export type StageQuery={side:'self'|'opp';kind:'up'|'down'};
const keys=['atk','def','spatk','spdef','speed','accuracy'] as const;
/** 全屬性＝六項均有對應方向的實際等級；缺欄位、0、NaN均不能算全滿足。 */
export function hasAllStageDirection(elf:{statStages?:Record<string,number>},kind:'up'|'down'):boolean{
  return keys.every(key=>{const n=elf.statStages?.[key]??0;return Number.isFinite(n)&&(kind==='up'?n>0:n<0);});
}
/** 原始六項能力等級的合計；公式的「視為」不改此查詢，也不含HP或其他狀態欄位。 */
export function readStageLevels(ctx:BattleEventContext,p:StageQuery):number{
  const holder=p.side==='self'?ctx.self:ctx.target;
  return keys.reduce((sum,key)=>{
    const n=holder.statStages?.[key]??0;
    return sum+(Number.isFinite(n)?Math.max(0,n*(p.kind==='up'?1:-1)):0);
  },0);
}
/** 「種類」只計六項的符號，-6與-1各算一種，不含其他狀態欄。 */
export function readStageKinds(ctx:BattleEventContext,p:StageQuery):number{
  const holder=p.side==='self'?ctx.self:ctx.target;
  return keys.filter(key=>{const n=holder.statStages?.[key]??0;return Number.isFinite(n)&&(p.kind==='up'?n>0:n<0);}).length;
}
export function stageKindScaleIssue(q:any,integer=false):string|null{
  if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).some(k=>!['side','kind','amount'].includes(k))||stageQueryIssue({side:q.side,kind:q.kind})||!Number.isFinite(q.amount)||q.amount<=0||q.amount>1000000||integer&&!Number.isInteger(q.amount))return '每種能力狀態加量需明確目標、方向及有限正數，期限加量需整數';
  return null;
}
export function stageQueryIssue(q:any):string|null{
  return !q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).some(k=>!['side','kind'].includes(k))||!['self','opp'].includes(q.side)||!['up','down'].includes(q.kind)?'能力等級查詢需單一持有者及上升／下降方向':null;
}
