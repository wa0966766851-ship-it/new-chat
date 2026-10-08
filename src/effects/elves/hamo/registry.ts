import type { Elf, Skill } from '../../../types';
import type { BattleEventContext as C, DamageComputation, BattleSkillHandler, BattleSkillAfterHitHandler, BattleSkillOnInvalidHandler } from '../../types';
import { EffectTiming as E } from '../../types';
import type { Timer } from '../../../battle/timers';
import { isSkillDamageType } from '../../../battle/damageSemantics';
import { addDamageReduction } from '../../../battle/damageReduction';
import { abilityKeys, absorbBoosts } from '../../semanticOperations';
import { active, alive, allStages, clearStages, drain, identity, timed, timersFor, uses } from '../../newElfOperations';
import { getMaxPp } from '../../../utils/battleHelpers';
import { getTypeMatchup } from '../../../utils/statCalculator';
import { requestSkillRecalculation } from '../../../battle/skillRecalculation';
import { bypassesAttackDefense } from '../../../battle/attackDefense';

type Colour = '無色' | '藍色' | '紅色' | '綠色';
const cycle = ['水', '火', '草'] as const;
const colours: Colour[] = ['藍色', '紅色', '綠色'];
const status = { 藍色: '凍傷', 紅色: '燒傷', 綠色: '中毒' };
const scales = (c: C): Colour[] => c.getPlayerState('hamoScales') || [];
const has = (c: C, colour: Colour) => scales(c).includes(colour);
const onField = (c: C) => identity(c.self) === identity(active(c, c.actor));

