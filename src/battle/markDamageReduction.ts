/** 印記自帶的減傷查詢；基礎值與逐層增量分開，期限／持有者由印記容器管理。 */
export interface MarkDamageReduction {
  kind:'攻擊'|'技能'|'非真實'|'固定'|'百分比';
  ratio:number;
  perStack:boolean;
  baseRatio?:number;
  cap?:number;
}
export function markDamageReductionIssue(value:unknown):string|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return '印記減傷需參數物件';
  const p=value as Record<string,unknown>;
  if(Object.keys(p).some(k=>!['kind','ratio','perStack','baseRatio','cap'].includes(k)))return '印記減傷包含未接通欄位';
  if(!['攻擊','技能','非真實','固定','百分比'].includes(p.kind as string)||typeof p.perStack!=='boolean')return '印記減傷需明確傷害類型與逐層規則';
  for(const key of ['ratio','baseRatio','cap']){
    const n=p[key];if(key!=='ratio'&&n===undefined)continue;
    if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)return '印記減傷比例需0至100%';
  }
  if(p.baseRatio!==undefined&&!p.perStack)return '基礎加逐層減傷需開啟逐層規則';
  return null;
}
export function markDamageReductionRate(rule:MarkDamageReduction,count:number):number{
  if(markDamageReductionIssue(rule)||!Number.isFinite(count)||count<=0)return 0;
  return Math.min(rule.cap??1,(rule.baseRatio??0)+rule.ratio*(rule.perStack?count:1));
}
export function markDamageReductionText(rule:MarkDamageReduction):string{
  const pct=(n:number)=>`${Math.round(n*10000)/100}%`;
  return `受到${rule.kind}傷害減少${rule.baseRatio!==undefined?`${pct(rule.baseRatio)}，每層額外${pct(rule.ratio)}`:`${rule.perStack?'每層':''}${pct(rule.ratio)}`}${rule.cap!==undefined?`，最高${pct(rule.cap)}`:''}`;
}
