import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='魔化.雷伊');
// 檢查蝕雷是否缺必中（原文沒寫必中，但 panel 顯示 sure=false 正確）
for(const s of e.skills){
  const hasSure = (s.kit||[]).some((k:any)=>k.params?.property==='sure_hit');
  console.log(`${s.name.padEnd(10)} isSureHit=${!!s.isSureHit} kit有sure_hit=${hasSure}`);
}
console.log('\n=== 魂印名稱 ===');
console.log('name:', JSON.stringify(e.soulMark.name), '| desc前40:', e.soulMark.description.slice(0,40).replace(/\n/g,' '));
