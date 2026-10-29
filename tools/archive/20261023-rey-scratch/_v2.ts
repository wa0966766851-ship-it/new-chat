import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
for(const n of ['魔化.雷伊','墜霆.雷伊']){
  const e:any = DEFAULT_ELVES.find((x:any)=>x.name===n);
  console.log('====== '+n+' ======');
  let withBody=0, empty=0;
  for(const k of e.soulMark.kit){
    const body=k.params?.clause?.body;
    if(body && body.length) withBody++; else empty++;
  }
  console.log(`有執行 body: ${withBody} 條 | 純展示: ${empty} 條`);
  // 確認關鍵 op 還在
  const ops=new Set<string>();
  const walk=(n:any)=>{ if(!n) return; if(Array.isArray(n)) return n.forEach(walk); if(n.op) ops.add(n.op); for(const k of Object.keys(n)) if(typeof n[k]==='object') walk(n[k]); };
  e.soulMark.kit.forEach((k:any)=>walk(k.params));
  console.log('ops:', [...ops].join(', '));
}
