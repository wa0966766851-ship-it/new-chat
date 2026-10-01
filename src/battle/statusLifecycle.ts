import type { BattleEffect } from '../types';
import { StatusRegistry } from '../effects/statusRegistry';
import { canonicalStatusName } from '../effects/statusIdentity';

/** 純期限轉移：場下不扣；BOSS 不扣且不受星贖延長；新衍化當回合不再扣。 */
export function advanceStatusEffect(effect: BattleEffect, statuses: Record<string, number>, rng: () => number, offField = false) {
  const entry = StatusRegistry[canonicalStatusName(effect.id)];
  const boss = entry?.categories.includes('BOSS_ONLY');
  let duration = effect.duration;
  if (!offField && !boss) {
    if (!effect.isLateMover) duration -= 1;
    for (const [id, turns] of Object.entries(statuses)) {
      if (turns <= 0) continue;
      const params = StatusRegistry[canonicalStatusName(id)]?.mechanics.find(m => m.type === 'SPECIAL_BUFF')?.params;
      if (params?.extendStatusTurns && entry && !entry.categories.includes('RESTRICTIVE')) duration += params.extendStatusTurns;
    }
  }
  if (duration > 0 || boss || offField) return { next: { ...effect, duration, isLateMover: offField ? effect.isLateMover : false }, ended: false };
  const params = entry?.mechanics.find(m => m.type === 'EVOLUTION_TRANSFORM')?.params;
  const pool = params?.randomPool;
  const id = Array.isArray(pool) && pool.length ? pool[Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)))] : params?.nextStatus;
  const transformed: BattleEffect | undefined = id ? { id, name: StatusRegistry[id]?.name || id, duration: params?.nextDuration ?? 1, isLateMover: false, stacks: 1 } : undefined;
  return { next: undefined, ended: true, transformed, statDebuff: params?.statDebuff as Record<string, number> | undefined,
    dieOnEnd: !!entry?.mechanics.find(m => m.type === 'SPECIAL_BUFF')?.params?.dieOnEnd };
}
