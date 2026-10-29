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
  // 王·鏽腑喰心（真 Kit；DSH 20261017）：400固定／解除下降／消回合→免疫下1次／
  // 1回合禁療＋受擊30%真傷，全部改由 Kit 通用 op 表達（migratedOpeiaSkillKits）。
}
