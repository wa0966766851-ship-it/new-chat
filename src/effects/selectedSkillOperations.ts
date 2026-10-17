import type {BattleEventContext} from './types';
import {skillSlot} from '../battle/skillSlot';
import {changePp} from './newElfOperations';
type Side='p1'|'p2';
const identity=(elf:any)=>elf.battleId||elf.id;
function selected(ctx:BattleEventContext,side:Side){
  const base=side===ctx.actor?ctx.self:ctx.target;
  const elf=ctx.getFullTeam(side).find(e=>identity(e)===identity(base))||base;
  const slot=skillSlot(elf,side===ctx.actor?ctx.skill:ctx.opponentSkill);
  return {elf,slot};
}
/** 廢除保留槽號、圖紙與PP；正式選招讀isAbolished，不靠清PP冒充失去技能。 */
export function abolishSelectedSkill(ctx:BattleEventContext,side:Side):boolean {
  const {elf,slot}=selected(ctx,side);if(slot<0||elf.skills[slot].isAbolished)return false;
  ctx.updateAnyElf(side,identity(elf),{skills:elf.skills.map((s,i)=>i===slot?{...s,isAbolished:true}:s)});return true;
}
/** 星護耗盡後恢復PP不撤銷已發生的消耗，回報此槽而非全部技能的消耗量。 */
export function consumeSelectedPp(ctx:BattleEventContext,side:Side):number {
  const {elf,slot}=selected(ctx,side);if(slot<0)return 0;
  return changePp(ctx,side,elf,(s,i)=>i===slot?0:s.pp,false,'clear').removed;
}
