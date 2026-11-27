import type {BattleEventContext} from '../effects/types';
import {EffectTiming} from '../effects/types';
import {applyKitPpOperation} from '../effects/ppOperations';
import {checkElfDead} from './elfAlive';
import {SIDE_FIELD_KEY,PENDING_SIDE_FIELD_KEY,activeSideField} from './sideFieldModel';
export function sideFieldLifecycle(ctx:BattleEventContext,event:string,data:any) {
 const active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
 if((active?.battleId||active?.id)!==(ctx.self.battleId||ctx.self.id))return;
 const round=ctx.roundNumber??0;
 if(event===EffectTiming.ROUND_START){
  const pending=ctx.getPlayerState(PENDING_SIDE_FIELD_KEY);
  if(pending&&round>=pending.round){ctx.setPlayerState(SIDE_FIELD_KEY,{...pending.field,expiresRound:round+pending.field.remaining-1});ctx.setPlayerState(PENDING_SIDE_FIELD_KEY,null);}
 }
 const stored=ctx.getPlayerState(SIDE_FIELD_KEY);
 const field=activeSideField(stored,round);
 if(!field){if(stored&&event===EffectTiming.ROUND_START)ctx.setPlayerState(SIDE_FIELD_KEY,null);return;}
 if(event===EffectTiming.BEFORE_DAMAGE){
  const comp=data?.damageComp||(data?.base!==undefined?data:null);
  if(comp&&!comp.isIncoming&&comp.damageCategory==='skill_attack')comp.increasePercent+=field.attackIncrease||0;
 }
 if(event!==EffectTiming.ROUND_END||ctx.getPlayerState('teamSideFieldSettledRound')===round)return;
 // Mark before recovery callbacks: healing can synchronously dispatch further lifecycle events.
 ctx.setPlayerState('teamSideFieldSettledRound',round);
 for(const elf of ctx.getFullTeam(ctx.actor)){
  if(checkElfDead(elf)||elf.isVanished)continue;
  const id=elf.battleId||elf.id;
  if(field.teamHeal)ctx.applyHealToElf?.(ctx.actor,id,field.teamHeal);
  if(field.teamPp){
   const recipient=ctx.contextForElf?.(ctx.actor,elf);
   // The shared PP operation preserves PP protection, change events and slot identity.
   if(recipient)applyKitPpOperation(recipient,ctx.actor,'add',field.teamPp);
  }
 }
 // Expiration is read against the round number, rather than clearing the field before
 // the opponent's round-end effects have finished resolving.
}
