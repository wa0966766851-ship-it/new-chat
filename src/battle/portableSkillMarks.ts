/** 技能槽印記的純查詢；規則來自可編輯 Kit，與符文文字及精靈名稱無關。 */
import {skillSlot} from './skillSlot';
export function portableSkillCapabilities(elf:any, selected?:any):Record<string,any> {
  const result:Record<string,any>={innateDisabledSlots:[]};
  for(const [index,skill] of (elf?.skills||[]).entries()) {
    if(!skill.portableSkillMark||!skill.isRuneActive)continue;
    for(const [key,value] of Object.entries(skill.portableSkillMark.capabilities||{})) {
      if(key==='innateDisabled'){if(value)result.innateDisabledSlots.push(index);}
      else if(key==='statMultiplier'||key==='nonTrueOutputMultiplier')result[key]=(result[key]??1)*Number(value);
      else if(key==='priorityCeiling')result[key]=Math.min(result[key]??Infinity,Number(value));
      else result[key]=value;
    }
  }
  if(selected)result.innateDisabled=result.innateDisabledSlots.includes(skillSlot(elf,selected));
  return result;
}
export function hasPortableDuel(elf:any,other:any):boolean {
  return !!(elf?.currentHp>0&&other?.currentHp>0&&elf.portableDuelOpponent===String(other.battleId||other.id)&&other.portableDuelOpponent===String(elf.battleId||elf.id));
}
export function portableShieldPatch(elf:any,patch:any):any {
  if(!portableSkillCapabilities(elf).shieldsBlocked)return patch;
  const next={...patch};
  for(const key of ['shield','barrier'])if(next[key]>(elf[key]||0))delete next[key];
  return next;
}
/** 同時讀取雙方原選槽，避免先處理一側時改掉另一側的參照。 */
export function redirectedSelectedSkill(elf:any,selected:any,opponent:any,opponentSelected:any):any {
  const slot=skillSlot(elf,selected), own=elf.skills?.[slot];
  if(!own?.isRuneActive||!own.portableSkillMark?.capabilities?.mirrorOpponentSlot)return selected;
  const targetSlot=skillSlot(opponent,opponentSelected), replacement=elf.skills?.[targetSlot];
  return replacement?{...replacement,battleSlot:targetSlot}:selected;
}
