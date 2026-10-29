/** 舊解析器剝掉括號；新的原文煉成不能因此丟失公式、期限或限制。 */
import type { Clause } from '../blocks/model';
export function discardedParentheticalMechanics(raw:string,clause?:Clause,basePriority?:number):string[] {
  return [...raw.matchAll(/[（(]([^）)]*)[）)]/g)].map(m=>m[1].trim()).filter(text=>{
    const total=text.match(/^總先制\s*([+＋-])\s*(\d+)$/),acts=clause?.body.flatMap(b=>b.acts)||[];
    const increment=acts.length===1&&acts[0].op==='noop'?String(acts[0].p.tag||'').match(/先制\s*([+＋-])\s*(\d+)(?:且必定命中)?$/):null;
    // 僅已解析的固有增量與明確欄位值一致時，總值才是冗餘註解。
    if(total&&increment&&clause?.parsed&&clause.marker==='■'&&Number.isFinite(basePriority)
      &&basePriority!+(increment[1]==='-'?-1:1)*Number(increment[2])===(total[1]==='-'?-1:1)*Number(total[2]))return false;
    return /\d|[０-９]|公式|上限|最高|最低|下場|保留|回合|次數|層|持有者|免疫|失效|[Bb][Oo][Ss][Ss]|轉化|翻倍|傷害/.test(text);
  });
}
