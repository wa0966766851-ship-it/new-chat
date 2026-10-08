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
export function handleWuweiSoulMark(c: ArenaContext, event: EffectTiming, data?: any): void {
  if (!live(c)) return;
  if (event === EffectTiming.ON_ENTRANCE && !read(c, 'initialized')) {
    // A battle-start stat snapshot. The main engine still needs a pre-battle hook
    // before this can replace its ordinary zero-race-value calculation.
    const stat = c.self.calculatedStats;
    const unified = Math.floor((stat.hp + stat.atk + stat.spatk + stat.def + stat.spdef + stat.speed) / 2);
    c.updateElf(c.actor, { calculatedStats: { hp: unified, atk: unified, spatk: unified, def: unified, spdef: unified, speed: unified }, maxHp: unified, currentHp: unified });
    write(c, 'initialized', 1);
  }
  if (event === EffectTiming.ROUND_START) {
    bump(c, 'round'); write(c, 'used', 0);
    if (activeUntil(c, 'drain')) drain(c, c.self.currentHp < c.self.maxHp / 2 ? 2 / 3 : 1 / 3);
  }
  if (event === EffectTiming.BEFORE_SKILL) {
    write(c, 'used', 1);
    write(c, 'ppPending', 1);
    const slot = c.skill ? skillSlot(c.self, c.skill) : -1;
    write(c, 'ppSlot', slot);
    const used = c.self.skills[slot];
    const pp = used ? ppOf(used) : 0;
    write(c, 'ppBefore', pp);
    if (data?.ppCostComp) data.ppCostComp.base = 0;
    if (pp > 0) {
      clearStatuses(c, c.actor);
      write(c, 'statusGuard', 1);
    } else {
      write(c, 'forceHit', 1);
    }
  }
  if (event === EffectTiming.BEFORE_STATUS_APPLY && data?.targetSide === c.actor && read(c, 'statusGuard')) {
    data.prevented = true; write(c, 'statusGuard', 0);
  }
  // A zero PP cost skips the main engine's ON_PP_CONSUME event entirely.
  // Invert at action end, including when an attack misses.
  if ((event === EffectTiming.AFTER_ACTION || event === EffectTiming.ACTION_FAILED) && read(c, 'ppPending')) {
    write(c, 'ppPending', 0);
    const slot = read(c, 'ppSlot');
    const old = read(c, 'ppBefore');
    changePp(c, c.actor, c.self, (s, i) => i === slot ? invertPP(old, getMaxPp(s, c.self)) : s.pp);
    // 舊競技場資料仍有currentPp欄位；僅同步展示，不讓它主導下一次結算。
    c.updateElf(c.actor, { skills: c.self.skills.map(s => ({ ...s, currentPp: s.pp })) });
    if (old === 0) write(c, 'wanxiang', Math.min(6, read(c, 'wanxiang') + 1));
  }
  if (event === EffectTiming.MODIFY_PRIORITY && activeUntil(c, 'priority') && data?.priorityComp) data.priorityComp.bonus += 2;
  if (event === EffectTiming.OPPONENT_ACTION && activeUntil(c, 'reactive')) {
    if (data?.skill?.category === '屬性') {
      c.applyHeal(c.actor, Math.floor(c.self.maxHp / 3));
      damagePercentOfTarget(c, 1 / 3, '十玄釋');
    } else if (data?.skill) status(c, '束縛');
  }
  if (event === EffectTiming.ROUND_END && !read(c, 'used')) {
    // All satisfied 無為 clauses are evaluated, each draining its own PP.
    const moves = c.self.skills.map(s => ({ ...s }));
    if (moves[0] && c.self.currentHp < c.self.maxHp) { moves[0].pp = moves[0].currentPp = 0; c.setOpponentState('priorityPenaltyTurns', 1); }
    if (moves[1] && hasBoost(c.target)) { moves[1].pp = moves[1].currentPp = 0; c.clearTurnEffectsOf(c.targetSide); }
    if (moves[2]) { moves[2].pp = moves[2].currentPp = 0; restorePP(c, c.targetSide, -2); }
    if (moves[3] && abnormal(c, c.self)) { moves[3].pp = moves[3].currentPp = 0; c.setOpponentState('cannotSwitchTurns', 1); }
    c.updateElf(c.actor, { skills: moves });
  }
  if (event === EffectTiming.ON_KILL) {
    // 萬相乖離（官方後半句）：自身擊敗對手後，令對方全部陣亡精靈消逝。依使用者決定不重置萬相乖離。
    for (const e of c.getFullTeam(c.targetSide)) {
      if (e.currentHp <= 0 && !(e as any).isVanished && !(e as any).vanished) c.vanishElf(c.targetSide, e);
    }
  }
}

export const WUWEI_SKILLS: Record<string, BattleSkillHandler> = {
  '千秋虔': c => {
    restorePP(c, c.actor, 4);
    const reversed = reverseDrops(c, c.actor);
    if (reversed || c.getOpponentState('switchedThisTurn')) status(c, '臣服');
    else status(c, '束縛');
  },
  '百法拜': c => {
    modify(c, c.actor, c.self.currentHp === c.self.maxHp ? 2 : 1);
    until(c, 'drain', 4); until(c, 'priority', 2);
  },
  '十玄釋': c => {
    grantStatusImmunity(c, c.actor, 5);
    until(c, 'reactive', 4); until(c, 'dropGuard', 5);
  },
  '孑身誡': c => {
    const cleared = c.clearTurnEffectsOf(c.targetSide);
    if (!cleared) zeroPP(c, c.targetSide);
    if (transferBoosts(c)) zeroPP(c, c.targetSide);
    restorePP(c, c.targetSide, -1);
    const selected = c.target.skills.find(s => s.name === c.opponentSkill?.name);
    if (selected && ppOf(selected) <= 1) c.setOpponentState('nextSkillInvalid', true);
  },
  [FIFTH]: c => {
    const n = read(c, 'wanxiang');
    if (c.goesFirst || n >= 2) restorePP(c, c.targetSide, -1);
    if (!c.goesFirst || n >= 3) c.clearTurnEffectsOf(c.targetSide);
    if (!abnormal(c, c.target) || n >= 4) drain(c, 1 / 3);
    if (abnormal(c, c.target) || n >= 5) status(c, '臣服');
    if (c.target.currentHp < 300 || n >= 6) c.applyTrueDamage(c.targetSide, c.target.currentHp, FIFTH);
  },
};

/** Before resolve and the damage formula: set the *skill power*, never add raw damage. */
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
