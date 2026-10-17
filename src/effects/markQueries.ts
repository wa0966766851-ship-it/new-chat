import type {BattleEventContext} from './types';
import {markAppliesToElf} from '../battle/marks';

export type MarkQuery={side:'self'|'opp';id:string};
/** 回合型印記的顯示數值就是剩餘期限；層數型印記不可充作回合。 */
export function readMarkRemainingTurns(ctx:BattleEventContext,p:MarkQuery):number{
  const side=p.side==='self'?ctx.actor:ctx.targetSide;
  const holder=p.side==='self'?ctx.self:ctx.target;
  return Math.max(0,...(ctx.getMarks(side)||[]).filter(m=>m.id===p.id&&m.unit==='回合'&&markAppliesToElf(m,holder))
    .map(m=>Number.isInteger(m.count)&&m.count>0?m.count:0));
}
/** 每次查詢當下的正式印記；不保存舊層數，不借同隊另一持有者。 */
export function readMarkStacks(ctx:BattleEventContext,p:MarkQuery):number{
  const side=p.side==='self'?ctx.actor:ctx.targetSide;
  const holder=p.side==='self'?ctx.self:ctx.target;
  return (ctx.getMarks(side)||[]).filter(m=>m.id===p.id&&markAppliesToElf(m,holder))
    .reduce((n,m)=>n+(Number.isFinite(m.count)?Math.max(0,m.count):0),0);
}
export function markChancePercent(ctx:BattleEventContext,p:MarkQuery&{pct:number}):number{
  return Math.min(100,Math.max(0,readMarkStacks(ctx,p)*p.pct));
}
