import { matchesDamageTypes } from '../effects/damageChoices';
import { capCurrentHp } from './hpCeiling';
import { applyAdvancedDamageModifiers, applyOutgoingSkillRestriction } from './advancedDamageModifiers';
import { reductionPolicy, multiplyDamageReduction, applyStatusDamageModifiers, applyMarkDamageReductions, finalizeDamageReductions } from './damageReduction';
import { activeConstraints } from './timedConstraints';
import { attackDefenseBypass, applyAttackDefenseLimit } from './attackDefense';
import { skillTypeMultiplier } from './skillTypeOverride';
import { queueSkillLifesteal } from './lifesteal';
import type { SettlementOptions } from './settlementReceipt';
import { combineSettlementCallbacks } from './settlementReceipt';
import { isNonTrueDamageType, normalizeDamageType } from './damageSemantics';
import React, { MutableRefObject, Dispatch } from "react";
import { Elf, Skill } from "../types";
import { Mark, bindMarkToElf, markAppliesToElf } from "./marks";
import { BattleState, BattleAction, EffectItem } from "../components/BattleManager";
import { BattleEventContext, EffectTiming, DamageComputation, PriorityComputation } from "../effects/types";
import { Timer } from "./timers";
import { readScopedRegistry, writeScopedRegistry, addScopedTimer, setBattleSideMarks } from "./stateScopes";
import { getTypeMatchup } from "../utils/statCalculator";
import { emitStatusApplied, blockStatusGuard } from "../blocks/registry";
import { SoulMarkRegistry } from "../effects/battleEventRegistry";
import { SuitEffectRegistry } from "../effects/suitEffectRegistry";
import { runRelicEffects } from "../effects/relicEffectRegistry";
import { applyStatChanges } from "../utils/statChangeManager";
import { TraitsEngine } from "../utils/traitsEngine";
import { getStatuses, shuffleArray, clampSkillPp } from "../utils/battleHelpers";
import { StatusRegistry } from "../effects/statusRegistry";
import { canonicalStatusName } from '../effects/statusIdentity';
import { hasStoneThrowerMythic } from '../data/skillStones';
import { applyActiveGateTimersToDamage } from './damageGates';
export { applyActiveGateTimersToDamage } from './damageGates';
import { clearTurnEffects, hasTurnEffect, addTimer } from "./timers";
import { setMark as setMarkUtil, clearMark as clearMarkUtil } from "./marks";
import { getEligibleTeam, getFirstStarter, getNthElf, getAdjacentElves, getSeparatedElves } from "./elfPositions";

// 反彈規則：反彈只發生一次；「被反彈過來」的異常不再觸發任何反彈／攔截（避免雙方互彈無限迴圈）
// BEFORE_DAMAGE 的 extraData 過去有兩種形狀（{ damageComp } 與 damageComp 本身），
// handler 讀錯形狀會直接拋錯中斷整個回合；這裡讓兩種讀法都成立。
function withSelfRef<T extends object>(comp: T): T & { damageComp: T } {
  (comp as any).damageComp = comp;
  return comp as any;
}

let _reflectingStatus = false;
let _reflectHookDepth = 0; // >0 代表目前正在「反彈／攔截」流程中，此時套用的異常即為被反彈過來的
let _statusApplyDepth = 0;
let _secondaryDamageDepth = 0;
let _immunizedNotifyDepth = 0;

export interface SharedContextDeps {
  side: "p1" | "p2";
  isHit: boolean;
  moveIndex?: number;
  syncStateRef: MutableRefObject<BattleState>;
  dispatch: Dispatch<BattleAction>;
  pushEffect: (effect: EffectItem) => void;
  getBattleEventContext: (side: "p1" | "p2", isHit?: boolean, moveIndex?: number, selfElf?: Elf, isEntranceTurn?: boolean) => BattleEventContext;
  
  // Derived vars
  isP1: boolean;
  targetSide: "p1" | "p2";
  self: Elf;
  opp: Elf;
  skill: Skill | null;
}

export type DamageAPIs = Pick<BattleEventContext, "applyPinkDamage" | "applyTrueDamage" | "applySkillTypeDamage" | "applyAbsorb" | "applyHeal" | "adjustHp" | "applyPercentDamage" | "applyFixedDamage">;
export type StatusAPIs = Pick<BattleEventContext, "applyStatusWithImmunityCheck" | "getStatuses" | "clearTurnEffectsOf" | "hasTurnEffectOn" | "applyStatChange" | "applyShield">;
export type StateAPIs = Pick<BattleEventContext, 
  "applyDeathImmunity" | "vanishElf" | "addExtraElf" | "setMark" | "clearMark" | "getMarks" | "addTimerTo" | "consumeTimer" | "queueExtraAction" | "updateElf" | "updateAnyElf" | 
  "getPlayerState" | "setPlayerState" | "getOpponentState" | "setOpponentState" |
  "shuffleArray" | "getEligibleTeam" | "getFullTeam" | "getFirstStarter" | "getNthElf" | "getAdjacentElves" | "getSeparatedElves" | "trackCodeExec" | "setNextTurns"
>;

/** 附加傷害也通知造成者；兩個方向使用同一分類。 */
function runDamageHooks(shared: SharedContextDeps, targetSide: 'p1' | 'p2', comp: DamageComputation): void {
  if (targetSide !== shared.side) comp.attackDefenseBypass = attackDefenseBypass(shared.self, {
    attackDefenseBypassUntilSwitch: readScopedRegistry(shared.syncStateRef.current, shared.side, shared.self, 'attackDefenseBypassUntilSwitch'),
  }, comp.damageCategory);
  comp.reductionPolicy = reductionPolicy(shared.syncStateRef.current, targetSide, shared.syncStateRef.current[targetSide], comp.damageCategory);
  if (comp.pure) return;
  if (_secondaryDamageDepth > 0) {
    applyMarkDamageReductions(comp, shared.syncStateRef.current, targetSide, shared.syncStateRef.current[targetSide]);
    return;
  }
  _secondaryDamageDepth++;
  try {
    const state = shared.syncStateRef.current;
    for (const [owner, incoming] of [[shared.side, false], [targetSide, true]] as const) {
      if (incoming) {
        applyMarkDamageReductions(comp, shared.syncStateRef.current, targetSide, shared.syncStateRef.current[targetSide]);
        applyAdvancedDamageModifiers(comp, state[shared.side], state[targetSide]);
        applyOutgoingSkillRestriction(comp, state[`${shared.side}RegistryState`] || {});
      }
      comp.isIncoming = incoming;
      const handler = SoulMarkRegistry[state[owner].name];
      const suit = state[owner === 'p1' ? 'p1Suit' : 'p2Suit'];
      const relics = owner === 'p1' ? state.p1Relics : state.p2Relics;
      if (handler || (suit && SuitEffectRegistry[suit]) || relics?.length) {
        const ctx = shared.getBattleEventContext(owner, true, shared.moveIndex);
        handler?.(ctx, EffectTiming.BEFORE_DAMAGE, withSelfRef(comp));
        if (suit) SuitEffectRegistry[suit]?.(ctx, EffectTiming.BEFORE_DAMAGE, withSelfRef(comp));
        runRelicEffects(relics, ctx, EffectTiming.BEFORE_DAMAGE, withSelfRef(comp));
      }
    }
  } finally { comp.isIncoming = true; _secondaryDamageDepth--; }
}

