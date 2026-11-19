import type {Elf} from '../types';
import type {Mark} from './marks';
import {markAppliesToElf} from './marks';
export interface ResourceQueryRule {id:string;min:number;ignorePpLimit?:boolean;ignoreAttackPpLimit?:boolean;selfDownAsUp?:boolean;oppUpAsDown?:boolean;ignoreDamageLimit?:boolean;ignoreDamageBlock?:boolean;ignoreAttackImmunity?:boolean;
  /** 每層將對手視為至少處於N級全屬性能力下降（上限6）；同時於自身效果判定時視對手處於全屬性能力下降 */
  oppDownFloorPerStack?:number}
/** 只按持有者配置與其自己可用資源判斷，給別人的同名印記不會替別人授權。 */
export function activeResourceQueryRules(elf:Elf,marks:Mark[]=[]):ResourceQueryRule[]{
  if(elf.isInherentInvalid)return [];
  return (((elf as any).resourceQueryRules||[]) as ResourceQueryRule[]).filter(rule=>
    typeof rule.id==='string'&&rule.id.length>0&&Number.isFinite(rule.min)&&rule.min>0&&
    [...marks,...(elf.marks||[])].filter(m=>m.id===rule.id&&markAppliesToElf(m,elf)).reduce((n,m)=>Math.max(n,m.count||0),0)>=rule.min);
}
const stackOf=(elf:Elf,marks:Mark[],id:string)=>[...marks,...(elf.marks||[])].filter(m=>m.id===id&&markAppliesToElf(m,elf)).reduce((n,m)=>Math.max(n,m.count||0),0);
/** 持有者視角：對手全屬性能力等級的「視為下降」下限（0＝無）。只影響持有者自身的計算，不改真實等級。 */
export function resourceOppStageFloor(elf:Elf|undefined,marks:Mark[]=[]):number{
  if(!elf)return 0;
  return activeResourceQueryRules(elf,marks).reduce((n,rule)=>rule.oppDownFloorPerStack?Math.max(n,Math.min(6,stackOf(elf,marks,rule.id)*rule.oppDownFloorPerStack)):n,0);
}
export function resourceQueryActive(elf:Elf,query:'ignoreAttackPpLimit'|'ignorePpLimit'|'selfDownAsUp'|'oppUpAsDown'|'ignoreDamageLimit'|'ignoreDamageBlock'|'ignoreAttackImmunity',marks:Mark[]=elf.marks||[]):boolean{
  return activeResourceQueryRules(elf,marks).some(rule=>rule[query]===true);
}
