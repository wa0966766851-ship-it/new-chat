import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
console.log('skills 數量:', jq.skills.length);
console.log('--- skills 主列 ---');
jq.skills.forEach((s:any,i:number)=>console.log(`${i}. ${s.name.padEnd(8)} isFifth=${s.isFifthSkill} kit=${s.kit?.length||0}`));
console.log('--- skillPool ---');
(jq.skillPool||[]).forEach((s:any,i:number)=>console.log(`${i}. ${s.name.padEnd(8)} isFifth=${s.isFifthSkill}`));
