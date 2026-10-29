import type {BattleEventContext,DamageComputation} from './types';
import {getTypeMatchup} from '../utils/statCalculator';

/** 受方個體持有窗口；每次結算用該個體當前屬性重新查克制表。 */
export function grantTypeDamageFloor(ctx:BattleEventContext,p:{side:'self'|'opp';base:number;list:string[];turns:number}):boolean{
 const side=p.side==='self'?ctx.actor:ctx.targetSide;
 const elf=side===ctx.actor?ctx.self:ctx.target,owner=elf.battleId||elf.id;
 ctx.addTimerTo(side,{id:`type_damage_floor:${ctx.actor}:${ctx.self.battleId||ctx.self.id}:${ctx.skill?.name}:${owner}`,name:'技能傷害克制保底',kind:'turn_effect',source:'skill',scope:'elf',ownerBattleId:owner,persistsOffField:false,remaining:p.turns,tickAt:'round_end',
  description:`受到技能傷害至少${p.base}×${p.list.join('／')}中最高克制倍率`,
  payload:{block:{typeDamageFloor:{base:p.base,list:[...p.list]}}}},false);
 return true;
}

export function applyTypeDamageFloor(ctx:BattleEventContext,comp:DamageComputation|undefined,p:{base:number;list:string[]}):void{
 if(!comp?.isIncoming||comp.damageCategory!=='skill_attack')return;
 const floor=p.base*Math.max(...p.list.map(type=>getTypeMatchup(type,ctx.self.type)));
 comp.floor=Math.max(comp.floor||0,floor);
}
