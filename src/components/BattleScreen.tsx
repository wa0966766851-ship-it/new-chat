import { dispatchModeEvent } from '../battle/modeEvents';
import { damagePresentationAmount } from '../battle/damagePresentation';
import { BattlePresentation, effectivenessLabel, type PresentationKind } from '../battle/presentation';
import { hiddenFromViewer } from '../battle/viewerPerspective';
import { BATTLE_ANIMATION_EVENT, readAnimationSettings, type BattleAnimationSettings } from '../battle/animationSettings';
import { activeConstraints } from '../battle/timedConstraints';
import { readScopedRegistry } from '../battle/stateScopes';
import { queueSkillLifesteal } from '../battle/lifesteal';
import { isRecoveryBlocked, resolveRecoveryEffect } from '../battle/recovery';
import React, { useReducer, useEffect, useRef, useCallback, useMemo } from "react";
import { Elf, Skill, BattleLog, BattleMode, BattleItem, BattleEffect, StatChange } from "../types";
import { BattleEventContext, EffectTiming, DamageComputation, PriorityComputation } from "../effects/types";
import { BattleState, BattleAction, battleReducer, EffectItem, TurnDamageStats } from "./BattleManager";
import { isStoneThrower, toSSStone } from "../data/skillStones";
import { SOURCE_SS_TEXT } from "../data/defaultElves";
import { getTypeMatchup, resetElfStateForBattle, calculateEffectiveStat, getEffectiveBody } from "../utils/statCalculator";
import { applyStatChanges } from "../utils/statChangeManager";
import { BattleSkillRegistry, SoulMarkRegistry, hasSkillHandler, observesOpponentDamage, transformSkillBeforeResolve, transformSkillBeforeDamage } from "../effects/battleEventRegistry";
import { skillStageView } from '../battle/skillStageView';
import { consumeSkillTypeOverride } from '../battle/skillTypeOverride';
import { priorityFromDescription, conditionalPriorityFromDescription, executeGenericSkillTextAfterHit, rollSkillHit } from "../effects/genericSkillText";
import { getAttackImmunity, ignoresAttackImmunity, grantsNextIgnoreOnSuccess } from "../battle/attackImmunity";
import { runSkillBlocks, emitSkillUse, soulPassiveEvade, blockCondPriority, emitSelfInvalid } from "../blocks/registry";
import { drainExtraActionQueue } from "../battle/extraActions";
import { findBlockTimer } from "../blocks/runtime";
import { modifySkillDamage, afterSkillHit, traitFatalResist, priorityBonus } from "../effects/traitEffects";
import { SuitEffectRegistry } from "../effects/suitEffectRegistry";
import { runRelicEffects } from "../effects/relicEffectRegistry";
import { StatusRegistry } from "../effects/statusRegistry";
import { canonicalStatusName } from '../effects/statusIdentity';
import { advanceStatusEffect, mergeSameStatus } from '../battle/statusLifecycle';
import { judgeTurnLimit, countedAlive, PEAK_TURN_LIMIT } from '../battle/turnLimit';
import { applyEquipmentToTeam } from "../data/suitsAndEyewears";
import { makeRng } from "../utils/rng";
import { resetPrd, prdChance } from "../utils/prd";
import { BattleScreenUI } from "./BattleScreen.ui.tsx";
import {
  shuffleArray,
  getStatuses,
  addStatusEffect,
  BATTLE_ITEMS,
  isPpCostFree,
  isElfActionDisabled,
  isElfSwitchDisabled,
  getNoSwitchTurns,
  isElfItemDisabled,
  removeStatusEffect,
  isZeroPpExempt,
  getMaxPp,
  clampSkillPp
} from "../utils/battleHelpers";

import { addTimer, tickTimers, clearTurnEffects, hasTurnEffect } from "../battle/timers";
import { runTimerPayload } from "../effects/effectRunner";
import { applyActiveGateTimersToDamage } from '../battle/damageGates';
import { Mark, getMark, markAppliesToElf, setMark as setMarkUtil, clearMark as clearMarkUtil } from "../battle/marks";
import { switchBattleSide } from "../battle/stateScopes";
import { TraitsEngine } from "../utils/traitsEngine";
import { checkStatusDrivenFatalResist } from "../utils/statusFatalResist";

import { pickAiAction, pickAiForcedSwitch } from "../utils/ai";
import { calculateDamage } from "../utils/damageCalculator";
import { SUIT_CATALOG } from "../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../data/titles";

import { 
  SharedContextDeps, 
  buildDamageAPIs, 
  buildStatusAPIs, 
  buildStateAPIs 
} from "../battle/contextBuilders";
import { activateRuneOnSkillSelect } from "../effects/odinRegistry";
import {
  isNonTrueDamageType,
  isSkillDamageType,
  normalizeDamageType,
  settleDamageAbsorption,
} from "../battle/damageSemantics";
import { isAliveBySurvivalRule, resolveDamageTransition, resolveHpAdjustment } from "../battle/survivalRules";

// TurnDamageStats is imported from BattleManager

export interface BattleContextProps extends BattleState {
  dispatch: React.Dispatch<BattleAction>;
  addLog: (text: string, logType?: string) => void;
  trackCodeExec: (side: "p1" | "p2", code: string, metadata: any) => void;
  pushEffect: (effect: EffectItem) => void;
  onSkillSelect: (skill: Skill) => void;
  onSwitchElf: (index: number) => void;
  onUseItem: (item: any) => void;
}

export const BattleContext = React.createContext<BattleContextProps | null>(null);

export function useBattle() {
  const context = React.useContext(BattleContext);
  if (!context) throw new Error("useBattle must be used within a BattleContext.Provider");
  return context;
}

interface BattleScreenProps {
  key?: any;
  initialP1Team: Elf[];
  initialP2Team: Elf[];
  p1StarterId: string;
  p2StarterId: string;
  p1Suit?: string;
  p1Eyewear?: string;
  p2Suit?: string;
  p2Eyewear?: string;
  p1Title?: string;
  p2Title?: string;
  battleMode: BattleMode;
  onBackToMenu: () => void;
  onRestartBattle: () => void;
  onBattleEnd?: (winner: "p1" | "p2" | "exit" | "draw", team?: Elf[]) => void;
  preparedTeams?: boolean;
  specialMode?: "destiny" | "interstellar";
  battleFormat?: "normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3";
  interstellarOptions?: {onPotionUse?:()=>boolean;onBattleEnd?:Function;relics?:string[];enemyRelics?:string[]};
  onDriverInit?: (driver: {
    getState: () => any;
    getSyncState?: () => any;
    onSkillSelect: (side: "p1" | "p2", skill: Skill) => void;
    onSwitchElf: (side: "p1" | "p2", index: number) => void;
    onUseItem: (side: "p1" | "p2", item: BattleItem) => void;
  }) => void;
  onStateChange?: (state: any) => void;
}

// 傷害彈出數字的唯一 id（原本用亂數截斷，容易重複導致 React key 衝突）
let popupSeq = 0;

// 以下 *Turns 鍵由各精靈註冊表／特質引擎自行遞減，通用回合收尾不重複遞減
const MANUALLY_TICKED_TURN_KEYS = new Set<string>(["BelienteRegenTurns", "attackPpMultiplierTurns", "attackSkillInvalidTurns", "burnTurns", "cthyaatDmgHalfTurns", "deathImmuneTurns", "disableOpponentUtilityTurns", "drainHpTurns", "emperorPriorityBoostTurns", "emperorWallTurns", "fangTurns", "fearTurns", "globalSkillInvalidTurns", "guardTurns", "guardianMarkTurns", "halfTurns", "healDamageTurns", "immuneAndReflectTurns", "immuneStatDownTurns", "immuneStatusTurns", "nextTurns", "noHealTurns", "opeiaDrainStatsTurns", "oppHalfUtilitySealedTurns", "oppSealHealTurns", "oppUtilitySealedTurns", "prioTurns", "priorityTurns", "puniAlwaysFirstTurns", "puniCanLingHealTurns", "puniDamageBoostTurns", "puniDoubleDamageTurns", "puniEnergyReflectTurns", "puniMengPriorityTurns", "puniMengStealTurns", "puniQiShiPriorityTurns", "puniShengGuangQiTurns", "puniShengJieMissTurns", "puniShengMingHealTurns", "puniVoidShieldTurns", "puniXuWuTurns", "puniXuanMieFixedTurns", "puniXuanMieTurns", "puniYinSongReflectTurns", "remainingTurns", "skillFearTurns", "soakTurns", "stagnationTurns", "starFangTurns", "starSeaSoakTurns", "starfireBurnTurns", "utilitySkillInvalidTurns", "wallTurns"]);

// 在場精靈（p1/p2）是權威來源：許多效果只寫入 state.p1，未寫回隊伍陣列，
// 造成隊伍資料過期（全滅判定錯誤、換下場再換回來時狀態回溯）。每次寫入時自動回寫。
function syncActiveIntoTeam(v: BattleState): BattleState {
  let out = v;
  for (const side of ["p1", "p2"] as const) {
    const teamKey = side === "p1" ? "p1Team" : "p2Team";
    const idx = side === "p1" ? out.p1ActiveIndex : out.p2ActiveIndex;
    const team = out[teamKey];
    const active = out[side];
    if (active && team && team[idx] && team[idx] !== active && team[idx].id === active.id) {
      const t = team.slice();
      t[idx] = active;
      out = { ...out, [teamKey]: t };
    }
  }
  return out;
}

export { normalizeDamageType } from "../battle/damageSemantics";

/** 陣亡者的延後效果（例如斯嘉麗重生倒數）只能由其召喚、且仍存活的額外精靈代為執行；陣亡期間不算存活。 */
const hasLivingSummonedExtra = (team: Elf[], elf: Elf) => {
  const id = String(elf.battleId || elf.id);
  return team.some(e => e.isExtra && e.summonerId === id && !e.isVanished && e.currentHp > 0);
};

export const checkElfDead = (elf: Elf | undefined | null) => {
  if (!elf) return true;
  if (isAliveBySurvivalRule(elf.currentHp, elf.survivalRule)) return false;
  if (elf.deathImmunity && elf.deathImmunity.deathImmuneTurns > 0) return false;
  return true;
};

