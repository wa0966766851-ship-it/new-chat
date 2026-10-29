import type { BattleEventContext } from '../effects/types';
const key = 'attachedAttackDamage';
const identity = (ctx: BattleEventContext) => ({ actionId: ctx.actionId, owner: ctx.self.battleId || ctx.self.id, target: ctx.target.battleId || ctx.target.id });
export function queueAttachedAttackDamage(ctx: BattleEventContext, amount: number, afterDamage?: any) {
  const id = identity(ctx), old = ctx.getPlayerState(key);
  const same = old && Object.keys(id).every(k => old[k] === (id as any)[k]);
  ctx.setPlayerState(key, { ...id, amount: (same ? old.amount : 0) + amount, callbacks: [...(same ? old.callbacks : []), ...(afterDamage ? [afterDamage] : [])] });
}
export function takeAttachedAttackDamage(ctx: BattleEventContext) {
  const old = ctx.getPlayerState(key); ctx.setPlayerState(key, undefined);
  const id = identity(ctx);
  return old && Object.keys(id).every(k => old[k] === (id as any)[k]) ? old : { amount: 0, callbacks: [] };
}
