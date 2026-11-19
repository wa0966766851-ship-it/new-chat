import { BATTLE_ITEMS, getItemCategory } from '../../utils/battleHelpers';
import { legalActions } from './legalActions';
import type { AISettings, DecisionRequest, PlannedAction } from './types';

/** AI 偏好與遊戲合法性分開；特殊與解除用途始終保留。 */
export function policyAllows(action: PlannedAction, settings: AISettings): boolean {
  if (action.kind !== 'item') return true;
  const item = BATTLE_ITEMS.find(i => i.id === action.id);
  if (!item) return false;
  const category = getItemCategory(item);
  if (item.type === 'special' || category === 'special' || category === 'cleanse') return true;
  if (settings.allowOffensivePotions === false && (category === 'offense' || item.oppPpDrain || item.oppItemLock || item.oppSwitchLock || item.oppPotionBacklash)) return false;
  if (settings.allowStatusPotions === false && (category === 'inflict' || item.inflictStatuses?.length)) return false;
  if (settings.allowDamagePotions === false && (item.oppDamage || item.oppDamagePercent)) return false;
  return true;
}
export function aiLegalActions(request: Pick<DecisionRequest, 'state' | 'side' | 'settings' | 'forced' | 'potionRemaining'>): PlannedAction[] {
  const allowed = legalActions(request.state, request.side, request.forced, request.potionRemaining).filter(a => policyAllows(a, request.settings));
  return allowed.length || request.forced ? allowed : [{kind:'wait'}];
}
