import type { KitEntry } from './effectSystem.schema';
import { effectDefinitionEntries } from '../battle/effectSources';
/** 常駐閃避是命中查詢，不能用999回合timer或傷害事件空動作代替。 */
export function soulPropertyIssue(entry:KitEntry):string|null {
  const p=entry.params;
  if(p.property==='stat_percent') {
    if(entry.node!=='passive_always'||Object.keys(p).some(k=>!['property','stats','percent'].includes(k)))return '能力值百分比查詢需常駐節點與明確欄位';
    if(!Array.isArray(p.stats)||!p.stats.length||p.stats.some((k:any)=>!['atk','spatk'].includes(k))||new Set(p.stats).size!==p.stats.length)return '能力值百分比目前只接通攻擊／特攻';
    if(!Number.isFinite(p.percent)||p.percent<=0||p.percent>1000)return '能力值百分比需有限正數';
    return null;
  }
  if(entry.source==='skill'||entry.node!=='passive_always'||p.property!=='evade')return '被動閃避需魂印／特質常駐命中查詢';
  if(Object.keys(p).some(k=>!['property','chance','kind'].includes(k)))return '被動查詢包含未知參數';
  if(!Number.isFinite(p.chance)||p.chance<=0||p.chance>100||!['all','攻擊','屬性'].includes(p.kind))return '被動閃避需機率及技能範圍';
  return null;
}
export function readSoulEvade(kit:KitEntry[]|undefined,skill:any):number {
  return Math.max(0,...(kit||[]).filter(e=>e.codeId==='soul_property'&&!soulPropertyIssue(e))
    .filter(e=>e.params.kind==='all'||(e.params.kind==='攻擊'?skill?.category!=='屬性':skill?.category==='屬性'))
    .map(e=>e.params.chance));
}
/** 魂印／特性 Kit 的常駐能力值提升（%）；只讀已通過驗證的 stat_percent 查詢。 */
export function readStatPercent(elf:any,stat:'atk'|'spatk'):number {
  let total=0;
  for(const def of effectDefinitionEntries(elf) as any[]) {
    if(def.effectMode!=='kit')continue;
    for(const e of (def.kit||[]) as KitEntry[])
      if(e.codeId==='soul_property'&&e.params.property==='stat_percent'&&!soulPropertyIssue(e)&&e.params.stats.includes(stat))total+=e.params.percent;
  }
  return total;
}
