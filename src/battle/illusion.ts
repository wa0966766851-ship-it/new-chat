import type { Elf, Skill, BaseStats } from '../types';
import type { BattleEventContext } from '../effects/types';
import { battleIdentity as identity } from './stateScopes';
import { skillSlot } from './skillSlot';
import { getMaxPp } from '../utils/battleHelpers';
import { changePp } from '../effects/newElfOperations';
import { trackIllusionStatWrite } from './illusionStats';
import { projectIllusionSkill } from './illusionSkillProjection';
import { releaseAcquiredRegistry } from './acquiredEffectContext';

/** 只取外觀；精靈戰鬥身分、體力與技能持有者均保持原本精靈。 */
export function appearanceElf<T extends Pick<Elf, 'name' | 'id'>>(elf: T & { illusion?: Elf['illusion'] }): T {
  return elf.illusion ? { ...elf, name: elf.illusion.target.name,
    seerId: elf.illusion.target.seerId, path: elf.illusion.target.path,
    height: elf.illusion.target.height, weight: elf.illusion.target.weight,
    artPresentation: elf.illusion.target.artPresentation, illusion: undefined } : elf;
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
  const generation = (self.illusionGeneration || 0) + 1;
  ctx.updateElf(ctx.actor, { illusionGeneration: generation, illusion: { source, target: targetCopy, original, ppBonus,
    effectKey: `${identity(self)}.${generation}`,
    restoration: { ownStats: { ...original.calculatedStats }, ownMaxHp: original.maxHp,
      projectedStats: { ...stats }, projectedMaxHp: original.maxHp + targetCopy.calculatedStats.hp } }, calculatedStats: stats,
    maxHp: original.maxHp + targetCopy.calculatedStats.hp,
    globalPpMaxOffset: (self.globalPpMaxOffset || 0) + ppBonus,
    isAlienElf: self.isAlienElf || targetCopy.isAlienElf, category: targetCopy.category || self.category });
  ctx.addLog(`✨ 【${source}】：幻化為【${targetCopy.name}】，使用技能時依相同欄位轉化。`, 'effect');
  return true;
}

export function endIllusion(ctx: BattleEventContext): boolean {
  const self = ctx.self, illusion = self.illusion;
  if (!illusion) return false;
  // 也兼容舊handler直接修改面板的情況；正常更新入口已逐次記錄自身變化。
  const restored = trackIllusionStatWrite(self, { calculatedStats: self.calculatedStats, maxHp: self.maxHp }).illusion!.restoration!;
  const stats = { ...restored.ownStats };
  const maxHp = restored.ownMaxHp;
  releaseAcquiredRegistry(ctx);
  ctx.updateElf(ctx.actor, { ...illusion.original, calculatedStats: stats, maxHp, illusion: undefined,
    currentHp: Math.min(self.currentHp, maxHp),
    globalPpMaxOffset: (self.globalPpMaxOffset || 0) - illusion.ppBonus });
  // 暫時PP上限解除後，使用正式PP變動入口收斂超額；不得留下高於上限的技能。
  if (illusion.ppBonus) changePp(ctx, ctx.actor, ctx.self, s => Math.min(s.pp, getMaxPp(s, ctx.self)), false, 'cap_change');
  ctx.addLog(`✨ 【${illusion.source}】：解除幻化。`, 'effect');
  return true;
}

/** PP消耗原槽，實際使用技能轉化為目標同槽；絕不改寫下一隻的技能。 */
export function illusionSkill(elf: Elf, skill: Skill): Skill {
  if (!elf.illusion || elf.isInherentInvalid) return skill;
  const index = skillSlot(elf, skill);
  const original = elf.skills[index];
  const target = elf.illusion.target.skills[index];
  return target && original ? projectIllusionSkill(original, target, index) : skill;
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
