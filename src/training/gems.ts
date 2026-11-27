import rows from './gems.json';
import type {Elf,Skill} from '../types';
export const INSCRIPTION_GEMS=rows;
export const GEM_BY_ID=Object.assign(Object.create(null),Object.fromEntries(rows.map(g=>[g.id,g])));
export function equippedGems(elf:Partial<Elf>,skill?:Pick<Skill,'name'>){
 return (elf.inscriptions||[]).flatMap(inscription=>{
  const binding=inscription?.gem,gem=binding&&GEM_BY_ID[binding.id];
  return gem&&(!skill||binding.skillName===skill.name)?[{...gem,skillName:binding.skillName}]:[];
 });
}
export const gemHas=(elf:Partial<Elf>,skill:Pick<Skill,'name'>|undefined,effectId:number)=>!!skill&&equippedGems(elf,skill).some(g=>g.effects.some(e=>e.id===effectId));
export function gemFlatPower(elf:Elf,skill:Skill){return equippedGems(elf,skill).flatMap(g=>g.effects).filter(e=>e.id===1411).reduce((n,e)=>n+e.args[0],0);}
export function gemPriority(elf:Elf,target:Elf,skill:Skill){return equippedGems(elf,skill).flatMap(g=>g.effects).reduce((n,e)=>n+(e.id===1912&&elf.currentHp<150||e.id===1917&&target.currentHp<150?1:0),0);}
export function gemDescription(id:string){const g=GEM_BY_ID[id];return g?.effects.map(e=>e.id===543?'本版致命一擊機率100%':e.description.replace(/(?:20|25|30|95)%(?=(?:機率|概率|幾率)?(?:令|使|不消耗|降低|恢復|恢复|改變|改变))/g,'100%')).join('；')||'';}
