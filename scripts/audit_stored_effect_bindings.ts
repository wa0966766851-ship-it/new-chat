import {readFileSync,writeFileSync,statSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createServer} from 'vite';
const args=process.argv.slice(2),input=args[0];
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
  const {DEFAULT_ELVES:defaults}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {inspectBuiltinEffectBindings:inspect}=await server.ssrLoadModule('/src/data/builtinEffectBindings.ts');
  const {applySavedSkillCorrections:correct}=await server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
  const {collectEffectPresets}=await server.ssrLoadModule('/src/effects/effectPresets.ts');
  const {kitEntryIssue,effectRoute}=await server.ssrLoadModule('/src/effects/effectConnection.ts');
  const counts:Record<string,number>={},issues:any[]=[];let elves=0,definitions=0,kitEntries=0;
  const visit=(value:any,path:string)=>{
    if(!value||typeof value!=='object')return;
    if(value.id&&value.name&&Array.isArray(value.skills)){
      elves++;
      // 只在記憶體套用修復，輸入檔與使用者儲存空間均不修改。
      const fixed=correct(value,defaults);
      for(const row of inspect(fixed,defaults)){
        counts[row.status]=(counts[row.status]||0)+1;
        if(row.status!=='current')issues.push({path,elfId:value.id,elfName:value.name,...row});
      }
      for(const preset of collectEffectPresets([fixed])){
        definitions++;
        if(effectRoute(preset.definition)!=='kit')issues.push({path,elfId:value.id,definition:preset.id,status:'non-kit-route',route:effectRoute(preset.definition)});
        for(const [index,entry] of (preset.definition.kit||[]).entries()){
          kitEntries++;const reason=kitEntryIssue(entry);
          if(reason)issues.push({path,elfId:value.id,definition:preset.id,index,status:'kit-contract',reason});
        }
      }
      return;
    }
    for(const [key,entry] of Object.entries(value)){
      let nested=entry;
      if(typeof nested==='string'&&key.startsWith('seer_'))try{nested=JSON.parse(nested);}catch{issues.push({path:`${path}.${key}`,status:'invalid-json'});}
      visit(nested,`${path}.${key}`);
    }
  };
  const read=(file:string)=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const data=!input?defaults:statSync(input).isDirectory()?Object.fromEntries(readdirSync(input).filter(f=>/^store-.*\.json$/.test(f)).map(f=>[f,read(join(input,f))])):read(input);
  visit(data,'root');
  const report={scope:input?'saved-snapshot':'current-catalog',input:input||null,elves,definitions,kitEntries,counts,issues,
    note:'只驗證修復後來源版本與差異，不代表積木合約或戰鬥語意正確率。技能池與出戰技能分別計數。輸入不修改。'};
  if(args[1])writeFileSync(args[1],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await server.close();}
