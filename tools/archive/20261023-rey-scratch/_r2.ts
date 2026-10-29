import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
for(const n of ['墜霆.雷伊','魔化.雷伊']){
  const e:any = DEFAULT_ELVES.find(x=>x.name===n);
  console.log('====== '+n+' ======');
  console.log('type:', e.type, '| seerId:', e.seerId, '| gender:', e.gender);
  console.log('baseStats:', JSON.stringify(e.baseStats), '| 合計:', Object.values(e.baseStats).reduce((a:any,b:any)=>a+b,0));
  console.log('soul name:', e.soulMark?.name, '| soulKit:', e.soulMark?.kit?.length||0, '| soulMode:', e.soulMark?.effectMode||'-');
  console.log('skills:');
  e.skills.forEach((s:any,i:number)=>console.log(`  ${i}. ${s.name.padEnd(10)} ${s.category}/${s.type} pow=${s.power} pp=${s.pp} prio=${s.priority} hit=${s.accuracy} sure=${!!s.isSureHit} fifth=${!!s.isFifthSkill} kit=${s.kit?.length||0} mode=${s.effectMode||'-'}`));
  console.log('pool:', e.skillPool?.length);
  console.log('');
}
