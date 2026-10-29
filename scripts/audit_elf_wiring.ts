import {createServer} from 'vite';
import {writeFileSync} from 'node:fs';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
 const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {effectRoute,kitEntryIssue}=await server.ssrLoadModule('/src/effects/effectConnection.ts');
 const {effectDefinitionEntries}=await server.ssrLoadModule('/src/battle/effectSources.ts');
 const {hasSkillHandler}=await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
 const id=process.argv.find(x=>x.startsWith('--id='))?.slice(5);
 const pool=id?DEFAULT_ELVES.filter((e:any)=>String(e.id)===id):DEFAULT_ELVES;
 if(!pool.length)throw new Error('找不到精靈 '+id);
 const walk=(x:any,out=new Set<string>())=>{if(x&&typeof x==='object'){if(typeof x.op==='string')out.add(x.op);for(const v of Object.values(x))walk(v,out);}return [...out];};
 const report={generatedAt:new Date().toISOString(),scope:'結構與路由稽核；不代表原文、事件順序、數值或畫面驗收',elves:pool.map((elf:any)=>({id:elf.id,name:elf.name,definitions:[...[...new Map([...elf.skills,...(elf.skillPool||[])].map((s:any)=>[JSON.stringify([s.name,s.description,s.effectMode,s.kit]),s])).values()].map((s:any)=>({...s,kind:'技能',hasHandler:hasSkillHandler(s.name)})),...effectDefinitionEntries(elf)].map((d:any)=>({kind:d.kind,name:d.name,route:effectRoute(d,!!d.hasHandler),mode:d.effectMode||'auto',entries:d.kit?.length||0,nodes:[...new Set((d.kit||[]).map((e:any)=>e.node))],operations:walk(d.kit),issues:(d.kit||[]).flatMap((e:any,index:number)=>{const issue=kitEntryIssue(e);return issue?[{index,node:e.node,issue}]:[];}),semantic:'需原文逐句及P1/P2正式引擎數值證據'}))}))};
 const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6);
 if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 const definitions=report.elves.flatMap((e:any)=>e.definitions);
 const issues=definitions.reduce((n:number,d:any)=>n+d.issues.length,0);
 console.log(JSON.stringify({elves:pool.length,definitions:definitions.length,structuralIssues:issues,output:output||null,note:report.scope}));
 if(!output)console.log(JSON.stringify(report,null,2));
 if(issues)process.exitCode=1;
}finally{await server.close();}
