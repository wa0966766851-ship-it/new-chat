import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find((x:any)=>x.name==='墜霆.雷伊');
const s = e.skills.find((x:any)=>x.name==='沉淪混沌決');
console.log('=== 沉淪混沌決 關鍵 params ===');
for(const k of s.kit){
  const raw=(k.customText||'').replace(/\n/g,' | ');
  if(raw.includes('170%')||raw.includes('先制-7')||raw.includes('70%')){
    console.log(`[${k.role}] ${k.node}: ${raw.slice(0,60)}`);
    console.log('  ', JSON.stringify(k.params?.clause?.body||k.params).slice(0,320));
  }
}
