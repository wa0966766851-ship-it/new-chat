import {initialLibrary,newCustomElf,validateLibrary,type AtlasLibrary} from './model';
export function parseAtlasContent(value:unknown):AtlasLibrary{
 const v=value as any;if(v?.format!=='seer-atlas-content')return validateLibrary(v);
 if(v.version!==1||typeof v.title!=='string'||!Array.isArray(v.elves)||!v.elves.length||!Array.isArray(v.sources)||!v.sources.every((s:any)=>typeof s==='string'))throw Error('AI內容須包含version、title、elves與sources');
 const lib=initialLibrary();lib.books[0]={id:'content',name:v.title,sources:v.sources,builtinIds:[],custom:v.elves.map((e:any)=>{
  if(!e||typeof e.name!=='string'||!e.baseStats||!Array.isArray(e.skills))throw Error('精靈缺少名稱、完整種族值或技能清單，請補齊後匯入');
  const elf={...newCustomElf(),...e,id:newCustomElf().id,isCustom:true};
  elf.skills=e.skills.map((s:any)=>({...s,maxPp:s.maxPp??s.pp,effectType:'none',effectDetail:'',effectMode:'auto',kit:undefined}));
  return elf;
 })};lib.activeBookId='content';lib.types=v.types||[];return validateLibrary(lib);
}
