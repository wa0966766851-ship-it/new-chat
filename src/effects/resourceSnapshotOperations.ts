import type {BattleEventContext} from './types';
import type {RunState} from '../blocks/runtime';
import {checkElfDead} from '../battle/elfAlive';
const id=(elf:any)=>String(elf.battleId||elf.id);
/** 數值快照綁原持有者及回合；不把回合末即時值冒充回合初資源。 */
export function resourceSnapshotOperations(helpers:{liveElf:(ctx:BattleEventContext,side:'p1'|'p2')=>any}){
  return {
    snapshot_value:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const elf=helpers.liveElf(ctx,p.side==='self'?ctx.actor:ctx.targetSide);
      const values=p.fields.map((key:string)=>elf[key]??(['shield','barrier'].includes(key)?0:NaN));
      if(values.some((v:unknown)=>typeof v!=='number'||!Number.isFinite(v)))return false;
      st.lastAmount=values.reduce((sum:number,v:number)=>sum+v,0);
      ctx.setPlayerState(`blockSnapshot_${p.key}`,{value:st.lastAmount,round:ctx.roundNumber,owner:id(ctx.self)});return true;
    },
    heal_snapshot:(ctx:BattleEventContext,p:any,st:RunState)=>{
      st.lastAmount=0;const key=`blockSnapshot_${p.key}`,snapshot=ctx.getPlayerState(key);
      if(!snapshot||snapshot.round!==ctx.roundNumber||snapshot.owner!==id(ctx.self))return false;
      if(p.consume)ctx.setPlayerState(key,undefined);
      const amount=Math.floor(snapshot.value*p.ratio);if(amount<=0||checkElfDead(ctx.self))return false;
      ctx.applyHeal(ctx.actor,amount,{onSettled:r=>{if(r.operation==='heal'&&r.targetBattleId===id(ctx.self))st.lastAmount=r.hpGained;}});return true;
    },
    count_team_trait:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const sides=p.side==='both'?['p1','p2']:p.side==='self'?[ctx.actor]:[ctx.targetSide];
      st.lastAmount=sides.flatMap(side=>ctx.getFullTeam(side as 'p1'|'p2')).filter(elf=>!elf.isExtra&&!elf.isVanished&&(p.state==='any'||(p.state==='dead'?checkElfDead(elf):!checkElfDead(elf))))
        .filter(elf=>[elf.trait,elf.alienTraits?.gen2Trait,elf.alienTraits?.exclusiveTrait,...(elf.alienTraits?.exclusiveTraits||[]),elf.alienTraits?.alienTrait,elf.alienTraits?.generalTrait].some(trait=>trait?.name===p.name)).length;
      return true;
    },
  };
}
