import type { BattleSkillHandler, DamageComputation } from '../types';
import { EffectTiming } from '../types';
import { STATS, activeUntil, bump, drain, grantStatusImmunity, hasBoost, hasDrop, live, modify, percent, read, restorePP, reverseDrops, status, transferBoosts, until, write, type ArenaContext } from './shared';

export function tianfengEntry(c: ArenaContext, countEntry = true): void {
  const count = countEntry ? bump(c, 'entry') : read(c, 'entry');
  const trigger = bump(c, 'entryTrigger');
  // Source rule: sixth activation clears earlier entry effects; seventh starts over.
  if (trigger === 6) {
    for (const name of ['cap', 'attack', 'critGuard', 'healCut', 'ppDrain', 'specialBoost']) write(c, name, 0);
    return;
  }
  const names = ['cap', 'attack', 'critGuard', 'healCut', 'ppDrain', 'specialBoost'];
  for (let i = 0; i < Math.min(6, count); i++) until(c, names[i], 2);
}

export function handleTianfengSoulMark(c: ArenaContext, event: EffectTiming, data?: any): void {
  if (!live(c)) return;
  if (event === EffectTiming.ON_ENTRANCE) tianfengEntry(c);
  if (event === EffectTiming.ROUND_START) {
    bump(c, 'round'); write(c, 'hitOver300', 0);
    if (c.self.currentHp > c.self.maxHp / 2) c.applyStatChange(c.targetSide, { atk: -1, spatk: -1, speed: -1 });
    else tianfengEntry(c, false);
  }
  if (event === EffectTiming.MODIFY_PRIORITY && c.self.currentHp < c.self.maxHp / 2 && data?.priorityComp) data.priorityComp.bonus += 1;
  if (event === EffectTiming.BEFORE_DAMAGE && data?.damageComp) {
    const d = data.damageComp as DamageComputation;
    if (!d.isIncoming && d.damageCategory === 'skill_attack') {
      if (activeUntil(c, 'attack')) d.multiplier *= 2;
      if (c.self.currentHp < c.self.maxHp / 2) d.multiplier *= 2;
      if (c.skill?.name === '敕赦千銘' && !read(c, 'decreeCleared')) d.multiplier *= 2;
    }
    if (!d.isIncoming && ['fixed', 'percent'].includes(d.damageCategory) && (activeUntil(c, 'specialBoost') || activeUntil(c, 'decreeBoost'))) d.multiplier *= 1.3;
    if (d.isIncoming && d.damageCategory === 'skill_attack' && activeUntil(c, 'cap')) d.limit = Math.min(d.limit ?? Infinity, Math.floor(c.self.maxHp / 4));
    if (d.isIncoming && d.isCrit && activeUntil(c, 'critGuard')) d.isCrit = false;
  }
  if (event === EffectTiming.ON_DAMAGED && data?.targetSide === c.targetSide && data.amount > 300 && data.damageType === 'skill_attack') {
    write(c, 'hitOver300', 1); drain(c, 1 / 3);
  }
  if (event === EffectTiming.ROUND_END) {
    if (activeUntil(c, 'ppDrain')) restorePP(c, c.targetSide, -1);
    if (activeUntil(c, 'decreePP')) { restorePP(c, c.targetSide, -1); restorePP(c, c.actor, 1); }
    if (!read(c, 'hitOver300')) c.applyStatChange(c.actor, { spatk: 1, speed: 1 });
  }
  if (event === EffectTiming.AFTER_ATTACK_HIT && data?.hitIndex === 0) settleBloodRain(c);
  if (event === EffectTiming.OPPONENT_ACTION && data?.skill?.category === '屬性' && activeUntil(c, 'attrNull')) c.setOpponentState('utilitySkillInvalidTurns', 1);
}

export const TIANFENG_SKILLS: Record<string, BattleSkillHandler> = {
  '鋒毫浸血雨': c => {
    write(c, 'bloodRainRound', read(c, 'round') + 1); until(c, 'attrNull', 2); until(c, 'pressure', 2);
    if (c.target.currentHp > 0) {
      modify(c, c.targetSide, -1);
      if (!hasDrop(c.target)) c.setOpponentState('cannotSwitchTurns', 2);
    }
  },
  '艷羅劍典': c => {
    grantStatusImmunity(c, c.actor, 4); until(c, 'statusReflect', 4);
    const fifth = c.self.skills.find(s => s.isFifthSkill);
    const enemyFifth = c.target.skills.find(s => s.isFifthSkill);
    const diff = Math.max(0, (fifth?.currentPp ?? fifth?.pp ?? 0) - (enemyFifth?.currentPp ?? enemyFifth?.pp ?? 0));
    const pool = ['燒傷', '凍傷', '中毒', '麻痺', '害怕', '睡眠'];
    let applied = 0;
    for (let i = 0; i < Math.min(pool.length, diff); i++) {
      const index = Math.floor((c.rng?.() ?? Math.random()) * pool.length);
      if (status(c, pool.splice(index, 1)[0], diff)) applied++;
    }
    if (applied < diff) c.clearTurnEffectsOf(c.targetSide);
    const turns = Object.values(c.getStatuses(c.target)).reduce((n, value) => n + value, 0);
    if (turns) c.applyAbsorb(c.targetSide, turns * 60 * (diff > 3 ? 2 : 1));
  },
  '法咒共鳴斬': c => { c.setPlayerState('ignoreDamageLimitThisAction', true); c.setPlayerState('ignoreAttackImmunityThisAction', true); },
  '敕赦千銘': c => {
    const cleared = c.clearTurnEffectsOf(c.targetSide);
    write(c, 'decreeCleared', cleared ? 1 : 0);
    if (cleared) status(c, '臣服');
    until(c, 'decreePP', 2); until(c, 'decreeBoost', 2);
  },
  '萬蒼書帝錄': c => {
    const drop = STATS.reduce((n, s) => n + Math.max(0, -(c.self.statStages?.[s] || 0)), 0);
    if (drop) c.applyAbsorb(c.targetSide, drop * 60 * (hasBoost(c.target) ? 2 : 1));
    if (reverseDrops(c, c.actor)) until(c, 'dropGuard', 3);
    transferBoosts(c);
  },
};

/** 鋒毫浸血雨：下 1 回合攻擊命中時（僅一次），消耗自身目前體力 1/2 並造成等量百分比傷害。 */
export function settleBloodRain(c: ArenaContext): number {
  const due = read(c, 'bloodRainRound');
  if (!due || read(c, 'round') !== due) return 0;
  write(c, 'bloodRainRound', 0);
  const cost = Math.floor(c.self.currentHp / 2);
  c.adjustHp(c.actor, -cost);
  return percent(c, cost, '鋒毫浸血雨');
}
