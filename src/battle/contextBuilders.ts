import {retainShield} from './markCapabilities';
import { queueAttachedAttackDamage } from './attachedAttackDamage';
import {portableSkillCapabilities,portableShieldPatch} from './portableSkillMarks';
import { applyAlienDoubleDamage } from './advancedDamageModifiers';
import { createDamageComp, floorDamage } from './damagePipeline';
import { resolveDamageBlocking } from './damageBlocking';
import { matchesDamageTypes } from '../effects/damageChoices';
import { trackIllusionStatWrite } from './illusionStats';
import { trackNativeRegistryWrite } from './acquiredEffectContext';
import { normalizePpPatch } from './ppTransitions';
import { applyBattleItem, consumeBattleItem, grantBattleItem } from './itemInventory';
import { findBagElf } from './bagTargets';
import { BATTLE_ITEMS, isElfItemDisabled } from '../utils/battleHelpers';
import { capCurrentHp } from './hpCeiling';
import { applyAdvancedDamageModifiers, applyOutgoingSkillRestriction } from './advancedDamageModifiers';
import { reductionPolicy, multiplyDamageReduction, applyStatusDamageModifiers, applyMarkDamageReductions, finalizeDamageReductions } from './damageReduction';
import { activeConstraints } from './timedConstraints';
import { blocksStatusInfliction } from './statusOrigin';
import { attackDefenseBypass, applyAttackDefenseLimit } from './attackDefense';
import { skillTypeMultiplier } from './skillTypeOverride';
import {statusTypeMultiplier} from '../effects/statusMechanics';
import { queueSkillLifesteal } from './lifesteal';
import {queueInstantKill} from './instantKill';
import type { SettlementOptions } from './settlementReceipt';
import {notifyDamageCalculation,type DamageCalculationOptions} from './damageCalculation';
import { combineSettlementCallbacks } from './settlementReceipt';
import { isNonTrueDamageType, normalizeDamageType } from './damageSemantics';
import React, { MutableRefObject, Dispatch } from "react";
import { Elf, Skill } from "../types";
import { Mark, bindMarkToElf, markAppliesToElf } from "./marks";
import { BattleState, BattleAction, EffectItem } from "../components/BattleManager";
import { BattleEventContext, EffectTiming, DamageComputation, PriorityComputation } from "../effects/types";
import { Timer } from "./timers";
import { readScopedRegistry, writeScopedRegistry, addScopedTimer, consumeScopedTimer, clearScopedTurnEffects, scopedTimers, setBattleSideMarks } from "./stateScopes";
import { getTypeMatchup } from "../utils/statCalculator";
import { emitStatusApplied, blockStatusGuard } from "../blocks/registry";
import { SoulMarkRegistry } from "../effects/battleEventRegistry";
import { notifyTeamKitObservers } from '../effects/teamKitObservers';
import { enforceMaximumHealthLock } from '../blocks/ops/finalOdinDeluBeliente';
import { SuitEffectRegistry } from "../effects/suitEffectRegistry";
import { runRelicEffects, fixedValueMul } from "../effects/relicEffectRegistry";
import { runBossTraitEffects } from "../blocks/ops/bossTraits";
import { applyStatChanges } from "../utils/statChangeManager";
import { TraitsEngine } from "../utils/traitsEngine";
import { getStatuses, shuffleArray, clampSkillPp } from "../utils/battleHelpers";
import { StatusRegistry } from "../effects/statusRegistry";
import { canonicalStatusName } from '../effects/statusIdentity';
import { patchesStatuses, removedStatusEvents } from './statusTransitionEvents';
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
  checkResourceTransitions?:()=>void;
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

export type DamageAPIs = Pick<BattleEventContext, "applyInstantKill" | "applyPinkDamage" | "applyTrueDamage" | "applySkillTypeDamage" | "applyAbsorb" | "applyHeal" | "adjustHp" | "applyPercentDamage" | "applyFixedDamage">;
export type StatusAPIs = Pick<BattleEventContext, "applyStatusWithImmunityCheck" | "getStatuses" | "clearTurnEffectsOf" | "hasTurnEffectOn" | "applyStatChange" | "applyShield">;
export type StateAPIs = Pick<BattleEventContext, 
  "useBattleItem" | "grantBattleItem" | "applyDeathImmunity" | "vanishElf" | "addExtraElf" | "setMark" | "clearMark" | "getMarks" | "getAllMarks" | "addTimerTo" | "consumeTimer" | "queueExtraAction" | "updateElf" | "updateAnyElf" | "emitElfEvent" | "contextForElf" |
  "getPlayerState" | "setPlayerState" | "getOpponentState" | "setOpponentState" |
  "shuffleArray" | "getEligibleTeam" | "getFullTeam" | "getFirstStarter" | "getNthElf" | "getAdjacentElves" | "getSeparatedElves" | "trackCodeExec" | "setNextTurns"
>;

/** 附加傷害也通知造成者；兩個方向使用同一分類。 */
function runDamageHooks(shared: SharedContextDeps, targetSide: 'p1' | 'p2', comp: DamageComputation): void {
  comp.sourceSide = shared.side;
  if(targetSide!==shared.side && readScopedRegistry(shared.syncStateRef.current,shared.side,shared.self,'blkIgnoreBlock'))comp.ignoreDamageBlocking=true;
  if (targetSide !== shared.side) comp.attackDefenseBypass = attackDefenseBypass(shared.self, {
    attackDefenseBypassUntilSwitch: readScopedRegistry(shared.syncStateRef.current, shared.side, shared.self, 'attackDefenseBypassUntilSwitch'),
  }, comp.damageCategory);
  comp.reductionPolicy = reductionPolicy(shared.syncStateRef.current, targetSide, shared.syncStateRef.current[targetSide], comp.damageCategory);
  if (targetSide !== shared.side) applyAlienDoubleDamage(comp, shared.self, shared.syncStateRef.current[targetSide]);
  // 獨立乘區與巢狀傷害可略過一般增減傷，仍須遵守造成者自己的輸出上限。
  for(const {block:b} of activeConstraints(scopedTimers(shared.syncStateRef.current,shared.side,shared.self),shared.self)){
    const scope:Record<string,string>={攻擊:'attack',技能:'skill',固定:'fixed',百分比:'percent',非真實:'non_true'};
    if(b?.dir==='out'&&Number.isFinite(b.damageCap)&&b.damageCap>=0&&scope[b.kind]&&matchesDamageTypes([scope[b.kind]],comp.damageCategory))
      comp.outgoingLimit=Math.min(comp.outgoingLimit??Infinity,b.damageCap);
  }
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
        const beforeMultiplier=comp.multiplier,beforeDecrease=comp.decreasePercent;
        const ctx = shared.getBattleEventContext(owner, true, shared.moveIndex);
        handler?.(ctx, EffectTiming.BEFORE_DAMAGE, withSelfRef(comp));
        if (suit) SuitEffectRegistry[suit]?.(ctx, EffectTiming.BEFORE_DAMAGE, withSelfRef(comp));
        runRelicEffects(relics, ctx, EffectTiming.BEFORE_DAMAGE, withSelfRef(comp));
        runBossTraitEffects(state[owner], ctx, EffectTiming.BEFORE_DAMAGE, withSelfRef(comp));
        if(incoming&&!comp.incomingDamageCancellation&&((beforeMultiplier>0&&comp.multiplier<=0)||(beforeDecrease<1&&comp.decreasePercent>=1)))comp.incomingDamageImmunity=true;
      }
    }
  } finally { comp.isIncoming = true; _secondaryDamageDepth--; }
}

