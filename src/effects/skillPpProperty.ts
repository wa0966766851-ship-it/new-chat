import type {KitEntry} from './effectSystem.schema';
import {markAppliesToElf} from '../battle/marks';
const comparisons=['高於','不低於','低於','不高於'];
/** 純資料合約與選招查詢共用，不載入戰鬥動作執行器。 */
export function ppExemptionIssue(entry:KitEntry):string|null{
  const p=entry.params;
  if(entry.source!=='skill'||entry.role!=='innate'||entry.node!=='on_skill_selected'||p.value!==true||Object.keys(p).some(k=>!['property','value','conditions'].includes(k))||!Array.isArray(p.conditions)||p.conditions.length>20)return 'PP豁免需選招時固有布林與明確印記條件';
  for(const c of p.conditions){const q=c?.p;
    // 能力等級狀態條件（自身處於能力下降／提升狀態）：只讀自身面板的能力等級。
    if(c?.c==='stage'){
      if(!q||Object.keys(q).some(k=>!['side','kind'].includes(k))||q.side!=='self'||!['up','down'].includes(q.kind))return 'PP豁免能力狀態條件需明確自身與上升／下降';
      continue;
    }
    if(c?.c!=='mark_count'||!q||Object.keys(q).some(k=>!['side','id','op','amount'].includes(k))||!['self','opp'].includes(q.side)||typeof q.id!=='string'||!q.id||q.id.length>200||!comparisons.includes(q.op)||!Number.isInteger(q.amount)||q.amount<0||q.amount>10000)return 'PP豁免條件需單一持有者、印記識別碼及整數門檻';
  }
  return null;
}
export function authoredPpExemption(elf:any,skill:any,opp?:any):boolean{
  if(skill?.effectMode!=='kit'||elf?.isInherentInvalid)return false;
  return (skill.kit||[]).some((e:KitEntry)=>e.codeId==='skill_property'&&e.params.property==='ignore_pp_limit'&&!ppExemptionIssue(e)&&e.params.conditions.every((c:any)=>{
    if(c.c==='stage'){const has=Object.values(elf?.statStages||{}).some((v:any)=>typeof v==='number'&&(c.p.kind==='up'?v>0:v<0));return has;}
    const p=c.p,holder=p.side==='self'?elf:opp;
    const n=(holder?.marks||[]).filter((m:any)=>m.id===p.id&&markAppliesToElf(m,holder)).reduce((sum:number,m:any)=>sum+(Number.isFinite(m.count)?Math.max(0,m.count):0),0);
    return p.op==='高於'?n>p.amount:p.op==='不低於'?n>=p.amount:p.op==='低於'?n<p.amount:n<=p.amount;
  }));
}
