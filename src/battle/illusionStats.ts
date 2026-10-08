import type { Elf, BaseStats } from '../types';

/** 記錄幻化期間自身的能力變化。完整回寫自身基底是重算，不是再扣一次借用值。 */
export function trackIllusionStatWrite(elf: Elf, patch: Partial<Elf>): Partial<Elf> {
  const illusion = elf.illusion;
  if (!illusion || Object.prototype.hasOwnProperty.call(patch, 'illusion') || (!patch.calculatedStats && patch.maxHp === undefined)) return patch;
  const previous = illusion.restoration || {
    ownStats: { ...illusion.original.calculatedStats }, ownMaxHp: illusion.original.maxHp,
    projectedStats: Object.fromEntries(Object.entries(illusion.original.calculatedStats).map(([key, value]) =>
      [key, value + (illusion.target.calculatedStats?.[key as keyof BaseStats] || 0)])) as unknown as BaseStats,
    projectedMaxHp: illusion.original.maxHp + illusion.target.calculatedStats.hp,
  };
  const stats = patch.calculatedStats || elf.calculatedStats;
  // 六維整份恢復自身快照時，不將「移除借用加成」誤判成自身的永久減值。
  const rebased = Object.keys(previous.ownStats).every(key => stats[key as keyof BaseStats] === previous.ownStats[key as keyof BaseStats]);
  const ownStats = Object.fromEntries(Object.entries(previous.ownStats).map(([key, value]) => [key,
    rebased ? value : value + stats[key as keyof BaseStats] - previous.projectedStats[key as keyof BaseStats],
  ])) as unknown as BaseStats;
  const maxHp = patch.maxHp ?? elf.maxHp;
  const ownMaxHp = maxHp === previous.ownMaxHp ? previous.ownMaxHp : previous.ownMaxHp + maxHp - previous.projectedMaxHp;
  return { ...patch, illusion: { ...illusion, restoration: { ownStats, ownMaxHp, projectedStats: { ...stats }, projectedMaxHp: maxHp } } };
}
