import type { BattleState } from '../components/BattleManager';
import { markAppliesToElf } from './marks';
import { getEffectiveBody } from '../utils/statCalculator';
import type { Elf } from '../types';

const keys = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const;
export type AgePanel = Pick<Elf['calculatedStats'], typeof keys[number]>;
declare module '../types' {
  interface Elf { agePanelAdjustment?: AgePanel; ageStatusTurnsFrozen?: boolean }
}

export function ageRates(turn: number, weight: number) {
  const early = turn <= 25;
  const drift = Math.floor(Math.max(0, weight) / (early ? 200 : 100)) / 10;
  const attack = Math.max(0, (early ? .2 : .5) - drift);
  const defense = early ? attack : -.1 - drift;
  return { atk: attack, spatk: attack, speed: attack, hp: early ? Math.max(0, .1 - drift) : defense, def: defense, spdef: defense };
}

export function syncAgeMarks(state: BattleState): BattleState {
  let next = state;
  for (const side of ['p1', 'p2'] as const) {
    const marks = state[`${side}Marks`] || [];
    const team = state[`${side}Team`];
    if (!marks.some(mark => mark.effects?.agePanel) && !team.some(elf => elf.agePanelAdjustment)) continue;
    const changed = team.map(elf => {
      const personal = marks.filter(mark => markAppliesToElf(mark, elf));
      const layers = personal.reduce((n, mark) => n + (mark.effects?.agePanel ? mark.count : 0), 0);
      const previous = elf.agePanelAdjustment;
      if (!layers && !previous) return elf;
      const immune = elf.skills.some(skill => skill.kit?.some(entry =>
        entry.role === 'carried' && entry.params?.clause?.body?.some((statement: any) =>
          statement.acts?.some((operation: any) => operation.op === 'age_mark_add'))));
      const rates = ageRates(state.turnNumber, getEffectiveBody(elf, personal).weight);
      const base = { ...elf.calculatedStats, hp: elf.maxHp };
      const panel = { ...base };
      const adjustment = {} as AgePanel;
      for (const key of keys) {
        const stat = base[key] - (previous?.[key] || 0);
        const rate = immune ? Math.max(0, rates[key]) : rates[key];
        panel[key] = Math.max(1, Math.floor(stat * (1 + layers * rate) + 1e-8));
        adjustment[key] = panel[key] - stat;
      }
      if (elf.ageStatusTurnsFrozen === Boolean(layers) && keys.every(key => panel[key] === base[key])) return elf;
      return {
        ...elf, calculatedStats: panel, maxHp: panel.hp,
        currentHp: Math.min(elf.currentHp, panel.hp),
        agePanelAdjustment: layers ? adjustment : undefined, ageStatusTurnsFrozen: Boolean(layers),
      };
    });
    if (changed.some((elf, index) => elf !== team[index])) {
      next = { ...next, [`${side}Team`]: changed, [side]: changed[state[`${side}ActiveIndex`]] };
    }
  }
  return next;
}