/** 使用者確認：每下降10%逐次乘1.1；每次恢復獨立取當時體力，不複用舊快照。 */
export function hamoRoundRecovery(maxHp: number, currentHp: number): number {
  if (!Number.isFinite(maxHp) || maxHp <= 0 || !Number.isFinite(currentHp)) return 0;
  const steps = Math.floor(Math.max(0, maxHp - currentHp) * 10 / maxHp);
  return Math.floor(maxHp * .15 * 1.1 ** steps);
}
function writeScales(c: C, next: Colour[]): void {
  c.setPlayerState('hamoScales', next);
  for (const colour of ['無色', ...colours] as Colour[]) {
    const id = `hamo_scale_${colour}`, count = next.filter(x => x === colour).length;
    if (!count) { c.clearMark(id); continue; }
    c.setMark({ id, name: `${colour}龍鱗`, displayChar: colour[0], count, unit: '枚', maxCount: 3,
      scope: 'elf', ownerBattleId: identity(c.self), clearable: false, persistsOffField: false,
      description: `${colour}龍鱗；依魂印觸發。消失受保護時仍執行消失效果，但保留龍鱗。` });
  }
}
function scheduleRemoval(c: C, colour: Colour): void {
  const pending: Colour[] = c.getPlayerState('hamoPendingRemoval') || [];
  if (!pending.includes(colour)) c.setPlayerState('hamoPendingRemoval', [...pending, colour]);
}
function raiseDragonCaps(c: C): void {
  for (const elf of c.getFullTeam(c.actor).filter(e => e.type.split(/[·.\/]/).includes('龍') && alive(e))) {
    const stats = { ...elf.calculatedStats };
    for (const key of ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const) stats[key] = Math.floor(stats[key] * 1.2);
    c.updateAnyElf(c.actor, identity(elf), { calculatedStats: stats, maxHp: Math.floor(elf.maxHp * 1.2) });
  }
}
function removeScale(c: C, colour: Exclude<Colour, '無色'>): void {
  // 使用者確認：保護不取消消失的副作用；不能因龍鱗沒被刪掉而吞效果。
  c.applyStatusWithImmunityCheck(c.targetSide, status[colour], 3);
  if (colour === '紅色') c.clearTurnEffectsOf(c.targetSide);
  if (colour === '藍色') c.updateElf(c.targetSide, { shield: 0, barrier: 0 });
  if (colour === '綠色') {
    const hp = Math.max(1, Math.floor(c.target.maxHp * .8));
    c.updateElf(c.targetSide, { maxHp: hp, currentHp: Math.min(c.target.currentHp, hp),
      calculatedStats: { ...c.target.calculatedStats, hp } });
  }
  if (c.roundNumber >= (c.getPlayerState('hamoProtectionUntil') || 0)) writeScales(c, scales(c).filter(x => x !== colour));
}
function captureRemoved(c: C, event: E, data: any): void {
  if (data?.sourceSide === c.actor) return;
  // 固有寫的是「當回合被對手消除」，包括哈莫出手前已被消除的效果。
  if (c.getPlayerState('hamoRemovalSnapshotRound') !== c.roundNumber) {
    c.setPlayerState('hamoRemovedStages', {}); c.setPlayerState('hamoRemovedTimers', []);
    c.setPlayerState('hamoRemovalSnapshotRound', c.roundNumber);
  }
  if (event === E.STAT_BOOST_CLEARED) {
    const before = c.getPlayerState('hamoRemovedStages') || {};
    const next = { ...before };
    for (const [k, n] of Object.entries(data.removedStages || {})) next[k] = Math.max(next[k] || 0, Number(n));
    c.setPlayerState('hamoRemovedStages', next);
  } else {
    const before: Timer[] = c.getPlayerState('hamoRemovedTimers') || [];
    c.setPlayerState('hamoRemovedTimers', [...before, ...(data.removed || []).filter((t: Timer) => !t.ownerBattleId || t.ownerBattleId === identity(c.self))]);
  }
}
export function handleHamoSoulMark(c: C, event: E, data?: any): void {
  if (!onField(c)) return;
  if (event === E.ON_ENTRANCE) {
    writeScales(c, ['無色', '無色', '無色']);
    c.setPlayerState('hamoFieldRounds', 0); c.setPlayerState('hamoCycle', 0);
    c.setPlayerState('hamoPendingRemoval', []); c.setPlayerState('hamoProtectionUntil', c.roundNumber + 2);
    c.setPlayerState('hamoHalvingCount', c.getPlayerState('hamoHalvingCount') || 1);
    c.setPlayerState('hamoRemovalSnapshotRound', undefined);
    c.setPlayerState('hamoRestoreRound', undefined); c.setPlayerState('hamoRemovedStages', {}); c.setPlayerState('hamoRemovedTimers', []);
  }
  if (event === E.ON_SWITCH_OUT) {
    writeScales(c, []); c.setPlayerState('hamoPendingRemoval', []);
    c.setPlayerState('hamoRestoreRound', undefined); c.setPlayerState('hamoRemovedStages', {}); c.setPlayerState('hamoRemovedTimers', []);
    c.setPlayerState('hamoRemovalSnapshotRound', undefined);
  }
  if (event === E.ROUND_START) {
    if (c.getPlayerState('hamoRemovalSnapshotRound') !== c.roundNumber) {
      c.setPlayerState('hamoRemovedStages', {}); c.setPlayerState('hamoRemovedTimers', []);
      c.setPlayerState('hamoRemovalSnapshotRound', c.roundNumber);
    }
    c.setPlayerState('hamoLowHealthMode', c.self.currentHp < c.target.currentHp && c.self.currentHp < c.self.maxHp / 2);
    if (has(c, '無色')) {
      c.setPlayerState('hamoProtectionUntil', c.roundNumber + 2);
      if ((c.getPlayerState('hamoFieldRounds') || 0) < 2) {
        c.clearTurnEffectsOf(c.actor); c.clearTurnEffectsOf(c.targetSide);
        clearStages(c, c.actor, true); clearStages(c, c.targetSide, true);
        c.applyStatusWithImmunityCheck(c.targetSide, '害怕', 3);
      }
    }
  }
  if (event === E.BEFORE_SKILL) c.setPlayerState('hamoDawnAbsorbed', false);
  if (event === E.BEFORE_STATUS_APPLY && !c.getPlayerState('hamoLowHealthMode')) data.prevented = true;
  if (event === E.BEFORE_STAT_CHANGE && has(c, '藍色')) {
    const negative = Object.entries(data.changes || {}).filter(([, n]) => Number(n) < 0);
    if (negative.length) {
      data.changes = Object.fromEntries(Object.entries(data.changes).filter(([, n]) => Number(n) >= 0));
      scheduleRemoval(c, '藍色');
    }
  }
  if (event === E.PP_CHANGED && data?.reason === 'clear' && data.emptied?.length && has(c, '綠色')) {
    // 重置不是恢復，不受恢復量降低與PP恢復限制影響。
    c.updateElf(c.actor, { currentHp: c.self.maxHp, skills: c.self.skills.map(s => ({ ...s, pp: getMaxPp(s, c.self) })) });
    scheduleRemoval(c, '綠色');
  }
  if (event === E.TURN_EFFECTS_CLEARED || event === E.STAT_BOOST_CLEARED) captureRemoved(c, event, data);
  if (event === E.BEFORE_DAMAGE) {
    const comp: DamageComputation = data?.damageComp || data;
    if (!comp) return;
    if (!comp.isIncoming) {
      if (isSkillDamageType(comp.damageCategory)) comp.increasePercent += 1.5;
      if (c.skill?.name === '龍神·御天陣' && !c.self.isInherentInvalid && comp.damageCategory === 'skill_attack') {
        comp.reductionPolicy = { ...comp.reductionPolicy, attenuation: 0 };
      }
      return;
    }
    if (isSkillDamageType(comp.damageCategory)) {
      const step = c.getPlayerState('hamoCycle') || 0;
      if (comp.skillType !== cycle[step % 3]) {
        comp.multiplier = 0; raiseDragonCaps(c);
        c.setPlayerState('hamoHalvingCount', (c.getPlayerState('hamoHalvingCount') || 1) + 1);
      } else {
        addDamageReduction(comp, 1 - .5 ** (c.getPlayerState('hamoHalvingCount') || 1));
        const colour = colours[step % 3], next = [...scales(c)];
        if (!next.includes(colour) && next.includes('無色')) {
          next[next.indexOf('無色')] = colour; writeScales(c, next); c.setPlayerState('hamoFieldRounds', 0);
        }
        c.setPlayerState('hamoCycle', step + 1);
      }
      if (c.getPlayerState('hamoLowHealthMode')) comp.limit = Math.min(comp.limit ?? Infinity, 250);
    }
    if (has(c, '紅色') && ['skill_attack', 'fixed', 'percent'].includes(comp.damageCategory)) {
      if (bypassesAttackDefense(comp, 'block') || (comp.damageCategory === 'skill_attack' && c.getOpponentState('ignoreAttackImmunityThisAction'))) return;
      if (comp.multiplier > 0 && comp.base > 0) { comp.multiplier = 0; scheduleRemoval(c, '紅色'); }
    }
  }
  if (event === E.ROUND_END && alive(c.self)) {
    const pending: Colour[] = c.getPlayerState('hamoPendingRemoval') || [];
    c.setPlayerState('hamoPendingRemoval', []);
    for (const colour of pending) if (colour !== '無色' && has(c, colour)) removeScale(c, colour);
    if (c.getPlayerState('hamoRestoreRound') === c.roundNumber) {
      const restored = { ...c.self.statStages }, saved = c.getPlayerState('hamoRemovedStages') || {};
      for (const key of abilityKeys) if (saved[key]) restored[key] = Math.max(restored[key] || 0, saved[key]);
      c.updateElf(c.actor, { statStages: restored });
      for (const timer of c.getPlayerState('hamoRemovedTimers') || []) if (!timersFor(c, c.actor).some(t => t.id === timer.id && t.remaining > 0)) {
        c.addTimerTo(c.actor, { ...timer, lateMoverPending: true }, false);
      }
      c.setPlayerState('hamoRemovedStages', {}); c.setPlayerState('hamoRemovedTimers', []); c.setPlayerState('hamoRestoreRound', undefined);
    }
    c.applyHeal(c.actor, hamoRoundRecovery(c.self.maxHp, c.self.currentHp));
    c.setPlayerState('hamoFieldRounds', (c.getPlayerState('hamoFieldRounds') || 0) + 1);
  }
}

