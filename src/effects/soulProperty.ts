import type { KitEntry } from './effectSystem.schema';
/** 常駐閃避是命中查詢，不能用999回合timer或傷害事件空動作代替。 */
export function soulPropertyIssue(entry:KitEntry):string|null {
  const p=entry.params;
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
