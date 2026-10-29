import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='魔化.雷伊');
console.log('===== 魂印 kit =====');
for(const k of (e.soulMark.kit||[])){
  console.log(`[${k.role}] ${k.node}: ${(k.customText||'').replace(/\n/g,' | ').slice(0,80)}`);
}
console.log('\n===== 技能 kit =====');
for(const s of e.skills){
  console.log('--- '+s.name+' ---');
  for(const k of (s.kit||[])) console.log(`  [${k.role}] ${k.node}: ${(k.customText||'').replace(/\n/g,' | ').slice(0,70)}`);
}
