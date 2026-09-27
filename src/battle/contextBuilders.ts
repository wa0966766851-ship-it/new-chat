import React, { MutableRefObject, Dispatch } from "react";
import { Elf, Skill } from "../types";
import { Mark } from "./marks";
import { BattleState, BattleAction, EffectItem } from "../components/BattleManager";
import { BattleEventContext, EffectTiming, DamageComputation, PriorityComputation } from "../effects/types";
import { Timer } from "./timers";
import { getTypeMatchup } from "../utils/statCalculator";
import { emitStatusApplied } from "../blocks/registry";
import { SoulMarkRegistry } from "../effects/battleEventRegistry";
import { SuitEffectRegistry } from "../effects/suitEffectRegistry";
import { applyStatChanges } from "../utils/statChangeManager";
import { TraitsEngine } from "../utils/traitsEngine";
import { getStatuses, shuffleArray, clampSkillPp } from "../utils/battleHelpers";
import { StatusRegistry } from "../effects/statusRegistry";
import { clearTurnEffects, hasTurnEffect, addTimer, getScaledParam } from "./timers";
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
  "shuffleArray" | "getEligibleTeam" | "getFullTeam" | "getFirstStarter" | "getNthElf" | "getAdjacentElves" | "getSeparatedElves" | "trackCodeExec"
>;

export function applyActiveGateTimersToDamage(
  actorSide: "p1" | "p2",
  tSide: "p1" | "p2",
  damageComp: DamageComputation,
  pushEffect: (effect: EffectItem) => void,
  syncStateRef: MutableRefObject<BattleState>
) {
  const c = syncStateRef.current;
  
  // 1. Dealt damage reduction (gate timers on the actor side)
  const actorTimers = c[`${actorSide}Timers` as "p1Timers" | "p2Timers"] || [];
  for (const timer of actorTimers) {
    const wraps = Array.isArray(timer.payload?.wraps) ? timer.payload.wraps : [timer.payload?.wraps];
    if (timer.payload?.applyMode === "gate" && wraps.includes("damage_reduce")) {
      const reducePercent = getScaledParam(timer, "percent", 50);
      damageComp.decreasePercent = (damageComp.decreasePercent || 0) + reducePercent / 100;
      pushEffect({
        type: 'log',
        side: actorSide,
        data: {
          text: `🛡️ 【${timer.name}】：造成的傷害減少 ${reducePercent}%！`,
          type: "effect"
        }
      });
    }
  }

  // 2. Target side damage reduction (e.g. 守護印記)
  const targetTimers = c[`${tSide}Timers` as "p1Timers" | "p2Timers"] || [];
  for (const timer of targetTimers) {
    const wraps = Array.isArray(timer.payload?.wraps) ? timer.payload.wraps : [timer.payload?.wraps];
    if (timer.payload?.applyMode === "gate" && wraps.includes("damage_reduce")) {
      const reducePercent = getScaledParam(timer, "percent", 50);
      damageComp.decreasePercent = (damageComp.decreasePercent || 0) + reducePercent / 100;
      pushEffect({
        type: 'log',
        side: tSide,
        data: {
          text: `🛡️ 【${timer.name}】：受到的傷害減少 ${reducePercent}%！`,
          type: "effect"
        }
      });
    }
  }

  // 3. Actor side damage multiplier (dealt damage boost)
  for (const timer of actorTimers) {
    const wraps = Array.isArray(timer.payload?.wraps) ? timer.payload.wraps : [timer.payload?.wraps];
    if (timer.payload?.applyMode === "gate" && wraps.includes("damage_multiplier")) {
      const mult = getScaledParam(timer, "multiplier", 1.5);
      damageComp.multiplier = (damageComp.multiplier || 1.0) * mult;
      pushEffect({
        type: 'log',
        side: actorSide,
        data: {
          text: `🔥 【${timer.name}】：造成的傷害乘以 ${mult} 倍！`,
          type: "effect"
        }
      });
    }
  }

  // 4. Target side damage multiplier (taken damage vulnerability, e.g. 黯痕)
  for (const timer of targetTimers) {
    const wraps = Array.isArray(timer.payload?.wraps) ? timer.payload.wraps : [timer.payload?.wraps];
    if (timer.payload?.applyMode === "gate" && wraps.includes("damage_multiplier")) {
      const mult = getScaledParam(timer, "multiplier", 1.5);
      damageComp.multiplier = (damageComp.multiplier || 1.0) * mult;
      pushEffect({
        type: 'log',
        side: tSide,
        data: {
          text: `💀 【${timer.name}】：受到的傷害乘以 ${mult} 倍！`,
          type: "effect"
        }
      });
    }
  }
}

