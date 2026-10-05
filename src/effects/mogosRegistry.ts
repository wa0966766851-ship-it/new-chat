import type { BattleEventContext as C, BattleSkillHandler, BattleSkillAfterHitHandler } from './types';
import { EffectTiming as E } from './types';
import { active, alive, identity, hasStatus, boosted, weakened, allStages, purge, timed, uses, changePp, restorePp, drain, constraint } from './newElfOperations';
import { abilityKeys } from './semanticOperations';
import { getStatuses } from '../utils/battleHelpers';
import { getTypeMatchup } from '../utils/statCalculator';
import { addDamageReduction } from '../battle/damageReduction';
import { queueActionDamageModifier } from '../battle/actionDamageModifiers';
import { combineSettlementCallbacks } from '../battle/settlementReceipt';
import { skillSlot } from '../battle/skillSlot';
import { bypassesAttackDefense } from '../battle/attackDefense';

const NAME = '邪靈主宰·摩哥斯';
export const MOGOS_MARK = 'mogos_residual';
type Orb = { phase: '豐腴期' | '竭擇期' | '混沌期'; fatalUsed: boolean; remaining: number };
const components = (type: string) => type.replace(/系/g, '').split(/[·.・]/);
const orb = (c: C): Orb | undefined => c.getPlayerState('teamMogosOrb');
const stacks = (c: C, side = c.targetSide) => c.getMarks(side).find(m => m.id === MOGOS_MARK)?.count || 0;
const reversed = (c: C): C => {
  const copy = Object.create(c);
  Object.defineProperties(copy, { self: { get: () => c.target }, target: { get: () => c.self },
    actor: { value: c.targetSide }, targetSide: { value: c.actor },
    getPlayerState: { value: c.getOpponentState }, setPlayerState: { value: c.setOpponentState },
    getOpponentState: { value: c.getPlayerState }, setOpponentState: { value: c.setPlayerState } });
  return copy;
};

function setOrb(c: C, value: Orb | undefined): void {
  c.setPlayerState('teamMogosOrb', value);
  if (!value) { c.clearMark('mogos_orb', c.actor); return; }
  c.setMark({ id: 'mogos_orb', name: `魂珠／${value.phase}`, count: 1, displayChar: '珠',
    source: NAME, description: `下場後保留；${value.phase}；竭擇期剩餘${value.remaining}次`,
    scope: 'team', persistsOffField: true, clearable: false, maxCount: 1 });
}
/** 抽取對在場者結算；重複出戰效果不增加正式登場紀錄。 */
export function drawMogosOrb(c: C): void {
  let value = orb(c);
  if (!value) { value = { phase: '豐腴期', fatalUsed: false, remaining: 2 }; setOrb(c, value); }
  purge(c, c.actor); c.applyHeal(c.actor, c.self.maxHp); restorePp(c, c.actor, c.self);
  const all = [...c.getFullTeam(c.actor), ...c.getFullTeam(c.targetSide)];
  const duration = all.reduce((n, e) => n + Number(alive(e)) + Number(components(e.type).includes('邪靈')), 0);
  c.applyStatusWithImmunityCheck(c.actor, '平靜', duration);
  const chaos = [c.self, c.target].some(e => components(e.type).includes('混沌') || e.skills.some(s => components(s.type).includes('混沌')));
  if (chaos) { value = { ...value, phase: '混沌期' }; setOrb(c, value); }
  if (value.phase === '豐腴期') c.setPlayerState('orbAbundanceThisRound', true);
}
function markSkillUser(c: C, skill: any): void {
  const before = stacks(c), count = Math.min(3, before + 1);
  c.setMark({ id: MOGOS_MARK, name: '埒殘銜闕', displayChar: '闕', count, maxCount: 3, unit: '道',
    source: NAME, scope: 'elf', ownerBattleId: identity(c.target), persistsOffField: true, clearable: false,
    description: '非真實傷害提升50%；每道獨立吸取該傷害50%；上限3道，下場後保留。',
    effects: { nonTrueDamageTakenMultiplier: 1.5 } }, c.targetSide);
  const actual = stacks(c);
  if (!(actual > before || before === 3)) return;
  const slot = skillSlot(c.self, skill);
  const consumed = slot >= 0 ? c.self.skills[slot].pp : 0;
  changePp(c, c.actor, c.self, (s, i) => i === slot ? 0 : s.pp);
  const bench = c.getFullTeam(c.actor).filter(e => identity(e) !== identity(c.self) && alive(e)).sort((a, b) => a.currentHp - b.currentHp)[0];
  if (bench && consumed > 0) {
    c.applyHealToElf?.(c.actor, identity(bench), consumed * 20);
    c.setPlayerState('teamOrbHpBonuses', { ...(c.getPlayerState('teamOrbHpBonuses') || {}), [identity(bench)]: consumed * 20 });
  }
  if (c.target.skills.some(s => getTypeMatchup(s.type, c.self.type) > 1)) {
    let own = getTypeMatchup(c.target.type, c.self.type), enemy = getTypeMatchup(c.self.type, c.target.type);
    if (enemy > own) { own = 1; enemy = 1; }
    c.setPlayerState('typeMultiplierUntilSwitch', own + actual);
    c.setOpponentState('typeMultiplierUntilSwitch', enemy);
  }
}

