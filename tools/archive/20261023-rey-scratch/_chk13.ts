import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
let n=0;
for(const e of DEFAULT_ELVES as any[]){
  for(const s of e.skills||[]){
    if(s.power>=160 && !s.isFifthSkill && !s.name.includes('第五')){ n++; if(n<=5) console.log(e.name,'|',s.name,'pow=',s.power,'fifth=',s.isFifthSkill); }
  }
}
console.log('total such skills:', n);
