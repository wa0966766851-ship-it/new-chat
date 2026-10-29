import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
console.log('=== skills 陣列順序（含 index） ===');
jq.skills.forEach((s:any,i:number)=>console.log(`${i}. ${s.name.padEnd(8)} fifth=${!!s.isFifthSkill} power=${s.power}`));
