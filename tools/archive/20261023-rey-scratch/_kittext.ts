import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find((x:any)=>x.name==='魔化.雷伊');
console.log('=== soulMark.kit 的 customText（桌面版可能顯示這個）===');
for(const k of (e.soulMark.kit||[])){
  console.log('---');
  console.log(k.customText);
}
