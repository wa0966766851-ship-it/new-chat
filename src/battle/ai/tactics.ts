import { BATTLE_ITEMS } from '../../utils/battleHelpers';
import { calculateEffectiveStat } from '../../utils/statCalculator';
import { skillStageView } from '../skillStageView';
import { itemDamageAmount } from '../itemInventory';
import { legalActions } from './legalActions';
import { potionCanDefeat, repeatableFatalSurvival } from './mechanicAwareness';
import { opposite, type AISide, type DecisionRequest, type PlannedAction } from './types';

const damagingItems = new Map(BATTLE_ITEMS.filter(i => i.oppDamage || i.oppDamagePercent).map(i => [i.id, i]));

export function lethalPotion(state: DecisionRequest['state'], threatened: AISide, potionRemaining?: number) {
  const target = state[threatened];
  let threat: {action: PlannedAction; amount: number} | undefined;
  for (const action of legalActions(state, opposite(threatened), false, potionRemaining)) {
    const item = action.kind === 'item' && damagingItems.get(action.id);
    if (!item) continue;
    const amount = itemDamageAmount(item, target.maxHp);
    if (amount > (threat?.amount || 0) && potionCanDefeat(target, amount)) threat = {action,amount};
  }
  return threat;
}

export function winsPotionOrder(state: DecisionRequest['state'], side: AISide) {
  const speed = (player:AISide) => calculateEffectiveStat(state[player].calculatedStats.speed,
    skillStageView(state[player],undefined,'speed'));
  const delta = speed('p1') - speed('p2');
  return side === 'p1' ? delta >= 0 : delta < 0;
}

export function isCriticalDecision(request: DecisionRequest): boolean {
  const {state,side,forced} = request, foe = state[opposite(side)], self = state[side];
  return !!forced || (!foe.isConcealed && !foe.illusion && repeatableFatalSurvival(foe)) || self.currentHp <= self.maxHp * 0.2 || foe.currentHp <= foe.maxHp * 0.12;
}