export function buildDamageAPIs(shared: SharedContextDeps): DamageAPIs {
  const { side, moveIndex, syncStateRef, pushEffect, getBattleEventContext, self } = shared;
  
  return {
    applyPinkDamage: (tSide, amt, label, aP1, aP2, dmgType, opts?: { pure?: boolean } & SettlementOptions) => {
      const c = syncStateRef.current;
      const tOpp = tSide === "p1" ? c.p1 : c.p2;
      if (['fixed', 'percent'].includes(normalizeDamageType({ damageType: dmgType || 'fixed' })) && activeConstraints(c[`${tSide}Timers`], tOpp).some(p => p.fixedPercentAsTrue)) return buildDamageAPIs(shared).applyTrueDamage(tSide, amt, label, undefined, undefined, opts);
      let baseVal = Math.floor(amt);

      // 屬性克制只影響攻擊技能的直接傷害；固定／百分比傷害不吃克制倍率
      void dmgType;

      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        // 中文標籤（「百分比傷害」等）正規化，否則會被視為未知分類而略過非真實傷害倍率
        damageCategory: normalizeDamageType({ damageType: dmgType || "fixed" }) as any,
        skillType: self.type,
        isIncoming: true,
        // 保底類獨立乘區：通用增減傷段全部跳過，自帶鏈與 floor 不受影響
        pure: !!opts?.pure,
      } as any;

      runDamageHooks(shared, tSide, damageComp);
      applyStatusDamageModifiers(damageComp, syncStateRef.current[side], syncStateRef.current[tSide]);

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = side;
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      if (!damageComp.pure && isNonTrueDamageType(damageComp.damageCategory)) for (const mark of actorMarks.filter(mark => markAppliesToElf(mark, syncStateRef.current[actorSide]))) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          if (mark.effects.nonTrueDamageDealtMultiplier < 1) multiplyDamageReduction(damageComp, mark.effects.nonTrueDamageDealtMultiplier, false);
          else damageComp.multiplier = (damageComp.multiplier ?? 1.0) * mark.effects.nonTrueDamageDealtMultiplier;
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的非真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      // Scan target's marks for nonTrueDamageTakenMultiplier
      const oppMarksAll = tSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
      if (!damageComp.pure && isNonTrueDamageType(damageComp.damageCategory)) for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[tSide]))) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0 && matchesDamageTypes(mark.effects.damageTakenTypes, damageComp.damageCategory)) {
          if (mark.effects.nonTrueDamageTakenMultiplier < 1) multiplyDamageReduction(damageComp, mark.effects.nonTrueDamageTakenMultiplier);
          else damageComp.multiplier = (damageComp.multiplier ?? 1.0) * mark.effects.nonTrueDamageTakenMultiplier;
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的非真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      if (!damageComp.pure && isNonTrueDamageType(damageComp.damageCategory)) for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[tSide]))) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (damageComp.damageCategory === "skill_attack" && perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      if (!damageComp.pure) applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef, { side, moveIndex });

      applyAttackDefenseLimit(damageComp);
      finalizeDamageReductions(damageComp, syncStateRef.current, tSide, syncStateRef.current[tSide]);
      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * Math.max(0, 1 - damageComp.decreasePercent);
      const stage2 = Math.max(0, stage1 * damageComp.multiplier - (damageComp.flatReduction || 0));
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.min(damageComp.outgoingLimit ?? Infinity, Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3)));

      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, requestedAmount: amt, onSettled: combineSettlementCallbacks(opts?.onSettled, damageComp.afterDamage), label: label || "附加傷害", popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: damageComp.damageCategory, attackDefenseBypass: damageComp.attackDefenseBypass, reductionPolicy: damageComp.reductionPolicy, ignoreShield: !!damageComp.attackDefenseBypass?.shield } });
      return finalDamage;
    },
    applySkillTypeDamage: (tSide, amt, label, opts) => {
      const c = syncStateRef.current;
      const tOpp = tSide === "p1" ? c.p1 : c.p2;
      let baseVal = Math.floor(amt);

      // 「X系技能傷害」以該屬性計算克制（未指定時用自身屬性）
      const elemType = opts?.elem || self.type;
      let typeMultiplier: number | undefined;
      if (elemType && tOpp.type) {
        const typeMult = skillTypeMultiplier(c[`${side}RegistryState`], elemType, tOpp.type);
        typeMultiplier = typeMult;
        baseVal = Math.floor(baseVal * typeMult);
      }

      const damageCategory = opts?.category || "skill_attribute";
      const damageNode = opts?.node || (damageCategory === "skill_extra_action" ? "extra_action" : "skill_effect");
      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory,
        damageNode,
        skillType: elemType,
        isTypedSkill: damageCategory === "skill_attribute", // X系技能傷害（非攻擊公式）
        isIncoming: true,
        // 保底類獨立乘區（opts.pure）：克制照吃，通用增減傷段全部跳過
        pure: !!(opts as any)?.pure,
      } as any;

      runDamageHooks(shared, tSide, damageComp);
      applyStatusDamageModifiers(damageComp, syncStateRef.current[side], syncStateRef.current[tSide]);

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = side;
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      if (!damageComp.pure && isNonTrueDamageType(damageComp.damageCategory)) for (const mark of actorMarks.filter(mark => markAppliesToElf(mark, syncStateRef.current[actorSide]))) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          if (mark.effects.nonTrueDamageDealtMultiplier < 1) multiplyDamageReduction(damageComp, mark.effects.nonTrueDamageDealtMultiplier, false);
          else damageComp.multiplier = (damageComp.multiplier ?? 1.0) * mark.effects.nonTrueDamageDealtMultiplier;
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的非真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      // Scan target's marks for nonTrueDamageTakenMultiplier
      const oppMarksAll = tSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
      if (!damageComp.pure && isNonTrueDamageType(damageComp.damageCategory)) for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[tSide]))) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0 && matchesDamageTypes(mark.effects.damageTakenTypes, damageComp.damageCategory)) {
          if (mark.effects.nonTrueDamageTakenMultiplier < 1) multiplyDamageReduction(damageComp, mark.effects.nonTrueDamageTakenMultiplier);
          else damageComp.multiplier = (damageComp.multiplier ?? 1.0) * mark.effects.nonTrueDamageTakenMultiplier;
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的非真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      if (!damageComp.pure && isNonTrueDamageType(damageComp.damageCategory)) for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[tSide]))) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (damageComp.damageCategory === "skill_attack" && perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      if (!damageComp.pure) applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef, { side, moveIndex });

      // 無視對手抵擋傷害（乘區被歸零）／無視傷害限制／保底傷害
      if (opts?.ignoreBlock && damageComp.multiplier === 0) damageComp.multiplier = 1;
      if (opts?.ignoreLimit) delete damageComp.limit;
      if (opts?.floor !== undefined) damageComp.floor = Math.max(damageComp.floor ?? 0, Math.floor(opts.floor));

      finalizeDamageReductions(damageComp, syncStateRef.current, tSide, syncStateRef.current[tSide]);
      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * Math.max(0, 1 - damageComp.decreasePercent);
      const stage2 = Math.max(0, stage1 * damageComp.multiplier - (damageComp.flatReduction || 0));
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.min(damageComp.outgoingLimit ?? Infinity, Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3)));

      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, reductionPolicy: damageComp.reductionPolicy, onSettled: damageComp.afterDamage, label: label || "附加技能傷害", popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: damageCategory, damageNode, typedSkill: damageCategory === "skill_attribute", ignoreShield: !!opts?.ignoreShield, typeMultiplier } });
      if (tSide !== side) queueSkillLifesteal(side, finalDamage, damageCategory, syncStateRef.current[`${side}RegistryState`], pushEffect);
      return finalDamage;
    },
    applyTrueDamage: (tSide, amt, label, p1Override, p2Override, opts) => {
      const cur = syncStateRef.current;
      const tOpp = tSide === "p1" ? (p1Override || cur.p1) : (p2Override || cur.p2);
      const baseVal = Math.floor(amt);

      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: "true",
        isIncoming: true
      } as any;

      runDamageHooks(shared, tSide, damageComp);
      applyStatusDamageModifiers(damageComp, syncStateRef.current[side], syncStateRef.current[tSide]);

      const actorSide = side;
      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef, { side, moveIndex });

      // 真實傷害不受減傷與減縮影響，僅接受增傷
      const safeDecreasePercent = 0;
      let safeMultiplier = Math.max(1.0, damageComp.multiplier ?? 1.0);

      const stage1 = damageComp.base * (1 + (damageComp.increasePercent || 0)) * (1 - safeDecreasePercent);
      const stage2 = stage1 * safeMultiplier;
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.min(damageComp.outgoingLimit ?? Infinity, Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3)));

      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, reductionPolicy: damageComp.reductionPolicy, requestedAmount: amt, onSettled: combineSettlementCallbacks(opts?.onSettled, damageComp.afterDamage), label, popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: "true" } });
      return finalDamage;
    },
    applyAbsorb: (tSide, amt, label = "汲取") => {
      const val = Math.floor(amt);
      const actorSide = side; 
      const actualDmg = getBattleEventContext(actorSide, true, moveIndex).applyTrueDamage(tSide, val, label);
      getBattleEventContext(actorSide, true, moveIndex).applyHeal(actorSide, actualDmg);
    },
    applyHeal: (tSide, amt, opts) => pushEffect({ type: 'heal', side: tSide, data: { amount: Math.floor(amt), onSettled: opts?.onSettled } }),
    adjustHp: (tSide, amt) => pushEffect({ type: 'adjust_hp', side: tSide, data: { amount: Math.floor(amt) } }),
    applyPercentDamage: (tSide, p) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      const baseVal = Math.floor(target.maxHp * p);
      if (activeConstraints(c[`${tSide}Timers`], target).some(p => p.fixedPercentAsTrue)) return buildDamageAPIs(shared).applyTrueDamage(tSide, baseVal);

      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: "percent",
        isIncoming: true
      } as any;

      runDamageHooks(shared, tSide, damageComp);
      applyStatusDamageModifiers(damageComp, syncStateRef.current[side], syncStateRef.current[tSide]);

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = side;
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      for (const mark of actorMarks.filter(mark => markAppliesToElf(mark, syncStateRef.current[actorSide]))) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          if (mark.effects.nonTrueDamageDealtMultiplier < 1) multiplyDamageReduction(damageComp, mark.effects.nonTrueDamageDealtMultiplier, false);
          else damageComp.multiplier = (damageComp.multiplier ?? 1.0) * mark.effects.nonTrueDamageDealtMultiplier;
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的非真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      const actorRegKey = `${actorSide}RegistryState` as 'p1RegistryState' | 'p2RegistryState';
      const actorRegState = c[actorRegKey] || {};
      if (actorRegState.DarkScarTurns > 0) {
        damageComp.multiplier = (damageComp.multiplier ?? 1.0) * 0.5;
        pushEffect({
          type: 'log',
          side: actorSide,
          data: {
            text: `🚫 【黯痕】：造成的百分比與固定傷害減半！`,
            type: "effect"
          }
        });
      }

      // Scan target's marks for nonTrueDamageTakenMultiplier
      const oppMarksAll = tSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
      for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[tSide]))) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0 && matchesDamageTypes(mark.effects.damageTakenTypes, damageComp.damageCategory)) {
          if (mark.effects.nonTrueDamageTakenMultiplier < 1) multiplyDamageReduction(damageComp, mark.effects.nonTrueDamageTakenMultiplier);
          else damageComp.multiplier = (damageComp.multiplier ?? 1.0) * mark.effects.nonTrueDamageTakenMultiplier;
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的非真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[tSide]))) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (damageComp.damageCategory === "skill_attack" && perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef, { side, moveIndex });

      finalizeDamageReductions(damageComp, syncStateRef.current, tSide, syncStateRef.current[tSide]);
      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * Math.max(0, 1 - damageComp.decreasePercent);
      const stage2 = Math.max(0, stage1 * damageComp.multiplier - (damageComp.flatReduction || 0));
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.min(damageComp.outgoingLimit ?? Infinity, Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3)));

      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, reductionPolicy: damageComp.reductionPolicy, onSettled: damageComp.afterDamage, label: "百分比傷害", popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: "percent" } });
      return finalDamage;
    },
    applyFixedDamage: (tSide, amt, label) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      if (activeConstraints(c[`${tSide}Timers`], target).some(p => p.fixedPercentAsTrue)) return buildDamageAPIs(shared).applyTrueDamage(tSide, amt, label);
      const baseVal = Math.floor(amt);

      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: "fixed",
        isIncoming: true
      } as any;

      runDamageHooks(shared, tSide, damageComp);
      applyStatusDamageModifiers(damageComp, syncStateRef.current[side], syncStateRef.current[tSide]);

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = side;
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      for (const mark of actorMarks.filter(mark => markAppliesToElf(mark, syncStateRef.current[actorSide]))) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          if (mark.effects.nonTrueDamageDealtMultiplier < 1) multiplyDamageReduction(damageComp, mark.effects.nonTrueDamageDealtMultiplier, false);
          else damageComp.multiplier = (damageComp.multiplier ?? 1.0) * mark.effects.nonTrueDamageDealtMultiplier;
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的非真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      const actorRegKey = `${actorSide}RegistryState` as 'p1RegistryState' | 'p2RegistryState';
      const actorRegState = c[actorRegKey] || {};
      if (actorRegState.DarkScarTurns > 0) {
        damageComp.multiplier = (damageComp.multiplier ?? 1.0) * 0.5;
        pushEffect({
          type: 'log',
          side: actorSide,
          data: {
            text: `🚫 【黯痕】：造成的百分比與固定傷害減半！`,
            type: "effect"
          }
        });
      }

      // Scan target's marks for nonTrueDamageTakenMultiplier
      const oppMarksAll = tSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
      for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[tSide]))) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0 && matchesDamageTypes(mark.effects.damageTakenTypes, damageComp.damageCategory)) {
          if (mark.effects.nonTrueDamageTakenMultiplier < 1) multiplyDamageReduction(damageComp, mark.effects.nonTrueDamageTakenMultiplier);
          else damageComp.multiplier = (damageComp.multiplier ?? 1.0) * mark.effects.nonTrueDamageTakenMultiplier;
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的非真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[tSide]))) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (damageComp.damageCategory === "skill_attack" && perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef, { side, moveIndex });

      finalizeDamageReductions(damageComp, syncStateRef.current, tSide, syncStateRef.current[tSide]);
      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * Math.max(0, 1 - damageComp.decreasePercent);
      const stage2 = Math.max(0, stage1 * damageComp.multiplier - (damageComp.flatReduction || 0));
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.min(damageComp.outgoingLimit ?? Infinity, Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3)));

      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, reductionPolicy: damageComp.reductionPolicy, onSettled: damageComp.afterDamage, label: label || "固定傷害", popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: "fixed" } });
      return finalDamage;
    },
  };
}

