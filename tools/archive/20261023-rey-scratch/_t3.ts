import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='帝皇之盾');
const t = e.skills.find((s:any)=>s.type.includes('.')).type;
console.log('raw:', JSON.stringify(t));
console.log('codepoints:', [...t].map(c=>c.codePointAt(0).toString(16)).join(' '));
