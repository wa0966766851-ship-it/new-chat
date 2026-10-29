import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
import { CORRUPTED_REY_SOUL_TEXT } from './src/data/corruptedReyDescriptions.ts';
const e:any = DEFAULT_ELVES.find((x:any)=>x.name==='魔化.雷伊');
console.log('description 是否等於原文:', e.soulMark.description === CORRUPTED_REY_SOUL_TEXT['7070']);
console.log('description 長度:', e.soulMark.description.length);
console.log('含繳械定義:', e.soulMark.description.includes('繳械:弱化類異常'));
console.log('含麻痺定義:', e.soulMark.description.includes('麻痺:控制類異常'));
console.log('含先制+1那條:', e.soulMark.description.includes('自身先制+1且使用技能後100%令對手繳械'));