export function buildStatusAPIs(shared: SharedContextDeps): StatusAPIs {
  const { side, moveIndex, syncStateRef, dispatch, pushEffect, getBattleEventContext } = shared;
  
  return {
    applyStatusWithImmunityCheck: (tSide, s, d) => {
      // 在免疫、反彈、分類及入庫之前統一歷史代號；不能把 poisoned 等當未知異常。
      s = canonicalStatusName(s);
      // 反彈／轉嫁類效果互相觸發時的遞迴保護（雙方都有「反彈異常」會無限互彈直到堆疊溢位）
      if (_statusApplyDepth >= 3) return { success: false, immune: true };
      // 「本回合執行過附加異常狀態的效果」（砥礪判定用）：對他方附加即記錄，不論成敗。
      if (tSide !== side) {
        const c0 = syncStateRef.current;
        const rk = `${side}RegistryState` as 'p1RegistryState' | 'p2RegistryState';
        syncStateRef.current = { ...c0, [rk]: { ...(c0[rk] || {}), statusAttachTurn: c0.turnNumber } } as any;
      }
      _statusApplyDepth++;
      try { return ((): { success: boolean; immune: boolean } => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      // 通用：異常被免疫時通知受方魂印／套裝（ON_STATUS_IMMUNIZED；反彈不算免疫）
      const notifyImmunized = (reason: string) => {
        if (_immunizedNotifyDepth > 0) return;
        _immunizedNotifyDepth++;
        try {
          const cur = syncStateRef.current;
          const tElf = tSide === 'p1' ? cur.p1 : cur.p2;
          const sId = tSide === 'p1' ? cur.p1Suit : cur.p2Suit;
          const ictx = getBattleEventContext(tSide, true, 0);
          const payload = { status: s, duration: d, targetSide: tSide, sourceSide: side, reason };
          if (sId && SuitEffectRegistry[sId]) SuitEffectRegistry[sId](ictx, EffectTiming.ON_STATUS_IMMUNIZED, payload);
          if (tElf && SoulMarkRegistry[tElf.name]) SoulMarkRegistry[tElf.name](ictx, EffectTiming.ON_STATUS_IMMUNIZED, payload);
        } catch (e) { console.error("[ON_STATUS_IMMUNIZED]", e); }
        finally { _immunizedNotifyDepth--; }
      };

      // Check active gate timers on target side for wraps === "immune"
      const targetTimers = c[`${tSide}Timers` as "p1Timers" | "p2Timers"] || [];
      for (const timer of targetTimers) {
        if (timer.remaining <= 0 || timer.pendingActivation || (timer.scope !== 'team' && timer.ownerBattleId && timer.ownerBattleId !== (target.battleId || target.id))) continue;
        const wraps = Array.isArray(timer.payload?.wraps) ? timer.payload.wraps : [timer.payload?.wraps];
        if (timer.payload?.applyMode === "gate" && wraps.includes("immune")) {
          pushEffect({
            type: 'log',
            side: tSide,
            data: { text: `🛡️ 【${timer.name}】：處於技能免疫狀態，免疫異常狀態！`, type: "info" }
          });
          notifyImmunized("gate");
          return { success: false, immune: true };
        }
      }

      // 通用異常免疫／反彈（immuneStatusTurns 過去只有寫入、從未被讀取，導致各精靈的「免疫異常」效果全部無效）
      if (tSide !== side) {
        const targetRegState = c[`${tSide}RegistryState` as 'p1RegistryState' | 'p2RegistryState'] || {};
        const protectionTimers = targetTimers.filter(t => t.remaining > 0 && !t.pendingActivation &&
          (t.scope === 'team' || !t.ownerBattleId || t.ownerBattleId === (target.battleId || target.id)));
        const acceptsStatus = (t: Timer) => !(t.payload as any)?.excludeStatusCategory ||
          !StatusRegistry[s]?.categories?.includes((t.payload as any).excludeStatusCategory);
        const reflectionTimer = protectionTimers.find(t => t.payload?.reflectStatus && acceptsStatus(t));
        const blkGuard = blockStatusGuard(c[`${tSide}Timers` as "p1Timers" | "p2Timers"], target, s); // 積木：分類異常免疫／反彈
        if (((targetRegState.reflectStatusTurns || 0) > 0 || reflectionTimer || blkGuard === "reflect") && !_reflectingStatus && _reflectHookDepth === 0) {
          if (reflectionTimer?.kind === 'use_counter') getBattleEventContext(tSide, true, 0).consumeTimer?.(tSide, reflectionTimer.id);
          pushEffect({ type: 'log', side: tSide, data: { text: `🔁 【反彈異常】：【${target.name}】將【${s}】反彈給對手！`, type: "effect" } });
          _reflectingStatus = true;
          _reflectHookDepth++;
          try {
            getBattleEventContext(tSide, true, 0).applyStatusWithImmunityCheck(side, s, d);
          } finally {
            _reflectingStatus = false;
            _reflectHookDepth--;
          }
          return { success: false, immune: true };
        }
        const immunityTimer = protectionTimers.find(t => (t.payload?.immuneStatus || t.payload?.reflectStatus) && acceptsStatus(t));
        if (blkGuard || (targetRegState.immuneStatusTurns || 0) > 0 || (targetRegState.reflectStatusTurns || 0) > 0 || immunityTimer) {
          if (immunityTimer?.kind === 'use_counter') getBattleEventContext(tSide, true, 0).consumeTimer?.(tSide, immunityTimer.id);
          pushEffect({ type: 'log', side: tSide, data: { text: `🛡️ 【異常免疫】：【${target.name}】免疫了【${s}】！`, type: "info" } });
          notifyImmunized("immuneStatus");
          return { success: false, immune: true };
        }
      }

      const actorRegKey = `${side}RegistryState` as 'p1RegistryState' | 'p2RegistryState';
      const actorRegState = c[actorRegKey] || {};
      if (actorRegState.DarkScarTurns > 0) {
        pushEffect({ type: 'log', side: side, data: { text: `🚫 【黯痕】：處於黯痕狀態下，無法附加任何異常狀態！`, type: "info" } });
        return { success: false, immune: true };
      }

      const filterCtx = getBattleEventContext(tSide, true, 0);
      const reflectCount = filterCtx.getPlayerState('blkReflectStatusCount') || 0;
      const immuneCount = filterCtx.getPlayerState('blkImmuneStatusCount') || 0;
      if (reflectCount > 0 || immuneCount > 0) {
        const key = reflectCount > 0 ? 'blkReflectStatusCount' : 'blkImmuneStatusCount';
        filterCtx.setPlayerState(key, (reflectCount > 0 ? reflectCount : immuneCount) - 1);
        if (reflectCount > 0 && tSide !== side && !_reflectingStatus && _reflectHookDepth === 0) {
          _reflectingStatus = true; _reflectHookDepth++;
          try { filterCtx.applyStatusWithImmunityCheck(side, s, d); }
          finally { _reflectingStatus = false; _reflectHookDepth--; }
        }
        if (reflectCount <= 0) notifyImmunized("immuneCount");
        return { success: false, immune: true };
      }

      // §47: Suit BEFORE_STATUS_APPLY
      const suitId = tSide === 'p1' ? c.p1Suit : c.p2Suit;
      // targetSide＝受到異常的一方、sourceSide＝施加方（handler 以 targetSide === ctx.actor 判斷自身受到）
      const statusData: { status: string; duration: number; prevented: boolean; prevent?: boolean; targetSide: 'p1' | 'p2'; sourceSide: 'p1' | 'p2' } = { status: s, duration: d, prevented: false, targetSide: tSide, sourceSide: side };
      const isReflectedIn = _reflectHookDepth > 0; // 被反彈過來的異常：不再響應攔截／反彈
      if (!isReflectedIn && suitId && SuitEffectRegistry[suitId]) {
        _reflectHookDepth++;
        try { SuitEffectRegistry[suitId](filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData); } finally { _reflectHookDepth--; }
        s = canonicalStatusName(statusData.status);
        d = statusData.duration;
        if (statusData.prevented || statusData.prevent) {
          return { success: false, immune: true };
        }
      }
      const tRelics = tSide === 'p1' ? c.p1Relics : c.p2Relics;
      if (!isReflectedIn && tRelics?.length) {
        runRelicEffects(tRelics, filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData);
        if (statusData.prevented || statusData.prevent) return { success: false, immune: true };
      }

      // Also call SoulMarkRegistry for BEFORE_STATUS_APPLY to allow soul mark immunities/replacements (M1)
      if (!isReflectedIn && SoulMarkRegistry[target.name]) {
        _reflectHookDepth++;
        try { SoulMarkRegistry[target.name](filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData); } finally { _reflectHookDepth--; }
        s = canonicalStatusName(statusData.status);
        d = statusData.duration;
        if (statusData.prevented || statusData.prevent) {
          return { success: false, immune: true };
        }
      }

      const filtered = TraitsEngine.filterStatusInflict(filterCtx, tSide, s, d);
      if (filtered.handled) {
        if (!filtered.overrideStatus) {
           // §47: Suit／魂印 ON_STATUS_IMMUNIZED（特性免疫）
           notifyImmunized("trait");
           return { success: false, immune: true };
        }
        s = canonicalStatusName(filtered.overrideStatus);
        d = filtered.overrideDuration ?? d;
      }

      const isLate = (moveIndex === 1 && tSide === side);
      const latestTarget = syncStateRef.current[tSide];
      const existingEffects = latestTarget.effects || [];
      const existing = existingEffects.find(e => e.id === s);
      
      let nextStacks = 1;
      const entry = StatusRegistry[s];
      const hasDoubleOnStack = entry?.mechanics?.some(m => m.type === 'DAMAGE_TICK' && m.params?.doubleOnStack);

      if (existing && hasDoubleOnStack) {
        nextStacks = Math.min((existing.stacks || 1) + 1, 2);
      }

      // 死亡換人（回合結束後、下回合前）附加的異常：下回合開始補扣一次
      const betweenRounds = String(c.phase || "").startsWith("forced_switch");
      const newEffect = { 
        id: s, 
        name: s, 
        duration: d, 
        isLateMover: isLate,
        stacks: nextStacks,
        ...(betweenRounds ? { catchUpTick: true } : {})
      };
      const nextEffects = [...existingEffects.filter(e => e.id !== s), newEffect];
      
      const nextElf: any = { ...latestTarget, effects: nextEffects };
      // 狂信：進入狀態時若自身沒有信仰對象，則本次狂信來源成為信仰對象
      if (s === '狂信' && !nextElf.faithTarget) {
        const src = side === 'p1' ? c.p1 : c.p2;
        if (src && tSide !== side) {
          nextElf.faithTarget = src.name;
          pushEffect({ type: 'log', side: tSide, data: { text: `🙏 【狂信】：【${target.name}】的信仰對象成為【${src.name}】！`, type: "status" } });
        }
      }
      const latest = syncStateRef.current;
      const nextTeam = [...latest[`${tSide}Team`]];
      const activeIdx = latest[`${tSide}ActiveIndex`];
      nextTeam[activeIdx] = nextElf;
      
      syncStateRef.current = {
        ...latest,
        [tSide]: nextElf,
        [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam
      };

      dispatch({ type: 'UPDATE_ELF', side: tSide, elf: { effects: nextEffects } });
      
      if (SoulMarkRegistry[nextElf.name]) {
        const targetCtx = getBattleEventContext(tSide, true, 0);
        SoulMarkRegistry[nextElf.name](targetCtx, "SELF_STATUS_APPLIED" as any, { status: s, duration: d });
      }
      if (_statusApplyDepth <= 1) {
        try { emitStatusApplied([getBattleEventContext("p1", true, 0), getBattleEventContext("p2", true, 0)], { side: tSide, status: s, duration: d }); } catch (e) { console.error("[blocks]", e); }
      }

      return { success: true, immune: false };
      })(); } finally { _statusApplyDepth--; }
    },
    getStatuses: (e) => getStatuses(e),
    clearTurnEffectsOf: (s) => {
      const c = syncStateRef.current;
      const protectedElf = s === "p1" ? c.p1 : c.p2;
      if (protectedElf?.ownTurnEffectsUnclearable) {
        pushEffect({ type: 'log', side: s, data: { text: `⚡ 【專屬特質】：【${protectedElf.name}】的回合類效果無法被消除！`, type: "effect" } });
        return false;
      }
      // 通用：該方在場精靈處於「回合類效果無法被消除」（turnEffectsUnclearableTurns，寫在被保護方）
      const protReg = c[`${s}RegistryState` as 'p1RegistryState' | 'p2RegistryState'] || {};
      if ((protReg.turnEffectsUnclearableTurns || 0) > 0 && hasTurnEffect(c[`${s}Timers` as "p1Timers" | "p2Timers"] || [])) {
        pushEffect({ type: 'log', side: s, data: { text: `🛡️ 【${protectedElf?.name}】的回合類效果無法被消除！`, type: 'effect' } });
        return false;
      }
      const timersKey = `${s}Timers` as "p1Timers" | "p2Timers";
      const curTimers = c[timersKey];
      const [next, cleared] = clearTurnEffects(curTimers);
      // 通用：回合類效果計時器可宣告其對應的登錄狀態鍵（payload.mirrorRegistryKeys），被消除時一併歸零
      const removed = (curTimers || []).filter(t => !next.includes(t));
      const zeroKeys: Record<string, any> = {};
      for (const t of removed) for (const k of (t.payload?.mirrorRegistryKeys || [])) zeroKeys[k] = 0;
      const regKey = `${s}RegistryState` as 'p1RegistryState' | 'p2RegistryState';
      
      syncStateRef.current = {
        ...c,
        [timersKey]: next,
        ...(Object.keys(zeroKeys).length ? { [regKey]: { ...(c[regKey] || {}), ...zeroKeys } } : {})
      };

      dispatch({ type: 'SET_TIMERS', side: s, timers: next });
      if (Object.keys(zeroKeys).length) dispatch({ type: 'UPDATE_REGISTRY_STATE', side: s, state: zeroKeys });
      if (cleared > 0) {
        const owner = syncStateRef.current[s];
        try { SoulMarkRegistry[owner.name]?.(getBattleEventContext(s, true, 0), EffectTiming.TURN_EFFECTS_CLEARED, { cleared, side: s }); } catch (e) { console.error(e); }
      }
      return cleared > 0;
    },
    hasTurnEffectOn: (s) => {
      const c = syncStateRef.current;
      const timersKey = `${s}Timers` as "p1Timers" | "p2Timers";
      return hasTurnEffect(c[timersKey]);
    },
    applyStatChange: (tSide, changes, ppChanges) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      const immuneStatDownTurns = syncStateRef.current[tSide === "p1" ? "p1RegistryState" : "p2RegistryState"]?.immuneStatDownTurns || 0;
      
      const filteredChanges = Object.entries(changes || {}).filter(([stat, value]) => {
         if (value < 0 && (immuneStatDownTurns > 0 || hasStoneThrowerMythic(target) || Object.keys(getStatuses(target)).some(name => StatusRegistry[name]?.mechanics?.some(m => m.params?.immuneStatDebuff)))) {
            pushEffect({ type: 'log', side: tSide, data: { text: `🛡️ 【能力下降免疫】：【${target.name}】免疫了能力下降！`, type: "effect" } });
            return false;
         }
         // 星際藏品【重力靴】：速度下降免疫
         if (value < 0 && stat === "speed" && (tSide === "p1" ? c.p1Relics : c.p2Relics)?.includes("gravity_boots")) {
            pushEffect({ type: 'log', side: tSide, data: { text: `👢 【重力靴】：【${target.name}】免疫了速度下降！`, type: "effect" } });
            return false;
         }
         return true;
      });
      if (filteredChanges.length === 0 && !ppChanges) return { success: false, applied: {} };

      const result = applyStatChanges(target, filteredChanges.map(([stat, value]) => ({ stat: stat as any, value })));
      // 實際變化量（受 ±6 上下限、免疫過濾後）
      const applied: Record<string, number> = {};
      for (const [stat] of filteredChanges) {
        const before = Number((target.statStages as any)?.[stat] || 0);
        const after = Number((result.elf.statStages as any)?.[stat] || 0);
        if (after !== before) applied[stat] = after - before;
      }
      
      let nextElf = { ...target, statStages: result.elf.statStages };
      
      // Handle PP changes
      if (ppChanges) {
        const nextSkills = nextElf.skills.map(s => {
          if (ppChanges.all) {
            return { ...s, pp: clampSkillPp(s, s.pp + ppChanges.all, nextElf) };
          }
          if (ppChanges[s.name]) {
            return { ...s, pp: clampSkillPp(s, s.pp + ppChanges[s.name], nextElf) };
          }
          return s;
        });
        nextElf.skills = nextSkills;
      }

      const nextTeam = [...(tSide === 'p1' ? c.p1Team : c.p2Team)];
      const activeIdx = tSide === 'p1' ? c.p1ActiveIndex : c.p2ActiveIndex;
      nextTeam[activeIdx] = nextElf;
      
      syncStateRef.current = {
        ...c,
        [tSide]: nextElf,
        [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam
      };

      dispatch({ type: 'UPDATE_ELF', side: tSide, elf: { statStages: nextElf.statStages, skills: nextElf.skills } });
      pushEffect({ type: 'log', side: tSide, data: { text: `【${target.name}】的能力發生了變化！`, type: "status" } });
      if (filteredChanges.length > 0 && target.paralyzeBothOnOwnStatChangeTurns) {
        const turns = target.paralyzeBothOnOwnStatChangeTurns;
        const otherSide = tSide === "p1" ? "p2" : "p1";
        getBattleEventContext(tSide, true, 0).applyStatusWithImmunityCheck(tSide, "麻痺", turns);
        getBattleEventContext(tSide, true, 0).applyStatusWithImmunityCheck(otherSide, "麻痺", turns);
        pushEffect({ type: 'log', side: tSide, data: { text: `⚡ 【異】：自身能力等級被改變，雙方麻痺${turns}回合！`, type: "effect" } });
      }
      return { success: Object.keys(applied).length > 0, applied };
    },
    applyShield: (tSide, amount) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      const nextShield = (target.shield || 0) + amount;
      
      const nextElf = { ...target, shield: nextShield };
      const nextTeam = [...(tSide === 'p1' ? c.p1Team : c.p2Team)];
      const activeIdx = tSide === 'p1' ? c.p1ActiveIndex : c.p2ActiveIndex;
      nextTeam[activeIdx] = nextElf;
      
      syncStateRef.current = {
        ...c,
        [tSide]: nextElf,
        [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam
      };

      dispatch({ type: 'UPDATE_ELF', side: tSide, elf: { shield: nextShield } });
    },
  };
}

