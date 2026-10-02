import type { BattleSkillHandler, DamageComputation } from '../types';
import { EffectTiming } from '../types';
import { STATS, activeUntil, bump, damagePercentOfTarget, hasBoost, hasDrop, live, modify, percent, read, restorePP, status, transferBoosts, until, write, type ArenaContext } from './shared';

export function awake(c: ArenaContext, index: number): number {
  const bit = 1 << index;
  const current = read(c, 'dragons');
  if (current & bit) return current;
  const next = current | bit;
  write(c, 'dragons', next);
  const base = c.self.calculatedStats;
  const extraHp = Math.floor(base.hp * .25);
  c.updateElf(c.actor, {
    maxHp: c.self.maxHp + extraHp, currentHp: c.self.currentHp + extraHp,
    calculatedStats: { ...base, atk: Math.floor(base.atk * 1.25), spatk: Math.floor(base.spatk * 1.25), def: Math.floor(base.def * 1.25), spdef: Math.floor(base.spdef * 1.25), speed: Math.floor(base.speed * 1.25) },
  });
  return next;
}
export const awakeCount = (mask: number) => [1, 2, 4, 8].filter(bit => mask & bit).length;

export function handleDragonHealingSoulMark(c: ArenaContext, event: EffectTiming, data?: any): void {
  if (!live(c)) return;
  if (event === EffectTiming.ROUND_START) {
    bump(c, 'round');
    if (activeUntil(c, 'drain')) {
      // The source falls back to true damage if percentage damage is immunized.
      const dealt = damagePercentOfTarget(c, 1 / 3, '挨打要立正');
      if (!dealt) c.applyTrueDamage(c.targetSide, Math.floor(c.target.maxHp / 3), '挨打要立正');
    }
  }
  if (event === EffectTiming.BEFORE_SKILL && c.skill) {
    const index = c.self.skills.findIndex(s => s.name === c.skill.name);
    if (index >= 0 && index < 4) awake(c, index);
    if (index === 4 && read(c, 'dragons') === 15) write(c, 'trueDragon', 1);
    if (read(c, 'trueDragon') && data?.ppCostComp) data.ppCostComp.base = 0;
  }
  if (event === EffectTiming.MODIFY_PRIORITY && read(c, 'soulPower') && c.skill?.category !== '屬性' && data?.priorityComp) data.priorityComp.bonus += 1;
  if (event === EffectTiming.BEFORE_DAMAGE && data?.damageComp) {
    const d = data.damageComp as DamageComputation;
    const count = awakeCount(read(c, 'dragons'));
    if (!d.isIncoming && d.damageCategory === 'skill_attack') d.multiplier *= 1 + count * .5;
    if (d.isIncoming && d.damageCategory !== 'true') d.multiplier *= Math.max(.4, 1 - count * .15);
    if (d.isIncoming && ['fixed', 'percent'].includes(d.damageCategory) && (read(c, 'dragons') & 2)) {
      d.multiplier = 0; until(c, 'specialBoost', 3);
    }
    if (d.isIncoming && d.damageCategory === 'skill_attack' && (read(c, 'dragons') & 4)) {
      bump(c, 'redStored', Math.min(d.base, Math.max(0, c.self.maxHp - read(c, 'redStored'))));
      d.multiplier = 0;
    }
    if (!d.isIncoming && ['fixed', 'percent'].includes(d.damageCategory) && activeUntil(c, 'specialBoost')) d.multiplier *= 1.5;
  }
  if (event === EffectTiming.ROUND_END) {
    const n = awakeCount(read(c, 'dragons'));
    if (n) { c.applyHeal(c.actor, Math.floor(c.self.maxHp * n / 10)); restorePP(c, c.targetSide, -n); }
  }
  if (event === EffectTiming.ON_SWITCH_OUT) { write(c, 'redStored', 0); write(c, 'redTrue', 0); }
  if (event === EffectTiming.AFTER_ACTION && c.skill?.category !== '屬性') settleRedDragon(c);
}

