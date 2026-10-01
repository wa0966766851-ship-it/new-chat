import type { EffectItem } from '../components/BattleManager';
import { matchesDamageTypes } from '../effects/damageChoices';

/** 取技能結算值，與護盾、護罩、對手剩餘HP及HP淨減少分開。恢復仍走 heal 佇列。 */
export function queueSkillLifesteal(
  side: 'p1' | 'p2', damage: number, category: string, registry: any,
  pushEffect: (effect: EffectItem) => void,
): number {
  const ratio = Number(registry?.vampireRatio ?? 0);
  const scopes = registry?.vampireDamageTypesThisAction ?? ['skill'];
  if (!Number.isFinite(damage) || !Number.isFinite(ratio) || ratio <= 0 || !matchesDamageTypes(scopes, category)) return 0;
  const amount = Math.max(0, Math.floor(damage * ratio));
  if (amount > 0) {
    pushEffect({ type: 'heal', side, data: { amount } });
    pushEffect({ type: 'log', side, data: { text: `🩸 【吸血】：技能結算值 ${damage} ×${ratio}，恢復請求 ${amount} 點體力。`, type: 'heal' } });
  }
  return amount;
}
