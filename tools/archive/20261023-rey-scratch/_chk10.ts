import { JIUQING_SEED } from './src/data/newElves.ts';
const s:any = JIUQING_SEED;
console.log('seed skills:', s.skills.length, '| pool:', s.skillPool?.length);
console.log('names:', s.skills.map((x:any)=>x.name).join(','));