/** 全隊級魂珠與個體級埒殘銜闕各有作用域；不依賴摩哥斯仍在場。 */
export function runMogosTeamEffects(c: C, event: E, data?: any): void {
  const onField = identity(c.self) === identity(active(c, c.actor));
  if (event === E.AFTER_DAMAGE && data?.isIncoming && data.damageType !== 'true' && !data.reaction) {
    const n = stacks(c, c.actor), amount = data.receipt?.settledAmount ?? data.damage;
    if (n && amount > 0) {
      const natural = c.target.name === NAME || getTypeMatchup(c.target.type, c.self.type) > 1;
      for (let i = 0; i < n; i++) c.applyDamageToElf?.(c.actor, identity(c.self), Math.floor(amount / 2), 'percent', { reaction: true,
        onSettled: r => { if (natural) c.applyHeal(c.targetSide, r.settledAmount); } });
      const threshold = (data.skillPower ?? c.opponentSkill?.power ?? 0) * (1 + n);
      if (amount !== threshold) c.applyStatusWithImmunityCheck(c.actor, '害怕', 3);
      if (amount < threshold) uses(c, c.actor, 'mogos_next_priority', 1, { priorityAtMost: -3, priorityDelta: -3 });
    }
  }
  if (!onField) return;
  if (event === E.ON_SWITCH_OUT) {
    c.setPlayerState('typeMultiplierUntilSwitch', undefined); c.setOpponentState('typeMultiplierUntilSwitch', undefined);
    const previous = (c.self as any).orbHpBonus || 0;
    if (previous) c.updateElf(c.actor, { maxHp: c.self.maxHp - previous, currentHp: Math.min(c.self.currentHp, c.self.maxHp - previous), orbHpBonus: 0 } as any);
  }
  if (event === E.ON_ENTRANCE) {
    const bonuses = c.getPlayerState('teamOrbHpBonuses') || {}, bonus = bonuses[identity(c.self)];
    if (bonus) {
      c.updateElf(c.actor, { maxHp: c.self.maxHp - ((c.self as any).orbHpBonus || 0) + bonus, orbHpBonus: bonus } as any);
      const next = { ...bonuses }; delete next[identity(c.self)]; c.setPlayerState('teamOrbHpBonuses', next);
    }
    if (orb(c)?.phase === '竭擇期') uses(c, c.actor, 'mogos_first_attack_convert', 1, { orbAttackConversion: true });
    if (c.getOpponentState('nextElfMogosEntrance')) {
      c.setOpponentState('nextElfMogosEntrance', false);
      const own = reversed(c); drawMogosOrb(own); own.applyStatusWithImmunityCheck(c.actor, '害怕', 3);
    }
  }
  if (event === E.MODIFY_PRIORITY && constraint(c, c.actor, 'priorityAtMost') !== undefined) {
    data.priorityComp.bonus -= 3;
    data.priorityComp.base = Math.min(data.priorityComp.base, -3 - data.priorityComp.bonus);
  }
  if (event === E.BEFORE_SKILL) {
    const t = (c.actor === 'p1' ? c.p1Timers : c.p2Timers)?.find(t => t.payload?.priorityAtMost && t.remaining > 0 && (!t.ownerBattleId || t.ownerBattleId === identity(c.self)));
    if (t) c.consumeTimer(c.actor, t.id);
    c.setPlayerState('forceHitEffectsThisAction', !!c.getPlayerState('teamMogosForceHit'));
  }
  if (!orb(c)) return;
  if (event === E.BEFORE_SKILL) markSkillUser(c, c.skill);
  if (event === E.OPPONENT_ACTION) markSkillUser(reversed(c), data?.skill);
  if (event === E.BEFORE_DAMAGE && data?.damageComp?.isIncoming && data.damageComp.damageCategory === 'skill_attack' && constraint(c, c.actor, 'orbAttackConversion') && !bypassesAttackDefense(data.damageComp, 'conversion')) {
    const comp = data.damageComp;
    let recovery = 0;
    comp.beforeFinalDamage ||= [];
    comp.beforeFinalDamage.push(() => {
      recovery = Math.max(0, Math.floor(comp.base * (1 + comp.increasePercent) * Math.max(0, 1 - comp.decreasePercent) * comp.multiplier - (comp.flatReduction || 0)));
      comp.multiplier = 0;
    });
    c.consumeTimer(c.actor, 'mogos_first_attack_convert');
    comp.afterDamage = combineSettlementCallbacks(comp.afterDamage, () => {
      c.applyHeal(c.actor, recovery);
      const value = orb(c); if (!value || value.phase !== '竭擇期') return;
      drawMogosOrb(c);
      const after = orb(c)!;
      if (after.phase === '竭擇期') setOrb(c, after.remaining <= 1 ? undefined : { ...after, remaining: after.remaining - 1 });
    });
  }
  if (event === E.ROUND_END && c.getPlayerState('orbAbundanceThisRound')) {
    c.setPlayerState('orbAbundanceThisRound', false);
    // 原文沒有回合數；剝奪保留至該持有者下場，不能擅自縮成一回合。
    uses(c, c.targetSide, 'orb_strip_inherent', 1, { inherentInvalid: true, stripEntrance: true });
    if (constraint(c, c.targetSide, 'inherentInvalid')) {
      timed(c, c.targetSide, 'orb_next_stop', 1, { preventAction: true, recoveryReductionPercent: 1, fixedPercentAsTrue: true }, true, 'soulmark');
    }
  }
  if (event === E.ROUND_START && orb(c)?.phase === '混沌期') {
    const types = components(c.target.type);
    if (!types.includes('神靈') && !types.includes('混沌')) {
      if (types.includes('聖靈')) {
        c.setOpponentState('actionPreventedRound', c.roundNumber);
        timed(c, c.targetSide, 'orb_annihilation', 1, { recoveryReductionPercent: 1 }, false, 'soulmark', false);
        c.applyTrueDamage(c.targetSide, 238);
        c.updateElf(c.targetSide, { type: (c.rng?.() ?? Math.random()) < .5 ? '虛空' : '輪迴' });
      } else {
        types[Math.floor((c.rng?.() ?? Math.random()) * types.length)] = '混沌'; c.updateElf(c.targetSide, { type: types.join('·') });
      }
    }
    if (!getStatuses(c.self)['平靜']) {
      const a = c.applyStatusWithImmunityCheck(c.actor, '狂暴', 3), b = c.applyStatusWithImmunityCheck(c.targetSide, '狂暴', 3);
      if (!a.success || !b.success) timed(c, c.targetSide, 'orb_failed_rage', 2, { applyMode: 'gate', wrapItems: [{ atom: 'damage_multiplier', params: { value: .5, damageTypes: ['non_true'] } }] }, false, 'soulmark', false);
    }
  }
}

