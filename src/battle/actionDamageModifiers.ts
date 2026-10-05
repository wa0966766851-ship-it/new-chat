import type { BattleEventContext, DamageComputation } from '../effects/types';
import { matchesDamageTypes, damageScopeLabel } from '../effects/damageChoices';
import { multiplyDamageReduction } from './damageReduction';

export const ACTION_DAMAGE_KEY = 'damageModifiersThisAction';
export const ACTION_POWER_KEY = 'powerMultiplierThisAction';
export const kindScope = (kind?: string) => ({攻擊:'attack',技能:'skill',非真實:'non_true',固定:'fixed',百分比:'percent',真實:'true'}[kind || ''] as string | undefined);

/** 本次行動保存範圍；在各傷害節點重用，到行動結束或切換清除。 */
export function queueActionDamageModifier(ctx: BattleEventContext, multiplier: number, kind: string): boolean {
  const scope = kindScope(kind);
  if (!scope) { ctx.addLog('本次增傷範圍待確認，未推定全傷害。', 'effect'); return false; }
  const previous = ctx.getPlayerState(ACTION_DAMAGE_KEY) || [];
  ctx.setPlayerState(ACTION_DAMAGE_KEY, [...previous, { scope, multiplier }]);
  ctx.addLog(`⚡ 本次${damageScopeLabel(scope)} ×${multiplier}！`, 'effect');
  return true;
}
export function queueActionPowerMultiplier(ctx: BattleEventContext, multiplier: number): void {
  ctx.setPlayerState(ACTION_POWER_KEY, (ctx.getPlayerState(ACTION_POWER_KEY) ?? 1) * multiplier);
  ctx.addLog(`⚡ 本次攻擊威力 ×${multiplier}！`, 'effect');
}
export function applyActionDamageModifiers(registry: any, comp: DamageComputation): void {
  if (comp.pure) return;
  for (const item of registry?.[ACTION_DAMAGE_KEY] || []) {
    if (matchesDamageTypes([item.scope], comp.damageCategory)) {
      if (item.multiplier < 1) multiplyDamageReduction(comp, item.multiplier, false); else comp.multiplier *= item.multiplier;
    }
  }
}
