import type {BattleEventContext} from '../../effects/types';
export const COMBAT_WINDOW_FIELDS:Record<string,readonly string[]>={freeze_turn_effects:['turns'],stage_gap_gate:['threshold']};
export function combatWindowIssue(op:string,p:any,_trig:string):string|null{
 if(op==='freeze_turn_effects'&&(!Number.isSafeInteger(p.turns)||p.turns<1||p.turns>10000))return '凍結回合倒數需正整數回合';
 if(op==='stage_gap_gate'&&(!Number.isSafeInteger(p.threshold)||p.threshold<0))return '能力等級差需非負整數門檻';
 return null;
}
export function combatWindowOperations(h:{addTimer:Function;ops:()=>any}){return {
 freeze_turn_effects:(ctx:BattleEventContext,p:any)=>{h.addTimer(ctx,ctx.actor,'回合類效果倒數凍結',p.turns,'turns',{freezeTurnEffects:true},false,'turn_effect');return true;},
 stage_gap_gate:(ctx:BattleEventContext,p:any)=>{
  const total=(elf:any)=>Object.values(elf.statStages||{}).reduce<number>((sum,n)=>sum+Number(n),0);
  return Math.abs(total(ctx.self)-total(ctx.target))>p.threshold;
 },
};}