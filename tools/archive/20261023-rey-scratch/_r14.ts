import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
for(const n of ['墜霆.雷伊','魔化.雷伊']){
  const e:any = DEFAULT_ELVES.find(x=>x.name===n);
  const t = e.type;
  console.log(n, '| type:', JSON.stringify(t), '| codepoints:', [...t].map(c=>c.codePointAt(0).toString(16)).join(' '));
}
// 對照其他精靈的格式
const d:any = DEFAULT_ELVES.find(x=>x.name==='帝皇之盾');
console.log('對照 帝皇之盾 type:', JSON.stringify(d.type), '| cp:', [...d.type].map(c=>c.codePointAt(0).toString(16)).join(' '));
