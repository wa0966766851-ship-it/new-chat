import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
const base = jq.skills;
const display = base.length >= 5 ? [base[4], base[0], base[1], base[2], base[3]] : base;
console.log('技能名首字:', display.map((s:any)=>s.name.slice(0,1)).join(''));
console.log('使用者要求: 清 生 日 快 樂');
console.log('');
// 檢查各技能第2字
display.forEach((s:any,i:number)=>{
  const want = '清生日快樂'[i];
  const has = s.name.includes(want);
  console.log(`第${i+1}格 ${s.name} → 需含「${want}」: ${has?'✓':'✗'}`);
});
