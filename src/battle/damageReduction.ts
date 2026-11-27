import {markCapability} from './markCapabilities';
import {heldModifiers} from './heldItemModifiers';
import type { Elf } from '../types';
import type { BattleState } from '../components/BattleManager';
import type { DamageComputation } from '../effects/types';
import { matchesDamageTypes } from '../effects/damageChoices';
import { StatusRegistry } from '../effects/statusRegistry';
import { getStatuses, getEffectiveStatuses } from '../utils/battleHelpers';
import { markAppliesToElf,MARK_DEFINITIONS } from './marks';
import { activeConstraints } from './timedConstraints';
import { isNonTrueDamageType, isSkillDamageType, normalizeDamageType } from './damageSemantics';
import {markDamageReductionRate} from './markDamageReduction';

export interface ReductionPolicy { override?: number; attenuation: number; skillDefenseDisabled?:boolean; incomingDamageLimitDisabled?:boolean }
type ReductionComp = Pick<DamageComputation, 'damageCategory' | 'multiplier' | 'decreasePercent' | 'pure'> & { trackReduction?:boolean; multiplierReductionProduct?:number; incomingDamageImmunity?:boolean; reductionPolicy?: ReductionPolicy; reductionSources?: Record<string, number> };

/** 受方減傷與上限失效分開查詢；不改造成傷害降低、輸出上限、抵擋、攻擊值或護盾。 */
export function reductionPolicy(state: Pick<BattleState, 'p1Timers' | 'p2Timers' | 'p1Marks' | 'p2Marks'>, side: 'p1' | 'p2', elf: Elf, category: string): ReductionPolicy {
  const type = normalizeDamageType({ damageType: category });
  const overrides = isNonTrueDamageType(type) ? activeConstraints(state[`${side}Timers`], elf)
    .map(p => p.damageReductionOverridePercent).filter((n): n is number => Number.isFinite(n)) : [];
  let attenuation = 1;
  const held=heldModifiers(state,side,elf);
  if(isNonTrueDamageType(type)&&held.some(m=>m.reductionDisabled))attenuation=0;
  if (type === 'skill_attack' && Object.keys(getStatuses(elf)).some(s => StatusRegistry[s]?.mechanics?.some(m => m.params?.reduceDmgEffectToZero))) attenuation = 0;
  if (isSkillDamageType(type)) for (const mark of state[`${side}Marks`] || []) {
    if (mark.id === 'blk_千秋一淚' && markAppliesToElf(mark, elf)) attenuation *= 0.5 ** Math.floor(Math.max(0, mark.count) / 2);
  }
  return { incomingDamageLimitDisabled:isNonTrueDamageType(type)&&(held.some(m=>m.incomingLimitDisabled)||!!markCapability(elf,'incomingDamageLimitDisabled',state[`${side}Marks`])), skillDefenseDisabled:isSkillDamageType(type)&&!!markCapability(elf,"skillDefenseDisabled",state[`${side}Marks`]), override: overrides.length ? Math.max(...overrides) / 100 : undefined, attenuation };
}

/** 只取消持有者的受傷上限；輸出上限、抵擋、減傷、護盾及真實傷害規則不變。 */
export function limitIncomingDamage(comp:Pick<DamageComputation,'limit'|'reductionPolicy'>,amount:number):number {
  return comp.limit!==undefined&&!comp.reductionPolicy?.incomingDamageLimitDisabled?Math.min(amount,comp.limit):amount;
}

export function effectiveReduction(comp: ReductionComp, rate: number, incoming = true): number {
  if (comp.pure || normalizeDamageType({ damageType: comp.damageCategory }) === 'true') return 0;
  if(incoming&&rate>=1&&comp.reductionPolicy?.skillDefenseDisabled)return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0; // 無減傷觸發時不能憑空生出99%。
  return Math.min(1, Math.max(0, (incoming ? comp.reductionPolicy?.override ?? rate : rate)
    * (incoming ? comp.reductionPolicy?.attenuation ?? 1 : 1)));
}

