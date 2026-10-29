import type {BattleEventContext} from '../effects/types';
/** 只修改本次來源個體的公式能力值，換人／下一行動不借用快照。 */
export function setIncomingPanelAttack(ctx:BattleEventContext,p:any):boolean{
 if(ctx.actionId===undefined||ctx.skill?.category==='屬性')return false;
 ctx.setPlayerState('incomingPanelAttack',{actionId:ctx.actionId,attackerId:ctx.target.battleId||ctx.target.id,ratio:p.ratio});return true;
}
export function readIncomingPanelAttack(state:any,attacker:{battleId?:string;id:string},actionId?:number):number{
 const p=state?.incomingPanelAttack;
 return actionId!==undefined&&p?.actionId===actionId&&p.attackerId===(attacker.battleId||attacker.id)&&Number.isFinite(p.ratio)&&p.ratio>0?p.ratio:0;
}
