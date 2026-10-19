import type { Skill } from '../../../types';
import type { BattleSkillHandler } from '../../types';
import { EffectTiming } from '../../types';
import { skillSlot } from '../../../battle/skillSlot';
import { getMaxPp } from '../../../utils/battleHelpers';
import { changePp } from '../../newElfOperations';
import { abnormal, activeUntil, bump, clearStatuses, grantStatusImmunity, damagePercentOfTarget, drain, hasBoost, live, modify, ppOf, read, restorePP, reverseDrops, status, transferBoosts, until, write, zeroPP, type ArenaContext } from './shared';

const FIFTH = '無相諦';

/** 0 PP 的第五技有六個依序永久解除的條件；擊殺後重置。 */
export function wuweiPower(base: number, cancelled: number, sameType: boolean): number {
  return base + (sameType || cancelled >= 1 ? 170 : 0) + Math.min(6, cancelled) * 50;
}
export function invertPP(current: number, maximum: number): number {
  return Math.max(0, maximum - current);
}
export function handleWuweiSoulMark(ctx: any, event: any, data?: any): void {
  // arena_12 魂印「無為之境」已遷真 Kit（migratedArena12SkillKits.ts；DSH 20261018 第十六批）——規則3.3 空殼化。
  return;
}

export const WUWEI_SKILLS: Record<string, BattleSkillHandler> = {
  // arena_12 五技已全部遷真 Kit（DSH 20261018 第十六批）——規則3.3 空殼化。
};

export function transformWuweiSkill(c: ArenaContext, skill: Skill): Skill {
  if (c.self.illusion?.target.skills[skillSlot(c.self, skill)]?.name === skill.name) {
    const sourced = Object.create(c);
    sourced.illusionEffectKey = c.self.illusion.effectKey || c.self.illusion.target.name;
    c = sourced;
  }
  const current = c.self.skills[skillSlot(c.self, skill)];
  const zeroPP = current ? ppOf(current) === 0 : false;
  return {
    ...skill,
    isSureHit: skill.isSureHit || zeroPP,
    power: skill.name === FIFTH ? wuweiPower(0, read(c, 'wanxiang'), c.self.type === skill.type) : skill.power,
  };
}
export const WUWEI_SKILL_TRANSFORMS: Record<string, typeof transformWuweiSkill> = Object.fromEntries(
  ['千秋虔', '百法拜', '十玄釋', '孑身誡', FIFTH].map(name => [name, transformWuweiSkill]),
);
