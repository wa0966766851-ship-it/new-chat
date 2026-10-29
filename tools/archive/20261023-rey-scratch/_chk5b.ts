import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const jq:any = DEFAULT_ELVES.find(e=>e.name==='九青');
const s = jq.skills.find((x:any)=>x.name==='清璨星辰落');
console.log('description 首行:', JSON.stringify(s.description.split('\r\n')[0]));
console.log('isSureHit:', s.isSureHit, '| accuracy:', s.accuracy);
console.log('effectMode:', s.effectMode);
// 其他已驗證的必中技能對照
const other:any = DEFAULT_ELVES.find((e:any)=>e.name==='帝皇之盾');
if(other){
  const o = other.skills.find((x:any)=>x.isSureHit);
  if(o) console.log('對照('+o.name+'): desc首行=', JSON.stringify(o.description.split('\r\n')[0]), '| isSureHit=', o.isSureHit);
}
