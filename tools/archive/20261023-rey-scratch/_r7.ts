import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='墜霆.雷伊');
const s = e.skills.find((x:any)=>x.name==='怨雷');
for(const k of s.kit){
  const body = k.params?.clause?.body;
  if(body) console.log(k.customText.slice(0,40), '=>', JSON.stringify(body).slice(0,400));
}
