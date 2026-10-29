import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
import { effectDefinitionEntries } from './src/battle/effectSources.ts';
const e:any = DEFAULT_ELVES.find((x:any)=>x.name==='魔化.雷伊');
const entries = effectDefinitionEntries(e);
console.log('entries 數量:', entries.length);
for(const en of entries){
  console.log('--- kind:', en.kind, '| name:', en.name);
  console.log('description 長度:', (en.description||'').length);
  console.log('內容:', (en.description||'').slice(0,200));
}
