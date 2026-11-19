import type {Elf,Skill} from '../src/types';

export interface AtlasType {name:string;color:string;icon?:string}
export interface AtlasBook {id:string;name:string;builtinIds:string[];custom:Elf[];sources?:string[]}
export interface AtlasLibrary {version:1;edition?:'standard'|'blank';revision?:number;books:AtlasBook[];types:AtlasType[];activeBookId:string;selectedElfId:string}
export const newId=()=>crypto.randomUUID();
export function initialLibrary():AtlasLibrary {
 return {version:1,revision:0,books:[{id:'main',name:'我的精靈圖鑑',builtinIds:['*'],custom:[]}],types:[],activeBookId:'main',selectedElfId:''};
}
export function newCustomElf(source?:Elf):Elf {
 const stats={hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100};
 const elf:Elf=source?structuredClone(source):{id:'',name:'未命名精靈',type:'普通',level:100,baseStats:stats,calculatedStats:{...stats},currentHp:100,maxHp:100,skills:[],soulMark:{name:'魂印',description:'',effectType:'none',effectValue:0,effectMode:'auto'}};
 elf.id='atlas_'+newId();elf.name=source?source.name+'（自訂）':elf.name;elf.isCustom=true;
 delete elf.battleId;delete elf.illusion;delete elf.builtinEffectBindings;
 return elf;
}
export function newSkill():Skill {return {name:'新技能',type:'普通',category:'物理',power:100,pp:10,maxPp:10,accuracy:100,description:'',effectType:'none',effectDetail:'',effectMode:'auto'};}
export function bookElves(book:AtlasBook,builtins:Elf[]):Elf[] {
 const ids=new Set(book.builtinIds);return [...builtins.filter(e=>ids.has('*')||ids.has(e.id)),...book.custom];
}
/** 存檔及匯入共用驗證；不接受損壞資料來覆蓋完整圖鑑。 */
export function validateLibrary(value:unknown):AtlasLibrary {
 const v=value as AtlasLibrary;
 if(!v||v.version!==1||!Array.isArray(v.books)||!v.books.length||v.books.length>100||!Array.isArray(v.types)||v.types.length>100)throw Error('圖鑑格式不正確或數量超過上限');
 const ids=new Set<string>();
 for(const b of v.books){
  if(typeof b.id!=='string'||!b.id||ids.has(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!Array.isArray(b.builtinIds)||!b.builtinIds.every(i=>typeof i==='string')||!Array.isArray(b.custom)||b.custom.length>1000)throw Error('圖鑑名稱、收錄內容或識別碼不正確');
  ids.add(b.id);const elves=new Set<string>();
  for(const e of b.custom){
   if(!e||typeof e.id!=='string'||!e.id.startsWith('atlas_')||elves.has(e.id)||typeof e.name!=='string'||!e.name.trim()||typeof e.type!=='string'||!e.type.trim()||!Array.isArray(e.skills)||e.skills.length>100)throw Error('自訂精靈資料不正確');
   elves.add(e.id);
   for(const k of ['hp','atk','def','spatk','spdef','speed'])if(!Number.isFinite(e.baseStats?.[k])||e.baseStats[k]<0||e.baseStats[k]>99999)throw Error('種族能力須為0至99999');
   if(e.path&&!safeImage(e.path))throw Error('精靈圖片網址格式不支援');
   if(e.soulMark&&typeof e.soulMark.description!=='string')throw Error('魂印描述不正確');
   for(const s of e.skills)if(!s||typeof s.name!=='string'||!s.name.trim()||typeof s.type!=='string'||!['物理','特殊','屬性'].includes(s.category)||typeof s.description!=='string'||![s.power,s.pp].every(n=>Number.isFinite(n)&&n>=0)||s.accuracy!==undefined&&(!Number.isFinite(s.accuracy)||s.accuracy<0||s.accuracy>100))throw Error('技能名稱、分類或數值不正確');
  }
 }
 const types=new Set<string>();
 for(const t of v.types){if(!t||typeof t.name!=='string'||!t.name.trim()||t.name.length>30||types.has(t.name)||!/^#[0-9a-f]{6}$/i.test(t.color)||t.icon&&!safeImage(t.icon))throw Error('自訂屬性名稱、顏色或圖示不正確');types.add(t.name);}
 if(!ids.has(v.activeBookId)||typeof v.selectedElfId!=='string')throw Error('圖鑑選取資料不正確');
 return v;
}
export function safeImage(value:string):boolean {return /^https?:\/\//i.test(value)||/^\/(?!\/)/.test(value)||/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value);}
