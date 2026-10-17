import type { Elf, Skill, BaseStats } from '../types';
import type { BattleEventContext } from '../effects/types';
import { battleIdentity as identity } from './stateScopes';
import { skillSlot } from './skillSlot';
import { getMaxPp } from '../utils/battleHelpers';
import { changePp } from '../effects/newElfOperations';
import { trackIllusionStatWrite } from './illusionStats';
import { projectIllusionSkill } from './illusionSkillProjection';
import { releaseAcquiredRegistry } from './acquiredEffectContext';
import { correspondingBagElf, findBagElf } from './bagTargets';

export {appearanceElf,bindInitialCounterparts} from './illusionPresentation';

export function startIllusion(ctx: BattleEventContext, defaultTarget: Elf | undefined, source: string, ppBonus = 0): boolean {
  const target = takeIllusionOverride(ctx) ?? defaultTarget;
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

/** 初始出戰／待命背包相同位數；位數、禁用後壓緊與消逝順延規則見 bagTargets.ts。 */
export function correspondingInitialElf(team: Elf[], self: Elf): Elf | undefined {
  return correspondingBagElf(team, self);
}

/* ── 幻化指定對象覆寫（幻化指令）：己方「下次」幻化改指定所選精靈，執行一次即清除 ── */
/** team 開頭＝陣營層級狀態（stateScopes.isTeamRegistryKey）：換人後仍保留，由「下次幻化」消耗。 */
export const ILLUSION_OVERRIDE_KEY = 'teamIllusionTargetOverride';
export interface IllusionOverride { side: 'p1' | 'p2'; battleId: string }
const bagTeams = (ctx: BattleEventContext) => ({ p1: ctx.getFullTeam('p1'), p2: ctx.getFullTeam('p2') });

/** 所選精靈是否仍在當前雙方背包內且未消逝。 */
export function resolveIllusionPick(ctx: BattleEventContext, pick: IllusionOverride | undefined): Elf | undefined {
  return pick ? findBagElf(bagTeams(ctx), pick.side, pick.battleId) : undefined;
}
export function setIllusionOverride(ctx: BattleEventContext, pick: IllusionOverride): boolean {
  if (!resolveIllusionPick(ctx, pick)) return false;
  ctx.setPlayerState(ILLUSION_OVERRIDE_KEY, { ...pick });
  return true;
}
/** 取走（並清除）己方的覆寫；所選精靈已消逝／不在背包／就是自己時回傳 undefined，改用原本指定對象。 */
function takeIllusionOverride(ctx: BattleEventContext): Elf | undefined {
  const pick: IllusionOverride | undefined = ctx.getPlayerState?.(ILLUSION_OVERRIDE_KEY);
  if (!pick) return undefined;
  ctx.setPlayerState(ILLUSION_OVERRIDE_KEY, undefined);
  const elf = resolveIllusionPick(ctx, pick);
  if (!elf || identity(elf) === identity(ctx.self)) {
    ctx.addLog('【幻化指令】：指定的精靈已無法選取，改用原本的幻化對象。', 'effect');
    return undefined;
  }
  ctx.addLog(`【幻化指令】：幻化對象改為【${elf.name}】。`, 'effect');
  return elf;
}

