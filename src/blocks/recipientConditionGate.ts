import type {Act,Cond} from './model';
import type {BattleEventContext} from '../effects/types';
import {recipientEffectChance} from '../battle/recipientEffectChance';

// 沒有side參數的動作只列明確以對手為受方者。威力、先制、恢復、亂數選取均不在此列。
const OPPONENT_DEFAULT=new Set(['dmg','drain','vampire','no_heal','next_attr_invalid','next_attack_invalid']);
/** 機率條件未通過時，僅補執行印記持有者實際承受的動作，不放行同段自身強化。 */
export function guaranteedRecipientActs(ctx:BattleEventContext,acts:Act[],conditions:Cond[]):Act[] {
  if(!conditions.length || !conditions.every(c=>recipientEffectChance(ctx,ctx.targetSide,c.p?.pct)===100))return [];
  return acts.flatMap(a=>{
    const p=a.p||{};
    if(p.side==='opp')return [a];
    if(p.side==='both')return [{...a,p:{...p,side:'opp'}}];
    if(p.side==null && OPPONENT_DEFAULT.has(a.op))return [{...a,p:{...p,...(a.op==='dmg'?{both:false}:{})}}];
    return [];
  });
}
