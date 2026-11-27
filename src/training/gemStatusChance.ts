import type {BattleEventContext} from '../effects/types';
export function takeGemStatusBoost(ctx:BattleEventContext,percent:number){
 const key=`inscriptionGem:${ctx.self.battleId||ctx.self.id}:statusBoost`,value=ctx.getPlayerState(key);
 if(!value||percent<=50)return {percent,bypass:undefined};
 ctx.setPlayerState(key,undefined);
 return {percent:Math.min(100,percent+value.chance),bypass:{maxBase:value.resistance,amount:value.resistance}};
}
