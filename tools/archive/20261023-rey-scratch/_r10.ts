import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
import fs from 'node:fs';
const e:any = DEFAULT_ELVES.find(x=>x.name==='墜霆.雷伊');
const src = fs.readFileSync('D:/影片/新增資料夾/elf_source_files/elf_files/墜霆.雷伊.txt','utf8');

// 從原文抓所有數字，與 kit 中的數字比對
function nums(t:string){ return (t.match(/\d+/g)||[]).map(Number); }
for(const s of e.skills){
  const kitStr = JSON.stringify(s.kit);
  const kitNums = new Set(nums(kitStr));
  // 該技能的原文段落
  const idx = src.indexOf(s.name);
  const next = e.skills.map((x:any)=>src.indexOf(x.name)).filter((v:number)=>v>idx).sort((a:number,b:number)=>a-b)[0] || src.length;
  const seg = src.slice(idx, next);
  const srcNums = nums(seg);
  const missing = srcNums.filter(n=>!kitNums.has(n));
  console.log(`${s.name.padEnd(10)} 原文數字數=${srcNums.length} kit缺少: ${[...new Set(missing)].join(',') || '無'}`);
}
