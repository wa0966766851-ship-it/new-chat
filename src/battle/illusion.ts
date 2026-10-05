import type { Elf, Skill, BaseStats } from '../types';
import type { BattleEventContext } from '../effects/types';
import { battleIdentity as identity } from './stateScopes';
import { skillSlot } from './skillSlot';

/** 只取外觀；精靈戰鬥身分、體力與技能持有者均保持原本精靈。 */
export function appearanceElf<T extends Pick<Elf, 'name' | 'id'>>(elf: T & { illusion?: Elf['illusion'] }): T {
  return elf.illusion ? { ...elf, name: elf.illusion.target.name,
    seerId: elf.illusion.target.seerId, path: elf.illusion.target.path,
    height: elf.illusion.target.height, weight: elf.illusion.target.weight, illusion: undefined } : elf;
}

export function startIllusion(ctx: BattleEventContext, target: Elf, source: string, ppBonus = 0): boolean {
  if (!target || identity(target) === identity(ctx.self)) return false;
  if (ctx.self.illusion) endIllusion(ctx);
  const self = ctx.self;
  // 不複製目標的幻化巢狀資料、印記、存活規則、PP偏移或戰鬥身分。
  const targetCopy = structuredClone({ ...target, illusion: undefined });
  const original = { calculatedStats: { ...self.calculatedStats }, maxHp: self.maxHp,
    trait: self.trait, alienTraits: self.alienTraits, isAlienElf: self.isAlienElf, category: self.category };
  const stats = Object.fromEntries(Object.keys(self.calculatedStats).map(k =>
    [k, self.calculatedStats[k as keyof BaseStats] + (targetCopy.calculatedStats?.[k as keyof BaseStats] || 0)])) as unknown as BaseStats;
  ctx.updateElf(ctx.actor, { illusion: { source, target: targetCopy, original, ppBonus }, calculatedStats: stats,
    maxHp: original.maxHp + targetCopy.calculatedStats.hp,
    globalPpMaxOffset: (self.globalPpMaxOffset || 0) + ppBonus,
    trait: targetCopy.trait, alienTraits: targetCopy.alienTraits,
    isAlienElf: self.isAlienElf || targetCopy.isAlienElf, category: targetCopy.category || self.category });
  ctx.addLog(`✨ 【${source}】：幻化為【${targetCopy.name}】，使用技能時依相同欄位轉化。`, 'effect');
  return true;
}

export function endIllusion(ctx: BattleEventContext): boolean {
  const self = ctx.self, illusion = self.illusion;
  if (!illusion) return false;
  const stats = Object.fromEntries(Object.entries(self.calculatedStats).map(([key, value]) =>
    [key, Math.max(1, value - (illusion.target.calculatedStats?.[key as keyof BaseStats] || 0))])) as unknown as BaseStats;
  const maxHp = Math.max(1, self.maxHp - illusion.target.calculatedStats.hp);
  ctx.updateElf(ctx.actor, { ...illusion.original, calculatedStats: stats, maxHp, illusion: undefined,
    currentHp: Math.min(self.currentHp, maxHp),
    globalPpMaxOffset: (self.globalPpMaxOffset || 0) - illusion.ppBonus });
  ctx.addLog(`✨ 【${illusion.source}】：解除幻化。`, 'effect');
  return true;
}

/** PP消耗原槽，實際使用技能轉化為目標同槽；絕不改寫下一隻的技能。 */
export function illusionSkill(elf: Elf, skill: Skill): Skill {
  if (!elf.illusion || elf.isInherentInvalid) return skill;
  const index = skillSlot(elf, skill);
  return elf.illusion.target.skills[index] ? { ...elf.illusion.target.skills[index], battleSlot: index } : skill;
}

/** 初始出戰／待命背包相同位数，不從經過召喚、死亡或消逝的動態清單重編。 */
export function correspondingInitialElf(team: Elf[], self: Elf): Elf | undefined {
  if (self.initialCounterpart) return self.initialCounterpart;
  const original = team.filter(e => !e.summonerId);
  const own = original.filter(e => Boolean(e.isExtra) === Boolean(self.isExtra));
  const other = original.filter(e => Boolean(e.isExtra) !== Boolean(self.isExtra));
  return other[own.findIndex(e => identity(e) === identity(self))];
}

export function bindInitialCounterparts(roster: Elf[], activeCount: number): Elf[] {
  return roster.map((elf, index) => {
    const peer = roster[index < activeCount ? index + activeCount : index - activeCount];
    return { ...elf, initialCounterpart: peer ? structuredClone({ ...peer, initialCounterpart: undefined, illusion: undefined }) : undefined };
  });
}
