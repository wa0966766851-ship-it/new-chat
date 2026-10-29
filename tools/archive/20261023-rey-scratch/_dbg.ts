import { MIGRATED_JIUQING_KITS } from './src/data/migratedJiuqingKits.ts';
import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
const k = MIGRATED_JIUQING_KITS.find((x:any)=>x.name==='蒼靈銜樂');
const s = jq.skills.find((x:any)=>x.name==='蒼靈銜樂');
console.log('kit desc:', JSON.stringify(k?.description));
console.log('skill desc:', JSON.stringify(s?.description));
console.log('equal:', k?.description === s?.description);
console.log('kit entries:', k?.kit?.length);
