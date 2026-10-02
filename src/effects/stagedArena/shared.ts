import type { Elf, Skill } from '../../types';
import type { BattleEventContext } from '../types';

export type ArenaContext = BattleEventContext;
export const STATS = ['atk', 'spatk', 'def', 'spdef', 'speed', 'accuracy'] as const;
type Side = 'p1' | 'p2';

// State belongs to one battle elf, never to the whole side: switching must not
// transfer an unrelated elf's stacks or turn effects.
export const key = (c: ArenaContext, name: string) => `arena.${c.self.battleId || c.self.id}.${name}`;
export const read = (c: ArenaContext, name: string) => Number(c.getPlayerState(key(c, name)) || 0);
export const write = (c: ArenaContext, name: string, value: number) => c.setPlayerState(key(c, name), value);
export const bump = (c: ArenaContext, name: string, amount = 1) => { const next = read(c, name) + amount; write(c, name, next); return next; };
export const live = (c: ArenaContext) => {
  const active = c.actor === 'p1' ? c.activeP1 : c.activeP2;
  return (active.battleId || active.id) === (c.self.battleId || c.self.id) && c.self.currentHp > 0;
};
export const hpFraction = (e: Elf) => e.maxHp > 0 ? Math.max(0, e.currentHp / e.maxHp) : 0;
export const steps = (e: Elf) => Math.min(10, Math.floor(hpFraction(e) * 10 + 1e-9));
export const stages = (e: Elf) => e.statStages || { atk: 0, spatk: 0, def: 0, spdef: 0, speed: 0, accuracy: 0 };
export const hasBoost = (e: Elf) => STATS.some(s => stages(e)[s] > 0);
export const hasDrop = (e: Elf) => STATS.some(s => stages(e)[s] < 0);
export const abnormal = (c: ArenaContext, e: Elf) => Object.values(c.getStatuses(e)).some(n => n > 0);
export const chance = (c: ArenaContext, p: number) => (c.rng?.() ?? Math.random()) < p;
export const until = (c: ArenaContext, name: string, rounds: number) => write(c, name, read(c, 'round') + rounds);
export const activeUntil = (c: ArenaContext, name: string) => read(c, name) > 0 && read(c, name) >= read(c, 'round');

/** Amount is already computed from the clause's correct source (self HP, target HP, or a hit). */
export function percent(c: ArenaContext, amount: number, label: string): number {
  return c.applyPinkDamage(c.targetSide, Math.max(0, Math.floor(amount)), label, undefined, undefined, 'percent');
}
export function damagePercentOfTarget(c: ArenaContext, fraction: number, label: string): number {
  return percent(c, c.target.maxHp * fraction, label);
}
export function drain(c: ArenaContext, fraction: number): void {
  c.applyAbsorb(c.targetSide, Math.max(1, Math.floor(c.target.maxHp * fraction)));
}
export function modify(c: ArenaContext, side: Side, amount: number): void {
  c.applyStatChange(side, Object.fromEntries(STATS.map(s => [s, amount])));
}
export function restorePP(c: ArenaContext, side: Side, amount: number): void {
  const elf = side === c.actor ? c.self : c.target;
  c.updateElf(side, { skills: elf.skills.map(s => {
    const next = Math.max(0, Math.min(s.maxPp ?? s.pp, (s.currentPp ?? s.pp) + amount));
    return { ...s, pp: next, currentPp: next };
  }) });
}
export function zeroPP(c: ArenaContext, side: Side): void {
  const elf = side === c.actor ? c.self : c.target;
  c.updateElf(side, { skills: elf.skills.map(s => ({ ...s, currentPp: 0, pp: 0 })) });
}
export function ppOf(s: Skill): number { return s.currentPp ?? s.pp; }
/** 異常免疫：同時寫精靈顯示欄與註冊表判定欄（正式引擎讀 immuneStatusTurns，UI 讀 statusImmuneTurns） */
export function grantStatusImmunity(c: ArenaContext, side: Side, turns: number): void {
  c.updateElf(side, { statusImmuneTurns: turns });
  if (side === c.actor) c.setPlayerState('immuneStatusTurns', turns);
  else c.setOpponentState('immuneStatusTurns', turns);
}
export function clearStatuses(c: ArenaContext, side: Side): number {
  const elf = side === c.actor ? c.self : c.target;
  const count = Object.values(c.getStatuses(elf)).filter(n => n > 0).length;
  if (count) c.updateElf(side, { battleStatuses: {}, battleStatus: 'normal', effects: elf.effects?.filter(e => !Object.keys(c.getStatuses(elf)).includes(e.id)) });
  return count;
}
export function reverseDrops(c: ArenaContext, side: Side): number {
  const elf = side === c.actor ? c.self : c.target;
  const changes = Object.fromEntries(STATS.filter(s => stages(elf)[s] < 0).map(s => [s, -2 * stages(elf)[s]]));
  if (Object.keys(changes).length) c.applyStatChange(side, changes);
  return Object.keys(changes).length;
}
export function transferBoosts(c: ArenaContext): number {
  const changes = Object.fromEntries(STATS.filter(s => stages(c.target)[s] > 0).map(s => [s, stages(c.target)[s]]));
  if (!Object.keys(changes).length) return 0;
  c.applyStatChange(c.actor, changes);
  c.applyStatChange(c.targetSide, Object.fromEntries(Object.entries(changes).map(([s, n]) => [s, -n])));
  return Object.keys(changes).length;
}
export const status = (c: ArenaContext, name: string, rounds = 2) => c.applyStatusWithImmunityCheck(c.targetSide, name, rounds).success;
