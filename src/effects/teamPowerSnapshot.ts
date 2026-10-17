import type {BattleEventContext} from './types';
import {checkElfDead} from '../battle/elfAlive';
export function snapshotNextPowerForNonfullTeam(ctx:BattleEventContext,p:{perElf:number;scope:'team'|'bench';aliveOnly:boolean}):boolean{
 const id=ctx.self.battleId||ctx.self.id;
 const count=ctx.getFullTeam(ctx.actor).filter(e=>!e.isVanished&&!e.isExtra&&(p.scope==='team'||(e.battleId||e.id)!==id)&&(!p.aliveOnly||!checkElfDead(e))&&e.currentHp!==e.maxHp).length;
 ctx.addTimerTo(ctx.actor,{id:`next_power_nonfull:${id}`,name:`下次攻擊威力+${count*p.perElf*100}%`,kind:'use_counter',source:'soulmark',scope:'elf',ownerBattleId:id,persistsOffField:false,remaining:1,tickAt:'never',payload:{block:{nextPowerRatio:1+count*p.perElf}}},false);
 return true;
}
