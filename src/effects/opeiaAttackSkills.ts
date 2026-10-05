import type { BattleEventContext } from './types';
import { abilityKeys, currentElf } from './semanticOperations';
import { queueActionDamageModifier } from '../battle/actionDamageModifiers';
import { opeiaTimer, opeiaIdentity } from './opeiaTimedEffects';

export const isOpeiaToxicAttack = (name: string = '') => /^王[.·]噬心毒蝕$/.test(name);

export function opeiaToxicAttack(ctx: BattleEventContext): void {
  const self = currentElf(ctx, ctx.actor, ctx.self);
  const target = currentElf(ctx, ctx.targetSide, ctx.target);
  // 與既有「技能傷害提升3倍」慣例一致：最終3倍，低於1/3優先，不能2×3疊乘。
  const factor = self.currentHp < self.maxHp / 3 ? 3 : self.currentHp < self.maxHp / 2 ? 2 : 1;
  if (factor > 1) queueActionDamageModifier(ctx, factor, '技能');
  ctx.setPlayerState('opeiaToxicAfterAction', { targetId: opeiaIdentity(target),
    targetLost: Math.floor(Math.max(0, target.maxHp - target.currentHp) / 2),
    selfLost: Math.floor(Math.max(0, self.maxHp - self.currentHp) / 2) });
}

export function opeiaRustAttack(ctx: BattleEventContext): void {
  const history = ctx.getPlayerState('teamEntranceHistory') || {};
  const count = history[opeiaIdentity(ctx.self)] || 1;
  ctx.setPlayerState('opeiaRustActive', true);
  ctx.setPlayerState('opeiaRustEntranceBonus', count);
  ctx.setPlayerState('ignoreSpDefPercentUntilSwitch', Math.min(1, count * 0.25));
  ctx.setPlayerState('opeiaRustAfterAction', opeiaIdentity(ctx.target));
}

export function finishOpeiaAttack(ctx: BattleEventContext): void {
  const toxic = ctx.getPlayerState('opeiaToxicAfterAction');
  ctx.setPlayerState('opeiaToxicAfterAction', null);
  if (toxic && toxic.targetId === opeiaIdentity(ctx.target)) {
    // 兩句均附加給對手；「自身已損失」是取值基準，不是自損/真傷。
    ctx.applyPinkDamage(ctx.targetSide, toxic.targetLost, '王·噬心毒蝕·對手失血', undefined, undefined, 'percent');
    ctx.applyPinkDamage(ctx.targetSide, toxic.selfLost, '王·噬心毒蝕·自身失血', undefined, undefined, 'percent');
  }
  const rust = ctx.getPlayerState('opeiaRustAfterAction');
  ctx.setPlayerState('opeiaRustAfterAction', null);
  if (!rust || rust !== opeiaIdentity(ctx.target)) return;
  ctx.applyPinkDamage(ctx.targetSide, 400, '王·鏽腑喰心', undefined, undefined, 'fixed');
  const self = currentElf(ctx, ctx.actor, ctx.self);
  const stages = { ...self.statStages };
  for (const key of abilityKeys) if ((stages[key] || 0) < 0) stages[key] = 0;
  ctx.updateElf(ctx.actor, { statStages: stages });
  if (ctx.clearTurnEffectsOf(ctx.targetSide, ctx.target)) {
    ctx.addTimerTo(ctx.actor, { id: 'opeia_rust_next_status', name: '王·鏽腑喰心', kind: 'use_counter',
      source: 'skill', scope: 'elf', remaining: 1, tickAt: 'never', persistsOffField: false,
      payload: { immuneStatus: true } }, false);
  }
  // 在技能使用後附加，不能讓施放這招的主傷害提前觸發30%真傷。
  opeiaTimer(ctx, ctx.targetSide, 'opeia_rust_bound', 1,
    { recoveryReductionPercent: 1, onAttackReceivedTruePercent: 0.3 }, false, 'skill', true);
}
