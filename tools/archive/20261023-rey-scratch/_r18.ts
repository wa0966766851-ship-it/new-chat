import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
import fs from 'node:fs';
// 檢查兩隻的 description 是否保留完整原文（soulDescription）
for(const [n,f] of [['墜霆.雷伊','墜霆.雷伊.txt'],['魔化.雷伊','魔化.雷伊.txt']]){
  const e:any = DEFAULT_ELVES.find((x:any)=>x.name===n);
  const src=fs.readFileSync('D:/影片/新增資料夾/elf_source_files/elf_files/'+f,'utf8');
  const soulDesc = e.soulMark.description || '';
  // 取原文魂印段落關鍵句
  const keys = n==='墜霆.雷伊'
    ? ['入魔3回合','抵擋受到的所有技能傷害','降低敵方背包內所有精靈基礎能力值7%','先制+2','繳械','恢復自身最大體力1/1','變為1回合']
    : ['魔化.雷光之翼','基礎能力值20%','先制+1','繳械','恢復自身最大體力⅓','變為1回合'];
  console.log('====== '+n+' 魂印描述涵蓋 ======');
  keys.forEach(k=>{
    const inSoul = soulDesc.includes(k) || soulDesc.includes(k.replace('⅓','1/3'));
    const inSrc = src.includes(k);
    console.log(`  ${k.padEnd(22)} 原文=${inSrc?'✓':'-'} 魂印desc=${inSoul?'✓':'✗'}`);
  });
}
