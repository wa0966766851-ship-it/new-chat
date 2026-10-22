import type {Elf} from '../types';
import {applySavedSkillCorrections} from './savedSkillCorrections';

export const BUILTIN_SAVE_KEYS = ['seer_custom_elves','seer_default_elves_overrides','seer_last_used_p1_team','seer_last_used_p2_team','seer_p1_backpack_presets','seer_p2_backpack_presets'] as const;
const BACKUP_PREFIX='seer_before_builtin_kit_repair_20261021_';

/** 在任何畫面讀取舊背包前統一修復，先保留原字串供還原；不重建精靈或重設配裝。 */
export function repairSavedBuiltinStorage(storage:Pick<Storage,'getItem'|'setItem'>,defaults:Elf[]){
  const report:{key:string;status:'repaired'|'failed';message?:string}[]=[];
  const visit=(value:any):any=>{
    if(!value||typeof value!=='object')return value;
    if(value.id&&value.name&&Array.isArray(value.skills))return applySavedSkillCorrections(value,defaults);
    if(Array.isArray(value)){const next=value.map(visit);return next.some((v,i)=>v!==value[i])?next:value;}
    const entries=Object.entries(value).map(([key,v])=>[key,visit(v)] as const);
    return entries.some(([key,v])=>v!==value[key])?Object.fromEntries(entries):value;
  };
  for(const key of BUILTIN_SAVE_KEYS){
    try{
      const raw=storage.getItem(key);if(!raw)continue;
      const value=JSON.parse(raw),fixed=visit(value);if(fixed===value)continue;
      const backup=BACKUP_PREFIX+key;
      if(storage.getItem(backup)===null)storage.setItem(backup,raw);
      storage.setItem(key,JSON.stringify(fixed));report.push({key,status:'repaired'});
    }catch(error){report.push({key,status:'failed',message:String(error)});}
  }
  return report;
}
