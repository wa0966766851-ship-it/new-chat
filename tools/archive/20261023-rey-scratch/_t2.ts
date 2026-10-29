import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='帝皇之盾');
console.log('elf type:', e.type);
e.skills.slice(0,5).forEach((s:any)=>console.log(` ${s.name.padEnd(10)} type=${JSON.stringify(s.type)}`));
