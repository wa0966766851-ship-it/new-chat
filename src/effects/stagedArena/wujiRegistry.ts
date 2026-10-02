import type { BattleSkillHandler, DamageComputation } from '../types';
import { EffectTiming } from '../types';
import { STATS, activeUntil, bump, damagePercentOfTarget, grantStatusImmunity, live, modify, read, restorePP, reverseDrops, status, until, write, type ArenaContext } from './shared';

const HERO = 'arena.heroGlory';
const WUZHU = 'arena.wuzhu';
const mark = (c: ArenaContext, id: string, count: number, enemy = false) => c.setMark({
  id, name: id === HERO ? '英雄之耀' : '武誅', displayChar: id === HERO ? '耀' : '誅',
  source: '無極聖武', ownerBattleId: (enemy ? c.target : c.self).battleId,
  count, persistsOffField: !enemy, clearable: false, polarity: enemy ? 'negative' : 'positive',
  description: id === HERO ? '登場時令對手取得等量武誅；影響除雙攻外能力。' : '按剩餘回合提升無極聖武造成的攻擊傷害。',
}, enemy ? c.targetSide : c.actor);

export function handleWujiSoulMark(c: ArenaContext, event: EffectTiming, data?: any): void {
  if (event === EffectTiming.ELF_ENTERED && data?.enteredSide) {
    // The owner may be benched. Only the newly entered elf is affected.
    const side = data.enteredSide as 'p1' | 'p2';
    if ((side === c.actor ? c.self : c.target).battleId !== data.enteredId) return;
    c.applyStatusWithImmunityCheck(side, '砥礪', 1);
    return;
  }
  if (!live(c)) return;
  if (event === EffectTiming.ON_ENTRANCE) {
    if (!read(c, 'initialized')) {
      const own = c.getFullTeam(c.actor).filter(e => e.battleId !== c.self.battleId);
      const layers = own.reduce((n, e) => n + (/機率|燒傷|麻痺|凍傷|中毒/.test(e.alienTraits?.generalTrait?.description || '') ? -1 : 1), 0);
      write(c, 'hero', Math.max(0, layers)); write(c, 'initialized', 1);
    }
    mark(c, HERO, read(c, 'hero'));
    if (read(c, 'hero')) { write(c, 'wuzhu', read(c, 'hero')); mark(c, WUZHU, read(c, 'hero'), true); }
  }
  if (event === EffectTiming.ROUND_START) bump(c, 'round');
  if (event === EffectTiming.MODIFY_PRIORITY && read(c, 'wuzhu') && data?.priorityComp?.isIncoming) data.priorityComp.bonus -= 2;
  if (event === EffectTiming.BEFORE_DAMAGE && data?.damageComp) {
    const d = data.damageComp as DamageComputation;
    if (!d.isIncoming && d.damageCategory === 'skill_attack' && read(c, 'wuzhu')) {
      const shieldSteps = Math.min(10, Math.floor(((c.target.shield || 0) + (c.target.barrier || 0)) / 100));
      d.multiplier *= (1 + read(c, 'wuzhu') * .2) * (1 + shieldSteps * .1);
    }
    if (d.isIncoming && d.damageCategory !== 'true' && activeUntil(c, 'weiyue')) d.multiplier *= .4;
  }
  if (event === EffectTiming.AFTER_ACTION && c.skill?.category !== '屬性') {
    if (read(c, 'wuzhu')) { write(c, 'wuzhu', 0); c.clearMark(WUZHU, c.targetSide); }
    else { write(c, 'wuzhu', read(c, 'hero')); mark(c, WUZHU, read(c, 'hero'), true); }
  }
  if (event === EffectTiming.ROUND_END && activeUntil(c, 'liangjie')) {
    const empty = c.target.skills.filter(s => (s.currentPp ?? s.pp) === 0).length;
    if (empty) restorePP(c, c.targetSide, 5);
  }
}

export const WUJI_SKILLS: Record<string, BattleSkillHandler> = {
  '極武稜殺': c => { c.setPlayerState('ignoreDamageLimitThisAction', true); until(c, 'nextDamageBoost', 1); },
  '烈武天徵': c => {
    c.clearTurnEffectsOf(c.actor); modify(c, c.actor, c.self.currentHp > c.self.maxHp / 2 ? 2 : 1);
    grantStatusImmunity(c, c.actor, 4); until(c, 'statusReflect', 4); until(c, 'priority', 2);
  },
  '亂武天傀': c => {
    const removed = c.clearTurnEffectsOf(c.targetSide);
    if (removed) c.applyHeal(c.actor, c.self.maxHp);
    if (c.self.currentHp < c.target.currentHp) c.setPlayerState('blockAttackCount', 1);
    else status(c, '威怯', 3);
    const missing = c.self.skills.reduce((n, s) => n + Math.max(0, (s.maxPp ?? s.pp) - (s.currentPp ?? s.pp)), 0);
    restorePP(c, c.actor, 1000);
    if (missing) c.applyAbsorb(c.targetSide, missing * 40);
  },
  '鋭武銘戈': c => {
    if (c.clearTurnEffectsOf(c.targetSide)) c.setOpponentState('priorityPenaltyTurns', 2);
    let levels = 0;
    for (const s of STATS) levels += Math.max(0, c.target.statStages?.[s] || 0);
    if (levels) {
      c.applyStatChange(c.targetSide, Object.fromEntries(STATS.map(s => [s, -Math.max(0, c.target.statStages?.[s] || 0)])));
      c.applyFixedDamage(c.targetSide, levels * 40, '鋭武銘戈');
    }
    if (reverseDrops(c, c.actor)) c.setOpponentState('attackSkillInvalidTurns', 1);
  },
  '聖武·虛極拓世': c => {
    if (c.goesFirst) c.setPlayerState('mustCrit', true);
    const turns = read(c, 'weiyueTurns');
    if (turns) c.setOpponentState('allSkillInvalidTurns', turns);
    until(c, 'nextDamageBoost', 1);
    const dealt = damagePercentOfTarget(c, 1 / 3, '聖武·虛極拓世');
    if (dealt > 0 && c.target.currentHp > 0) c.applyHeal(c.actor, dealt);
    if (c.target.currentHp <= 0) grantStatusImmunity(c, c.actor, 2);
  },
};