export function buildStateAPIs(shared: SharedContextDeps): StateAPIs {
  const { side, syncStateRef, dispatch, pushEffect, isP1, self, getBattleEventContext } = shared;
  
  return {
    applyDeathImmunity: (tSide, opts) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      const nextElf = { ...target, deathImmunity: { ...opts } };
      const nextTeam = [...(tSide === 'p1' ? c.p1Team : c.p2Team)];
      const activeIdx = tSide === 'p1' ? c.p1ActiveIndex : c.p2ActiveIndex;
      nextTeam[activeIdx] = nextElf;
      syncStateRef.current = { ...c, [tSide]: nextElf, [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam };
      dispatch({ type: 'UPDATE_ELF', side: tSide, elf: { deathImmunity: nextElf.deathImmunity } });
    },
    vanishElf: (tSide, tElf) => {
      const c = syncStateRef.current;
      const teamKey = `${tSide}Team` as "p1Team" | "p2Team";
      const team = [...c[teamKey]];

      let idx = -1;
      if (tElf && tElf.id) {
        idx = team.findIndex(e => e.id === tElf.id);
      }
      if (idx === -1) {
        const activeIdxKey = `${tSide}ActiveIndex` as "p1ActiveIndex" | "p2ActiveIndex";
        idx = c[activeIdxKey];
      }

      if (idx !== -1 && team[idx]) {
        const elfToVanish = team[idx];
        const isDeluImmune = elfToVanish.name.includes("魔獅迪露");
        const updatedElf = { 
          ...elfToVanish, 
          currentHp: 0, 
          maxHp: isDeluImmune ? elfToVanish.maxHp : 0, 
          isVanished: true 
        };
        team[idx] = updatedElf;

        const activeIdxKey = `${tSide}ActiveIndex` as "p1ActiveIndex" | "p2ActiveIndex";
        const isCurrentlyActive = c[activeIdxKey] === idx;

        syncStateRef.current = {
          ...c,
          [teamKey]: team,
          ...(isCurrentlyActive ? { [tSide]: updatedElf } : {})
        };

        dispatch({ type: 'UPDATE_TEAM', side: tSide, team });
        if (isCurrentlyActive) {
          dispatch({ type: 'UPDATE_ELF', side: tSide, elf: updatedElf });
        }
        pushEffect({ type: 'log', side: tSide, data: { text: `🌌 【${updatedElf.name}】化為虛無，徹底消逝在戰場中！`, type: "defeat" } });
      }
    },
    setMark: (m, targetSide) => {
      const c = syncStateRef.current;
      const actorSide = targetSide || side; 
      const marksKey = `${actorSide}Marks` as "p1Marks" | "p2Marks";
      const curMarks = c[marksKey] || [];
      const holder = actorSide === side ? self : c[actorSide];
      const nextMark = bindMarkToElf({ ...m, source: m.source || (self.name + " / " + (self.soulMark?.badgeChar || "")) } as Mark, holder);
      const nextMarks = setMarkUtil(curMarks, nextMark as Mark);
      
      syncStateRef.current = setBattleSideMarks(c, actorSide, nextMarks);

      dispatch({ type: 'SET_MARKS', side: actorSide, marks: nextMarks });
    },
    getMarks: (targetSide) => {
      const c = syncStateRef.current;
      const marksKey = `${targetSide}Marks` as "p1Marks" | "p2Marks";
      const holder = targetSide === side ? self : c[targetSide];
      return (c[marksKey] || []).filter(mark => markAppliesToElf(mark, holder));
    },
    clearMark: (id, targetSide) => {
      const c = syncStateRef.current;
      const actorSide = targetSide || side;
      const marksKey = `${actorSide}Marks` as "p1Marks" | "p2Marks";
      const curMarks = c[marksKey] || [];
      const holder = actorSide === side ? self : c[actorSide];
      const nextMarks = curMarks.filter(mark => mark.id !== id || !markAppliesToElf(mark, holder));
      
      syncStateRef.current = setBattleSideMarks(c, actorSide, nextMarks);

      dispatch({ type: 'SET_MARKS', side: actorSide, marks: nextMarks });
    },
    queueExtraAction: (owner, action) => {
      const c = syncStateRef.current as any;
      syncStateRef.current = { ...c, extraActionQueue: [...(c.extraActionQueue || []), { ...action, owner }] } as any;
    },
    consumeTimer: (s, id) => {
      const c = syncStateRef.current;
      const timersKey = `${s}Timers` as "p1Timers" | "p2Timers";
      const cur = c[timersKey] || [];
      const next = cur.flatMap((t: any) => t.id !== id ? [t] : (t.remaining - 1 > 0 ? [{ ...t, remaining: t.remaining - 1 }] : []));
      syncStateRef.current = { ...c, [timersKey]: next };
      dispatch({ type: 'SET_TIMERS', side: s, timers: next });
    },
    addTimerTo: (s, timer, isLateMover) => {
      const c = syncStateRef.current;
      const timersKey = `${s}Timers` as "p1Timers" | "p2Timers";
      const curTimers = c[timersKey];
      const controllerSide = s === "p1" ? "p2" : "p1";
      const controller = c[controllerSide];
      let actualTimer = timer;
      if (timer.kind === "turn_effect" && controller?.collapseOpponentTurnEffectsToOne && timer.remaining > 1) {
        const reduced = timer.remaining - 1;
        actualTimer = { ...timer, remaining: 1 };
        const controllerStatuses = getStatuses(controller);
        const existing = Math.max(controllerStatuses["麻痺"] || 0, controllerStatuses["麻痹"] || 0, controllerStatuses.paralyzed || 0);
        getBattleEventContext(controllerSide, true, 0).applyStatusWithImmunityCheck(controllerSide, "麻痺", existing + 1 + reduced);
        pushEffect({ type: 'log', side: controllerSide, data: { text: `⚡ 【異】：對手回合類效果改為1回合；減少${reduced}回合，自身麻痺增加${reduced + 1}回合！`, type: "effect" } });
      }
      const owner = s === side ? self : c[s];
      // 麻痺回呼可能已更新同步狀態，不能用呼叫前的 c 覆蓋它。
      syncStateRef.current = addScopedTimer(syncStateRef.current, s, owner, actualTimer, { isLateMover });
      dispatch({ type: 'ADD_SCOPED_TIMER', side: s, owner, timer: actualTimer, context: { isLateMover } });
    },
    updateElf: (tSide, elfUpdates) => {
      const c = syncStateRef.current;
      const teamKey = tSide === 'p1' ? 'p1Team' : 'p2Team';
      const activeIndexKey = tSide === 'p1' ? 'p1ActiveIndex' : 'p2ActiveIndex';
      const team = c[teamKey];
      const contextualTarget = tSide === side ? self : c[tSide];
      const requestedId = elfUpdates.battleId || elfUpdates.id || contextualTarget.battleId || contextualTarget.id;
      const foundIndex = team.findIndex((elf) => (elf.battleId || elf.id) === requestedId || elf.id === requestedId);
      // 明確指定的身分找不到時不可退回在場者；延遲/板凳事件也不能寫錯人。
      if (foundIndex < 0) return;
      const targetIndex = foundIndex;
      const target = team[targetIndex] || c[tSide];
      // 通用：處於「能力上升狀態無法被消除」（statBoostUnclearableTurns，寫在被保護方）時，他方效果不能降低其能力提升
      if (elfUpdates.statStages && tSide !== side && targetIndex === c[activeIndexKey]
        && ((c[`${tSide}RegistryState` as 'p1RegistryState' | 'p2RegistryState'] || {}).statBoostUnclearableTurns || 0) > 0) {
        const before: Record<string, number> = (target.statStages || {}) as any;
        const guarded: Record<string, number> = { ...(elfUpdates.statStages as any) };
        let kept = false;
        for (const k of Object.keys(before)) {
          if (typeof before[k] === "number" && before[k] > 0 && (guarded[k] ?? 0) < before[k]) { guarded[k] = before[k]; kept = true; }
        }
        if (kept) {
          elfUpdates = { ...elfUpdates, statStages: guarded as any };
          pushEffect({ type: 'log', side: tSide, data: { text: `🛡️ 【${target.name}】的能力上升狀態無法被消除！`, type: 'effect' } });
        }
      }
      if (elfUpdates.currentHp !== undefined) elfUpdates = { ...elfUpdates, currentHp: capCurrentHp(c, tSide, target, elfUpdates.currentHp) };
      const nextElf = { ...target, ...elfUpdates };
      const nextTeam = [...team];
      nextTeam[targetIndex] = nextElf;
      const isUpdatingActive = targetIndex === c[activeIndexKey];

      syncStateRef.current = {
        ...c,
        [teamKey]: nextTeam,
        ...(isUpdatingActive ? { [tSide]: nextElf } : {})
      };
      dispatch({ type: 'UPDATE_ELF', side: tSide, elf: elfUpdates, targetId: target.battleId || target.id });
    },
    updateAnyElf: (tSide, battleId, patch) => {
      const c = syncStateRef.current;
      const patchTarget = c[`${tSide}Team`].find(e => (e.battleId || e.id) === battleId || e.id === battleId);
      if (patchTarget && patch.currentHp !== undefined) patch = { ...patch, currentHp: capCurrentHp(c, tSide, patchTarget, patch.currentHp) };
      const targetActive = tSide === 'p1' ? c.p1 : c.p2;
      const isUpdatingActive = (targetActive.battleId || targetActive.id) === battleId || targetActive.id === battleId;

      if (isUpdatingActive) {
        // battleId 是單場戰鬥身分，不能回寫覆蓋精靈的資料 ID。
        const nextElf = { ...targetActive, ...patch };
        syncStateRef.current = {
          ...c,
          [tSide]: nextElf,
          [tSide === 'p1' ? 'p1Team' : 'p2Team']: c[tSide === 'p1' ? 'p1Team' : 'p2Team'].map(e => (e.battleId || e.id) === (nextElf.battleId || nextElf.id) ? nextElf : e)
        };
        dispatch({ type: 'UPDATE_ELF', side: tSide, elf: nextElf, targetId: battleId });
      } else {
        let changed = false;
        const nextTeam = c[tSide === 'p1' ? 'p1Team' : 'p2Team'].map(e => {
          if ((e.battleId || e.id) === battleId || e.id === battleId) {
            changed = true;
            return { ...e, ...patch };
          }
          return e;
        });
        if (changed) {
          syncStateRef.current = {
            ...c,
            [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam
          };
          dispatch({ type: 'UPDATE_TEAM', side: tSide, team: nextTeam });
        }
      }
    },
    getPlayerState: (k) => {
      const c = syncStateRef.current;
      return readScopedRegistry(c, side, self, k);
    },
    setPlayerState: (k, v) => {
      const c = syncStateRef.current;
      syncStateRef.current = writeScopedRegistry(c, side, self, { [k]: v });
      dispatch({ type: 'UPDATE_SCOPED_REGISTRY_STATE', side, owner: self, state: { [k]: v } });
    },
    getOpponentState: (k) => {
      const c = syncStateRef.current;
      return (isP1 ? c.p2RegistryState : c.p1RegistryState)[k];
    },
    setOpponentState: (k, v) => {
      const c = syncStateRef.current;
      const oppSide = isP1 ? "p2" : "p1";
      const oppRegKey = oppSide === "p1" ? "p1RegistryState" : "p2RegistryState";
      syncStateRef.current = {
        ...c,
        [oppRegKey]: { ...c[oppRegKey], [k]: v }
      };
      dispatch({ type: 'UPDATE_REGISTRY_STATE', side: oppSide, state: { [k]: v } });
    },
    shuffleArray,
    getEligibleTeam: (tSide) => {
      const c = syncStateRef.current;
      const team = tSide === 'p1' ? c.p1Team : c.p2Team;
      return getEligibleTeam(team).filter((e: any) => !e.isConcealed);
    },
    getFullTeam: (tSide) => {
      const c = syncStateRef.current;
      return tSide === 'p1' ? c.p1Team : c.p2Team;
    },
    getFirstStarter: (tSide) => {
      const c = syncStateRef.current;
      const team = tSide === 'p1' ? c.p1Team : c.p2Team;
      const res = getFirstStarter(team);
      return (res && !res.isConcealed) ? res : undefined;
    },
    getNthElf: (tSide, n) => {
      const c = syncStateRef.current;
      const team = tSide === 'p1' ? c.p1Team : c.p2Team;
      const res = getNthElf(team, n);
      return (res && !res.isConcealed) ? res : undefined;
    },
    getAdjacentElves: (tSide, elf) => {
      const c = syncStateRef.current;
      const team = tSide === 'p1' ? c.p1Team : c.p2Team;
      return getAdjacentElves(team, elf).filter(e => !e.isConcealed);
    },
    getSeparatedElves: (tSide, elf) => {
      const c = syncStateRef.current;
      const team = tSide === 'p1' ? c.p1Team : c.p2Team;
      return getSeparatedElves(team, elf).filter(e => !e.isConcealed);
    },
    addExtraElf: (tSide, extraElf) => {
      const c = syncStateRef.current;
      const teamKey = `${tSide}Team` as "p1Team" | "p2Team";
      const currentTeam = c[teamKey] || [];
      if (currentTeam.some(e => e.id === extraElf.id)) return;
      const nextTeam = [...currentTeam, extraElf];
      syncStateRef.current = {
        ...c,
        [teamKey]: nextTeam
      };
      dispatch({ type: 'UPDATE_TEAM', side: tSide, team: nextTeam });
    },
    trackCodeExec: () => {},
    setNextTurns: (who, key, n) => {
      const tSide = who === "self" ? side : who === "opp" ? (side === "p1" ? "p2" : "p1") : who;
      const c = syncStateRef.current;
      const regKey = `${tSide}RegistryState` as "p1RegistryState" | "p2RegistryState";
      const pend = { ...((c[regKey] || {})[PENDING_TURNS_KEY] || {}), [key]: Math.max(0, Math.floor(n)) };
      syncStateRef.current = { ...c, [regKey]: { ...(c[regKey] || {}), [PENDING_TURNS_KEY]: pend } };
      dispatch({ type: 'UPDATE_REGISTRY_STATE', side: tSide, state: { [PENDING_TURNS_KEY]: pend } });
    },
  };
}

/**
 * ctx.self／ctx.target／ctx.activeP1／ctx.activeP2 改為「即時讀取」：同一次 handler 內呼叫
 * updateElf／applyStatChange／傷害等 API 後，再讀 ctx.self 會拿到最新狀態（過去是建立 ctx 時的快照）。
 * - self／target 依建立時的身分（battleId||id）在隊伍中追蹤，不會因中途換人變成別隻精靈。
 * - 指派（例如 `Object.create(ctx).self = x`）會在該物件上建立自有屬性覆蓋，不影響原 ctx。
 * 注意：先解構（const { self } = ctx）的區域變數仍是當下快照。
 */
export function attachLiveElfAccessors(ctx: BattleEventContext, syncStateRef: MutableRefObject<BattleState>, side: "p1" | "p2", selfSnapshot: Elf, oppSnapshot: Elf): BattleEventContext {
  const oppSide = side === "p1" ? "p2" : "p1";
  const idOf = (e: any) => e ? String(e.battleId || e.id) : "";
  const track = (s: "p1" | "p2", snap: Elf) => (): Elf => {
    const c = syncStateRef.current;
    const active = c[s];
    if (!snap) return active;
    const id = idOf(snap);
    if (active && idOf(active) === id) return active;
    const team: Elf[] = (s === "p1" ? c.p1Team : c.p2Team) || [];
    return team.find(e => idOf(e) === id) || snap;
  };
  const define = (key: string, getter: () => any) => {
    Object.defineProperty(ctx, key, {
      enumerable: true,
      configurable: true,
      get: getter,
      set(this: any, v: any) { Object.defineProperty(this, key, { value: v, writable: true, enumerable: true, configurable: true }); },
    });
  };
  define("self", track(side, selfSnapshot));
  define("target", track(oppSide, oppSnapshot));
  define("activeP1", () => syncStateRef.current.p1);
  define("activeP2", () => syncStateRef.current.p2);
  define("p1Timers", () => syncStateRef.current.p1Timers || []);
  define("p2Timers", () => syncStateRef.current.p2Timers || []);
  define("p1FullTeam", () => syncStateRef.current.p1Team);
  define("p2FullTeam", () => syncStateRef.current.p2Team);
  return ctx;
}

/** 「下N回合」待生效的 *Turns 鍵（{ [key]: n }，存於該方 RegistryState），回合結束通用遞減後才寫入。見 BattleEventContext.setNextTurns。 */
export const PENDING_TURNS_KEY = "__pendingTurns";

/** 回合結束：通用遞減完成後，把待生效的「下N回合」鍵寫入（取較大值）並清空待生效表。 */
export function activatePendingTurns(reg: Record<string, any>): Record<string, any> {
  const pend = reg?.[PENDING_TURNS_KEY];
  if (!pend || typeof pend !== "object") return reg;
  const out = { ...reg };
  for (const [k, n] of Object.entries(pend)) out[k] = Math.max(Number(out[k]) || 0, Number(n) || 0);
  delete out[PENDING_TURNS_KEY];
  return out;
}
