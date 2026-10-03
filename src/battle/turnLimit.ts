import type { Elf } from '../types';

/** 巔峰 6V6：滿 50 回合仍未分出勝負時，依存活精靈數判定；額外精靈（isExtra 或第 7 位以後）一概不計入。 */
export const PEAK_TURN_LIMIT = 50;

export function countedAlive(team: Elf[], isDead: (e: Elf) => boolean): number {
  return team.filter((e, i) => e && !e.isExtra && i < 6 && !isDead(e)).length;
}

/** 回傳勝方；未達上限回傳 null。completedTurns＝已結束的回合數。 */
export function judgeTurnLimit(format: string | undefined, completedTurns: number, p1Team: Elf[], p2Team: Elf[], isDead: (e: Elf) => boolean): "p1" | "p2" | "draw" | null {
  if (format !== "peak_6v6" || completedTurns < PEAK_TURN_LIMIT) return null;
  const a = countedAlive(p1Team, isDead), b = countedAlive(p2Team, isDead);
  return a > b ? "p1" : b > a ? "p2" : "draw";
}
