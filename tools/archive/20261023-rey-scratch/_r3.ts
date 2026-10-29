import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='墜霆.雷伊');
console.log('===== 魂印「墜」kit =====');
for(const k of (e.soulMark.kit||[])){
  console.log(`[${k.role}] ${k.node}: ${(k.customText||'').slice(0,60)}`);
  console.log('   params:', JSON.stringify(k.params).slice(0,300));
  console.log('');
}
