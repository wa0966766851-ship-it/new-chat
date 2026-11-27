import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
try{
 const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {availableElfSkins}=await server.ssrLoadModule('/src/data/elfSkins.ts');
 const {petAnimationBinding}=await server.ssrLoadModule('/src/battle/petAnimationRegistry.ts');
 const {PET_ANIMATION_ASSETS}=await server.ssrLoadModule('/src/battle/petAnimationAssets.ts');
 const {petImageUrls,SEER_ID_OVERRIDES}=await server.ssrLoadModule('/src/battle/seerAssets.ts');
 const rows=DEFAULT_ELVES.map((e:any)=>({id:e.id,name:e.name,seerId:e.seerId,sourceId:SEER_ID_OVERRIDES[e.name]||e.seerId||Number(/^(\d+)\.pet$/.exec(PET_ANIMATION_ASSETS[petAnimationBinding({...e,skinId:''})]?.clip||'')?.[1])||undefined,
  height:e.height,weight:e.weight,gender:e.gender,body:petImageUrls(e,'body')[0],
  appearances:availableElfSkins(e).map((s:any)=>({id:s.id,name:s.name,body:s.body||petImageUrls(e,'body')[0],animation:petAnimationBinding({...e,skinId:s.id})}))}));
 await writeFile('docs/audits/2026-11-26-skin-animation-metadata.json',JSON.stringify({count:rows.length,rows},null,2)+'\n');
 console.log(JSON.stringify({count:rows.length,unbound:rows.flatMap((e:any)=>e.appearances.filter((s:any)=>!s.animation).map((s:any)=>({elf:e.name,...s})))}));
}finally{await server.close();}
