import type { Elf } from '../types';
import { getStatuses } from '../utils/battleHelpers';
import { canonicalStatusName } from '../effects/statusIdentity';

/** 比較真正寫入的個體狀態；期限縮短不算解除，同名別名改寫不重播。 */
export function removedStatusEvents(before:Elf,after:Elf) {
  const normalize=(elf:Elf)=>Object.entries(getStatuses(elf)||{}).reduce((map,name)=>{
    if(Number(name[1])>0)map.set(canonicalStatusName(name[0]),Math.max(map.get(canonicalStatusName(name[0]))||0,Number(name[1])));return map;
  },new Map<string,number>());
  const old=normalize(before),next=normalize(after);
  return [...old].filter(([name])=>!next.has(name)).map(([status,duration])=>({status,duration,reason:'removed' as const}));
}
export function patchesStatuses(patch:Partial<Elf>):boolean {
  return ['effects','battleStatuses','battleStatus','battleStatusDuration'].some(k=>Object.prototype.hasOwnProperty.call(patch,k));
}
