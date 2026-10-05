import type { BattleSkillHandler, DamageComputation } from '../types';
import { EffectTiming } from '../types';
import { bypassesAttackDefense } from '../../battle/attackDefense';
import { STATS, activeUntil, bump, chance, grantStatusImmunity, damagePercentOfTarget, hasBoost, hasDrop, live, modify, percent, read, restorePP, reverseDrops, status, transferBoosts, until, write, type ArenaContext } from './shared';

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
      c.setOpponentState('skillHealBlockTurns', 2);
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
    if (d.isIncoming && d.damageCategory === 'skill_attack' && read(c, 'counter') > 0 && !bypassesAttackDefense(d, 'block')) {
      // 抵擋前的本次攻擊傷害：攻擊方增減傷與乘區已在此之前結算。
      const blocked = Math.max(0, Math.floor(d.base * (1 + (d.increasePercent || 0)) * (1 - (d.decreasePercent || 0)) * d.multiplier));
      d.multiplier = 0;
      write(c, 'counter', read(c, 'counter') - 1);
      write(c, 'counterPending', 1);
      finishMoiraiCounter(c, blocked);
    }
  }
  if (event === EffectTiming.AFTER_ATTACK_HIT && data?.skill && data.additionalEffectsEnabled !== false) {
    if (data.skill.name === '陰陽三合') settleYinYangHit(c);
    if (data.skill.name === '恆·蒼穹斗轉') { bump(c, 'fifthDamage', Math.max(0, Number(data.damage) || 0)); write(c, 'fifthPending', 1); }
  }
  if (event === EffectTiming.AFTER_ACTION && read(c, 'fifthPending')) {
    const total = read(c, 'fifthDamage');
    write(c, 'fifthPending', 0); write(c, 'fifthDamage', 0);
    finishMoiraiFifth(c, total);
  }
  // 恆·蒼穹斗轉：攻擊傷害低於 300 時，下 2 回合攻擊必定致命一擊。
  if (event === EffectTiming.BEFORE_SKILL && c.skill && c.skill.category !== '屬性') {
    // 列星安辰：下 2 回合攻擊無視對手能力提升狀態。
    if (activeUntil(c, 'ignoreBoost')) c.setPlayerState('ignoreOppBuffThisAction', true);
    const from = read(c, 'critFrom');
    if (from && read(c, 'round') >= from && read(c, 'round') <= from + 1) c.setPlayerState('mustCrit', true);
  }
  if (event === EffectTiming.MODIFY_PRIORITY && c.skill?.name === '九轉輪迴天' && hasDrop(c.self) && data?.priorityComp) data.priorityComp.bonus += 3;
}

/** 日月安屬：抵擋下一次攻擊傷害，並對攻擊者附加該次攻擊傷害 100% 的百分比傷害。 */
export function finishMoiraiCounter(c: ArenaContext, blockedDamage: number): number {
  if (!read(c, 'counterPending')) return 0;
  write(c, 'counterPending', 0);
  c.addLog?.(`🛡️ 【日月安屬】：免疫本次攻擊傷害${blockedDamage > 0 ? `，反擊 ${blockedDamage} 點百分比傷害` : ''}！`, 'effect');
  return blockedDamage > 0 ? percent(c, blockedDamage, '日月安屬反擊') : 0;
}

/** One independent proc per successful hit, after the attack's multi-hit roll. */
export function settleYinYangHit(c: ArenaContext): boolean {
  if (!chance(c, .2)) return false;
  c.applyFixedDamage(c.targetSide, 100, '陰陽三合');
  return true;
}

/** The fifth skill's 300-point branch and HP-based extra damage happen after attack settlement. */
export function finishMoiraiFifth(c: ArenaContext, attackDamage: number): void {
  if (attackDamage > 300) c.setPlayerState('blkImmuneStatusCount', Number(c.getPlayerState('blkImmuneStatusCount') || 0) + 1);
  else if (attackDamage < 300) write(c, 'critFrom', read(c, 'round') + 1);
  if (c.target.currentHp <= 0) return;
  const amount = Math.floor(c.self.maxHp * .25);
  // 對手免疫百分比傷害（實際未造成）時轉為真實傷害。
  if (!percent(c, amount, '恆·蒼穹斗轉')) c.applyTrueDamage(c.targetSide, amount, '恆·蒼穹斗轉');
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
    grantStatusImmunity(c, c.actor, 4);
    until(c, 'boostLock', 3); until(c, 'dropLock', 3);
    if (!chance(c, .8) || !status(c, '沉默', 1)) write(c, 'counter', read(c, 'counter') + 1);
  },
  '陰陽三合': c => {
    if (hasBoost(c.target)) { transferBoosts(c); c.setOpponentState('priorityPenaltyTurns', 1); }
    else modify(c, c.targetSide, -1);
    // 一回合攻擊 5～10 次；每次實際命中後由 AFTER_ATTACK_HIT 獨立判定 20%。
    c.setPlayerState('attackHitCountThisAction', 5 + Math.floor((c.rng?.() ?? Math.random()) * 6));
  },
  '恆·蒼穹斗轉': c => {
    if (c.clearTurnEffectsOf(c.targetSide)) status(c, '沉默', 1);
    // 300 分支與 25% 百分比傷害在攻擊結算後（AFTER_ACTION）以實際攻擊傷害判定。
    write(c, 'fifthDamage', 0);
  },
};
