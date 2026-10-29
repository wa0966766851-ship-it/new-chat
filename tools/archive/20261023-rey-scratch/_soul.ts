import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
for(const n of ['墜霆.雷伊','魔化.雷伊']){
  const e:any = DEFAULT_ELVES.find((x:any)=>x.name===n);
  console.log('====== '+n+' ======');
  console.log('soul name:', JSON.stringify(e.soulMark.name));
  console.log('soul desc 長度:', e.soulMark.description.length);
  console.log('soul kit 條數:', e.soulMark.kit?.length||0);
  console.log('soul desc 全文:');
  console.log(e.soulMark.description);
  console.log('');
}