export function buildDamageAPIs(shared: SharedContextDeps): DamageAPIs {
  const { side, moveIndex, syncStateRef, pushEffect, getBattleEventContext, self } = shared;
  
  return {
    applyPinkDamage: (tSide, amt, label, aP1, aP2, dmgType, opts?: { pure?: boolean } & DamageCalculationOptions) => {
      const c = syncStateRef.current;
      const tOpp = tSide === "p1" ? c.p1 : c.p2;
      if (['fixed', 'percent'].includes(normalizeDamageType({ damageType: dmgType || 'fixed' })) && activeConstraints(c[`${tSide}Timers`], tOpp).some(p => p.fixedPercentAsTrue)) return buildDamageAPIs(shared).applyTrueDamage(tSide, amt, label, undefined, undefined, opts);
      let baseVal = Math.floor(amt);
      // 星蝕回廊：固定傷害的數值隨層數乘 √depthMul（出手方的倍率；一般對戰沒有倍率＝1）
      if (normalizeDamageType({ damageType: dmgType || 'fixed' }) === 'fixed') baseVal = Math.floor(amt * fixedValueMul(syncStateRef.current[side === 'p1' ? 'p1Relics' : 'p2Relics']));

      // 屬性克制只影響攻擊技能的直接傷害；固定／百分比傷害不吃克制倍率
      void dmgType;

      const damageComp: DamageComputation = createDamageComp({
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
      } as any);

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

      // 黯痕：持有者造成的百分比／固定傷害減半（applyPinkDamage 過去漏掉）
      if (!damageComp.pure && tSide !== actorSide && (syncStateRef.current[`${actorSide}RegistryState` as 'p1RegistryState' | 'p2RegistryState']?.DarkScarTurns || 0) > 0
        && (damageComp.damageCategory === 'fixed' || damageComp.damageCategory === 'percent')) {
        multiplyDamageReduction(damageComp, 0.5, false);
        pushEffect({ type: 'log', side: actorSide, data: { text: `🚫 【黯痕】：造成的百分比與固定傷害減半！`, type: "effect" } });
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
      const finalDamage = resolveDamageBlocking(damageComp,Math.min(damageComp.outgoingLimit ?? Infinity, floorDamage(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3))));

      notifyDamageCalculation(opts,damageComp,amt,finalDamage);
      // 2026-10-28：真正 100% 免傷時派發通用事件，供四龍（金／玄／蒼）等「免疫成功後追加效果」使用。
      if (amt > 0 && finalDamage === 0 && damageComp.incomingDamageImmunity && !damageComp.incomingDamageCancellation) {
        try {
          const immTarget = syncStateRef.current[tSide];
          const immCtx = getBattleEventContext(tSide, true, moveIndex, immTarget);
          SoulMarkRegistry[immTarget?.name]?.(immCtx, EffectTiming.DAMAGE_IMMUNIZED, { damageType: damageComp.damageCategory, blockedAmount: amt, targetSide: tSide, holderSide: tSide });
        } catch (e) { console.error('[DAMAGE_IMMUNIZED]', e); }
      }
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
      if (opts?.applyTypeMatchup !== false && elemType && tOpp.type) {
        const typeMult = statusTypeMultiplier(self,skillTypeMultiplier(c[`${side}RegistryState`], elemType, tOpp.type));
        typeMultiplier = typeMult;
        baseVal = Math.floor(baseVal * typeMult);
      }

      const damageCategory = opts?.category || "skill_attribute";
      const damageNode = opts?.node || (damageCategory === "skill_extra_action" ? "extra_action" : "skill_effect");
      const damageComp: DamageComputation = createDamageComp({
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
      } as any);

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
      if (opts?.ignoreBlock) damageComp.ignoreDamageBlocking = true;
      if (opts?.ignoreLimit) delete damageComp.limit;
      if (opts?.floor !== undefined) damageComp.floor = Math.max(damageComp.floor ?? 0, Math.floor(opts.floor));

      finalizeDamageReductions(damageComp, syncStateRef.current, tSide, syncStateRef.current[tSide]);
      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * Math.max(0, 1 - damageComp.decreasePercent);
      const stage2 = Math.max(0, stage1 * damageComp.multiplier - (damageComp.flatReduction || 0));
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = resolveDamageBlocking(damageComp,Math.min(damageComp.outgoingLimit ?? Infinity, floorDamage(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3))));

      if (opts?.appendToAttack && shared.skill && shared.skill.category !== '屬性' && tSide !== side) {
        queueAttachedAttackDamage(shared.getBattleEventContext(side, true, moveIndex), finalDamage, damageComp.afterDamage);
        return finalDamage;
      }
      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, reductionPolicy: damageComp.reductionPolicy, onSettled: damageComp.afterDamage, label: label || "附加技能傷害", popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: damageCategory, damageNode, typedSkill: damageCategory === "skill_attribute", ignoreShield: !!opts?.ignoreShield, typeMultiplier } });
      if (tSide !== side) queueSkillLifesteal(side, finalDamage, damageCategory, syncStateRef.current[`${side}RegistryState`], pushEffect);
      return finalDamage;
    },

    applyTrueDamage: (tSide, amt, label, p1Override, p2Override, opts) => {
      const cur = syncStateRef.current;
      const tOpp = tSide === "p1" ? (p1Override || cur.p1) : (p2Override || cur.p2);
      const baseVal = Math.floor(amt);

      const damageComp: DamageComputation = createDamageComp({
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: "true",
        isIncoming: true
      } as any);

      runDamageHooks(shared, tSide, damageComp);
      applyStatusDamageModifiers(damageComp, syncStateRef.current[side], syncStateRef.current[tSide]);

      const actorSide = side;
      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef, { side, moveIndex });

      // 真實傷害不受減傷與減縮影響，僅接受增傷
      const safeDecreasePercent = 0;
      let safeMultiplier = Math.max(1.0, damageComp.multiplier ?? 1.0);

      const stage1 = damageComp.base * (1 + (damageComp.increasePercent || 0)) * (1 - safeDecreasePercent);
      const stage2 = stage1 * safeMultiplier;
      // 真實傷害不受傷害上限與保底影響（使用者確認 2026-10-11）；自身輸出上限（黯痕等）仍適用
      const finalDamage = resolveDamageBlocking(damageComp,Math.min(damageComp.outgoingLimit ?? Infinity, floorDamage(Math.max(0, stage2))));

      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, reductionPolicy: damageComp.reductionPolicy, requestedAmount: amt, onSettled: combineSettlementCallbacks(opts?.onSettled, damageComp.afterDamage), label, popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: "true" } });
      return finalDamage;
    },
    applyAbsorb: (tSide, amt, label = "汲取",opts) => {
      const val = Math.floor(amt);
      const actorSide = side; 
      const actualDmg = getBattleEventContext(actorSide, true, moveIndex).applyTrueDamage(tSide, val, label);
      getBattleEventContext(actorSide, true, moveIndex).applyHeal(actorSide, actualDmg,opts);
    },
    applyHeal: (tSide, amt, opts) => pushEffect({ type: 'heal', side: tSide, data: { amount: Math.floor(amt), ...opts } }),
    adjustHp: (tSide, amt) => pushEffect({ type: 'adjust_hp', side: tSide, data: { amount: Math.floor(amt) } }),
    applyInstantKill:(targetSide,label,opts)=>queueInstantKill(shared.getBattleEventContext(side,true,shared.moveIndex,self),targetSide,label,opts,pushEffect),
    applyPercentDamage: (tSide, p) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      const baseVal = Math.floor(target.maxHp * p);
      if (activeConstraints(c[`${tSide}Timers`], target).some(p => p.fixedPercentAsTrue)) return buildDamageAPIs(shared).applyTrueDamage(tSide, baseVal);

      const damageComp: DamageComputation = createDamageComp({
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: "percent",
        isIncoming: true
      } as any);

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
      const finalDamage = resolveDamageBlocking(damageComp,Math.min(damageComp.outgoingLimit ?? Infinity, floorDamage(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3))));

      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, reductionPolicy: damageComp.reductionPolicy, onSettled: damageComp.afterDamage, label: "百分比傷害", popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: "percent" } });
      return finalDamage;
    },
    applyFixedDamage: (tSide, amt, label, opts) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      if (activeConstraints(c[`${tSide}Timers`], target).some(p => p.fixedPercentAsTrue)) return buildDamageAPIs(shared).applyTrueDamage(tSide, amt, label);
      // 星蝕回廊：固定值隨層數縮放；由百分比換算出來的數值（opts.unscaled）已含縮放，不再乘
      const baseVal = Math.floor(opts?.unscaled ? amt : amt * fixedValueMul(c[side === 'p1' ? 'p1Relics' : 'p2Relics']));

      const damageComp: DamageComputation = createDamageComp({
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: "fixed",
        isIncoming: true
      } as any);

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
      const finalDamage = resolveDamageBlocking(damageComp,Math.min(damageComp.outgoingLimit ?? Infinity, floorDamage(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3))));

      pushEffect({ type: 'damage', side: tSide, data: { marksApplied: true, amount: finalDamage, reductionPolicy: damageComp.reductionPolicy, onSettled: damageComp.afterDamage, label: label || "固定傷害", popup: true, sourceElfName: self.name, sourceSide:side, sourceBattleId:self.battleId||self.id, damageType: "fixed" } });
      return finalDamage;
    },
  };
}

