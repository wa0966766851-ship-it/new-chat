import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
for(const n of ['墜霆.雷伊','魔化.雷伊','墜霆·雷伊','魔化·雷伊']){
  const e:any = DEFAULT_ELVES.find(x=>x.name===n);
  console.log(n, '→', e? `FOUND id=${e.id} type=${e.type}` : 'NOT FOUND');
}
console.log('--- 所有含雷伊 ---');
DEFAULT_ELVES.filter((e:any)=>e.name.includes('雷伊')).forEach((e:any)=>console.log(` ${e.id} ${e.name} type=${e.type}`));
