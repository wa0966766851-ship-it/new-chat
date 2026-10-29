import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='墜霆.雷伊');
// 比對每個技能 description 與 SOURCE 原文
import fs from 'node:fs';
const src = fs.readFileSync('D:/影片/新增資料夾/elf_source_files/elf_files/墜霆.雷伊.txt','utf8');
for(const s of e.skills){
  const inSrc = src.includes(s.name);
  console.log(`${s.name.padEnd(10)} 原文有此技能名: ${inSrc?'✓':'✗'}`);
  // 檢查描述是否含原文關鍵片段
  const firstLine = (s.description||'').split(/\r?\n/)[1] || '';
  console.log(`   desc首句: ${(s.description||'').split(/\r?\n/)[0]}`);
}
