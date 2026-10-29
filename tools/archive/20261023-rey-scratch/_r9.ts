import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
const e:any = DEFAULT_ELVES.find(x=>x.name==='墜霆.雷伊');
const all=[...e.skills.map((s:any)=>({n:s.name,k:s.kit})), {n:'魂印',k:e.soulMark.kit}];
function walk(n:any, path:string, out:any[]){ if(!n) return; if(Array.isArray(n)) return n.forEach((x:any,i:number)=>walk(x,path+'['+i+']',out));
  if(n.op==='高於'||n.op===undefined && n['高於']) out.push({path, node:n});
  for(const k of Object.keys(n)) if(typeof n[k]==='object') walk(n[k], path+'.'+k, out);
}
for(const item of all){
  const out:any[]=[];
  walk(item.k,'',out);
  out.forEach(o=>console.log(item.n+' @'+o.path+': '+JSON.stringify(o.node).slice(0,200)));
}
