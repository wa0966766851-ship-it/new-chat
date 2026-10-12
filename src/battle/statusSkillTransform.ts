import type { Skill } from '../types';
/** 只替換本次攻擊的技能本體；原技能槽與PP消耗仍由選擇流程管理。 */
export function statusSkillTransform(skill:Skill,params:Record<string,any>):Skill|null {
  if(skill.category==='屬性'||typeof params.overrideAttack!=='string'||!params.overrideAttack)return null;
  if(!Number.isFinite(params.overrideAttackPower)||params.overrideAttackPower<0||!['物理','特殊'].includes(params.overrideAttackCategory)||typeof params.overrideAttackType!=='string')return null;
  return {name:params.overrideAttack,type:params.overrideAttackType,category:params.overrideAttackCategory,power:params.overrideAttackPower,
    pp:skill.pp,maxPp:skill.maxPp,battleSlot:skill.battleSlot,accuracy:100,description:'',effectType:'none',effectDetail:'',effectMode:'kit',kit:[]};
}