export function buildDamageAPIs(shared: SharedContextDeps): DamageAPIs {
  const { side, moveIndex, syncStateRef, pushEffect, getBattleEventContext, self } = shared;
  
  return {
    applyPinkDamage: (tSide, amt, label, aP1, aP2, dmgType) => {
      const c = syncStateRef.current;
      const tOpp = tSide === "p1" ? c.p1 : c.p2;
      let baseVal = Math.floor(amt);
      
      // 屬性克制只影響攻擊技能的直接傷害；固定／百分比傷害不吃克制倍率
      void dmgType;

      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: (dmgType || "fixed") as any,
        skillType: self.type,
        isIncoming: true
      } as any;

      if (_secondaryDamageDepth === 0) {
        _secondaryDamageDepth++;
        try {
          if (SoulMarkRegistry[tOpp.name]) {
             const oppCtx = getBattleEventContext(tSide, true, moveIndex);
             SoulMarkRegistry[tOpp.name](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
          }

          const suitId = tSide === "p1" ? c.p1Suit : c.p2Suit;
          if (suitId && SuitEffectRegistry[suitId]) {
             const oppCtx = getBattleEventContext(tSide, true, moveIndex);
             SuitEffectRegistry[suitId](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
          }
        } finally {
          _secondaryDamageDepth--;
        }
      }

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = tSide === "p1" ? "p2" : "p1";
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      for (const mark of actorMarks) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          damageComp.multiplier = (damageComp.multiplier || 1.0) * mark.effects.nonTrueDamageDealtMultiplier;
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      // Scan target's marks for nonTrueDamageTakenMultiplier
      const oppMarksAll = tSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
      for (const mark of (oppMarksAll || [])) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0) {
          damageComp.multiplier = (damageComp.multiplier || 1.0) * mark.effects.nonTrueDamageTakenMultiplier;
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      for (const mark of (oppMarksAll || [])) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef);

      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * (1 - damageComp.decreasePercent);
      const stage2 = stage1 * damageComp.multiplier;
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3));

      pushEffect({ type: 'damage', side: tSide, data: { amount: finalDamage, label: label || "附加傷害", popup: true, sourceElfName: self.name, damageType: damageComp.damageCategory } });
      return finalDamage;
    },
    applySkillTypeDamage: (tSide, amt, label, opts) => {
      const c = syncStateRef.current;
      const tOpp = tSide === "p1" ? c.p1 : c.p2;
      let baseVal = Math.floor(amt);

      // 「X系技能傷害」以該屬性計算克制（未指定時用自身屬性）
      const elemType = opts?.elem || self.type;
      if (elemType && tOpp.type) {
        const typeMult = getTypeMatchup(elemType, tOpp.type);
        baseVal = Math.floor(baseVal * typeMult);
      }

      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: opts?.category || "skill_attack",
        skillType: elemType,
        isTypedSkill: !opts?.category, // X系技能傷害（非攻擊公式）
        isIncoming: true
      } as any;

      if (_secondaryDamageDepth === 0) {
        _secondaryDamageDepth++;
        try {
          if (SoulMarkRegistry[tOpp.name]) {
             const oppCtx = getBattleEventContext(tSide, true, moveIndex);
             SoulMarkRegistry[tOpp.name](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
          }

          const suitId = tSide === "p1" ? c.p1Suit : c.p2Suit;
          if (suitId && SuitEffectRegistry[suitId]) {
             const oppCtx = getBattleEventContext(tSide, true, moveIndex);
             SuitEffectRegistry[suitId](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
          }
        } finally {
          _secondaryDamageDepth--;
        }
      }

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = tSide === "p1" ? "p2" : "p1";
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      for (const mark of actorMarks) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          damageComp.multiplier = (damageComp.multiplier || 1.0) * mark.effects.nonTrueDamageDealtMultiplier;
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      // Scan target's marks for nonTrueDamageTakenMultiplier
      const oppMarksAll = tSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
      for (const mark of (oppMarksAll || [])) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0) {
          damageComp.multiplier = (damageComp.multiplier || 1.0) * mark.effects.nonTrueDamageTakenMultiplier;
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      for (const mark of (oppMarksAll || [])) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef);

      // 無視對手抵擋傷害（乘區被歸零）／無視傷害限制／保底傷害
      if (opts?.ignoreBlock && damageComp.multiplier === 0) damageComp.multiplier = 1;
      if (opts?.ignoreLimit) delete damageComp.limit;
      if (opts?.floor !== undefined) damageComp.floor = Math.max(damageComp.floor ?? 0, Math.floor(opts.floor));

      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * (1 - damageComp.decreasePercent);
      const stage2 = stage1 * damageComp.multiplier;
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3));

      pushEffect({ type: 'damage', side: tSide, data: { amount: finalDamage, label: label || "附加技能傷害", popup: true, sourceElfName: self.name, damageType: opts?.category || "skill_attack", typedSkill: !opts?.category } });
      return finalDamage;
    },
    applyTrueDamage: (tSide, amt, label, p1Override, p2Override) => {
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

      if (SoulMarkRegistry[tOpp.name]) {
         const oppCtx = getBattleEventContext(tSide, true, moveIndex);
         SoulMarkRegistry[tOpp.name](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
      }

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = tSide === "p1" ? "p2" : "p1";
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      for (const mark of actorMarks) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      // Scan target's marks for nonTrueDamageTakenMultiplier
      const oppMarksAll = tSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
      for (const mark of (oppMarksAll || [])) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0) {
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      for (const mark of (oppMarksAll || [])) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      // 真實傷害不受減傷與減縮影響，僅接受增傷
      const safeDecreasePercent = 0;
      let safeMultiplier = Math.max(1.0, damageComp.multiplier || 1.0);

      // If there's a custom non-true damage multiplier active, apply it even to true damage!
      let markMult = 1.0;
      for (const mark of actorMarks) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          markMult *= mark.effects.nonTrueDamageDealtMultiplier;
        }
      }
      for (const mark of oppMarksAll) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0) {
          markMult *= mark.effects.nonTrueDamageTakenMultiplier;
        }
      }
      if (markMult !== 1.0) {
        safeMultiplier = safeMultiplier * markMult;
      }

      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef);

      const stage1 = damageComp.base * (1 + (damageComp.increasePercent || 0)) * (1 - safeDecreasePercent);
      const stage2 = stage1 * safeMultiplier;
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3));

      pushEffect({ type: 'damage', side: tSide, data: { amount: finalDamage, label, popup: true, sourceElfName: self.name, damageType: "true" } });
      return finalDamage;
    },
    applyAbsorb: (tSide, amt) => {
      const val = Math.floor(amt);
      const actorSide = side; 
      const actualDmg = getBattleEventContext(actorSide, true, moveIndex).applyTrueDamage(tSide, val, "汲取");
      getBattleEventContext(actorSide, true, moveIndex).applyHeal(actorSide, actualDmg);
    },
    applyHeal: (tSide, amt) => pushEffect({ type: 'heal', side: tSide, data: { amount: Math.floor(amt) } }),
    adjustHp: (tSide, amt) => pushEffect({ type: 'adjust_hp', side: tSide, data: { amount: Math.floor(amt) } }),
    applyPercentDamage: (tSide, p) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      const baseVal = Math.floor(target.maxHp * p);

      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: "percent",
        isIncoming: true
      } as any;

      if (_secondaryDamageDepth === 0) {
        _secondaryDamageDepth++;
        try {
          if (SoulMarkRegistry[target.name]) {
             const oppCtx = getBattleEventContext(tSide, true, moveIndex);
             SoulMarkRegistry[target.name](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
          }

          const suitId = tSide === "p1" ? c.p1Suit : c.p2Suit;
          if (suitId && SuitEffectRegistry[suitId]) {
             const oppCtx = getBattleEventContext(tSide, true, moveIndex);
             SuitEffectRegistry[suitId](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
          }
        } finally {
          _secondaryDamageDepth--;
        }
      }

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = tSide === "p1" ? "p2" : "p1";
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      for (const mark of actorMarks) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          damageComp.multiplier = (damageComp.multiplier || 1.0) * mark.effects.nonTrueDamageDealtMultiplier;
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      const actorRegKey = `${actorSide}RegistryState` as 'p1RegistryState' | 'p2RegistryState';
      const actorRegState = c[actorRegKey] || {};
      if (actorRegState.DarkScarTurns > 0) {
        damageComp.multiplier = (damageComp.multiplier || 1.0) * 0.5;
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
      for (const mark of (oppMarksAll || [])) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0) {
          damageComp.multiplier = (damageComp.multiplier || 1.0) * mark.effects.nonTrueDamageTakenMultiplier;
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      for (const mark of (oppMarksAll || [])) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef);

      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * (1 - damageComp.decreasePercent);
      const stage2 = stage1 * damageComp.multiplier;
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3));

      pushEffect({ type: 'damage', side: tSide, data: { amount: finalDamage, label: "百分比傷害", popup: true, sourceElfName: self.name, damageType: "percent" } });
    },
    applyFixedDamage: (tSide, amt, label) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      const baseVal = Math.floor(amt);

      const damageComp: DamageComputation = {
        base: baseVal,
        increasePercent: 0,
        decreasePercent: 0,
        multiplier: 1.0,
        damageCategory: "fixed",
        isIncoming: true
      } as any;

      if (_secondaryDamageDepth === 0) {
        _secondaryDamageDepth++;
        try {
          if (SoulMarkRegistry[target.name]) {
             const oppCtx = getBattleEventContext(tSide, true, moveIndex);
             SoulMarkRegistry[target.name](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
          }

          const suitId = tSide === "p1" ? c.p1Suit : c.p2Suit;
          if (suitId && SuitEffectRegistry[suitId]) {
             const oppCtx = getBattleEventContext(tSide, true, moveIndex);
             SuitEffectRegistry[suitId](oppCtx, EffectTiming.BEFORE_DAMAGE, withSelfRef(damageComp));
          }
        } finally {
          _secondaryDamageDepth--;
        }
      }

      // Scan actor's marks for nonTrueDamageDealtMultiplier
      const actorSide = tSide === "p1" ? "p2" : "p1";
      const actorMarks = syncStateRef.current[`${actorSide}Marks` as "p1Marks" | "p2Marks"] || [];
      for (const mark of actorMarks) {
        if (mark.effects?.nonTrueDamageDealtMultiplier !== undefined && mark.count > 0) {
          damageComp.multiplier = (damageComp.multiplier || 1.0) * mark.effects.nonTrueDamageDealtMultiplier;
          pushEffect({
            type: 'log',
            side: actorSide,
            data: {
              text: `🌀 【${mark.name}】：使造成的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageDealtMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      const actorRegKey = `${actorSide}RegistryState` as 'p1RegistryState' | 'p2RegistryState';
      const actorRegState = c[actorRegKey] || {};
      if (actorRegState.DarkScarTurns > 0) {
        damageComp.multiplier = (damageComp.multiplier || 1.0) * 0.5;
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
      for (const mark of (oppMarksAll || [])) {
        if (mark.effects?.nonTrueDamageTakenMultiplier !== undefined && mark.count > 0) {
          damageComp.multiplier = (damageComp.multiplier || 1.0) * mark.effects.nonTrueDamageTakenMultiplier;
          pushEffect({
            type: 'log',
            side: tSide,
            data: {
              text: `🌀 【${mark.name}】：使受到的固定/百分比/真實傷害調整為 ${Math.round(mark.effects.nonTrueDamageTakenMultiplier * 100)}%！`,
              type: "effect"
            }
          });
        }
      }

      for (const mark of (oppMarksAll || [])) {
        const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
        if (perStack && mark.count > 0) {
          damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
          pushEffect({ type: 'log', side: tSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到攻擊傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
        }
      }

      applyActiveGateTimersToDamage(actorSide, tSide, damageComp, pushEffect, syncStateRef);

      const stage1 = damageComp.base * (1 + damageComp.increasePercent) * (1 - damageComp.decreasePercent);
      const stage2 = stage1 * damageComp.multiplier;
      const stage3 = damageComp.limit !== undefined ? Math.min(stage2, damageComp.limit) : stage2;
      const finalDamage = Math.floor(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3));

      pushEffect({ type: 'damage', side: tSide, data: { amount: finalDamage, label: label || "固定傷害", popup: true, sourceElfName: self.name, damageType: "fixed" } });
      return finalDamage;
    },
  };
}

export function buildStatusAPIs(shared: SharedContextDeps): StatusAPIs {
  const { side, moveIndex, syncStateRef, dispatch, pushEffect, getBattleEventContext } = shared;
  
  return {
    applyStatusWithImmunityCheck: (tSide, s, d) => {
      // 反彈／轉嫁類效果互相觸發時的遞迴保護（雙方都有「反彈異常」會無限互彈直到堆疊溢位）
      if (_statusApplyDepth >= 3) return { success: false, immune: true };
      _statusApplyDepth++;
      try { return ((): { success: boolean; immune: boolean } => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;

      // Check active gate timers on target side for wraps === "immune"
      const targetTimers = c[`${tSide}Timers` as "p1Timers" | "p2Timers"] || [];
      for (const timer of targetTimers) {
        const wraps = Array.isArray(timer.payload?.wraps) ? timer.payload.wraps : [timer.payload?.wraps];
        if (timer.payload?.applyMode === "gate" && wraps.includes("immune")) {
          pushEffect({
            type: 'log',
            side: tSide,
            data: { text: `🛡️ 【${timer.name}】：處於技能免疫狀態，免疫異常狀態！`, type: "info" }
          });
          return { success: false, immune: true };
        }
      }

      // 通用異常免疫／反彈（immuneStatusTurns 過去只有寫入、從未被讀取，導致各精靈的「免疫異常」效果全部無效）
      if (tSide !== side) {
        const targetRegState = c[`${tSide}RegistryState` as 'p1RegistryState' | 'p2RegistryState'] || {};
        if ((targetRegState.reflectStatusTurns || 0) > 0 && !_reflectingStatus && _reflectHookDepth === 0) {
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
        if ((targetRegState.immuneStatusTurns || 0) > 0 || (targetRegState.reflectStatusTurns || 0) > 0) {
          pushEffect({ type: 'log', side: tSide, data: { text: `🛡️ 【異常免疫】：【${target.name}】免疫了【${s}】！`, type: "info" } });
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

      // §47: Suit BEFORE_STATUS_APPLY
      const suitId = tSide === 'p1' ? c.p1Suit : c.p2Suit;
      const statusData: { status: string; duration: number; prevented: boolean; prevent?: boolean } = { status: s, duration: d, prevented: false };
      const isReflectedIn = _reflectHookDepth > 0; // 被反彈過來的異常：不再響應攔截／反彈
      if (!isReflectedIn && suitId && SuitEffectRegistry[suitId]) {
        _reflectHookDepth++;
        try { SuitEffectRegistry[suitId](filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData); } finally { _reflectHookDepth--; }
        s = statusData.status;
        d = statusData.duration;
        if (statusData.prevented || statusData.prevent) {
          return { success: false, immune: true };
        }
      }

      // Also call SoulMarkRegistry for BEFORE_STATUS_APPLY to allow soul mark immunities/replacements (M1)
      if (!isReflectedIn && SoulMarkRegistry[target.name]) {
        _reflectHookDepth++;
        try { SoulMarkRegistry[target.name](filterCtx, EffectTiming.BEFORE_STATUS_APPLY, statusData); } finally { _reflectHookDepth--; }
        s = statusData.status;
        d = statusData.duration;
        if (statusData.prevented || statusData.prevent) {
          return { success: false, immune: true };
        }
      }

      const filtered = TraitsEngine.filterStatusInflict(filterCtx, tSide, s, d);
      if (filtered.handled) {
        if (!filtered.overrideStatus) {
           // §47: Suit ON_STATUS_IMMUNIZED
           if (suitId && SuitEffectRegistry[suitId]) {
             SuitEffectRegistry[suitId](filterCtx, EffectTiming.ON_STATUS_IMMUNIZED);
           }
           if (SoulMarkRegistry[target.name]) {
             SoulMarkRegistry[target.name](filterCtx, EffectTiming.ON_STATUS_IMMUNIZED, { status: s });
           }
           return { success: false, immune: true };
        }
        s = filtered.overrideStatus;
        d = filtered.overrideDuration ?? d;
      }

      const isLate = (moveIndex === 1 && tSide === side);
      const existingEffects = target.effects || [];
      const existing = existingEffects.find(e => e.id === s);
      
      let nextStacks = 1;
      const entry = StatusRegistry[s];
      const hasDoubleOnStack = entry?.mechanics?.some(m => m.type === 'DAMAGE_TICK' && m.params?.doubleOnStack);

      if (existing && hasDoubleOnStack) {
        nextStacks = Math.min((existing.stacks || 1) + 1, 2);
      }

      const newEffect = { 
        id: s, 
        name: s, 
        duration: d, 
        isLateMover: isLate,
        stacks: nextStacks
      };
      const nextEffects = [...existingEffects.filter(e => e.id !== s), newEffect];
      
      const nextElf: any = { ...target, effects: nextEffects };
      // 狂信：進入狀態時若自身沒有信仰對象，則本次狂信來源成為信仰對象
      if (s === '狂信' && !nextElf.faithTarget) {
        const src = side === 'p1' ? c.p1 : c.p2;
        if (src && tSide !== side) {
          nextElf.faithTarget = src.name;
          pushEffect({ type: 'log', side: tSide, data: { text: `🙏 【狂信】：【${target.name}】的信仰對象成為【${src.name}】！`, type: "status" } });
        }
      }
      const nextTeam = [...(tSide === 'p1' ? c.p1Team : c.p2Team)];
      const activeIdx = tSide === 'p1' ? c.p1ActiveIndex : c.p2ActiveIndex;
      nextTeam[activeIdx] = nextElf;
      
      syncStateRef.current = {
        ...c,
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
      const timersKey = `${s}Timers` as "p1Timers" | "p2Timers";
      const curTimers = c[timersKey];
      const [next, cleared] = clearTurnEffects(curTimers);
      
      syncStateRef.current = {
        ...c,
        [timersKey]: next
      };

      dispatch({ type: 'SET_TIMERS', side: s, timers: next });
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
         if (value < 0 && immuneStatDownTurns > 0) {
            pushEffect({ type: 'log', side: tSide, data: { text: `🛡️ 【能力下降免疫】：【${target.name}】免疫了能力下降！`, type: "effect" } });
            return false;
         }
         return true;
      });
      if (filteredChanges.length === 0 && !ppChanges) return;

      const result = applyStatChanges(target, filteredChanges.map(([stat, value]) => ({ stat: stat as any, value })));
      
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
  const { side, syncStateRef, dispatch, pushEffect, isP1, self } = shared;
  
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
      const nextMark = { ...m, source: m.source || (self.name + " / " + (self.soulMark?.badgeChar || "")) };
      const nextMarks = setMarkUtil(curMarks, nextMark as Mark);
      
      const activeElf = actorSide === "p1" ? c.p1 : c.p2;
      if (activeElf) {
        activeElf.marks = nextMarks;
        const teamKey = actorSide === "p1" ? "p1Team" : "p2Team";
        const activeIdx = actorSide === "p1" ? c.p1ActiveIndex : c.p2ActiveIndex;
        if (c[teamKey] && c[teamKey][activeIdx]) {
          c[teamKey][activeIdx].marks = nextMarks;
        }
      }

      syncStateRef.current = {
        ...c,
        [marksKey]: nextMarks
      };

      dispatch({ type: 'SET_MARKS', side: actorSide, marks: nextMarks });
    },
    getMarks: (targetSide) => {
      const c = syncStateRef.current;
      const marksKey = `${targetSide}Marks` as "p1Marks" | "p2Marks";
      return c[marksKey] || [];
    },
    clearMark: (id, targetSide) => {
      const c = syncStateRef.current;
      const actorSide = targetSide || side;
      const marksKey = `${actorSide}Marks` as "p1Marks" | "p2Marks";
      const curMarks = c[marksKey] || [];
      const nextMarks = clearMarkUtil(curMarks, id);
      
      const activeElf = actorSide === "p1" ? c.p1 : c.p2;
      if (activeElf) {
        activeElf.marks = nextMarks;
        const teamKey = actorSide === "p1" ? "p1Team" : "p2Team";
        const activeIdx = actorSide === "p1" ? c.p1ActiveIndex : c.p2ActiveIndex;
        if (c[teamKey] && c[teamKey][activeIdx]) {
          c[teamKey][activeIdx].marks = nextMarks;
        }
      }

      syncStateRef.current = {
        ...c,
        [marksKey]: nextMarks
      };

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
      const next = addTimer(curTimers, timer, { isLateMover });
      
      syncStateRef.current = {
        ...c,
        [timersKey]: next
      };

      dispatch({ type: 'SET_TIMERS', side: s, timers: next });
    },
    updateElf: (tSide, elfUpdates) => {
      const c = syncStateRef.current;
      const target = tSide === 'p1' ? c.p1 : c.p2;
      const isUpdatingActive = !elfUpdates.id || elfUpdates.id === target.id;
      
      if (isUpdatingActive) {
        const nextElf = { ...target, ...elfUpdates };
        syncStateRef.current = {
          ...c,
          [tSide]: nextElf,
          [tSide === 'p1' ? 'p1Team' : 'p2Team']: c[tSide === 'p1' ? 'p1Team' : 'p2Team'].map(e => e.id === nextElf.id ? nextElf : e)
        };
        dispatch({ type: 'UPDATE_ELF', side: tSide, elf: elfUpdates });
      } else {
        const nextTeam = c[tSide === 'p1' ? 'p1Team' : 'p2Team'].map(e => {
          if (e.id === elfUpdates.id) {
            return { ...e, ...elfUpdates };
          }
          return e;
        });
        syncStateRef.current = {
          ...c,
          [tSide === 'p1' ? 'p1Team' : 'p2Team']: nextTeam
        };
        dispatch({ type: 'UPDATE_TEAM', side: tSide, team: nextTeam });
      }
    },
    updateAnyElf: (tSide, battleId, patch) => {
      const c = syncStateRef.current;
      const targetActive = tSide === 'p1' ? c.p1 : c.p2;
      const isUpdatingActive = targetActive.id === battleId;

      if (isUpdatingActive) {
        const nextElf = { ...targetActive, ...patch, id: battleId }; // ensure id is retained
        syncStateRef.current = {
          ...c,
          [tSide]: nextElf,
          [tSide === 'p1' ? 'p1Team' : 'p2Team']: c[tSide === 'p1' ? 'p1Team' : 'p2Team'].map(e => e.id === nextElf.id ? nextElf : e)
        };
        dispatch({ type: 'UPDATE_ELF', side: tSide, elf: nextElf });
      } else {
        let changed = false;
        const nextTeam = c[tSide === 'p1' ? 'p1Team' : 'p2Team'].map(e => {
          if (e.id === battleId) {
            changed = true;
            return { ...e, ...patch, id: battleId };
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
      return (isP1 ? c.p1RegistryState : c.p2RegistryState)[k];
    },
    setPlayerState: (k, v) => {
      const c = syncStateRef.current;
      const sideRegKey = isP1 ? "p1RegistryState" : "p2RegistryState";
      syncStateRef.current = {
        ...c,
        [sideRegKey]: { ...c[sideRegKey], [k]: v }
      };
      dispatch({ type: 'UPDATE_REGISTRY_STATE', side, state: { [k]: v } });
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
  };
}
