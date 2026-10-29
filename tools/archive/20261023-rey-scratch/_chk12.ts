import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
console.log('skills:', jq.skills.length, '| pool:', jq.skillPool.length);
console.log('fifth in skills:', jq.skills.filter((s:any)=>s.isFifthSkill).length);
console.log('fifth in pool:', jq.skillPool.filter((s:any)=>s.isFifthSkill).length);
console.log('--- 主列 ---');
jq.skills.forEach((s:any,i:number)=>console.log(` ${i}. ${s.name} fifth=${s.isFifthSkill}`));