export function handleMogosSoulMark(c: C, event: E, data?: any): boolean {
  if (c.self.name !== NAME || identity(c.self) !== identity(active(c, c.actor))) return false;
  if (event === E.ON_ENTRANCE) { drawMogosOrb(c); return true; }
  if (event === E.ROUND_START && [c.self, c.target].some(e => e.skills.some(s => s.pp === 0)) && [c.self, c.target].some(e => getStatuses(e)['狂暴'])) drawMogosOrb(c);
  if (event === E.FATAL_RESIST) {
    const value = orb(c);
    if (!value || value.phase === '混沌期' || value.fatalUsed) return false;
    setOrb(c, { ...value, fatalUsed: true, phase: '竭擇期' });
    const stats = Object.fromEntries(Object.entries(c.self.calculatedStats).map(([k, n]) => [k, Math.floor(n * 1.25)])) as any;
    c.updateElf(c.actor, { currentHp: 1, calculatedStats: stats, maxHp: Math.floor(c.self.maxHp * 1.25) });
    c.expel?.(c.actor); return true;
  }
  if (event === E.BEFORE_SKILL && orb(c)) c.setPlayerState('soulSureHitThisAction', true);
  if (event === E.BATTLE_PHASE_END && orb(c)) {
    const amount = 350 * (c.self.currentHp < c.self.maxHp / 2 ? 2 : 1);
    c.applyPinkDamage(c.targetSide, amount, undefined, undefined, undefined, 'fixed', { onSettled: r => {
      c.applyHeal(c.actor, r.settledAmount, { onSettled: recovery => {
        const overflow = Math.max(0, recovery.settledAmount - recovery.hpGained);
        const percent = Math.floor(overflow / c.self.maxHp * 100) / 100;
        if (percent) timed(c, c.actor, 'mogos_overflow', 1, { attackAdditionalTruePercent: percent }, true, 'soulmark');
      } });
    } });
  }
  return false;
}

