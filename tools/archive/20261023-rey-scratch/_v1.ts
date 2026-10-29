import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
for(const n of ['魔化.雷伊','墜霆.雷伊']){
  const e:any = DEFAULT_ELVES.find((x:any)=>x.name===n);
  console.log('====== '+n+' ======');
  console.log('kit 條數:', e.soulMark.kit.length);
  e.soulMark.kit.forEach((k:any,i:number)=>{
    console.log(`[${i}] ${(k.customText||'').replace(/\n/g,' | ').slice(0,75)}`);
  });
  console.log('');
}
