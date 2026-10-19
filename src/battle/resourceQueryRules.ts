import type {Elf} from '../types';
import type {Mark} from './marks';
import {markAppliesToElf} from './marks';
export interface ResourceQueryRule {id:string;min:number;ignorePpLimit?:boolean;selfDownAsUp?:boolean;oppUpAsDown?:boolean}
/** 只按持有者配置與其自己可用資源判斷，給別人的同名印記不會替別人授權。 */
export function activeResourceQueryRules(elf:Elf,marks:Mark[]=[]):ResourceQueryRule[]{
  if(elf.isInherentInvalid)return [];
  return (((elf as any).resourceQueryRules||[]) as ResourceQueryRule[]).filter(rule=>
    typeof rule.id==='string'&&rule.id.length>0&&Number.isFinite(rule.min)&&rule.min>0&&
    [...marks,...(elf.marks||[])].filter(m=>m.id===rule.id&&markAppliesToElf(m,elf)).reduce((n,m)=>Math.max(n,m.count||0),0)>=rule.min);
}
export function resourceQueryActive(elf:Elf,query:'ignorePpLimit'|'selfDownAsUp'|'oppUpAsDown',marks:Mark[]=elf.marks||[]):boolean{
  return activeResourceQueryRules(elf,marks).some(rule=>rule[query]===true);
}
