import fs from 'node:fs';
import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
 const {DEFAULT_ELVES,loadImportedElves}=await server.ssrLoadModule('/src/data/defaultElves.ts');await loadImportedElves();
 const {petImageUrls,loadSeerIndex}=await server.ssrLoadModule('/src/battle/seerAssets.ts');
 await loadSeerIndex();
 const {selectedElfSkin}=await server.ssrLoadModule('/src/data/elfSkins.ts');
 const {effectDefinitionEntries}=await server.ssrLoadModule('/src/battle/effectSources.ts');
 const {skillDescriptionText}=await server.ssrLoadModule('/src/utils/skillDescription.ts');
 const fields=['id','seerId','name','type','level','baseStats','calculatedStats','currentHp','maxHp','height','weight','path','skinId','category','isAlienElf'];
 const skillFields=['name','type','category','power','pp','maxPp','priority','accuracy','isSureHit','isFifthSkill','description','effectType','effectDetail'];
 const project=(v:any,keys:string[])=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
 const records=DEFAULT_ELVES.map((e:any)=>({...project(e,fields),path:selectedElfSkin(e)?.body||e.path||petImageUrls(e,'body')[0],atlasTraits:effectDefinitionEntries(e).filter((t:any)=>!t.configurable).map((t:any)=>project(t,['name','description','kind'])),skills:e.skills.map((s:any)=>({...project(s,skillFields),description:skillDescriptionText(s)})),soulMark:e.soulMark&&project(e.soulMark,['name','description','effectType','effectValue']),trait:e.trait&&project(e.trait,['name','description'])}));
 fs.mkdirSync('encyclopedia/catalog',{recursive:true});
 fs.writeFileSync('encyclopedia/catalog/index.json',JSON.stringify(records.map((e:any)=>project(e,['id','seerId','name','type']))));
 for(const e of records)fs.writeFileSync(`encyclopedia/catalog/${e.id}.json`,JSON.stringify(e));
 console.log(`已同步${records.length}隻展示資料；排除戰鬥積木及執行狀態`);
}finally{await server.close();}
