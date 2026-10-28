import {dispatchShieldChange,retainShield} from '../battle/markCapabilities';
import { takeAttachedAttackDamage } from '../battle/attachedAttackDamage';
import {statusSkillSelected,statusSelectionRoundEnd} from '../effects/statusMechanics';
import {damageReductionReceipt} from '../battle/damageReductionReceipt';
import { runNode } from '../effects/effectRunner';
import { CODEX } from '../data/codexRegistry';
import {portableSkillCapabilities,redirectedSelectedSkill} from '../battle/portableSkillMarks';
// 戰鬥引擎：與 React 無關的回合結算。BattleScreen 只負責輸入與播放。
// 由 BattleScreen.tsx 抽出（2026-10-10）；節點順序見 ./nodes.ts。
import { matchesDamageTypes } from '../effects/damageChoices';
import { matchesSkillCategory } from '../battle/skillCategoryMatch';
import { takeSkillRecalculation, recalculatedSkill } from '../battle/skillRecalculation';
import { reductionPolicy, multiplyDamageReduction, applyStatusDamageModifiers, applyMarkDamageReductions, finalizeDamageReductions } from '../battle/damageReduction';
import { capCurrentHp, recordDamageHpCeilings } from '../battle/hpCeiling';
import { applyAdvancedDamageModifiers, applyOutgoingSkillRestriction, applyAlienDoubleDamage } from '../battle/advancedDamageModifiers';
import { dispatchModeEvent } from '../battle/modeEvents';
import { reactToTimedAttack, timedRecoveryMultiplier, recordBattleEntrance } from '../battle/timedReactions';
import { settlementReceipt, notifySettlement } from '../battle/settlementReceipt';
import { createDamageLedger, recordDamage, recordHeal, recordAdjust, type DamageLedger } from '../battle/damageLedger';
import { createBattleItemInventory, hasBattleItem } from '../battle/itemInventory';
import { runTitleEffects } from '../battle/titleEffects';
import { findBagElf } from '../battle/bagTargets';
import { damagePresentationAmount } from '../battle/damagePresentation';
import { BattlePresentation, effectivenessLabel, type PresentationKind } from '../battle/presentation';
import { hiddenFromViewer } from '../battle/viewerPerspective';
import { BATTLE_ANIMATION_EVENT, readAnimationSettings, effectiveAnimationSettings, animationModeFor, type BattleAnimationSettings } from '../battle/animationSettings';
import { activeConstraints } from '../battle/timedConstraints';
import { mergeRoundEnd } from '../battle/roundEndMerge';
import { skillSlot } from '../battle/skillSlot';
import { attackDefenseBypass, bypassesAttackDefense, applyAttackDefenseLimit } from '../battle/attackDefense';
import { readScopedRegistry, scopedTimers } from '../battle/stateScopes';
import { actionDefenseIgnore } from '../battle/actionDefenseModifiers';
import { queueSkillLifesteal } from '../battle/lifesteal';
import { isRecoveryBlocked, resolveRecoveryEffect } from '../battle/recovery';
import {blocksOwnSkillRecovery,blocksTimedRecovery,withRecoveryOrigin} from '../battle/recoveryOrigin';
import { Elf, Skill, BattleLog, BattleMode, BattleItem, BattleEffect, StatChange } from "../types";
import { BattleEventContext, EffectTiming, DamageComputation, PriorityComputation, ActionResultInfo } from "../effects/types";
import { resolveDamageBlocking } from '../battle/damageBlocking';
import { statusSkillTransform } from '../battle/statusSkillTransform';
import { BattleState, BattleAction, battleReducer, EffectItem, TurnDamageStats } from "../components/BattleManager";
import { isSkillStone } from "../data/skillStones";
import { stonePriorityBonus, stoneAfterHitHandler } from '../effects/skillStoneEffects';
import { readChancePriority, readSkillProperty,skillReductionPolicy, readOnceDegraded,resolveSelectedPriorityPolicies } from '../effects/skillProperty';
import { getTypeMatchup, resetElfStateForBattle, calculateEffectiveStat, getEffectiveBody } from "../utils/statCalculator";
import { applyStatChanges } from "../utils/statChangeManager";
import { BattleSkillRegistry, SoulMarkRegistry, hasSkillHandler, observesOpponentDamage, transformSkillBeforeResolve, transformSkillBeforeDamage, getBattleSkillAfterHitRegistry, getBattleSkillOnInvalidRegistry } from "../effects/battleEventRegistry";
import {innateAllowed} from '../effects/additionalGate';
import { settlePpChanges, recoverPpByTimers } from '../battle/ppTransitions';
import { targetedDamageAPI } from '../battle/targetedDamage';
import { endIllusion, illusionSkill } from '../battle/illusion';
import { skillStageView } from '../battle/skillStageView';
import { consumeSkillTypeOverride } from '../battle/skillTypeOverride';
import { executeGenericSkillTextAfterHit, rollSkillHit } from "../effects/genericSkillText";
import { getAttackImmunity, ignoresAttackImmunity, grantsNextIgnoreOnSuccess } from "../battle/attackImmunity";
import { runSkillBlocks, emitSkillUse, soulPassiveEvade, emitSelfInvalid, emitFailedSkillUse } from "../blocks/registry";
import {hasForcedHitEffects,runForcedHitEffects} from '../effects/forcedHitEffects';
import { skillBasePriority } from "../battle/conditionalPriority";
import { drainExtraActionQueue } from "../battle/extraActions";
import { findBlockTimer } from "../blocks/runtime";
import { modifySkillDamage, afterSkillHit, traitFatalResist, priorityBonus } from "../effects/traitEffects";
import { SuitEffectRegistry } from "../effects/suitEffectRegistry";
import { runRelicEffects } from "../effects/relicEffectRegistry";
import { runBossTraitEffects, bossTraitEvade, bossTraitInvalidates } from "../blocks/ops/bossTraits";
import { StatusRegistry } from "../effects/statusRegistry";
import { canonicalStatusName } from '../effects/statusIdentity';
import { advanceStatusEffect, mergeSameStatus } from '../battle/statusLifecycle';
import { judgeTurnLimit, countedAlive, PEAK_TURN_LIMIT } from '../battle/turnLimit';
import { applyEquipmentToTeam } from "../data/suitsAndEyewears";
import { makeRng, snapshotPRNG } from "../utils/rng";
import { resetPrd, prdChance, snapshotPrd, restorePrd } from "../utils/prd";
import { shuffleArray, getStatuses, addStatusEffect, BATTLE_ITEMS, isElfActionDisabled, isElfSwitchDisabled, getNoSwitchTurns, isElfItemDisabled, removeStatusEffect, getMaxPp, clampSkillPp } from "../utils/battleHelpers";
import { isPpCostFree, isZeroPpExempt } from '../battle/ppExemptions';

import { addTimer, tickTimers, clearTurnEffects, hasTurnEffect } from "../battle/timers";
import { runTimerPayload } from "../effects/effectRunner";
import { applyActiveGateTimersToDamage } from '../battle/damageGates';
import { Mark, getMark, markAppliesToElf, setMark as setMarkUtil, clearMark as clearMarkUtil } from "../battle/marks";
import { markRecoveryReduction } from '../battle/markRecovery';
import { switchBattleSide } from "../battle/stateScopes";
import { TraitsEngine } from "../utils/traitsEngine";
import { checkStatusDrivenFatalResist } from "../utils/statusFatalResist";
import {settleInstantKill} from '../battle/instantKill';

import { pickAiAction, pickAiForcedSwitch, materializeAiAction } from "../utils/ai";
import { actionKey, type AISettings, type DecisionReport, type DecisionRequest, type AISide } from '../battle/ai/types';
import { legalActions, skillSelectable } from '../battle/ai/legalActions';
import { readAISettings, settingsForSide } from '../battle/ai/settings';
import { calculateDamage } from "../utils/damageCalculator";
import { SUIT_CATALOG } from "../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../data/titles";

import { 
  SharedContextDeps, 
  buildDamageAPIs, 
  buildStatusAPIs, 
  buildStateAPIs,
  attachLiveElfAccessors,
  activatePendingTurns,
} from "../battle/contextBuilders";
import { activateRuneOnSkillSelect } from "../effects/elves/odin/registry";
import {
  isNonTrueDamageType,
  isSkillDamageType,
  normalizeDamageType,
  settleDamageAbsorption,
} from "../battle/damageSemantics";
import { isAliveBySurvivalRule, resolveDamageTransition, resolveHpAdjustment } from "../battle/survivalRules";
import { DEATH_NODE_ID, type BattleNodeId } from "./nodes";
import { battleRules, collectActionFlags, type BattleRuleApi } from "./battleRules";
import "../effects/battleRules.index";
import { relicIgnoreDefPercent } from "../effects/relicEffectRegistry";
import { createDamageComp, addDamageIncrease, equipmentDamageFactors, floorDamage } from "../battle/damagePipeline";
import { addDamageReduction } from "../battle/damageReduction";

type Ref<T> = { current: T };
const ref = <T,>(value: T): Ref<T> => ({ current: value });
/**
 * 舊 useCallback 的替身：引擎物件只建立一次，函式本來就穩定。
 * 原本專案沒有安裝 React 型別，useCallback 回傳 any；這裡維持 any，避免抽出時順便改變型別行為。
 */
const stable = (fn: any, _deps?: unknown[]): any => fn;


// 以下 *Turns 鍵由各精靈註冊表／特質引擎自行遞減，通用回合收尾不重複遞減
const MANUALLY_TICKED_TURN_KEYS = new Set<string>(["BelienteRegenTurns", "attackPpMultiplierTurns", "attackSkillInvalidTurns", "burnTurns", "cthyaatDmgHalfTurns", "deathImmuneTurns", "disableOpponentUtilityTurns", "drainHpTurns", "emperorPriorityBoostTurns", "emperorWallTurns", "fangTurns", "fearTurns", "globalSkillInvalidTurns", "guardTurns", "guardianMarkTurns", "halfTurns", "healDamageTurns", "immuneAndReflectTurns", "immuneStatDownTurns", "immuneStatusTurns", "nextTurns", "noHealTurns", "opeiaDrainStatsTurns", "oppHalfUtilitySealedTurns", "oppSealHealTurns", "oppUtilitySealedTurns", "prioTurns", "priorityTurns", "puniAlwaysFirstTurns", "puniCanLingHealTurns", "puniDamageBoostTurns", "puniDoubleDamageTurns", "puniEnergyReflectTurns", "puniMengPriorityTurns", "puniMengStealTurns", "puniQiShiPriorityTurns", "puniShengGuangQiTurns", "puniShengJieMissTurns", "puniShengMingHealTurns", "puniVoidShieldTurns", "puniXuWuTurns", "puniYinSongReflectTurns", "remainingTurns", "skillFearTurns", "soakTurns", "stagnationTurns", "starFangTurns", "starSeaSoakTurns", "starfireBurnTurns", "utilitySkillInvalidTurns", "wallTurns"]);

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

import { checkElfDead } from '../battle/elfAlive';
export { checkElfDead };

export interface BattleEngineOptions {
  /** 隔離推演從決策邊界續跑：不重新套裝備、不重觸發首發登場。 */
  initialState?: BattleState;
  simulation?: boolean;
  randomSeed?: number;
  initialPrdCounters?: [string, number][];
  runtimeSnapshot?: { deathHandled: string[]; pendingFinalize: boolean };
  /** 外部決策服務。主引擎不引用Worker、不包含精靈AI特例。 */
  selectAi?: (request: DecisionRequest) => Promise<DecisionReport>;
  aiSettings?: () => AISettings;
  onAIDecision?: (report: DecisionReport) => void;
  onSimulationError?: (error: unknown) => void;
  potionRemaining?: () => number | undefined;
  /** 回傳 promise 代表目前不可出手（AI／托管需等它完成）；回傳 null 代表放行。 */
  actionGate?: () => Promise<void> | null;
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
  onBattleEnd?: (winner: "p1" | "p2" | "exit" | "draw", team?: Elf[]) => void;
  preparedTeams?: boolean;
  specialMode?: "destiny" | "interstellar";
  battleFormat?: "normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3";
  interstellarOptions?: {onPotionUse?:()=>boolean;onBattleEnd?:Function;relics?:string[];enemyRelics?:string[];maxPotionUsage?:number};
  /** 狀態整批提交（每個 microtask 最多一次）。畫面在此更新。 */
  onStateCommit?: (state: BattleState) => void;
  /** 播放層（血條、彈出數字）有變化。 */
  onPresentationChange?: () => void;
  /** 省動畫模式；未提供時讀 window.__BATTLE_FAST__。headless 測試傳 () => true。 */
  isFast?: () => boolean;
  animationSettings?: () => BattleAnimationSettings;
  /** 星際探索：藥劑次數已扣（畫面顯示用）。 */
  onPotionUsed?: () => void;
  /** 節點追蹤（測試／除錯）：依實際執行順序呼叫。 */
  onNode?: (node: BattleNodeId, detail?: Record<string, unknown>) => void;
}

