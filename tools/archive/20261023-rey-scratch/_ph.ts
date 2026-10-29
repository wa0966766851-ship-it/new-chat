import { CORRUPTED_REY_SOUL_TEXT } from './src/data/corruptedReyDescriptions.ts';
const d=CORRUPTED_REY_SOUL_TEXT['707070'];
const secs=d.split(/\n{2,}/).map((x:string)=>x.trim()).filter(Boolean);
const phase = secs.find((s:string)=>s.startsWith('戰鬥階段結束時'));
console.log('=== 墜霆 戰鬥階段結束時 段落 ===');
console.log(phase);
console.log('\n=== 拆行 ===');
phase.split('\n').forEach((l:string,i:number)=>console.log(`[${i}] ${l}`));