export default function BattleScreen(props: BattleScreenProps) {
  const { initialP1Team, initialP2Team, p1StarterId, p2StarterId, p1Suit, p2Suit, p1Title, p2Title, battleMode } = props;
  
  // 防卡頓：URL ?fast=1 自動開啟省動畫模式（executeEffect 讀 window.__BATTLE_FAST__）。
  // 手機／低階機用 ?fast=1 進場，動畫 delay 全歸零，只留 log。
  if (typeof window !== 'undefined' && !(window as any)._battleFastInit) {
    (window as any)._battleFastInit = true;
    try {
      if (new URLSearchParams(window.location.search).get('fast') === '1') (window as any).__BATTLE_FAST__ = true;
    } catch { /* 非瀏覽器環境略過 */ }
  }

  const rngRef = useRef(makeRng((typeof globalThis !== 'undefined' && (globalThis as any).__BATTLE_SEED__) || Date.now()));
  const rng = useCallback(() => rngRef.current(), []);
  const prdInitRef = useRef(false);
  if (!prdInitRef.current) { prdInitRef.current = true; resetPrd(() => rngRef.current()); }

  const battleAliveRef = useRef(true);
  const battleTimeoutsRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const scheduleBattleTask = useCallback((callback: () => void, delay = 0) => {
    if (!battleAliveRef.current) return undefined;
    const timer = setTimeout(() => {
      battleTimeoutsRef.current.delete(timer);
      if (battleAliveRef.current) callback();
    }, delay);
    battleTimeoutsRef.current.add(timer);
    return timer;
  }, []);

  const [state, rawDispatch] = useReducer(battleReducer, null, () => {
    const p1Team = props.preparedTeams ? structuredClone(initialP1Team) : applyEquipmentToTeam(initialP1Team, p1Suit).map(e => resetElfStateForBattle(e, (e.battleId || e.id) === p1StarterId, p1Suit));
    const p2Team = props.preparedTeams ? structuredClone(initialP2Team) : applyEquipmentToTeam(initialP2Team, p2Suit).map(e => resetElfStateForBattle(e, (e.battleId || e.id) === p2StarterId, p2Suit));
    const p1Idx = Math.max(0, p1Team.findIndex(e => (e.battleId || e.id) === p1StarterId || e.id === p1StarterId));
    const p2Idx = Math.max(0, p2Team.findIndex(e => (e.battleId || e.id) === p2StarterId || e.id === p2StarterId));
    
    return {
      p1Suit, p2Suit, p1Relics: props.interstellarOptions?.relics ?? [], p2Relics: props.interstellarOptions?.enemyRelics ?? [],
      p1Team, p2Team, p1ActiveIndex: p1Idx, p2ActiveIndex: p2Idx,
      p1: { ...p1Team[p1Idx] }, p2: { ...p2Team[p2Idx] },
      p1StartHp: p1Team[p1Idx].currentHp,
      p2StartHp: p2Team[p2Idx].currentHp,
      turnNumber: 1, phase: "p1_select", logs: [{ turn: 0, text: "戰鬥開始！", type: "info" }],
      p1SelectedSkill: null, p2SelectedSkill: null, p1SwitchIndex: null, p2SwitchIndex: null,
      winner: null, p1RegistryState: {}, p2RegistryState: {},
      p1Timers: [], p2Timers: [],
      p1Marks: [], p2Marks: [],
      activeSkillAnim: null, floatingDamagePopups: [], isTyrDuelField: false,
      isAutoBattle: false, lastDamage: 0, p1LastDamage: 0, p2LastDamage: 0,
      p1TurnStats: { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null },
      p2TurnStats: { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null },
      consoleShake: { p1: false, p2: false },
      damageDealt: {}
    };
  });

  const { phase, p1, p2, p1Team, p2Team, winner } = state;
  const [presentationVersion, updatePresentation] = useReducer((n: number) => n + 1, 0);
  const presentationRef = useRef<BattlePresentation | null>(null);
  const animationSettingsRef = useRef<BattleAnimationSettings>(readAnimationSettings());
  useEffect(() => {
    const refresh = () => { animationSettingsRef.current = readAnimationSettings(); };
    window.addEventListener(BATTLE_ANIMATION_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(BATTLE_ANIMATION_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  if (!presentationRef.current) presentationRef.current = new BattlePresentation(
    () => { if (battleAliveRef.current) updatePresentation(); },
    () => typeof window !== 'undefined' && !!(window as any).__BATTLE_FAST__,
    () => animationSettingsRef.current
  );
  const presentation = presentationRef.current;
  /** 額外行動節點結束：第一次紅字播完後，不論額外行動幾次只多播一次動畫＋一筆合併紅字。 */
  async function finishExtraPresentation(owner: "p1" | "p2", resolved: number) {
    if (resolved > 0 && battleAliveRef.current) {
      await presentation.wait();
      pushEffect({ type: 'animation', side: owner, data: { anim: { side: owner, category: 'attack', skillName: '額外行動', targetSide: owner === "p1" ? "p2" : "p1" }, duration: 400 } });
      await processQueue();
    }
    await presentation.endExtra();
  }

  // ── 單一真實來源 ─────────────────────────────────────────────
  // 過去戰鬥邏輯寫 syncStateRef、畫面讀 reducer state，兩邊靠手動同步；
  // 只寫其中一邊的效果（回血、扣血、PP…）會在下回合開始時被另一邊覆蓋掉。
  // 現在：syncStateRef 是唯一真實狀態，dispatch 直接套用 reducer 到它；
  // 任何寫入都在同一個 microtask 結束時整批提交給 React 做畫面更新（多次寫入只重繪一次）。
  const syncBoxRef = useRef<React.MutableRefObject<BattleState> | null>(null);
  if (!syncBoxRef.current) {
    let value: BattleState = state;
    let pending = false;
    syncBoxRef.current = {
      get current() { return value; },
      set current(next: BattleState) {
        if (!battleAliveRef.current) return;
        for (const side of ['p1', 'p2'] as const) {
          if ((value[side].battleId || value[side].id) !== (next[side].battleId || next[side].id)) presentation.align(side, next[side]);
        }
        value = syncActiveIntoTeam(next);
        if (!pending) {
          pending = true;
          queueMicrotask(() => {
            pending = false;
            if (!battleAliveRef.current) return;
            rawDispatch({ type: 'REPLACE_STATE', state: value });
            scheduleBattleTask(() => validateIdleRef.current(), 0);
          });
        }
      }
    } as React.MutableRefObject<BattleState>;
  }
  const syncStateRef = syncBoxRef.current;
  const dispatch = useCallback((action: BattleAction) => {
    if (!battleAliveRef.current) return;
    const prevPhase = syncStateRef.current.phase;
    syncStateRef.current = battleReducer(syncStateRef.current, action);
    // 進入結算階段時直接排程結算（不依賴 render 後的 effect：若 React 把
    // p1_select→resolving 合併成一次 render，phase 看起來沒變，effect 不會再觸發而卡住）
    if (action.type === 'SET_PHASE' && action.phase === 'resolving' && prevPhase !== 'resolving') {
      scheduleBattleTask(() => startResolveRef.current(), 0);
    }
  }, []) as React.Dispatch<BattleAction>;
  const startResolveRef = useRef<() => void>(() => {});
  const pendingFinalizeRef = useRef(false);
  const completeForcedSwitchRef = useRef<() => void>(() => {});
  const validateIdleRef = useRef<() => void>(() => {});
  // 保留名稱相容：latestStateRef 一律指向唯一真實狀態
  const latestStateRef = syncStateRef;


  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);

  useEffect(() => {
    if (onStateChangeRef.current) {
      onStateChangeRef.current(state);
    }
  }, [state]);

  const onDriverInitRef = useRef(props.onDriverInit);
  useEffect(() => {
    onDriverInitRef.current = props.onDriverInit;
  }, [props.onDriverInit]);

  useEffect(() => {
    if (onDriverInitRef.current) {
      onDriverInitRef.current({
        getState: () => latestStateRef.current,
        getSyncState: () => syncStateRef.current,
        onSkillSelect: (side, skill) => onSkillSelect(side, skill),
        onSwitchElf: (side, index) => onSwitchElf(side, index),
        onUseItem: (side, item) => onUseItem(side, item)
      });
    }
  }, []);

  const effectQueueRef = useRef<EffectItem[]>([]);
  const isProcessingQueue = useRef(false);
  const processingPromiseRef = useRef<Promise<void> | null>(null);
  const executingEffectRef = useRef(false);
  const presentationPotionRef = useRef(false);
  const isResolvingRef = useRef(false);
  const hasInitialEntranceRef = useRef(false);

  useEffect(() => {
    battleAliveRef.current = true;
    return () => {
      battleAliveRef.current = false;
      // StrictMode 會同步重新啟用同一實例；只清理真正卸載的局。
      queueMicrotask(() => {
        if (battleAliveRef.current) return;
        battleTimeoutsRef.current.forEach(clearTimeout);
        battleTimeoutsRef.current.clear();
        effectQueueRef.current.length = 0;
        presentation.dispose();
      });
    };
  }, []);

  const damageOriginRef = useRef<Record<string, {side:"p1"|"p2";id:string}>>({});
  const executeEffect = useCallback(async (effect: EffectItem) => {
    if (!battleAliveRef.current) return;
    const { type } = effect;
    // 只有「看得見的」效果需要停頓；log / 狀態 / 能力變化不等待，讓同一批 dispatch 合併成一次重繪
    const fast = typeof window !== 'undefined' && (window as any).__BATTLE_FAST__;
    const defaultDelay = fast ? 0 : type === 'damage' ? 120 : type === 'heal' || type === 'adjust_hp' ? 80 : 0;
    const { side, data } = effect;
    if (data && 'amount' in data && !Number.isFinite(data.amount)) {
      console.error(`[executeEffect] ${type} 數值異常（${data.amount}），已改為 0`, data.label || "");
      data.amount = 0;
    }
    const delay = fast ? 0 : (effect.delay ?? defaultDelay);
    const cur = syncStateRef.current;
    
    switch (type) {
      case 'damage': {
        const targetSide = side;
        if (data.targetId && data.targetId !== (cur[side].battleId || cur[side].id) && normalizeDamageType(data) === "true") {
          const target = cur[`${side}Team`].find(e => (e.battleId || e.id) === data.targetId);
          if (!target || checkElfDead(target)) break;
          const absorbed = settleDamageAbsorption(data.amount, "true", target.shield || 0, target.barrier || 0, !!data.ignoreShield);
          const outcome = resolveDamageTransition(target.currentHp, target.maxHp, absorbed.amount, "true", target.survivalRule);
          const ctx = getBattleEventContext(side, true, 0, target);
          const resisted = !outcome.alive && (SoulMarkRegistry[target.name]?.(ctx, EffectTiming.FATAL_RESIST, {damageType:"true"}) || TraitsEngine.triggerFatalResist(ctx));
          ctx.updateAnyElf(side, data.targetId, { ...(resisted ? {} : {currentHp:outcome.hp}), shield:absorbed.shield, barrier:absorbed.barrier });
          if (outcome.damageApplied > 0 && data.sourceSide && data.sourceBattleId) damageOriginRef.current[data.targetId] = {side:data.sourceSide,id:data.sourceBattleId};
          ctx.addLog(`【${target.name}】受到 ${outcome.damageApplied} 點真實傷害。`, "effect");
          break;
        }
        const target = cur[targetSide];
        
        if (checkElfDead(target)) {
          break;
        }
        
        const guard = target.deathImmunity;
        const inGuardWindow = guard && guard.guardTurns > 0;
        const inDeathImmuneWindow = guard && guard.deathImmuneTurns > 0;

        let effectiveAmount = data.amount;
        if (inGuardWindow) {
          const gdt = normalizeDamageType(data);
          if (gdt === "skill" || gdt === "skill_attack" || !gdt) {
            effectiveAmount = 0;   // 技能傷害全擋
          } else if ((gdt === "fixed" || gdt === "percent") && guard.fixedPercentCap) {
            effectiveAmount = Math.min(effectiveAmount, guard.fixedPercentCap);   // 固定/百分比封頂
          }
        }

        // Apply damage resistance (independent multiplicative multiplier)
        const resist = target.resistances?.damageResist;
        let resistMultiplier = 1.0;
        if (resist) {
          if (data.isCrit && resist.crit) {
            resistMultiplier *= (1 - resist.crit / 100);
          }
          if (data.damageType === "fixed" && resist.fixed) {
            resistMultiplier *= (1 - resist.fixed / 100);
          }
          if (data.damageType === "percent" && resist.percent) {
            resistMultiplier *= (1 - resist.percent / 100);
          }
        }
        if (resistMultiplier < 1.0) {
          const originalAmount = effectiveAmount;
          effectiveAmount = Math.floor(effectiveAmount * resistMultiplier);
          const reduced = originalAmount - effectiveAmount;
          if (reduced > 0) {
            dispatch({ type: 'ADD_LOG', log: { turn: cur.turnNumber, text: `🛡️ 【傷害抗性】：【${target.name}】依靠傷害抗性減少了 ${reduced} 點傷害！`, type: "effect" } });
          }
        }

        const normalizedDamageType = normalizeDamageType(data);

        // 讀取攻擊方/防守方身上的 marks，套用非真實傷害倍率
        // 「非真實傷害」= 技能傷害 + 固定傷害 + 百分比傷害（排除真實傷害本身）
        // 由效果層（附加／固定／百分比／X系）結算的傷害已在 contextBuilders 套過印記倍率，不可重複套用。
        if (isNonTrueDamageType(normalizedDamageType) && !data.marksApplied) {
          // 防守方：受到非真實傷害倍率
          const targetMarks = targetSide === "p1" ? cur.p1Marks : cur.p2Marks;
          for (const mark of (targetMarks || []).filter(mark => markAppliesToElf(mark, target))) {
            const takenMult = mark.effects?.nonTrueDamageTakenMultiplier;
            if (takenMult && takenMult !== 1 && mark.count > 0) {
              effectiveAmount = Math.floor(effectiveAmount * takenMult);
            }
          }
          // 攻擊方：造成非真實傷害倍率
          const resolvedSourceSide = targetSide === "p1" ? "p2" : "p1";
          if (resolvedSourceSide) {
            const sourceMarksAll = resolvedSourceSide === "p1" ? cur.p1Marks : cur.p2Marks;
            const sourceElf = resolvedSourceSide === "p1" ? cur.p1 : cur.p2;
            for (const mark of (sourceMarksAll || []).filter(mark => markAppliesToElf(mark, sourceElf))) {
              const dealtMult = mark.effects?.nonTrueDamageDealtMultiplier;
              if (dealtMult && dealtMult !== 1 && mark.count > 0) {
                effectiveAmount = Math.floor(effectiveAmount * dealtMult);
              }
            }
          }
        }

        // --- 護盾/護罩吸收邏輯 ---
        // 不可直接改寫 target（它是 React state 物件）；改用區域變數，最後由 UPDATE_ELF 寫回
        const absorption = settleDamageAbsorption(
          effectiveAmount,
          normalizedDamageType,
          target.shield || 0,
          target.barrier || 0,
          !!data.ignoreShield,
        );
        effectiveAmount = absorption.amount;
        const nextShieldVal = absorption.shield;
        const nextBarrierVal = absorption.barrier;
        if (absorption.shieldAbsorbed > 0) {
          dispatch({ type: 'ADD_LOG', log: { turn: cur.turnNumber, text: `🛡️ 【護盾】：吸收了 ${absorption.shieldAbsorbed} 點技能傷害，剩餘護盾 ${nextShieldVal}！`, type: "effect" } });
        }
        if (absorption.barrierAbsorbed > 0) {
          dispatch({ type: 'ADD_LOG', log: { turn: cur.turnNumber, text: `🔵 【護罩】：吸收了 ${absorption.barrierAbsorbed} 點傷害，剩餘護罩 ${nextBarrierVal}！`, type: "effect" } });
        }
        // -------------------------

        // 傷害分類（在任何分支前決定，抵抗致命的分支也適用）：
        // 技能傷害＝受屬性克制影響的傷害（攻擊、X系、額外行動）；固定／百分比；真實（含汲取）。
        let lastActionType: 'skill' | 'crit' | 'fixed' | 'percent' | 'true' | 'absorb' | 'heal' = 'skill';
        let lastActionLabel = "技能傷害";
        {
          const dt0 = String(data.damageType || "");
          if (data.label?.includes("汲取") || dt0 === "absorb" || dt0 === "true" || dt0 === "true_damage") { lastActionType = "true"; lastActionLabel = data.label || "真實傷害"; }
          else if (dt0 === "fixed" || dt0 === "fixed_damage") { lastActionType = "fixed"; lastActionLabel = data.label || "固定傷害"; }
          else if (dt0 === "percent" || dt0 === "percent_damage") { lastActionType = "percent"; lastActionLabel = data.label || "百分比傷害"; }
          else if (data.isCrit) { lastActionType = "crit"; lastActionLabel = data.label || "致命一擊"; }
          else { lastActionType = "skill"; lastActionLabel = data.label || "技能傷害"; }
        }

        const survivalTransition = resolveDamageTransition(
          target.currentHp,
          target.maxHp,
          effectiveAmount,
          normalizedDamageType === "true" ? "true" : "non_true",
          target.survivalRule,
        );
        const dmg = survivalTransition.damageApplied;
        const isSkillNature = lastActionType === 'skill' || lastActionType === 'crit';
        const displayedDamage = damagePresentationAmount(isSkillNature ? 'skill' : lastActionType === 'true' ? 'true' : normalizedDamageType, effectiveAmount, dmg); // 護盾吸收後、體力截斷前
        const nextHp = survivalTransition.hp;
        if (dmg > 0) {
          const id=target.battleId||target.id;
          if (data.sourceSide && data.sourceBattleId) damageOriginRef.current[id]={side:data.sourceSide,id:data.sourceBattleId};
          else delete damageOriginRef.current[id];
        }
        
        // Synchronously update the ref used for logic
        const wouldFaint = !survivalTransition.alive;
        let resisted = false;
        
        if (wouldFaint && !inDeathImmuneWindow) {
          const fCtx = getBattleEventContext(targetSide, true, 0);
          if (SoulMarkRegistry[target.name]) {
            resisted = !!SoulMarkRegistry[target.name](fCtx, EffectTiming.FATAL_RESIST, { damageType: data.damageType });
          }
          if (!resisted) resisted = TraitsEngine.triggerFatalResist(fCtx);
          if (!resisted) resisted = traitFatalResist(fCtx, targetSide, target, rng);
          if (!resisted) resisted = checkStatusDrivenFatalResist(fCtx);
        }

        if (resisted) {
            // handler 內部可能已經修改了 self.currentHp
            const resistedElf = syncStateRef.current[targetSide];
            const teamKey = targetSide === 'p1' ? 'p1Team' : 'p2Team';
            const activeIdx = targetSide === 'p1' ? syncStateRef.current.p1ActiveIndex : syncStateRef.current.p2ActiveIndex;
            const nextTeam = [...syncStateRef.current[teamKey]];
            nextTeam[activeIdx] = resistedElf;

            syncStateRef.current = {
              ...syncStateRef.current,
              [teamKey]: nextTeam
            };

            dispatch({
              type: 'UPDATE_ELF',
              side,
              elf: {
                currentHp: resistedElf.currentHp,
                battleStatus: resistedElf.battleStatus,
                battleStatusDuration: resistedElf.battleStatusDuration,
                battleStatuses: resistedElf.battleStatuses,
                effects: resistedElf.effects,
                shield: nextShieldVal,
                barrier: nextBarrierVal
              }
            });

            // Update turn stats
            const hpDiff = resistedElf.currentHp - target.currentHp;
            const currentStats = targetSide === 'p1' ? syncStateRef.current.p1TurnStats : syncStateRef.current.p2TurnStats;
            const statsUpdates: Partial<TurnDamageStats> = {
              hpChange: (currentStats.hpChange || 0) + hpDiff
            };
            const positiveDmg = Math.max(0, -hpDiff);
            if (isSkillDamageType(normalizedDamageType)) {
              statsUpdates.skillDmg = (currentStats.skillDmg || 0) + positiveDmg;
              statsUpdates.lastType = 'skill';
            } else if (data.damageType === "fixed") {
              statsUpdates.fixedDmg = (currentStats.fixedDmg || 0) + positiveDmg;
              statsUpdates.lastType = 'fixed';
            } else if (data.damageType === "percent") {
              statsUpdates.percentDmg = (currentStats.percentDmg || 0) + positiveDmg;
              statsUpdates.lastType = 'percent';
            } else if (data.damageType === "true" || data.damageType === "true_damage" || data.damageType === "absorb") {
              statsUpdates.trueDmg = (currentStats.trueDmg || 0) + positiveDmg;
              statsUpdates.lastType = 'true';
            }
            dispatch({ type: 'UPDATE_TURN_STATS', side: targetSide, stats: statsUpdates });
            const statsKey = targetSide === 'p1' ? 'p1TurnStats' : 'p2TurnStats';
            syncStateRef.current = {
              ...syncStateRef.current,
              [statsKey]: {
                ...syncStateRef.current[statsKey],
                ...statsUpdates
              }
            };
        } else {
            const nextElf = { ...target, currentHp: nextHp, shield: nextShieldVal, barrier: nextBarrierVal };
            const teamKey = targetSide === 'p1' ? 'p1Team' : 'p2Team';
            const activeIdx = targetSide === 'p1' ? syncStateRef.current.p1ActiveIndex : syncStateRef.current.p2ActiveIndex;
            const nextTeam = [...syncStateRef.current[teamKey]];
            nextTeam[activeIdx] = nextElf;

            syncStateRef.current = {
              ...syncStateRef.current,
              [targetSide]: nextElf,
              [teamKey]: nextTeam
            };
            dispatch({ type: 'UPDATE_ELF', side, elf: { currentHp: nextHp, shield: nextShieldVal, barrier: nextBarrierVal } });
            dispatch({ type: 'SET_LAST_DAMAGE', side, damage: dmg });
            dispatch({ type: 'SET_SHAKE', side, isShaking: true });
            scheduleBattleTask(() => dispatch({ type: 'SET_SHAKE', side, isShaking: false }), 400);

            if (wouldFaint && inDeathImmuneWindow) {
               dispatch({ type: 'ADD_LOG', side, log: { text: `🌑 【死亡條件不受體力限制】：血量歸零也不會陣亡！(下場後保留效果且不因此降低效果回合數)`, type: "effect" } });
            }

            // Update turn stats
            const currentStats = targetSide === 'p1' ? syncStateRef.current.p1TurnStats : syncStateRef.current.p2TurnStats;
            
            // Update tookDamageThisTurn
            if (dmg > 0) {
              const targetElf = syncStateRef.current[targetSide];
              if (!targetElf.tookDamageThisTurn) {
                syncStateRef.current = {
                  ...syncStateRef.current,
                  [targetSide]: { ...targetElf, tookDamageThisTurn: true }
                };
                dispatch({ type: 'UPDATE_ELF', side: targetSide, elf: { tookDamageThisTurn: true } });
              }
              
              // §2: Handle zhuifeng title (speed stage +1 on hit taken)
              const tId = targetSide === "p1" ? p1Title : p2Title;
              const titleDef = tId ? TITLE_CATALOG[tId] : undefined;
              if (titleDef?.effects?.speedStageOnHitTaken) {
                const nextCtx = getBattleEventContext(targetSide, true);
                nextCtx.applyStatChange(targetSide, { speed: titleDef.effects.speedStageOnHitTaken });
                dispatch({ type: 'ADD_LOG', side: targetSide, log: { text: `🍃 【追風】：受到攻擊，速度等級上升！`, type: "effect" } });
              }
            }

            // §2: Handle transformOnCrit (e.g. 沉睡)
            if (dmg > 0 && data.isCrit) {
              const targetElf = syncStateRef.current[targetSide];
              const effects = targetElf.effects || [];
              const nextEffects = [...effects];
              let transformed = false;

              for (let i = 0; i < nextEffects.length; i++) {
                const e = nextEffects[i];
                const entry = StatusRegistry[e.id];
                if (!entry) continue;
                const transform = entry.mechanics?.find(m => m.type === 'EVOLUTION_TRANSFORM');
                if (transform?.params?.transformOnCrit) {
                  const params = transform.params;
                  const targetStatusName = params.nextStatus;
                  if (targetStatusName) {
                    const targetEntry = StatusRegistry[targetStatusName];
                    nextEffects[i] = {
                      id: targetStatusName,
                      name: targetEntry?.name || targetStatusName,
                      duration: params.nextDuration || 3,
                      isLateMover: false,
                      stacks: 1
                    };
                    transformed = true;
                    dispatch({ type: 'ADD_LOG', side: targetSide, log: { turn: cur.turnNumber, text: `💥 受到致命一擊！【${entry.name}】轉化為【${targetStatusName}】！`, type: "effect" } });
                  }
                }
              }

              if (transformed) {
                const merged = mergeSameStatus(nextEffects);
                syncStateRef.current = { ...syncStateRef.current, [targetSide]: { ...targetElf, effects: merged } };
                dispatch({ type: 'UPDATE_ELF', side: targetSide, elf: { effects: merged } });
              }
            }


            const statsUpdates: Partial<TurnDamageStats> = {
              hpChange: (currentStats.hpChange || 0) + (nextHp - target.currentHp),
              lastType: lastActionType,
              lastAmount: dmg
            };

            if (lastActionType === "true") {
              statsUpdates.trueDmg = (currentStats.trueDmg || 0) + dmg;
            } else if (lastActionType === "crit" || lastActionType === "skill") {
              statsUpdates.skillDmg = (currentStats.skillDmg || 0) + dmg;
            } else if (lastActionType === "fixed") {
              statsUpdates.fixedDmg = (currentStats.fixedDmg || 0) + dmg;
            } else if (lastActionType === "percent") {
              statsUpdates.percentDmg = (currentStats.percentDmg || 0) + dmg;
            }

            dispatch({ type: 'UPDATE_TURN_STATS', side: targetSide, stats: statsUpdates });
            dispatch({
              type: 'SET_LAST_ACTION_INFO',
              info: {
                side: targetSide,
                targetElfName: target.name,
                amount: displayedDamage,
                type: lastActionType,
                label: lastActionLabel
              }
            });

            const statsKey = targetSide === 'p1' ? 'p1TurnStats' : 'p2TurnStats';
            syncStateRef.current = {
              ...syncStateRef.current,
              [statsKey]: {
                ...syncStateRef.current[statsKey],
                ...statsUpdates
              }
            };
        }

        // Trigger ON_DAMAGED event for registries
        const damagedCtx = getBattleEventContext(targetSide, true, 0);
        // 同時提供 amount / damage / targetSide（部分魂印讀 extraData.damage 與 targetSide，過去缺值導致 NaN 與判定顛倒）
        const damagedPayload = {
          damageType: normalizeDamageType(data), rawDamageType: data.damageType,
          amount: dmg, damage: dmg, hpReduced: Math.max(0, target.currentHp - nextHp), label: data.label,
          sourceElfName: data.sourceElfName, targetSide, typedSkill: !!(data as any).typedSkill,
          hpAdjustment: survivalTransition.hpAdjustment,
          ignoredDamage: survivalTransition.ignoredDamage,
          enteredNonPositive: survivalTransition.enteredNonPositive,
        };
        const presentationAfterHp = syncStateRef.current[targetSide].currentHp;
        if (presentationAfterHp !== target.currentHp || data.popup) {
          presentation.record({ side: targetSide, elfId: target.battleId || target.id,
            type: presentationAfterHp > target.currentHp ? 'adjust_up' : lastActionType === 'crit' ? 'skill' : lastActionType as PresentationKind,
            amount: presentationAfterHp > target.currentHp ? presentationAfterHp - target.currentHp
              : (lastActionType === 'fixed' || lastActionType === 'percent') ? target.currentHp - presentationAfterHp : displayedDamage,
            delta: presentationAfterHp - target.currentHp,
            before: target.currentHp, after: presentationAfterHp, maxHp: target.maxHp,
            label: lastActionLabel, isCrit: data.isCrit, alive: !checkElfDead(syncStateRef.current[targetSide]),
            effectiveness: effectivenessLabel((data as any).typeMultiplier),
            sourceSide: (data as any).sourceSide, skillName: (data as any).skillName });
        }
        if (SoulMarkRegistry[target.name]) {
          SoulMarkRegistry[target.name](damagedCtx, EffectTiming.ON_DAMAGED, damagedPayload);
        }
        // 「對手受擊時…」類魂印（星火之灼／星芳之纏／星海之浸）需要在「對手」受到技能攻擊時被通知
        if (dmg > 0 && isSkillDamageType(normalizedDamageType)) {
          const observerSide = targetSide === "p1" ? "p2" : "p1";
          const observer = syncStateRef.current[observerSide];
          if (observer && observesOpponentDamage(observer.name)) {
            SoulMarkRegistry[observer.name](getBattleEventContext(observerSide, true, 0), EffectTiming.ON_DAMAGED, damagedPayload);
          }
        }

        // Generic observer event also reports absorbed or blocked percent damage.
        const sourceSide = targetSide === "p1" ? "p2" : "p1";
        const sourceElf = syncStateRef.current[sourceSide];
        if (sourceElf && data.sourceElfName === sourceElf.name && (!data.sourceBattleId || data.sourceBattleId === (sourceElf.battleId || sourceElf.id))) {
          const key = `${sourceSide}RegistryState` as const;
          const reg = syncStateRef.current[key];
          syncStateRef.current = { ...syncStateRef.current, [key]: consumeSkillTypeOverride(reg, normalizedDamageType, dmg) };
        }
        if (sourceElf && SoulMarkRegistry[sourceElf.name]) {
          SoulMarkRegistry[sourceElf.name](getBattleEventContext(sourceSide, true, 0), EffectTiming.OPPONENT_DAMAGE, damagedPayload);
        }

        if (data.damageType === "true" || data.damageType === "true_damage") {
          for (const s of ["p1", "p2"] as const) {
            const team = s === "p1" ? cur.p1Team : cur.p2Team;
            team.forEach(elf => {
              if (SoulMarkRegistry[elf.name]) {
                const bCtx = getBattleEventContext(s, false, 0, elf);
                SoulMarkRegistry[elf.name](bCtx, EffectTiming.TRUE_DAMAGE_TAKEN, { damage: dmg, side: targetSide, damageType: "true" });
              }
            });
          }
        }
        
        if (data.sourceElfName) {
          dispatch({ type: 'TRACK_DAMAGE', elfName: data.sourceElfName, amount: dmg });
          
          // §3: SPECIAL_BUFF bonusTrueDmgPercent (雷解)
          const sourceSide = targetSide === "p1" ? "p2" : "p1";
          const sourceElf = cur[sourceSide];
          const sourceStatuses = getStatuses(sourceElf);
          Object.keys(sourceStatuses).forEach(stId => {
            const entry = StatusRegistry[stId];
            entry?.mechanics?.forEach(m => {
              if (m.type === 'SPECIAL_BUFF' && m.params?.bonusTrueDmgPercent && (data.damageType === 'skill_attack' || data.damageType === 'skill')) {
                const extraTrueDmg = Math.floor(dmg * m.params.bonusTrueDmgPercent);
                if (extraTrueDmg > 0) {
                   const ctx = getBattleEventContext(targetSide, true, 0);
                   ctx.applyTrueDamage(targetSide, extraTrueDmg, `【${entry.name}】追加傷害`);
                }
              }
            });
          });
        }

        // §3: SPECIAL_BUFF healOnTrueDmgPercent (砥礪，依戰鬥百科)：受到真實傷害後，
        // 若本回合未執行過附加異常狀態的效果則增加傷害值 80% 體力。觸發不移除異常；判定成敗記錄給來源特性使用。
        if (normalizeDamageType(data) === "true" && dmg > 0) {
          const targetStatuses = getStatuses(target);
          Object.keys(targetStatuses).forEach(stId => {
            const entry = StatusRegistry[stId];
            const p = entry?.mechanics?.find(m => m.type === 'SPECIAL_BUFF')?.params || {};
            if (p.healOnTrueDmgPercent && (targetStatuses[stId] || 0) > 0) {
              const tReg = (syncStateRef.current as any)[`${targetSide}RegistryState`] || {};
              const success = tReg.statusAttachTurn !== syncStateRef.current.turnNumber;
              const hCtx = getBattleEventContext(targetSide);
              const heal = Math.floor(dmg * p.healOnTrueDmgPercent);
              if (success && heal > 0) hCtx.adjustHp(targetSide, heal);
              const outcomeKey = `teamDiliOutcome.${target.battleId || target.id}`;
              if (success || hCtx.getPlayerState(outcomeKey) !== "success") hCtx.setPlayerState(outcomeKey, success ? "success" : "fail");
              dispatch({ type: 'ADD_LOG', log: { turn: cur.turnNumber, text: success ? `🪨 【${entry.name}】：增加 ${heal} 點體力（體力調整，非恢復）！` : `🪨 【${entry.name}】：本回合已執行過附加異常狀態的效果，未增加體力。`, type: "effect" } });
            }
          });
        }

        if (data.popup) {
          const id = `pop_${++popupSeq}`;
          dispatch({ 
            type: 'ADD_DAMAGE_POPUP', 
            popup: { 
              id, 
              text: `-${displayedDamage}`,
              side: targetSide, 
              type: lastActionType,
              label: lastActionLabel,
              isCrit: data.isCrit
            } 
          });
          scheduleBattleTask(() => dispatch({ type: 'REMOVE_DAMAGE_POPUP', id }), 1200);
        }
        await presentation.wait();
        break;
      }
      case 'adjust_hp': {
        const targetSide = side;
        const target = cur[targetSide];
        const adjustment = resolveHpAdjustment(target.currentHp, data.amount, target.survivalRule);
        const val = adjustment.applied;
        if (val < 0) delete damageOriginRef.current[target.battleId || target.id];
        const nextHp = adjustment.hp;

        const nextElf = { ...target, currentHp: nextHp };
        const teamKey = targetSide === 'p1' ? 'p1Team' : 'p2Team';
        const activeIdx = targetSide === 'p1' ? syncStateRef.current.p1ActiveIndex : syncStateRef.current.p2ActiveIndex;
        const nextTeam = [...syncStateRef.current[teamKey]];
        nextTeam[activeIdx] = nextElf;

        syncStateRef.current = {
          ...syncStateRef.current,
          [targetSide]: nextElf,
          [teamKey]: nextTeam
        };

        dispatch({ type: 'UPDATE_ELF', side, elf: { currentHp: nextHp } });

        // Update turn stats
        const currentStats = targetSide === 'p1' ? syncStateRef.current.p1TurnStats : syncStateRef.current.p2TurnStats;
        const statsUpdates: Partial<TurnDamageStats> = {
          hpChange: (currentStats.hpChange || 0) + val,
          lastType: val >= 0 ? 'adjust_up' : 'adjust_down',
          lastAmount: Math.abs(val)
        };
        dispatch({ type: 'UPDATE_TURN_STATS', side: targetSide, stats: statsUpdates });
        dispatch({
          type: 'SET_LAST_ACTION_INFO',
          info: {
            side: targetSide,
            targetElfName: target.name,
            amount: Math.abs(val),
            type: val >= 0 ? 'adjust_up' : 'adjust_down',
            label: '體力調整'
          }
        });
        const statsKey = targetSide === 'p1' ? 'p1TurnStats' : 'p2TurnStats';
        syncStateRef.current = {
          ...syncStateRef.current,
          [statsKey]: {
            ...syncStateRef.current[statsKey],
            ...statsUpdates
          }
        };

        if (val !== 0) {
          presentation.record({ side: targetSide, elfId: target.battleId || target.id,
            type: val > 0 ? 'adjust_up' : 'adjust_down', amount: Math.abs(val), delta: val,
            before: target.currentHp, after: nextHp, maxHp: target.maxHp, label: '體力調整' });
          const id = `pop_${++popupSeq}`;
          dispatch({ 
            type: 'ADD_DAMAGE_POPUP', 
            popup: { 
              id, 
              text: `${val > 0 ? "+" : ""}${val}`, 
              side, 
              type: val > 0 ? "adjust_up" : "adjust_down",
              label: "體力調整",
            } 
          });
          scheduleBattleTask(() => dispatch({ type: 'REMOVE_DAMAGE_POPUP', id }), 1000);
          dispatch({ 
            type: 'ADD_LOG', 
            log: { 
              turn: cur.turnNumber, 
              text: `🔄 【${target.name}】體力調整（${val > 0 ? "+" : ""}${val}）！`, 
              type: 'effect' 
            } 
          });
        }
        break;
      }
      case 'heal': {
        const targetSide = side;
        const teamForHeal = cur[`${side}Team`];
        const target = data.targetId ? teamForHeal.find(e=>(e.battleId||e.id)===data.targetId) : cur[targetSide];
        if (!target || checkElfDead(target)) break; // 已陣亡者不受回復（重生另走專用流程）
        const recoveryRegistry = new Proxy({}, {get:(_,key)=>readScopedRegistry(syncStateRef.current,targetSide,target,String(key))}) as any;
        const playerStateKey = `${targetSide}RegistryState` as "p1RegistryState" | "p2RegistryState";
        const oppSide = targetSide === "p1" ? "p2" : "p1";
        const oppStateKey = `${oppSide}RegistryState` as "p1RegistryState" | "p2RegistryState";
        // 競技場莫伊萊：下回合無法透過技能恢復體力（回合數制，通用 tick 自動遞減）
        const skillHealBlockTurns = syncStateRef.current[oppStateKey]?.skillHealBlockTurns || 0;
        const noHealTurns = recoveryRegistry?.noHealTurns ||
                            recoveryRegistry?.[`${targetSide}_noHealTurns`] ||
                            syncStateRef.current[`${oppSide}RegistryState`]?.[`${targetSide}_noHealTurns`] || (skillHealBlockTurns > 0 ? 1 : 0);
        const oppSealHealTurns = syncStateRef.current[oppStateKey]?.oppSealHealTurns || 0;
        const healReduce50Turns = recoveryRegistry?.healReduce50Turns || 0;
        if (isRecoveryBlocked(target.currentHp, target.survivalRule, noHealTurns > 0 || oppSealHealTurns > 0)) {
          const defaultNoHealReason = "體力恢復受到限制";
          const defaultOppSealReason = "恢復效果已被封印";
          const noHealReason = recoveryRegistry?.noHealReason ||
                               recoveryRegistry?.[`${targetSide}_noHealReason`] ||
                               syncStateRef.current[`${oppSide}RegistryState`]?.[`${targetSide}_noHealReason`] || 
                               defaultNoHealReason;
          const oppSealReason = syncStateRef.current[oppStateKey]?.oppSealHealReason || defaultOppSealReason;
          const reason = noHealTurns > 0 ? noHealReason : oppSealReason;
          pushEffect({ type: 'log', side: targetSide, data: { text: `🚫 【恢復失效】：${reason}，【${targetSide === "p1" ? cur.p1.name : cur.p2.name}】體力無法恢復！`, type: "info" } });
          break;
        }

        // §3: SPECIAL_BUFF healIncreasePercent & healReduction
        let multiplier = healReduce50Turns > 0 && !data.isPotion ? 0.5 : 1.0;
        const statuses = getStatuses(target);
        Object.keys(statuses).forEach(stId => {
          const entry = StatusRegistry[stId];
          entry?.mechanics?.forEach(m => {
            if (m.type === 'SPECIAL_BUFF' && m.params?.healIncreasePercent) {
              multiplier += m.params.healIncreasePercent;
            }
          });
        });

        // 積木印記：持有者體力恢復效果減少 X%
        for (const mk of ((targetSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks) || []) as any[]) {
          if (!markAppliesToElf(mk, target)) continue;
          const hr = mk.effects?.blkHealReduce;
          if (hr && !data.isPotion) multiplier = Math.max(0, multiplier - hr * (mk.effects?.blkHealPerStack ? mk.count : 1));
        }
        const healRed = recoveryRegistry?.healReduction || 0;
        if (healRed > 0 && !data.isPotion) {
          multiplier = Math.max(0, multiplier - healRed);
        }

        let maxAllowedHp = target.maxHp;
        const wuxuOrigMaxHp = recoveryRegistry?.wuxuLiurenOriginalMaxHp || recoveryRegistry?.wuxuOriginalMaxHp;
        if (wuxuOrigMaxHp && (target.id?.includes("liuren") || target.name.includes("六刃"))) {
            maxAllowedHp = Math.min(maxAllowedHp, wuxuOrigMaxHp);
        }

        const recovery = resolveRecoveryEffect(target.currentHp, maxAllowedHp, data.amount, multiplier, false, target.survivalRule);
        const nextHp = recovery.hp;
        const val = recovery.hpAdjustment;

        if (recovery.ignoredRecovery) {
          pushEffect({ type: 'log', side: targetSide, data: { text: `⚡ 【神降】：原恢復量失效，改為增加最大體力70%的體力值（+${val}）！`, type: "effect" } });
        }

        const nextElf = { ...target, currentHp: nextHp };
        const teamKey = targetSide === 'p1' ? 'p1Team' : 'p2Team';
        const activeIdx = targetSide === 'p1' ? syncStateRef.current.p1ActiveIndex : syncStateRef.current.p2ActiveIndex;
        const nextTeam = [...syncStateRef.current[teamKey]];
        const targetIdx = nextTeam.findIndex(e=>(e.battleId||e.id)===(target.battleId||target.id));
        nextTeam[targetIdx] = nextElf;

        syncStateRef.current = {
          ...syncStateRef.current,
          ...(targetIdx===activeIdx?{[targetSide]:nextElf}:{}),
          [teamKey]: nextTeam
        };

        dispatch({ type: 'UPDATE_ELF', side, elf: { currentHp: nextHp }, targetId:target.battleId||target.id });

        // Update turn stats
        const currentStats = targetSide === 'p1' ? syncStateRef.current.p1TurnStats : syncStateRef.current.p2TurnStats;
        const statsUpdates: Partial<TurnDamageStats> = {
          heal: (currentStats.heal || 0) + val,
          hpChange: (currentStats.hpChange || 0) + val,
          lastType: 'heal'
        };
        dispatch({ type: 'UPDATE_TURN_STATS', side: targetSide, stats: statsUpdates });
        const statsKey = targetSide === 'p1' ? 'p1TurnStats' : 'p2TurnStats';
        syncStateRef.current = {
          ...syncStateRef.current,
          [statsKey]: {
            ...syncStateRef.current[statsKey],
            ...statsUpdates
          }
        };

        if (val > 0) {
          presentation.record({ side: targetSide, elfId: target.battleId || target.id,
            type: 'heal', amount: val, delta: val, before: target.currentHp, after: nextHp,
            maxHp: target.maxHp, label: data.presentationPotion ? '藥劑回血' : '回血', immediate: !!data.presentationPotion });
          const id = `pop_${++popupSeq}`;
          dispatch({ 
            type: 'ADD_DAMAGE_POPUP', 
            popup: { 
              id, 
              text: `+${val}`, 
              side, 
              type: "heal" 
            } 
          });
          scheduleBattleTask(() => dispatch({ type: 'REMOVE_DAMAGE_POPUP', id }), 1000);
        }
        await presentation.wait();
        break;
      }
      case 'log':
        dispatch({ type: 'ADD_LOG', log: { turn: cur.turnNumber, text: data.text, type: data.type || 'info', sourceCode: data.sourceCode } });
        break;
      case 'animation':
        // 出招動畫開關：關閉時不播放也不等待，結算照常。
        if (!animationSettingsRef.current.skill) return;
        // 出招排在前面已發生的演出（例如藥劑綠字）之後，紅字在出招之後
        await presentation.wait();
        dispatch({ type: 'SET_SKILL_ANIM', anim: data.anim });
        await new Promise(r => setTimeout(r, fast ? 0 : (data.duration || 350)));
        dispatch({ type: 'SET_SKILL_ANIM', anim: null });
        return; // Already delayed
case 'switch': {
        syncStateRef.current = switchBattleSide(syncStateRef.current, side, data.index);
        dispatch({ type: 'SET_ACTIVE_INDEX', side, index: data.index });
        break;
      }
    }
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
  }, [dispatch]);

  const processQueue = useCallback((): Promise<void> => {
    if (!battleAliveRef.current) return Promise.resolve();
    // 在效果執行「內部」再次等待佇列會等到自己 → 永久卡在結算中；此時直接返回（新效果仍會被外層迴圈處理）
    if (executingEffectRef.current) {
      return Promise.resolve();
    }
    if (processingPromiseRef.current) {
      return processingPromiseRef.current;
    }
    const run = (async () => {
      while (battleAliveRef.current && effectQueueRef.current.length > 0) {
        const effect = effectQueueRef.current.shift()!;
        // 旗標只涵蓋 executeEffect 的「同步段」：只擋同步巢狀呼叫，不影響外部正常等待佇列
        let pending: Promise<void>;
        executingEffectRef.current = true;
        try {
          pending = executeEffect(effect);
        } finally {
          executingEffectRef.current = false;
        }
        try {
          await pending;
        } catch (e) {
          console.error("[executeEffect]", effect.type, e);
        }
      }
    })();
    processingPromiseRef.current = run;
    return run.finally(() => {
      processingPromiseRef.current = null;
      scheduleBattleTask(() => validateIdleRef.current(), 0);
    });
  }, [executeEffect]);

  // 文字彈出（Miss／技能無效／附加效果失效）
  const showPopup = useCallback((side: "p1" | "p2", text: string, type: string, label: string = "") => {
    const elf = syncStateRef.current[side];
    presentation.record({ side, elfId: elf.battleId || elf.id, type: 'notice', amount: 0, delta: 0,
      before: elf.currentHp, after: elf.currentHp, maxHp: elf.maxHp, text, label });
    const id = `pop_${++popupSeq}`;
    dispatch({ type: 'ADD_DAMAGE_POPUP', popup: { id, text, side, type, label } });
    scheduleBattleTask(() => dispatch({ type: 'REMOVE_DAMAGE_POPUP', id }), 1200);
  }, [dispatch]);

  const pushEffect = useCallback((effect: EffectItem) => {
    if (!battleAliveRef.current) return;
    // 只加播放標記，不修改 isPotion 等影響回血結算的參數。
    if (effect.type === 'heal' && presentationPotionRef.current) effect = { ...effect, data: { ...effect.data, presentationPotion: true } };
    effectQueueRef.current.push(effect);
    processQueue();
  }, [processQueue]);

  const getBattleEventContext = useCallback((side: "p1" | "p2", isHit: boolean = true, moveIndex?: number, selfElf?: Elf, isEntranceTurn?: boolean): BattleEventContext => {
    const isP1 = side === "p1";
    const cur = syncStateRef.current;
    const self = selfElf || (isP1 ? cur.p1 : cur.p2);
    const opp = isP1 ? cur.p2 : cur.p1;
    const skill = isP1 ? cur.p1SelectedSkill : cur.p2SelectedSkill;
    const targetSide = isP1 ? "p2" : "p1";

    const shared: SharedContextDeps = {
      side,
      isHit,
      moveIndex,
      syncStateRef,
      dispatch,
      pushEffect,
      getBattleEventContext,
      isP1,
      targetSide,
      self,
      opp,
      skill
    };

    return {
      actor: side,
      roundNumber: cur.turnNumber,
      specialMode: props.specialMode,
      currentPhase: cur.phase,
      applyTrueDamageToElf:(targetSide, targetId, amount, label)=> {
        if (targetId === (cur[targetSide].battleId || cur[targetSide].id)) getBattleEventContext(side,true,moveIndex,self).applyTrueDamage(targetSide,amount,label);
        else pushEffect({type:"damage",side:targetSide,data:{targetId,amount,label,damageType:"true",sourceSide:side,sourceBattleId:self.battleId||self.id}});
      },
      applyHealToElf:(side, targetId, amount)=>pushEffect({type:"heal",side,data:{amount,targetId}}),
      targetSide,
      self,
      target: opp,
      activeP1: cur.p1,
      activeP2: cur.p2,
      p1Timers: cur.p1Timers || [],
      p2Timers: cur.p2Timers || [],
      p1FullTeam: cur.p1Team,
      p2FullTeam: cur.p2Team,
      skill: skill || { name: "未知", type: "無", category: "屬性", power: 0, pp: 0 },
      opponentSkill: isP1 ? cur.p2SelectedSkill : cur.p1SelectedSkill,
      isHit,
      isEntranceTurn,
      moveIndex,
      goesFirst: moveIndex === 0 ? true : moveIndex === 1 ? false : undefined,
      rng,
      showPopup,
      getBody: (tSide: "p1" | "p2") => {
        const c = syncStateRef.current;
        const elf = c[tSide];
        const marks = (tSide === "p1" ? c.p1Marks : c.p2Marks).filter(mark => markAppliesToElf(mark, elf));
        return getEffectiveBody(elf, marks);
      },
      addLog: (text, type, sourceCode) => {
        let source = sourceCode;
        if (!source) {
          if (type === "effect") {
            source = `src/effects/${self.name}Registry.ts:soulmark`;
          } else {
            source = `src/effects/${self.name}Registry.ts:${skill?.name || 'unknown'}`;
          }
        }
        pushEffect({ type: 'log', side, data: { text, type, sourceCode: source } });
      },
      ...buildDamageAPIs(shared),
      ...buildStatusAPIs(shared),
      ...buildStateAPIs(shared),
    };
  }, [pushEffect, dispatch, showPopup]);

  const triggerSuitEffect = useCallback((side: "p1" | "p2", event: EffectTiming, extraData?: any) => {
    const cur = syncStateRef.current;
    const suitId = side === "p1" ? p1Suit : p2Suit;
    if (suitId && SuitEffectRegistry[suitId]) {
      const ctx = getBattleEventContext(side);
      SuitEffectRegistry[suitId](ctx, event, extraData);
    }
    const relics = side === "p1" ? cur.p1Relics : cur.p2Relics;
    if (relics?.length) runRelicEffects(relics, getBattleEventContext(side), event, extraData);
  }, [getBattleEventContext, p1Suit, p2Suit]);

  // 出手流程節點廣播：戰鬥階段的各節點只 dispatch 給在場當事人，場下的額外精靈擁有者（如布林克克/克塔亞特）收不到。
  // 此處以「全隊廣播」（與 ROUND_START 同模式）發送 EXTRA_ELF_NODE，僅有實作該 case 的 handler 會回應，其餘精靈惰性略過。
  const broadcastExtraElfNode = useCallback((label: string) => {
    const cur = syncStateRef.current;
    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? cur.p1Team : cur.p2Team;
      team.forEach(elf => {
        if (SoulMarkRegistry[elf.name]) {
          const ctx = getBattleEventContext(side, false, 0, elf);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.EXTRA_ELF_NODE, { node: label });
        }
      });
    }
  }, [getBattleEventContext]);

  const broadcastElfEntered = useCallback((enteredSide: "p1" | "p2", enteredId: string) => {
    const cur = syncStateRef.current;
    // 在場期間對所有精靈都可讀，不能只由特定魂印自行累加。
    getBattleEventContext(enteredSide).setPlayerState("fieldEntryTurn", cur.turnNumber);
    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? cur.p1Team : cur.p2Team;
      team.forEach(elf => {
        if (SoulMarkRegistry[elf.name]) {
          const ctx = getBattleEventContext(side, false, 0, elf);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.ELF_ENTERED, { enteredSide, enteredId });
        }
      });
    }
  }, [getBattleEventContext]);

  const applyDamageTicks = useCallback(async (side: "p1" | "p2", timing: 'ACTION' | 'END' = 'ACTION') => {
    const cur = syncStateRef.current;
    const elf = cur[side];
    const oppSide = side === 'p1' ? 'p2' : 'p1';
    const opp = cur[oppSide];
    
    if (checkElfDead(elf)) return;

    const statuses = getStatuses(elf);
    const effects = elf.effects || [];

    if (elf.suppressAbnormalSideEffectsWhenParalyzed && Math.max(statuses["麻痺"] || 0, statuses["麻痹"] || 0, statuses.paralyzed || 0) > 0) {
      return;
    }

    for (const stId of Object.keys(statuses)) {
      if (checkElfDead(syncStateRef.current[side])) return;
      if (statuses[stId] <= 0) continue;
      const entry = StatusRegistry[stId];
      if (!entry) continue;

      const effectInstance = effects.find(e => e.id === stId);
      const ticks = entry.mechanics?.filter(m => m.type === 'DAMAGE_TICK') || [];
      
      for (const tick of ticks) {
        const params = tick.params || {};
        const tickTiming = params.timing || 'ACTION';
        if (tickTiming !== timing) continue;

        // Condition check (e.g. NO_HIT for 腐朽)
        if (params.condition === 'NO_HIT' && elf.tookDamageThisTurn) continue;

        let amount = 0;
        const multiplier = (params.doubleOnStack && (effectInstance?.stacks || 1) > 1) ? 2 : 1;
        
        if (params.valueType === 'PERCENT') {
          amount = Math.floor(elf.maxHp * params.value * multiplier);
        } else if (params.valueType === 'FIXED') {
          amount = Math.floor(params.value * multiplier);
        }

        if (amount > 0) {
          const ctx = getBattleEventContext(side);
          if (params.nonLethal) {
             amount = Math.min(amount, syncStateRef.current[side].currentHp - 1);
          }
          
          if (amount > 0) {
            ctx.applyTrueDamage(side, amount, `【${entry.name}】`);
            await processQueue();
            if (checkElfDead(syncStateRef.current[side])) {
              return;
            }
            if (params.healSource) {
              const currentOpp = syncStateRef.current[oppSide];
              const actualHeal = Math.min(currentOpp.maxHp - currentOpp.currentHp, amount);
              if (actualHeal > 0) {
                const oppCtx = getBattleEventContext(oppSide);
                oppCtx.applyHeal(oppSide, actualHeal);
                pushEffect({ type: 'log', side: oppSide, data: { text: `💚 【${currentOpp.name}】從【${entry.name}】中吸取了 ${actualHeal} 點體力！`, type: "heal" } });
              }
            }
          }
        }

        if (params.ppDrain > 0) {
           // 以「扣完傷害後」的最新精靈為基底，避免把剛扣的血量覆寫回去
           const liveElf = syncStateRef.current[side];
           const nextSkills = liveElf.skills.map(sk => ({
             ...sk,
             pp: Math.max(0, (sk.pp || 0) - params.ppDrain)
           }));
           syncStateRef.current = { ...syncStateRef.current, [side]: { ...liveElf, skills: nextSkills } };
           dispatch({ type: 'UPDATE_ELF', side, elf: { skills: nextSkills } });
           pushEffect({ type: 'log', side, data: { text: `📉 【${entry.name}】使【${elf.name}】扣除了 ${params.ppDrain} 點 PP！`, type: "effect" } });
        }

        if (params.extendOnTrigger > 0 && params.condition === 'NO_HIT') {
           // For 腐朽: 回合數+2
           const liveElf = syncStateRef.current[side];
           const nextEffects = liveElf.effects?.map(e => e.id === stId ? { ...e, duration: (e.duration || 0) + params.extendOnTrigger } : e);
           syncStateRef.current = { ...syncStateRef.current, [side]: { ...liveElf, effects: nextEffects } };
           dispatch({ type: 'UPDATE_ELF', side, elf: { effects: nextEffects } });
        }
      }
    }
    await processQueue();
  }, [dispatch, pushEffect, getBattleEventContext, processQueue]);
  const checkFaints = useCallback(async (killerSide?: "p1" | "p2") => {
    if (!battleAliveRef.current) return false;
    const mid = syncStateRef.current;

    const f1 = checkElfDead(mid.p1);
    const f2 = checkElfDead(mid.p2);
    if (f1 || f2) {
      await presentation.flush(true);
      if (!battleAliveRef.current) return false;
      presentation.align('p1', syncStateRef.current.p1);
      presentation.align('p2', syncStateRef.current.p2);
    }

    // §2 Poem chapter death transfer for fainted elves across both teams
    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? mid.p1Team : mid.p2Team;
      const activeIdx = side === "p1" ? mid.p1ActiveIndex : mid.p2ActiveIndex;
      team.forEach((elf, idx) => {
        if (!elf || !checkElfDead(elf)) return; // 只處理死亡精靈
        elf.marks = elf.marks || [];
        const poemMark = getMark(elf.marks, "poem_chapter");
        if (poemMark?.effects?.poemHpSnapshots?.length) {
          const totalHpToTransfer = poemMark.effects.poemHpSnapshots.reduce((a, b) => a + b, 0);
          const aliveDragons = [...mid.p1Team, ...mid.p2Team].filter(e => e && e.name.includes("次元龍") && e.currentHp > 0);
          aliveDragons.forEach(d => { d.maxHp += totalHpToTransfer; });
          elf.marks = clearMarkUtil(elf.marks, "poem_chapter");
          if (idx === activeIdx) {
            const marksKey = `${side}Marks` as "p1Marks" | "p2Marks";
            mid[marksKey] = clearMarkUtil(mid[marksKey], "poem_chapter");
            dispatch({ type: 'SET_MARKS', side, marks: mid[marksKey] });
          }
        }
      });
    }

    for (const side of ["p1","p2"] as const) {
      if (side === "p1" ? f1 : f2) dispatchModeEvent(getBattleEventContext(side), EffectTiming.DEATH_NODE_1, {killerSide:damageOriginRef.current[(side === "p1" ? mid.p1 : mid.p2).battleId || (side === "p1" ? mid.p1 : mid.p2).id]?.side, killerId:damageOriginRef.current[(side === "p1" ? mid.p1 : mid.p2).battleId || (side === "p1" ? mid.p1 : mid.p2).id]?.id});
    }
    // §39-5: DEATH_NODE_1 for dead elves
    if (f1 && SoulMarkRegistry[mid.p1.name]) {
      const dCtx = getBattleEventContext("p1");
      SoulMarkRegistry[mid.p1.name](dCtx, EffectTiming.DEATH_NODE_1, { defeatedSelf: true });
    }
    if (f2 && SoulMarkRegistry[mid.p2.name]) {
      const dCtx = getBattleEventContext("p2");
      SoulMarkRegistry[mid.p2.name](dCtx, EffectTiming.DEATH_NODE_1, { defeatedSelf: true });
    }
    if (f1 || f2) broadcastExtraElfNode("死亡節點一");

    // Trigger ON_KILL if someone just died and we have a killer
    if (killerSide) {
      const oppSide = killerSide === "p1" ? "p2" : "p1";
      const oppDead = checkElfDead(mid[oppSide]);
      const killerElf = mid[killerSide];
      const deadElf = mid[oppSide];
      
      if (oppDead && killerElf && deadElf) {
        // Check for nextKillFearNextElf
        const killerRegKey = killerSide === "p1" ? "p1RegistryState" : "p2RegistryState";
        const oppRegKey = oppSide === "p1" ? "p1RegistryState" : "p2RegistryState";
        if (mid[killerRegKey]?.nextKillFearNextElf) {
          mid[oppRegKey] = {
            ...mid[oppRegKey],
            incomingElfFear: true
          };
          mid[killerRegKey] = {
            ...mid[killerRegKey],
            nextKillFearNextElf: false
          };
          pushEffect({ type: 'log', side: killerSide, data: { text: `🦇 【懼噬・虛實逆寫】：鎖定靈魂！對手下隻登場精靈將陷入害怕！`, type: "effect" } });
        }

        // §3-2: Concealed elves do NOT trigger ON_KILL effects
        if (!deadElf.isConcealed && SoulMarkRegistry[killerElf.name]) {
          const kCtx = getBattleEventContext(killerSide, true, 0);
          SoulMarkRegistry[killerElf.name](kCtx, EffectTiming.ON_KILL, { defeatedElf: deadElf });
        }
        broadcastExtraElfNode("擊敗對手");
      }
    }

    // T0-1: Check team wipe first
    let p1Alive = mid.p1Team.some(e => !e.isExtra && !checkElfDead(e));
    let p2Alive = mid.p2Team.some(e => !e.isExtra && !checkElfDead(e));

    // §38-3: De-elfed Rebirth Protection: Check if any team member has a pending rebirth (e.g. Scarlett)
    const checkRebirthPending = (side: "p1" | "p2", team: Elf[]) => {
      return team.some(elf => {
        if (SoulMarkRegistry[elf.name]) {
          const ctx = getBattleEventContext(side, false, 0, elf);
          return !!SoulMarkRegistry[elf.name](ctx, EffectTiming.CHECK_REBIRTH_PENDING);
        }
        return false;
      });
    };

    if (!p1Alive && checkRebirthPending("p1", mid.p1Team)) {
      p1Alive = true;
    }
    if (!p2Alive && checkRebirthPending("p2", mid.p2Team)) {
      p2Alive = true;
    }
    
    if (!p1Alive || !p2Alive) {
      const w = !p1Alive && !p2Alive ? "draw" : (!p2Alive ? "p1" : "p2");
      pushEffect({ type: 'log', side: 'p1', data: { text: w === "p1" ? "玩家一獲勝！" : w === "p2" ? "對手獲勝！" : "平手！", type: "system" } });
      
      // 廣播 BATTLE_END 給所有精靈魂印（C4：克塔亞特戰鬥結束消逝）
      for (const side of ["p1", "p2"] as const) {
        const team = side === "p1" ? mid.p1Team : mid.p2Team;
        team.forEach(elf => {
          if (SoulMarkRegistry[elf.name]) {
            const ctx = getBattleEventContext(side, false, 0, elf);
            SoulMarkRegistry[elf.name](ctx, EffectTiming.BATTLE_END, { winner: w });
          }
        });
      }

      await processQueue();
      if (!battleAliveRef.current) return false;
      dispatch({ type: 'SET_WINNER', winner: w });
      dispatch({ type: 'SET_PHASE', phase: "game_over" });
      props.onBattleEnd?.(w as any, structuredClone(syncStateRef.current.p1Team));
      return "game_over";
    }

    if (!f1 && !f2) return false;

    // Handle forced switches
    if (f1 && f2) dispatch({ type: 'SET_PHASE', phase: "forced_switch_both" });
    else if (f1) dispatch({ type: 'SET_PHASE', phase: "forced_switch_p1" });
    else dispatch({ type: 'SET_PHASE', phase: "forced_switch_p2" });
    return "forced_switch";
    
  }, [battleMode, dispatch, processQueue, props, pushEffect, p1Suit, p2Suit, getBattleEventContext]);

  // T0-4 & T0-7: Separate turn finalization logic
  const finalizeTurn = useCallback(async (force: boolean = false) => {
    const mid = syncStateRef.current;
    
    // Check if anyone fainted (not yet switched)；force = 陣亡方無人可換（等待重生）時照常收尾
    const anyoneFainted = !force && (checkElfDead(mid.p1) || checkElfDead(mid.p2));

    // Always clear selected skills to prevent accidental reuse
    dispatch({ type: 'SET_SKILL', side: 'p1', skill: null });
    dispatch({ type: 'SET_SKILL', side: 'p2', skill: null });

    if (anyoneFainted) {
      // 有精靈陣亡：回合收尾（計時、回合數、ROUND_END）延後到換人完成後再執行，
      // 過去直接跳過，導致擊倒發生的回合永遠不結算、回合數也不會前進
      pendingFinalizeRef.current = true;
      syncStateRef.current = {
        ...syncStateRef.current,
        p1SelectedSkill: null,
        p2SelectedSkill: null
      };
      return;
    }

    // T0-4: Replace effect ticking with timer ticking
    const nextP1Timers = tickTimers(mid.p1Timers, 'round_end', (t) => {
      if ((t.payload?.wraps || t.payload?.wrapItems) && ['per_tick','on_expire'].includes(t.payload?.applyMode)) {
        const tickCtx = getBattleEventContext('p1', true, 0);
        runTimerPayload(t, tickCtx, 'p1');
      }
    });
    const nextP2Timers = tickTimers(mid.p2Timers, 'round_end', (t) => {
      if ((t.payload?.wraps || t.payload?.wrapItems) && ['per_tick','on_expire'].includes(t.payload?.applyMode)) {
        const tickCtx = getBattleEventContext('p2', true, 0);
        runTimerPayload(t, tickCtx, 'p2');
      }
    });

    const updateEffects = (elf: Elf, side: "p1" | "p2") => {
      const currentEffects = elf.effects || [];
      const nextEffects: BattleEffect[] = [];
      
      for (const e of currentEffects) {
        const currentStatuses = getStatuses(elf);
        const statusTick = { status: e.id, skipTick: false };
        SoulMarkRegistry[elf.name]?.(getBattleEventContext(side, true, 0, elf), EffectTiming.BEFORE_STATUS_TICK, statusTick);
        const transition = statusTick.skipTick ? { next: e, transformed: undefined } : advanceStatusEffect(e, currentStatuses, rng);
        if (transition.next) {
          nextEffects.push(transition.next);
        } else {
          // §2: Check for EVOLUTION_TRANSFORM
          const entry = StatusRegistry[canonicalStatusName(e.id)];
          
          if (SoulMarkRegistry[elf.name]) {
             const filterCtx = getBattleEventContext(side, true, 0);
             SoulMarkRegistry[elf.name](filterCtx, "ON_STATUS_ENDED" as any, { status: e.id });
          }
          
          if (!entry) continue;
          
          const transform = entry.mechanics?.find(m => m.type === 'EVOLUTION_TRANSFORM');
          if (transform) {
            const params = transform.params || {};
            const targetStatusName = transition.transformed?.id;
            
            if (targetStatusName) {
              const targetEntry = StatusRegistry[targetStatusName];
              const nextDur = params.nextDuration || 3; // 衍生轉化未定義回合數：預設 3（同名合併見 mergeSameStatus）
              nextEffects.push({
                id: targetStatusName,
                name: targetEntry?.name || targetStatusName,
                duration: nextDur,
                isLateMover: false,
                stacks: 1
              });
              pushEffect({ type: 'log', side, data: { text: `🔄 【${entry.name}】衍生轉化為【${targetStatusName}】！`, type: "effect" } });
              
              if (params.statDebuff) {
                // Apply stat changes
                const targetElf = syncStateRef.current[side];
                const changes: StatChange[] = Object.entries(params.statDebuff).map(([stat, value]) => ({
                  stat: stat as any,
                  value: value as number
                }));
                const { elf: nextElf } = applyStatChanges(targetElf, changes);
                syncStateRef.current = { ...syncStateRef.current, [side]: nextElf };
                dispatch({ type: 'UPDATE_ELF', side, elf: { statStages: nextElf.statStages } });
                
                Object.keys(params.statDebuff).forEach(stat => {
                  const val = params.statDebuff[stat] as number;
                  const sign = val > 0 ? '+' : '';
                  pushEffect({ type: 'log', side, data: { text: `📊 【${entry.name}】轉化效果：${stat} ${sign}${val}！`, type: "effect" } });
                });
              }
            }
          }
          
          // §3: Check for SPECIAL_BUFF dieOnEnd (窒息)
          const p = entry.mechanics?.find(m => m.type === 'SPECIAL_BUFF')?.params || {};
          if (p.dieOnEnd) {
             const ctx = getBattleEventContext(side, true, 0);
             ctx.applyTrueDamage(side, elf.maxHp, `【${entry.name}】終末效果`);
             pushEffect({ type: 'log', side, data: { text: `💀 【${entry.name}】異常結束，【${elf.name}】精疲力竭！`, type: "death" } });
          }
        }
      }
      // 轉化撞上既有同名異常、或多個異常轉化成同一個：合併為一筆、回合數相加
      return mergeSameStatus(nextEffects);
    };

    const nextP1Effects = updateEffects(mid.p1, "p1");
    const nextP2Effects = updateEffects(mid.p2, "p2");

    const updateDeathImmunity = (elf: Elf, isBench: boolean) => {
      if (!elf.deathImmunity) return undefined;
      const next = { ...elf.deathImmunity };
      
      // 如果設定了 preserveOffField 且在場下，則不扣除回合
      if (next.preserveOffField && isBench) {
        return next;
      }

      next.guardTurns = Math.max(0, next.guardTurns - 1);
      next.deathImmuneTurns = Math.max(0, next.deathImmuneTurns - 1);
      
      if (next.guardTurns <= 0 && next.deathImmuneTurns <= 0) return undefined;
      return next;
    };

    const nextP1DeathImmunity = updateDeathImmunity(mid.p1, false);
    const nextP2DeathImmunity = updateDeathImmunity(mid.p2, false);

    // 同步更新隊伍中其他精靈的免死回合 (處理 preserveOffField)
    const updateTeamImmunity = (team: Elf[]) => {
      return team.map(e => {
        if (e.deathImmunity) {
          const isBench = (e.battleId && mid.p1.battleId !== e.battleId && mid.p2.battleId !== e.battleId);
          return { ...e, deathImmunity: updateDeathImmunity(e, !!isBench) };
        }
        return e;
      });
    };
    const nextP1Team = updateTeamImmunity(mid.p1Team);
    const nextP2Team = updateTeamImmunity(mid.p2Team);

    const tickRegistryTurns = (regState: Record<string, any>) => {
      const nextReg = { ...regState };
      Object.keys(nextReg).forEach(key => {
        if (key.endsWith("Turns") && typeof nextReg[key] === "number") {
          nextReg[key] = Math.max(0, nextReg[key] - 1);
        }
      });
      return nextReg;
    };

    const nextP1Reg = tickRegistryTurns(mid.p1RegistryState || {});
    const nextP2Reg = tickRegistryTurns(mid.p2RegistryState || {});

    // §3: SPECIAL_BUFF PP Regen logic (ppRegenOnEnd)
    for (const side of ["p1", "p2"] as const) {
      const elf = side === "p1" ? mid.p1 : mid.p2;
      const statuses = getStatuses(elf);
      Object.keys(statuses).forEach(stId => {
        const entry = StatusRegistry[stId];
        entry?.mechanics?.forEach(m => {
          if (m.type === 'SPECIAL_BUFF') {
            const p = m.params || {};
            if (p.ppRegenOnEnd) {
              const live = syncStateRef.current[side];
              const maxMaxPP = Math.max(...live.skills.map(sk => getMaxPp(sk, live)));
              const regenAmount = Math.ceil(maxMaxPP * p.ppRegenOnEnd);
              const newSkills = live.skills.map(sk => ({
                ...sk,
                pp: clampSkillPp(sk, sk.pp + regenAmount, live)
              }));
              const updatedElf = { ...live, skills: newSkills };
              syncStateRef.current = { ...syncStateRef.current, [side]: updatedElf };
              dispatch({ type: 'UPDATE_ELF', side, elf: { skills: newSkills } });
              pushEffect({ type: 'log', side, data: { text: `⚡ 【${entry.name}】：回合結束恢復了各技能 ${regenAmount} 點 PP！`, type: "status" } });
            }
            if (p.ppRegenPerTurn) {
              const regenAmount = p.ppRegenPerTurn;
              const live = syncStateRef.current[side];
              const newSkills = live.skills.map(sk => ({
                ...sk,
                pp: clampSkillPp(sk, sk.pp + regenAmount, live)
              }));
              const updatedElf = { ...live, skills: newSkills };
              syncStateRef.current = { ...syncStateRef.current, [side]: updatedElf };
              dispatch({ type: 'UPDATE_ELF', side, elf: { skills: newSkills } });
              pushEffect({ type: 'log', side, data: { text: `✨ 【${entry.name}】：每回合結束恢復各技能 ${regenAmount} 點 PP！`, type: "status" } });
            }
            if (p.healPercent) {
              const heal = Math.floor(elf.maxHp * p.healPercent);
              if (heal > 0) {
                const live = syncStateRef.current[side];
                const actualHeal = Math.min(live.maxHp - live.currentHp, heal);
                if (actualHeal > 0) {
                  // 只走 heal 效果佇列（原本先直接加血又推 heal 效果，會回復兩次）
                  pushEffect({ type: 'heal', side, data: { amount: actualHeal } });
                  pushEffect({ type: 'log', side, data: { text: `💚 【${entry.name}】：回合結束恢復了 ${actualHeal} 點體力！`, type: "heal" } });
                }
              }
            }
          }
        });
      });
    }

    // §38-2: Registry-based ROUND_END for all team members (e.g. Wuxu/Scarlett rebirth tracking)
    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? nextP1Team : nextP2Team;
      const oppSide = side === "p1" ? "p2" : "p1";
      const killedOpponentThisRound = checkElfDead(mid[oppSide]);

      team.forEach(elf => {
        // 已死亡的精靈不再響應回合節點（避免場下自我回血＝復活）；只有「死後倒數、時間到於背包內重生」的魂印仍需計時
        if (checkElfDead(elf) && !hasLivingSummonedExtra(team, elf)) return;
        if (SoulMarkRegistry[elf.name]) {
          const ctx = getBattleEventContext(side, false, 0, elf);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.ROUND_END);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.ENFORCE);
          // §39-3: BATTLE_PHASE_END with killedOpponent info
          SoulMarkRegistry[elf.name](ctx, EffectTiming.BATTLE_PHASE_END, { killedOpponent: killedOpponentThisRound });
        }
      });
      triggerSuitEffect(side, EffectTiming.ROUND_END);
      triggerSuitEffect(side, EffectTiming.BATTLE_PHASE_END, { killedOpponent: killedOpponentThisRound });
    }

    // Re-sync with latest state after team-wide effects
    const curUpdate = syncStateRef.current;
    const p1RegUpdated = curUpdate.p1RegistryState || {};
    const p2RegUpdated = curUpdate.p2RegistryState || {};

    // Decrement Emperor's Shield turn-based effects
    for (const side of ["p1", "p2"] as const) {
      const reg = side === "p1" ? p1RegUpdated : p2RegUpdated;
      
      // 1. Decrement guardianMarkTurns
      if (reg.guardianMarkTurns > 0) {
        reg.guardianMarkTurns -= 1;
        if (reg.guardianMarkTurns === 0) {
          reg.guardianMarkStacks = 0;
          const ctx = getBattleEventContext(side, false, 0);
          ctx.clearMark("guardian_shield_mark", side);
          pushEffect({ type: 'log', side, data: { text: "🎡【守護印記】效果已結束。", type: "effect" } });
        } else {
          const ctx = getBattleEventContext(side, false, 0);
          const reduction = 0.25 + (reg.guardianMarkStacks - 1) * 0.10;
          ctx.setMark({
            id: "guardian_shield_mark",
            displayChar: "守",
            count: reg.guardianMarkStacks,
            name: "守護印記",
            description: `受攻擊傷害減少 ${Math.round(reduction * 100)}% (${reg.guardianMarkTurns}回合)`,
            source: "帝皇之盾 / 盾",
            effects: {
              nonTrueDamageTakenMultiplier: 1 - reduction
            }
          }, side);
        }
      }

      // 2. Decrement attackPpMultiplierTurns
      if (reg.attackPpMultiplierTurns > 0) {
        reg.attackPpMultiplierTurns -= 1;
        if (reg.attackPpMultiplierTurns === 0) {
          pushEffect({ type: 'log', side, data: { text: "🎡【盾】：對手攻擊技能 PP 消耗 3 倍懲罰效果已結束。", type: "effect" } });
        }
      }

      // 3. attackSkillInvalidTurns 由特質引擎每回合遞減；這裡只負責結束提示（過去重複遞減，效果只剩一半回合）
      if (reg.attackSkillInvalidTurns === 1) {
        {
          pushEffect({ type: 'log', side, data: { text: "🎡【封技攔截】：對手攻擊技能封鎖已結束。", type: "effect" } });
        }
      }
    }

    for (const side of ["p1", "p2"] as const) {
      const regState = side === "p1" ? p1RegUpdated : p2RegUpdated;

      // 3. 公共模板：每回合自動體力恢復 (0008)
      const origRegState = side === "p1" ? mid.p1RegistryState : mid.p2RegistryState;
      const healTurns = origRegState?.hpHealPerTurnTurns || 0;
      if (healTurns > 0) {
        const heal = origRegState?.hpHealPerTurnAmount || 0;
        if (heal > 0) {
          const teamKey = `${side}Team` as "p1Team" | "p2Team";
          const team = [...syncStateRef.current[teamKey]];
          const activeIdx = side === "p1" ? mid.p1ActiveIndex : mid.p2ActiveIndex;
          if (team[activeIdx] && !checkElfDead(team[activeIdx])) {
            // 只走 heal 效果佇列（原本同時直接改血量又推效果）
            pushEffect({ type: 'heal', side, data: { amount: heal } });
            pushEffect({ type: 'log', side, data: { text: `💚 【公共模板·再生】：回合結束時恢復了 ${heal} 點體力！(剩餘 ${regState.hpHealPerTurnTurns} 回合)`, type: "heal" } });
          }
        }
      }

      // 4. 公共模板：每回合固定生命流失 (0009)
      const lossTurns = origRegState?.hpLossPerTurnTurns || 0;
      if (lossTurns > 0) {
        const loss = origRegState?.hpLossPerTurnAmount || 0;
        if (loss > 0) {
          const teamKey = `${side}Team` as "p1Team" | "p2Team";
          const team = [...syncStateRef.current[teamKey]];
          const activeIdx = side === "p1" ? mid.p1ActiveIndex : mid.p2ActiveIndex;
          if (team[activeIdx] && !checkElfDead(team[activeIdx])) {
            pushEffect({ type: 'damage', side, data: { amount: loss, popup: true, label: "流失", damageType: "true_damage" } });
            pushEffect({ type: 'log', side, data: { text: `🥀 【公共模板·能量流失】：回合結束時受到了 ${loss} 點固定損血！(剩餘 ${regState.hpLossPerTurnTurns} 回合)`, type: "effect" } });
          }
        }
      }
    }

    const resetStats = { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null };

    // ── 回合收尾：以「最新狀態」為基底合併 ───────────────────────────
    // 過去這裡用回合開始時的快照 mid 整個覆蓋，ROUND_END 期間魂印／套裝造成的
    // 體力、能力、印記、計時器等變化全部被抹掉；*Turns 回合計數也從未遞減。
    const live = syncStateRef.current;
    const mergeById = <T extends { id?: any }>(before: T[] = [], ticked: T[] = [], after: T[] = []): T[] => {
      if (after === before) return ticked;
      const afterIds = new Set(after.map(e => e.id));
      const beforeIds = new Set(before.map(e => e.id));
      const kept = ticked.filter(e => afterIds.has(e.id) || !beforeIds.has(e.id));
      const added = after.filter(e => !beforeIds.has(e.id) && !kept.some(k => k.id === e.id));
      return [...kept, ...added];
    };
    const finalizeActive = (side: "p1" | "p2"): Elf => {
      const midElf = mid[side], liveElf = live[side];
      if (!liveElf || !midElf || liveElf.id !== midElf.id) return liveElf;
      const tickedEffects = side === "p1" ? nextP1Effects : nextP2Effects;
      const tickedDI = side === "p1" ? nextP1DeathImmunity : nextP2DeathImmunity;
      const effects = mergeById(midElf.effects || [], tickedEffects || [], liveElf.effects || []);
      return {
        ...liveElf,
        effects,
        battleStatuses: Object.fromEntries(effects.map(e => [e.id, e.duration])),
        deathImmunity: liveElf.deathImmunity === midElf.deathImmunity ? tickedDI : liveElf.deathImmunity,
      };
    };
    const finalizeTeam = (side: "p1" | "p2"): Elf[] => {
      const midTeam = side === "p1" ? mid.p1Team : mid.p2Team;
      const tickedTeam = side === "p1" ? nextP1Team : nextP2Team;
      return (side === "p1" ? live.p1Team : live.p2Team).map(e => {
        const midE = midTeam.find(m => m.id === e.id);
        const tickedE = tickedTeam.find(t => t.id === e.id);
        if (midE && tickedE && e.deathImmunity === midE.deathImmunity) return { ...e, deathImmunity: tickedE.deathImmunity };
        return e;
      });
    };
    // 通用回合計數遞減：跳過已由各精靈／特質自行遞減的鍵，以及本次收尾期間已被改動的值
    const tickGenericTurns = (liveReg: Record<string, any> = {}, midReg: Record<string, any> = {}) => {
      const out = { ...liveReg };
      for (const key of Object.keys(out)) {
        if (!key.endsWith("Turns") || typeof out[key] !== "number" || out[key] <= 0) continue;
        if (MANUALLY_TICKED_TURN_KEYS.has(key.replace(/^(p1|p2)_?/, ""))) continue;
        if (midReg[key] !== out[key]) continue;
        out[key] = out[key] - 1;
      }
      return out;
    };
    const finalP1 = finalizeActive("p1");
    const finalP2 = finalizeActive("p2");
    const finalP1Team = finalizeTeam("p1");
    const finalP2Team = finalizeTeam("p2");
    if (finalP1) finalP1Team[live.p1ActiveIndex] = finalP1;
    if (finalP2) finalP2Team[live.p2ActiveIndex] = finalP2;

    syncStateRef.current = {
      ...live,
      p1Team: finalP1Team,
      p2Team: finalP2Team,
      p1Timers: mergeById(mid.p1Timers || [], nextP1Timers, live.p1Timers || []),
      p2Timers: mergeById(mid.p2Timers || [], nextP2Timers, live.p2Timers || []),
      p1: finalP1,
      p2: finalP2,
      p1RegistryState: { ...tickGenericTurns(live.p1RegistryState, mid.p1RegistryState), switchedThisTurn: false },
      p2RegistryState: { ...tickGenericTurns(live.p2RegistryState, mid.p2RegistryState), switchedThisTurn: false },
      turnNumber: mid.turnNumber + 1,
      p1SelectedSkill: null,
      p2SelectedSkill: null,
      p1StartHp: finalP1?.currentHp ?? 0,
      p2StartHp: finalP2?.currentHp ?? 0,
      p1TurnStats: resetStats,
      p2TurnStats: resetStats,
      // 收尾尚未完成（後面還有回合結束傷害等 await），先維持結算中，避免玩家此時選招被最後的 p1_select 覆蓋
      phase: "resolving"
    };

    const p1Ctx = getBattleEventContext('p1', true, 0);
    const p2Ctx = getBattleEventContext('p2', true, 0);

    // Registry ROUND_END (Handled by team loop above)
    // if (SoulMarkRegistry[mid.p1.name]) SoulMarkRegistry[mid.p1.name](p1Ctx, EffectTiming.ROUND_END);
    // if (SoulMarkRegistry[mid.p2.name]) SoulMarkRegistry[mid.p2.name](p2Ctx, EffectTiming.ROUND_END);
    TraitsEngine.triggerRoundEnd(p1Ctx);
    TraitsEngine.triggerRoundEnd(p2Ctx);

    // 回合結束觸發的額外行動（例如未出手時的滅靈魔咒）必須在本回合收尾立即結算，
    // 不得拖到下一個精靈出手才執行。這裡沿用與 endOfAction 相同的獨立節點語意。
    for (const owner of ["p1", "p2"] as const) {
      let resolved = 0;
      presentation.beginExtra();
      while (resolved < 32) {
        const queue = ((syncStateRef.current as any).extraActionQueue || []) as any[];
        const index = queue.findIndex(action => action.owner === owner);
        if (index < 0) break;
        const action = queue[index];
        syncStateRef.current = { ...syncStateRef.current, extraActionQueue: [...queue.slice(0, index), ...queue.slice(index + 1)] } as any;
        const targetSide = owner === "p1" ? "p2" : "p1";
        const c = getBattleEventContext(owner, true, 0);
        pushEffect({ type: 'log', side: owner, data: { text: `⚡ 【額外行動】${action.label}`, type: "effect" } });
        try { SoulMarkRegistry[syncStateRef.current[owner].name]?.(c, EffectTiming.EXTRA_ACTION_START, { actor: owner, action }); } catch (e) { console.error(e); }
        let dealt = 0;
        if (action.run) dealt = Number(action.run(c) || 0);
        else if (action.amount) dealt = c.applySkillTypeDamage(targetSide, Math.floor(action.amount), action.label, { elem: action.elem, category: "skill_extra_action", node: "extra_action" });
        const afterCtx = getBattleEventContext(owner, true, 0);
        action.after?.(afterCtx, dealt);
        try { SoulMarkRegistry[syncStateRef.current[owner].name]?.(afterCtx, EffectTiming.EXTRA_ACTION_END, { actor: owner, action, dealt }); } catch (e) { console.error(e); }
        await processQueue();
        resolved++;
      }
      if (resolved >= 32 && ((syncStateRef.current as any).extraActionQueue || []).some((action: any) => action.owner === owner)) {
        syncStateRef.current = { ...syncStateRef.current, extraActionQueue: ((syncStateRef.current as any).extraActionQueue || []).filter((action: any) => action.owner !== owner) } as any;
        pushEffect({ type: 'log', side: owner, data: { text: `⚠️ 額外行動超過安全上限，已停止後續連鎖。`, type: "info" } });
      }
      await finishExtraPresentation(owner, resolved);
    }


    // §1: Apply DAMAGE_TICK at round end
    await applyDamageTicks("p1", "END");
    await applyDamageTicks("p2", "END");
    // 直接改體力、沒有留下紀錄的效果：回合末補成淨變化
    presentation.reconcile('p1', syncStateRef.current.p1);
    presentation.reconcile('p2', syncStateRef.current.p2);
    await presentation.flush();
    if (!battleAliveRef.current) return;
    presentation.turnNumber = syncStateRef.current.turnNumber;
    presentation.align('p1', syncStateRef.current.p1);
    presentation.align('p2', syncStateRef.current.p2);

    const afterTickF1 = checkElfDead(syncStateRef.current.p1);
    const afterTickF2 = checkElfDead(syncStateRef.current.p2);
    const hasReplacement = (side: "p1" | "p2") => {
      const st = syncStateRef.current;
      const team = side === "p1" ? st.p1Team : st.p2Team;
      const idx = side === "p1" ? st.p1ActiveIndex : st.p2ActiveIndex;
      return team.some((e, i) => i !== idx && !e.isExtra && !checkElfDead(e));
    };
    // 巔峰 6V6：滿 50 回合依存活精靈數判勝負（額外精靈不計）
    {
      const st = syncStateRef.current;
      const w = judgeTurnLimit(props.battleFormat, st.turnNumber - 1, st.p1Team, st.p2Team, checkElfDead);
      if (w) {
        const a = countedAlive(st.p1Team, checkElfDead), b = countedAlive(st.p2Team, checkElfDead);
        pushEffect({ type: 'log', side: 'p1', data: { text: `⏱️ 已滿 ${PEAK_TURN_LIMIT} 回合：存活精靈 ${a} 比 ${b}，${w === "p1" ? "玩家一獲勝！" : w === "p2" ? "對手獲勝！" : "平手！"}`, type: "system" } });
        for (const side of ["p1", "p2"] as const) {
          (side === "p1" ? st.p1Team : st.p2Team).forEach(elf => {
            if (SoulMarkRegistry[elf.name]) SoulMarkRegistry[elf.name](getBattleEventContext(side, false, 0, elf), EffectTiming.BATTLE_END, { winner: w });
          });
        }
        await processQueue();
        if (!battleAliveRef.current) return;
        dispatch({ type: 'SET_WINNER', winner: w });
        dispatch({ type: 'SET_PHASE', phase: "game_over" });
        props.onBattleEnd?.(w as any, structuredClone(syncStateRef.current.p1Team));
        return;
      }
    }
    // 等待重生（陣亡方無人可換）時不再進入換人，否則會自動無限推進回合
    const onlyWaitingRebirth = force && !((afterTickF1 && hasReplacement("p1")) || (afterTickF2 && hasReplacement("p2")));
    if ((afterTickF1 || afterTickF2) && !onlyWaitingRebirth) {
      const faintsResult = await checkFaints();
      if (faintsResult) return;
    }

    dispatch({ type: 'SET_PHASE', phase: "p1_select" });
  }, [dispatch, applyDamageTicks, checkFaints]);
    const applyEntranceBlessings = useCallback((side: "p1" | "p2", elf: Elf, ctx: BattleEventContext) => {
    dispatchModeEvent(ctx, EffectTiming.ON_ENTRANCE);
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";
    const regState = syncStateRef.current[regKey] || {};
    let changed = false;
    const updates: any = {};

    // 1. nextElfShield
    const nextShield = regState.nextElfShield || regState[side + "_nextElfShield"] || 0;
    if (nextShield > 0) {
      ctx.applyShield(side, nextShield);
      ctx.addLog(`🛡️ 【挽歌護罩】：為上場精靈賦予 ${nextShield} 點護罩！`, "effect");
      updates.nextElfShield = 0;
      updates[side + "_nextElfShield"] = 0;
      changed = true;
    }

    // 2. nextElfImmunityTurns
    const nextImmune = regState.nextElfImmunityTurns || regState[side + "_nextElfImmunityTurns"] || 0;
    if (nextImmune > 0) {
      ctx.setPlayerState("immuneStatusTurns", nextImmune);
      ctx.addLog(`🛡️ 【挽歌庇護】：為上場精靈賦予 ${nextImmune} 回合異常免疫！`, "effect");
      updates.nextElfImmunityTurns = 0;
      updates[side + "_nextElfImmunityTurns"] = 0;
      changed = true;
    }

    // 2.5 nextElfGuardianMark
    const nextGuardian = regState.nextElfGuardianMark || regState[side + "_nextElfGuardianMark"] || false;
    if (nextGuardian) {
      const currentStacks = regState.guardianMarkStacks || 0;
      const nextStacks = Math.min(4, currentStacks + 1);
      const reduction = 0.25 + (nextStacks - 1) * 0.10;
      ctx.setMark({
        id: "guardian_shield_mark",
        displayChar: "守",
        count: nextStacks,
        name: "守護印記",
        description: `受攻擊傷害減少 ${Math.round(reduction * 100)}% (4回合)`,
        source: "帝皇之盾 / 盾",
        effects: {
          nonTrueDamageTakenMultiplier: 1 - reduction
        }
      }, side);
      ctx.addLog(`🎡【守護印記】：守護之光降臨！為上場精靈附加第 ${nextStacks} 層【守護印記】(受擊減傷 ${Math.round(reduction * 100)}%)，持續 4 回合！`, "effect");
      
      updates.nextElfGuardianMark = false;
      updates[side + "_nextElfGuardianMark"] = false;
      updates.guardianMarkStacks = nextStacks;
      updates.guardianMarkTurns = 4;
      changed = true;
    }

    // 3. teamBlessingPending
    const teamBlessing = regState.teamBlessingPending || regState[side + "_teamBlessingPending"];
    if (teamBlessing) {
      ctx.applyStatChange(side, { atk: 1, def: 1, spatk: 1, spdef: 1, speed: 1 });
      const healVal = Math.floor(elf.maxHp * 0.3);
      ctx.applyHeal(side, healVal);
      ctx.addLog(`🎡 【英靈祝福】：戰友們，繼續戰鬥吧！全屬性+1，恢復 30% 體力 (${healVal})！`, "heal");
      updates.teamBlessingPending = false;
      updates[side + "_teamBlessingPending"] = false;
      changed = true;
    }

    // 4. nextElfGainConcealAndPP
    const nextConcealPP = regState.nextElfGainConcealAndPP || regState[side + "_nextElfGainConcealAndPP"];
    if (nextConcealPP) {
      elf.skills?.forEach(s => {
        if (s.pp !== undefined && s.maxPp !== undefined) s.pp = s.maxPp;
      });
      ctx.setPlayerState(`${side}_isConcealed`, true);
      ctx.addLog(`🔄 【戰士傳承】：為新上場的【${elf.name}】恢復所有技能 PP 並附加【隱匿印記】！`, "effect");
      updates.nextElfGainConcealAndPP = false;
      updates[side + "_nextElfGainConcealAndPP"] = false;
      changed = true;
    }

    if (changed) {
      syncStateRef.current = {
        ...syncStateRef.current,
        [regKey]: {
          ...syncStateRef.current[regKey],
          ...updates
        }
      };
      dispatch({
        type: "UPDATE_REGISTRY_STATE",
        side,
        state: updates
      });
    }
  }, [dispatch]);

  const onAutoSwitch = useCallback(async (side: "p1" | "p2") => {
    const cur = syncStateRef.current;
    const team = side === 'p1' ? cur.p1Team : cur.p2Team;
    const activeIdx = side === 'p1' ? cur.p1ActiveIndex : cur.p2ActiveIndex;
    const nextIdx = team.findIndex((e, i) => !e.isExtra && !checkElfDead(e) && i !== activeIdx);
    if (nextIdx !== -1) {
      pushEffect({ type: 'log', side, data: { text: `【${team[nextIdx].name}】替補上陣！`, type: "switch" } });
      pushEffect({ type: 'switch', side, data: { index: nextIdx } });
      await processQueue();
      const newCtx = getBattleEventContext(side);
      TraitsEngine.triggerOnEntrance(newCtx);
      if (SoulMarkRegistry[team[nextIdx].name]) SoulMarkRegistry[team[nextIdx].name](newCtx, EffectTiming.ON_ENTRANCE);
      applyEntranceBlessings(side, team[nextIdx], newCtx);
      triggerSuitEffect(side, EffectTiming.ON_ENTRANCE);
      broadcastElfEntered(side, team[nextIdx].id);
      return true;
    }
    return false;
  }, [getBattleEventContext, processQueue, pushEffect]);

  const resolveTurn = useCallback(async () => {
    if (!battleAliveRef.current) return;
    const cur = latestStateRef.current;
    if (cur.phase !== "resolving") return;
    if (!cur.p1SelectedSkill || !cur.p2SelectedSkill) {
      dispatch({ type: 'SET_PHASE', phase: "p1_select" });
      return;
    }
    dispatch({ type: 'SET_PHASE', phase: "resolving" });

    // Reset tookDamageThisTurn at round start
    const resetFlags = (s: "p1" | "p2") => {
      const e = syncStateRef.current[s];
      if (e.tookDamageThisTurn) {
        syncStateRef.current = { ...syncStateRef.current, [s]: { ...e, tookDamageThisTurn: false } };
        dispatch({ type: 'UPDATE_ELF', side: s, elf: { tookDamageThisTurn: false } });
      }
    };
    resetFlags("p1");
    resetFlags("p2");
    
    // §37-1: Trigger BEFORE_TURN_RESOLVE for soul marks (e.g. Puni reincarnation snapshot)
    if (SoulMarkRegistry[cur.p1.name]) SoulMarkRegistry[cur.p1.name](getBattleEventContext("p1"), EffectTiming.BEFORE_TURN_RESOLVE);
    if (SoulMarkRegistry[cur.p2.name]) SoulMarkRegistry[cur.p2.name](getBattleEventContext("p2"), EffectTiming.BEFORE_TURN_RESOLVE);

    // §39-1: Trigger ROUND_START and ENFORCE for all team members
    const hasDimensionalDragon = [...cur.p1Team, ...cur.p2Team].some(e => e && e.name.includes("次元龍"));
    if (hasDimensionalDragon) {
      const poemDescription = "紀錄持有者精靈的體力上限，當持有精靈死亡時，詩章將轉移給存活狀態的治癒.龍魂再臨 次元龍以增加其等量體力上限，治癒.龍魂再臨 次元龍若存在複數精靈則會同時轉移相同數量給予所有治癒.龍魂再臨 次元龍(每篇詩章獨立計算且無上限，下場後保留)";
      for (const side of ["p1", "p2"] as const) {
        const team = side === "p1" ? cur.p1Team : cur.p2Team;
        const activeIdx = side === "p1" ? cur.p1ActiveIndex : cur.p2ActiveIndex;
        team.forEach((elf, idx) => {
          if (!elf || checkElfDead(elf)) return; // 死亡精靈不再累積
          elf.marks = elf.marks || [];
          const existingMark = getMark(elf.marks, "poem_chapter");
          const existingSnapshots = existingMark?.effects?.poemHpSnapshots || [];
          const nextSnapshots = [...existingSnapshots, elf.maxHp];
          const newMark: Mark = {
            id: "poem_chapter",
            displayChar: "詩",
            count: nextSnapshots.length,
            name: "詩章",
            description: poemDescription,
            source: elf.name,
            effects: { poemHpSnapshots: nextSnapshots }
          };
          elf.marks = setMarkUtil(elf.marks, newMark);
          if (idx === activeIdx) {
            const marksKey = `${side}Marks` as "p1Marks" | "p2Marks";
            cur[marksKey] = elf.marks;
            dispatch({ type: 'SET_MARKS', side, marks: elf.marks });
          }
        });
      }
    }

    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? cur.p1Team : cur.p2Team;
      team.forEach(elf => {
        if (checkElfDead(elf) && !hasLivingSummonedExtra(team, elf)) return; // 陣亡者不響應回合開始
        if (SoulMarkRegistry[elf.name]) {
          const ctx = getBattleEventContext(side, false, 0, elf);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.ROUND_START);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.ENFORCE);
        }
      });
      triggerSuitEffect(side, EffectTiming.ROUND_START);
    }

    const p1Skill = cur.p1SelectedSkill;
    const p2Skill = cur.p2SelectedSkill;

    // §38-4: Registry-based Priority Calculation
    const calcPriority = (side: "p1" | "p2", skill: any): { priority: number, forcedFirst: boolean } => {
      if (!skill) return { priority: 0, forcedFirst: false };
      const regState = cur[`${side}RegistryState`] || {};
      const nextPriorityCount = regState.nextPriorityCount || 0;
      const comp: PriorityComputation = {
        base: cur[side].isInherentInvalid ? 0 : (skill.priority || (!hasSkillHandler(skill.name) ? priorityFromDescription(skill.description || "", skill.name) : 0))
          + (!hasSkillHandler(skill.name) ? conditionalPriorityFromDescription(skill, side === "p1" ? cur.p1 : cur.p2, side === "p1" ? cur.p2 : cur.p1, (e) => getStatuses(e)) : blockCondPriority(skill, side === "p1" ? cur.p1 : cur.p2, side === "p1" ? cur.p2 : cur.p1, (e) => getStatuses(e))),
        bonus: (regState.nextTurnPriority || 0) + (nextPriorityCount > 0 ? 2 : 0) + priorityBonus(side === "p1" ? cur.p1 : cur.p2, skill, rng)
          + ((regState.priorityBoostTurns || 0) > 0 && !(regState.priorityBoostAttackOnly && skill.category === "屬性") ? (regState.priorityBoostValue || 0) : 0),
        forcedFirst: false
      };
      // 競技場：下回合先制懲罰（回合數制，通用 tick 自動遞減；莫伊萊1／無為1／無極2）
      if ((regState.priorityPenaltyTurns || 0) > 0) comp.bonus -= 2;
      // 積木持續效果：下N次技能先制、N回合必定先手
      {
        const blkT = (cur as any)[`${side}Timers`];
        const bp = findBlockTimer(blkT, b => b.prio != null && !(b.attackOnly && skill.category === "屬性"));
        if (bp) comp.bonus += bp.payload.block.prio;
        if ((regState.blkNoPosPrioTurns || 0) > 0) { comp.base = Math.min(0, comp.base); comp.bonus = Math.min(0, comp.bonus); }
        if (findBlockTimer(blkT, b => b.first)) comp.forcedFirst = true;
      }
      
      const elf = side === "p1" ? cur.p1 : cur.p2;

      // §3: SPECIAL_BUFF Priority logic
      const statuses = getStatuses(elf);
      let disablePriority = false;
      let multiplier = 1.0;

      Object.keys(statuses).forEach(stId => {
        const entry = StatusRegistry[stId];
        entry?.mechanics?.forEach(m => {
          if (m.type === 'SPECIAL_BUFF') {
            const p = m.params || {};
            if (p.disablePriority) disablePriority = true;
            if (p.priorityBonus) comp.bonus += p.priorityBonus;
            if (p.priorityMultiplier) multiplier *= p.priorityMultiplier;
          }
        });
      });

      if (disablePriority) {
        comp.base = 0;
        comp.bonus = 0;
      }

      // 印記先制修正（可限定對手名稱，例如武誅：對手為無極聖武時先制-2）
      {
        const oppElf = cur[side === "p1" ? "p2" : "p1"];
        for (const mark of ((cur as any)[`${side}Marks`] || []).filter((m: any) => markAppliesToElf(m, elf))) {
          const b = mark.effects?.priorityBonus;
          if (b && mark.count > 0 && (!mark.effects?.vsOpponentName || oppElf?.name === mark.effects.vsOpponentName)) comp.bonus += b;
        }
      }
      if (SoulMarkRegistry[elf.name]) {
        const ctx = getBattleEventContext(side, true, 0);
        SoulMarkRegistry[elf.name](ctx, EffectTiming.MODIFY_PRIORITY, { priorityComp: comp });
      }

      dispatchModeEvent(getBattleEventContext(side, true, 0), EffectTiming.MODIFY_PRIORITY, {priorityComp:comp});
      return {
        priority: Math.floor((comp.base + comp.bonus) * multiplier),
        forcedFirst: comp.forcedFirst
      };
    };

    const p1Res = calcPriority("p1", p1Skill);
    const p2Res = calcPriority("p2", p2Skill);

    let p1Priority = p1Res.priority;
    let p2Priority = p2Res.priority;
    // 通用：「對手先制等級無法高於自身」（由魂印／技能在 MODIFY_PRIORITY 設定，本回合一次）。
    for (const side of ["p1", "p2"] as const) {
      const reg = (syncStateRef.current as any)[`${side}RegistryState`] || {};
      if (!reg.capOpponentPriorityThisTurn) continue;
      if (side === "p1") p2Priority = Math.min(p2Priority, p1Priority); else p1Priority = Math.min(p1Priority, p2Priority);
      syncStateRef.current = { ...syncStateRef.current, [`${side}RegistryState`]: { ...reg, capOpponentPriorityThisTurn: false } } as any;
    }

    if (p1Res.forcedFirst && !p2Res.forcedFirst) {
      p1Priority = Math.max(p1Priority, p2Priority + 999);
    } else if (p2Res.forcedFirst && !p1Res.forcedFirst) {
      p2Priority = Math.max(p2Priority, p1Priority + 999);
    }

    let p1Speed = calculateEffectiveStat(cur.p1.calculatedStats.speed, skillStageView(cur.p1, p1Skill, 'speed'));
    let p2Speed = calculateEffectiveStat(cur.p2.calculatedStats.speed, skillStageView(cur.p2, p2Skill, 'speed'));
    if (cur.p1RegistryState?.morningStarIgnoreSpeed) {
      p2Speed = Math.max(0, p2Speed - 10);
    }
    if (cur.p2RegistryState?.morningStarIgnoreSpeed) {
      p1Speed = Math.max(0, p1Speed - 10);
    }

    const actors: ("p1" | "p2")[] = p1Priority >= p2Priority ? ["p1", "p2"] : ["p2", "p1"];
    if (p1Priority === p2Priority && p1Speed < p2Speed) actors.reverse();

    // ── 出手流程結束（含選擇技能因故未能出手）：ACTION_END 與額外行動
    const endOfAction = async (side: "p1" | "p2", idx: number) => {
      const elf = syncStateRef.current[side];
      if (!elf || checkElfDead(elf)) return;
      const ctxE = getBattleEventContext(side, true, idx);
      try { if (SoulMarkRegistry[elf.name]) SoulMarkRegistry[elf.name](ctxE, EffectTiming.ACTION_END, { actor: side }); } catch (e) { console.error(e); }
      // 咒術師的魔咒在主動出手流程結束後排入獨立額外行動節點。
      TraitsEngine.triggerActionPhaseEnd(ctxE);
      const opp = side === "p1" ? "p2" : "p1";
      // 每次只取一項並重新讀取佇列，讓額外行動結算中新增的額外行動也能在同一節點依序生效。
      // 設上限防止錯誤效果互相排隊造成無限循環。
      presentation.beginExtra();
      const drained = await drainExtraActionQueue<any>({
        owner: side,
        readQueue: () => ((syncStateRef.current as any).extraActionQueue || []),
        writeQueue: extraActionQueue => { syncStateRef.current = { ...syncStateRef.current, extraActionQueue } as any; },
        canContinue: () => !checkElfDead(syncStateRef.current[side]) && !checkElfDead(syncStateRef.current[opp]),
        execute: async act => {
          pushEffect({ type: 'log', side, data: { text: `⚡ 【額外行動】${act.label}`, type: "effect" } });
          let c = getBattleEventContext(side, true, idx);
          try { SoulMarkRegistry[syncStateRef.current[side].name]?.(c, EffectTiming.EXTRA_ACTION_START, { actor: side, action: act }); } catch (e) { console.error(e); }
          let dealt = 0;
          if (act.run) dealt = Number(act.run(c) || 0);
          else if (act.amount) dealt = c.applySkillTypeDamage(opp, Math.floor(act.amount), act.label, { elem: act.elem, category: "skill_extra_action", node: "extra_action" });
          c = getBattleEventContext(side, true, idx);
          act.after?.(c, dealt);
          try { SoulMarkRegistry[syncStateRef.current[side].name]?.(c, EffectTiming.EXTRA_ACTION_END, { actor: side, action: act, dealt }); } catch (e) { console.error(e); }
          await processQueue();
        },
      });
      if (drained.truncated) {
        pushEffect({ type: 'log', side, data: { text: `⚠️ 額外行動超過安全上限，已停止後續連鎖。`, type: "info" } });
      }
      await finishExtraPresentation(side, drained.resolved);
    };
    let prevActor: { s: "p1" | "p2"; i: number } | null = null;

    for (const [mIdx, s] of actors.entries()) {
      if (prevActor) { await endOfAction(prevActor.s, prevActor.i); }
      prevActor = { s, i: mIdx };
      await processQueue();
      const mid = syncStateRef.current;

      // Track who is actively executing this sub-turn in both players' states
      const regKeySelf = s === 'p1' ? "p1RegistryState" : "p2RegistryState";
      const regKeyOpp = s === 'p1' ? "p2RegistryState" : "p1RegistryState";
      syncStateRef.current = {
        ...syncStateRef.current,
        [regKeySelf]: {
          ...(syncStateRef.current[regKeySelf] || {}),
          currentActiveActor: s
        },
        [regKeyOpp]: {
          ...(syncStateRef.current[regKeyOpp] || {}),
          currentActiveActor: s
        }
      };
      dispatch({
        type: 'UPDATE_REGISTRY_STATE',
        side: s,
        state: { currentActiveActor: s }
      });
      dispatch({
        type: 'UPDATE_REGISTRY_STATE',
        side: s === 'p1' ? 'p2' : 'p1',
        state: { currentActiveActor: s }
      });

      const actor = s === 'p1' ? mid.p1 : mid.p2;
      const oppSide = s === 'p1' ? 'p2' : 'p1';
      const opp = mid[oppSide];
      const skill = s === 'p1' ? mid.p1SelectedSkill : mid.p2SelectedSkill;

      if (checkElfDead(actor)) continue;
      if (checkElfDead(opp) && skill?.name !== "切換精靈") continue;

      if (!skill) continue;

      if (isElfActionDisabled(actor, opp) && skill.name !== "切換精靈" && skill.name !== "使用道具") {
        pushEffect({ type: 'log', side: s, data: { text: `💫 【${actor.name}】因異常狀態無法行動！`, type: "status" } });
        await processQueue();
        continue;
      }

      if (skill.name === "切換精靈") {
        const idx = s === 'p1' ? mid.p1SwitchIndex : mid.p2SwitchIndex;
        if (idx !== null) {
          const outgoingElf = mid[s];
          const targetElf = (s === 'p1' ? mid.p1Team : mid.p2Team)[idx];
          
          if (outgoingElf && SoulMarkRegistry[outgoingElf.name]) {
            const outCtx = getBattleEventContext(s, true, mIdx);
            SoulMarkRegistry[outgoingElf.name](outCtx, EffectTiming.ON_SWITCH_OUT, { incomingElf: targetElf });
          }

          if (outgoingElf) {
            const outCtx = getBattleEventContext(s, true, mIdx);
            for (const mark of outCtx.getMarks(s)) {
              if (mark.persistsOffField === false) {
                outCtx.clearMark(mark.id, s);
                outCtx.addLog(`💨 【${outgoingElf.name}】下場，【${mark.name}】隨之消失。`, "info");
              }
            }
          }

          if (outgoingElf) {
            const sideRegKey = s === 'p1' ? "p1RegistryState" : "p2RegistryState";
            syncStateRef.current = {
              ...syncStateRef.current,
              [sideRegKey]: {
                ...syncStateRef.current[sideRegKey],
                previousActiveElfId: outgoingElf.id,
                switchedThisTurn: true
              }
            };
            dispatch({
              type: 'UPDATE_REGISTRY_STATE',
              side: s,
              state: { previousActiveElfId: outgoingElf.id, switchedThisTurn: true }
            });
          }

          pushEffect({ type: 'log', side: s, data: { text: `【${actor.name}】被召回，換上了 【${targetElf.name}】！`, type: "switch" } });
          pushEffect({ type: 'switch', side: s, data: { index: idx } });
          await processQueue();
          const nCtx = getBattleEventContext(s, true, mIdx);
          const currentElf = syncStateRef.current[s];
          TraitsEngine.triggerOnEntrance(nCtx);
          if (SoulMarkRegistry[currentElf.name]) SoulMarkRegistry[currentElf.name](nCtx, EffectTiming.ON_ENTRANCE);
          applyEntranceBlessings(s, currentElf, nCtx);
          triggerSuitEffect(s, EffectTiming.ON_ENTRANCE);
          broadcastElfEntered(s, currentElf.id);

          // Check for incomingElfFear on entering side
          const enteringRegKey = s === "p1" ? "p1RegistryState" : "p2RegistryState";
          if (syncStateRef.current[enteringRegKey]?.incomingElfFear) {
            syncStateRef.current = {
              ...syncStateRef.current,
              [enteringRegKey]: {
                ...syncStateRef.current[enteringRegKey],
                incomingElfFear: false
              }
            };
            nCtx.applyStatusWithImmunityCheck(s, "害怕", 1);
            pushEffect({ type: 'log', side: s, data: { text: `🦇 【懼噬・虛實逆寫】：對手新精靈首回合陷入害怕！`, type: "effect" } });
          }

          const oppSideActual = s === 'p1' ? 'p2' : 'p1';
          const oppElf = syncStateRef.current[oppSideActual];
          if (oppElf && SoulMarkRegistry[oppElf.name]) {
            const oppCtx = getBattleEventContext(oppSideActual, false, mIdx);
            SoulMarkRegistry[oppElf.name](oppCtx, "OPPONENT_SWITCH" as any, { switchingSide: s });
          }
        }
        continue;
      }

      if (skill.name === "使用道具") {
        const item = s === 'p1' ? mid.p1SelectedItem : mid.p2SelectedItem;
        if (item) {
          pushEffect({ type: 'log', side: s, data: { text: `【${actor.name}】使用了【${item.name}】！`, type: "info" } });
          const nCtx = getBattleEventContext(s, true, mIdx);
          const currentElf = syncStateRef.current[s];
          
          // 1. HP Recovery (hp, hybrid, special)
          if (item.value) {
            const heal = Math.min(item.value, currentElf.maxHp - currentElf.currentHp);
            if (heal > 0) {
              presentationPotionRef.current = true;
              try { nCtx.applyHeal(s, heal); } finally { presentationPotionRef.current = false; }
            }
          }
          
          // 2. PP Recovery (pp, hybrid, special)
          if (item.ppValue) {
            const curElf = syncStateRef.current[s];
            const newSkills = curElf.skills.map(sk => ({
              ...sk,
              pp: clampSkillPp(sk, (sk.pp ?? 0) + item.ppValue!, curElf)
            }));
            nCtx.updateElf(s, { skills: newSkills });
            pushEffect({ type: 'log', side: s, data: { text: `【${actor.name}】所有技能恢復了 ${item.ppValue} 點 PP！`, type: "info" } });
          }
          
          // 3. Clear Status (special with effect: clear_status)
          if (item.effect === 'clear_status') {
            const curElf = syncStateRef.current[s];
            const nextEffects = (curElf.effects || []).filter(e => {
              const entry = StatusRegistry[e.id];
              return entry?.categories?.includes('AUXILIARY');
            });
            nCtx.updateElf(s, { effects: nextEffects, battleStatuses: {}, battleStatus: "normal", battleStatusDuration: 0 });
            pushEffect({ type: 'log', side: s, data: { text: `【${actor.name}】的異常狀態被清除處理了！`, type: "status" } });
          }

          // 4. Clear Debuff (special with effect: clear_debuff)
          if (item.effect === 'clear_debuff') {
            const curElf = syncStateRef.current[s];
            const newStages = { ...(curElf.statStages || { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 }) };
            let changed = false;
            for (const key in newStages) {
              if (newStages[key as keyof typeof newStages]! < 0) {
                newStages[key as keyof typeof newStages] = 0;
                changed = true;
              }
            }
            if (changed) {
              nCtx.updateElf(s, { statStages: newStages });
              pushEffect({ type: 'log', side: s, data: { text: `【${actor.name}】的能力下降狀態被清處理了！`, type: "status" } });
            }
          }
        }
        await processQueue();
        continue;
      }

      const ctx = getBattleEventContext(s, true, mIdx);
      ctx.setPlayerState('blkTypeOverrideCurrentAction', false);
      ctx.setPlayerState('attackHitCountThisAction', 0);
      const ppCostComp = {
        base: skill.name === "掙扎" ? 0 : 1,
        additionalCost: 0,
        extraAllSkills: 0,
        multiplier: 1,
      };

      // §39-4: BEFORE_SKILL for PP cost modification (e.g. Opeia no-cost)
      if (SoulMarkRegistry[actor.name]) {
        SoulMarkRegistry[actor.name](ctx, EffectTiming.BEFORE_SKILL, { actor: s, ppCostComp });
      }
      triggerSuitEffect(s, EffectTiming.BEFORE_SKILL, { actor: s, ppCostComp });
      broadcastExtraElfNode("使用技能時");

      const currentActorBefore = syncStateRef.current[s];
      if (SoulMarkRegistry[currentActorBefore.name]) {
        SoulMarkRegistry[currentActorBefore.name](ctx, EffectTiming.BEFORE_ACTION);
      }
      // 咒術師在選擇技能且自身處於詛咒時，先記錄本次魔咒待發狀態。
      TraitsEngine.triggerBeforeAction(ctx);
      triggerSuitEffect(s, EffectTiming.BEFORE_ACTION);
      // Broadcast the selected move to the defending soul mark through a generic event.
      const defendingElf = syncStateRef.current[oppSide];
      if (SoulMarkRegistry[defendingElf.name]) {
        SoulMarkRegistry[defendingElf.name](getBattleEventContext(oppSide, true, mIdx), EffectTiming.OPPONENT_ACTION, { skill: ctx.skill, side: s });
      }
      broadcastExtraElfNode("出手流程開始");

      // 隱匿只對敵方視角掩蓋；己方完整顯示（UI 另對敵方隱匿精靈的所有文字做掩蓋）。
      const actorHidden = hiddenFromViewer(actor, s);
      let displayName = actorHidden ? "未知精靈" : actor.name;
      let displaySkill = actorHidden ? "未知技能" : skill.name;
      let activeSkill = skill;

      const actorStatuses = getStatuses(actor);
      const oppStatuses = getStatuses(opp);

      // §3: SPECIAL_BUFF PP logic (restoreSelectedPP, infinitePP)
      Object.keys(actorStatuses).forEach(stId => {
        const entry = StatusRegistry[stId];
        entry?.mechanics?.forEach(m => {
          if (m.type === 'SPECIAL_BUFF') {
            const p = m.params || {};
            if (p.infinitePP) {
              ppCostComp.multiplier = 0;
            }
            if (p.restoreSelectedPP) {
               const actElf = syncStateRef.current[s];
               const newSkills = actElf.skills.map(sk => 
                 sk.name === activeSkill.name ? { ...sk, pp: getMaxPp(sk, actElf) } : sk
               );
               syncStateRef.current = { ...syncStateRef.current, [s]: { ...actElf, skills: newSkills } };
               dispatch({ type: 'UPDATE_ELF', side: s, elf: { skills: newSkills } });
               pushEffect({ type: 'log', side: s, data: { text: `⚡ 【${entry.name}】：恢復了【${activeSkill.name}】的全部 PP！`, type: "status" } });
            }
          }
        });
      });

      const actorRegKey = s === "p1" ? "p1RegistryState" : "p2RegistryState";
      const oppRegKey = s === "p1" ? "p2RegistryState" : "p1RegistryState";
      const actorState = syncStateRef.current[actorRegKey] || {};
      const oppState = syncStateRef.current[oppRegKey] || {};

      // Check if actor holds MODIFIER_LIMIT with drainSelectedPP or has fearSeedDrainPP flag
      let ppDrainedToZero = false;
      let drainReason = "";

      Object.keys(actorStatuses).forEach(stId => {
        const entry = StatusRegistry[stId];
        entry?.mechanics?.forEach(m => {
          if (m.type === 'MODIFIER_LIMIT' && m.params?.drainSelectedPP) {
            ppDrainedToZero = true;
            drainReason = entry.name;
          }
        });
      });

      const fearDrain = actorState.fearSeedDrainPP || (syncStateRef.current as any)[`${s}_fearSeedDrainPP`];
      if (fearDrain) {
        ppDrainedToZero = true;
        drainReason = "恐懼之種";
        syncStateRef.current = {
          ...syncStateRef.current,
          [actorRegKey]: {
            ...(syncStateRef.current[actorRegKey] || {}),
            fearSeedDrainPP: false
          },
          [`${s}_fearSeedDrainPP` as any]: false
        };
      }

      if (ppDrainedToZero && activeSkill.name !== "切換精靈" && activeSkill.name !== "使用道具") {
        const elfToDrain = syncStateRef.current[s];
        const nextSkills = elfToDrain.skills.map(sk => sk.name === activeSkill.name ? { ...sk, pp: 0 } : sk);
        syncStateRef.current = { ...syncStateRef.current, [s]: { ...elfToDrain, skills: nextSkills } };
        dispatch({ type: 'UPDATE_ELF', side: s, elf: { skills: nextSkills } });
        pushEffect({ type: 'log', side: s, data: { text: `⚙️ 【${drainReason}】：【${activeSkill.name}】技能PP被清空！`, type: "status" } });
        pushEffect({ type: 'log', side: s, data: { text: `💫 【${actor.name}】因PP值歸零，當回合無法行動！`, type: "status" } });
        await processQueue();
        continue;
      }

      // 不消耗PP（平靜、奧佩婭、滄嵐條件等）；「不受PP值限制」只影響能否選擇，PP>0 時照常扣
      if (isPpCostFree(actor, activeSkill, opp)) {
        ppCostComp.multiplier = 0;
      }

      // 帝皇之盾：攻擊技能 PP 消耗提升 3 倍
      if (actorState.attackPpMultiplierTurns > 0 && (activeSkill.category === '物理' || activeSkill.category === '特殊')) {
        ppCostComp.multiplier *= (actorState.attackPpMultiplierValue || 3);
        pushEffect({ type: 'log', side: s, data: { text: `🎡【盾】：受到致命餘威影響，攻擊技能 PP 消耗增加至 3 倍！`, type: "effect" } });
      }

      // PP Consumption Logic
      {
        const pm = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.ppMult && (!b.kind || (b.kind === "攻擊") === (skill.category !== "屬性")));
        if (pm) ppCostComp.multiplier *= pm.payload.block.ppMult;
      }
      const finalPpCost = Math.floor((ppCostComp.base + ppCostComp.additionalCost) * ppCostComp.multiplier);
      const extraAll = ppCostComp.extraAllSkills;

      if (finalPpCost > 0 || extraAll > 0) {
        const elfToUpdate = syncStateRef.current[s];
        const newSkills = elfToUpdate.skills.map(sk => {
          let newPp = sk.pp;
          if (sk.name === activeSkill.name) {
            const prevPp = newPp;
            newPp = Math.max(0, (newPp ?? 0) - finalPpCost);
            
            // §3: SPECIAL_BUFF ppRestoreOnZero (星護)
            if (newPp === 0 && (prevPp ?? 0) > 0) {
              const currentActorStatuses = getStatuses(elfToUpdate);
              Object.keys(currentActorStatuses).forEach(stId => {
                const entry = StatusRegistry[stId];
                const p = entry?.mechanics?.find(m => m.type === 'SPECIAL_BUFF')?.params || {};
                if (p.ppRestoreOnZero) {
                   newPp = getMaxPp(sk, elfToUpdate);
                   pushEffect({ type: 'log', side: s, data: { text: `🛡️ 【${entry.name}】：PP 耗盡！強制恢復全部 PP！`, type: "status" } });
                   
                   if (p.purgeNonWeakeningOnPPZero) {
                      const nextEffects = (elfToUpdate.effects || []).filter(e => {
                        const eEntry = StatusRegistry[e.id];
                        return eEntry?.categories?.includes('WEAKENING');
                      });
                      dispatch({ type: 'UPDATE_ELF', side: s, elf: { effects: nextEffects } });
                      pushEffect({ type: 'log', side: s, data: { text: `✨ 【${entry.name}】：解除了所有非弱化類異常狀態！`, type: "status" } });
                   }
                }
              });
            }
          }
          if (extraAll > 0) {
            newPp = Math.max(0, (newPp ?? 0) - extraAll);
          }
          return { ...sk, pp: newPp };
        });

        syncStateRef.current = {
          ...syncStateRef.current,
          [s]: { ...elfToUpdate, skills: newSkills }
        };
        dispatch({ type: 'UPDATE_ELF', side: s, elf: { skills: newSkills } });
        
        if (finalPpCost > 1) {
          pushEffect({ type: 'log', side: s, data: { text: `📉 【${displaySkill}】額外消耗了 ${finalPpCost - 1} 點 PP！`, type: "effect" } });
        }
        if (extraAll > 0) {
          pushEffect({ type: 'log', side: s, data: { text: `📉 受效果影響，【${displayName}】所有技能 PP 額外消耗 ${extraAll} 點！`, type: "effect" } });
        }

        // Trigger ON_PP_CONSUME for soulmarks/traits
        if (SoulMarkRegistry[elfToUpdate.name]) {
          SoulMarkRegistry[elfToUpdate.name](ctx, EffectTiming.ON_PP_CONSUME);
        }
      }

      // 【投石者】使用技能石時轉化為同屬系 SS 級技能石（威力 240、機率 100%）；PP 已由原技能石扣除
      if (activeSkill?.isSkillStone && isStoneThrower(syncStateRef.current[s])) {
        const ss = toSSStone(activeSkill, SOURCE_SS_TEXT);
        if (ss !== activeSkill) {
          pushEffect({ type: 'log', side: s, data: { text: `☄️ 【投石者】：【${activeSkill.name}】轉化為【${ss.name}】！`, type: "effect" } });
          activeSkill = ss;
          (ctx as any).skill = ss;
          if (!actorHidden) displaySkill = ss.name;
        }
      }

      // 技能本體轉化必須發生在技能無效、命中與攻擊免疫判定之前；PP仍扣原技能欄位。
      const transformedSkill = transformSkillBeforeResolve(getBattleEventContext(s, true, mIdx), activeSkill);
      if (transformedSkill !== activeSkill) {
        activeSkill = transformedSkill;
        (ctx as any).skill = transformedSkill;
        if (!actorHidden) displaySkill = transformedSkill.name;
      }

      const actorMarks = s === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
      const actorPoemCount = getMark(actorMarks || [], "poem_chapter")?.count || 0;
      const ignoreAttackInvalidation = actorPoemCount >= 8 && skill.category !== "屬性";

      let skillIsInvalidated = false;
      let invalidationReason = "";

      if (!ignoreAttackInvalidation) {
        // 1. Check for complete skill invalidation
        if ((actorState.allSkillInvalidTurns || 0) > 0 || (oppState[`${s}_allSkillInvalidTurns`] || 0) > 0) {
          skillIsInvalidated = true;
          invalidationReason = actorState.allSkillInvalidReason || oppState[`${s}_allSkillInvalidReason`] || "全技能無效狀態";
        } else if (oppState.globalSkillInvalidTurns > 0) {
          skillIsInvalidated = true;
          invalidationReason = oppState.globalSkillInvalidReason || "技能無效狀態";
        } else if (oppState.immuneAll || oppState[`${oppSide}_immuneAll`]) {
          skillIsInvalidated = true;
          invalidationReason = "技能免疫";
        } else if (oppState.evasionActive || oppState[`${oppSide}_evasionActive`]) {
          skillIsInvalidated = true;
          invalidationReason = "閃避";
        } else if (actorState.nextSkillInvalid) {
          skillIsInvalidated = true;
          invalidationReason = actorState.nextSkillInvalidReason || "技能失效";
          // Reset the invalidation flag immediately upon trigger so it only invalidates once!
          syncStateRef.current = {
            ...syncStateRef.current,
            [actorRegKey]: {
              ...(syncStateRef.current[actorRegKey] || {}),
              nextSkillInvalid: false
            }
          };
          dispatch({
            type: "UPDATE_REGISTRY_STATE",
            side: s,
            state: { nextSkillInvalid: false }
          });
        }
      }
      // 過去以下兩段接在 `if (!ignoreAttackInvalidation)` 的 else 之後，只有在「詩章 8 層」時才會檢查，
      // 等於所有「屬性技能無效／攻擊技能無效」效果都沒有作用。現在改為一律檢查。
      // 旗標語意：被限制方自己的 registry（setOpponentState 設在受害方）；incomingUtilityInvalidTurns 代表「對我使用的屬性技能無效」。
      // 2. Check for attribute skill invalidation
      if (skillIsInvalidated) {
        // 已失效
      } else if (skill.category === "屬性") {
        if (actorState.utilitySkillInvalidTurns > 0 || oppState.incomingUtilityInvalidTurns > 0 || actorState.sealPropertyTurns > 0 || oppState[`${s}_utilitySkillInvalidTurns`] > 0) {
          skillIsInvalidated = true;
          invalidationReason = oppState.incomingUtilityInvalidTurns > 0
            ? (oppState.incomingUtilityInvalidReason || "屬性技能失效狀態")
            : (actorState.utilitySkillInvalidReason || "屬性技能失效狀態");
        } else if ((actorState.utilityFailChanceTurns || 0) > 0 && prdChance(`${s}:utilityFail`, actorState.utilityFailChance || 0)) {
          skillIsInvalidated = true;
          invalidationReason = "屬性技能機率失效";
        } else if (oppState.utilitySkillInvalidChance > 0) {
          if (prdChance(`${s}:bs:L2299`, oppState.utilitySkillInvalidChance)) {
            skillIsInvalidated = true;
            invalidationReason = oppState.utilitySkillInvalidChanceReason || "屬性失效判定";
          }
        } else if (actorState.utilitySkillInvalidChance > 0) {
          if (prdChance(`${s}:bs:L2304`, actorState.utilitySkillInvalidChance)) {
            skillIsInvalidated = true;
            invalidationReason = actorState.utilitySkillInvalidChanceReason || "屬性失效判定";
          }
        }
      }
      // 3. Check for attack skill invalidation
      else if (!ignoreAttackInvalidation && skill.category !== "屬性") {
        if (actorState.attackSkillInvalidTurns > 0 || oppState[`${s}_attackSkillInvalidTurns`] > 0 || activeConstraints(syncStateRef.current[`${s}Timers`],actor).some(p=>p.blockAttack)) {
          skillIsInvalidated = true;
          invalidationReason = actorState.attackSkillInvalidReason || oppState[`${s}_attackSkillInvalidReason`] || "攻擊技能失效狀態";
        } else if (oppState.nextAttackSkillInvalid) {
          skillIsInvalidated = true;
          invalidationReason = oppState.nextAttackSkillInvalidReason || "攻擊失效狀態";
          // Consume the one-time flag
          const oppSide = s === "p1" ? "p2" : "p1";
          syncStateRef.current = {
            ...syncStateRef.current,
            [oppRegKey]: {
              ...oppState,
              nextAttackSkillInvalid: false
            }
          };
          dispatch({
            type: "UPDATE_REGISTRY_STATE",
            side: oppSide,
            state: { nextAttackSkillInvalid: false }
          });
        }
      }

      // §3: SPECIAL_BUFF checks for skillIsInvalidated (using existing actorStatuses/oppStatuses)
      // Check actor's buffs
      Object.keys(actorStatuses).forEach(stId => {
        const entry = StatusRegistry[stId];
        entry?.mechanics?.forEach(m => {
          if (m.type === 'SPECIAL_BUFF') {
            const p = m.params || {};
            if (p.attributeSkillFailChance && activeSkill.category === '屬性' && prdChance(`${s}:bs:L2342`, p.attributeSkillFailChance)) {
              skillIsInvalidated = true;
              invalidationReason = `【${entry.name}】判定失效`;
            }
            if (p.disableFifthSkill && activeSkill.isFifthSkill) {
              skillIsInvalidated = true;
              invalidationReason = `【${entry.name}】限制了第五技能的使用`;
            }
            if (p.overrideAttack) {
               // We need to change the skill being executed. 
               // Note: This only changes it for the current resolution.
               activeSkill = {
                 name: p.overrideAttack,
                 type: '物理',
                 category: '物理',
                 power: 35,
                 pp: 99,
                 description: '受【窒息】影響轉化為撞擊'
               } as any;
               displayName = `${displayName}(撞擊)`;
            }
          }
        });
      });

      // Check opponent's buffs
      Object.keys(oppStatuses).forEach(stId => {
        const entry = StatusRegistry[stId];
        entry?.mechanics?.forEach(m => {
          if (m.type === 'SPECIAL_BUFF') {
            const p = m.params || {};
            if (p.immunePrioritySkills && (calcPriority(s, activeSkill).priority > 0)) {
              skillIsInvalidated = true;
              invalidationReason = `【${entry.name}】先制技能無效`;
            }
            if (p.dodgeAll) {
              skillIsInvalidated = true;
              invalidationReason = `【${entry.name}】閃避所有技能`;
            }
          }
        });
      });

      // Check for utilitySkillAddEffectInvalidTurns
      const myRegKey = s === "p1" ? "p1RegistryState" : "p2RegistryState";
      const utilityInvalidTurns = syncStateRef.current[myRegKey]?.utilitySkillAddEffectInvalidTurns || 0;
      // 附加效果失效：技能仍命中（攻擊技能照常造成傷害），但附加效果不生效
      let addEffectsInvalid = false;
      let addEffectsInvalidReason = "";
      if (utilityInvalidTurns > 0 && activeSkill.category === "屬性") {
        addEffectsInvalid = true;
        addEffectsInvalidReason = "屬性技能附加效果失效";
      }
      if ((syncStateRef.current[s] as any)?.isAdditionalInvalid) {
        addEffectsInvalid = true;
        addEffectsInvalidReason = "技能附加效果失效";
      }
      // 競技場：雅髯獅嘯自潔附加的對手命中附加效果失效（回合數制，通用 tick 自動遞減）
      if (!addEffectsInvalid && (syncStateRef.current[myRegKey]?.allHitEffectNullTurns || 0) > 0) {
        addEffectsInvalid = true;
        addEffectsInvalidReason = "附加效果失效";
      }

      // Check for next2AtkInvalid
      const next2AtkInvalidVal = syncStateRef.current[myRegKey]?.next2AtkInvalid || 0;
      if (next2AtkInvalidVal > 0 && activeSkill.category !== "屬性") {
        skillIsInvalidated = true;
        invalidationReason = `【${syncStateRef.current[myRegKey]?.attackInvalidSource || "幽幕折返"}】對手攻擊技能無效（剩餘 ${next2AtkInvalidVal} 次）`;
        
        // Decrement next2AtkInvalidVal
        syncStateRef.current = {
          ...syncStateRef.current,
          [myRegKey]: {
            ...syncStateRef.current[myRegKey],
            next2AtkInvalid: next2AtkInvalidVal - 1
          }
        };
      }

      // 積木印記：持有者（屬性）技能無效
      if (!skillIsInvalidated) {
        const mk = ((s === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks) || []).find((m: any) => m.effects?.blkInvalid && (m.effects.blkInvalid === "all" || (m.effects.blkInvalid === "攻擊") === (activeSkill.category !== "屬性")));
        if (mk) { skillIsInvalidated = true; invalidationReason = `【${mk.name}】`; }
      }
      // 積木：對手下N次（攻擊／屬性）技能無效
      if (!skillIsInvalidated) {
        const inv = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.invalid && (b.invalid === "all" || (b.invalid === "攻擊") === (activeSkill.category !== "屬性")));
        if (inv) {
          skillIsInvalidated = true;
          invalidationReason = `【${inv.payload.block.src || "技能"}】`;
          getBattleEventContext(s, true, mIdx).consumeTimer?.(s, inv.id);
        }
      }
      // 積木：附加效果失效
      if (!addEffectsInvalid) {
        const ai = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.addInvalid && (b.addInvalid === "all" || (b.addInvalid === "攻擊") === (activeSkill.category !== "屬性")));
        if (ai) {
          addEffectsInvalid = true;
          addEffectsInvalidReason = `【${ai.payload.block.src || "效果"}】附加效果失效`;
          if (ai.kind === "use_counter") getBattleEventContext(s, true, mIdx).consumeTimer?.(s, ai.id);
        }
      }

      if (skillIsInvalidated) {
        // 技能無效視同未命中
        SoulMarkRegistry[syncStateRef.current[s].name]?.(getBattleEventContext(s, false, mIdx), EffectTiming.SKILL_INVALID, { skill: activeSkill, reason: invalidationReason, isIncoming: false });
        SoulMarkRegistry[syncStateRef.current[oppSide].name]?.(getBattleEventContext(oppSide, false, mIdx), EffectTiming.SKILL_INVALID, { skill: activeSkill, reason: invalidationReason, isIncoming: true });
        pushEffect({ type: 'log', side: s, data: { text: `🚫 【技能無效】：受${invalidationReason}限制，【${displayName}】使用的【${displaySkill}】無效！`, type: "info" } });
        showPopup(oppSide, "技能無效-0", "invalid");
        try { runSkillBlocks(getBattleEventContext(s, true, mIdx), "on_invalid", hasSkillHandler(activeSkill.name)); emitSelfInvalid(getBattleEventContext(s, true, mIdx)); } catch (e) { console.error("[blocks]", e); }
        await processQueue();
        continue; // Skip executing this action entirely!
      }

      pushEffect({ type: 'log', side: s, data: { text: `【${displayName}】使用了【${displaySkill}】！`, type: s, sourceCode: `src/effects/${actor.name}Registry.ts:${activeSkill.name}` } });
      try { emitSkillUse(getBattleEventContext(s, true, mIdx), getBattleEventContext(oppSide, true, mIdx), activeSkill, false); } catch (e) { console.error("[blocks]", e); }
      const animCategory = activeSkill.category === "屬性" ? "property" : activeSkill.category === "物理" ? "physical" : "special";
      pushEffect({ type: 'animation', side: s, data: { anim: { side: s, category: animCategory, skillName: activeSkill.name, targetSide: s === "p1" ? "p2" : "p1" }, duration: 400 } });

      // ── 命中判定（過去 accuracy／必中／命中等級都只是資料，所有技能必定命中）
      {
        const hit = rollSkillHit(syncStateRef.current[s], syncStateRef.current[oppSide], activeSkill, (e) => getStatuses(e), rng, syncStateRef.current[oppRegKey]);
        if (!hit.hit) {
          // 未命中：Miss-保底傷害（目前無保底 → 0）
          const missFloor = 0;
          pushEffect({ type: 'log', side: s, data: { text: `💨 【${displayName}】的【${displaySkill}】沒有命中！`, type: "info" } });
          showPopup(oppSide, `Miss-${missFloor}`, "miss");
          try { runSkillBlocks(getBattleEventContext(s, true, mIdx), "on_invalid", hasSkillHandler(activeSkill.name)); emitSelfInvalid(getBattleEventContext(s, true, mIdx)); } catch (e) { console.error("[blocks]", e); }
          await processQueue();
          continue;
        }
      }

      // ── 常駐閃避（積木魂印；必中技能無效）
      if (!activeSkill.isSureHit && !activeSkill.alwaysHit) {
        const evT = findBlockTimer((syncStateRef.current as any)[`${oppSide}Timers`], b => b.evade && !(b.kind === "攻擊" && activeSkill.category === "屬性"));
        const ev = Math.max(soulPassiveEvade(syncStateRef.current[oppSide], activeSkill), evT ? evT.payload.block.evade : 0);
        if (ev > 0 && prdChance(`${oppSide}:blkEvade`, ev / 100)) {
          pushEffect({ type: 'log', side: oppSide, data: { text: `💨 【${syncStateRef.current[oppSide].name}】閃避了【${displaySkill}】！`, type: "effect" } });
          showPopup(oppSide, "Miss-0", "miss");
          // 與無效分支（2603）／Miss分支（2621）一致：閃避也視為未命中，觸發 on_invalid＋self_invalid，
          // 否則 self_invalid timer（深潛者／淨世／sobirat）遇到閃避不會被消耗。
          try { runSkillBlocks(getBattleEventContext(s, true, mIdx), "on_invalid", hasSkillHandler(activeSkill.name)); emitSelfInvalid(getBattleEventContext(s, true, mIdx)); } catch (e) { console.error("[blocks]", e); }
          await processQueue();
          continue;
        }
      }

      // ── 攻擊免疫（攻擊技能未命中；必中無效；可被無視攻擊免疫貫穿；次數型只在擋下時消耗）
      if (activeSkill.category !== "屬性") {
        const actorReg0 = syncStateRef.current[actorRegKey] || {};
        const poemMk = getMark(actorMarks || [], "poem_chapter");
        const poemChapters = Math.max(poemMk?.count || 0, poemMk?.effects?.poemHpSnapshots?.length || 0);
        const ignoreSrc = ignoresAttackImmunity(syncStateRef.current[s], actorReg0, activeSkill, { addEffectsInvalid, poemChapters });
        // 「下次攻擊無視」在這次攻擊用掉
        const regAfterUse = { ...actorReg0, ignoreAttackImmunityNext: false, attackImmunityIgnoredThisAction: false };
        syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: regAfterUse };
        const oppReg0 = syncStateRef.current[oppRegKey] || {};
        const imm = getAttackImmunity(oppReg0);
        if (imm && !ignoreSrc) {
          if (imm.kind === "count") {
            syncStateRef.current = { ...syncStateRef.current, [oppRegKey]: { ...oppReg0, [imm.key]: imm.left - 1 } };
          }
          pushEffect({ type: 'log', side: oppSide, data: { text: `🛡️ 【免疫攻擊】：【${syncStateRef.current[oppSide].name}】免疫了【${displaySkill}】！${imm.kind === "count" ? `（剩餘 ${imm.left - 1} 次）` : ""}`, type: "effect" } });
          showPopup(oppSide, "Miss-0", "miss");
          await processQueue();
          continue;
        }
        if (imm && ignoreSrc) {
          pushEffect({ type: 'log', side: s, data: { text: `⚔️ 【無視攻擊免疫】：【${displaySkill}】無視了對手的攻擊免疫效果！`, type: "effect" } });
          const next = { ...syncStateRef.current[actorRegKey], attackImmunityIgnoredThisAction: true };
          if (grantsNextIgnoreOnSuccess(activeSkill)) {
            next.ignoreAttackImmunityNext = true;
            pushEffect({ type: 'log', side: s, data: { text: `⚔️ 【${displaySkill}】：無視成功，自身下次攻擊無視對手免疫攻擊效果！`, type: "effect" } });
          }
          syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: next };
        }
      }

      if (addEffectsInvalid) {
        pushEffect({ type: 'log', side: s, data: { text: `🚫 【附加效果失效】：【${displayName}】的【${displaySkill}】${addEffectsInvalidReason}！`, type: "info" } });
        showPopup(oppSide, "附加效果失效", "addInvalid");
      } else if (BattleSkillRegistry[activeSkill.name]) {
        BattleSkillRegistry[activeSkill.name](ctx);
      }
      activeSkill = transformSkillBeforeDamage(getBattleEventContext(s, true, mIdx), activeSkill);
      (ctx as any).skill = activeSkill;
      
      if (activeSkill.category !== "屬性" && activeSkill.power) {
        const hitCount = Math.max(1, Math.floor(syncStateRef.current[actorRegKey]?.attackHitCountThisAction || 1));
        syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], attackHitCountThisAction: 0 } };
        // 連擊不是額外行動：單次計算×連擊次數（官方公式），只播一次動畫；每擊附帶判定於結算後依次數處理。
        for (let pass = 0; pass < 1; pass++) {
        if (checkElfDead(syncStateRef.current[s]) || checkElfDead(syncStateRef.current[oppSide])) break;
        const currentActor = syncStateRef.current[s];
        const currentOpp = syncStateRef.current[oppSide];
        const blkCrit = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.crit);
        if (blkCrit && blkCrit.kind === "use_counter") getBattleEventContext(s, true, mIdx).consumeTimer?.(s, blkCrit.id);
        const isCritGuaranteed = !!blkCrit || !!syncStateRef.current[actorRegKey]?.nextTurnCrit || !!syncStateRef.current[actorRegKey]?.mustCrit || !!syncStateRef.current[actorRegKey]?.[s + "_mustCrit"];

        // Check for ignoreSpDefCount
        const ignoreSpDefCount = syncStateRef.current[actorRegKey]?.ignoreSpDefCount || 0;
        let ignoreSpDefPercent = 0;
        let ignoreDefPercent = 0;
        let ignoreOppBuff = false;
        if (syncStateRef.current[actorRegKey]?.ignoreOppBuffTurns > 0 || syncStateRef.current[actorRegKey]?.ignoreOppBuffThisAction) {
           ignoreOppBuff = true;
        }
        if (syncStateRef.current[actorRegKey]?.ignoreDef25Turns > 0) {
           ignoreDefPercent = 0.25;
        }
        // 星際藏品【迪恩之刃】：物理攻擊額外無視對手防禦 5%
        if (activeSkill.category === "物理" && (s === "p1" ? syncStateRef.current.p1Relics : syncStateRef.current.p2Relics)?.includes("dean_blade")) {
           ignoreDefPercent += 0.05;
        }
        if (ignoreSpDefCount > 0 && activeSkill.category === "特殊") {
          ignoreSpDefPercent = 0.60;
          syncStateRef.current = {
            ...syncStateRef.current,
            [actorRegKey]: {
              ...syncStateRef.current[actorRegKey],
              ignoreSpDefCount: ignoreSpDefCount - 1
            }
          };
          pushEffect({ type: 'log', side: s, data: { text: `🦇 【幽幕折返】：下 3 次特殊攻擊忽略對手特防 60%！（剩餘 ${ignoreSpDefCount - 1} 次）`, type: "effect" } });
        }

        const dmgRes = calculateDamage(
          currentActor,
          currentOpp,
          activeSkill,
          s,
          p1Suit,
          p2Suit,
          (217 + rng() * (255 - 217)) / 255,
          isCritGuaranteed ? true : undefined,
          mid.p1Team,
          mid.p2Team,
          { ignoreSpDefPercent, ignoreDefPercent, ignoreOppBuff, hitCount },
          p1Title,
          p2Title,
          syncStateRef.current.p1RegistryState,
          syncStateRef.current.p2RegistryState,
          syncStateRef.current.p1Marks,
          syncStateRef.current.p2Marks
        );
        
        syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], blkLastCrit: !!dmgRes.isCrit } };
        // 通用：本次攻擊不會出現微弱（剋制倍率低於 1 時視為 1）
        if (syncStateRef.current[actorRegKey]?.noResistedThisAction) {
          if (dmgRes.typeMultiplier > 0 && dmgRes.typeMultiplier < 1) {
            dmgRes.damage = Math.floor(dmgRes.damage / dmgRes.typeMultiplier);
            dmgRes.typeMultiplier = 1;
          }
          syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], noResistedThisAction: false } };
        }
        if (dmgRes.statResetApplied) {
          if (currentOpp.statStages) {
            currentOpp.statStages[dmgRes.statResetApplied] = 0;
            const statName = dmgRes.statResetApplied === "def" ? "物防" : "特防";
            pushEffect({ type: 'log', side: s, data: { text: `💥 【致命一擊】：無視對手${statName}強化！對方${statName}強化效果被消除！`, type: "effect" } });
          }
        }

        if (isCritGuaranteed) {
          pushEffect({ type: 'log', side: s, data: { text: `✨ 【必中致命一擊】：下回合致命一擊效果觸發！造成 2 倍傷害！`, type: "effect" } });
        }
        
        // Apply 5-stage damage computation
        const damageComp: DamageComputation = {
          base: dmgRes.damage,
          increasePercent: 0,
          decreasePercent: 0,
          multiplier: 1.0,
          damageCategory: "skill_attack",
          skillType: activeSkill.type,
          isCrit: dmgRes.isCrit
        };

        // Check for damageBoostThisTurn
        const damageBoostThisTurn = syncStateRef.current[actorRegKey]?.damageBoostThisTurn || 0;
        if (damageBoostThisTurn > 0) {
          damageComp.increasePercent += damageBoostThisTurn;
          syncStateRef.current = {
            ...syncStateRef.current,
            [actorRegKey]: {
              ...syncStateRef.current[actorRegKey],
              damageBoostThisTurn: 0
            }
          };
          pushEffect({ type: 'log', side: s, data: { text: `🦇 【劫數・萬念歸墟】：當回合傷害提升 ${damageBoostThisTurn * 100}%！`, type: "effect" } });
        }
        
        // Trigger actor's SoulMark BEFORE_DAMAGE
        if (SoulMarkRegistry[currentActor.name]) {
          const actorCtx = getBattleEventContext(s, true, mIdx);
          damageComp.isIncoming = false;
          SoulMarkRegistry[currentActor.name](actorCtx, EffectTiming.BEFORE_DAMAGE, Object.assign(damageComp, { damageComp }));
        }
        damageComp.isIncoming = false;
        triggerSuitEffect(s, EffectTiming.BEFORE_DAMAGE, { damageComp });
        
        // Trigger opponent's SoulMark BEFORE_DAMAGE
        if (SoulMarkRegistry[currentOpp.name]) {
          const oppCtx = getBattleEventContext(oppSide, true, mIdx);
          damageComp.isIncoming = true;
          SoulMarkRegistry[currentOpp.name](oppCtx, EffectTiming.BEFORE_DAMAGE, Object.assign(damageComp, { damageComp }));
        }
        damageComp.isIncoming = true;
        triggerSuitEffect(oppSide, EffectTiming.BEFORE_DAMAGE, { damageComp });
        broadcastExtraElfNode("造成傷害前");

        // 攻擊傷害與附加傷害共用持續閘門；條件、持有者及增減傷方向由模組判斷。
        applyActiveGateTimersToDamage(s, oppSide, damageComp, pushEffect, syncStateRef, { side: s, moveIndex: mIdx });

        // Check for shieldBlockNextAtk
        const oppRegKey = oppSide === "p1" ? "p1RegistryState" : "p2RegistryState";
        const hasShield = syncStateRef.current[oppRegKey]?.shieldBlockNextAtk;
        if (hasShield) {
          damageComp.multiplier = 0; // Reduce attack damage to 0
          syncStateRef.current = {
            ...syncStateRef.current,
            [oppRegKey]: {
              ...syncStateRef.current[oppRegKey],
              shieldBlockNextAtk: false
            }
          };
          const dmg = Math.floor(currentOpp.maxHp / 3);
          pushEffect({ type: 'damage', side: s, data: { amount: dmg, popup: true, label: "反擊", damageType: "true_damage" } });
          pushEffect({ type: 'log', side: oppSide, data: { text: `🦇 【劫數・萬念歸墟】：抵擋了本次攻擊，並對對手造成 ${dmg} 點真實傷害！`, type: "effect" } });
        }

        // §3: Apply SPECIAL_BUFF damage modifiers (using existing actorStatuses/oppStatuses)
        
        // Attacker buffs（pure 獨立乘區時跳過通用增減傷）
        if (!damageComp.pure) Object.keys(actorStatuses).forEach(stId => {
          const entry = StatusRegistry[stId];
          entry?.mechanics?.forEach(m => {
            if (m.type === 'SPECIAL_BUFF') {
              const p = m.params || {};
              if (p.damageDealtMultiplier) damageComp.multiplier *= p.damageDealtMultiplier;
              if (p.nonTrueDmgDealtMultiplier) damageComp.multiplier *= p.nonTrueDmgDealtMultiplier;
              if (p.fixedDmgMultiplier && (damageComp.damageCategory === 'fixed' || damageComp.damageCategory === 'percent')) {
                damageComp.multiplier *= p.fixedDmgMultiplier;
              }
              if (p.damageDealtImmuned) damageComp.multiplier = 0;
            }
          });
        });

        // Defender buffs（pure 獨立乘區時跳過通用增減傷；floor 保底類不受影響）
        if (!damageComp.pure) Object.keys(oppStatuses).forEach(stId => {
          const entry = StatusRegistry[stId];
          entry?.mechanics?.forEach(m => {
            if (m.type === 'SPECIAL_BUFF') {
              const p = m.params || {};
              if (p.damageTakenMultiplier) damageComp.multiplier *= p.damageTakenMultiplier;
              if (p.nonTrueDmgTakenMultiplier) damageComp.multiplier *= p.nonTrueDmgTakenMultiplier;
              if (p.fixedPercentDmgTakenMultiplier && (damageComp.damageCategory === 'fixed' || damageComp.damageCategory === 'percent')) {
                damageComp.multiplier *= p.fixedPercentDmgTakenMultiplier;
              }
              if (p.minDamageTakenPercent) {
                const min = currentOpp.maxHp * p.minDamageTakenPercent;
                damageComp.floor = Math.max(damageComp.floor || 0, min);
              }
              if (p.critMinDamageTakenPercent && dmgRes.isCrit) {
                const min = currentOpp.maxHp * p.critMinDamageTakenPercent;
                damageComp.floor = Math.max(damageComp.floor || 0, min);
              }
              if (p.takePhysSpecDmgBonusPercent && (damageComp.damageCategory === 'skill_attack')) {
                damageComp.increasePercent += p.takePhysSpecDmgBonusPercent;
              }
              if (p.takePhysSpecDmgBonusFixed && (damageComp.damageCategory === 'skill_attack')) {
                damageComp.bonusFixed = (damageComp.bonusFixed || 0) + p.takePhysSpecDmgBonusFixed;
              }
              if (p.reduceDmgEffectToZero) {
                 // Description says "減少、降低攻擊傷害效果衰減至0%", which means opponent's damage reduction is ignored.
                 // This is complex, but usually it means attacker's decreasePercent = 0.
                 // However, we are the defender here. Wait.
                 // If the defender has "腐朽", they take more damage.
                 // The description "減少、降低攻擊傷害效果衰減至0%" likely means the defender's own damage reduction effects are nulled.
                 damageComp.decreasePercent = 0;
              }
            }
          });
        });

        const oppMarksAll = oppSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks;
        if (!damageComp.pure) for (const mark of (oppMarksAll || []).filter(mark => markAppliesToElf(mark, syncStateRef.current[oppSide]))) {
          const perStack = mark.effects?.damageTakenIncreasePercentPerStack;
          if (perStack && mark.count > 0) {
            damageComp.increasePercent = (damageComp.increasePercent || 0) + mark.count * perStack;
            pushEffect({ type: 'log', side: oppSide, data: { text: `⛓️ 【${mark.name}】：持有 ${mark.count} 道，使受到傷害提升 ${Math.round(mark.count * perStack * 100)}%！`, type: "effect" } });
          }
        }

        // 通用特性／異能特質（屬性強化、堅硬、吸收、虛無、重傷…；pure 獨立乘區時跳過）
        if (!damageComp.pure) modifySkillDamage(currentActor, currentOpp, activeSkill, damageComp, getBattleEventContext(s, true, mIdx), rng,
          (text) => pushEffect({ type: 'log', side: s, data: { text, type: "effect" } }));

        // 印記：依持有者體力比例調整攻擊傷害（例如武誅：體力高於1/2時受到攻擊傷害提升、低於1/2時造成攻擊傷害降低）
        if (!damageComp.pure) {
          for (const mark of ((syncStateRef.current as any)[`${oppSide}Marks`] || []).filter((m: any) => markAppliesToElf(m, currentOpp))) {
            const k = mark.effects?.attackTakenMultAboveHalfHp;
            if (k && mark.count > 0 && currentOpp.currentHp > currentOpp.maxHp / 2) damageComp.multiplier *= k;
          }
          for (const mark of ((syncStateRef.current as any)[`${s}Marks`] || []).filter((m: any) => markAppliesToElf(m, currentActor))) {
            const k = mark.effects?.attackDealtMultBelowHalfHp;
            if (k && mark.count > 0 && currentActor.currentHp < currentActor.maxHp / 2) damageComp.multiplier *= k;
          }
        }

         // Calculate final result（pure 獨立乘區時跳過通用增減傷；floor／limit／mercy 不跳）
        if (activeConstraints(syncStateRef.current[`${s}Timers`], syncStateRef.current[s]).some(p => p.preventAttackDamage)) damageComp.multiplier = 0;
        const stage1 = damageComp.base * (1 + damageComp.increasePercent) * (1 - damageComp.decreasePercent);
        const dmgDoubleTurns = syncStateRef.current[actorRegKey]?.dmgDoubleTurns > 0;
        if (!damageComp.pure && dmgDoubleTurns) damageComp.multiplier *= 2;

        const oppRegKeyDamage = oppSide === "p1" ? "p1RegistryState" : "p2RegistryState";
        const damageTakenBoostTurns = syncStateRef.current[oppRegKeyDamage]?.damageTakenBoostTurns > 0 || syncStateRef.current[oppRegKeyDamage]?.DamageBoostTurns > 0;
        if (!damageComp.pure && damageTakenBoostTurns) damageComp.multiplier *= 2;
                const skillDamageBoost = syncStateRef.current[actorRegKey]?.skillDamageBoost;
        if (!damageComp.pure && skillDamageBoost) {
           damageComp.multiplier *= skillDamageBoost;
           syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], skillDamageBoost: 0 } };
        }
        
        const stage2 = stage1 * damageComp.multiplier;
        const damageLimit200Turns = syncStateRef.current[actorRegKey]?.damageLimit200Turns > 0;
        let finalLimit = damageComp.limit !== undefined ? damageComp.limit : Infinity;
        if (damageLimit200Turns) finalLimit = Math.min(finalLimit, 200);
        
        // 通用：N 回合內受到的（單次）攻擊傷害不超過 X 點（incomingSkillDmgCap，設在受擊方）
        const oppRegCap = syncStateRef.current[oppRegKeyDamage] || {};
        if ((oppRegCap.incomingSkillDmgCapTurns || 0) > 0 && oppRegCap.incomingSkillDmgCap !== undefined) {
          finalLimit = Math.min(finalLimit, oppRegCap.incomingSkillDmgCap);
        }
        if (syncStateRef.current[actorRegKey]?.blkIgnoreLimit || syncStateRef.current[actorRegKey]?.ignoreDamageLimitThisAction) finalLimit = Infinity;
        const stage3 = finalLimit !== Infinity ? Math.min(stage2, finalLimit) : stage2;
        const stage3_5 = stage3 + (damageComp.bonusFixed || 0);
        let finalDamage = Math.floor(damageComp.floor !== undefined ? Math.max(stage3_5, damageComp.floor) : Math.max(0, stage3_5));
        // 通用：手下留情（傷害大於對方體力時對方餘下 1 體力）
        if (syncStateRef.current[actorRegKey]?.mercyThisAction) {
          finalDamage = Math.min(finalDamage, Math.max(0, currentOpp.currentHp - 1));
          syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], mercyThisAction: false } };
        }
        
        // Read guaranteedMaxHpDamageChance on the defender (oppSide) from marks
        let maxGuaranteedMaxHpDamageChance = 0;
        for (const mark of (oppMarksAll || [])) {
          if (mark.effects?.guaranteedMaxHpDamageChance && mark.count > 0) {
            maxGuaranteedMaxHpDamageChance = Math.max(maxGuaranteedMaxHpDamageChance, mark.effects.guaranteedMaxHpDamageChance);
          }
        }
        
        if (maxGuaranteedMaxHpDamageChance > 0 && prdChance(`${s}:bs:L2678`, maxGuaranteedMaxHpDamageChance)) {
          pushEffect({ type: 'log', side: oppSide, data: { text: `🌀 【恐懼】：觸發恐懼保底傷害判定！當回合無法恢復體力，並受到致命衝擊！`, type: "effect" } });
          const currentOppMaxHp = currentOpp.maxHp;
          if (finalDamage < currentOppMaxHp) {
            finalDamage = currentOppMaxHp;
          }
          
          const oppRegKey = oppSide === "p1" ? "p1RegistryState" : "p2RegistryState";
          if (!syncStateRef.current[oppRegKey]) {
            syncStateRef.current[oppRegKey] = {};
          }
          syncStateRef.current = {
            ...syncStateRef.current,
            [oppRegKey]: {
              ...syncStateRef.current[oppRegKey],
              noHealTurns: 1,
              noHealReason: "恐懼效果限制"
            }
          };
          
          pushEffect({ type: 'damage', side: oppSide, data: { amount: currentOppMaxHp, label: "恐懼真傷", popup: true, damageType: "true_damage" } });
        }
        
        const ignoreShieldThisAction = !!(syncStateRef.current[actorRegKey]?.ignoreImmunityAndShield || syncStateRef.current[actorRegKey]?.blkIgnoreShield || syncStateRef.current[actorRegKey]?.ignoreShieldThisAction);
        pushEffect({ type: 'damage', side: oppSide, data: { amount: finalDamage, popup: true, isCrit: dmgRes.isCrit, label: [dmgRes.isCrit ? "暴擊" : "", hitCount > 1 ? `${hitCount}連擊` : ""].filter(Boolean).join(" "), sourceElfName: currentActor.name, sourceSide:s, sourceBattleId:currentActor.battleId||currentActor.id, skillName: displaySkill, typeMultiplier: dmgRes.typeMultiplier, damageType: "skill_attack", ignoreShield: ignoreShieldThisAction } });
        afterSkillHit(currentActor, currentOpp, activeSkill, finalDamage, dmgRes.isCrit,
          getBattleEventContext(s, true, mIdx), getBattleEventContext(oppSide, true, mIdx), rng);
        // 通用：下 N 回合自身攻擊技能必定令對手陷入某異常（attackInflictStatus）
        {
          const aReg = syncStateRef.current[actorRegKey] || {};
          if ((aReg.attackInflictStatusTurns || 0) > 0 && aReg.attackInflictStatus && finalDamage > 0) {
            const c2 = getBattleEventContext(s, true, mIdx);
            if (c2.applyStatusWithImmunityCheck(oppSide, aReg.attackInflictStatus, 2).success) {
              pushEffect({ type: 'log', side: s, data: { text: `✨ 攻擊附帶【${aReg.attackInflictStatus}】！`, type: "status" } });
            }
          }
        }

        // §2: Handle qingliang_dashi title (fixed damage on skill hit)
        const aTId = s === "p1" ? p1Title : p2Title;
        const aTitleDef = aTId ? TITLE_CATALOG[aTId] : undefined;
        if (aTitleDef?.effects?.fixedDamageOnSkillHit && finalDamage > 0) {
          const fixedDmg = aTitleDef.effects.fixedDamageOnSkillHit;
          pushEffect({ type: 'damage', side: oppSide, data: { amount: fixedDmg, popup: true, label: "稱號固傷", damageType: "fixed" } });
          pushEffect({ type: 'log', side: s, data: { text: `🌊 【清涼大使】：攻擊命中附加 ${fixedDmg} 點固定傷害！`, type: "effect" } });
        }

        // §47: Generic Suit Effects
        const oppSuitId = oppSide === "p1" ? p1Suit : p2Suit;
        const oppSuitDef = oppSuitId ? SUIT_CATALOG[oppSuitId] : undefined;
        if (oppSuitDef?.effects?.reflectDamagePercent && finalDamage > 0) {
          const reflectDmg = Math.floor(finalDamage * oppSuitDef.effects.reflectDamagePercent);
          pushEffect({ type: 'damage', side: s, data: { amount: reflectDmg, popup: true, label: "反射", damageType: "fixed" } });
          pushEffect({ type: 'log', side: oppSide, data: { text: `🛡️ 【${oppSuitDef.name}】：反射了 ${reflectDmg} 點傷害！`, type: "effect" } });
        }

        const actorSuitId = s === "p1" ? p1Suit : p2Suit;
        const actorSuitDef = actorSuitId ? SUIT_CATALOG[actorSuitId] : undefined;
         if (actorSuitDef?.effects?.statusChanceOnHit && finalDamage > 0) {
          const { status, chance, duration } = actorSuitDef.effects.statusChanceOnHit;
          if (prdChance(`${s}:bs:L2737`, chance)) {
            const nCtx = getBattleEventContext(s);
            const dur = duration || 2;
            nCtx.applyStatusWithImmunityCheck(oppSide, status, dur);
            pushEffect({ type: 'log', side: s, data: { text: `✨ 【${actorSuitDef.name}】：攻擊附加了 ${status} 效果 (${dur} 回合)！`, type: "effect" } });
          }
        }
        if (actorSuitDef?.effects?.elementalDamageBonus && finalDamage > 0) {
           // This is handled in damageCalculator.ts already, so we don't need it here.
        }

        // Check for nextAtkFixedDmgCount
        const nextAtkFixedDmgCount = syncStateRef.current[actorRegKey]?.nextAtkFixedDmgCount || 0;
        if (nextAtkFixedDmgCount > 0) {
          syncStateRef.current = {
            ...syncStateRef.current,
            [actorRegKey]: {
              ...syncStateRef.current[actorRegKey],
              nextAtkFixedDmgCount: nextAtkFixedDmgCount - 1
            }
          };
          pushEffect({ type: 'damage', side: oppSide, data: { amount: 300, popup: true, label: "固定傷害", damageType: "fixed" } });
          pushEffect({ type: 'log', side: s, data: { text: `🦇 【深淵凝視】：附加 300 點固定傷害！`, type: "effect" } });
        }

        // Sleep wakeup logic (using StatusRegistry wakeOnHit metadata)
        let hasWokenUp = false;
        let wokenStatusId = "";
        let wokenStatusName = "";
        
        Object.keys(oppStatuses).forEach(stId => {
          const entry = StatusRegistry[stId];
          entry?.mechanics?.forEach(m => {
            if (m.params?.wakeOnHit) {
              hasWokenUp = true;
              wokenStatusId = stId;
              wokenStatusName = entry.name;
            }
          });
        });

        if (finalDamage > 0 && hasWokenUp) {
          const nextOppEffects = (opp.effects || []).filter((e: any) => e.id !== wokenStatusId);
          const nextOppStatuses = { ...oppStatuses };
          delete nextOppStatuses[wokenStatusId];
          
          syncStateRef.current = {
            ...syncStateRef.current,
            [oppSide]: { ...opp, effects: nextOppEffects, battleStatuses: nextOppStatuses, battleStatus: "normal" }
          };
          dispatch({ type: 'UPDATE_ELF', side: oppSide, elf: { effects: nextOppEffects, battleStatuses: nextOppStatuses, battleStatus: "normal" } });
          pushEffect({ type: 'log', side: oppSide, data: { text: `✨ 【${opp.name}】從【${wokenStatusName}】中醒來了！`, type: "status" } });
        }

        queueSkillLifesteal(s, finalDamage, "skill_attack", syncStateRef.current[`${s}RegistryState`], pushEffect);
        await processQueue();
        for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
          if (checkElfDead(syncStateRef.current[s])) break; // 攻擊方已倒下（如被反擊致死）不再結算每擊效果
          const hitCtx = getBattleEventContext(s, true, mIdx);
          // 傷害只記在第一擊（總量），其餘擊只做每擊判定
          SoulMarkRegistry[hitCtx.self.name]?.(hitCtx, EffectTiming.AFTER_ATTACK_HIT, { skill: activeSkill, hitIndex, hitCount, damage: hitIndex === 0 ? finalDamage : 0, totalDamage: finalDamage, additionalEffectsEnabled: !addEffectsInvalid });
        }
        await processQueue();
        }
      }

      await processQueue();
      if (!addEffectsInvalid) {
        const ahCtx = getBattleEventContext(s, true, mIdx);
        const hasH = hasSkillHandler(activeSkill.name);
        const { unparsedLines } = runSkillBlocks(ahCtx, "after_hit", hasH);
        if (!hasH && unparsedLines.length) {
          const c2 = Object.create(ahCtx); c2.skill = { ...ahCtx.skill, description: unparsedLines.join("\n") };
          executeGenericSkillTextAfterHit(c2);
        }
      }
      try { emitSkillUse(getBattleEventContext(s, true, mIdx), getBattleEventContext(oppSide, true, mIdx), activeSkill, true); } catch (e) { console.error("[blocks]", e); }
      {
        const bp = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.prio != null && b && !(b.attackOnly && activeSkill.category === "屬性"));
        if (bp && bp.kind === "use_counter") getBattleEventContext(s, true, mIdx).consumeTimer?.(s, bp.id);
        const dm = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.dmgOut != null && !(b.kind === "攻擊" && activeSkill.category === "屬性"));
        if (dm && dm.kind === "use_counter" && activeSkill.category !== "屬性") getBattleEventContext(s, true, mIdx).consumeTimer?.(s, dm.id);
        {
          const rg = syncStateRef.current[actorRegKey] || {};
          let uses = rg.blkTypeOverrideUses || 0;
          if (rg.blkTypeOverrideExtend && !checkElfDead(syncStateRef.current[oppSide])) uses = rg.blkTypeOverrideExtend;
          syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...rg, blkIgnoreLimit: false, blkIgnoreBlock: false, blkIgnoreShield: false, ignoreDamageLimitThisAction: false, fixedTypeMultThisAction: 0, ignoreAttackImmunityThisAction: false, ignoreShieldThisAction: false, ignoreOppBuffThisAction: false, oppBoostAsDropThisAction: false, selfDropAsOppDropThisAction: false, blkAtkSpatkSum: false, blkLastCrit: false, blkStageAsBoost: 0, blkTypeOverrideUses: uses, blkTypeOverrideExtend: 0, blkTypeOverrideCurrentAction: false } };
        }
      }

      const currentActorAfter = syncStateRef.current[s];
      if (SoulMarkRegistry[currentActorAfter.name]) {
        const afterCtx = getBattleEventContext(s, true, mIdx);
        SoulMarkRegistry[currentActorAfter.name](afterCtx, EffectTiming.AFTER_ACTION);
      }
      triggerSuitEffect(s, EffectTiming.AFTER_ACTION, { skill: activeSkill });
      triggerSuitEffect(oppSide, EffectTiming.AFTER_ACTION, { skill: activeSkill, isIncoming: true });
      broadcastExtraElfNode("出手流程結束");

      await processQueue();

      // §1: Apply DAMAGE_TICK after action
      await applyDamageTicks(oppSide, "ACTION");

      // T0-4: Tick timers for action_end after each action
      const nextP1TimersAction = tickTimers(syncStateRef.current.p1Timers, 'action_end', (t) => {
        if ((t.payload?.wraps || t.payload?.wrapItems) && ['per_tick','on_expire'].includes(t.payload?.applyMode)) {
          const tickCtx = getBattleEventContext('p1', true, mIdx);
          runTimerPayload(t, tickCtx, 'p1');
        }
      });
      const nextP2TimersAction = tickTimers(syncStateRef.current.p2Timers, 'action_end', (t) => {
        if ((t.payload?.wraps || t.payload?.wrapItems) && ['per_tick','on_expire'].includes(t.payload?.applyMode)) {
          const tickCtx = getBattleEventContext('p2', true, mIdx);
          runTimerPayload(t, tickCtx, 'p2');
        }
      });
      syncStateRef.current = {
        ...syncStateRef.current,
        p1Timers: nextP1TimersAction,
        p2Timers: nextP2TimersAction
      };
      dispatch({ type: 'SET_TIMERS', side: 'p1', timers: nextP1TimersAction });
      dispatch({ type: 'SET_TIMERS', side: 'p2', timers: nextP2TimersAction });
      
      const faintsResult = await checkFaints(s);
      if (faintsResult) {
        if (faintsResult !== "game_over") await finalizeTurn();
        return;
      }

       // 清理公共模板行動臨時屬性
       if (
         syncStateRef.current[actorRegKey]?.damageModifiersThisAction ||
         syncStateRef.current[actorRegKey]?.powerMultiplierThisAction ||
         syncStateRef.current[actorRegKey]?.vampireRatio ||
         syncStateRef.current[actorRegKey]?.nextTurnPriority ||
         syncStateRef.current[actorRegKey]?.nextTurnCrit ||
         syncStateRef.current[actorRegKey]?.mustCrit ||
         syncStateRef.current[actorRegKey]?.[s + "_mustCrit"] ||
         syncStateRef.current[actorRegKey]?.evasionActive ||
         syncStateRef.current[actorRegKey]?.[s + "_evasionActive"] ||
         syncStateRef.current[actorRegKey]?.immuneAll ||
         syncStateRef.current[actorRegKey]?.ignoreImmunityAndShield ||
         syncStateRef.current[actorRegKey]?.[s + "_immuneAll"]
       ) {
         const nextRegState = {
           ...syncStateRef.current[actorRegKey],
           vampireDamageTypesThisAction: undefined,
           damageModifiersThisAction: [],
           powerMultiplierThisAction: 1,
           vampireRatio: 0,
           nextTurnPriority: 0,
           nextTurnCrit: false,
           mustCrit: false,
           [s + "_mustCrit"]: false,
           evasionActive: false,
           [s + "_evasionActive"]: false,
           immuneAll: false,
           ignoreImmunityAndShield: false,
           [s + "_immuneAll"]: false
         };
         syncStateRef.current = {
           ...syncStateRef.current,
           [actorRegKey]: nextRegState
         };
         dispatch({
           type: 'UPDATE_REGISTRY_STATE',
           side: s,
           state: { vampireDamageTypesThisAction: undefined, damageModifiersThisAction: [], powerMultiplierThisAction: 1, vampireRatio: 0, nextTurnPriority: 0, nextTurnCrit: false, ignoreImmunityAndShield: false }
         });
       }
    }

    if (prevActor) await endOfAction(prevActor.s, prevActor.i);

    // 安全網：Miss／技能無效等提前 continue 的路徑會跳過該次行動後的陣亡判定
    //（例如命中前的汲取把對手打到 0 後技能 Miss），在此補做，避免卡在 resolving
    if (checkElfDead(syncStateRef.current.p1) || checkElfDead(syncStateRef.current.p2)) {
      const fr = await checkFaints(actors[actors.length - 1]);
      if (fr) {
        if (fr !== "game_over") await finalizeTurn();
        return;
      }
    }

    for (const s of actors) {
      const actorRegKey = s === "p1" ? "p1RegistryState" : "p2RegistryState";
      const hasExtraAction = syncStateRef.current[actorRegKey]?.extraAction || syncStateRef.current[actorRegKey]?.[s + "_extraAction"];
      if (hasExtraAction) {
        syncStateRef.current = {
          ...syncStateRef.current,
          [actorRegKey]: {
            ...syncStateRef.current[actorRegKey],
            extraAction: false,
            [s + "_extraAction"]: false
          }
        };
        pushEffect({ type: 'log', side: s, data: { text: `⚡ 【額外行動】：獲得了再次出手攻擊的機會！`, type: "effect" } });
        const activeSkill = s === "p1" ? cur.p1SelectedSkill : cur.p2SelectedSkill;
        if (activeSkill && BattleSkillRegistry[activeSkill.name]) {
          const extraCtx = getBattleEventContext(s, true, 2);
          BattleSkillRegistry[activeSkill.name](extraCtx);
        }
      }
    }
    await processQueue();
    await finalizeTurn();
  }, [dispatch, finalizeTurn, getBattleEventContext, processQueue, pushEffect, battleMode, p1Suit, p2Suit, props, rng, checkFaints]);

  // ── 閒置階段自我校正 ───────────────────────────────────────
  // 例：強制換人階段中，陣亡方又被效果復活（符文歸位等）→ 卡在換人畫面卻無人可換；
  // 選招階段在場精靈已陣亡／整隊全滅卻沒有進入換人或結束。
  const validatingRef = useRef(false);
  const autoFinalizedTurnRef = useRef(-1);
  validateIdleRef.current = () => {
    if (isResolvingRef.current || validatingRef.current || processingPromiseRef.current) return;
    const st = syncStateRef.current;
    if (!st || st.phase === "game_over" || st.phase === "resolving" || st.winner) return;
    const d1 = checkElfDead(st.p1), d2 = checkElfDead(st.p2);
    const isForced = st.phase.startsWith("forced_switch");
    if (isForced) {
      const need1 = st.phase === "forced_switch_p1" || st.phase === "forced_switch_both";
      const need2 = st.phase === "forced_switch_p2" || st.phase === "forced_switch_both";
      const want = d1 && d2 ? "forced_switch_both" : d1 ? "forced_switch_p1" : d2 ? "forced_switch_p2" : "p1_select";
      const hasCandidate = (side: "p1" | "p2") => {
        const team = side === "p1" ? st.p1Team : st.p2Team;
        const idx = side === "p1" ? st.p1ActiveIndex : st.p2ActiveIndex;
        return team.some((e, i) => i !== idx && !e.isExtra && !checkElfDead(e));
      };
      const stuckNoCandidate = (need1 && d1 && !hasCandidate("p1")) || (need2 && d2 && !hasCandidate("p2"));
      if (stuckNoCandidate) {
        // 陣亡方沒有可換的精靈：若不是全滅（例如斯嘉麗等待重生），就照常結束回合繼續戰鬥
        if (autoFinalizedTurnRef.current === st.turnNumber) return; // 每回合最多自動收尾一次（防止自我推進迴圈）
        autoFinalizedTurnRef.current = st.turnNumber;
        validatingRef.current = true;
        checkFaints().then(res => {
          if (res === "game_over") return;
          pendingFinalizeRef.current = false;
          isResolvingRef.current = true;
          return finalizeTurn(true).finally(() => { isResolvingRef.current = false; });
        }).catch(e => console.error("[validateIdle]", e)).finally(() => {
          validatingRef.current = false;
          scheduleBattleTask(() => validateIdleRef.current(), 0);
        });
        return;
      }
      if (want !== st.phase) {
        if (want === "p1_select") completeForcedSwitchRef.current();
        else dispatch({ type: 'SET_PHASE', phase: want as any });
        return;
      }
      // AI 側（PVE 的 P2、自動戰鬥的 P1）強制換人：原本只靠 phase 變化時的 effect 觸發，
      // 若 render 合併導致 effect 沒跑就會永遠停在換人畫面
      const aiSides: ("p1" | "p2")[] = [];
      if (need2 && d2 && battleMode === "PVE") aiSides.push("p2");
      if (need1 && d1 && st.isAutoBattle) aiSides.push("p1");
      for (const side of aiSides) {
        let idx = pickAiForcedSwitch(st, side, p1Suit, p2Suit, rng);
        if (idx === -1) {
          // AI 只看 currentHp>0；「死亡條件不受體力限制」的精靈 0 血仍可上場，補上後備選擇
          const team = side === "p1" ? st.p1Team : st.p2Team;
          const cur = side === "p1" ? st.p1ActiveIndex : st.p2ActiveIndex;
          idx = team.findIndex((e, i) => i !== cur && !e.isExtra && !checkElfDead(e));
        }
        if (idx !== -1) { handlersRef.current.onSwitchElf(side, idx); return; }
      }
      return;
    }
    if ((st.phase === "p1_select" || st.phase === "p2_select") && (d1 || d2)) {
      const canReplace = (side: "p1" | "p2") => {
        const team = side === "p1" ? st.p1Team : st.p2Team;
        const idx = side === "p1" ? st.p1ActiveIndex : st.p2ActiveIndex;
        return team.some((e, i) => i !== idx && !e.isExtra && !checkElfDead(e));
      };
      const teamWiped = (side: "p1" | "p2") => !(side === "p1" ? st.p1Team : st.p2Team).some(e => !e.isExtra && !checkElfDead(e));
      // 等待重生（無人可換、也非全滅判定）時不強制進入換人
      if ((d1 && (canReplace("p1") || teamWiped("p1"))) || (d2 && (canReplace("p2") || teamWiped("p2")))) {
        validatingRef.current = true;
        checkFaints().finally(() => { validatingRef.current = false; });
      }
    }
  };

  completeForcedSwitchRef.current = () => {
    // 只在「真的處於換人階段」時才收尾，避免過期的 render／effect 把已開始的結算改回選招
    if (!syncStateRef.current.phase.startsWith("forced_switch")) return;
    if (pendingFinalizeRef.current && !isResolvingRef.current) {
      pendingFinalizeRef.current = false;
      isResolvingRef.current = true;
      finalizeTurn().catch(e => console.error("[finalizeTurn]", e)).finally(() => {
        isResolvingRef.current = false;
        scheduleBattleTask(() => validateIdleRef.current(), 0);
      });
    } else if (!isResolvingRef.current) {
      dispatch({ type: 'SET_PHASE', phase: "p1_select" });
    }
  };

  startResolveRef.current = () => {
    if (syncStateRef.current.phase === "resolving" && !isResolvingRef.current) {
      isResolvingRef.current = true;
      resolveTurn().catch(e => console.error("[resolveTurn]", e)).finally(() => {
        isResolvingRef.current = false;
        scheduleBattleTask(() => validateIdleRef.current(), 0);
      });
    }
  };

  useEffect(() => {
    // 以即時狀態判斷：render 的 phase 可能落後於真實狀態，避免同一回合被重複結算
    if (phase === "resolving" && syncStateRef.current.phase === "resolving" && !isResolvingRef.current) {
      isResolvingRef.current = true;
      resolveTurn().finally(() => {
        isResolvingRef.current = false;
        scheduleBattleTask(() => validateIdleRef.current(), 0);
      });
    }
  }, [phase, resolveTurn]);

  // Initial entrance: fire ON_ENTRANCE for both starters at battle start.
  useEffect(() => {
    if (hasInitialEntranceRef.current) return;
    hasInitialEntranceRef.current = true;
    (async () => {
      for (const side of ["p1", "p2"] as const) {
        const cur = syncStateRef.current;
        const team = side === "p1" ? cur.p1Team : cur.p2Team;
        const activeIdx = side === "p1" ? cur.p1ActiveIndex : cur.p2ActiveIndex;
        const starter = team[activeIdx];
        if (!starter || checkElfDead(starter)) continue;
        const ctx = getBattleEventContext(side, true, undefined, undefined, true);
        TraitsEngine.triggerOnEntrance(ctx);
        if (SoulMarkRegistry[starter.name]) {
          SoulMarkRegistry[starter.name](ctx, EffectTiming.ON_ENTRANCE);
        }
        applyEntranceBlessings(side, starter, ctx);
        triggerSuitEffect(side, EffectTiming.ON_ENTRANCE);
        broadcastElfEntered(side, starter.id);
      }
      await processQueue();
    })();
  }, [getBattleEventContext, triggerSuitEffect, processQueue]);

  const onSkillSelect = (side: "p1" | "p2", skill: Skill) => {
    if (!battleAliveRef.current) return;
    const cur = latestStateRef.current;

    // 選擇技能時立即點亮與激活符文
    const actorElf = side === 'p1' ? cur.p1 : cur.p2;
    if (skill.category !== "屬性" && activeConstraints(cur[`${side}Timers`], actorElf).some(p => p.blockAttack)) {
      dispatch({type:"ADD_LOG",log:{turn:cur.turnNumber,text:"目前受到攻擊技能限制，請選擇屬性技能、切換或道具。",type:"effect"}});
      return;
    }
    if (actorElf && actorElf.skills) {
      const idx = actorElf.skills.findIndex(s => s.name === skill.name);
      if (idx !== -1) {
        activateRuneOnSkillSelect(actorElf, idx, (msg, type) => {
          pushEffect({ type: 'log', side, data: { text: msg, type: type as any } });
        });
      }
    }

    if (syncStateRef.current.phase === "p1_select" && side === "p1") {
      dispatch({ type: 'SET_SKILL', side: 'p1', skill });
      if (battleMode === "PVE") {
        const action = pickAiAction(cur, 'p2', p1Suit, p2Suit, rng);
        if (action.type === 'skill') {
          if (cur.p2 && cur.p2.skills) {
            const aiIdx = cur.p2.skills.findIndex(s => s.name === action.skill!.name);
            if (aiIdx !== -1) {
              activateRuneOnSkillSelect(cur.p2, aiIdx, (msg, type) => {
                pushEffect({ type: 'log', side: 'p2', data: { text: msg, type: type as any } });
              });
            }
          }
          dispatch({ type: 'SET_SKILL', side: 'p2', skill: action.skill! });
        } else if (action.type === 'switch') {
          dispatch({ type: 'SET_SKILL', side: 'p2', skill: { name: "切換精靈", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
          dispatch({ type: 'SET_SWITCH_INDEX', side: 'p2', index: action.switchIndex! });
        } else if (action.type === 'item') {
          dispatch({ type: 'SET_ITEM', side: 'p2', item: action.item! });
          dispatch({ type: 'SET_SKILL', side: 'p2', skill: { name: "使用道具", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
        }
        dispatch({ type: 'SET_PHASE', phase: "resolving" });
      } else {
        dispatch({ type: 'SET_PHASE', phase: "p2_select" });
      }
    } else if (syncStateRef.current.phase === "p2_select" && side === "p2") {
      dispatch({ type: 'SET_SKILL', side: 'p2', skill });
      dispatch({ type: 'SET_PHASE', phase: "resolving" });
    }
  };

  const onSwitchElf = (side: "p1" | "p2", index: number) => {
    if (!battleAliveRef.current) return;
    const cur = latestStateRef.current;
    const team = side === 'p1' ? cur.p1Team : cur.p2Team;
    const targetElf = team[index];
    if (!targetElf || checkElfDead(targetElf)) return;
    if (targetElf.isExtra) return;

    // §40-1: Check if switch is disabled by status
    const oppSide = side === 'p1' ? 'p2' : 'p1';
    const oppElf = cur[oppSide];
    // 陣亡後的強制換人不受「無法切換」類效果限制（否則會永久卡在換人畫面）
    const isForcedReplace = cur.phase.startsWith("forced_switch") && checkElfDead(cur[side]);
    if (!isForcedReplace && isElfSwitchDisabled(cur[side], oppElf, false, getNoSwitchTurns(cur, side))) {
      pushEffect({ type: 'log', side, data: { text: `🚫 受到異常狀態或效果影響，此刻無法切換精靈！`, type: "system" } });
      return;
    }

    // Check for lock switch timers
    const timers = side === 'p1' ? cur.p1Timers : cur.p2Timers;
    if (timers.some(t => t.payload?.lockSwitch === true)) {
      if (!syncStateRef.current.phase.startsWith("forced_switch")) {
        pushEffect({ type: 'log', side, data: { text: `🚫 此刻無法切換精靈！`, type: "system" } });
        return;
      }
    }

    if (syncStateRef.current.phase.startsWith("forced_switch")) {
      const outgoingElf = cur[side];
      if (outgoingElf && SoulMarkRegistry[outgoingElf.name]) {
        const outCtx = getBattleEventContext(side, true, 0);
        SoulMarkRegistry[outgoingElf.name](outCtx, EffectTiming.ON_SWITCH_OUT, { incomingElf: targetElf });
      }

      if (outgoingElf) {
        const outCtx = getBattleEventContext(side, true, 0);
        for (const mark of outCtx.getMarks(side)) {
          if (mark.persistsOffField === false) {
            outCtx.clearMark(mark.id, side);
            outCtx.addLog(`💨 【${outgoingElf.name}】下場，【${mark.name}】隨之消失。`, "info");
          }
        }
      }

      if (outgoingElf) {
        const sideRegKey = side === 'p1' ? "p1RegistryState" : "p2RegistryState";
        syncStateRef.current = {
          ...syncStateRef.current,
          [sideRegKey]: {
            ...syncStateRef.current[sideRegKey],
            previousActiveElfId: outgoingElf.id,
            switchedThisTurn: true
          }
        };
        dispatch({
          type: 'UPDATE_REGISTRY_STATE',
          side,
          state: { previousActiveElfId: outgoingElf.id, switchedThisTurn: true }
        });
      }

      pushEffect({ type: 'log', side, data: { text: `【${side === 'p1' ? '玩家一' : '玩家二'}】派出了 【${targetElf.name}】！`, type: "info" } });
      dispatch({ type: 'FORCED_SWITCH', side, index, newElf: syncStateRef.current[side === 'p1' ? 'p1Team' : 'p2Team'][index] });
      
      const activeIdxKey = side === 'p1' ? 'p1ActiveIndex' : 'p2ActiveIndex';
      syncStateRef.current = switchBattleSide(syncStateRef.current, side, index);

      const newCtx = getBattleEventContext(side);
      TraitsEngine.triggerOnEntrance(newCtx);
      if (SoulMarkRegistry[targetElf.name]) {
        SoulMarkRegistry[targetElf.name](newCtx, EffectTiming.ON_ENTRANCE);
      }
      applyEntranceBlessings(side, targetElf, newCtx);
      triggerSuitEffect(side, EffectTiming.ON_ENTRANCE);
      broadcastElfEntered(side, targetElf.id);

      // Check for incomingElfFear on entering side
      const enteringRegKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";
      if (syncStateRef.current[enteringRegKey]?.incomingElfFear) {
        syncStateRef.current = {
          ...syncStateRef.current,
          [enteringRegKey]: {
            ...syncStateRef.current[enteringRegKey],
            incomingElfFear: false
          }
        };
        newCtx.applyStatusWithImmunityCheck(side, "害怕", 1);
        pushEffect({ type: 'log', side, data: { text: `🦇 【懼噬・虛實逆寫】：對手新精靈首回合陷入害怕！`, type: "effect" } });
      }

      const oppSide = side === 'p1' ? 'p2' : 'p1';
      const oppElf = syncStateRef.current[oppSide];
      if (oppElf && SoulMarkRegistry[oppElf.name]) {
        const oppCtx = getBattleEventContext(oppSide, false, 0);
        SoulMarkRegistry[oppElf.name](oppCtx, "OPPONENT_SWITCH" as any, { switchingSide: side });
      }
      
      if (syncStateRef.current.phase === "forced_switch_both") {
        dispatch({ type: 'SET_PHASE', phase: side === "p1" ? "forced_switch_p2" : "forced_switch_p1" });
      } else {
        completeForcedSwitchRef.current();
      }
    } else {
      dispatch({ type: 'SET_SKILL', side, skill: { name: "切換精靈", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
      dispatch({ type: 'SET_SWITCH_INDEX', side, index });
      if (side === 'p1') {
        if (battleMode === "PVE") {
          const action = pickAiAction(cur, 'p2', p1Suit, p2Suit, rng);
          if (action.type === 'skill') {
            dispatch({ type: 'SET_SKILL', side: 'p2', skill: action.skill! });
          } else if (action.type === 'switch') {
            dispatch({ type: 'SET_SKILL', side: 'p2', skill: { name: "切換精靈", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
            dispatch({ type: 'SET_SWITCH_INDEX', side: 'p2', index: action.switchIndex! });
          } else if (action.type === 'item') {
            dispatch({ type: 'SET_ITEM', side: 'p2', item: action.item! });
            dispatch({ type: 'SET_SKILL', side: 'p2', skill: { name: "使用道具", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
          }
          dispatch({ type: 'SET_PHASE', phase: "resolving" });
        } else {
          dispatch({ type: 'SET_PHASE', phase: "p2_select" });
        }
      } else {
        dispatch({ type: 'SET_PHASE', phase: "resolving" });
      }
    }
  };

  const [potionsUsed, setPotionsUsed] = React.useState(0);
  const potionLimit = props.interstellarOptions?.onPotionUse ? { max: Number((props.interstellarOptions as any).maxPotionUsage) || 0, left: Math.max(0, (Number((props.interstellarOptions as any).maxPotionUsage) || 0) - potionsUsed) } : undefined;
  const onUseItem = (side: "p1" | "p2", item: BattleItem) => {
    if (!battleAliveRef.current) return;
    const curForItems = latestStateRef.current;

    // §40-1: Check if item usage is disabled by status
    if (isElfItemDisabled(curForItems[side])) {
      pushEffect({ type: 'log', side, data: { text: `🚫 受到異常狀態影響，無法使用道具！`, type: "system" } });
      return;
    }

    // 星際探索：每次使用道具消耗 1 次藥劑；用盡即鎖定（只影響此模式）。「特殊」欄位保留，不計次、不鎖定。
    if (side === "p1" && props.interstellarOptions?.onPotionUse && item.type !== "special") {
      if (!props.interstellarOptions.onPotionUse()) { pushEffect({type:"log",side,data:{text:"藥劑次數已用盡。",type:"effect"}}); return; }
      setPotionsUsed(n => n + 1);
    }
    dispatch({ type: 'SET_ITEM', side, item });
    dispatch({ type: 'SET_SKILL', side, skill: { name: "使用道具", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
    
    if (side === 'p1') {
      if (battleMode === "PVE") {
        const cur = latestStateRef.current;
        const action = pickAiAction(cur, 'p2', p1Suit, p2Suit, rng);
        if (action.type === 'skill') {
          dispatch({ type: 'SET_SKILL', side: 'p2', skill: action.skill! });
        } else if (action.type === 'switch') {
          dispatch({ type: 'SET_SKILL', side: 'p2', skill: { name: "切換精靈", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
          dispatch({ type: 'SET_SWITCH_INDEX', side: 'p2', index: action.switchIndex! });
        } else if (action.type === 'item') {
          dispatch({ type: 'SET_ITEM', side: 'p2', item: action.item! });
          dispatch({ type: 'SET_SKILL', side: 'p2', skill: { name: "使用道具", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
        }
        dispatch({ type: 'SET_PHASE', phase: "resolving" });
      } else {
        dispatch({ type: 'SET_PHASE', phase: "p2_select" });
      }
    } else {
      dispatch({ type: 'SET_PHASE', phase: "resolving" });
    }
  };

  // T0-6: Auto Battle Driver
  useEffect(() => {
    if (!state.isAutoBattle || winner || phase !== "p1_select") return;
    const t = scheduleBattleTask(() => {
      const cur = latestStateRef.current;
      const action = pickAiAction(cur, 'p1', p1Suit, p2Suit, rng);
      if (action.type === 'skill') onSkillSelect('p1', action.skill!);
      else if (action.type === 'switch') onSwitchElf('p1', action.switchIndex!);
      else if (action.type === 'item' && action.item) onUseItem('p1', action.item);
      // 托管保底：選擇被拒（道具用盡、技能受限等）時改用第一個可用技能，避免卡在選擇階段
      if (syncStateRef.current.phase === "p1_select" && battleAliveRef.current) {
        const me = syncStateRef.current.p1;
        const usable = (me?.skills || []).find(sk => (sk.pp ?? 0) > 0 || isZeroPpExempt(me, sk, syncStateRef.current.p2));
        if (usable) onSkillSelect('p1', usable);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [phase, state.isAutoBattle, winner, p1Suit, p2Suit]);

  // T0-8: Driven forced switch resolution
  useEffect(() => {
    if (phase.startsWith("forced_switch")) {
      const s = latestStateRef.current;
      if (!checkElfDead(s.p1) && !checkElfDead(s.p2)) {
        completeForcedSwitchRef.current();
      }
    }
  }, [phase]);

  // AI Forced Switch Driver for forced_switch phases (PVE mode)
  useEffect(() => {
    if (phase === "forced_switch_p2" || phase === "forced_switch_both") {
      if (battleMode === "PVE") {
        const cur = latestStateRef.current;
        if (checkElfDead(cur.p2)) {
          const nextIdx = pickAiForcedSwitch(cur, 'p2', p1Suit, p2Suit, rng);
          if (nextIdx !== -1) {
            onSwitchElf('p2', nextIdx);
          }
        }
      }
    }
  }, [phase, battleMode, p1Suit, p2Suit]);

  // Auto Battle Forced Switch Driver (p1)
  useEffect(() => {
    if (phase === "forced_switch_p1" || phase === "forced_switch_both") {
      if (state.isAutoBattle) {
        const cur = latestStateRef.current;
        if (checkElfDead(cur.p1)) {
          const nextIdx = pickAiForcedSwitch(cur, 'p1', p1Suit, p2Suit, rng);
          if (nextIdx !== -1) {
            onSwitchElf('p1', nextIdx);
          }
        }
      }
    }
  }, [phase, state.isAutoBattle, p1Suit, p2Suit]);

  // Provider value 只在 state 改變時重建；handler 透過 ref 取最新版本，避免每次渲染都讓所有 consumer 重畫
  const handlersRef = useRef({ onSkillSelect, onSwitchElf, onUseItem });
  handlersRef.current = { onSkillSelect, onSwitchElf, onUseItem };
  const contextValue = useMemo<BattleContextProps>(() => ({
    ...state,
    turnNumber: presentation.turnNumber,
    battleFormat: props.battleFormat,
    p1: { ...state.p1, currentHp: presentation.hp.get(`p1:${state.p1.battleId || state.p1.id}`) ?? state.p1.currentHp },
    p2: { ...state.p2, currentHp: presentation.hp.get(`p2:${state.p2.battleId || state.p2.id}`) ?? state.p2.currentHp },
    floatingDamagePopups: presentation.popups,
    lastActionInfo: null,
    consoleShake: { p1: false, p2: false },
    dispatch, pushEffect,
    addLog: (text, type) => pushEffect({ type: 'log', side: 'p1', data: { text, type } }),
    trackCodeExec: () => {},
    onSkillSelect: (skill) => handlersRef.current.onSkillSelect('p1', skill),
    onSwitchElf: (index) => handlersRef.current.onSwitchElf('p1', index),
    onUseItem: (item) => handlersRef.current.onUseItem('p1', item)
  }), [state, pushEffect, presentationVersion]);

  return (
    <BattleContext.Provider value={contextValue}>
      <BattleScreenUI 
        onSkillSelect={onSkillSelect}
        onSwitchElf={onSwitchElf}
        onUseItem={onUseItem}
        potionLimit={potionLimit}
        specialMode={props.specialMode}
        onReset={props.onRestartBattle}
        onBackToMenu={() => { if (!syncStateRef.current.winner) props.onBattleEnd?.("exit", structuredClone(syncStateRef.current.p1Team)); props.onBackToMenu(); }}
        onAutoBattleToggle={() => dispatch({ type: 'SET_AUTO_BATTLE', isAuto: !state.isAutoBattle })}
        activeSkillAnim={state.activeSkillAnim}
        floatingDamagePopups={presentation.popups}
        consoleShake={{ p1: false, p2: false }}
        damageDealt={state.damageDealt}
      />
    </BattleContext.Provider>
  );
}
