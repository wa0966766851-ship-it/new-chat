import type { Elf } from '../types';
import type { BattleEventContext } from './types';

export const abilityKeys = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
export const abilityLevels = (elf: Elf, positive: boolean) => abilityKeys.reduce((n, key) => n + Math.max(0, (elf.statStages?.[key] || 0) * (positive ? 1 : -1)), 0);
export const currentElf = (ctx: BattleEventContext, side: 'p1' | 'p2', elf: Elf): Elf =>
  ctx.getFullTeam(side).find(e => (e.battleId || e.id) === (elf.battleId || elf.id)) || elf;

/** 吸取是移除原強化並給自身等級；不等同對手受到能力下降。 */
export function absorbBoosts(ctx: BattleEventContext, reverse = false, maxPerStat = Infinity): number {
  const stages = { ...currentElf(ctx, ctx.targetSide, ctx.target).statStages };
  const gain: Record<string, number> = {};
  let count = 0;
  for (const key of abilityKeys) {
    const n = Math.min(maxPerStat, Math.max(0, stages[key] || 0));
    if (!n) continue;
    gain[key] = n; count += n;
    stages[key] = reverse ? -n : stages[key] - n;
  }
  if (count) {
    ctx.updateElf(ctx.targetSide, { statStages: stages });
    ctx.applyStatChange(ctx.actor, gain);
  }
  return count;
}

export function clearStatuses(ctx: BattleEventContext, side: 'p1' | 'p2', elf: Elf, pick: (name: string) => boolean): void {
  const e = currentElf(ctx, side, elf);
  const patch: Partial<Elf> = {
    battleStatuses: Object.fromEntries(Object.entries(e.battleStatuses || {}).filter(([name]) => !pick(name))),
    effects: (e.effects || []).filter(effect => !pick(effect.name)),
    ...(pick(e.battleStatus || 'normal') ? { battleStatus: 'normal' as const, battleStatusDuration: 0 } : {}),
  };
  ctx.updateAnyElf(side, e.battleId || e.id, patch);
}
