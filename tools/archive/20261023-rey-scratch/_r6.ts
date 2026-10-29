import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='墜霆.雷伊');
for(const s of e.skills){
  console.log('===== '+s.name+' =====');
  console.log('desc:', (s.description||'').replace(/\n/g,' | '));
  console.log('');
}