export function addDamageReduction(comp: ReductionComp, rate: number, incoming = true, sourceKey?: string): number {
  const effective = effectiveReduction(comp, rate, incoming);
  if (!effective) return 0;
  if(incoming&&effective===1)comp.incomingDamageImmunity=true;
  const current = Math.min(1, Math.max(0, comp.decreasePercent || 0));
  if (sourceKey) {
    const sources = comp.reductionSources ||= {};
    const previousRaw = sources[sourceKey] || 0;
    const previous = effectiveReduction(comp, previousRaw, incoming);
    sources[sourceKey] = Math.min(1, previousRaw + rate);
    const combined = effectiveReduction(comp, sources[sourceKey], incoming);
    if(incoming&&combined===1)comp.incomingDamageImmunity=true;
    comp.decreasePercent = previous >= 1 ? 1 : current === 0 ? combined : 1 - (1 - current) / (1 - previous) * (1 - combined);
  } else {
    // 不同来源不能累加至100%假免傷；各自作用於剩餘傷害。
    comp.decreasePercent = current === 0 ? effective : 1 - (1 - current) * (1 - effective);
  }
  return effective;
}

export function multiplyDamageReduction(comp: ReductionComp, multiplier: number, incoming = true): number {
  const effective = effectiveReduction(comp, 1 - multiplier, incoming);
  let retained=1-effective;
  // Preserve tiny positive retention directly: 1-(1-1e-20) rounds to zero and falsely
  // marks multiplicative reduction as damage immunity. Overrides retain their own semantics.
  if(multiplier>0&&multiplier<1&&!comp.pure&&normalizeDamageType({damageType:comp.damageCategory})!=='true'
    && (!incoming||comp.reductionPolicy?.override===undefined)){
    const attenuation=incoming?comp.reductionPolicy?.attenuation??1:1;
    retained=Math.min(1,Math.max(0,1-attenuation+attenuation*multiplier));
  }
  if(incoming&&retained===0)comp.incomingDamageImmunity=true;
  if(comp.trackReduction&&retained===0)comp.decreasePercent=1;
  else {
    comp.multiplier*=retained;
    if(comp.trackReduction)comp.multiplierReductionProduct=(comp.multiplierReductionProduct??1)*retained;
  }
  return effective;
}

/** 陣營印記在所有傷害入口共用，不依賴原施加精靈目前是否在場。 */
export function applyMarkDamageReductions(comp: DamageComputation, state: Pick<BattleState, 'p1Marks' | 'p2Marks'>, side: 'p1' | 'p2', elf: Elf): void {
  if (comp.pure) return;
  for (const mark of state[`${side}Marks`] || []) {
    if (!markAppliesToElf(mark, elf) || mark.count <= 0) continue;
    const rule=mark.effects?.incomingDamageReduction ?? MARK_DEFINITIONS[mark.id]?.effects?.incomingDamageReduction;
    const scopes={攻擊:'attack',技能:'skill',非真實:'non_true',固定:'fixed',百分比:'percent'};
    if(rule&&matchesDamageTypes([scopes[rule.kind]],comp.damageCategory))
      addDamageReduction(comp,markDamageReductionRate(rule,mark.count));
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
  // 2026-10-31：STATUS_HIT_RELEASE —— 累計受到 N 次技能傷害時解除該異常。
  // 目前用於「山神守護：累計受到2次技能傷害時解除」。
  // 以 comp.statusHitMarked 避免同一次傷害重複計數（多段傷害仍算一次技能）。
  // 計數由引擎在「實際扣血後」統一累加（見 battleEngine STATUS_HIT_RELEASE 區塊），
  // 這裡不再自行計數，避免同一回合多次呼叫造成重複。
  for (const [elf, incoming] of [[actor, false], [target, true]] as const) for (const status of Object.keys(getEffectiveStatuses(elf))) {
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
