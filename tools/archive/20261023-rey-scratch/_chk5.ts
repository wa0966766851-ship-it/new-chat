import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
const s = jq.skills.find((x:any)=>x.name==='清璨星辰落');
console.log('=== 清璨星辰落 ===');
console.log('isSureHit:', s.isSureHit);
console.log('accuracy:', s.accuracy);
console.log('kit entries:');
for(const k of (s.kit||[])) console.log('  ', k.codeId, '| node=', k.node, '| params=', JSON.stringify(k.params).slice(0,120));
