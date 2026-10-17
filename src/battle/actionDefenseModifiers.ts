import type {BattleEventContext} from '../effects/types';
import type {Elf,Skill} from '../types';

type DefenseStat='防禦'|'特防'|'雙防';
const key='actionDefenseIgnore';

/** 只修改本次公式；行動和持有者身份都必須吻合，不借用上一招的忽略比例。 */
export function queueActionDefenseIgnore(ctx:BattleEventContext,stat:DefenseStat,ratio:number):boolean{
  if(ctx.actionId===undefined)return false;
  const ownerBattleId=ctx.self.battleId||ctx.self.id,previous=ctx.getPlayerState(key);
  const items=previous?.actionId===ctx.actionId&&previous.ownerBattleId===ownerBattleId?previous.items:[];
  ctx.setPlayerState(key,{actionId:ctx.actionId,ownerBattleId,items:[...items,{stat,ratio}]});
  return true;
}

export function actionDefenseIgnore(registry:any,actor:Elf,skill:Pick<Skill,'category'>,actionId?:number):number{
  const record=registry?.[key];
  if(actionId===undefined||record?.actionId!==actionId||record.ownerBattleId!==(actor.battleId||actor.id)||skill.category==='屬性')return 0;
  const stat=skill.category==='物理'?'防禦':'特防';
  return Math.max(0,...record.items.filter((item:any)=>item.stat==='雙防'||item.stat===stat).map((item:any)=>item.ratio));
}
