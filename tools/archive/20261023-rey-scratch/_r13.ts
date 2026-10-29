import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
import fs from 'node:fs';
for(const [name, file] of [['墜霆.雷伊','墜霆.雷伊.txt'],['魔化.雷伊','魔化.雷伊.txt']]){
  const e:any = DEFAULT_ELVES.find(x=>x.name===name);
  const src = fs.readFileSync('D:/影片/新增資料夾/elf_source_files/elf_files/'+file,'utf8');
  console.log('====== '+name+' ======');
  // 原文中的技能名 vs 專案技能名
  const srcSkills = [...src.matchAll(/^(\S+)\s*\n?(?:混沌\.電|電\.暗影|無)\s*(?:物理|特殊|屬性)攻擊/gm)].map(m=>m[1]);
  console.log('原文技能名(推測):', srcSkills.join(',') || '(解析失敗)');
  console.log('專案技能名:', e.skills.map((s:any)=>s.name).join(','));
  // 種族值比對
  const statLine = src.match(/攻擊:\s*(\d+)\s*特攻:\s*(\d+)\s*防禦:\s*(\d+)\s*特防:\s*(\d+)\s*速度:\s*(\d+)\s*體力:\s*(\d+)/);
  if(statLine){
    const [_,atk,spatk,def,spdef,spd,hp] = statLine;
    const srcStats = {hp:+hp,atk:+atk,def:+def,spatk:+spatk,spdef:+spdef,speed:+spd};
    console.log('原文種族值:', JSON.stringify(srcStats), '合計', Object.values(srcStats).reduce((a:any,b:any)=>a+b,0));
    console.log('專案種族值:', JSON.stringify(e.baseStats), '合計', Object.values(e.baseStats).reduce((a:any,b:any)=>a+b,0));
    const diff = Object.keys(srcStats).filter(k=>srcStats[k]!==e.baseStats[k]);
    console.log('差異:', diff.length? diff.map(k=>`${k}: ${srcStats[k]} vs ${e.baseStats[k]}`).join(', ') : '無');
  }
  console.log('');
}