/** Tokens: 固有(雙攻和/龍鱗選系/返還)與附加(條件/目標/行為)分開註冊。 */
const elemental = new Map<string, { colour: Colour; type: string; hit: string; fallback: string }>([
  ['逐波', { colour: '藍色', type: '水', hit: '凍傷', fallback: '冰封' }],
  ['燼世', { colour: '紅色', type: '火', hit: '燒傷', fallback: '焚燼' }],
  ['纏根', { colour: '綠色', type: '草', hit: '中毒', fallback: '感染' }],
]);
export const HAMO_SKILL_TRANSFORMS: Record<string, (c: C, s: Skill) => Skill> = Object.fromEntries(
  ['破曉', ...elemental.keys(), '龍神·御天陣'].map(name => [name, (c: C, s: Skill) => {
    if (c.self.isInherentInvalid) return s;
    if (s.category === '特殊') c.setPlayerState('blkAtkSpatkSum', true);
    const spec = elemental.get(name);
    if (spec) {
      if (has(c, spec.colour)) {
        c.setPlayerState('hamoRestoreRound', c.roundNumber);
        return { ...s, type: getTypeMatchup('龍', c.target.type) > getTypeMatchup(spec.type, c.target.type) ? '龍' : spec.type };
      }
      c.setPlayerState('grantStabThisAction', true);
    }
    if (name === '龍神·御天陣') {
      c.setPlayerState('ignoreDamageLimitThisAction', true); c.setPlayerState('ignoreAttackImmunityThisAction', true);
      c.setPlayerState('minimumTypeMultiplierThisAction', 1);
    }
    return s;
  }]),
);
export const HAMO_DAMAGE_TRANSFORMS: Record<string, (c: C, s: Skill) => Skill> = {
  '破曉': (c, s) => {
    if (!c.self.isInherentInvalid && Math.abs(c.self.calculatedStats.atk - c.self.calculatedStats.spatk) > 200) c.applyPinkDamage(c.targetSide, 200, undefined, undefined, undefined, 'fixed');
    return c.getPlayerState('hamoDawnAbsorbed') && c.self.currentHp > c.self.maxHp / 2 ? { ...s, power: s.power * 2 } : s;
  },
  '龍神·御天陣': (c, s) => (c as any).additionalEffectsEnabled === false ? s : { ...s, power: s.power * (1 + 1.5 * (c.goesFirst === false ? 2 : 1)) },
};
export const HAMO_SKILLS: Record<string, BattleSkillHandler> = {
  '破曉': c => {
    if (c.clearTurnEffectsOf(c.targetSide)) c.applyStatusWithImmunityCheck(c.targetSide, '疲憊', 3);
    if (absorbBoosts(c)) uses(c, c.targetSide, 'physical_damage_double', 2, { incomingPhysicalSkillMultiplier: 2 });
    c.setPlayerState('hamoDawnAbsorbed', true); drain(c, c.target.maxHp / 3, 'percent');
  },
  '逐波': c => {
    c.applyStatChange(c.actor, allStages(has(c, '藍色') ? 2 : 1));
    timed(c, c.actor, 'use_drain_ratio', 5, { afterUseDrainRatio: { ratio: 1 / 3, doubleBelowHalf: true } }, false, 'skill', false);
    timed(c, c.actor, 'skill_priority', 2, { block: { prio: 3 } }, true);
  },
  '燼世': c => {
    const before = { ...c.self.statStages }, drops = Object.fromEntries(abilityKeys.filter(k => (before[k] || 0) < 0).map(k => [k, before[k]]));
    const cleared = clearStages(c, c.actor, false), result = c.applyStatChange(c.targetSide, drops);
    if (!cleared || Object.entries(drops).some(([k, n]) => result?.applied[k] !== n)) c.updateElf(c.targetSide, { type: '龍' });
    timed(c, c.targetSide, 'recovery_block', 3, { recoveryReductionPercent: 1 }, false, 'skill', false);
  },
  '纏根': c => {
    timed(c, c.actor, 'use_heal_equal_damage', 5, { afterUseHealEqualPercent: 1 }, false, 'skill', false);
    timed(c, c.targetSide, 'pp_cost_multiplier', 5, { block: { ppMult: 20 } }, false, 'skill', false);
    // PP吸取使用可被消除的回合類timer，不把技能期限偷換成魂印私有計數。
    timed(c, c.actor, 'round_pp_absorb', 3, { roundPpAbsorb: { amount: 1, doubleWhenLostHalf: true } }, false, 'skill', false);
  },
  '龍神·御天陣': c => {
    if (c.clearTurnEffectsOf(c.targetSide)) drain(c, c.target.maxHp / 3, 'percent');
    absorbBoosts(c, true);
    uses(c, c.targetSide, 'next_skill_invalid', 1, { block: { invalid: 'all', src: '龍神·御天陣' }, invalidFollowup: { rounds: 2, sameCategory: true } });
    const amount = Math.floor(c.self.maxHp * (c.self.currentHp < c.self.maxHp / 2 ? 1 : .5));
    c.applyPinkDamage(c.targetSide, amount, undefined, undefined, undefined, 'percent'); c.applyHeal(c.actor, amount);
  },
};
export const HAMO_AFTER_HIT: Record<string, BattleSkillAfterHitHandler> = Object.fromEntries([...elemental].map(([name, spec]) => [name, (c: C, info: {hit: boolean}) => {
  if (info.hit && !c.applyStatusWithImmunityCheck(c.targetSide, spec.hit, 3).success) c.applyStatusWithImmunityCheck(c.targetSide, spec.fallback, 3);
}]));
export const HAMO_ON_INVALID: Record<string, BattleSkillOnInvalidHandler> = Object.fromEntries([...elemental].map(([name, spec]) => [name, (c: C) => {
  if (!requestSkillRecalculation(c, { powerMultiplier: 2 })) return;
  c.clearTurnEffectsOf(c.targetSide);
  if (has(c, spec.colour)) c.applyStatusWithImmunityCheck(c.targetSide, spec.fallback, 3);
}]));