export const MOGOS_SKILLS: Record<string, BattleSkillHandler> = {
  '摧妖斬': c => {
    const own = { ...c.self.statStages }, other = { ...c.target.statStages }; let changed = false;
    for (const k of abilityKeys) if ((own[k] || 0) < (other[k] || 0)) { [own[k], other[k]] = [other[k] || 0, own[k] || 0]; changed = true; }
    c.updateElf(c.actor, { statStages: own as any }); c.updateElf(c.targetSide, { statStages: other as any });
    if (changed) c.applyStatusWithImmunityCheck(c.targetSide, '害怕', 3);
    if (weakened(c.target)) uses(c, c.targetSide, 'mogos_next_invalid', 1, { block: { invalid: '攻擊' } });
    if (boosted(c.self)) c.setPlayerState('attackBonusHitCountThisAction', (c.getPlayerState('attackBonusHitCountThisAction') || 0) + 2);
    timed(c, c.targetSide, 'mogos_output_limit', 3, { nonTrueOutputLimit: 280, block: { addInvalid: '屬性' } });
    const n = Math.floor((c.target.maxHp - c.target.currentHp) / 2);
    c.applyPinkDamage(c.targetSide, n, undefined, undefined, undefined, 'percent', { onSettled: r => { if (r.hpLost === 0) c.applyTrueDamage(c.targetSide, n); } });
    restorePp(c, c.actor, c.self, 5);
  },
  '背隳誓盟': c => {
    timed(c, c.actor, 'mogos_status_guard', 5, { immuneStatus: true, reflectStatus: true, excludeStatusCategory: 'AUXILIARY' });
    timed(c, c.actor, 'mogos_damage_status', 5, { damageStatusReaction: true });
    timed(c, c.actor, 'mogos_attack_boost', 2, { applyMode: 'gate', damageIncreasePercent: 1.5, damageTypes: ['attack'] }, true);
    timed(c, c.actor, 'mogos_after_percent', 4, { afterUsePercent: true }, false, 'skill', false);
  },
  '妖靈天性': c => {
    c.applyStatChange(c.actor, allStages(hasStatus(c.target) ? 2 : 1));
    timed(c, c.actor, 'mogos_round_drain', 4, { roundDrainThird: true }, false, 'skill', false);
    timed(c, c.actor, 'mogos_priority', 2, { block: { prio: 2 } }, true);
  },
  '王·墮落絕語': c => {
    if (c.self.currentHp < c.target.currentHp) queueActionDamageModifier(c, 2, '攻擊');
    c.setPlayerState('mogosPercentOnAttackThisAction', hasStatus(c.target));
    if (purge(c, c.actor)) timed(c, c.targetSide, 'mogos_strip_inherent', 2, { inherentInvalid: true });
  },
  '王·潰墮妖族': c => {
    c.setPlayerState('noResistedThisAction', true);
    if (c.clearTurnEffectsOf(c.targetSide)) timed(c, c.targetSide, 'mogos_attack_invalid', 3, { block: { invalid: '攻擊' } });
    const n = stacks(c), portion = Math.min(.75, n * .25), amount = c.target.maxHp / 3;
    drain(c, amount * (1 - portion), 'percent'); if (portion) drain(c, amount * portion, 'true');
    const invalid = [c.actor, c.targetSide].some(side => constraint(c, side, 'inherentInvalid') || constraint(c, side, 'block')?.invalid || constraint(c, side, 'block')?.addInvalid || active(c, side).isAdditionalInvalid);
    queueActionDamageModifier(c, invalid ? 1.5 : 1.25, '攻擊');
  },
};
export const MOGOS_AFTER_HIT: Record<string, BattleSkillAfterHitHandler> = {
  '王·潰墮妖族': (c, info) => {
    c.setPlayerState('teamMogosForceHit', false);
    if (info.killed) { c.applyStatChange(c.actor, allStages(1)); c.setPlayerState('nextElfMogosEntrance', true); }
    else uses(c, c.actor, 'mogos_next_halves', 1, { nextAttackHalves: 1 + stacks(c) });
  },
};
export const MOGOS_ON_INVALID = { '王·墮落絕語': (c: C) => c.setPlayerState('teamMogosForceHit', true) };
export const MOGOS_DAMAGE_TRANSFORMS = {
  '王·潰墮妖族': (c: C, s: any) => c.getPlayerState('teamMogosForceHit') ? { ...s, power: s.power + 50 + 25 * stacks(c) } : s,
};
