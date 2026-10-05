import type { Elf } from '../types';
import type { BattleState } from '../components/BattleManager';
import type { DamageComputation } from '../effects/types';
import { matchesDamageTypes } from '../effects/damageChoices';
import { StatusRegistry } from '../effects/statusRegistry';
import { getStatuses } from '../utils/battleHelpers';
import { markAppliesToElf } from './marks';
import { activeConstraints } from './timedConstraints';
import { isNonTrueDamageType, isSkillDamageType, normalizeDamageType } from './damageSemantics';

export interface ReductionPolicy { override?: number; attenuation: number }
type ReductionComp = Pick<DamageComputation, 'damageCategory' | 'multiplier' | 'decreasePercent' | 'pure'> & { reductionPolicy?: ReductionPolicy; reductionSources?: Record<string, number> };

/** 僅改寫「持有者受到傷害降低」；不改造成傷害降低、抵擋、攻擊值、上限或護盾。 */
export function reductionPolicy(state: Pick<BattleState, 'p1Timers' | 'p2Timers' | 'p1Marks' | 'p2Marks'>, side: 'p1' | 'p2', elf: Elf, category: string): ReductionPolicy {
  const type = normalizeDamageType({ damageType: category });
  const overrides = isNonTrueDamageType(type) ? activeConstraints(state[`${side}Timers`], elf)
    .map(p => p.damageReductionOverridePercent).filter((n): n is number => Number.isFinite(n)) : [];
  let attenuation = 1;
  if (type === 'skill_attack' && Object.keys(getStatuses(elf)).some(s => StatusRegistry[s]?.mechanics?.some(m => m.params?.reduceDmgEffectToZero))) attenuation = 0;
  if (isSkillDamageType(type)) for (const mark of state[`${side}Marks`] || []) {
    if (mark.id === 'blk_千秋一淚' && markAppliesToElf(mark, elf)) attenuation *= 0.5 ** Math.floor(Math.max(0, mark.count) / 2);
  }
  return { override: overrides.length ? Math.max(...overrides) / 100 : undefined, attenuation };
}

export function effectiveReduction(comp: ReductionComp, rate: number, incoming = true): number {
  if (comp.pure || normalizeDamageType({ damageType: comp.damageCategory }) === 'true') return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0; // 無減傷觸發時不能憑空生出99%。
  return Math.min(1, Math.max(0, (incoming ? comp.reductionPolicy?.override ?? rate : rate)
    * (incoming ? comp.reductionPolicy?.attenuation ?? 1 : 1)));
}

export function addDamageReduction(comp: ReductionComp, rate: number, incoming = true, sourceKey?: string): number {
  const effective = effectiveReduction(comp, rate, incoming);
  if (!effective) return 0;
  const current = Math.min(1, Math.max(0, comp.decreasePercent || 0));
  if (sourceKey) {
    const sources = comp.reductionSources ||= {};
    const previousRaw = sources[sourceKey] || 0;
    const previous = effectiveReduction(comp, previousRaw, incoming);
    sources[sourceKey] = Math.min(1, previousRaw + rate);
    const combined = effectiveReduction(comp, sources[sourceKey], incoming);
    comp.decreasePercent = previous >= 1 ? 1 : current === 0 ? combined : 1 - (1 - current) / (1 - previous) * (1 - combined);
  } else {
    // 不同来源不能累加至100%假免傷；各自作用於剩餘傷害。
    comp.decreasePercent = current === 0 ? effective : 1 - (1 - current) * (1 - effective);
  }
  return effective;
}

export function multiplyDamageReduction(comp: ReductionComp, multiplier: number, incoming = true): number {
  const effective = effectiveReduction(comp, 1 - multiplier, incoming);
  comp.multiplier *= 1 - effective;
  return effective;
}

/** 陣營印記在所有傷害入口共用，不依賴原施加精靈目前是否在場。 */
export function applyMarkDamageReductions(comp: DamageComputation, state: Pick<BattleState, 'p1Marks' | 'p2Marks'>, side: 'p1' | 'p2', elf: Elf): void {
  if (comp.pure) return;
  for (const mark of state[`${side}Marks`] || []) {
    if (!markAppliesToElf(mark, elf) || mark.count <= 0) continue;
    if (mark.id === 'demon_grudge' && comp.damageCategory === 'skill_attack') addDamageReduction(comp, mark.count * 0.05);
  }
}

/** 門檻以其他增減傷與固定點數減免完成後的值判斷，不以未加成基礎值判斷。 */
export function applyThresholdDamageReductions(comp: DamageComputation, state: Pick<BattleState, 'p1Marks' | 'p2Marks'>, side: 'p1' | 'p2', elf: Elf): void {
  if (comp.pure) return;
  for (const mark of state[`${side}Marks`] || []) {
    if (!markAppliesToElf(mark, elf) || mark.count <= 0) continue;
    const rule = mark.effects?.thresholdDamageReduction;
    if (rule && matchesDamageTypes(rule.damageTypes, comp.damageCategory)
      && Math.max(0, comp.base * (1 + comp.increasePercent) * Math.max(0, 1 - comp.decreasePercent) * comp.multiplier - (comp.flatReduction || 0)) > mark.count * rule.thresholdRatio) {
      multiplyDamageReduction(comp, rule.multiplier);
    }
  }
}

/** 清空後再執行，避免同一筆傷害的終段被重複觸發。 */
export function finalizeDamageReductions(comp: DamageComputation, state: Pick<BattleState, 'p1Marks' | 'p2Marks'>, side: 'p1' | 'p2', elf: Elf): void {
  const hooks = comp.beforeFinalDamage || [];
  comp.beforeFinalDamage = [];
  for (const hook of hooks) hook();
  applyThresholdDamageReductions(comp, state, side, elf);
}

/** 異常增減傷在攻擊、X系、額外行動、固定／百分比API共用；每節點只跑一次。 */
export function applyStatusDamageModifiers(comp: DamageComputation, actor: Elf, target: Elf): void {
  if (comp.pure) return;
  for (const [elf, incoming] of [[actor, false], [target, true]] as const) for (const status of Object.keys(getStatuses(elf))) {
    for (const m of StatusRegistry[status]?.mechanics || []) {
      if (m.type !== 'SPECIAL_BUFF') continue;
      const p = m.params || {};
      const mult = incoming ? p.damageTakenMultiplier : p.damageDealtMultiplier;
      if (typeof mult === 'number' && matchesDamageTypes(p.damageTypes, comp.damageCategory)) {
        if (mult < 1) multiplyDamageReduction(comp, mult, incoming); else comp.multiplier *= mult;
      }
      const nonTrue = incoming ? p.nonTrueDmgTakenMultiplier : p.nonTrueDmgDealtMultiplier;
      if (typeof nonTrue === 'number' && isNonTrueDamageType(comp.damageCategory)) {
        if (nonTrue < 1) multiplyDamageReduction(comp, nonTrue, incoming); else comp.multiplier *= nonTrue;
      }
      const fixed = incoming ? p.fixedPercentDmgTakenMultiplier : p.fixedDmgMultiplier;
      if (typeof fixed === 'number' && ['fixed', 'percent'].includes(comp.damageCategory)) {
        if (fixed < 1) multiplyDamageReduction(comp, fixed, incoming); else comp.multiplier *= fixed;
      }
      if (!incoming && p.damageDealtImmuned && ['skill_attack', 'fixed', 'percent'].includes(comp.damageCategory)) comp.multiplier = 0;
    }
  }
}