export function settleRedDragon(c: ArenaContext): number {
  if (!(read(c, 'dragons') & 4)) return 0;
  const amount = read(c, 'redStored');
  write(c, 'redStored', 0);
  const trueDamage = !!read(c, 'redTrue');
  write(c, 'redTrue', 0);
  if (amount <= 0 || c.target.currentHp <= 0) return 0;
  return trueDamage ? c.applyTrueDamage(c.targetSide, amount, '赤龍') : Number(c.applyFixedDamage(c.targetSide, amount, '赤龍') || 0);
}

export const DRAGON_HEALING_SKILLS: Record<string, BattleSkillHandler> = {
  '剛莖棍壓': c => {
    // Own max HP is the value base. Category and immunity are percentage damage.
    const value = Math.floor(c.self.maxHp * .2);
    if (!percent(c, value, '剛莖棍壓') && c.target.currentHp > 0) c.applyTrueDamage(c.targetSide, value, '剛莖棍壓');
  },
  '挨打要立正': c => {
    write(c, 'dragonSoulSource', 1); modify(c, c.actor, 1);
    until(c, 'drain', 3); until(c, 'priority', 2);
    // Attribute peeling needs an engine type mutation and switch-out restoration.
  },
  '幽魔相嘯': c => {
    const hadBoost = hasBoost(c.self) || hasBoost(c.target);
    const hadDrop = hasDrop(c.self) || hasDrop(c.target);
    const removedShield = (c.self.shield || 0) + (c.self.barrier || 0) + (c.target.shield || 0) + (c.target.barrier || 0);
    for (const side of [c.actor, c.targetSide]) {
      const e = side === c.actor ? c.self : c.target;
      c.applyStatChange(side, Object.fromEntries(STATS.map(s => [s, -(e.statStages?.[s] || 0)])));
      c.clearTurnEffectsOf(side);
      c.updateElf(side, { shield: 0, barrier: 0 });
    }
    if (hadBoost) { c.applyStatusWithImmunityCheck(c.actor, '狂暴', 3); status(c, '狂暴', 3); }
    if (hadDrop) write(c, 'redTrue', 1);
    if (c.self.currentHp < c.self.maxHp) {
      const amount = c.self.maxHp - c.self.currentHp;
      c.applyHeal(c.actor, amount);
      percent(c, amount * (c.self.currentHp < c.self.maxHp / 2 ? 2 : 1), '幽魔相嘯');
    }
    if (removedShield) c.applyFixedDamage(c.targetSide, removedShield, '幽魔相嘯');
  },
  '雅髯獅嘯': c => {
    const absorbed = transferBoosts(c);
    if (absorbed) c.applyStatusWithImmunityCheck(c.actor, '狂暴', 3);
    const selfCleansed = Object.values(c.getStatuses(c.self)).filter(n => n > 0).length;
    if (selfCleansed) { c.updateElf(c.actor, { battleStatuses: {}, battleStatus: 'normal' }); c.setOpponentState('allHitEffectNullTurns', 2); }
    const removed = Object.values(c.getStatuses(c.target)).filter(n => n > 0).length;
    if (removed) {
      c.updateElf(c.targetSide, { battleStatuses: {}, battleStatus: 'normal' });
      c.applyFixedDamage(c.targetSide, removed * 200 * (c.self.currentHp > c.target.currentHp ? 2 : 1), '雅髯獅嘯');
    }
  },
  '但願不會是個怪物': c => {
    const already = !!read(c, 'soulPower');
    write(c, 'soulPower', 1);
    if (c.clearTurnEffectsOf(c.targetSide)) {
      for (const name of ['疲憊', '害怕', '睡眠']) status(c, name, 3);
    }
    if (already) c.setPlayerState('ignoreAttackImmunityThisAction', true);
  },
};
