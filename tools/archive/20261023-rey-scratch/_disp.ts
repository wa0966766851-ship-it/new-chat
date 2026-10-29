import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
// 模擬 BattleScreen 的顯示排序
const base = jq.skills;
const display = base.length >= 5 ? [base[4], base[0], base[1], base[2], base[3]] : base;
console.log('=== 戰鬥介面實際顯示順序（左→右） ===');
display.forEach((s:any,i:number)=>console.log(`第${i+1}格: ${s.name}  fifth=${!!s.isFifthSkill}`));
console.log('\n藏字:', display.map((s:any)=>s.name[0]).join(''));
