import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
import fs from 'node:fs';
// 檢查魂印名稱是否與原文一致
const files={'墜霆.雷伊':'墜霆.雷伊.txt','魔化.雷伊':'魔化.雷伊.txt'};
for(const [n,f] of Object.entries(files)){
  const e:any = DEFAULT_ELVES.find((x:any)=>x.name===n);
  const src=fs.readFileSync('D:/影片/新增資料夾/elf_source_files/elf_files/'+f,'utf8');
  const m = src.match(/魂印[”"「]?([^:：\n]{1,6})[”"」]?\s*[:：]/);
  console.log(`${n}:`);
  console.log(`  原文魂印名: ${m?JSON.stringify(m[1]):'(未抓到)'}`);
  console.log(`  專案魂印名: ${JSON.stringify(e.soulMark.name)}`);
  console.log(`  相符: ${m && m[1].trim()===e.soulMark.name ? '✓':'✗'}`);
}