export interface BattleEngine {
  getState: () => BattleState;
  dispatch: (action: BattleAction) => void;
  pushEffect: (effect: EffectItem) => void;
  presentation: BattlePresentation;
  /** 傷害帳本：結算畫面讀取（模擬推演引擎不記帳）。 */
  ledger: DamageLedger;
  onSkillSelect: (side: "p1" | "p2", skill: Skill) => void;
  onSwitchElf: (side: "p1" | "p2", index: number) => void;
  onUseItem: (side: "p1" | "p2", item: BattleItem) => void;
  /** 開戰：首發登場（1.1 戰鬥開始／1.3 登場）。重複呼叫無效。 */
  start: () => void;
  /** React 掛載／卸載（StrictMode 會在同一 tick 內卸載再掛載）。 */
  mount: () => void;
  unmount: () => void;
  isAlive: () => boolean;
  /** 等目前排程中的結算、佇列與自我校正都跑完（headless 測試用）。 */
  idle: () => Promise<void>;
}
export function createBattleEngine(props: BattleEngineOptions): BattleEngine {
  
  // 防卡頓：URL ?fast=1 自動開啟省動畫模式（executeEffect 讀 window.__BATTLE_FAST__）。
  // 手機／低階機用 ?fast=1 進場，動畫 delay 全歸零，只留 log。
  if (!props.simulation && typeof window !== 'undefined' && !(window as any)._battleFastInit) {
    (window as any)._battleFastInit = true;
    try {
      if (new URLSearchParams(window.location.search).get('fast') === '1') (window as any).__BATTLE_FAST__ = true;
    } catch { /* 非瀏覽器環境略過 */ }
  }

  const seed = props.randomSeed ?? ((typeof globalThis !== 'undefined' && (globalThis as any).__BATTLE_SEED__) || Date.now());
  const rngRef = ref(makeRng(seed));
  const actionSerialRef = ref(0);
  const resolutionSkillRef=ref<{side:'p1'|'p2';actionId:number;read:()=>Skill}|null>(null);
  const rng = stable(() => rngRef.current(), []);
  // AI的候選與隨機風格不得消耗真正戰鬥的亂數串。
  const aiRng = makeRng(seed ^ 0x51a7e);
  const prdInitRef = ref(false);
  if (!prdInitRef.current) {
    prdInitRef.current = true;
    if (props.initialPrdCounters) restorePrd(props.initialPrdCounters, rng);
    else resetPrd(rng);
  }

  const battleAliveRef = ref(true);
  const battleTimeoutsRef = ref(new Set<ReturnType<typeof setTimeout>>());
  const scheduleBattleTask = stable((callback: () => void, delay = 0) => {
    if (!battleAliveRef.current) return undefined;
    const timer = setTimeout(() => {
      battleTimeoutsRef.current.delete(timer);
      if (battleAliveRef.current) callback();
    }, delay);
    battleTimeoutsRef.current.add(timer);
    return timer;
  }, []);

  const { initialP1Team, initialP2Team, p1StarterId, p2StarterId, p1Suit, p2Suit, p1Title, p2Title, battleMode } = props;
  const state: BattleState = (() => {
    if (props.initialState) return syncActiveIntoTeam(structuredClone(props.initialState));
    // 一般開局須帶齊配裝；preparedTeams 已完成能力結算，不得重加。對手套裝減益由事件處理。
    const p1Team = props.preparedTeams ? structuredClone(initialP1Team) : applyEquipmentToTeam(initialP1Team, p1Suit, props.p1Eyewear, undefined, p1Title).map(e => resetElfStateForBattle(e, (e.battleId || e.id) === p1StarterId, p1Suit));
    const p2Team = props.preparedTeams ? structuredClone(initialP2Team) : applyEquipmentToTeam(initialP2Team, p2Suit, props.p2Eyewear, undefined, p2Title).map(e => resetElfStateForBattle(e, (e.battleId || e.id) === p2StarterId, p2Suit));
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
      p1ItemInventory: props.specialMode === 'interstellar' ? undefined : createBattleItemInventory(),
      p2ItemInventory: props.specialMode === 'interstellar' ? undefined : createBattleItemInventory(),
      p1Marks: [], p2Marks: [],
      activeSkillAnim: null, floatingDamagePopups: [], isTyrDuelField: false,
      isAutoBattle: false, lastDamage: 0, p1LastDamage: 0, p2LastDamage: 0,
      p1TurnStats: { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null },
      p2TurnStats: { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null },
      consoleShake: { p1: false, p2: false },
      damageDealt: {}
    } as BattleState;
  })();

  const ledger = createDamageLedger();
  /** 技能效果結算窗口（節點 3.4）：此期間推入的附加傷害歸屬該技能。 */
  const skillWindowRef = ref<{ side: 'p1' | 'p2'; skillName: string } | null>(null);
  const ledgerDamage = (data: any, targetSide: 'p1' | 'p2', target: any, receipt: any, damageType: string) => {
    if (props.simulation) return;
    const cur = syncStateRef.current;
    recordDamage(ledger, { turn: cur.turnNumber, targetSide, targetBattleId: target.battleId || target.id, targetName: target.name,
      active: { p1: { battleId: cur.p1.battleId || cur.p1.id, name: cur.p1.name }, p2: { battleId: cur.p2.battleId || cur.p2.id, name: cur.p2.name } },
      receipt, data, damageType });
  };
  const presentationRef = ref<BattlePresentation | null>(null);
  const deathHandledRef = ref(new Set<string>(props.runtimeSnapshot?.deathHandled));
  const animationSettings = () => props.animationSettings?.() ?? readAnimationSettings();
  if (!presentationRef.current) presentationRef.current = new BattlePresentation(
    () => { if (battleAliveRef.current) props.onPresentationChange?.(); },
    props.isFast ?? (() => typeof window !== 'undefined' && !!(window as any).__BATTLE_FAST__),
    animationSettings
  );
  const presentation = presentationRef.current;
  /** 單筆額外行動結束：一筆一次演出；單筆run內的多段邏輯仍合併為這次演出。 */
  async function finishExtraPresentation(owner: "p1" | "p2", resolved: number) {
    if (resolved > 0 && battleAliveRef.current) {
      pushEffect({ type: 'animation', side: owner, data: { anim: { side: owner, category: 'extra', skillName: '額外行動', targetSide: owner === "p1" ? "p2" : "p1" }, duration: 400 } });
      await processQueue();
    }
    void presentation.endExtra();
  }

  // ── 單一真實來源 ─────────────────────────────────────────────
  // 過去戰鬥邏輯寫 syncStateRef、畫面讀 reducer state，兩邊靠手動同步；
  // 只寫其中一邊的效果（回血、扣血、PP…）會在下回合開始時被另一邊覆蓋掉。
  // 現在：syncStateRef 是唯一真實狀態，dispatch 直接套用 reducer 到它；
  // 任何寫入都在同一個 microtask 結束時整批提交給 React 做畫面更新（多次寫入只重繪一次）。
  const syncBoxRef = ref<Ref<BattleState> | null>(null);
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
            commitState(value);
            scheduleBattleTask(() => validateIdleRef.current(), 0);
          });
        }
      }
    } as Ref<BattleState>;
  }
  // 原本 React 型別未安裝，ref 內容為 any；抽出時維持相同的寬鬆型別（之後可逐步收緊）。
  const syncStateRef: Ref<any> = syncBoxRef.current;
  const dispatch = stable((action: BattleAction) => {
    if (!battleAliveRef.current) return;
    const prevPhase = syncStateRef.current.phase;
    syncStateRef.current = battleReducer(syncStateRef.current, action);
    // 進入結算階段時直接排程結算（不依賴 render 後的 effect：若 React 把
    // p1_select→resolving 合併成一次 render，phase 看起來沒變，effect 不會再觸發而卡住）
    if (action.type === 'SET_PHASE' && action.phase === 'resolving' && prevPhase !== 'resolving') {
      scheduleBattleTask(() => startResolveRef.current(), 0);
    }
  }, []) as (action: any) => void;
  const startResolveRef = ref<() => void>(() => {});
  const pendingFinalizeRef = ref(props.runtimeSnapshot?.pendingFinalize ?? false);
  const completeForcedSwitchRef = ref<() => void>(() => {});
  const validateIdleRef = ref<() => void>(() => {});
  // 保留名稱相容：latestStateRef 一律指向唯一真實狀態
  const latestStateRef = syncStateRef;


  const effectQueueRef = ref<EffectItem[]>([]);
  const effectChainRef = ref<number | undefined>(undefined);
  const effectChainSequenceRef = ref(0);
  const damageChainFinalizersRef = ref<{ chainId?: number; side: 'p1' | 'p2'; ownerId: string; run: (ctx: BattleEventContext) => void }[]>([]);
  const isProcessingQueue = ref(false);
  const processingPromiseRef = ref<Promise<void> | null>(null);
  const executingEffectRef = ref(false);
  const presentationPotionRef = ref(false);
  const isResolvingRef = ref(false);
  const hasInitialEntranceRef = ref(!!props.initialState);
  let pendingAi = 0;
  let forcedAiPending = false;

  async function chooseAI(side: AISide, forced = false) {
    // 外部行動閘門（例如入戰動畫播放中）：AI 等閘門放開才讀取局面並出手。
    const gate = props.actionGate?.();
    if (gate) { await gate; if (!battleAliveRef.current) return null; }
    const cur: BattleState = syncStateRef.current;
    const turn = cur.turnNumber, actorId = cur[side].battleId || cur[side].id;
    pendingAi++;
    try {
      if (props.selectAi && !props.simulation) {
        const settings = props.aiSettings?.() ?? readAISettings();
        const report = await props.selectAi({ state: cur, side, forced,
          settings: settingsForSide(settings,side), opponentSettings: settingsForSide(settings,side==='p1'?'p2':'p1'), seed: Math.floor(aiRng() * 0xffffffff),
          p1Suit, p2Suit, p1Title, p2Title, specialMode: props.specialMode, battleFormat: props.battleFormat,
          potionRemaining: props.potionRemaining?.(), prdCounters: snapshotPrd(), prngCounters: snapshotPRNG(),
          runtime: { deathHandled: [...deathHandledRef.current], pendingFinalize: pendingFinalizeRef.current } });
        const latest = syncStateRef.current;
        if (!battleAliveRef.current || latest.winner || latest.turnNumber !== turn || (latest[side].battleId || latest[side].id) !== actorId) return null;
        const legal = legalActions(latest, side, forced, props.potionRemaining?.());
        if (legal.some(a => actionKey(a) === actionKey(report.action))) {
          props.onAIDecision?.(report);
          return materializeAiAction(latest, side, report.action);
        }
      }
    } catch (error) { console.warn('[AI] 推演服務失敗，使用本地安全回退。', error); }
    finally { pendingAi--; }
    if (!battleAliveRef.current || syncStateRef.current.winner || syncStateRef.current.turnNumber !== turn || (syncStateRef.current[side].battleId || syncStateRef.current[side].id) !== actorId) return null;
    const latest = syncStateRef.current;
    return forced ? materializeAiAction(latest, side, { kind: 'switch', index: pickAiForcedSwitch(latest, side, p1Suit, p2Suit, aiRng) })
      : pickAiAction(latest, side, p1Suit, p2Suit, aiRng);
  }

  async function chooseP2AndResolve() {
    // 鎖定輸入，避免等待背景推演時同一回合被連續點擊重新選招。
    dispatch({ type: 'SET_PHASE', phase: 'p2_select' });
    const action = await chooseAI('p2');
    if (!action || !battleAliveRef.current || syncStateRef.current.phase !== 'p2_select' || syncStateRef.current.winner) return;
    if (action.type === 'skill' && action.skill) onSkillSelect('p2', action.skill);
    else if (action.type === 'switch') onSwitchElf('p2', action.switchIndex!);
    else if (action.type === 'item' && action.item) onUseItem('p2', action.item);
  }

  function requestForcedAI(side: AISide) {
    if (forcedAiPending || props.simulation) return;
    forcedAiPending = true;
    void chooseAI(side, true).then(action => {
      if (battleAliveRef.current && syncStateRef.current.phase.startsWith('forced_switch') && checkElfDead(syncStateRef.current[side]) && action?.type === 'switch' && action.switchIndex! >= 0) onSwitchElf(side, action.switchIndex!);
    }).finally(() => { forcedAiPending = false; scheduleBattleTask(() => validateIdleRef.current(), 0); });
  }

  const mount = () => { battleAliveRef.current = true; };
  const unmount = () => {
    battleAliveRef.current = false;
    // StrictMode 會同步重新啟用同一實例；只清理真正卸載的局。
    queueMicrotask(() => {
      if (battleAliveRef.current) return;
      battleTimeoutsRef.current.forEach(clearTimeout);
      battleTimeoutsRef.current.clear();
      effectQueueRef.current.length = 0;
      damageChainFinalizersRef.current.length = 0;
      presentation.dispose();
    });
  };

  // 本次出手「主技能傷害」實際造成的 HP 減少（AFTER_ACTION.damageDealt／ON_SKILL_HIT 用）
  const mainHitRef = ref<{ hpReduced: number; settledAmount?: number } | null>(null);
  const damageOriginRef = ref<Record<string, {side:"p1"|"p2";id:string}>>({});
  const executeEffect = stable(async (effect: EffectItem) => {
    if (!battleAliveRef.current) return;
    const { type } = effect;
    // 結算與播放分離：這裡只改戰鬥狀態並把演出排進 presentation 時間軸，從不等待動畫。
    const { side, data } = effect;
    if (data && 'amount' in data && !Number.isFinite(data.amount)) {
      console.error(`[executeEffect] ${type} 數值異常（${data.amount}），已改為 0`, data.label || "");
      data.amount = 0;
    }
    const cur = syncStateRef.current;
    
    switch (type) {
      case 'damage': {
        const targetSide = side;
        if (data.targetId && data.targetId !== (cur[side].battleId || cur[side].id)) {
          const target = cur[`${side}Team`].find(e => (e.battleId || e.id) === data.targetId);
          if (!target || checkElfDead(target)) break;
          const hpBeforeHit = target.currentHp; // 免死 handler 可能就地改 target，帳本讀快照
          const category = normalizeDamageType(data);
          let amount = data.amount;
          const guard = target.deathImmunity;
          if (guard?.guardTurns > 0 && category.startsWith('skill')) amount = 0;
          if (guard?.guardTurns > 0 && ['fixed', 'percent'].includes(category) && guard.fixedPercentCap) amount = Math.min(amount, guard.fixedPercentCap);
          const resist = target.resistances?.damageResist;
          if (category !== 'true') {
            const comp = { damageCategory: category as any, decreasePercent: 0, multiplier: 1,
              reductionPolicy: data.reductionPolicy ?? reductionPolicy(cur, side, target, category) };
            if (category === 'fixed' && resist?.fixed) multiplyDamageReduction(comp, 1 - resist.fixed / 100);
            if (category === 'percent' && resist?.percent) multiplyDamageReduction(comp, 1 - resist.percent / 100);
            amount = Math.floor(amount * comp.multiplier);
          }
          const absorbed = settleDamageAbsorption(amount, category, target.shield || 0, target.barrier || 0, !!data.ignoreShield);
          const outcome = resolveDamageTransition(target.currentHp, target.maxHp, absorbed.amount, category === 'true' ? 'true' : 'non_true', target.survivalRule);
          const ctx = getBattleEventContext(side, true, 0, target);
// 2026-10-28：根性需要「該段傷害 vs 當前體力」比較；帶入本次實際傷害與是否為傷害來源。
Object.assign(ctx as any, { fatalDamage: absorbed.amount, fatalIsDamage: true });
          const immune = (guard?.deathImmuneTurns || 0) > 0;
          const resisted = !outcome.alive && !immune && (SoulMarkRegistry[target.name]?.(ctx, EffectTiming.FATAL_RESIST, {damageType:category}) || TraitsEngine.triggerFatalResist(ctx) || checkStatusDrivenFatalResist(ctx));
          ctx.updateAnyElf(side, data.targetId, { ...(resisted ? {} : {currentHp:immune ? Math.max(0, outcome.hp) : outcome.hp}), shield:retainShield(target,absorbed.shield), barrier:absorbed.barrier });
          if (outcome.damageApplied > 0 && data.sourceSide && data.sourceBattleId) damageOriginRef.current[data.targetId] = {side:data.sourceSide,id:data.sourceBattleId};
          const receipt = settlementReceipt({ operation: 'damage', targetBattleId: data.targetId, damageType: category,
            requestedAmount: data.requestedAmount ?? data.amount, settledAmount: amount,
            hpBefore: hpBeforeHit, hpAfter: ctx.self.currentHp, shieldAbsorbed: absorbed.shieldAbsorbed,
            barrierAbsorbed: absorbed.barrierAbsorbed, resistedFatal: !!resisted, blocked: amount === 0 });
          notifySettlement(data, receipt);
          ledgerDamage(data, side, target, receipt, category);
          const payload = { ...receipt, receipt, amount, damage: amount, hpReduced: receipt.hpLost, damageType: category,
            rawDamageType: data.damageType, sourceSide: data.sourceSide, sourceBattleId: data.sourceBattleId, isCrit: !!data.isCrit, attackerSide: data.sourceSide,
            side, targetSide: side, isIncoming: true, reaction: data.reaction };
          SoulMarkRegistry[target.name]?.(ctx, EffectTiming.ON_DAMAGED, payload);
          SoulMarkRegistry[target.name]?.(ctx, EffectTiming.AFTER_DAMAGE, payload);
          ctx.addLog(`【${target.name}】受到 ${receipt.hpLost} 點${category === 'true' ? '真實傷害' : category === 'fixed' ? '固定傷害' : category === 'percent' ? '百分比傷害' : '技能傷害'}。`, "effect");
          break;
        }
        const target = cur[targetSide];
        // 受擊前體力：魂印／免死 handler 可能就地修改 target.currentHp，播放與帳本一律讀這個快照。
        const hpBefore = target.currentHp;

        if (checkElfDead(target)) {
          // 已被前置效果擊敗：體力不落地；主技能傷害以紅字顯示實際計算值（含暴擊／克制標示），沒有算出值就不出跳字（不補 0）。
          if (data.mainSkillHit) void presentation.skippedAttack(targetSide, target, data.sourceSide, data.skillName,
            damagePresentationAmount('skill', Number(data.amount), 0),
            { isCrit: data.isCrit, label: data.label, effectiveness: effectivenessLabel((data as any).typeMultiplier) });
          break;
        }
        
        const guard = target.deathImmunity;
        const inGuardWindow = guard && guard.guardTurns > 0;
        const inDeathImmuneWindow = guard && guard.deathImmuneTurns > 0;

        let effectiveAmount = data.amount;
        const damageDefense = normalizeDamageType(data) === 'skill_attack' && data.sourceSide !== targetSide
          ? data.attackDefenseBypass : undefined;
        if (inGuardWindow && !damageDefense?.block) {
          const gdt = normalizeDamageType(data);
          if (gdt === "skill" || gdt === "skill_attack" || !gdt) {
            effectiveAmount = 0;   // 技能傷害全擋
          } else if ((gdt === "fixed" || gdt === "percent") && guard.fixedPercentCap) {
            effectiveAmount = Math.min(effectiveAmount, guard.fixedPercentCap);   // 固定/百分比封頂
          }
        }

        // Apply damage resistance (independent multiplicative multiplier)
        const resist = target.resistances?.damageResist;
        const resistComp = { damageCategory: normalizeDamageType(data) as any, multiplier: 1, decreasePercent: 0,
          pure: !!data.pure, reductionPolicy: data.reductionPolicy ?? reductionPolicy(cur, targetSide, target, normalizeDamageType(data)) };
        if (resist) {
          // 致命抗性只在攻擊公式（暴擊倍率 2×(1−致命抗性)）套用一次，落地不再重複。
          if (data.damageType === "fixed" && resist.fixed) {
            multiplyDamageReduction(resistComp, 1 - resist.fixed / 100);
          }
          if (data.damageType === "percent" && resist.percent) {
            multiplyDamageReduction(resistComp, 1 - resist.percent / 100);
          }
        }
        const resistMultiplier = resistComp.multiplier;
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
            if (takenMult != null && takenMult !== 1 && mark.count > 0 && matchesDamageTypes(mark.effects?.damageTakenTypes, normalizedDamageType)) {
              const reductionComp = { damageCategory: normalizedDamageType as any, decreasePercent: 0, multiplier: 1,
                reductionPolicy: data.reductionPolicy ?? reductionPolicy(cur, targetSide, target, normalizedDamageType) };
              if (takenMult < 1) multiplyDamageReduction(reductionComp, takenMult);
              else reductionComp.multiplier *= takenMult;
              effectiveAmount = Math.floor(effectiveAmount * reductionComp.multiplier);
            }
          }
          // 攻擊方：造成非真實傷害倍率
          const resolvedSourceSide = targetSide === "p1" ? "p2" : "p1";
          if (resolvedSourceSide) {
            const sourceMarksAll = resolvedSourceSide === "p1" ? cur.p1Marks : cur.p2Marks;
            const sourceElf = resolvedSourceSide === "p1" ? cur.p1 : cur.p2;
            for (const mark of (sourceMarksAll || []).filter(mark => markAppliesToElf(mark, sourceElf))) {
              const dealtMult = mark.effects?.nonTrueDamageDealtMultiplier;
              if (dealtMult != null && dealtMult !== 1 && mark.count > 0) {
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
        const nextShieldVal = retainShield(target,absorption.shield);
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
          if (normalizedDamageType === "true") { lastActionType = "true"; lastActionLabel = data.label || "真實傷害"; }
          else if (normalizedDamageType === "fixed") { lastActionType = "fixed"; lastActionLabel = data.label || "固定傷害"; }
          else if (normalizedDamageType === "percent") { lastActionType = "percent"; lastActionLabel = data.label || "百分比傷害"; }
          else if (data.isCrit) { lastActionType = "crit"; lastActionLabel = data.label || "致命一擊"; }
          else { lastActionType = "skill"; lastActionLabel = data.label || "技能傷害"; }
        }

        const survivalTransition = resolveDamageTransition(
          hpBefore,
          target.maxHp,
          effectiveAmount,
          normalizedDamageType === "true" ? "true" : "non_true",
          target.survivalRule,
          { ignoreNonTrueImmunity: !!damageDefense?.block },
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
// 2026-10-28：同上，帶入實際傷害數值供根性判定。
Object.assign(fCtx as any, { fatalDamage: effectiveAmount, fatalIsDamage: true });
          if (SoulMarkRegistry[target.name]) {
            resisted = !!SoulMarkRegistry[target.name](fCtx, EffectTiming.FATAL_RESIST, { damageType: data.damageType });
          }
          if (!resisted) resisted = TraitsEngine.triggerFatalResist(fCtx);
          if (!resisted) resisted = traitFatalResist(fCtx, targetSide, target, rng);
          if (!resisted) resisted = checkStatusDrivenFatalResist(fCtx);
        }

        if (resisted) {
            // handler 內部可能已經修改了 self.currentHp
            const resistedElf = { ...syncStateRef.current[targetSide], shield: nextShieldVal, barrier: nextBarrierVal };
            const teamKey = targetSide === 'p1' ? 'p1Team' : 'p2Team';
            const activeIdx = targetSide === 'p1' ? syncStateRef.current.p1ActiveIndex : syncStateRef.current.p2ActiveIndex;
            const nextTeam = [...syncStateRef.current[teamKey]];
            nextTeam[activeIdx] = resistedElf;

            syncStateRef.current = {
              ...syncStateRef.current,
              [targetSide]: resistedElf,
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
            const hpDiff = resistedElf.currentHp - hpBefore;
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
                dispatch({ type: 'ADD_LOG', log: { turn: syncStateRef.current.turnNumber, text: `🍃 【${titleDef.name}】：受到攻擊，速度等級上升！`, type: "effect" } });
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

            // 2026-10-29：易燃 transformOnFire（原本參數只寫在 statusRegistry，引擎完全沒讀取端）。
            // 受到火系攻擊技能命中時，把「易燃」轉化為指定狀態（預設燒傷）。
            const fireHitElem = (data as any)?.type || (data as any)?.elem || (data as any)?.skillType || (data as any)?.skill?.type;
            if (dmg > 0 && typeof fireHitElem === 'string' && fireHitElem.includes('火')) {
              const fireElf = syncStateRef.current[targetSide];
              const fireEffects = [...(fireElf.effects || [])];
              let fireTransformed = false;
              for (let i = 0; i < fireEffects.length; i++) {
                const fe = fireEffects[i];
                const fEntry = StatusRegistry[fe.id];
                const fParams = fEntry?.mechanics?.find(m => m.type === 'SPECIAL_BUFF')?.params;
                const nextName = fParams?.transformOnFire;
                if (!nextName) continue;
                const nEntry = StatusRegistry[nextName];
                fireEffects[i] = { id: nextName, name: nEntry?.name || nextName, duration: 3, isLateMover: false, stacks: 1 } as any;
                fireTransformed = true;
                dispatch({ type: 'ADD_LOG', side: targetSide, log: { turn: cur.turnNumber, text: `🔥 受到火系攻擊！【${fEntry?.name || fe.id}】轉化為【${nextName}】！`, type: "effect" } });
              }
              if (fireTransformed) {
                const mergedFire = mergeSameStatus(fireEffects);
                syncStateRef.current = { ...syncStateRef.current, [targetSide]: { ...fireElf, effects: mergedFire } };
                dispatch({ type: 'UPDATE_ELF', side: targetSide, elf: { effects: mergedFire } });
              }
            }


            const statsUpdates: Partial<TurnDamageStats> = {
              hpChange: (currentStats.hpChange || 0) + (nextHp - hpBefore),
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
        const receipt = settlementReceipt({ operation: 'damage', targetBattleId: target.battleId || target.id,
          damageType: normalizedDamageType, requestedAmount: data.requestedAmount ?? data.amount,
          settledAmount: absorption.amount + absorption.shieldAbsorbed + absorption.barrierAbsorbed,
          hpBefore, hpAfter: syncStateRef.current[targetSide].currentHp,
          shieldAbsorbed: absorption.shieldAbsorbed, barrierAbsorbed: absorption.barrierAbsorbed, resistedFatal: resisted });
        const cappedState = recordDamageHpCeilings(syncStateRef.current, targetSide, target, receipt.hpBefore);
        if (cappedState !== syncStateRef.current) {
          syncStateRef.current = cappedState;
          dispatch({ type: 'SET_TIMERS', side: targetSide, timers: cappedState[`${targetSide}Timers`] });
        }
        notifySettlement(data, receipt);
        ledgerDamage(data, targetSide, target, receipt, normalizedDamageType);
        reactToTimedAttack(getBattleEventContext(targetSide === 'p1' ? 'p2' : 'p1', true, 0), normalizedDamageType);
        const damagedCtx = getBattleEventContext(targetSide, true, 0);
        // 同時提供 amount / damage / targetSide（部分魂印讀 extraData.damage 與 targetSide，過去缺值導致 NaN 與判定顛倒）
        const damagedPayload = {
          damageType: normalizeDamageType(data), rawDamageType: data.damageType,
          amount: dmg, damage: dmg, hpReduced: receipt.hpLost, receipt, label: data.label,
          sourceElfName: data.sourceElfName, targetSide, typedSkill: !!(data as any).typedSkill,
          reaction: data.reaction, skillPower: data.skillPower, isCrit: !!data.isCrit,
          sourceSide: data.sourceSide, sourceBattleId: data.sourceBattleId,
          hpAdjustment: survivalTransition.hpAdjustment,
          ignoredDamage: survivalTransition.ignoredDamage,
          enteredNonPositive: survivalTransition.enteredNonPositive,
        };
        const presentationAfterHp = syncStateRef.current[targetSide].currentHp;
        if (presentationAfterHp !== hpBefore || data.popup) {
          // 這一擊本身的跳字永遠保留傷害類型與算出的數值。受擊後體力反而上升（免死／回復類 handler）時，
          // 上升量另記一筆體力調整，不得把紅／粉／白字換成綠色體力調整。
          const rose = presentationAfterHp > hpBefore;
          const kind = (lastActionType === 'crit' ? 'skill' : lastActionType) as PresentationKind;
          presentation.record({ side: targetSide, elfId: target.battleId || target.id, type: kind,
            amount: !rose && (lastActionType === 'fixed' || lastActionType === 'percent') ? hpBefore - presentationAfterHp : displayedDamage,
            delta: rose ? 0 : presentationAfterHp - hpBefore,
            before: hpBefore, after: rose ? hpBefore : presentationAfterHp, maxHp: target.maxHp,
            label: lastActionLabel, isCrit: data.isCrit, alive: rose || !checkElfDead(syncStateRef.current[targetSide]),
            effectiveness: effectivenessLabel((data as any).typeMultiplier),
            sourceSide: (data as any).sourceSide, skillName: (data as any).skillName });
          if (rose) presentation.record({ side: targetSide, elfId: target.battleId || target.id, type: 'adjust_up',
            amount: presentationAfterHp - hpBefore, delta: presentationAfterHp - hpBefore,
            before: hpBefore, after: presentationAfterHp, maxHp: target.maxHp, label: '體力調整', alive: true });
        }
        if (SoulMarkRegistry[target.name]) {
          SoulMarkRegistry[target.name](damagedCtx, EffectTiming.ON_DAMAGED, damagedPayload);
        }
        if ((data as any).mainSkillHit && mainHitRef.current) {
          mainHitRef.current.hpReduced += damagedPayload.hpReduced;
          mainHitRef.current.settledAmount = damagedPayload.receipt.settledAmount;
        }
        // AFTER_DAMAGE：受擊方（isIncoming）與造成方（!isIncoming）各一次；side／targetSide＝受擊方
        {
          const atkSide = targetSide === "p1" ? "p2" : "p1";
          const atkElf = syncStateRef.current[atkSide];
          const fromAttacker = !!atkElf && !!data.sourceElfName && data.sourceElfName === atkElf.name;
          const base = { ...damagedPayload, side: targetSide, attackerSide: fromAttacker ? atkSide : undefined, sourceSide: (data as any).sourceSide ?? (fromAttacker ? atkSide : undefined) };
          try {
            const tNow = syncStateRef.current[targetSide];
            if (tNow && SoulMarkRegistry[tNow.name]) SoulMarkRegistry[tNow.name](getBattleEventContext(targetSide, true, 0), EffectTiming.AFTER_DAMAGE, { ...base, isIncoming: true });
            if (fromAttacker && SoulMarkRegistry[atkElf.name]) SoulMarkRegistry[atkElf.name](getBattleEventContext(atkSide, true, 0), EffectTiming.AFTER_DAMAGE, { ...base, isIncoming: false });
            runBossTraitEffects(syncStateRef.current[targetSide], () => getBattleEventContext(targetSide, true, 0), EffectTiming.AFTER_DAMAGE, { ...base, isIncoming: true });
            if (fromAttacker) runBossTraitEffects(syncStateRef.current[atkSide], () => getBattleEventContext(atkSide, true, 0), EffectTiming.AFTER_DAMAGE, { ...base, isIncoming: false });
          } catch (e) { console.error("[AFTER_DAMAGE]", e); }
        }
        // 「對手受擊時…」類魂印（星火之灼／星芳之纏／星海之浸）需要在「對手」受到技能攻擊時被通知
        if (dmg > 0 && isSkillDamageType(normalizedDamageType)) {
          const observerSide = targetSide === "p1" ? "p2" : "p1";
          const observer = syncStateRef.current[observerSide];
          if (observer && observesOpponentDamage(observer.name,observer)) {
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

        if (normalizedDamageType === "true") {
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

        // 彈出數字由 presentation.record 播放（上方），不再寫入戰鬥狀態。
        break;
      }
      case 'instant_kill': {
        const target=cur[`${side}Team`].find(e=>(e.battleId||e.id)===data.targetId);
        if(!target)break;
        const receipt=settleInstantKill(getBattleEventContext(side,true,0,target),data);
        if(receipt.hpLost>0){
          damageOriginRef.current[data.targetId]={side:data.sourceSide,id:data.sourceBattleId};
          if(!props.simulation)recordAdjust(ledger,side,-receipt.hpLost);
          presentation.record({side,elfId:data.targetId,type:'adjust_down',amount:receipt.hpLost,delta:-receipt.hpLost,
            before:receipt.hpBefore,after:receipt.hpAfter,maxHp:target.maxHp,label:data.label});
        }
        dispatch({type:'ADD_LOG',log:{turn:cur.turnNumber,text:`💀 【${data.label}】：【${target.name}】${receipt.killed?'被秒殺':receipt.resistedFatal?'抵抗了致命修正':'保留特殊存活規則'}！`,type:'effect'}});
        break;
      }
      case 'adjust_hp': {
        const targetSide = side;
        const teamKey = `${targetSide}Team` as 'p1Team'|'p2Team';
        const activeIdx = cur[`${targetSide}ActiveIndex`];
        const targetIdx=data.targetId?cur[teamKey].findIndex(e=>(e.battleId||e.id)===data.targetId):activeIdx;
        if(targetIdx<0)break;
        const target = cur[teamKey][targetIdx],isActiveAdjustment=targetIdx===activeIdx;
        const adjustment = resolveHpAdjustment(target.currentHp, data.amount, target.survivalRule);
        let adjustedHp = adjustment.hp;
        // 「體力無法恢復/增加超過原始體力上限」（六刃等）：增加體力同樣受恢復上限限制，但不會因此扣血
        const adjustCap = Number(readScopedRegistry(cur, targetSide, target, 'recoveryMaxHpCap')) || 0;
        if (adjustCap > 0 && adjustedHp > target.currentHp) adjustedHp = Math.max(target.currentHp, Math.min(adjustedHp, adjustCap));
        const nextHp = capCurrentHp(cur, targetSide, target, adjustedHp);
        const val = nextHp - target.currentHp;
        if (val < 0) delete damageOriginRef.current[target.battleId || target.id];

        const nextElf = { ...target, currentHp: nextHp };
        const nextTeam = [...syncStateRef.current[teamKey]];
        nextTeam[targetIdx] = nextElf;

        syncStateRef.current = {
          ...syncStateRef.current,
          ...(isActiveAdjustment?{[targetSide]:nextElf}:{}),
          [teamKey]: nextTeam
        };

        dispatch({ type: 'UPDATE_ELF', side, targetId:data.targetId,elf: { currentHp: nextHp } });
        if (!props.simulation) recordAdjust(ledger, targetSide, val);

        // Update turn stats
        const currentStats = targetSide === 'p1' ? syncStateRef.current.p1TurnStats : syncStateRef.current.p2TurnStats;
        // 實際沒有改變體力的調整（例如對已倒下目標）不得覆寫「最近一次」傷害類型，否則技能紅傷會被洗成 0 的體力調整。
        const statsUpdates: Partial<TurnDamageStats> = val === 0 ? { hpChange: currentStats.hpChange || 0 } : {
          hpChange: (currentStats.hpChange || 0) + val,
          lastType: val > 0 ? 'adjust_up' : 'adjust_down',
          lastAmount: Math.abs(val)
        };
        if(isActiveAdjustment)dispatch({ type: 'UPDATE_TURN_STATS', side: targetSide, stats: statsUpdates });
        if (val !== 0) dispatch({
          type: 'SET_LAST_ACTION_INFO',
          info: {
            side: targetSide,
            targetElfName: target.name,
            amount: Math.abs(val),
            type: val > 0 ? 'adjust_up' : 'adjust_down',
            label: '體力調整'
          }
        });
        const statsKey = targetSide === 'p1' ? 'p1TurnStats' : 'p2TurnStats';
        if(isActiveAdjustment)syncStateRef.current = {
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
        const recoveryTimers=scopedTimers(syncStateRef.current,targetSide,target);
        const recoveryRegistry = new Proxy({}, {get:(_,key)=>readScopedRegistry(syncStateRef.current,targetSide,target,String(key))}) as any;
        const playerStateKey = `${targetSide}RegistryState` as "p1RegistryState" | "p2RegistryState";
        const oppSide = targetSide === "p1" ? "p2" : "p1";
        const oppStateKey = `${oppSide}RegistryState` as "p1RegistryState" | "p2RegistryState";
        // 僅禁止持有者自己的技能回復；不從選招或日誌猜測來源，藥劑／魂印仍可回復。
        const skillHealBlocked = blocksOwnSkillRecovery(data.recoveryOrigin,targetSide,target.battleId||target.id,recoveryRegistry.skillHealBlockTurns||0,data.isPotion);
        const noHealTurns = recoveryRegistry?.noHealTurns ||
                            recoveryRegistry?.[`${targetSide}_noHealTurns`] ||
                            syncStateRef.current[`${oppSide}RegistryState`]?.[`${targetSide}_noHealTurns`] || (skillHealBlocked || blocksTimedRecovery(recoveryTimers,targetSide,target.battleId||target.id,data.recoveryOrigin,data.isPotion) ? 1 : 0);
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
          notifySettlement(data, settlementReceipt({ operation: 'heal', targetBattleId: target.battleId || target.id,
            requestedAmount: data.amount, settledAmount: 0, hpBefore: target.currentHp, hpAfter: target.currentHp, blocked: true }));
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
        multiplier = Math.max(0, multiplier - markRecoveryReduction(
          (targetSide === "p1" ? syncStateRef.current.p1Marks : syncStateRef.current.p2Marks) || [], target, !!data.isPotion));
        const healRed = recoveryRegistry?.healReduction || 0;
        if (healRed > 0 && !data.isPotion) {
          multiplier = Math.max(0, multiplier - healRed);
        }
        multiplier *= timedRecoveryMultiplier(recoveryTimers, target, !!data.isPotion);

        let maxAllowedHp = target.maxHp;
        // 通用：恢復上限（個體鍵，由魂印設定，例如體力上限被提高但恢復不得超過原上限）
        const recoveryCap = Number(recoveryRegistry?.recoveryMaxHpCap) || 0;
        if (recoveryCap > 0) maxAllowedHp = Math.min(maxAllowedHp, recoveryCap);

        const recovery = resolveRecoveryEffect(target.currentHp, maxAllowedHp, Math.max(data.amount * multiplier, Math.max(0,Number(data.minimum)||0)), 1, false, target.survivalRule);
        const nextHp = capCurrentHp(syncStateRef.current, targetSide, target, recovery.hp);
        const val = nextHp - target.currentHp;

        if (recovery.ignoredRecovery) {
          pushEffect({ type: 'log', side: targetSide, data: { text: `⚡ 原恢復量失效，改為依存活規則增加體力（+${val}）！`, type: "effect" } });
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
        if (!props.simulation) recordHeal(ledger, { turn: syncStateRef.current.turnNumber, side: targetSide, targetBattleId: target.battleId || target.id, targetName: target.name, amount: Math.max(0, nextHp - target.currentHp) });
        notifySettlement(data, settlementReceipt({ operation: 'heal', targetBattleId: target.battleId || target.id,
          requestedAmount: data.amount, settledAmount: Math.floor(data.amount * multiplier), hpBefore: target.currentHp, hpAfter: nextHp }));

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
        }
        break;
      }
      case 'log':
        dispatch({ type: 'ADD_LOG', log: { turn: cur.turnNumber, text: data.text, type: data.type || 'info', sourceCode: data.sourceCode } });
        break;
      case 'animation':
        // 出招動畫排在前面已發生的演出（例如藥劑綠字）之後，紅字在出招之後；開關關閉時不播放。結算不等待。
        {const preferences=animationSettings();
         const owner=cur[`${side}Team`][cur[`${side}ActiveIndex`]];
         void presentation.animate(data.anim, data.duration || 350, preferences.skill && (data.anim?.category!=='extra'||preferences.extra) && animationModeFor(preferences,owner)!=='static');}
        return;
case 'switch': {
        const fieldShieldTotal=(syncStateRef.current.p1.shield||0)+(syncStateRef.current.p2.shield||0);
        syncStateRef.current = switchBattleSide(syncStateRef.current, side, data.index);
        getBattleEventContext(side).setPlayerState('entryFieldShieldTotal',fieldShieldTotal);
        dispatch({ type: 'SET_ACTIVE_INDEX', side, index: data.index });
        break;
      }
    }
  }, [dispatch]);

  // 通用：在場精靈護盾由 >0 變 0（打破或消除）→ SHIELD_BROKEN（每個效果結算後檢查一次）
  const shieldSeenRef = ref(new Map<string, number>());
  const resourceSeenRef=ref(new Map<string,{shield:number,barrier:number}>());
  const checkShieldTransitions = () => {
    for (const side of ["p1", "p2"] as const) {
      const elf = syncStateRef.current[side];
      if (!elf) continue;
      const id = String(elf.battleId || elf.id), now = Number(elf.shield) || 0, before = shieldSeenRef.current.get(id) ?? 0;
      shieldSeenRef.current.set(id, now);
      const previous=resourceSeenRef.current.get(id),current={shield:Number(elf.shield)||0,barrier:Number(elf.barrier)||0};
      resourceSeenRef.current.set(id,current);
      const delta=previous?current.shield-previous.shield:0;
      if(delta)for(const observerSide of ["p1","p2"] as const){
        if(!checkElfDead(syncStateRef.current[observerSide]))dispatchShieldChange(getBattleEventContext(observerSide,true,0),side,delta);
      }
      const resources=previous?(['shield','barrier'] as const).filter(k=>previous[k]>0&&current[k]<=0):[];
      if(resources.length&&!checkElfDead(elf)){
        const resourceCtx=getBattleEventContext(side,true,0);
        SoulMarkRegistry[elf.name]?.(resourceCtx,EffectTiming.HELD_RESOURCE_LOST,{resources,before:previous});
        dispatchModeEvent(resourceCtx,EffectTiming.HELD_RESOURCE_LOST,{resources,before:previous});
      }
      if (before > 0 && now <= 0 && !checkElfDead(elf)) {
        try {
          const sCtx = getBattleEventContext(side, true, 0);
          SoulMarkRegistry[elf.name]?.(sCtx, EffectTiming.SHIELD_BROKEN, { before }); // 魂印／積木側邊計時器（runBlockEvent）
          dispatchModeEvent(sCtx, EffectTiming.SHIELD_BROKEN, { before });
        } catch (e) { console.error("[shield_broken]", e); }
      }
    }
  };
  const processQueue = stable((): Promise<void> => {
    if (!battleAliveRef.current) return Promise.resolve();
    // 在效果執行「內部」再次等待佇列會等到自己 → 永久卡在結算中；此時直接返回（新效果仍會被外層迴圈處理）
    if (executingEffectRef.current) {
      return Promise.resolve();
    }
    if (processingPromiseRef.current) {
      return processingPromiseRef.current;
    }
    const run = (async () => {
      while (battleAliveRef.current && (effectQueueRef.current.length > 0 || damageChainFinalizersRef.current.length > 0)) {
        const ready = damageChainFinalizersRef.current.filter(f => !effectQueueRef.current.some(e => e.chainId === f.chainId));
        if (ready.length) {
          damageChainFinalizersRef.current = damageChainFinalizersRef.current.filter(f => !ready.includes(f));
          for (const f of ready) {
            const owner = syncStateRef.current[`${f.side}Team`].find(e => (e.battleId || e.id) === f.ownerId);
            if (!owner) continue;
            const before = owner.currentHp;
            f.run(getBattleEventContext(f.side, true, 0, owner));
            const after = syncStateRef.current[`${f.side}Team`].find(e => (e.battleId || e.id) === f.ownerId);
            if (after && after.currentHp !== before) presentation.record({ side: f.side, elfId: f.ownerId,
              type: after.currentHp > before ? 'adjust_up' : 'adjust_down', amount: Math.abs(after.currentHp - before), delta: after.currentHp - before,
              before, after: after.currentHp, maxHp: after.maxHp, alive: !checkElfDead(after) });
          }
          continue;
        }
        const effect = effectQueueRef.current.shift()!;
        // 旗標只涵蓋 executeEffect 的「同步段」：只擋同步巢狀呼叫，不影響外部正常等待佇列
        let pending: Promise<void>;
        executingEffectRef.current = true;
        effectChainRef.current = effect.chainId;
        try {
          checkShieldTransitions();
          pending = executeEffect(effect);
        } finally {
          executingEffectRef.current = false;
          effectChainRef.current = undefined;
        }
        try {
          await pending;
        } catch (e) {
          console.error("[executeEffect]", effect.type, e);
        }
        checkShieldTransitions();
      }
    })();
    processingPromiseRef.current = run;
    return run.finally(() => {
      processingPromiseRef.current = null;
      scheduleBattleTask(() => validateIdleRef.current(), 0);
    });
  }, [executeEffect]);

  // 文字彈出（Miss／技能無效／附加效果失效）
  const showPopup = stable((side: "p1" | "p2", text: string, type: string, label: string = "") => {
    const elf = syncStateRef.current[side];
    presentation.record({ side, elfId: elf.battleId || elf.id, type: 'notice', amount: 0, delta: 0,
      before: elf.currentHp, after: elf.currentHp, maxHp: elf.maxHp, text, label });
    void type;
  }, [dispatch]);

  const pushEffect = stable((effect: EffectItem) => {
    if (!battleAliveRef.current) return;
    effect = { ...effect, chainId: effectChainRef.current ?? ++effectChainSequenceRef.current };
    const win = skillWindowRef.current;
    if (effect.type === 'damage' && win && !effect.data?.skillName && !effect.data?.ledger && effect.data?.sourceSide === win.side)
      effect = { ...effect, data: { ...effect.data, ledgerOrigin: { skillName: win.skillName } } };
    // 只加播放標記，不修改 isPotion 等影響回血結算的參數。
    if (effect.type === 'heal' && presentationPotionRef.current) effect = { ...effect, data: { ...effect.data, presentationPotion: true } };
    effectQueueRef.current.push(effect);
    processQueue();
  }, [processQueue]);

  const getBattleEventContext = stable((side: "p1" | "p2", isHit: boolean = true, moveIndex?: number, selfElf?: Elf, isEntranceTurn?: boolean): BattleEventContext => {
    const isP1 = side === "p1";
    const cur = syncStateRef.current;
    const self = selfElf || (isP1 ? cur.p1 : cur.p2);
    const opp = isP1 ? cur.p2 : cur.p1;
    const selectedSkill = isP1 ? cur.p1SelectedSkill : cur.p2SelectedSkill;
    const resolution=resolutionSkillRef.current;
    const skill = selectedSkill&&cur.phase==='resolving'&&resolution?.side===side&&resolution.actionId===actionSerialRef.current?resolution.read():selectedSkill;
    const targetSide = isP1 ? "p2" : "p1";

    const shared: SharedContextDeps = {
      checkResourceTransitions:checkShieldTransitions,
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

    return attachLiveElfAccessors({
      actor: side,
      roundNumber: cur.turnNumber,
      actionId: actionSerialRef.current,
      contextForElf:(ownerSide,owner)=>getBattleEventContext(ownerSide,true,moveIndex,owner),
      specialMode: props.specialMode,
      currentPhase: cur.phase,
      applyDamageToElf: targetedDamageAPI(shared),
      afterDamageChain: run => {
        damageChainFinalizersRef.current.push({ chainId: effectChainRef.current, side,
          ownerId: self.battleId || self.id, run });
      },
      expel: targetSide => {
        const c = syncStateRef.current;
        const candidates = c[`${targetSide}Team`].flatMap((e, i) => i !== c[`${targetSide}ActiveIndex`] && !e.isExtra && !checkElfDead(e) ? [i] : []);
        if (!candidates.length) return false;
        endIllusion(getBattleEventContext(targetSide));
        pushEffect({ type: 'switch', side: targetSide, data: { index: candidates[Math.floor(rng() * candidates.length)] } });
        return true;
      },
      applyTrueDamageToElf:(targetSide, targetId, amount, label)=> {
        if (targetId === (cur[targetSide].battleId || cur[targetSide].id)) getBattleEventContext(side,true,moveIndex,self).applyTrueDamage(targetSide,amount,label);
        else pushEffect({type:"damage",side:targetSide,data:{targetId,amount,label,damageType:"true",sourceSide:side,sourceBattleId:self.battleId||self.id}});
      },
      applyHealToElf:(side, targetId, amount, opts)=>pushEffect({type:"heal",side,data:{amount,targetId,...opts}}),
      adjustHpToElf:(side,targetId,amount)=>pushEffect({type:'adjust_hp',side,data:{amount:Math.trunc(amount),targetId}}),
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
    }, syncStateRef, side, self, opp);
  }, [pushEffect, dispatch, showPopup]);

  const triggerSuitEffect = stable((side: "p1" | "p2", event: EffectTiming, extraData?: any) => {
    const cur = syncStateRef.current;
    const suitId = side === "p1" ? p1Suit : p2Suit;
    if (suitId && SuitEffectRegistry[suitId]) {
      const ctx = getBattleEventContext(side);
      SuitEffectRegistry[suitId](ctx, event, extraData);
    }
    const relics = side === "p1" ? cur.p1Relics : cur.p2Relics;
    if (relics?.length) runRelicEffects(relics, getBattleEventContext(side), event, extraData);
    runBossTraitEffects(cur[side], () => getBattleEventContext(side), event, extraData); // 異常資料庫的 BOSS 特性狀態（通用讀取端）
    // 稱號的登場事件（資料驅動：登場放入道具等），開局首發與換人再登場都經過這裡。
    if (event === EffectTiming.ON_ENTRANCE) runTitleEffects(getBattleEventContext(side), side === "p1" ? p1Title : p2Title, event);
  }, [getBattleEventContext, p1Suit, p2Suit, p1Title, p2Title]);

  /** 只派發給遺物／詞綴（不經套裝與稱號）。 */
  const triggerRelicEffect = stable((side: "p1" | "p2", event: EffectTiming, extraData?: any) => {
    const relics = side === "p1" ? syncStateRef.current.p1Relics : syncStateRef.current.p2Relics;
    if (relics?.length) runRelicEffects(relics, getBattleEventContext(side), event, extraData);
    runBossTraitEffects(syncStateRef.current[side], () => getBattleEventContext(side), event, extraData);
  }, [getBattleEventContext]);

  // 出手流程節點廣播：戰鬥階段的各節點只 dispatch 給在場當事人，場下的額外精靈擁有者（如布林克克/克塔亞特）收不到。
  // 此處以「全隊廣播」（與 ROUND_START 同模式）發送 EXTRA_ELF_NODE，僅有實作該 case 的 handler 會回應，其餘精靈惰性略過。
  const broadcastExtraElfNode = stable((label: string) => {
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

  const broadcastElfEntered = stable((enteredSide: "p1" | "p2", enteredId: string) => {
    const cur = syncStateRef.current;
    // 在場期間對所有精靈都可讀，不能只由特定魂印自行累加。
    getBattleEventContext(enteredSide).setPlayerState("fieldEntryTurn", cur.turnNumber);
    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? cur.p1Team : cur.p2Team;
      team.forEach(elf => {
        // DSH 20261020：隊友登場節點（ally_entered）——積木層表達「己方精靈每次出戰時」。
        // 額外精靈（如克塔亞特）沒有註冊 handler，但有自己的 kit；派發移出 handler 門外。
        if (elf && (elf as any).kit?.length) {
          // ctx.self＝該側在場精靈（出戰者）——「令其漸凍」的「其」是出戰者而非持有者；
          // 持有者資料經 extraData.enteredId 傳遞，讀取端可用 ctx.effectEventData 拿到。
          const ctx0 = getBattleEventContext(side, false, 0);
          try { runNode('ally_entered', (elf as any).kit.filter((x: any) => x.source !== 'skill'), CODEX, Object.assign(Object.create(ctx0), { enteredSide, enteredId })); } catch (err) { console.error('[ally_entered]', err); }
        }
        if (SoulMarkRegistry[elf.name]) {
          const ctx = getBattleEventContext(side, false, 0, elf);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.ELF_ENTERED, { enteredSide, enteredId });
        }
      });
    }
  }, [getBattleEventContext]);

  const ruleApi: BattleRuleApi = {
    getState: () => syncStateRef.current,
    setState: next => { syncStateRef.current = next; },
    dispatch: action => dispatch(action),
    ctx: (side, isHit = false, moveIndex = 0, elf) => getBattleEventContext(side, isHit, moveIndex, elf),
    log: (side, text, type = "effect") => pushEffect({ type: 'log', side, data: { text, type } }),
  };

  const applyDamageTicks = stable(async (side: "p1" | "p2", timing: 'ACTION' | 'END' = 'ACTION') => {
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
  /**
   * 死亡節點（官方 3.10／4.11／5.4）與擊敗節點（6.1–6.6）。
   * deathNode：1＝出手流程結束後；2＝戰鬥階段結束後；3＝回合結束後（含閒置自我校正）。
   * 同一次陣亡只結算一次（deathHandledRef），哪個節點先看到就由哪個節點結算。
   */
  const checkFaints = stable(async (killerSide?: "p1" | "p2", deferSwitch = false, deathNode: 1 | 2 | 3 = 3) => {
    if (!battleAliveRef.current) return false;
    const mid = syncStateRef.current;
    node(DEATH_NODE_ID[deathNode], { killerSide });

    const f1 = checkElfDead(mid.p1);
    const f2 = checkElfDead(mid.p2);
    // 同一次陣亡只結算一次死亡節點（戰鬥階段判定一次，回合結束後換人前再判定時不重複觸發）
    const deathKey = (e: Elf) => String(e?.battleId || e?.id);
    for (const e of [...mid.p1Team, ...mid.p2Team]) if (e && !checkElfDead(e)) deathHandledRef.current.delete(deathKey(e));
    const n1 = f1 && !deathHandledRef.current.has(deathKey(mid.p1));
    const n2 = f2 && !deathHandledRef.current.has(deathKey(mid.p2));
    if (n1) deathHandledRef.current.add(deathKey(mid.p1));
    if (n2) deathHandledRef.current.add(deathKey(mid.p2));
    if (f1 || f2) {
      void presentation.flush(true);
      presentation.align('p1', syncStateRef.current.p1);
      presentation.align('p2', syncStateRef.current.p2);
    }

    // 全局規則：陣亡（例：詩章轉移給存活的次元龍）
    for (const rule of battleRules()) rule.faint?.(ruleApi, mid);

    // 6.1 未被擊敗（只在出手後的死亡節點、對出手的目標判定）
    if (killerSide && deathNode === 1) {
      const targetSide = killerSide === "p1" ? "p2" : "p1";
      const target = mid[targetSide];
      if (target && !checkElfDead(target) && SoulMarkRegistry[target.name]) {
        node('6.1', { side: targetSide });
        SoulMarkRegistry[target.name](getBattleEventContext(targetSide), EffectTiming.NOT_DEFEATED, { node: deathNode, killerSide });
      }
    }
    // 6.2 被擊敗時（EffectTiming.DEATH_NODE_1 沿用為「被擊敗時」事件，data.node 標示是第幾個死亡節點）
    for (const side of ["p1","p2"] as const) {
      if (side === "p1" ? n1 : n2) {
        node('6.2', { side, node: deathNode });
        dispatchModeEvent(getBattleEventContext(side), EffectTiming.DEATH_NODE_1, {killerSide:damageOriginRef.current[(side === "p1" ? mid.p1 : mid.p2).battleId || (side === "p1" ? mid.p1 : mid.p2).id]?.side, killerId:damageOriginRef.current[(side === "p1" ? mid.p1 : mid.p2).battleId || (side === "p1" ? mid.p1 : mid.p2).id]?.id, node: deathNode});
      }
    }
    if (n1 && SoulMarkRegistry[mid.p1.name]) {
      const dCtx = getBattleEventContext("p1");
      SoulMarkRegistry[mid.p1.name](dCtx, EffectTiming.DEATH_NODE_1, { defeatedSelf: true, node: deathNode });
    }
    if (n2 && SoulMarkRegistry[mid.p2.name]) {
      const dCtx = getBattleEventContext("p2");
      SoulMarkRegistry[mid.p2.name](dCtx, EffectTiming.DEATH_NODE_1, { defeatedSelf: true, node: deathNode });
    }
    if (n1 || n2) broadcastExtraElfNode(deathNode === 1 ? "死亡節點一" : deathNode === 2 ? "死亡節點二" : "死亡節點三");

    // Trigger ON_KILL if someone just died and we have a killer
    if (killerSide && (killerSide === "p1" ? n2 : n1)) {
      const oppSide = killerSide === "p1" ? "p2" : "p1";
      const oppDead = checkElfDead(mid[oppSide]);
      const killerElf = mid[killerSide];
      const deadElf = mid[oppSide];
      
      if (oppDead && killerElf && deadElf) {
        // §3-2: Concealed elves do NOT trigger ON_KILL effects
        node('6.4', { side: killerSide });
        if (!deadElf.isConcealed && SoulMarkRegistry[killerElf.name]) {
          const kCtx = getBattleEventContext(killerSide, true, 0);
          SoulMarkRegistry[killerElf.name](kCtx, EffectTiming.ON_KILL, { defeatedElf: deadElf, node: deathNode });
        }
        broadcastExtraElfNode("擊敗對手");
      }
    } else if (killerSide && deathNode === 1 && !checkElfDead(mid[killerSide])) {
      // 6.3 未擊敗對手
      const killerElf = mid[killerSide];
      node('6.3', { side: killerSide });
      if (SoulMarkRegistry[killerElf.name]) SoulMarkRegistry[killerElf.name](getBattleEventContext(killerSide, true, 0), EffectTiming.NOT_KILLED, { node: deathNode });
    }
    // 6.5 被擊敗後／6.6 擊敗對手後
    for (const side of ["p1", "p2"] as const) {
      if (!(side === "p1" ? n1 : n2)) continue;
      const dead = mid[side];
      node('6.5', { side });
      if (dead && SoulMarkRegistry[dead.name]) SoulMarkRegistry[dead.name](getBattleEventContext(side), EffectTiming.AFTER_DEFEATED, { node: deathNode });
      if (killerSide && killerSide !== side && !checkElfDead(mid[killerSide]) && !dead?.isConcealed) {
        const killerElf = mid[killerSide];
        node('6.6', { side: killerSide });
        if (SoulMarkRegistry[killerElf.name]) SoulMarkRegistry[killerElf.name](getBattleEventContext(killerSide, true, 0), EffectTiming.AFTER_KILL, { defeatedElf: dead, node: deathNode });
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
    // 官方順序：戰鬥階段的陣亡先不換人，回合結束跑完後才換人（避免新上場精靈吃到這回合的回合結束）
    if (deferSwitch) return "forced_switch";

    // Handle forced switches
    if (f1 && f2) dispatch({ type: 'SET_PHASE', phase: "forced_switch_both" });
    else if (f1) dispatch({ type: 'SET_PHASE', phase: "forced_switch_p1" });
    else dispatch({ type: 'SET_PHASE', phase: "forced_switch_p2" });
    return "forced_switch";
    
  }, [battleMode, dispatch, processQueue, props, pushEffect, p1Suit, p2Suit, getBattleEventContext]);

  // T0-4 & T0-7: Separate turn finalization logic
  /** 異常扣減與轉化。only：只處理符合條件的異常（其餘原樣保留）。 */
  const tickStatusEffects = (elf: Elf, side: "p1" | "p2", endedEvents: {status:string;duration:number;reason:string}[], only?: (e: BattleEffect) => boolean) => {
    const currentEffects = elf.effects || [];
    if (checkElfDead(elf)) return currentEffects; // 陣亡者的異常不再扣減或轉化
    const nextEffects: BattleEffect[] = [];

    for (const e0 of currentEffects) {
      if (only && !only(e0)) { nextEffects.push(e0); continue; }
      const e = e0.catchUpTick ? (({ catchUpTick: _c, ...rest }) => rest)(e0) as BattleEffect : e0;
      const currentStatuses = getStatuses(elf);
      const statusTick = { status: e.id, skipTick: false };
      SoulMarkRegistry[elf.name]?.(getBattleEventContext(side, true, 0, elf), EffectTiming.BEFORE_STATUS_TICK, statusTick);
      const transition = statusTick.skipTick ? { next: e, transformed: undefined } : advanceStatusEffect(e, currentStatuses, rng);
      if (transition.next) {
        nextEffects.push(transition.next);
      } else {
        // §2: Check for EVOLUTION_TRANSFORM
        const entry = StatusRegistry[canonicalStatusName(e.id)];

        // 先記錄；等新異常列表正式合併後才通知，讓解除反應讀到真正的解除／衍化結果。
        endedEvents.push({ status: canonicalStatusName(e.id),duration:e.duration,reason:transition.transformed?'transformed':'expired' });

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
              stacks: 1,
            // 轉化帶明確回合數：同名合併時以此為準（不相加）
            durationFixed: true,
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


  const finalizeTurn = stable(async (force: boolean = false) => {
    presentation.setInAction(false);
    // 官方回合流程：4.10 戰鬥階段結束 → 4.11 死亡節點二 → 5 回合結束（效果 → 回合扣減） → 5.4 死亡節點三 → 換人。
    // 陣亡精靈仍在場時照常跑回合結束，換人在本函式最後才進行。
    const phaseStart = syncStateRef.current;
    pendingFinalizeRef.current = false;

    // ── 4.10 當回合戰鬥階段結束時 ──
    node('4.10');
    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? phaseStart.p1Team : phaseStart.p2Team;
      const oppSide = side === "p1" ? "p2" : "p1";
      const killedOpponentThisRound = checkElfDead(phaseStart[oppSide]);
      team.forEach(elf => {
        if (checkElfDead(elf) && !hasLivingSummonedExtra(team, elf)) return;
        if (SoulMarkRegistry[elf.name]) {
          // §39-3: BATTLE_PHASE_END with killedOpponent info
          SoulMarkRegistry[elf.name](getBattleEventContext(side, false, 0, elf), EffectTiming.BATTLE_PHASE_END, { killedOpponent: killedOpponentThisRound });
        }
      });
      triggerSuitEffect(side, EffectTiming.BATTLE_PHASE_END, { killedOpponent: killedOpponentThisRound });
      TraitsEngine.triggerBattlePhaseEnd(getBattleEventContext(side, true, 0));
    }
    await processQueue();
    if (!battleAliveRef.current) return;

    // ── 4.11 死亡節點二：戰鬥階段結束效果造成的陣亡（已在死亡節點一結算過的不重複） ──
    if (checkElfDead(syncStateRef.current.p1) || checkElfDead(syncStateRef.current.p2)) {
      const r2 = await checkFaints(undefined, true, 2);
      if (r2 === "game_over" || !battleAliveRef.current) return;
    } else node('4.11');

    // ── 5 回合結束 ──
    node('5');
    for(const side of ['p1','p2'] as const)if(!checkElfDead(syncStateRef.current[side]))statusSelectionRoundEnd(getBattleEventContext(side,false,0));
    const mid = syncStateRef.current;

    // Always clear selected skills to prevent accidental reuse
    dispatch({ type: 'SET_SKILL', side: 'p1', skill: null });
    dispatch({ type: 'SET_SKILL', side: 'p2', skill: null });

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
              const newSkills = recoverPpByTimers(live, regenAmount, syncStateRef.current[`${side}Timers`]);
              const updatedElf = { ...live, skills: newSkills };
              syncStateRef.current = { ...syncStateRef.current, [side]: updatedElf };
              dispatch({ type: 'UPDATE_ELF', side, elf: { skills: newSkills } });
              pushEffect({ type: 'log', side, data: { text: `⚡ 【${entry.name}】：回合結束恢復了各技能 ${regenAmount} 點 PP！`, type: "status" } });
            }
            if (p.ppRegenPerTurn) {
              const regenAmount = p.ppRegenPerTurn;
              const live = syncStateRef.current[side];
              const newSkills = recoverPpByTimers(live, regenAmount, syncStateRef.current[`${side}Timers`]);
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
      team.forEach(elf => {
        // 已死亡的精靈不再響應回合節點（避免場下自我回血＝復活）；只有「死後倒數、時間到於背包內重生」的魂印仍需計時
        if (checkElfDead(elf) && !hasLivingSummonedExtra(team, elf)) return;
        if (SoulMarkRegistry[elf.name]) {
          const ctx = getBattleEventContext(side, false, 0, elf);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.ROUND_END);
          SoulMarkRegistry[elf.name](ctx, EffectTiming.ENFORCE);
        }
      });
      triggerSuitEffect(side, EffectTiming.ROUND_END);
    }

    // 回合扣減點：異常扣減與轉化排在回合結束效果之後（以回合結束開始時的快照扣減，結算期間新增的異常本回合不扣）
    const endedStatusEvents: Record<'p1'|'p2', {status:string;duration:number;reason:string}[]> = {p1:[],p2:[]};
    const nextP1Effects = tickStatusEffects(mid.p1, "p1",endedStatusEvents.p1);
    const nextP2Effects = tickStatusEffects(mid.p2, "p2",endedStatusEvents.p2);

    // Re-sync with latest state after team-wide effects
    const curUpdate = syncStateRef.current;
    const p1RegUpdated = curUpdate.p1RegistryState || {};
    const p2RegUpdated = curUpdate.p2RegistryState || {};

    // 全局規則：回合結束（例：守護印記、攻擊技能 PP 消耗提升的回合遞減）
    for (const side of ["p1", "p2"] as const) {
      const reg = side === "p1" ? p1RegUpdated : p2RegUpdated;
      for (const rule of battleRules()) rule.roundEnd?.(ruleApi, side, reg);
      // attackSkillInvalidTurns 由特質引擎每回合遞減；這裡只負責結束提示
      if (reg.attackSkillInvalidTurns === 1) pushEffect({ type: 'log', side, data: { text: "攻擊技能封鎖效果已結束。", type: "effect" } });
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
            pushEffect({ type: 'damage', side, data: { amount: loss, popup: true, label: "流失", damageType: "true_damage", ledger: { kind: 'status', label: '流失' } } });
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
    const mergeById = mergeRoundEnd;
    const finalizeActive = (side: "p1" | "p2"): Elf => {
      const midElf = mid[side], liveElf = live[side];
      if (!liveElf || !midElf || (liveElf.battleId || liveElf.id) !== (midElf.battleId || midElf.id)) return liveElf;
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
      // 「下N回合」（ctx.setNextTurns）：本回合不生效、不扣減，遞減後才寫入
      return activatePendingTurns(out);
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

    for(const side of ['p1','p2'] as const) {
      const current=syncStateRef.current[side];
      if((current.battleId||current.id)!==(mid[side].battleId||mid[side].id))continue;
      for(const ended of endedStatusEvents[side]) {
        // 同名狀態可能在本次收尾被重新施加；仍存在時不發出假解除。
        if(Object.keys(getStatuses(syncStateRef.current[side])).some(name=>canonicalStatusName(name)===ended.status))continue;
        SoulMarkRegistry[current.name]?.(getBattleEventContext(side,true,0),EffectTiming.ON_STATUS_ENDED,{...ended,targetSide:side});
      }
    }
    const p1Ctx = getBattleEventContext('p1', true, 0);
    const p2Ctx = getBattleEventContext('p2', true, 0);
    // 收尾已清掉選招欄位；特質必須讀剛結束回合的選擇，不能把所有行動誤認為待機。
    p1Ctx.skill = mid.p1SelectedSkill; p2Ctx.skill = mid.p2SelectedSkill;

    // Registry ROUND_END (Handled by team loop above)
    // if (SoulMarkRegistry[mid.p1.name]) SoulMarkRegistry[mid.p1.name](p1Ctx, EffectTiming.ROUND_END);
    // if (SoulMarkRegistry[mid.p2.name]) SoulMarkRegistry[mid.p2.name](p2Ctx, EffectTiming.ROUND_END);
    TraitsEngine.triggerRoundEnd(p1Ctx);
    TraitsEngine.triggerRoundEnd(p2Ctx);

    // 回合結束觸發的額外行動（例如未出手時的滅靈魔咒）必須在本回合收尾立即結算，
    // 不得拖到下一個精靈出手才執行。這裡沿用與 endOfAction 相同的獨立節點語意。
    for (const owner of ["p1", "p2"] as const) {
      let resolved = 0;
      while (resolved < 32) {
        const queue = ((syncStateRef.current as any).extraActionQueue || []) as any[];
        const index = queue.findIndex(action => action.owner === owner);
        if (index < 0) break;
        // 原廠：額外行動不因對手倒下而跳過（可鞭屍）；只有自身已倒下時停止。
        if (checkElfDead(syncStateRef.current[owner])) {
          syncStateRef.current = { ...syncStateRef.current, extraActionQueue: queue.filter(action => action.owner !== owner) } as any;
          break;
        }
        presentation.beginExtra();
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
        await finishExtraPresentation(owner, 1);
        resolved++;
      }
      if (resolved >= 32 && ((syncStateRef.current as any).extraActionQueue || []).some((action: any) => action.owner === owner)) {
        syncStateRef.current = { ...syncStateRef.current, extraActionQueue: ((syncStateRef.current as any).extraActionQueue || []).filter((action: any) => action.owner !== owner) } as any;
        pushEffect({ type: 'log', side: owner, data: { text: `⚠️ 額外行動超過安全上限，已停止後續連鎖。`, type: "info" } });
      }
    }


    // §1: Apply DAMAGE_TICK at round end
    await applyDamageTicks("p1", "END");
    await applyDamageTicks("p2", "END");
    // 直接改體力、沒有留下紀錄的效果：回合末補成淨變化
    presentation.reconcile('p1', syncStateRef.current.p1);
    presentation.reconcile('p2', syncStateRef.current.p2);
    void presentation.flush();
    void presentation.setTurn(syncStateRef.current.turnNumber);
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
      const faintsResult = await checkFaints(undefined, false, 3);
      if (faintsResult) return;
    } else node('5.4');

    dispatch({ type: 'SET_PHASE', phase: "p1_select" });
  }, [dispatch, applyDamageTicks, checkFaints]);
    const applyEntranceBlessings = stable((side: "p1" | "p2", elf: Elf, ctx: BattleEventContext) => {
    recordBattleEntrance(ctx);
    dispatchModeEvent(ctx, EffectTiming.ON_ENTRANCE);
    // 「下一隻上場精靈」類待生效效果與其他登場規則：見 src/engine/battleRules.ts 與已註冊的規則檔。
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";
    const regState = syncStateRef.current[regKey] || {};
    const updates: Record<string, any> = {};
    for (const rule of battleRules()) Object.assign(updates, rule.entered?.(ruleApi, side, elf, ctx, regState) || {});
    if (Object.keys(updates).length) {
      syncStateRef.current = { ...syncStateRef.current, [regKey]: { ...syncStateRef.current[regKey], ...updates } };
      dispatch({ type: "UPDATE_REGISTRY_STATE", side, state: updates });
    }
  }, [dispatch]);

  const onAutoSwitch = stable(async (side: "p1" | "p2") => {
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

    // DSH 20261020：第 1 回合的「回合開始時」在開局（start）派發後，resolveTurn 首輪跳過，防止雙跑。
  const openingRoundStartDoneRef = { done: false };
  const resolveTurn = stable(async () => {
    if (!battleAliveRef.current) return;
    presentation.setInAction(false); // 回合開始等節點：技能傷害延後
    let cur = latestStateRef.current;
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

    // ── 1.2 操作階段：切換精靈、使用藥劑（官方在回合開始之前；這兩種行動不進入出手流程） ──
    // 1.3 登場時：切換上場的精靈在此登場。順序依雙方目前在場精靈的速度。
    const operated = new Set<"p1" | "p2">();
    {
      const st0 = syncStateRef.current;
      const opSpeed = (side: "p1" | "p2") => calculateEffectiveStat(st0[side].calculatedStats.speed, skillStageView(st0[side], st0[`${side}SelectedSkill`], 'speed'));
      const opOrder: ("p1" | "p2")[] = opSpeed("p1") >= opSpeed("p2") ? ["p1", "p2"] : ["p2", "p1"];
      // 通用寫入端：本回合先出手方（無為龍者「先出手／未行動」等條件的引擎讀取來源；不含精靈專屬常數）。
      try {
        for (const side of opOrder) getBattleEventContext(side, true, 0).setPlayerState('blkFirstMoverThisRound', opOrder[0]);
      } catch { /* 隔離環境無事件 context */ }
      for (const [mIdx, s] of opOrder.entries()) {
        try { getBattleEventContext(s, true, mIdx).setPlayerState('blkActedThisRound', s); } catch { /* 隔離環境 */ }
        const mid = syncStateRef.current;
        const skill = s === 'p1' ? mid.p1SelectedSkill : mid.p2SelectedSkill;
        if (!skill || (skill.name !== "切換精靈" && skill.name !== "使用道具")) continue;
        operated.add(s);
        const actor = mid[s];
        const opp = mid[s === 'p1' ? 'p2' : 'p1'];
        if (checkElfDead(actor)) continue;
        if (checkElfDead(opp) && skill.name !== "切換精靈") continue;
        if (syncStateRef.current[`${s}RegistryState`]?.actionPreventedRound === syncStateRef.current.turnNumber) {
          pushEffect({ type: 'log', side: s, data: { text: `【${actor.name}】本回合行動被阻止。`, type: 'info' } });
          continue;
        }
        node('1.2', { side: s, action: skill.name });
        if (skill.name === "切換精靈") {
          // 通用寫入端：記錄本回合有哪一方切換過精靈（「對手本回合切換精靈」等條件的讀取來源）。
          try {
            for (const sd of ["p1","p2"] as const) getBattleEventContext(sd, true, mIdx).setPlayerState('blkSwitchedThisRound', s);
          } catch { /* 隔離環境 */ }
          const idx = s === 'p1' ? mid.p1SwitchIndex : mid.p2SwitchIndex;
          if (idx !== null) {
            const outgoingElf = mid[s];
            const targetElf = (s === 'p1' ? mid.p1Team : mid.p2Team)[idx];
            
            if (outgoingElf && SoulMarkRegistry[outgoingElf.name]) {
              const outCtx = getBattleEventContext(s, true, mIdx);
              SoulMarkRegistry[outgoingElf.name](outCtx, EffectTiming.BEFORE_SWITCH_OUT, { incomingElf: targetElf, forced: false });
              SoulMarkRegistry[outgoingElf.name](getBattleEventContext(s, true, mIdx), EffectTiming.ON_SWITCH_OUT, { incomingElf: targetElf, forced: false });
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
            node('1.3', { side: s });
            TraitsEngine.triggerOnEntrance(nCtx);
            if (SoulMarkRegistry[currentElf.name]) SoulMarkRegistry[currentElf.name](nCtx, EffectTiming.ON_ENTRANCE);
            applyEntranceBlessings(s, currentElf, nCtx);
            triggerSuitEffect(s, EffectTiming.ON_ENTRANCE);
            broadcastElfEntered(s, currentElf.id);

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
            const nCtx = getBattleEventContext(s, true, mIdx);
            if (!nCtx.useBattleItem?.(s, item.id, s, item.picked)) nCtx.addLog('藥劑已用盡或目前無法使用，未產生回復。', 'effect');
          }
          await processQueue();
          continue;
        }
      }
      await processQueue();
    }

    
    cur = latestStateRef.current; // 操作階段可能已換人
    // ── 2.1 回合開始時 ──
    node('2.1');
    // §37-1: Trigger BEFORE_TURN_RESOLVE for soul marks (e.g. Puni reincarnation snapshot)
    if (SoulMarkRegistry[cur.p1.name]) SoulMarkRegistry[cur.p1.name](getBattleEventContext("p1"), EffectTiming.BEFORE_TURN_RESOLVE);
    if (SoulMarkRegistry[cur.p2.name]) SoulMarkRegistry[cur.p2.name](getBattleEventContext("p2"), EffectTiming.BEFORE_TURN_RESOLVE);

    // §39-1: Trigger ROUND_START and ENFORCE for all team members
    // 全局規則：回合開始（例：次元龍在場時所有精靈累積詩章）
    // DSH 20261020：開局已派發首回合 ROUND_START（見 start），此處首輪跳過防雙跑。
    if (openingRoundStartDoneRef.done) { openingRoundStartDoneRef.done = false; } else {
    for (const rule of battleRules()) rule.roundStart?.(ruleApi, cur);

    // 先同時更新雙方的在場計數，再派發任何回合開始事件；避免P1讀到P2上一回合的值。
    for (const side of ["p1", "p2"] as const) {
      const fieldCtx = getBattleEventContext(side, false, 0, syncStateRef.current[side]);
      const fieldKey = `${side}_turnsInBattle`;
      const curField = Number(fieldCtx.getPlayerState(fieldKey));
      fieldCtx.setPlayerState(fieldKey, Number.isFinite(curField) ? curField + 1 : 1);
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
    }

    const selectedState=syncStateRef.current;
    const original1=selectedState.p1SelectedSkill,original2=selectedState.p2SelectedSkill;
    const p1Skill=redirectedSelectedSkill(selectedState.p1,original1,selectedState.p2,original2);
    const p2Skill=redirectedSelectedSkill(selectedState.p2,original2,selectedState.p1,original1);
    cur.p1SelectedSkill=p1Skill;cur.p2SelectedSkill=p2Skill;
    syncStateRef.current={...syncStateRef.current,p1SelectedSkill:p1Skill,p2SelectedSkill:p2Skill};

    // ── 2.2 戰鬥階段開始時：判斷雙方先手權 ──
    node('2.2');
    // §38-4: Registry-based Priority Calculation
    const calcPriority = (side: "p1" | "p2", skill: any): { priority: number, forcedFirst: boolean; tieRole?: 'challenger' | 'challenged' } => {
      if (!skill) return { priority: 0, forcedFirst: false };
      skill = illusionSkill(cur[side], skill);
      const inherentRestricted = portableSkillCapabilities(syncStateRef.current[side],skill).innateDisabled || cur[side].isInherentInvalid || activeConstraints(cur[`${side}Timers`], cur[side]).some(p => p.inherentInvalid);
      const regState = cur[`${side}RegistryState`] || {};
      const nextPriorityCount = regState.nextPriorityCount || 0;
      const comp: PriorityComputation = {
        base: skillBasePriority(skill, cur[side], cur[side === 'p1' ? 'p2' : 'p1'], getStatuses, !!inherentRestricted, getBattleEventContext(side, true, 0)),
        bonus: (regState.nextTurnPriority || 0) + (nextPriorityCount > 0 ? 2 : 0) + priorityBonus(side === "p1" ? cur.p1 : cur.p2, skill, rng)
          + (isSkillStone(skill) ? stonePriorityBonus(getBattleEventContext(side, true, 0), skill) : skill.effectMode === 'kit' && skill.kit?.some((e: any) => e.params?.property === 'chance_priority' || e.params?.property === 'conditional_priority') ? readChancePriority(skill, getBattleEventContext(side, true, 0)) : 0)
          + ((regState.priorityBoostTurns || 0) > 0 && !(regState.priorityBoostAttackOnly && skill.category === "屬性") ? (regState.priorityBoostValue || 0) : 0)
          // 通用讀取端：登場計數疊層先制（blocks/ops/entranceStack.entrance_stack_buff 寫入；下場由 entrance_reset 清零）。
          + (regState.entranceStackPrioBonus || 0),
        forcedFirst: !inherentRestricted && readSkillProperty(skill, 'forced_first', getBattleEventContext(side, true, 0)) === true
      };
      // 競技場：下回合先制懲罰（回合數制，通用 tick 自動遞減；莫伊萊1／無為1／無極2）
      if ((regState.priorityPenaltyTurns || 0) > 0) comp.bonus -= 2;
      // 積木持續效果：下N次技能先制、N回合必定先手
      {
        const blkT = (cur as any)[`${side}Timers`];
        const bp = findBlockTimer(blkT, b => b.prio != null && !(b.attackOnly && skill.category === "屬性"));
        if (bp) comp.bonus += bp.payload.block.prio;
        if (findBlockTimer(blkT, b => b.first && !(b.attackOnly && skill.category === '屬性'))) comp.forcedFirst = true;
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
      // once_used_degrade 讀取端（對手側）：對手選擇已衰變技能（每場一次已用、命中歸0）時，我方當回合先制-v。
      // 旗標掛在施術者（對手）的 registry，須以對手視角讀取。
      {
        const oppSide = side === "p1" ? "p2" : "p1";
        const oppSelected = cur[`${oppSide}SelectedSkill`] || null;
        const degraded = oppSelected ? readOnceDegraded(oppSelected, getBattleEventContext(oppSide, true, 0)) : null;
        if (degraded) comp.bonus -= degraded.v;
      }
      if (SoulMarkRegistry[elf.name]) {
        const ctx = getBattleEventContext(side, true, 0);
        SoulMarkRegistry[elf.name](ctx, EffectTiming.MODIFY_PRIORITY, { priorityComp: comp });
      }

      dispatchModeEvent(getBattleEventContext(side, true, 0), EffectTiming.MODIFY_PRIORITY, {priorityComp:comp});
      runBossTraitEffects(elf, () => getBattleEventContext(side, true, 0), EffectTiming.MODIFY_PRIORITY, { priorityComp: comp });
      // 正先制失效涵蓋所有先制來源，包含後續魂印／積木的動態加值；負先制仍保留。
      if ((regState.blkNoPosPrioTurns || 0) > 0) { comp.base = Math.min(0, comp.base); comp.bonus = Math.min(0, comp.bonus); }
      // 「無視自身負先制等級」（5012 王·蒼銀之棺）：最終先制低於 0 時視為 0（負先制歸零）。
      if ((regState.ignoreSelfNegativePriorityTurns || 0) > 0 || (regState.ignoreSelfNegativePriorityThisAction)) {
        comp.base = Math.max(0, comp.base); comp.bonus = Math.max(0, comp.bonus);
      }
      return {
        priority: Math.floor((comp.base + comp.bonus) * multiplier),
        forcedFirst: comp.forcedFirst,
        tieRole: comp.tieRole
      };
    };

    const p1Res = calcPriority("p1", p1Skill);
    const p2Res = calcPriority("p2", p2Skill);

    let p1Priority = p1Res.priority;
    let p2Priority = p2Res.priority;
    [p1Priority,p2Priority]=resolveSelectedPriorityPolicies(p1Priority,p2Priority,p1Skill,p2Skill,getBattleEventContext('p1',true,0),getBattleEventContext('p2',true,0));
    // 通用：「對手先制等級無法高於自身」（由魂印／技能在 MODIFY_PRIORITY 設定，本回合一次）。
    for (const side of ["p1", "p2"] as const) {
      const reg = (syncStateRef.current as any)[`${side}RegistryState`] || {};
      if (!reg.capOpponentPriorityThisTurn) continue;
      if (side === "p1") p2Priority = Math.min(p2Priority, p1Priority); else p1Priority = Math.min(p1Priority, p2Priority);
    // 通用：「無視對手不高於 N 的先制」（由魂印／技能寫 oppPriorityCeiling；每行動結束重置）——
    // 「寂殺之魄：異常時無視對手不高於層數（×3）的先制」等層數封頂句式。
    for (const side of ["p1", "p2"] as const) {
      const reg = (syncStateRef.current as any)[`${side}RegistryState`] || {};
      const ceiling = Number(reg.oppPriorityCeiling);
      if (!(Number.isFinite(ceiling) && ceiling >= 0)) continue;
      if (side === "p1") p2Priority = Math.min(p2Priority, ceiling); else p1Priority = Math.min(p1Priority, ceiling);
    }
      syncStateRef.current = { ...syncStateRef.current, [`${side}RegistryState`]: { ...reg, capOpponentPriorityThisTurn: false } } as any;
    }

    // 通用：記下本回合雙方出手的先制等級（供「精靈先制為0」等計數條件讀取；強制先手不改變記錄）
    for (const [side, pr] of [["p1", p1Priority], ["p2", p2Priority]] as const) {
      const key = `${side}RegistryState` as "p1RegistryState" | "p2RegistryState";
      syncStateRef.current = { ...syncStateRef.current, [key]: { ...(syncStateRef.current[key] || {}), actionPriorityThisTurn: pr } } as any;
    }
    if (p1Res.forcedFirst && !p2Res.forcedFirst) {
      p1Priority = Math.max(p1Priority, p2Priority + 999);
    } else if (p2Res.forcedFirst && !p1Res.forcedFirst) {
      p2Priority = Math.max(p2Priority, p1Priority + 999);
    }

    let p1Speed = calculateEffectiveStat(cur.p1.calculatedStats.speed, skillStageView(cur.p1, p1Skill, 'speed'));
    let p2Speed = calculateEffectiveStat(cur.p2.calculatedStats.speed, skillStageView(cur.p2, p2Skill, 'speed'));
    // 通用：當回合忽略對手 N 點速度（由套裝／魂印設定 opponentSpeedPenalty）
    p2Speed = Math.max(0, p2Speed - (Number(cur.p1RegistryState?.opponentSpeedPenalty) || 0));
    p1Speed = Math.max(0, p1Speed - (Number(cur.p2RegistryState?.opponentSpeedPenalty) || 0));

    const actors: ("p1" | "p2")[] = p1Priority >= p2Priority ? ["p1", "p2"] : ["p2", "p1"];
    if (p1Priority === p2Priority && p1Speed < p2Speed) actors.reverse();
    // 先制與速度皆相同時，被挑戰方優先；未指定或雙方相同則保留原排序。
    if(p1Priority===p2Priority&&p1Speed===p2Speed&&p2Res.tieRole==='challenged'&&p1Res.tieRole!=='challenged')actors.reverse();
    // 操作階段只按速度排序；技能的先／後出手必須改讀先制與強制先手結算後的正式順序。
    for (const side of actors) getBattleEventContext(side, true, 0).setPlayerState('blkFirstMoverThisRound', actors[0]);

    // ── 出手流程結束（含選擇技能因故未能出手）：ACTION_END 與額外行動
    const endOfAction = async (side: "p1" | "p2", idx: number) => {
      const elf = syncStateRef.current[side];
      if (!elf || checkElfDead(elf)) return;
      node('3.8', { side, order: idx });
      const ctxE = getBattleEventContext(side, true, idx);
      try { if (SoulMarkRegistry[elf.name]) SoulMarkRegistry[elf.name](ctxE, EffectTiming.ACTION_END, { actor: side }); } catch (e) { console.error(e); }
      // 咒術師的魔咒在主動出手流程結束後排入獨立額外行動節點。
      TraitsEngine.triggerActionPhaseEnd(ctxE);
      const opp = side === "p1" ? "p2" : "p1";
      // 每次只取一項並重新讀取佇列，讓額外行動結算中新增的額外行動也能在同一節點依序生效。
      // 設上限防止錯誤效果互相排隊造成無限循環。
      const drained = await drainExtraActionQueue<any>({
        owner: side,
        readQueue: () => ((syncStateRef.current as any).extraActionQueue || []),
        writeQueue: extraActionQueue => { syncStateRef.current = { ...syncStateRef.current, extraActionQueue } as any; },
        // 原廠：額外行動不因對手倒下而跳過（可鞭屍）；只有自身已倒下時停止。
        canContinue: () => !checkElfDead(syncStateRef.current[side]),
        execute: async act => {
          node('3.9', { side, order: idx, label: act.label });
          presentation.beginExtra();
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
          await finishExtraPresentation(side, 1);
        },
      });
      if (drained.truncated) {
        pushEffect({ type: 'log', side, data: { text: `⚠️ 額外行動超過安全上限，已停止後續連鎖。`, type: "info" } });
      }
    };
    // ── 出手結果通知：自身 AFTER_ACTION（成功）／ACTION_FAILED（無效、未命中、閃避、攻擊免疫），對手 OPPONENT_AFTER_ACTION
    const notifyActionResult = (side: "p1" | "p2", idx: number, info: ActionResultInfo, failed: boolean) => {
      const oppS = side === "p1" ? "p2" : "p1";
      const me = syncStateRef.current[side];
      if (me && SoulMarkRegistry[me.name]) {
        try { SoulMarkRegistry[me.name](getBattleEventContext(side, !failed, idx), failed ? EffectTiming.ACTION_FAILED : EffectTiming.AFTER_ACTION, info); } catch (e) { console.error("[action result]", e); }
      }
      const foe = syncStateRef.current[oppS];
      if (foe && !checkElfDead(foe) && SoulMarkRegistry[foe.name]) {
        try { SoulMarkRegistry[foe.name](getBattleEventContext(oppS, true, idx), EffectTiming.OPPONENT_AFTER_ACTION, info); } catch (e) { console.error("[action result]", e); }
      }
    };
    // 未成功出手時清理「本次行動」通用旗標（成功出手時由正常流程清理；過去提早 continue 會殘留到下次行動）
    const clearPerActionFlags = (side: "p1" | "p2") => {
      const key = `${side}RegistryState` as "p1RegistryState" | "p2RegistryState";
      const rg = syncStateRef.current[key] || {};
      const clean: Record<string, any> = { vampireDamageTypesThisAction: undefined, damageModifiersThisAction: [], powerMultiplierThisAction: 1, powerAddThisAction: 0, vampireRatio: 0,
        blkIgnoreLimit: false, blkIgnoreBlock: false, blkIgnoreShield: false, ignoreDamageLimitThisAction: false, fixedTypeMultThisAction: 0,
        ignoreAttackImmunityThisAction: false, ignoreShieldThisAction: false, ignoreOppBuffThisAction: false, oppBoostAsDropThisAction: false, oppPriorityCeiling: null, selfDropIgnoredThisAction: false,
        selfDropAsOppDropThisAction: false, noResistedThisAction: false, mercyThisAction: false, blkAtkSpatkSum: false, blkAtkSpAtkSum: false,
        grantStabThisAction: false, minimumTypeMultiplierThisAction: undefined, skillRecalculationUsedThisAction: false, skillRecalculationRequest: undefined, forceHitEffectsThisAction: false, forcedHitThisAction: false,
        blkStageAsBoost: 0, blkTypeOverrideCurrentAction: false };
      const changed = Object.keys(clean).filter(k => k in rg && JSON.stringify(rg[k]) !== JSON.stringify(clean[k]));
      if (!changed.length) return;
      const patch = Object.fromEntries(changed.map(k => [k, clean[k]]));
      syncStateRef.current = { ...syncStateRef.current, [key]: { ...rg, ...patch } };
      dispatch({ type: 'UPDATE_REGISTRY_STATE', side, state: patch });
    };
    const failAction = (side: "p1" | "p2", idx: number, usedSkill: any, kind: "invalid" | "miss" | "evade" | "immune", reason: string) => {
      const forced = hasForcedHitEffects(getBattleEventContext(side, true, idx));
      const h = usedSkill?.name ? getBattleSkillOnInvalidRegistry()[usedSkill.name] : undefined;
      if (h) {
        try { const c = getBattleEventContext(side, true, idx); (c as any).skill = usedSkill; h(c, { reason, kind }); } catch (e) { console.error("[ON_INVALID]", e); }
      }
      if (forced) {
        const c = getBattleEventContext(side, true, idx); c.skill = usedSkill;
        runForcedHitEffects(c,usedSkill);
      }
      const retry = takeSkillRecalculation(getBattleEventContext(side, true, idx));
      if (retry) return retry; // 共用主傷害流程接手；PP、使用技能效果與無效鉤子不重跑。
      const result = { actor: side, skill: usedSkill, category: usedSkill?.category, damageDealt: 0, isCrit: false, hit: false, additionalEffectsEnabled: false, invalid: kind === "invalid", killed: false, failKind: kind };
      notifyActionResult(side, idx, result, true);
      const usedCtx = getBattleEventContext(side, false, idx); usedCtx.skill = usedSkill;
      emitFailedSkillUse(usedCtx, getBattleEventContext(side === 'p1' ? 'p2' : 'p1', false, idx), result);
      clearPerActionFlags(side);
    };
    // 一般與額外使用共用同一套命中、效果、傷害與結果結算；重播不額外扣PP。
    const executeSkillUse=async(s:"p1"|"p2",mIdx:number,replaying=false):Promise<"partial"|"full">=>{
      actionSerialRef.current++;
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

      if (checkElfDead(actor)) return "partial";
      if (checkElfDead(opp) && skill?.name !== "切換精靈") return "partial";

      if (!skill) return "partial";
      // 選擇技能類觸發早於控制／行動阻止，不能被無法出手的提前continue吞掉。
      if (skill.name !== '切換精靈' && skill.name !== '使用道具') TraitsEngine.triggerBeforeAction(getBattleEventContext(s, true, mIdx));
      if (syncStateRef.current[regKeySelf]?.actionPreventedRound === syncStateRef.current.turnNumber) {
        pushEffect({ type: 'log', side: s, data: { text: `【${actor.name}】本回合行動被阻止。`, type: 'info' } });
        return "partial";
      }

      if (isElfActionDisabled(actor, opp) && skill.name !== "切換精靈" && skill.name !== "使用道具") {
        pushEffect({ type: 'log', side: s, data: { text: `💫 【${actor.name}】因異常狀態無法行動！`, type: "status" } });
        await processQueue();
        return "partial";
      }

      // 切換精靈／使用道具已在 1.2 操作階段處理，不進入出手流程。
      if (skill.name === "切換精靈" || skill.name === "使用道具") return "partial";


      let ctx = getBattleEventContext(s, true, mIdx);
      ctx.setPlayerState('blkTypeOverrideCurrentAction', false);
      ctx.setPlayerState('attackHitCountThisAction', 0);
      ctx.setPlayerState('attackBonusHitCountThisAction', 0);
      const ppCostComp = {
        base: replaying || skill.name === "掙扎" ? 0 : 1,
        additionalCost: 0,
        extraAllSkills: 0,
        multiplier: replaying ? 0 : 1,
      };

      // ── 3.1 出手流程開始時 ──
      node('3.1', { side: s, order: mIdx });
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
        SoulMarkRegistry[defendingElf.name](getBattleEventContext(oppSide, true, mIdx === 0 ? 1 : 0), EffectTiming.OPPONENT_ACTION, { skill: ctx.skill, side: s });
      }
      // 遺物／詞綴的「對手出手時」效果（星蝕回廊首領神話：任一方首次出手即激活）
      triggerRelicEffect(oppSide, EffectTiming.OPPONENT_ACTION, { skill: ctx.skill, side: s });
      broadcastExtraElfNode("出手流程開始");
      // 出手流程前的通用控制效果必須先結算，再檢查本次行動；不可拿流程開始前的精靈快照判定。
      await processQueue();
      if (checkElfDead(syncStateRef.current[s]) || checkElfDead(syncStateRef.current[oppSide])) return "partial";
      if (isElfActionDisabled(syncStateRef.current[s], syncStateRef.current[oppSide])) {
        pushEffect({ type:'log',side:s,data:{text:`💫 【${actor.name}】在出手前受到控制，無法行動！`,type:'status'} });
        await processQueue();
        return "partial";
      }
      // ── 3.2 使用技能時／技能命中前：PP、技能轉化、無效與命中判定 ──
      node('3.2', { side: s, order: mIdx });

      // 隱匿只對敵方視角掩蓋；己方完整顯示（UI 另對敵方隱匿精靈的所有文字做掩蓋）。
      const actorHidden = hiddenFromViewer(actor, s, battleMode === 'PVP' ? 'PVP' : 'PVE');
      let displayName = actorHidden ? "未知精靈" : actor.name;
      let displaySkill = actorHidden ? "未知技能" : skill.name;
      let activeSkill = skill;
      resolutionSkillRef.current={side:s,actionId:actionSerialRef.current,read:()=>activeSkill};

      const actorStatuses = getStatuses(syncStateRef.current[s] ?? actor);
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

      // 狀態的選招扣PP已由 statusSkillSelected 結算；行動時新獲得的狀態不追溯選招。

      const fearDrain = actorState.fearSeedDrainPP || (syncStateRef.current as any)[`${s}_fearSeedDrainPP`];
      if (fearDrain) {
        ppDrainedToZero = true;
        drainReason = actorState.fearSeedDrainReason || "PP清空";
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
        const selectedSlot = skillSlot(elfToDrain, activeSkill);
        const nextSkills = elfToDrain.skills.map((sk, i) => i === selectedSlot ? { ...sk, pp: 0 } : sk);
        dispatch({ type: 'UPDATE_ELF', side: s, elf: settlePpChanges(elfToDrain, nextSkills).patch });
        pushEffect({ type: 'log', side: s, data: { text: `⚙️ 【${drainReason}】：【${activeSkill.name}】技能PP被清空！`, type: "status" } });
        pushEffect({ type: 'log', side: s, data: { text: `💫 【${actor.name}】因PP值歸零，當回合無法行動！`, type: "status" } });
        await processQueue();
        return "partial";
      }

      // 不消耗PP（平靜、奧佩婭、滄嵐條件等）；「不受PP值限制」只影響能否選擇，PP>0 時照常扣
      if (isPpCostFree(actor, activeSkill, opp)) {
        ppCostComp.multiplier = 0;
      }

      // 通用：N 回合內攻擊技能 PP 消耗提升（attackPpMultiplierTurns／Value，由魂印設定）
      if (actorState.attackPpMultiplierTurns > 0 && (activeSkill.category === '物理' || activeSkill.category === '特殊')) {
        ppCostComp.multiplier *= (actorState.attackPpMultiplierValue || 3);
        pushEffect({ type: 'log', side: s, data: { text: `攻擊技能 PP 消耗增加至 ${actorState.attackPpMultiplierValue || 3} 倍！`, type: "effect" } });
      }

      // PP Consumption Logic
      {
        const pm = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.ppMult && (!b.kind || (b.kind === "攻擊") === (skill.category !== "屬性")));
        ((globalThis as any).__FE ||= []).push({ s, timers: ((syncStateRef.current as any)[`${s}Timers`] || []).map((x: any) => ({ id: x.id, rem: x.remaining, pend: x.pendingActivation })), pm: pm?.id });
        if (pm) ppCostComp.multiplier *= pm.payload.block.ppMult;
      }
      const finalPpCost = Math.floor((ppCostComp.base + ppCostComp.additionalCost) * ppCostComp.multiplier);
      const extraAll = ppCostComp.extraAllSkills;

      if (finalPpCost > 0 || extraAll > 0) {
        const elfToUpdate = syncStateRef.current[s];
        const selectedSlot = skillSlot(elfToUpdate, activeSkill);
        const newSkills = elfToUpdate.skills.map((sk, slot) => {
          let newPp = sk.pp;
          if (slot === selectedSlot) {
            newPp = Math.max(0, (newPp ?? 0) - finalPpCost);
          }
          if (extraAll > 0) {
            newPp = Math.max(0, (newPp ?? 0) - extraAll);
          }
          return { ...sk, pp: newPp };
        });

        dispatch({ type: 'UPDATE_ELF', side: s, elf: settlePpChanges(elfToUpdate, newSkills).patch });
        
        if (finalPpCost > 1) {
          pushEffect({ type: 'log', side: s, data: { text: `📉 【${displaySkill}】額外消耗了 ${finalPpCost - 1} 點 PP！`, type: "effect" } });
        }
        if (extraAll > 0) {
          pushEffect({ type: 'log', side: s, data: { text: `📉 受效果影響，【${displayName}】所有技能 PP 額外消耗 ${extraAll} 點！`, type: "effect" } });
        }

        // Trigger ON_PP_CONSUME for soulmarks/traits
        if (SoulMarkRegistry[elfToUpdate.name]) {
          SoulMarkRegistry[elfToUpdate.name](ctx, EffectTiming.ON_PP_CONSUME, {
            reason: 'normal_cost', consumedSlots: elfToUpdate.skills.flatMap((sk, i) => newSkills[i].pp < sk.pp ? [i] : [])
          });
        }
      }

      // 技能本體轉化必須發生在技能無效、命中與攻擊免疫判定之前；PP仍扣原技能欄位。
      const transformedSkill = transformSkillBeforeResolve(getBattleEventContext(s, true, mIdx), activeSkill);
      if (getBattleEventContext(s, true, mIdx).getPlayerState('soulSureHitThisAction')) transformedSkill.isSureHit = true;
      if (transformedSkill !== activeSkill) {
        activeSkill = transformedSkill;
        (ctx as any).skill = transformedSkill;
        if (!actorHidden) displaySkill = transformedSkill.name;
      }

      // 全局規則提供的本次出手旗標（例：詩章 8 篇無視攻擊無效／攻擊免疫）
      const ruleFlags = collectActionFlags(syncStateRef.current, s, skill);
      const ignoreAttackInvalidation = !!ruleFlags.ignoreAttackInvalidation;

      let skillIsInvalidated = false;
      let invalidationReason = "";
      let retryFailureKind: "invalid" | "miss" | "evade" | "immune" | undefined;
      let consumedInvalidation: any;

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
      const incomingUtilityTimer=findBlockTimer(syncStateRef.current[`${oppSide}Timers`],b=>b.incomingUtilityInvalid===true);
      // 2. Check for attribute skill invalidation
      if (skillIsInvalidated) {
        // 已失效
      } else if (skill.category === "屬性") {
        if (actorState.utilitySkillInvalidTurns > 0 || oppState.incomingUtilityInvalidTurns > 0 || incomingUtilityTimer || actorState.sealPropertyTurns > 0 || oppState[`${s}_utilitySkillInvalidTurns`] > 0) {
          skillIsInvalidated = true;
          invalidationReason = oppState.incomingUtilityInvalidTurns > 0 || incomingUtilityTimer
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
               const replacement=statusSkillTransform(activeSkill,p);
               if(replacement){activeSkill=replacement;if(!actorHidden)displaySkill=replacement.name;displayName=`${displayName}(${replacement.name})`;}
            }
          }
        });
      });

      // Check opponent's buffs
      ctx=getBattleEventContext(s,true,mIdx);
      Object.keys(oppStatuses).forEach(stId => {
        const entry = StatusRegistry[stId];
        entry?.mechanics?.forEach(m => {
          if (m.type === 'SPECIAL_BUFF') {
            const p = m.params || {};
            if (p.immunePrioritySkills && (calcPriority(s, activeSkill).priority > 0)) {
              skillIsInvalidated = true;
              invalidationReason = `【${entry.name}】先制技能無效`;
            }
            if (p.dodgeAll && !activeSkill.isSureHit && !activeSkill.alwaysHit) {
              skillIsInvalidated = true;
              invalidationReason = `【${entry.name}】閃避所有技能`;
            }
          }
        });
      });

      // BOSS 特性（封魔／技能無效）：受方的特性狀態令來襲技能無效
      if (!skillIsInvalidated) {
        const traitInvalid = bossTraitInvalidates(syncStateRef.current[oppSide], oppSide, activeSkill);
        if (traitInvalid) { skillIsInvalidated = true; invalidationReason = traitInvalid; }
      }

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
        invalidationReason = `【${syncStateRef.current[myRegKey]?.attackInvalidSource || "攻擊技能無效"}】對手攻擊技能無效（剩餘 ${next2AtkInvalidVal} 次）`;
        
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
        const inv = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.invalid && matchesSkillCategory(b.invalid, activeSkill.category) && (b.powerAbove === undefined || activeSkill.power > b.powerAbove));
        if (inv) {
          skillIsInvalidated = true;
          invalidationReason = `【${inv.payload.block.src || "技能"}】`;
          consumedInvalidation = inv;
          // 次數型才消耗；回合型（「下N回合…技能無效」）期間內每次都無效
          if (inv.kind === "use_counter") getBattleEventContext(s, true, mIdx).consumeTimer?.(s, inv.id);
        }
      }
      // 積木：附加效果失效
      // 抵擋容器有效期間的跨側封印；容器被觸發或下場移除便同步解除。
      if(!addEffectsInvalid&&findBlockTimer((syncStateRef.current as any)[`${oppSide}Timers`],b=>b.sealOpponentAdded)){
        addEffectsInvalid=true;addEffectsInvalidReason='抵擋期間附加效果失效';
      }
      if (!addEffectsInvalid) {
        const ai = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.addInvalid && matchesSkillCategory(b.addInvalid, activeSkill.category));
        if (ai) {
          addEffectsInvalid = true;
          addEffectsInvalidReason = `【${ai.payload.block.src || "效果"}】附加效果失效`;
          if (ai.kind === "use_counter") getBattleEventContext(s, true, mIdx).consumeTimer?.(s, ai.id);
        }
      }

      if (skillIsInvalidated) {
        // 技能無效視同未命中
        SoulMarkRegistry[syncStateRef.current[s].name]?.(getBattleEventContext(s, false, mIdx), EffectTiming.SKILL_INVALID, { skill: activeSkill, reason: invalidationReason, kind: "invalid", isIncoming: false, consumedInvalidation });
        SoulMarkRegistry[syncStateRef.current[oppSide].name]?.(getBattleEventContext(oppSide, false, mIdx), EffectTiming.SKILL_INVALID, { skill: activeSkill, reason: invalidationReason, kind: "invalid", isIncoming: true });
        pushEffect({ type: 'log', side: s, data: { text: `🚫 【技能無效】：受${invalidationReason}限制，【${displayName}】使用的【${displaySkill}】無效！`, type: "info" } });
        showPopup(oppSide, "技能無效-0", "invalid");
        try { runSkillBlocks(getBattleEventContext(s, true, mIdx), "on_invalid", hasSkillHandler(activeSkill.name), true); emitSelfInvalid(getBattleEventContext(s, true, mIdx), true); } catch (e) { console.error("[blocks]", e); }
        const retry = failAction(s, mIdx, activeSkill, "invalid", invalidationReason);
        await processQueue();
        if (!retry) return "partial";
        activeSkill = recalculatedSkill(activeSkill, retry); retryFailureKind = 'invalid'; addEffectsInvalid = true;
      }

      pushEffect({ type: 'log', side: s, data: { text: `【${displayName}】使用了【${displaySkill}】！`, type: s, sourceCode: `src/effects/${actor.name}Registry.ts:${activeSkill.name}` } });
      // 固有使用條款在公式快照之後、命中／攻擊免疫之前執行；附加條款仍待命中閘門。
      if (!retryFailureKind) runSkillBlocks(withRecoveryOrigin(getBattleEventContext(s, true, mIdx),'skill'), 'use', hasSkillHandler(activeSkill.name), false, 'innate');
      ctx.innateSkillUseHandled = !retryFailureKind;
      if (!retryFailureKind) try { emitSkillUse(getBattleEventContext(s, true, mIdx), getBattleEventContext(oppSide, true, mIdx), activeSkill, false); } catch (e) { console.error("[blocks]", e); }
      const animCategory = activeSkill.category === "屬性" ? "property" : activeSkill.category === "物理" ? "physical" : "special";
      pushEffect({ type: 'animation', side: s, data: { anim: { side: s, category: animCategory, skillName: activeSkill.name, targetSide: s === "p1" ? "p2" : "p1" }, duration: 400 } });

      // ── 命中判定（過去 accuracy／必中／命中等級都只是資料，所有技能必定命中）
      if (!retryFailureKind) {
        const hit = rollSkillHit(syncStateRef.current[s], syncStateRef.current[oppSide], activeSkill, (e) => getStatuses(e), rng, syncStateRef.current[oppRegKey], syncStateRef.current[s === "p1" ? "p1RegistryState" : "p2RegistryState"]);
        if (!hit.hit) {
          // 未命中：Miss-保底傷害（目前無保底 → 0）
          const missFloor = 0;
          pushEffect({ type: 'log', side: s, data: { text: `💨 【${displayName}】的【${displaySkill}】沒有命中！`, type: "info" } });
          showPopup(oppSide, `Miss-${missFloor}`, "miss");
          try { runSkillBlocks(getBattleEventContext(s, true, mIdx), "on_invalid", hasSkillHandler(activeSkill.name)); emitSelfInvalid(getBattleEventContext(s, true, mIdx)); } catch (e) { console.error("[blocks]", e); }
          const retry = failAction(s, mIdx, activeSkill, "miss", "未命中");
          await processQueue();
          if (!retry) return "partial";
          activeSkill = recalculatedSkill(activeSkill, retry); retryFailureKind = 'miss'; addEffectsInvalid = true;
        }
      }

      // ── 常駐閃避（積木魂印；必中技能無效）
      if (!retryFailureKind && !activeSkill.isSureHit && !activeSkill.alwaysHit) {
        const evT = findBlockTimer((syncStateRef.current as any)[`${oppSide}Timers`], b => b.evade && !(b.kind === "攻擊" && activeSkill.category === "屬性"));
        const ev = Math.max(soulPassiveEvade(syncStateRef.current[oppSide], activeSkill), evT ? evT.payload.block.evade : 0, bossTraitEvade(syncStateRef.current[oppSide]));
        if (ev > 0 && prdChance(`${oppSide}:blkEvade`, ev / 100)) {
          pushEffect({ type: 'log', side: oppSide, data: { text: `💨 【${syncStateRef.current[oppSide].name}】閃避了【${displaySkill}】！`, type: "effect" } });
          showPopup(oppSide, "Miss-0", "miss");
          // 與無效分支（2603）／Miss分支（2621）一致：閃避也視為未命中，觸發 on_invalid＋self_invalid，
          // 否則 self_invalid timer（深潛者／淨世／sobirat）遇到閃避不會被消耗。
          try { runSkillBlocks(getBattleEventContext(s, true, mIdx), "on_invalid", hasSkillHandler(activeSkill.name)); emitSelfInvalid(getBattleEventContext(s, true, mIdx)); } catch (e) { console.error("[blocks]", e); }
          const retry = failAction(s, mIdx, activeSkill, "evade", "閃避");
          await processQueue();
          if (!retry) return "partial";
          activeSkill = recalculatedSkill(activeSkill, retry); retryFailureKind = 'evade'; addEffectsInvalid = true;
        }
      }

      // ── 失明 blockSureHitDamage（2026-10-29）：必中技能也會「無法造成傷害且附加效果失效」。
      // 原本這個參數只寫在 statusRegistry，引擎完全沒讀取端，導致失明的必中分支無效。
      if (!retryFailureKind && activeSkill.category !== "屬性" && (activeSkill.isSureHit || activeSkill.alwaysHit)) {
        const blindSt = getStatuses(syncStateRef.current[s]) || {};
        const blindP = blindSt["失明"] ? StatusRegistry["失明"]?.mechanics?.find(m => m.type === "SPECIAL_BUFF")?.params : undefined;
        if (blindP?.blockSureHitDamage) {
          pushEffect({ type: "log", side: oppSide, data: { text: `🛡️ 【失明】：必中技能【${displaySkill}】無法造成傷害且附加效果失效！`, type: "effect" } });
          showPopup(oppSide, "Miss-0", "miss");
          addEffectsInvalid = true;
          try { runSkillBlocks(getBattleEventContext(s, true, mIdx), "on_invalid", hasSkillHandler(activeSkill.name)); emitSelfInvalid(getBattleEventContext(s, true, mIdx)); } catch (e) { console.error("[blocks]", e); }
          await processQueue();
          return "partial";
        }
      }

      // ── 攻擊免疫（攻擊技能未命中；必中無效；可被無視攻擊免疫貫穿；次數型只在擋下時消耗）
      if (!retryFailureKind && activeSkill.category !== "屬性") {
        const actorReg0 = syncStateRef.current[actorRegKey] || {};
        const ignoreSrc = ignoresAttackImmunity(syncStateRef.current[s], actorReg0, activeSkill, { addEffectsInvalid }) || ruleFlags.ignoreAttackImmunitySource || null;
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
          // 攻擊免疫＝未命中：與 Miss／閃避分支一致，觸發技能無效時（on_invalid）
          try { runSkillBlocks(getBattleEventContext(s, true, mIdx), "on_invalid", hasSkillHandler(activeSkill.name)); emitSelfInvalid(getBattleEventContext(s, true, mIdx)); } catch (e) { console.error("[blocks]", e); }
          const retry = failAction(s, mIdx, activeSkill, "immune", "攻擊免疫");
          await processQueue();
          if (!retry) return "partial";
          activeSkill = recalculatedSkill(activeSkill, retry); retryFailureKind = 'immune'; addEffectsInvalid = true;
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

      // ── 3.3 技能命中時 ──
      node('3.3', { side: s, order: mIdx });
      // ── 3.4 技能效果結算 ──
      node('3.4', { side: s, order: mIdx });
      skillWindowRef.current = { side: s, skillName: activeSkill.name };
      if (addEffectsInvalid && !retryFailureKind) {
        pushEffect({ type: 'log', side: s, data: { text: `🚫 【附加效果失效】：【${displayName}】的【${displaySkill}】${addEffectsInvalidReason}！`, type: "info" } });
        showPopup(oppSide, "附加效果失效", "addInvalid");
        // 共用語意入口仍須執行固有／攜帶效果；由來源路由過濾附加，不重跑舊專屬程式。
        const sourceCtx = getBattleEventContext(s, true, mIdx);
        sourceCtx.skill = activeSkill;
        (sourceCtx as any).additionalEffectsEnabled = false;
        runSkillBlocks(sourceCtx, "use", hasSkillHandler(activeSkill.name), false, "attached");
      } else if (!addEffectsInvalid && BattleSkillRegistry[activeSkill.name]) {
        BattleSkillRegistry[activeSkill.name](ctx);
      }
      // ── 3.4.1 寶石詞條：技能效果之後、造成傷害之前 ──
      if (isSkillStone(activeSkill)) {
        node('3.4.1', { side: s, order: mIdx });
        if (!addEffectsInvalid && !retryFailureKind) {
          try {
            const stoneCtx = getBattleEventContext(s, true, mIdx); (stoneCtx as any).skill = activeSkill;
            stoneAfterHitHandler(stoneCtx, { damageDealt: 0, killed: false, hit: true });
          } catch (e) { console.error("[skill stone]", e); }
        }
      }
      skillWindowRef.current = null;
      // 只等待前置效果完成；不改它們的邏輯時點。威力條件讀取吸取／恢復後的即時狀態。
      await processQueue();
      const damageCtx = getBattleEventContext(s, true, mIdx);
      (damageCtx as any).additionalEffectsEnabled = !addEffectsInvalid;
      activeSkill = transformSkillBeforeDamage(damageCtx, activeSkill);
      (ctx as any).skill = activeSkill;
      
      let mainDamageDealt = 0;
      let mainReduction:ReturnType<typeof damageReductionReceipt>|undefined;
      let mainSettledDamageForAction = 0;
      let mainIsCrit = false;
      let traced37 = false;
      if (activeSkill.category !== "屬性" && (activeSkill.power || Number(syncStateRef.current[actorRegKey]?.powerAddThisAction) > 0)) {
        const hitCount = Math.max(1, Math.floor(syncStateRef.current[actorRegKey]?.attackHitCountThisAction || 1)) +
          Math.max(0, Math.floor(syncStateRef.current[actorRegKey]?.attackBonusHitCountThisAction || 0));
        syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], attackHitCountThisAction: 0, attackBonusHitCountThisAction: 0 } };
        if (hitCount > 1) pushEffect({ type: 'log', side: s, data: { text: `【${displaySkill}】：${hitCount}連擊，合併為一次攻擊傷害結算。`, type: 'damage' } });
        // 連擊不是額外行動：單次計算×連擊次數（官方公式），只播一次動畫；每擊附帶判定於結算後依次數處理。
        for (let pass = 0; pass < 1; pass++) {
        if (checkElfDead(syncStateRef.current[s])) {
          // 攻擊方已被反擊等前置效果擊敗：不出傷害，僅補出招結果。
          void presentation.skippedAttack(oppSide, syncStateRef.current[oppSide], s, displaySkill);
          break;
        }
        // 對手已被前置效果擊敗時不放行中斷：傷害管線照算（各 hooks 僅改計算參數），
        // 於 3.6 以紅字顯示實際傷害、體力不落地（見下方 3.6 分支）。
        const currentActor = syncStateRef.current[s];
        const currentOpp = syncStateRef.current[oppSide];
        const blkCrit = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.crit);
        if (blkCrit && blkCrit.kind === "use_counter") getBattleEventContext(s, true, mIdx).consumeTimer?.(s, blkCrit.id);
        const receivedCrit = (syncStateRef.current[`${oppSide}Timers`] || []).find(t => t.remaining > 0 && !t.pendingActivation && t.payload?.incomingAttackCritical && (!t.ownerBattleId || t.ownerBattleId === (syncStateRef.current[oppSide].battleId || syncStateRef.current[oppSide].id)));
        if (receivedCrit?.kind==='use_counter') getBattleEventContext(oppSide, true, mIdx).consumeTimer(oppSide, receivedCrit.id);
        const isCritGuaranteed = !!receivedCrit || !!blkCrit || !!syncStateRef.current[actorRegKey]?.nextTurnCrit || !!syncStateRef.current[actorRegKey]?.mustCrit || !!syncStateRef.current[actorRegKey]?.[s + "_mustCrit"];        // 通用讀取端：「抵擋受到的致命一擊」（受方 block timer payload critBlock；arena_13 登場第3段等）——致命轉普通。
        const critBlocked = (syncStateRef.current[`${oppSide}Timers`] || []).some(t => t.remaining > 0 && !t.pendingActivation && t.payload?.block?.critBlock === true && (!t.ownerBattleId || t.ownerBattleId === (currentOpp.battleId || currentOpp.id)));

        // Check for ignoreSpDefCount
        const ignoreSpDefCount = syncStateRef.current[actorRegKey]?.ignoreSpDefCount || 0;
        let ignoreSpDefPercent = 0;
        let ignoreDefPercent = actionDefenseIgnore(syncStateRef.current[actorRegKey],currentActor,activeSkill,actionSerialRef.current);
        let ignoreOppBuff = false;
        const timedDefenseIgnore=findBlockTimer(syncStateRef.current[`${s}Timers`],b=>b.ignoreDefenseRatio>0);
        if(timedDefenseIgnore)ignoreDefPercent=Math.max(ignoreDefPercent,timedDefenseIgnore.payload.block.ignoreDefenseRatio);
        if (syncStateRef.current[actorRegKey]?.ignoreOppBuffTurns > 0 || syncStateRef.current[actorRegKey]?.ignoreOppBuffThisAction) {
           ignoreOppBuff = true;
        }
        if (syncStateRef.current[actorRegKey]?.ignoreDef25Turns > 0) {
           ignoreDefPercent = Math.max(ignoreDefPercent,0.25);
        }
        // 通用：N 回合內忽略對手雙防 X%（ignoreDefPercentTurns／Value；過去寫入但無讀取者）
        if (syncStateRef.current[actorRegKey]?.ignoreDefPercentTurns > 0) {
           ignoreDefPercent = Math.max(ignoreDefPercent, Number(syncStateRef.current[actorRegKey]?.ignoreDefPercentValue) || 0);
        }
        // 藏品對公式的靜態修正（relicEffectRegistry）
        ignoreDefPercent += relicIgnoreDefPercent(s === "p1" ? syncStateRef.current.p1Relics : syncStateRef.current.p2Relics, activeSkill.category);
        if (ignoreSpDefCount > 0 && activeSkill.category === "特殊") {
          ignoreSpDefPercent = syncStateRef.current[actorRegKey]?.ignoreSpDefPercent ?? 0.60;
          syncStateRef.current = {
            ...syncStateRef.current,
            [actorRegKey]: {
              ...syncStateRef.current[actorRegKey],
              ignoreSpDefCount: ignoreSpDefCount - 1
            }
          };
          pushEffect({ type: 'log', side: s, data: { text: `${syncStateRef.current[actorRegKey]?.ignoreSpDefSource ? `【${syncStateRef.current[actorRegKey].ignoreSpDefSource}】：` : ""}特殊攻擊忽略對手特防 ${Math.round(ignoreSpDefPercent * 100)}%！（剩餘 ${ignoreSpDefCount - 1} 次）`, type: "effect" } });
        }

        const dmgRes = calculateDamage(
          currentActor,
          currentOpp,
          activeSkill,
          s,
          p1Suit,
          p2Suit,
          (217 + rng() * (255 - 217)) / 255,
          (isCritGuaranteed && !critBlocked) ? true : undefined,
          mid.p1Team,
          mid.p2Team,
          { ignoreSpDefPercent, ignoreDefPercent, ignoreOppBuff, hitCount, actionId: actionSerialRef.current, inherentInvalid:!innateAllowed(damageCtx),
            critChanceBonus: Number(findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.critChanceBonus)?.payload?.block?.critChanceBonus || 0) },
          p1Title,
          p2Title,
          syncStateRef.current.p1RegistryState,
          syncStateRef.current.p2RegistryState,
          syncStateRef.current.p1Marks,
          syncStateRef.current.p2Marks
        );
        
        mainIsCrit = !!dmgRes.isCrit;
        syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], blkLastCrit: mainIsCrit } };
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

        if (isCritGuaranteed && !critBlocked) {
          pushEffect({ type: 'log', side: s, data: { text: `✨ 【必中致命一擊】：下回合致命一擊效果觸發！造成 2 倍傷害！`, type: "effect" } });
        } else if (isCritGuaranteed && critBlocked) {
          pushEffect({ type: 'log', side: oppSide, data: { text: `🛡️ 【致命抵擋】：致命一擊被抵擋，轉為普通傷害！`, type: "effect" } });
        }
        
        // Apply 5-stage damage computation
        // 增減傷分層見 battle/damagePipeline.ts：每個增傷來源各自相乘、翻倍為獨立乘區、減傷各自相乘。
        const damageComp: DamageComputation = createDamageComp({
          sourceSide: s,
          base: dmgRes.damage,
          increasePercent: 0,
          decreasePercent: 0,
          reductionPolicy: skillReductionPolicy(damageCtx,activeSkill,reductionPolicy(syncStateRef.current, oppSide, currentOpp, "skill_attack")),
          multiplier: 1.0,
          damageCategory: "skill_attack",
          attackDefenseBypass: attackDefenseBypass(currentActor, syncStateRef.current[actorRegKey] || {}, 'skill_attack'),
          skillType: activeSkill.type,
          skillCategory: activeSkill.category,
          isCrit: dmgRes.isCrit
        } as DamageComputation);
        // 套裝／稱號／刻印的「傷害提升／減少X%」（依描述歸增傷／減傷層）、寶石「傷害翻倍」（獨立乘區）
        {
          const eq = equipmentDamageFactors({ actor: currentActor, target: currentOpp, skill: activeSkill, side: s, isCrit: !!dmgRes.isCrit, p1Suit, p2Suit, p1Title, p2Title });
          for (const x of eq.increases) addDamageIncrease(damageComp, x.rate, x.group);
          for (const r of eq.reductions) addDamageReduction(damageComp, r);
          if (!(dmgRes as any).formulaReplaced && activeSkill.skillStoneDamageMultiplier && activeSkill.skillStoneDamageMultiplier !== 1) damageComp.multiplier *= activeSkill.skillStoneDamageMultiplier;
        }

        // 「當回合傷害提升」等由各魂印在 BEFORE_DAMAGE 自行加算（引擎不再重複處理）。
        // ── 3.5 造成傷害前 ──（基礎公式在此之前計算，3.4 的威力變化已套用）
        node('3.5', { side: s, order: mIdx });
        // Trigger actor's SoulMark BEFORE_DAMAGE
        if (SoulMarkRegistry[currentActor.name]) {
          const actorCtx = getBattleEventContext(s, true, mIdx);
          damageComp.isIncoming = false;
          SoulMarkRegistry[currentActor.name](actorCtx, EffectTiming.BEFORE_DAMAGE, Object.assign(damageComp, { damageComp }));
        }
        damageComp.isIncoming = false;
        triggerSuitEffect(s, EffectTiming.BEFORE_DAMAGE, { damageComp });
        applyMarkDamageReductions(damageComp, syncStateRef.current, oppSide, currentOpp);
        applyAdvancedDamageModifiers(damageComp, currentActor, currentOpp);
        applyAlienDoubleDamage(damageComp, currentActor, currentOpp);
        applyOutgoingSkillRestriction(damageComp, syncStateRef.current[actorRegKey] || {});
        
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

        // §3: Apply SPECIAL_BUFF damage modifiers (using existing actorStatuses/oppStatuses)
        
        applyStatusDamageModifiers(damageComp, currentActor, currentOpp);

        // Defender buffs（pure 獨立乘區時跳過通用增減傷；floor 保底類不受影響）
        if (!damageComp.pure) Object.keys(oppStatuses).forEach(stId => {
          const entry = StatusRegistry[stId];
          entry?.mechanics?.forEach(m => {
            if (m.type === 'SPECIAL_BUFF') {
              const p = m.params || {};
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

        // 通用特性／異能（屬性強化、堅硬、吸收、虛無、重傷…；pure 獨立乘區時跳過）
        if (!damageComp.pure) modifySkillDamage(currentActor, currentOpp, activeSkill, damageComp, getBattleEventContext(s, true, mIdx), rng,
          (text) => pushEffect({ type: 'log', side: s, data: { text, type: "effect" } }));

        // 印記：依持有者體力比例調整攻擊傷害（例如武誅：體力高於1/2時受到攻擊傷害提升、低於1/2時造成攻擊傷害降低）
        if (!damageComp.pure) {
          for (const mark of ((syncStateRef.current as any)[`${oppSide}Marks`] || []).filter((m: any) => markAppliesToElf(m, currentOpp))) {
            const k = mark.effects?.attackTakenMultAboveHalfHp;
            if (k != null && mark.count > 0 && currentOpp.currentHp > currentOpp.maxHp / 2) {
              if (k < 1) multiplyDamageReduction(damageComp, k); else damageComp.multiplier *= k;
            }
          }
          for (const mark of ((syncStateRef.current as any)[`${s}Marks`] || []).filter((m: any) => markAppliesToElf(m, currentActor))) {
            const k = mark.effects?.attackDealtMultBelowHalfHp;
            if (k != null && mark.count > 0 && currentActor.currentHp < currentActor.maxHp / 2) {
              if (k < 1) multiplyDamageReduction(damageComp, k, false); else damageComp.multiplier *= k;
            }
          }
        }

         // Calculate final result（pure 獨立乘區時跳過通用增減傷；floor／limit／mercy 不跳）
        if (activeConstraints(syncStateRef.current[`${s}Timers`], syncStateRef.current[s]).some(p => p.preventAttackDamage)) damageComp.multiplier = 0;
        const dmgDoubleTurns = syncStateRef.current[actorRegKey]?.dmgDoubleTurns > 0;
        if (!damageComp.pure && dmgDoubleTurns) damageComp.multiplier *= 2;

        const oppRegKeyDamage = oppSide === "p1" ? "p1RegistryState" : "p2RegistryState";
        const damageTakenBoostTurns = syncStateRef.current[oppRegKeyDamage]?.damageTakenBoostTurns > 0 || syncStateRef.current[oppRegKeyDamage]?.DamageBoostTurns > 0;
        if (!damageComp.pure && damageTakenBoostTurns) damageComp.multiplier *= 2;
        // 黯痕：持有者受到攻擊技能傷害翻倍
        if (!damageComp.pure && (syncStateRef.current[oppRegKeyDamage]?.DarkScarTurns || 0) > 0) damageComp.multiplier *= 2;
                const skillDamageBoost = syncStateRef.current[actorRegKey]?.skillDamageBoost;
        if (!damageComp.pure && skillDamageBoost) {
           damageComp.multiplier *= skillDamageBoost;
           syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], skillDamageBoost: 0 } };
        }
        // 通用狀態鍵（設在攻擊方）：「N回合內／下N回合 攻擊傷害提升X%」→ attackDamageBoostTurns＋attackDamageBoostRate
        //                          「下N次攻擊傷害提升X%」→ attackDamageBoostCharges＋attackDamageBoostChargeRate（每次攻擊消耗一次）
        // （設在受擊方）：「N回合內受到的攻擊傷害提升X%」→ attackTakenBoostTurns＋attackTakenBoostRate
        if (!damageComp.pure) {
          const aReg = syncStateRef.current[actorRegKey] || {};
          if (aReg.attackDamageBoostTurns > 0 && aReg.attackDamageBoostRate) addDamageIncrease(damageComp, Number(aReg.attackDamageBoostRate));
          // 「本場戰鬥造成的攻擊傷害提升X%」（個體鍵，跟著精靈保留）
          if (Number(aReg.battleDamageBoost) > 0) addDamageIncrease(damageComp, Number(aReg.battleDamageBoost));
          if (aReg.attackDamageBoostCharges > 0 && aReg.attackDamageBoostChargeRate) {
            addDamageIncrease(damageComp, Number(aReg.attackDamageBoostChargeRate));
            syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], attackDamageBoostCharges: aReg.attackDamageBoostCharges - 1 } };
          }
          const tReg = syncStateRef.current[oppRegKeyDamage] || {};
          if (tReg.attackTakenBoostTurns > 0 && tReg.attackTakenBoostRate) addDamageIncrease(damageComp, Number(tReg.attackTakenBoostRate));
        }
        
        finalizeDamageReductions(damageComp, syncStateRef.current, oppSide, currentOpp);
        // 固定加值（強攻＋80 等）直接加進公式結果，再吃增減傷
        const stage1 = (damageComp.base + (damageComp.bonusFixed || 0)) * (1 + damageComp.increasePercent) * Math.max(0, 1 - damageComp.decreasePercent);
        const stage2 = Math.max(0, stage1 * damageComp.multiplier - (damageComp.flatReduction || 0));
        applyAttackDefenseLimit(damageComp);
        const damageLimit200Turns = syncStateRef.current[actorRegKey]?.damageLimit200Turns > 0;
        let finalLimit = damageComp.limit !== undefined ? damageComp.limit : Infinity;
        if (damageLimit200Turns) finalLimit = Math.min(finalLimit, 200);
        
        // 通用：N 回合內受到的（單次）攻擊傷害不超過 X 點（incomingSkillDmgCap，設在受擊方）
        const oppRegCap = syncStateRef.current[oppRegKeyDamage] || {};
        if (!bypassesAttackDefense(damageComp, 'limit') && (oppRegCap.incomingSkillDmgCapTurns || 0) > 0 && oppRegCap.incomingSkillDmgCap !== undefined) {
          finalLimit = Math.min(finalLimit, oppRegCap.incomingSkillDmgCap);
        }
        if (syncStateRef.current[actorRegKey]?.blkIgnoreLimit || syncStateRef.current[actorRegKey]?.ignoreDamageLimitThisAction) {
          // 通用讀取端：「無視傷害限制成功」＝原上限確實存在（finite）且被無視鍵跳過；
          // 供「無視成功時→…」句式（cond ignore_success{what:'傷害限制'}）判讀，不含任何精靈專屬邏輯。
          if (finalLimit !== Infinity) syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...syncStateRef.current[actorRegKey], ignoreDamageLimitSucceededThisAction: true } };
          finalLimit = Infinity;
        }
        const stage3 = finalLimit !== Infinity ? Math.min(stage2, finalLimit) : stage2;
        let finalDamage = floorDamage(damageComp.floor !== undefined ? Math.max(stage3, damageComp.floor) : Math.max(0, stage3));
        if (damageComp.outgoingLimit !== undefined) finalDamage = Math.min(finalDamage, damageComp.outgoingLimit);
        // 追加技能傷害已獨立完成克制及增減傷，合併同一擊，不再套用主公式乘區。
        const attached = takeAttachedAttackDamage(getBattleEventContext(s, true, mIdx));
        finalDamage += attached.amount;
        if (attached.callbacks.length) {
          const callbacks = [damageComp.afterDamage, ...attached.callbacks].filter(Boolean);
          damageComp.afterDamage = receipt => callbacks.forEach(fn => fn(receipt));
        }
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
          
          pushEffect({ type: 'damage', side: oppSide, data: { amount: currentOppMaxHp, label: "恐懼真傷", popup: true, damageType: "true_damage", ledger: { kind: 'status', label: '恐懼', sourceSide: s, sourceBattleId: currentActor.battleId || currentActor.id, sourceName: currentActor.name } } });
        }
        
        // ── 3.6 造成技能傷害（紅傷） ──
        finalDamage=resolveDamageBlocking(damageComp,finalDamage);
        node('3.6', { side: s, order: mIdx });
        if (checkElfDead(syncStateRef.current[oppSide])) {
          // 前置效果已擊敗對手：主技能傷害只作顯示（紅字＝實際計算值），體力不落地、不觸發命中後結算。
          const fallen = syncStateRef.current[oppSide];
          presentation.record({ side: oppSide, elfId: fallen.battleId || fallen.id, type: 'skill',
            amount: finalDamage, delta: 0, before: 0, after: 0, maxHp: fallen.maxHp, alive: true,
            label: [dmgRes.isCrit ? "暴擊" : "", hitCount > 1 ? hitCount + "連擊" : ""].filter(Boolean).join(" ") || undefined,
            isCrit: dmgRes.isCrit, effectiveness: effectivenessLabel(dmgRes.typeMultiplier), sourceSide: s, skillName: displaySkill });
          break;
        }
        mainReduction=damageReductionReceipt(damageComp);
        mainHitRef.current = { hpReduced: 0 };
        const ignoreShieldThisAction = !!(damageComp.attackDefenseBypass?.shield || syncStateRef.current[actorRegKey]?.ignoreImmunityAndShield || syncStateRef.current[actorRegKey]?.blkIgnoreShield || syncStateRef.current[actorRegKey]?.ignoreShieldThisAction);
        pushEffect({ type: 'damage', side: oppSide, data: { amount: finalDamage, onSettled: damageComp.afterDamage, popup: true, isCrit: dmgRes.isCrit, label: [dmgRes.isCrit ? "暴擊" : "", hitCount > 1 ? `${hitCount}連擊` : ""].filter(Boolean).join(" "), sourceElfName: currentActor.name, sourceSide:s, sourceBattleId:currentActor.battleId||currentActor.id, skillName: displaySkill, skillPower: activeSkill.power, typeMultiplier: dmgRes.typeMultiplier, damageType: "skill_attack", attackDefenseBypass: damageComp.attackDefenseBypass, reductionPolicy: damageComp.reductionPolicy, ignoreShield: ignoreShieldThisAction, mainSkillHit: true, ledger: { kind: 'skill', label: activeSkill.name } } });
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
          pushEffect({ type: 'damage', side: oppSide, data: { amount: fixedDmg, popup: true, label: "稱號固傷", damageType: "fixed", ledger: { kind: 'title', label: aTitleDef.name, sourceSide: s, sourceBattleId: currentActor.battleId || currentActor.id, sourceName: currentActor.name } } });
          pushEffect({ type: 'log', side: s, data: { text: `🌊 【${aTitleDef.name}】：攻擊命中附加 ${fixedDmg} 點固定傷害！`, type: "effect" } });
        }

        // §47: Generic Suit Effects
        const oppSuitId = oppSide === "p1" ? p1Suit : p2Suit;
        const oppSuitDef = oppSuitId ? SUIT_CATALOG[oppSuitId] : undefined;
        if (oppSuitDef?.effects?.reflectDamagePercent && finalDamage > 0) {
          const reflectDmg = Math.floor(finalDamage * oppSuitDef.effects.reflectDamagePercent);
          pushEffect({ type: 'damage', side: s, data: { amount: reflectDmg, popup: true, label: "反射", damageType: "fixed", ledger: { kind: 'reflect', label: oppSuitDef.name, sourceSide: oppSide, sourceBattleId: currentOpp.battleId || currentOpp.id, sourceName: currentOpp.name } } });
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
        // ── 3.7 技能命中後／造成技能傷害後 ──
        node('3.7', { side: s, order: mIdx }); traced37 = true;
        for (let hitIndex = 0; !retryFailureKind && hitIndex < hitCount; hitIndex++) {
          if (checkElfDead(syncStateRef.current[s])) break; // 攻擊方已倒下（如被反擊致死）不再結算每擊效果
          const hitCtx = getBattleEventContext(s, true, mIdx);
          // 傷害只記在第一擊（總量），其餘擊只做每擊判定
          SoulMarkRegistry[hitCtx.self.name]?.(hitCtx, EffectTiming.AFTER_ATTACK_HIT, { skill: activeSkill, hitIndex, hitCount, damage: hitIndex === 0 ? finalDamage : 0, totalDamage: finalDamage, additionalEffectsEnabled: !addEffectsInvalid });
        }
        mainDamageDealt = mainHitRef.current?.hpReduced ?? 0;
        const mainSettledDamage = mainHitRef.current?.settledAmount ?? finalDamage;
        mainSettledDamageForAction=mainSettledDamage;
        const settlementCtx = getBattleEventContext(s, true, mIdx);
        (settlementCtx as any).skill = activeSkill;
        TraitsEngine.triggerSkillDamageSettled(settlementCtx, mainSettledDamage);
        mainHitRef.current = null;
        // ON_SKILL_HIT：攻擊方主技能傷害結算後（每次出手一次）
        if (!retryFailureKind && !checkElfDead(syncStateRef.current[s]) && SoulMarkRegistry[syncStateRef.current[s].name]) {
          try {
            SoulMarkRegistry[syncStateRef.current[s].name](getBattleEventContext(s, true, mIdx), EffectTiming.ON_SKILL_HIT,
              { skill: activeSkill, isCrit: mainIsCrit, damage: mainDamageDealt, finalDamage, settledDamage: mainSettledDamage, killed: checkElfDead(syncStateRef.current[oppSide]), targetSide: oppSide, attackerSide: s });
          } catch (e) { console.error("[ON_SKILL_HIT]", e); }
        }
        await processQueue();
        }
      }

      await processQueue();
      // ── 3.7 使用技能後（屬性技能／未造成傷害時在此標記） ──
      if (!traced37) node('3.7', { side: s, order: mIdx });
      if (addEffectsInvalid && !retryFailureKind) {
        const sourceCtx = getBattleEventContext(s, true, mIdx);
        sourceCtx.skill = activeSkill;
        sourceCtx.mainSkillHpReduced = mainDamageDealt;
        sourceCtx.mainSkillReduction=mainReduction;
        (sourceCtx as any).additionalEffectsEnabled = false;
        runSkillBlocks(sourceCtx, "after_hit", hasSkillHandler(activeSkill.name));
      }
      if (!addEffectsInvalid) {
        const ahCtx = getBattleEventContext(s, true, mIdx);
        ahCtx.skill = activeSkill;
        ahCtx.mainSkillHpReduced = mainDamageDealt;
        ahCtx.mainSkillReduction=mainReduction;
        const hasH = isSkillStone(activeSkill) || hasSkillHandler(activeSkill.name);
        const { unparsedLines } = runSkillBlocks(ahCtx, "after_hit", hasH);
        if (!hasH && unparsedLines.length) {
          const c2 = Object.create(ahCtx); c2.skill = { ...ahCtx.skill, description: unparsedLines.join("\n") };
          executeGenericSkillTextAfterHit(c2);
        }
        // 技能專屬命中結算後處理（*_AFTER_HIT）：此時已能讀到結算後體力與是否擊敗
        // 寶石詞條已在 3.4.1 結算，這裡不重跑。
        const afterHit = isSkillStone(activeSkill) ? undefined : getBattleSkillAfterHitRegistry()[activeSkill.name];
        if (afterHit) {
          try {
            const c3 = getBattleEventContext(s, true, mIdx); (c3 as any).skill = activeSkill;
            afterHit(c3, { damageDealt: mainDamageDealt, killed: checkElfDead(syncStateRef.current[oppSide]), hit: true });
          } catch (e) { console.error("[AFTER_HIT]", e); }
          await processQueue();
        }
      }
      try { emitSkillUse(getBattleEventContext(s, true, mIdx), getBattleEventContext(oppSide, true, mIdx), activeSkill, true, {
        actor: s, skill: activeSkill, category: activeSkill.category, damageDealt: mainDamageDealt,
        isCrit: !retryFailureKind && mainIsCrit, hit: !retryFailureKind,
        additionalEffectsEnabled: !addEffectsInvalid,
        invalid: retryFailureKind === 'invalid', failKind: retryFailureKind,
        killed: checkElfDead(syncStateRef.current[oppSide]),
      }); } catch (e) { console.error("[blocks]", e); }
      {
        const bp = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.prio != null && b && !(b.attackOnly && activeSkill.category === "屬性"));
        if (bp && bp.kind === "use_counter" && bp.payload.block.startAfterActionId!==actionSerialRef.current) getBattleEventContext(s, true, mIdx).consumeTimer?.(s, bp.id);
        const dm = findBlockTimer((syncStateRef.current as any)[`${s}Timers`], b => b.dmgOut != null && !(b.kind === "攻擊" && activeSkill.category === "屬性"));
        if (dm && dm.kind === "use_counter" && activeSkill.category !== "屬性") getBattleEventContext(s, true, mIdx).consumeTimer?.(s, dm.id);
        {
          const rg = syncStateRef.current[actorRegKey] || {};
          let uses = rg.blkTypeOverrideUses || 0;
          if (rg.blkTypeOverrideExtend && !checkElfDead(syncStateRef.current[oppSide])) uses = rg.blkTypeOverrideExtend;
          // 通用：attackTypeOverrideUses 以實際出手的攻擊技能計次
          const typeOvUses = (rg.attackTypeOverrideUses || 0) > 0 && activeSkill.category !== "屬性" ? rg.attackTypeOverrideUses - 1 : rg.attackTypeOverrideUses;
syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...rg, attackTypeOverrideUses: typeOvUses, blkIgnoreLimit: false, blkIgnoreBlock: false, blkIgnoreShield: false, ignoreDamageLimitThisAction: false, fixedTypeMultThisAction: 0, ignoreAttackImmunityThisAction: false, ignoreShieldThisAction: false, ignoreOppBuffThisAction: false, oppBoostAsDropThisAction: false, selfDropAsOppDropThisAction: false, blkAtkSpatkSum: false, blkAtkSpAtkSum: false, grantStabThisAction: false, minimumTypeMultiplierThisAction: undefined, blkLastCrit: false, blkStageAsBoost: 0, blkTypeOverrideUses: uses, blkTypeOverrideExtend: 0, blkTypeOverrideCurrentAction: false } };
        }
      }

      notifyActionResult(s, mIdx, { actor: s, skill: activeSkill, category: activeSkill.category, isCrit: !retryFailureKind && mainIsCrit, damageDealt: mainDamageDealt, settledDamage:mainSettledDamageForAction, hit: !retryFailureKind, additionalEffectsEnabled: !addEffectsInvalid, invalid: retryFailureKind === 'invalid', failKind: retryFailureKind, killed: checkElfDead(syncStateRef.current[oppSide]) }, !!retryFailureKind);
      if (retryFailureKind) clearPerActionFlags(s);
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
      
      // 本次行動限定的吸血／威力倍率／增傷：在陣亡判定前清理（擊倒對手時 checkFaints 會提前 return，過去導致殘留到下次行動）
      {
        const rg = syncStateRef.current[actorRegKey] || {};
        if (rg.vampireRatio || (rg.powerMultiplierThisAction ?? 1) !== 1 || !!rg.powerAddThisAction || (rg.damageModifiersThisAction || []).length || rg.vampireDamageTypesThisAction) {
          const clean = { vampireDamageTypesThisAction: undefined, damageModifiersThisAction: [], powerMultiplierThisAction: 1, powerAddThisAction: 0, vampireRatio: 0 };
          syncStateRef.current = { ...syncStateRef.current, [actorRegKey]: { ...rg, ...clean } };
          dispatch({ type: 'UPDATE_REGISTRY_STATE', side: s, state: clean });
        }
      }
      return "full";

    };
    for (const [mIdx, s] of actors.entries()) {
      if (operated.has(s)) continue; // 已在 1.2 操作階段切換／使用藥劑
      await processQueue();
      presentation.setInAction(true); // 出手流程：紅字即時播
      // 3.1–3.7：本次出手（"partial"＝未成功出手或提前結束；"full"＝走完整個出手與收尾）
      const outcome=await executeSkillUse(s,mIdx);

      const replayContext=getBattleEventContext(s,true,mIdx),request=replayContext.getPlayerState('pendingSkillRepeats');
      replayContext.setPlayerState('pendingSkillRepeats',undefined);
      if(request&&request.actionId===actionSerialRef.current&&request.ownerBattleId===(syncStateRef.current[s].battleId||syncStateRef.current[s].id)){
        replayContext.setPlayerState('executingSkillRepeat',true);
        try{for(let i=0;i<Math.min(10,request.times);i++){
          if(checkElfDead(syncStateRef.current[s])||checkElfDead(syncStateRef.current[s==='p1'?'p2':'p1']))break;
          await executeSkillUse(s,mIdx,true);await processQueue();
        }}finally{getBattleEventContext(s,true,mIdx).setPlayerState('executingSkillRepeat',false);}
      }
      resolutionSkillRef.current=null;
      // 3.8 出手流程結束時／3.9 出手流程結束後（額外行動；對手已倒下仍執行＝可鞭屍）
      await endOfAction(s, mIdx);
      // 3.10 死亡節點一：出手流程（含額外行動）全部結束後才判定
      const faintsResult = await checkFaints(s, true, 1);
      if (faintsResult) {
        if (faintsResult !== "game_over") await finalizeTurn();
        return;
      }
      if (outcome !== "full") continue;
      const actorRegKey = s === "p1" ? "p1RegistryState" : "p2RegistryState";

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
           powerMultiplierThisAction: 1, powerAddThisAction: 0,
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
           state: { vampireDamageTypesThisAction: undefined, damageModifiersThisAction: [], powerMultiplierThisAction: 1, powerAddThisAction: 0, forceHitEffectsThisAction: false, forcedHitThisAction: false, vampireRatio: 0, nextTurnPriority: 0, nextTurnCrit: false, ignoreImmunityAndShield: false }
         });
       }

    }

    await processQueue();
    presentation.setInAction(false);

    // 安全網：Miss／技能無效等提前 continue 的路徑會跳過該次行動後的陣亡判定
    //（例如命中前的汲取把對手打到 0 後技能 Miss），在此補做，避免卡在 resolving
    if (checkElfDead(syncStateRef.current.p1) || checkElfDead(syncStateRef.current.p2)) {
      const fr = await checkFaints(actors[actors.length - 1], true, 1);
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
  const validatingRef = ref(false);
  const autoFinalizedTurnRef = ref(-1);
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
        if (props.selectAi && !props.simulation) { requestForcedAI(side); return; }
        let idx = pickAiForcedSwitch(st, side, p1Suit, p2Suit, rng);
        if (idx === -1) {
          // AI 只看 currentHp>0；「死亡條件不受體力限制」的精靈 0 血仍可上場，補上後備選擇
          const team = side === "p1" ? st.p1Team : st.p2Team;
          const cur = side === "p1" ? st.p1ActiveIndex : st.p2ActiveIndex;
          idx = team.findIndex((e, i) => i !== cur && !e.isExtra && !checkElfDead(e));
        }
        if (idx !== -1) { onSwitchElf(side, idx); return; }
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
      finalizeTurn().catch(e => {
        console.error("[finalizeTurn]", e);
        props.onSimulationError?.(e);
        if (props.simulation) unmount();
      }).finally(() => {
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
      resolveTurn().catch(e => {
        console.error("[resolveTurn]", e);
        props.onSimulationError?.(e);
        if (props.simulation) unmount(); // 沙盒分支失敗不可重新提交同一招形成循環
        else {
          // 正式對戰也不能自動重送已部分結算的行動，否則反覆扣PP、重播攜帶效果。
          dispatch({type:'SET_AUTO_BATTLE',isAuto:false});
          for(const side of ['p1','p2'] as const) {
            dispatch({type:'SET_SKILL',side,skill:null});
            dispatch({type:'SET_ITEM',side,item:null});
            dispatch({type:'SET_SWITCH_INDEX',side,index:null});
          }
          resolutionSkillRef.current=null;
          skillWindowRef.current=null;
          dispatch({type:'SET_PHASE',phase:'p1_select'});
          dispatch({type:'ADD_LOG',log:{turn:syncStateRef.current.turnNumber,text:'⚠️ 結算發生錯誤，已停止自動重試與託管。狀態可能只結算了一部分，請重開對戰；不會自動再次扣除PP。',type:'info'}});
        }
      }).finally(() => {
        isResolvingRef.current = false;
        scheduleBattleTask(() => validateIdleRef.current(), 0);
      });
    }
  };

  /** 1.1 戰鬥開始／1.3 首發登場（每局一次）。 */
  const start = () => {
    if (hasInitialEntranceRef.current) return;
    hasInitialEntranceRef.current = true;
    (async () => {
      node('1.1');
      // 正式開局通知不借首發登場，場下魂印／特質／攜帶圖紙同樣取得一次開局事件。
      for(const side of ['p1','p2'] as const)for(const owner of syncStateRef.current[`${side}Team`]){
        if(checkElfDead(owner)||owner.isVanished||owner.isExtra)continue;
        SoulMarkRegistry[owner.name]?.(getBattleEventContext(side,true,undefined,owner),EffectTiming.BATTLE_START);
      }
      for (const side of ["p1", "p2"] as const) runTitleEffects(getBattleEventContext(side), side === "p1" ? p1Title : p2Title, EffectTiming.BATTLE_START);
      for (const side of ["p1", "p2"] as const) {
        const cur = syncStateRef.current;
        const team = side === "p1" ? cur.p1Team : cur.p2Team;
        const activeIdx = side === "p1" ? cur.p1ActiveIndex : cur.p2ActiveIndex;
        const starter = team[activeIdx];
        if (!starter || checkElfDead(starter)) continue;
        node('1.3', { side });
        const ctx = getBattleEventContext(side, true, undefined, undefined, true);
        TraitsEngine.triggerOnEntrance(ctx);
        if (SoulMarkRegistry[starter.name]) {
          SoulMarkRegistry[starter.name](ctx, EffectTiming.ON_ENTRANCE);
        }
        applyEntranceBlessings(side, starter, ctx);
        triggerSuitEffect(side, EffectTiming.ON_ENTRANCE);
        broadcastElfEntered(side, starter.id);
      }
      // DSH 20261020 修復：第 1 回合的「回合開始時」必須在開局派發（與 resolveTurn 相同的
      // 全隊 ROUND_START/ENFORCE 廣播＋turnsInBattle 初始化，不含回合結束的狀態 tick）。
      // 雷伊「回合開始複製強化」、次元龍詩章等首回合觸發由此恢復；resolveTurn 首輪跳過防雙跑。
      for (const rule of battleRules()) rule.roundStart?.(ruleApi, syncStateRef.current);
      for (const side0 of ["p1", "p2"] as const) {
        const cur0 = syncStateRef.current;
        const fieldCtx0 = getBattleEventContext(side0, false, 0, cur0[side0]);
        fieldCtx0.setPlayerState(`${side0}_turnsInBattle`, 1);
        const team0 = side0 === "p1" ? cur0.p1Team : cur0.p2Team;
        team0.forEach(elf0 => {
          if (checkElfDead(elf0) && !hasLivingSummonedExtra(team0, elf0)) return;
          if (SoulMarkRegistry[elf0.name]) {
            const ctx0 = getBattleEventContext(side0, false, 0, elf0);
            SoulMarkRegistry[elf0.name](ctx0, EffectTiming.ROUND_START);
            SoulMarkRegistry[elf0.name](ctx0, EffectTiming.ENFORCE);
          }
          triggerSuitEffect(side0, EffectTiming.ROUND_START);
        });
      }
      openingRoundStartDoneRef.done = true;
      await processQueue();
    })();
  };

  const onSkillSelect = (side: "p1" | "p2", skill: Skill) => {
    if (!battleAliveRef.current) return;
    const cur = latestStateRef.current;
    if (cur.phase !== (side === 'p1' ? 'p1_select' : 'p2_select')) return;
    const slot = skillSlot(cur[side],skill);
    const waiting = slot < 0 && skill.name === '等待' && legalActions(cur, side).every(a => a.kind === 'wait');
    if (!waiting && !skillSelectable(cur, side, cur[side], slot)) return;

    // 合法選招即生效；不延後到可能因受控而被跳過的出手流程。
    SoulMarkRegistry[cur[side].name]?.(getBattleEventContext(side, true, 0), EffectTiming.SKILL_SELECTED, { skill: { ...skill, battleSlot: slot } });
    statusSkillSelected(getBattleEventContext(side,true,0),skill,slot);

    // 選擇技能時立即點亮與激活符文
    const actorElf = side === 'p1' ? cur.p1 : cur.p2;
    if (actorElf && actorElf.skills) {
      const idx = slot;
      if (idx !== -1) {
        activateRuneOnSkillSelect(actorElf, idx, (msg, type) => {
          pushEffect({ type: 'log', side, data: { text: msg, type: type as any } });
        });
      }
    }

    if (syncStateRef.current.phase === "p1_select" && side === "p1") {
      dispatch({ type: 'SET_SKILL', side: 'p1', skill });
      if (battleMode === "PVE") {
        void chooseP2AndResolve();
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
    const expected = side === 'p1' ? 'p1_select' : 'p2_select';
    const forcedForSide = cur.phase === `forced_switch_${side}` || cur.phase === 'forced_switch_both';
    if (cur.phase !== expected && !forcedForSide) return;
    if (index === cur[`${side}ActiveIndex`]) return;
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
    if (activeConstraints(timers, cur[side]).some(p => p.lockSwitch === true)) {
      if (!syncStateRef.current.phase.startsWith("forced_switch")) {
        pushEffect({ type: 'log', side, data: { text: `🚫 此刻無法切換精靈！`, type: "system" } });
        return;
      }
    }

    if (syncStateRef.current.phase.startsWith("forced_switch")) {
      const outgoingElf = cur[side];
      if (outgoingElf && SoulMarkRegistry[outgoingElf.name]) {
        const outCtx = getBattleEventContext(side, true, 0);
        SoulMarkRegistry[outgoingElf.name](outCtx, EffectTiming.BEFORE_SWITCH_OUT, { incomingElf: targetElf, forced: true });
        SoulMarkRegistry[outgoingElf.name](getBattleEventContext(side, true, 0), EffectTiming.ON_SWITCH_OUT, { incomingElf: targetElf, forced: true });
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
      const fieldShieldTotal=(syncStateRef.current.p1.shield||0)+(syncStateRef.current.p2.shield||0);
      syncStateRef.current = switchBattleSide(syncStateRef.current, side, index);
      getBattleEventContext(side).setPlayerState('entryFieldShieldTotal',fieldShieldTotal);

      const newCtx = getBattleEventContext(side);
      TraitsEngine.triggerOnEntrance(newCtx);
      if (SoulMarkRegistry[targetElf.name]) {
        SoulMarkRegistry[targetElf.name](newCtx, EffectTiming.ON_ENTRANCE);
      }
      applyEntranceBlessings(side, targetElf, newCtx);
      triggerSuitEffect(side, EffectTiming.ON_ENTRANCE);
      broadcastElfEntered(side, targetElf.id);

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
          void chooseP2AndResolve();
        } else {
          dispatch({ type: 'SET_PHASE', phase: "p2_select" });
        }
      } else {
        dispatch({ type: 'SET_PHASE', phase: "resolving" });
      }
    }
  };

  const onUseItem = (side: "p1" | "p2", item: BattleItem) => {
    if (!battleAliveRef.current) return;
    const curForItems = latestStateRef.current;
    const expectedPhase = side === 'p1' ? 'p1_select' : 'p2_select';
    const catalogItem = BATTLE_ITEMS.find(candidate => candidate.id === item.id);
    if (curForItems.phase !== expectedPhase || !catalogItem) return;
    // 需要先選對象的道具：以目錄定義為準，所選精靈必須在當前雙方背包內且未消逝。
    if (catalogItem.pickTarget && !(item.picked && findBagElf({ p1: curForItems.p1Team, p2: curForItems.p2Team }, item.picked.side, item.picked.battleId))) {
      pushEffect({ type: 'log', side, data: { text: '請先選擇背包內未消逝的精靈。', type: 'effect' } }); return;
    }
    if (!hasBattleItem(curForItems[`${side}ItemInventory`], item.id)) {
      pushEffect({ type: 'log', side, data: { text: '該藥劑已用盡。', type: 'effect' } }); return;
    }

    // §40-1: Check if item usage is disabled by status
    if (isElfItemDisabled(curForItems[side])) {
      pushEffect({ type: 'log', side, data: { text: `🚫 受到異常狀態影響，無法使用道具！`, type: "system" } });
      return;
    }

    // 星際探索：每次使用道具消耗 1 次藥劑；用盡即鎖定（只影響此模式）。「特殊」欄位保留，不計次、不鎖定。
    if (side === "p1" && props.interstellarOptions?.onPotionUse && item.type !== "special") {
      if (!props.interstellarOptions.onPotionUse()) { pushEffect({type:"log",side,data:{text:"藥劑次數已用盡。",type:"effect"}}); return; }
      props.onPotionUsed?.();
    }
    dispatch({ type: 'SET_ITEM', side, item: catalogItem.pickTarget ? { ...catalogItem, picked: item.picked } : item });
    dispatch({ type: 'SET_SKILL', side, skill: { name: "使用道具", type: "無", category: "屬性", power: 0, pp: 0, priority: 6 } });
    
    if (side === 'p1') {
      if (battleMode === "PVE") {
        void chooseP2AndResolve();
      } else {
        dispatch({ type: 'SET_PHASE', phase: "p2_select" });
      }
    } else {
      dispatch({ type: 'SET_PHASE', phase: "resolving" });
    }
  };

  // ── 狀態提交後的反應（取代原本 React useEffect 依 phase 觸發的驅動）──
  // 原本這些在 render 後依「畫面看到的 phase」觸發；現在依每次整批提交的狀態觸發，順序與條件相同。
  let lastReact: { phase?: string; auto?: boolean; winner?: any } = {};
  let autoBattleTimer: ReturnType<typeof setTimeout> | undefined;
  function commitState(value: BattleState) {
    props.onStateCommit?.(value);
    void presentation.stage(value); // 畫面依播放進度切換到這份狀態
    scheduleBattleTask(() => reactToCommit(), 0);
  }
  function reactToCommit() {
    const st = syncStateRef.current;
    const prev = lastReact;
    const phase = st.phase, auto = !!st.isAutoBattle, winner = st.winner;
    lastReact = { phase, auto, winner };
    // 結算：以即時狀態判斷，避免同一回合被重複結算
    if (phase === "resolving") startResolveRef.current();
    // T0-6：自動戰鬥（P1 托管）
    if (prev.phase !== phase || prev.auto !== auto || prev.winner !== winner) {
      if (autoBattleTimer) { clearTimeout(autoBattleTimer); battleTimeoutsRef.current.delete(autoBattleTimer); autoBattleTimer = undefined; }
      if (auto && !winner && phase === "p1_select") autoBattleTimer = scheduleBattleTask(async () => {
        autoBattleTimer = undefined;
        await presentation.wait(); // 托管：等畫面播完上一回合再出手
        if (!battleAliveRef.current || syncStateRef.current.phase !== "p1_select" || !syncStateRef.current.isAutoBattle) return;
        const action = await chooseAI('p1');
        if (!action || !battleAliveRef.current || syncStateRef.current.phase !== 'p1_select' || !syncStateRef.current.isAutoBattle) return;
        if (action.type === 'skill') onSkillSelect('p1', action.skill!);
        else if (action.type === 'switch') onSwitchElf('p1', action.switchIndex!);
        else if (action.type === 'item' && action.item) onUseItem('p1', action.item);
        // 托管保底：選擇被拒（道具用盡、技能受限等）時改用第一個可用技能，避免卡在選擇階段
        if (syncStateRef.current.phase === "p1_select" && battleAliveRef.current) {
          const me = syncStateRef.current.p1;
          const usable = (me?.skills || []).find((_, slot) => skillSelectable(syncStateRef.current, 'p1', me, slot));
          if (usable) onSkillSelect('p1', usable);
        }
      }, 400);
    }
    if (prev.phase === phase && prev.auto === auto) return;
    // T0-8：換人階段但雙方都活著 → 收尾
    if (phase.startsWith("forced_switch")) {
      const cur = latestStateRef.current;
      if (!checkElfDead(cur.p1) && !checkElfDead(cur.p2)) completeForcedSwitchRef.current();
    }
    // PVE：P2 AI 強制換人
    if ((phase === "forced_switch_p2" || phase === "forced_switch_both") && battleMode === "PVE") {
      const cur = latestStateRef.current;
      if (checkElfDead(cur.p2)) {
        if (props.selectAi && !props.simulation) { requestForcedAI('p2'); return; }
        const nextIdx = pickAiForcedSwitch(cur, 'p2', p1Suit, p2Suit, rng);
        if (nextIdx !== -1) onSwitchElf('p2', nextIdx);
      }
    }
    // 托管：P1 強制換人
    if ((phase === "forced_switch_p1" || phase === "forced_switch_both") && auto) {
      const cur = latestStateRef.current;
      if (checkElfDead(cur.p1)) {
        if (props.selectAi && !props.simulation) { requestForcedAI('p1'); return; }
        const nextIdx = pickAiForcedSwitch(cur, 'p1', p1Suit, p2Suit, rng);
        if (nextIdx !== -1) onSwitchElf('p1', nextIdx);
      }
    }
  }

  function node(id: BattleNodeId, detail?: Record<string, unknown>) {
    try { props.onNode?.(id, detail); } catch (e) { console.error("[onNode]", e); }
  }

  const idle = async () => {
    for (let i = 0; i < 2000; i++) {
      await new Promise(r => setTimeout(r, 0));
      if (!battleAliveRef.current) return;
      if (!pendingAi && !isResolvingRef.current && !processingPromiseRef.current && !validatingRef.current && battleTimeoutsRef.current.size === 0 && effectQueueRef.current.length === 0) return;
    }
  };

  return {
    getState: () => syncStateRef.current,
    dispatch, pushEffect, presentation, ledger,
    onSkillSelect, onSwitchElf, onUseItem,
    start, mount, unmount,
    isAlive: () => battleAliveRef.current,
    idle,
  };
}
