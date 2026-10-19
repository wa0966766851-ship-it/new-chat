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
  // 5035 魂印「鱗」已遷真 Kit（migratedHamoLinSoulKit.ts；DSH 20261018）——規則3.3 空殼化。
  return;
}

/** 龍鱗三系的屬性／異常對照（逐波=水/藍、燼世=火/紅、纏根=草/綠）。 */
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
  // 逐波已遷真 Kit（migratedHamoElementalKits.ts；DSH 20261018）——規則3.3 由技能表移除。
  // 燼世已遷真 Kit（migratedHamoElementalKits.ts；DSH 20261018）——規則3.3 由技能表移除。
  // 纏根已遷真 Kit（migratedHamoElementalKits.ts；DSH 20261018）——規則3.3 由技能表移除。
};
// 命中異常及失敗替代異常也已由技能 Kit 執行，禁止在傷害後重播一次。
export const HAMO_AFTER_HIT: Record<string, BattleSkillAfterHitHandler> = {};
// 三招無效分支由 on_invalid Kit 的 recalculate_skill 執行，不能再重播舊路徑。
export const HAMO_ON_INVALID: Record<string, BattleSkillOnInvalidHandler> = {};
