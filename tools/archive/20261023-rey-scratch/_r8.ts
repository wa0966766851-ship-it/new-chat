import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='墜霆.雷伊');
// 收集所有 kit 用到的 op
const ops=new Set();
function walk(n:any){ if(!n) return; if(Array.isArray(n)) return n.forEach(walk);
  if(n.op) ops.add(n.op);
  if(n.body) walk(n.body); if(n.acts) walk(n.acts);
  for(const k of Object.keys(n)) if(typeof n[k]==='object') walk(n[k]);
}
for(const s of e.skills) walk(s.kit);
walk(e.soulMark.kit);
console.log('用到的 op 數量:', ops.size);
console.log([...ops].sort().join(', '));
