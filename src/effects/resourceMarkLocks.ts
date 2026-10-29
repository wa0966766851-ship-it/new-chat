import type {BattleEventContext} from './types';
import {activeConstraints} from '../battle/timedConstraints';

/** 遞減鎖只屬於目前持有者；未生效、到期及其他隊員的計時器不能阻擋。 */
export function resourceMarkLocked(ctx:BattleEventContext,side:'p1'|'p2',id:string):boolean{
  const elf=side===ctx.actor?ctx.self:ctx.target;
  return activeConstraints(side==='p1'?ctx.p1Timers:ctx.p2Timers,elf).some(p=>p.block?.markLock?.id===id);
}
