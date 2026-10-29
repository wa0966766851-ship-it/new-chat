import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const fs=require('fs');
const j=JSON.parse(fs.readFileSync('src/data/seerIndex.json','utf8'));
function splitTypes(t){ if(!t||['--','無屬性'].includes(t)) return []; return t.replace(/系$/,'').split(/[.·・/／\s]+/).filter(Boolean); }
for(const n of ['墜霆.雷伊','魔化.雷伊']){
  const e:any = DEFAULT_ELVES.find(x=>x.name===n);
  console.log('====== '+n+' ======');
  for(const s of e.skills){
    const parts=splitTypes(s.type);
    const ids=parts.map(p=>j.types[p]);
    const ok=ids.every(v=>v!=null);
    console.log(` ${s.name.padEnd(10)} type=${JSON.stringify(s.type).padEnd(14)} parts=${JSON.stringify(parts)} 可解析=${ok}`);
  }
}
