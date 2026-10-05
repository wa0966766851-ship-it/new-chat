import type { Elf, Skill } from '../types';
import { getMaxPp, getStatuses, removeStatusEffect } from '../utils/battleHelpers';
import { StatusRegistry } from '../effects/statusRegistry';
import { activeConstraints } from './timedConstraints';
import type { Timer } from './timers';

export function recoverPpByTimers(elf: Elf, amount: number, timers: Timer[]): Skill[] {
  const reduction = activeConstraints(timers, elf).reduce((n, p) => n + (p.ppRecoveryReductionPercent || 0), 0);
  const gain = Math.floor(amount * Math.max(0, 1 - reduction));
  return elf.skills.map(s => ({ ...s, pp: Math.min(getMaxPp(s, elf), s.pp + gain) }));
}

/** PP歸零的附屬異常同時更新三種狀態表示；可供消耗及技能削PP共用。 */
export function settlePpChanges(elf: Elf, skills: Skill[]): { patch: Partial<Elf>; emptied: number[] } {
  const emptied = skills.flatMap((skill, i) => (elf.skills[i]?.pp || 0) > 0 && skill.pp <= 0 ? [i] : []);
  const guard = Object.keys(getStatuses(elf)).some(name => StatusRegistry[name]?.mechanics?.some(m =>
    m.type === 'SPECIAL_BUFF' && m.params?.ppRestoreOnZero));
  if (!guard || !emptied.length) return { patch: { skills }, emptied };
  const clone = { ...elf, effects: [...(elf.effects || [])], battleStatuses: { ...getStatuses(elf) } };
  const restored = skills.map((skill, i) => emptied.includes(i) ? { ...skill, pp: getMaxPp(skill, elf) } : skill);
  for (const name of Object.keys(getStatuses(clone))) {
    if (!StatusRegistry[name]?.categories?.includes('WEAKENING')) removeStatusEffect(clone, name);
  }
  return { patch: { skills: restored, effects: clone.effects, battleStatuses: clone.battleStatuses,
    battleStatus: clone.battleStatus, battleStatusDuration: clone.battleStatusDuration }, emptied };
}
