import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='墜霆.雷伊');
for(const s of e.skills){
  console.log('===== '+s.name+' =====');
  for(const k of (s.kit||[])){
    const raw=(k.customText||'').replace(/\n/g,' | ').slice(0,70);
    console.log(`  [${k.role}] ${k.node}: ${raw}`);
  }
  console.log('');
}
