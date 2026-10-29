import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
console.log('elf type:', jq.type);
jq.skills.forEach((s:any)=>console.log(` ${s.name.padEnd(8)} type=${s.type} category=${s.category}`));
