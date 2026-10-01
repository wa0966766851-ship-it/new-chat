import type { BattleSkillHandler, DamageComputation } from '../types';
import { EffectTiming } from '../types';
import { STATS, activeUntil, bump, chance, damagePercentOfTarget, hasBoost, hasDrop, live, modify, percent, read, restorePP, reverseDrops, status, transferBoosts, until, write, type ArenaContext } from './shared';

export function moiraiStart(c: ArenaContext, choice: 0 | 1): void {
  if (choice === 0) {
    modify(c, c.actor, 1);
    if (!hasBoost(c.self)) { until(c, 'attackBoost', 1); until(c, 'specialBoost', 1); }
  } else {
    const amount = c.self.currentHp < c.self.maxHp / 2 ? 400 : 200;
    c.applyShield(c.actor, amount);
    c.updateElf(c.actor, { barrier: (c.self.barrier || 0) + amount });
  }
}
export function moiraiEnd(c: ArenaContext, choice: 0 | 1): void {
  if (choice === 0) {
    modify(c, c.targetSide, -1);
    if (!hasDrop(c.target)) { c.clearTurnEffectsOf(c.targetSide); c.setOpponentState('priorityPenaltyTurns', 2); }
  } else {
    const moves = c.target.skills;
    if (!moves.length) return;
    const i = Math.floor((c.rng?.() ?? Math.random()) * moves.length);
    const lost = moves[i].currentPp ?? moves[i].pp;
    c.updateElf(c.targetSide, { skills: moves.map((s, j) => j === i ? { ...s, currentPp: 0, pp: 0 } : s) });
    if (lost <= 5) {
      c.applyHeal(c.actor, Math.floor(c.self.maxHp / 3));
      restorePP(c, c.actor, 1000);
      c.setOpponentState('skillHealBlockUntil', read(c, 'round') + 1);
    }
  }
}
export function handleMoiraiSoulMark(c: ArenaContext, event: EffectTiming, data?: any): void {
  if (!live(c)) return;
  if (event === EffectTiming.ROUND_START) {
    bump(c, 'round'); write(c, 'opponentUsedSkill', 0);
    moiraiStart(c, chance(c, .5) ? 0 : 1);
    if (activeUntil(c, 'starDrain')) damagePercentOfTarget(c, 1 / 3, '列星安辰');
  }
  if (event === EffectTiming.OPPONENT_ACTION && data?.skill) write(c, 'opponentUsedSkill', 1);
  if (event === EffectTiming.ROUND_END) {
    if (!read(c, 'opponentUsedSkill')) { moiraiStart(c, 0); moiraiStart(c, 1); moiraiEnd(c, 0); moiraiEnd(c, 1); }
    else moiraiEnd(c, chance(c, .5) ? 0 : 1);
  }
  if (event === EffectTiming.BEFORE_DAMAGE && data?.damageComp) {
    const d = data.damageComp as DamageComputation;
    if (!d.isIncoming && d.damageCategory === 'skill_attack' && activeUntil(c, 'attackBoost')) d.multiplier *= 2;
    if (!d.isIncoming && ['fixed', 'percent'].includes(d.damageCategory) && activeUntil(c, 'specialBoost')) d.multiplier *= 1.5;
    if (d.isIncoming && d.damageCategory === 'skill_attack' && read(c, 'counter') > 0) {
      // The counter settles after this hit has been blocked. The adapter
      // passes the resolved, pre-block hit amount to finishMoiraiCounter.
      d.multiplier = 0;
      write(c, 'counter', read(c, 'counter') - 1);
      write(c, 'counterPending', 1);
    }
  }
  if (event === EffectTiming.MODIFY_PRIORITY && c.skill?.name === '九轉輪迴天' && hasDrop(c.self) && data?.priorityComp) data.priorityComp.bonus += 3;
}

export function finishMoiraiCounter(c: ArenaContext, blockedDamage: number, percentImmune: boolean): void {
  if (!read(c, 'counterPending')) return;
  write(c, 'counterPending', 0);
  if (!percentImmune && blockedDamage > 0) percent(c, blockedDamage, '日月安屬反擊');
}

/** One independent proc per successful hit, after the attack's multi-hit roll. */
export function settleYinYangHit(c: ArenaContext): boolean {
  if (!chance(c, .2)) return false;
  c.applyFixedDamage(c.targetSide, 100, '陰陽三合');
  return true;
}

/** The fifth skill's 300-point branch and HP-based extra damage happen after attack settlement. */
export function finishMoiraiFifth(c: ArenaContext, attackDamage: number, percentImmune: boolean): void {
  if (attackDamage > 300) c.updateElf(c.actor, { statusImmuneTurns: 1 });
  else if (attackDamage < 300) until(c, 'crit', 2);
  const amount = Math.floor(c.self.maxHp * .25);
  if (percentImmune) c.applyTrueDamage(c.targetSide, amount, '恆·蒼穹斗轉');
  else percent(c, amount, '恆·蒼穹斗轉');
}

export const MOIRAI_SKILLS: Record<string, BattleSkillHandler> = {
  '九轉輪迴天': c => {
    if (reverseDrops(c, c.actor)) c.setOpponentState('utilitySkillInvalidTurns', 2);
    for (const s of STATS) if ((c.target.statStages?.[s] || 0) < 0) {
      const pool = ['燒傷', '凍傷', '中毒', '麻痺', '害怕', '睡眠'];
      status(c, pool[Math.floor((c.rng?.() ?? Math.random()) * pool.length)]);
    }
    if (hasBoost(c.self)) c.setPlayerState('mustCrit', true);
  },
  '列星安辰': c => {
    modify(c, c.actor, c.self.currentHp > c.self.maxHp / 2 ? 2 : 1);
    until(c, 'starDrain', 4); until(c, 'ignoreBoost', 2); until(c, 'priority', 2);
  },
  '日月安屬': c => {
    c.updateElf(c.actor, { statusImmuneTurns: 4 });
    until(c, 'boostLock', 3); until(c, 'dropLock', 3);
    if (!chance(c, .8) || !status(c, '沉默', 1)) write(c, 'counter', read(c, 'counter') + 1);
  },
  '陰陽三合': c => {
    if (hasBoost(c.target)) { transferBoosts(c); c.setOpponentState('priorityPenaltyTurns', 1); }
    else modify(c, c.targetSide, -1);
    // 20% is a proc chance per actual hit; store the plan for the multi-hit adapter.
    write(c, 'yinYangHits', 5 + Math.floor((c.rng?.() ?? Math.random()) * 6));
  },
  '恆·蒼穹斗轉': c => {
    if (c.clearTurnEffectsOf(c.targetSide)) status(c, '沉默', 1);
    // finishMoiraiFifth is invoked by a post-attack adapter with the actual hit.
  },
};
