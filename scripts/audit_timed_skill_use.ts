import {REVIEWED_SKILL_KITS} from '../src/data/reviewedSkillKits';
import {REVIEWED_SEQUENCE_SKILL_KITS} from '../src/data/reviewedSequenceSkillKits';
import {MIGRATED_SEQUENCE_SKILL_KITS} from '../src/data/migratedSequenceSkillKits';
// 只列待複核，不改圖紙；原文明寫回合末／開始的保留原時點。
const rows:any[]=[];
for(const d of [...REVIEWED_SKILL_KITS,...REVIEWED_SEQUENCE_SKILL_KITS,...MIGRATED_SEQUENCE_SKILL_KITS]){
 for(const e of d.kit){
  const raw=e.params?.clause?.raw||e.customText||'';
  const walk=(x:any)=>{if(!x||typeof x!=='object')return;
   if(x.op==='timed'&&['round_start','round_end'].includes(x.p?.trig)&&!/(?:回合|戰鬥階段)(?:開始|結束)|回合末/.test(raw))rows.push({ids:d.elfIds,name:d.name,order:e.order,trigger:x.p.trig,raw});
   for(const v of Object.values(x))if(typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);
  };walk(e.params);
 }
}
console.log(JSON.stringify({reviewRequired:rows.length,definitions:new Set(rows.map(r=>r.ids.join(',')+'/'+r.name)).size,rows},null,2));
