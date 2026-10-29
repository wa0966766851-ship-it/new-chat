import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find((x:any)=>x.name==='墜霆.雷伊');
const s = e.skills.find((x:any)=>x.name==='魔化雷驅');
console.log('=== 魔化雷驅 全部 kit params ===');
for(const k of s.kit){
  console.log(`[${k.role}] ${k.node}`);
  console.log('  raw:', (k.customText||'').replace(/\n/g,' | ').slice(0,70));
  console.log('  body:', JSON.stringify(k.params?.clause?.body||k.params).slice(0,350));
  console.log('');
}
