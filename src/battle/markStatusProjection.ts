import type { BattleState } from '../components/BattleManager';
import { markAppliesToElf } from './marks';
import type { StatusProjection } from './statusRules';

const sides = ['p1', 'p2'] as const;

// Keep the mechanical view attached to the current holder so action legality and damage use the same rules.
export function syncMarkStatusProjections(state: BattleState): BattleState {
  if (!sides.some(side => state[side]?.markStatusProjections?.length ||
    state[`${side}Marks`]?.some(mark => mark.effects?.statusProjection))) return state;

  const projections: Record<'p1' | 'p2', StatusProjection[]> = { p1: [], p2: [] };
  for (const side of sides) {
    for (const mark of state[`${side}Marks`] || []) {
      const rule = mark.effects?.statusProjection as StatusProjection | undefined;
      if (!rule || mark.count <= 0 || !markAppliesToElf(mark, state[side])) continue;
      const recipient = rule.target === 'holder' ? side : side === 'p1' ? 'p2' : 'p1';
      projections[recipient].push(rule);
    }
  }

  let next = state;
  for (const side of sides) {
    const elf = state[side];
    const before = elf.markStatusProjections || [];
    const after = projections[side];
    if (before.length === after.length && before.every((rule, index) => rule === after[index])) continue;
    next = { ...next, [side]: { ...elf, markStatusProjections: after.length ? after : undefined } };
  }
  return next;
}