export function buildStatusAPIs(shared: SharedContextDeps): StatusAPIs {
  const { side, self, moveIndex, syncStateRef, dispatch, pushEffect, getBattleEventContext } = shared;
  // 指定持有者上下文的自身操作必須寫該隊員，不能默認寫activeIndex。
  const recipient=(c:BattleState,tSide:'p1'|'p2')=>tSide===side
    ? c[`${tSide}Team`].find(e=>(e.battleId||e.id)===(self.battleId||self.id)) || self
    : c[tSide];
  
  return {
    applyStatusWithImmunityCheck: (tSide, s, d, _ignoreDeluImmune, targetBattleId,statusOrigin) => {
      // 在免疫、反彈、分類及入庫之前統一歷史代號；不能把 poisoned 等當未知異常。
      s = canonicalStatusName(s);
      // 反彈／轉嫁類效果互相觸發時的遞迴保護（雙方都有「反彈異常」會無限互彈直到堆疊溢位）
      if (_statusApplyDepth >= 3) return { success: false, immune: true };
      // 「本回合執行過附加異常狀態的效果」：對自身或他方的附加均記錄，不論成敗。
      {
        const c0 = syncStateRef.current;
        // 場下來源的附加行為屬於該個體，不能污染同側正在受擊者。
        syncStateRef.current = writeScopedRegistry(c0, side, self, { statusAttachTurn: c0.turnNumber });
      }
      _statusApplyDepth++;
      try { return ((): { success: boolean; immune: boolean } => {
      const c = syncStateRef.current;
      const target = targetBattleId?c[`${tSide}Team`].find(e=>(e.battleId||e.id)===targetBattleId):recipient(c,tSide);
      if(!target)return {success:false,immune:false};
      // 夜之主權（通用積木 status_immunity_bypass；DSH 20261018）：受方列入保護的異常，
      // 任何「異常免疫類效果」都無法免疫——下方免疫／反彈／分類防護／次數免疫／套裝與魂印附加前防護／特性免疫全部讓路；
      // 「無法附加」型禁令（黯痕）與反彈遞迴保護不是免疫類，照舊生效。
      const sovereignStatus = (readScopedRegistry(c, tSide, target, 'blkStatusImmunityBypass') || []).some((name: string) => canonicalStatusName(name) === s);
      const source=recipient(c,side);
      if(blocksStatusInfliction(scopedTimers(c,side,source),source,side,statusOrigin)){
        pushEffect({type:'log',side,data:{text:`🚫 【異常附加受限】：【${source.name}】本次無法附加【${s}】！`,type:'info'}});
        return {success:false,immune:false};
      }
      const targetId=target.battleId||target.id;
      const targetContext=()=>getBattleEventContext(tSide,true,0,target);
      // 2026-10-28：異常未指定回合數時預設 3 回合。
      // 原本只有 runtime.status 等入口補預設，直接呼叫本函式（至少 15 處）會傳 undefined，
      // 而 advanceStatusEffect 的 duration-1 對 undefined 得 NaN，導致「附加後立刻結束」。
      if (d === undefined || d === null || !Number.isFinite(Number(d)) || Number(d) <= 0) d = 3;
      const statusData: { [key:string]:any; status:string; duration:number; prevented:boolean; prevent?:boolean; immunized?:boolean; targetSide:'p1'|'p2'; sourceSide:'p1'|'p2' } = {status:s,duration:d,prevented:false,targetSide:tSide,sourceSide:side,sourceMoveIndex:shared.moveIndex,teamObserverPhase:'beforeImmunity'};
      notifyTeamKitObservers(targetContext(),EffectTiming.BEFORE_STATUS_APPLY,statusData);
      if(side!==tSide)notifyTeamKitObservers(getBattleEventContext(side,true,shared.moveIndex,self),EffectTiming.BEFORE_STATUS_APPLY,statusData);
      delete statusData.teamObserverPhase;
      s=canonicalStatusName(statusData.status);d=statusData.duration;
      if(statusData.prevented||statusData.prevent)return {success:false,immune:!!statusData.immunized};
      // 通用：異常被免疫時通知受方魂印／套裝（ON_STATUS_IMMUNIZED；反彈不算免疫）
      const notifyImmunized = (reason: string) => {
        if (_immunizedNotifyDepth > 0) return;
        _immunizedNotifyDepth++;
        try {
          const cur = syncStateRef.current;
          const tElf = cur[`${tSide}Team`].find(e=>(e.battleId||e.id)===targetId)||target;
          const sId = tSide === 'p1' ? cur.p1Suit : cur.p2Suit;
          const ictx = getBattleEventContext(tSide, true, 0,tElf);
          const payload = { status: s, duration: d, targetSide: tSide, sourceSide: side, reason };
          if (sId && SuitEffectRegistry[sId]) SuitEffectRegistry[sId](ictx, EffectTiming.ON_STATUS_IMMUNIZED, payload);
          if (tElf && SoulMarkRegistry[tElf.name]) SoulMarkRegistry[tElf.name](ictx, EffectTiming.ON_STATUS_IMMUNIZED, payload);
        } catch (e) { console.error("[ON_STATUS_IMMUNIZED]", e); }
        finally { _immunizedNotifyDepth--; }
      };

      // Check active gate timers on target side for wraps === "immune"
      const targetTimers = scopedTimers(c,tSide,target);
      // 次數型異常轉化先於免疫／反彈；轉化後以自身來源附加，避免再次攔截同一個事件。
      const conversion=tSide!==side?targetTimers.find(t=>t.remaining>0&&!t.pendingActivation&&t.payload?.block?.statusConversion):undefined;
      if(conversion){
        const receiver=targetContext();receiver.consumeTimer?.(tSide,conversion.id);
        return receiver.applyStatusWithImmunityCheck(tSide,conversion.payload!.block.statusConversion.status,d);
      }
      for (const timer of targetTimers) {
        if (timer.remaining <= 0 || timer.pendingActivation || (timer.scope !== 'team' && timer.ownerBattleId && timer.ownerBattleId !== (target.battleId || target.id))) continue;
        const wraps = Array.isArray(timer.payload?.wraps) ? timer.payload.wraps : [timer.payload?.wraps];
        if (!sovereignStatus && timer.payload?.applyMode === "gate" && wraps.includes("immune")) {
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
      if (tSide !== side && !sovereignStatus) {
        const targetRegState = {reflectStatusTurns:readScopedRegistry(c,tSide,target,'reflectStatusTurns'),immuneStatusTurns:readScopedRegistry(c,tSide,target,'immuneStatusTurns')};
        const protectionTimers = targetTimers.filter(t => t.remaining > 0 && !t.pendingActivation &&
          (t.scope === 'team' || !t.ownerBattleId || t.ownerBattleId === (target.battleId || target.id)));
        const acceptsStatus = (t: Timer) => (!t.payload?.statusGuardSourceSide || t.payload.statusGuardSourceSide === side) &&
          (!(t.payload as any)?.excludeStatusCategory || !StatusRegistry[s]?.categories?.includes((t.payload as any).excludeStatusCategory));
        const reflectionTimer = protectionTimers.find(t => t.payload?.reflectStatus && acceptsStatus(t));
        const blkGuard = blockStatusGuard(targetTimers, target, s); // 積木：分類異常免疫／反彈
        if (((targetRegState.reflectStatusTurns || 0) > 0 || reflectionTimer || blkGuard === "reflect") && !_reflectingStatus && _reflectHookDepth === 0) {
          if (reflectionTimer?.kind === 'use_counter') targetContext().consumeTimer?.(tSide, reflectionTimer.id);
          pushEffect({ type: 'log', side: tSide, data: { text: `🔁 【反彈異常】：【${target.name}】將【${s}】反彈給對手！`, type: "effect" } });
          _reflectingStatus = true;
          _reflectHookDepth++;
          try {
            targetContext().applyStatusWithImmunityCheck(side, s, d,undefined,self.battleId||self.id);
          } finally {
            _reflectingStatus = false;
            _reflectHookDepth--;
          }
          return { success: false, immune: true };
        }
        const immunityTimer = protectionTimers.find(t => (t.payload?.immuneStatus || t.payload?.reflectStatus) && acceptsStatus(t));
        if (blkGuard || (targetRegState.immuneStatusTurns || 0) > 0 || (targetRegState.reflectStatusTurns || 0) > 0 || immunityTimer) {
          if (immunityTimer?.kind === 'use_counter') targetContext().consumeTimer?.(tSide, immunityTimer.id);
          pushEffect({ type: 'log', side: tSide, data: { text: `🛡️ 【異常免疫】：【${target.name}】免疫了【${s}】！`, type: "info" } });
          notifyImmunized("immuneStatus");
          return { success: false, immune: true };
        }
      }

      if (readScopedRegistry(c,side,self,'DarkScarTurns') > 0) {
        pushEffect({ type: 'log', side: side, data: { text: `🚫 【黯痕】：處於黯痕狀態下，無法附加任何異常狀態！`, type: "info" } });
        return { success: false, immune: true };
      }

      const filterCtx = targetContext();
      const reflectCount = filterCtx.getPlayerState('blkReflectStatusCount') || 0;
      // 2026-10-28 觸發順序：單人（不可傳承）先消耗，己方全隊（可傳承）最後消耗。
      // 反彈型（reflect）仍優先於純免疫，避免反彈被純免疫吃掉。
      const countTimers = targetTimers.filter(t => t.remaining > 0 && !t.pendingActivation && t.payload?.statusImmunityCount);
      const scopeRank = (t: any) => (t.scope === 'team' ? 1 : 0);   // 0＝單人（先），1＝全隊（後）
      const reflectRank = (t: any) => (t.payload!.statusImmunityCount.reflect ? 0 : 1);
      const countTimer = countTimers.slice().sort((a: any, b: any) =>
        reflectRank(a) - reflectRank(b) || scopeRank(a) - scopeRank(b))[0];
      if (!sovereignStatus && countTimer && (countTimer.payload!.statusImmunityCount.reflect || reflectCount <= 0)) {
        filterCtx.consumeTimer?.(tSide, countTimer.id);
        if (countTimer.payload!.statusImmunityCount.reflect && tSide !== side && !_reflectingStatus && _reflectHookDepth === 0) {
          _reflectingStatus = true; _reflectHookDepth++;
          try { filterCtx.applyStatusWithImmunityCheck(side, s, d, undefined, self.battleId || self.id); }
          finally { _reflectingStatus = false; _reflectHookDepth--; }
        } else notifyImmunized('immuneCount');
        return { success: false, immune: true };
      }
      const immuneCount = filterCtx.getPlayerState('blkImmuneStatusCount') || 0;
      if (!sovereignStatus && (reflectCount > 0 || immuneCount > 0)) {
        const key = reflectCount > 0 ? 'blkReflectStatusCount' : 'blkImmuneStatusCount';
        filterCtx.setPlayerState(key, (reflectCount > 0 ? reflectCount : immuneCount) - 1);
        if (reflectCount > 0 && tSide !== side && !_reflectingStatus && _reflectHookDepth === 0) {
          _reflectingStatus = true; _reflectHookDepth++;
          try { filterCtx.applyStatusWithImmunityCheck(side, s, d,undefined,self.battleId||self.id); }
          finally { _reflectingStatus = false; _reflectHookDepth--; }
        }
        if (reflectCount <= 0) notifyImmunized("immuneCount");
        return { success: false, immune: true };
      }

      // §47: Suit BEFORE_STATUS_APPLY
      const suitId = tSide === 'p1' ? c.p1Suit : c.p2Suit;
      // targetSide＝受到異常的一方、sourceSide＝施加方（handler 以 targetSide === ctx.actor 判斷自身受到）
      const isReflectedIn = _reflectHookDepth > 0; // 被反彈過來的異常：不再響應攔截／反彈
      if (!isReflectedIn && !sovereignStatus && suitId && SuitEffectRegistry[suitId]) {
        _reflectHookDepth++;
        try { SuitEffectRegistry[suitId](filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData); } finally { _reflectHookDepth--; }
        s = canonicalStatusName(statusData.status);
        d = statusData.duration;
        if (statusData.prevented || statusData.prevent) {
          if(statusData.immunized)notifyImmunized('statusGuard');
          return { success: false, immune: true };
        }
      }
      const tRelics = tSide === 'p1' ? c.p1Relics : c.p2Relics;
      if (!isReflectedIn && !sovereignStatus && tRelics?.length) {
        runRelicEffects(tRelics, filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData);
        if (statusData.prevented || statusData.prevent) {if(statusData.immunized)notifyImmunized('statusGuard');return { success: false, immune: true };}
      }
      if (!isReflectedIn && !sovereignStatus) {
        runBossTraitEffects(target, filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData);
        if (statusData.prevented || statusData.prevent) {if(statusData.immunized)notifyImmunized('statusGuard');return { success: false, immune: true };}
      }

      // Also call SoulMarkRegistry for BEFORE_STATUS_APPLY to allow soul mark immunities/replacements (M1)
      if (!isReflectedIn && !sovereignStatus && SoulMarkRegistry[target.name]) {
        _reflectHookDepth++;
        try { SoulMarkRegistry[target.name](filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData); } finally { _reflectHookDepth--; }
        s = canonicalStatusName(statusData.status);
        d = statusData.duration;
        if (statusData.prevented || statusData.prevent) {
          if(statusData.immunized)notifyImmunized('statusGuard');
          return { success: false, immune: true };
        }
      }

      const filtered = sovereignStatus ? { handled: false } : TraitsEngine.filterStatusInflict(filterCtx, tSide, s, d);
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
      const latestTarget = syncStateRef.current[`${tSide}Team`].find(e=>(e.battleId||e.id)===targetId);
      if(!latestTarget)return {success:false,immune:false};
      const existingEffects = latestTarget.effects || [];
      const existing = existingEffects.find(e => e.id === s);
      
      let nextStacks = 1;
      const entry = StatusRegistry[s];
      const hasDoubleOnStack = entry?.mechanics?.some(m => m.type === 'DAMAGE_TICK' && m.params?.doubleOnStack);

      if (existing && hasDoubleOnStack) {
        nextStacks = Math.min((existing.stacks || 1) + 1, 2);
      }

      // 死亡換人（回合結束後、下回合前）附加的異常：照常在下一個回合結束扣減（不在回合開始補扣，2026-10-10）。
      const newEffect = { 
        id: s, 
        name: s, 
        duration: d, 
        isLateMover: isLate,
        stacks: nextStacks,
      };
      const nextEffects = [...existingEffects.filter(e => e.id !== s), newEffect];
      
      const nextElf: any = { ...latestTarget, effects: nextEffects };
      // 狂信：進入狀態時若自身沒有信仰對象，則本次狂信來源成為信仰對象
      if (s === '狂信' && !nextElf.faithTarget) {
        const src = self;
        if (src && tSide !== side) {
          nextElf.faithTarget = src.name;
          pushEffect({ type: 'log', side: tSide, data: { text: `🙏 【狂信】：【${target.name}】的信仰對象成為【${src.name}】！`, type: "status" } });
        }
      }
      const latest = syncStateRef.current;
      const nextTeam = [...latest[`${tSide}Team`]];
      const activeIdx = latest[`${tSide}ActiveIndex`];
      const targetIndex=nextTeam.findIndex(e=>(e.battleId||e.id)===targetId);
      if(targetIndex<0)return {success:false,immune:false};
      nextTeam[targetIndex] = nextElf;
      
      syncStateRef.current = {
        ...latest,
        ...(targetIndex===activeIdx?{[tSide]:nextElf}:{}),
        [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam
      };

      dispatch({ type: 'UPDATE_ELF', side: tSide,targetId, elf: { effects: nextEffects } });
      
      if (SoulMarkRegistry[nextElf.name]) {
        const targetCtx = getBattleEventContext(tSide, true, 0,nextElf);
        SoulMarkRegistry[nextElf.name](targetCtx, EffectTiming.SELF_STATUS_APPLIED, { ...statusData,status: s, duration: d,targetSide:tSide,sourceSide:side });
      }
      if (_statusApplyDepth <= 1) {
        try { emitStatusApplied([getBattleEventContext("p1", true, 0,tSide==='p1'?nextElf:undefined), getBattleEventContext("p2", true, 0,tSide==='p2'?nextElf:undefined)], { side: tSide, status: s, duration: d }); } catch (e) { console.error("[blocks]", e); }
      }

      return { success: true, immune: false };
      })(); } finally { _statusApplyDepth--; }
    },
    getStatuses: (e) => getStatuses(e),
    clearTurnEffectsOf: (s) => {
      const c = syncStateRef.current;
      const protectedElf = recipient(c,s);
      if (protectedElf?.ownTurnEffectsUnclearable) {
        pushEffect({ type: 'log', side: s, data: { text: `⚡ 【專屬特質】：【${protectedElf.name}】的回合類效果無法被消除！`, type: "effect" } });
        return false;
      }
      // 通用：該方在場精靈處於「回合類效果無法被消除」（turnEffectsUnclearableTurns，寫在被保護方）
      const ownerId=protectedElf.battleId||protectedElf.id;
      const ownTimers=scopedTimers(c,s,protectedElf);
      if ((readScopedRegistry(c,s,protectedElf,'turnEffectsUnclearableTurns') || 0) > 0 && hasTurnEffect(ownTimers)) {
        pushEffect({ type: 'log', side: s, data: { text: `🛡️ 【${protectedElf?.name}】的回合類效果無法被消除！`, type: 'effect' } });
        return false;
      }
      const result=clearScopedTurnEffects(c,s,protectedElf),removed=result.removed,cleared=removed.length;
      const zeroKeys: Record<string, any> = {};
      const removedRegistry:Record<string,any>={};
      for (const t of removed) for (const k of (t.payload?.mirrorRegistryKeys || [])) zeroKeys[k] = 0;
      for(const k of Object.keys(zeroKeys))removedRegistry[k]=readScopedRegistry(c,s,protectedElf,k);
      syncStateRef.current=result.state;
      dispatch({type:'SET_SCOPED_TIMERS',side:s,ownerId,timers:result.state[`${s}Timers`],ownerTimers:result.state[`${s}ElfState`]?.[ownerId]?.timers});
      if (Object.keys(zeroKeys).length) dispatch({ type: 'UPDATE_SCOPED_REGISTRY_STATE', side: s,owner:protectedElf, state: zeroKeys });
      if (cleared > 0) {
        try { SoulMarkRegistry[protectedElf.name]?.(getBattleEventContext(s, true, 0,protectedElf), EffectTiming.TURN_EFFECTS_CLEARED, { cleared, removed, removedRegistry, observerTimers:ownTimers, sourceSide: side, side: s }); } catch (e) { console.error(e); }
      }
      return cleared > 0;
    },
    hasTurnEffectOn: (s) => {
      const c = syncStateRef.current;
      return hasTurnEffect(scopedTimers(c,s,recipient(c,s)));
    },
    applyStatChange: (tSide, changes, ppChanges) => {
      const interception = { changes: { ...changes }, prevented: false, sourceSide: side };
      const originalTarget = recipient(syncStateRef.current,tSide);
      SoulMarkRegistry[originalTarget.name]?.(getBattleEventContext(tSide, true, 0,originalTarget), EffectTiming.BEFORE_STAT_CHANGE, interception);
      changes = interception.prevented ? {} : interception.changes;
      // 攔截鉤子可以更新狀態；不能用鉤子執行前的快照覆寫其結果。
      const c = syncStateRef.current;
      const target = recipient(c,tSide);
      const immuneStatDownTurns = readScopedRegistry(c,tSide,target,'immuneStatDownTurns') || 0;
      const timers=scopedTimers(c,tSide,target);
      const immuneStatDownTimer = timers.some(t => t.remaining > 0 && !t.pendingActivation &&
        (!t.ownerBattleId || t.ownerBattleId === (target.battleId || target.id)) && t.payload?.immuneStatDown);
      
      const filteredChanges = Object.entries(changes || {}).filter(([stat, value]) => {
         if(value>0&&portableSkillCapabilities(c[tSide==='p1'?'p2':'p1']).opponentBoostDisabled)return false;
         if (value < 0 && (immuneStatDownTurns > 0 || immuneStatDownTimer || hasStoneThrowerMythic(target) || Object.keys(getStatuses(target)).some(name => StatusRegistry[name]?.mechanics?.some(m => m.params?.immuneStatDebuff)))) {
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
      const targetIndex=nextTeam.findIndex(e=>(e.battleId||e.id)===(target.battleId||target.id));
      if(targetIndex<0)return {success:false,applied:{}};
      const activeIdx = tSide === 'p1' ? c.p1ActiveIndex : c.p2ActiveIndex;
      nextTeam[targetIndex] = nextElf;
      
      syncStateRef.current = {
        ...c,
        ...(targetIndex===activeIdx?{[tSide]:nextElf}:{}),
        [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam
      };

      dispatch({ type: 'UPDATE_ELF', side: tSide,targetId:target.battleId||target.id, elf: { statStages: nextElf.statStages, skills: nextElf.skills } });
      pushEffect({ type: 'log', side: tSide, data: { text: `【${target.name}】的能力發生了變化！`, type: "status" } });
      if (filteredChanges.length > 0 && target.paralyzeBothOnOwnStatChangeTurns) {
        const turns = target.paralyzeBothOnOwnStatChangeTurns;
        const otherSide = tSide === "p1" ? "p2" : "p1";
        getBattleEventContext(tSide, true, 0,target).applyStatusWithImmunityCheck(tSide, "麻痺", turns);
        getBattleEventContext(tSide, true, 0,target).applyStatusWithImmunityCheck(otherSide, "麻痺", turns);
        pushEffect({ type: 'log', side: tSide, data: { text: `⚡ 【異】：自身能力等級被改變，雙方麻痺${turns}回合！`, type: "effect" } });
      }
      return { success: Object.keys(applied).length > 0, applied };
    },
    applyShield: (tSide, amount) => {
      const c = syncStateRef.current;
      const target = recipient(c,tSide);
      if(amount>0&&portableSkillCapabilities(target).shieldsBlocked)return;
      const nextShield = (target.shield || 0) + amount;
      
      const nextElf = { ...target, shield: nextShield };
      const nextTeam = [...(tSide === 'p1' ? c.p1Team : c.p2Team)];
      const activeIdx = tSide === 'p1' ? c.p1ActiveIndex : c.p2ActiveIndex;
      const targetIndex=nextTeam.findIndex(e=>(e.battleId||e.id)===(target.battleId||target.id));
      if(targetIndex<0)return;
      nextTeam[targetIndex] = nextElf;
      
      syncStateRef.current = {
        ...c,
        ...(targetIndex===activeIdx?{[tSide]:nextElf}:{}),
        [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam
      };

      dispatch({ type: 'UPDATE_ELF', side: tSide,targetId:target.battleId||target.id, elf: { shield: nextShield } });
    },
  };
}

export function buildStateAPIs(shared: SharedContextDeps): StateAPIs {
  const { side, moveIndex, syncStateRef, dispatch, pushEffect, isP1, self, getBattleEventContext } = shared;
  
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
      if (tElf?.battleId) {
        idx = team.findIndex(e => e.battleId === tElf.battleId);
      } else if (tElf?.id) {
        idx = team.findIndex(e => e.id === tElf.id);
      }
      if (!tElf) {
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
          // 2026-10-30：消逝等於下場，剝離該精靈身上的符文。
          // 官方：「符文於選擇技能階段時激活直到該精靈下場後剝離」，
          // 否則死後符文仍為「已激活」，效果持續生效（全程生效／類兩命）。
          skills: (elfToVanish.skills || []).map((s: any) => {
            const { skillRune, isRuneActive, specialBadge, ...rest } = s;
            return rest;
          }), 
          isVanished: true 
        };
        enforceMaximumHealthLock(updatedElf);
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
    grantBattleItem: (inventorySide, itemId, count = 1) => {
      const current = syncStateRef.current;
      const next = grantBattleItem(current[`${inventorySide}ItemInventory`], itemId, count);
      if (!next) return false;
      syncStateRef.current = { ...current, [`${inventorySide}ItemInventory`]: next };
      dispatch({ type: 'SET_ITEM_INVENTORY', side: inventorySide, inventory: next });
      return true;
    },
    useBattleItem: (inventorySide, itemId, recipient = side, picked) => {
      const catalogItem = BATTLE_ITEMS.find(item => item.id === itemId);
      const item = catalogItem && picked ? { ...catalogItem, picked } : catalogItem;
      const current = syncStateRef.current;
      // 需選擇對象的道具：對象不合法時不扣庫存、不產生任何效果。
      if (item?.pickTarget && !(picked && findBagElf({ p1: current.p1Team, p2: current.p2Team }, picked.side, picked.battleId))) return false;
      const holder = recipient === side ? current[`${side}Team`].find(elf => (elf.battleId || elf.id) === (self.battleId || self.id)) || current[side] : current[recipient];
      if (!item || isElfItemDisabled(holder)) return false;
      const inventory = current[`${inventorySide}ItemInventory`];
      // 未配置正式庫存時只允許原模式正常使用；不能憑空偷取。
      if (!inventory && inventorySide !== recipient) return false;
      if (inventory) {
        const next = consumeBattleItem(inventory, itemId);
        if (!next) return false;
        syncStateRef.current = { ...current, [`${inventorySide}ItemInventory`]: next };
        dispatch({ type: 'SET_ITEM_INVENTORY', side: inventorySide, inventory: next });
      }
      // 星蝕回廊：藥劑的固定回復量隨層數乘 √depthMul（一般對戰＝1）；PP 回復與狀態清除不縮放
      const mul = fixedValueMul(current[recipient === 'p1' ? 'p1Relics' : 'p2Relics']);
      return applyBattleItem(getBattleEventContext(recipient, true, moveIndex, holder), mul !== 1 && item.value ? { ...item, value: Math.round(item.value * mul) } : item, recipient);
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
    getAllMarks: (targetSide) => syncStateRef.current[`${targetSide}Marks` as "p1Marks" | "p2Marks"] || [],
    getMarks: (targetSide) => {
      const c = syncStateRef.current;
      const marksKey = `${targetSide}Marks` as "p1Marks" | "p2Marks";
      const holder = targetSide === side ? self : c[targetSide];
      return (c[marksKey] || []).filter(mark => markAppliesToElf(mark, holder));
    },
    clearMark: (id, targetSide, ownerBattleId) => {
      const c = syncStateRef.current;
      const actorSide = targetSide || side;
      const marksKey = `${actorSide}Marks` as "p1Marks" | "p2Marks";
      const curMarks = c[marksKey] || [];
      const holder = actorSide === side ? self : c[actorSide];
      const nextMarks = curMarks.filter(mark => mark.id !== id || (ownerBattleId===undefined?!markAppliesToElf(mark,holder):(mark.ownerBattleId||null)!==ownerBattleId));
      
      syncStateRef.current = setBattleSideMarks(c, actorSide, nextMarks);

      dispatch({ type: 'SET_MARKS', side: actorSide, marks: nextMarks });
    },
    queueExtraAction: (owner, action) => {
      const c = syncStateRef.current as any;
      syncStateRef.current = { ...c, extraActionQueue: [...(c.extraActionQueue || []), { ...action, owner }] } as any;
    },
    consumeTimer: (s, id) => {
      const c = syncStateRef.current;
      const owner=s===side?self:c[s];
      syncStateRef.current=consumeScopedTimer(c,s,owner,id);
      // 引擎dispatch以同一syncState為起點；必須派發替換快照，否則再扣一次。
      const next=syncStateRef.current,ownerId=owner.battleId||owner.id;
      dispatch({type:'SET_SCOPED_TIMERS',side:s,ownerId,timers:next[`${s}Timers`],ownerTimers:next[`${s}ElfState`]?.[ownerId]?.timers});
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
      // Dispatch shares this live state with the engine. Replaying ADD doubles extend/stack counters.
      const next=syncStateRef.current,ownerId=owner.battleId||owner.id;
      dispatch({type:'SET_SCOPED_TIMERS',side:s,ownerId,timers:next[`${s}Timers`],ownerTimers:next[`${s}ElfState`]?.[ownerId]?.timers});
    },
    updateElf: (tSide, elfUpdates) => {
      shared.checkResourceTransitions?.();
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
      elfUpdates = normalizePpPatch(trackIllusionStatWrite(target, portableShieldPatch(target,elfUpdates)));
      if(elfUpdates.shield!==undefined)elfUpdates={...elfUpdates,shield:retainShield(target,elfUpdates.shield)};
      if((target as any).maximumHealthLock){
        const locked={...target,...elfUpdates,maximumHealthLock:(target as any).maximumHealthLock,calculatedStats:{...target.calculatedStats,...elfUpdates.calculatedStats}};
        enforceMaximumHealthLock(locked);
        elfUpdates={...elfUpdates,maxHp:locked.maxHp,currentHp:locked.currentHp,calculatedStats:locked.calculatedStats};
      }
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
      shared.checkResourceTransitions?.();
      if(patchesStatuses(elfUpdates))for(const ended of removedStatusEvents(target,nextElf))
        SoulMarkRegistry[nextElf.name]?.(getBattleEventContext(tSide,true,0,nextElf),EffectTiming.ON_STATUS_ENDED,{...ended,targetSide:tSide,sourceSide:side});
      if (elfUpdates.statStages && tSide !== side) {
        const removedStages = Object.fromEntries(Object.entries(target.statStages || {}).filter(([k, v]) => typeof v === 'number' && v > 0 && Number(nextElf.statStages?.[k] || 0) < v));
        if (Object.keys(removedStages).length) SoulMarkRegistry[target.name]?.(getBattleEventContext(tSide, true, 0, nextElf), EffectTiming.STAT_BOOST_CLEARED, { removedStages, sourceSide: side });
      }
    },
    contextForElf: (ownerSide, owner) => {
      const current = syncStateRef.current[`${ownerSide}Team`].find(e => (e.battleId || e.id) === (owner.battleId || owner.id));
      return getBattleEventContext(ownerSide, true, moveIndex, current || owner);
    },
    emitElfEvent: (ownerSide, owner, event, data) => {
      const current = syncStateRef.current[`${ownerSide}Team`].find(e => (e.battleId || e.id) === (owner.battleId || owner.id));
      if (!current) return;
      const ctx = getBattleEventContext(ownerSide, true, 0, current);
      SoulMarkRegistry[current.name]?.(ctx, event, data);
    },
    updateAnyElf: (tSide, battleId, patch) => {
      shared.checkResourceTransitions?.();
      const c = syncStateRef.current;
      const patchTarget = c[`${tSide}Team`].find(e => (e.battleId || e.id) === battleId || e.id === battleId);
      if (patchTarget) patch = normalizePpPatch(trackIllusionStatWrite(patchTarget, portableShieldPatch(patchTarget,patch)));
      if(patchTarget&&patch.shield!==undefined)patch={...patch,shield:retainShield(patchTarget,patch.shield)};
      if((patchTarget as any)?.maximumHealthLock){
        const locked={...patchTarget,...patch,maximumHealthLock:(patchTarget as any).maximumHealthLock,calculatedStats:{...patchTarget?.calculatedStats,...patch.calculatedStats}};
        enforceMaximumHealthLock(locked);
        patch={...patch,maxHp:locked.maxHp,currentHp:locked.currentHp,calculatedStats:locked.calculatedStats};
      }
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
      shared.checkResourceTransitions?.();
      const after=syncStateRef.current[`${tSide}Team`].find(e=>(e.battleId||e.id)===battleId||e.id===battleId);
      if(patchTarget&&after&&patchesStatuses(patch))for(const ended of removedStatusEvents(patchTarget,after))
        SoulMarkRegistry[after.name]?.(getBattleEventContext(tSide,true,0,after),EffectTiming.ON_STATUS_ENDED,{...ended,targetSide:tSide,sourceSide:side});
    },
    getPlayerState: (k) => {
      const c = syncStateRef.current;
      return readScopedRegistry(c, side, self, k);
    },
    setPlayerState: (k, v, acquiredSource) => {
      const c = syncStateRef.current;
      const currentOwner = c[`${side}Team`].find(e => (e.battleId || e.id) === (self.battleId || self.id)) || self;
      const patch = trackNativeRegistryWrite(currentOwner, k, v, acquiredSource);
      if (patch) {
        const nextOwner = { ...currentOwner, ...patch };
        const team = c[`${side}Team`].map(e => (e.battleId || e.id) === (self.battleId || self.id) ? nextOwner : e);
        syncStateRef.current = { ...c, [`${side}Team`]: team,
          ...((c[side].battleId || c[side].id) === (self.battleId || self.id) ? { [side]: nextOwner } : {}) };
        dispatch({ type: 'UPDATE_ELF', side, elf: patch, targetId: self.battleId || self.id });
      }
      syncStateRef.current = writeScopedRegistry(syncStateRef.current, side, self, { [k]: v });
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
      const owner=tSide===side?self:c[tSide];
      const pend = { ...(readScopedRegistry(c,tSide,owner,PENDING_TURNS_KEY) || {}), [key]: Math.max(0, Math.floor(n)) };
      syncStateRef.current = writeScopedRegistry(c,tSide,owner,{[PENDING_TURNS_KEY]:pend});
      dispatch({ type: 'UPDATE_SCOPED_REGISTRY_STATE', side: tSide,owner, state: { [PENDING_TURNS_KEY]: pend } });
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
