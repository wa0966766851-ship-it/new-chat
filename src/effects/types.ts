import { Elf, Skill, BattleLog, BattleItem, BattleEffect, EffectSubCategory } from "../types";
import { Timer } from "../battle/timers";
import { Mark } from "../battle/marks";
import type { SettlementOptions } from '../battle/settlementReceipt';
import type {StatusOrigin} from '../battle/statusOrigin';

export enum EffectTiming {
  SKILL_SELECTED = "SKILL_SELECTED",
  /** 開局1.1：通知雙方存活的完整出戰背包持有者，先於首發登場；每場一次。 */
  BATTLE_START = "BATTLE_START",
  BEFORE_DAMAGE = "BEFORE_DAMAGE",
  /**
   * 受到傷害後（任何傷害類別，HP 結算之後）：派發給「受到傷害的精靈」魂印（ctx.actor＝受擊方）。
   * data: { side, targetSide, attackerSide, sourceSide, amount, damage, hpReduced, damageType('skill_attack'|'fixed'|'percent'|'true' 或技能子類), rawDamageType, label, isIncoming: true }
   * 與 ON_DAMAGED 同時點、同 payload；ON_DAMAGED 為舊名，新 handler 兩者擇一即可（勿重複處理）。
   */
  AFTER_DAMAGE = "AFTER_DAMAGE",
  AFTER_ATTACK_HIT = "AFTER_ATTACK_HIT",
  MODIFY_POWER = "MODIFY_POWER",
  BEFORE_STATUS_TICK = "BEFORE_STATUS_TICK",
  ON_STATUS_ENDED = "ON_STATUS_ENDED",
  SELF_STATUS_APPLIED = "SELF_STATUS_APPLIED",
  ON_ENTRANCE = "ON_ENTRANCE",
  BEFORE_ACTION = "BEFORE_ACTION",
  /** 對手出手流程開始（技能結算前）：派發給非行動方魂印。data: { skill, side（行動方） } */
  OPPONENT_ACTION = "OPPONENT_ACTION",
  /**
   * 自身技能結算完成（主傷害、陣亡標記、after-hit 之後；僅限成功出手，未命中／無效走 ACTION_FAILED）。
   * 派發給行動方魂印（ctx.actor＝行動方）。data: ActionResultInfo
   */
  AFTER_ACTION = "AFTER_ACTION",
  /**
   * 對手技能結算完成後（含未命中／無效，以 data.hit／data.invalid 區分）：派發給非行動方在場魂印，
   * 用於「對手使用攻擊技能後…」類效果。ctx.actor＝收到通知的一方。data: ActionResultInfo（actor＝對手）
   */
  OPPONENT_AFTER_ACTION = "OPPONENT_AFTER_ACTION",
  /** 在場精靈的護盾由 >0 變為 0（被打破或被消除）：派發給持有方。data: { before } */
  SHIELD_BROKEN = "SHIELD_BROKEN",
  /** 護盾或護罩由正值歸零；不改變舊護盾事件範圍。 */
  HELD_RESOURCE_LOST = "HELD_RESOURCE_LOST",
  /**
   * 自身技能未成功出手（技能無效／未命中／被閃避／攻擊免疫）：派發給行動方魂印，取代 AFTER_ACTION，
   * 用於清理 BEFORE_SKILL／BEFORE_ACTION 設下的「本次行動」旗標。data: ActionResultInfo（hit=false）
   */
  ACTION_FAILED = "ACTION_FAILED",
  ACTION_END = "ACTION_END",
  EXTRA_ACTION_START = "EXTRA_ACTION_START",
  EXTRA_ACTION_END = "EXTRA_ACTION_END",
  ROUND_START = "ROUND_START",
  ROUND_END = "ROUND_END",
  FATAL_RESIST = "FATAL_RESIST",
  ON_KILL = "ON_KILL",
  /** 主動切換精靈時，在 ON_SWITCH_OUT 之前派發給下場精靈魂印。data: { incomingElf } */
  BEFORE_SWITCH_OUT = "BEFORE_SWITCH_OUT",
  ON_SWITCH_OUT = "ON_SWITCH_OUT",
  /** 受到傷害後（同 AFTER_DAMAGE 的 payload；damageType 一律正規化）。另會通知部分「對手受擊」觀察者。 */
  ON_DAMAGED = "ON_DAMAGED",
  OPPONENT_DAMAGE = "OPPONENT_DAMAGE",
  /**
   * 6.2 被擊敗時：派發給剛陣亡的在場精靈（及模式事件）。死亡節點一／二／三哪個先看到陣亡就由哪個派發，
   * data.node＝1｜2｜3。歷史名稱保留，現有 handler 都以此為「被擊敗時」。
   */
  DEATH_NODE_1 = "DEATH_NODE_1",
  /** 舊名，引擎不派發（死亡節點二請讀 DEATH_NODE_1 的 data.node === 2）。 */
  DEATH_NODE_2 = "DEATH_NODE_2",
  /** 6.1 未被擊敗：出手後的死亡節點，出手目標仍存活。data: { node, killerSide } */
  NOT_DEFEATED = "NOT_DEFEATED",
  /** 6.3 未擊敗對手：出手後的死亡節點，出手方未擊敗對手。data: { node } */
  NOT_KILLED = "NOT_KILLED",
  /** 6.5 被擊敗後（6.2 之後）。data: { node } */
  AFTER_DEFEATED = "AFTER_DEFEATED",
  /** 6.6 擊敗對手後（6.4 之後）。data: { defeatedElf, node } */
  AFTER_KILL = "AFTER_KILL",
  BATTLE_PHASE_END = "BATTLE_PHASE_END",
  BEFORE_SKILL = "BEFORE_SKILL",
  /**
   * 自身攻擊技能主傷害命中並結算 HP 後（每次出手一次，在 AFTER_ATTACK_HIT 之後）：派發給攻擊方魂印。
   * data: { skill, damage（實際 HP 減少）, finalDamage（公式結果）, killed, targetSide, attackerSide }
   */
  ON_SKILL_HIT = "ON_SKILL_HIT",
  /**
   * 技能被「技能無效」類效果擋下：雙方魂印各一次（未命中／閃避／攻擊免疫不派發，請用 ACTION_FAILED 或 *_ON_INVALID）。
   * data: { skill, reason, kind: 'invalid', isIncoming }（isIncoming=true 為被使用方）
   */
  SKILL_INVALID = "SKILL_INVALID",
  ENFORCE = "ENFORCE",
  ON_PP_CONSUME = "ON_PP_CONSUME",
  BEFORE_TURN_RESOLVE = "BEFORE_TURN_RESOLVE",
  MODIFY_PRIORITY = "MODIFY_PRIORITY",
  CHECK_REBIRTH_PENDING = "CHECK_REBIRTH_PENDING",
  /** 異常附加前（受方魂印）。data: { status, duration, prevented, targetSide（受方）, sourceSide（施加方） } */
  BEFORE_STATUS_APPLY = "BEFORE_STATUS_APPLY",
  /** 異常被免疫（受方魂印／套裝）。data: { status, duration, targetSide, sourceSide, reason } */
  ON_STATUS_IMMUNIZED = "ON_STATUS_IMMUNIZED",
  EXTRA_ELF_NODE = "EXTRA_ELF_NODE",
  TRUE_DAMAGE_TAKEN = "TRUE_DAMAGE_TAKEN",
  BATTLE_END = "BATTLE_END",
  ELF_ENTERED = "ELF_ENTERED",
  /** 該方回合類效果被成功消除後（通用；data: { cleared }） */
  TURN_EFFECTS_CLEARED = "TURN_EFFECTS_CLEARED",
  BEFORE_STAT_CHANGE = 'BEFORE_STAT_CHANGE',
  PP_CHANGED = 'PP_CHANGED',
  STAT_BOOST_CLEARED = 'STAT_BOOST_CLEARED',
  RESOURCE_CHANGED = 'RESOURCE_CHANGED',
  BEFORE_INSTANT_KILL = 'BEFORE_INSTANT_KILL',
}

/** AFTER_ACTION／OPPONENT_AFTER_ACTION／ACTION_FAILED 的 extraData */
export interface ActionResultInfo {
  /** 本次主技能正式結算量，包含護盾吸收；與實際HP減少分開。 */
  settledDamage?:number;
  /** 行動方 */
  actor: "p1" | "p2";
  skill: Skill | any;
  /** 技能分類（物理／特殊／屬性） */
  category: string;
  /** 本次主技能傷害實際造成的對手 HP 減少量（不含附加／固定／百分比等其他傷害） */
  damageDealt: number;
  /** 本次主攻擊的致命一擊結果；屬性技能與失敗行動為 false。 */
  isCrit?: boolean;
  /** 技能成功命中（未 Miss／未被閃避／未被攻擊免疫／未被無效）；屬性技能成功出手也為 true */
  hit: boolean;
  /** 本次出手的技能附加效果是否可執行；不重查已消耗的封印次數。 */
  additionalEffectsEnabled?: boolean;
  /** 技能被「技能無效」類效果擋下 */
  invalid: boolean;
  /** 對手於本次行動中倒下（HP≤0） */
  killed: boolean;
  /** 未成功出手時的原因：invalid／miss／evade／immune */
  failKind?: "invalid" | "miss" | "evade" | "immune";
}

/** applyStatChange 的回傳：實際變化量（已扣除免疫與 ±6 上下限） */
export interface StatChangeResult {
  success: boolean;
  applied: Record<string, number>;
}

export interface PriorityComputation {
  tieRole?: 'challenger' | 'challenged';
  base: number;
  bonus: number;
  forcedFirst: boolean;
}

export type EffectPolarity = "POSITIVE" | "NEGATIVE" | "NEUTRAL";
export type { BattleEffect, EffectSubCategory };

export interface AbilityDefinition {
  id: string;
  triggerNode: EffectTiming;
  condition?: {
    type: string;
    value?: any;
  };
  effects: BattleEffect[];
}

export interface DeconstructedEffectEntry {
  id: string;
  effectClass: string;
  polarity?: EffectPolarity;
  flavor: {
    name: string;
    description: string;
    combatLog?: string;
  };
  mechanics: Record<string, any>;
}

export interface ElfDeconstructedProfile {
  id: string;
  name: string;
  soulMark: Record<string, DeconstructedEffectEntry>;
  skills: Record<string, DeconstructedEffectEntry[]>;
}

export type DamageCategory = "skill_attack" | "skill_attribute" | "skill_extra_action" | "fixed" | "percent" | "true";
export type DamageNode = "attack_damage" | "skill_effect" | "extra_action";

export interface DamageComputation {
  /** 實際造成傷害的一方；供受方效果區分敵方傷害與自身傷害。 */
  sourceSide?: 'p1' | 'p2';
  incomingDamageImmunity?:boolean; // 正式受方100%免傷；不同於抵擋、上限、取整或造成者傷害歸零。
  incomingDamageCancellation?:'block'|'conversion'; // 明確抵擋／轉化不以倍率0冒充免疫。
  damageBlocks?:Map<string,(amount:number)=>void>;
  damageConversions?:Map<string,(amount:number)=>void>;
  /** 明文無視傷害抵擋，與一般減傷、轉化及技能無效分開。 */
  ignoreDamageBlocking?:boolean;
  beforeFinalDamage?: Array<() => void>; // 條件減傷等全部增減傷就緒後再判斷，不以未加成base決定門檻
  afterDamage?: import('../battle/settlementReceipt').SettlementCallback;
  reductionPolicy?: import("../battle/damageReduction").ReductionPolicy;
  trackReduction?:boolean;
  multiplierReductionProduct?:number;
  reductionSources?: Record<string, number>; // 明確同源可加算；不同來源合成剩餘傷害比例
  attackDefenseBypass?: import('../battle/attackDefense').AttackDefenseBypass;
  base: number;              // Stage 0 結果，唯讀
  increasePercent: number;   // Stage 1 增傷總和，初始 0，handler 只能用 += 累加
  decreasePercent: number;   // Stage 1 減傷總和；請透過 addDamageReduction 保留方向及比例改寫
  multiplier: number;        // Stage 2 獨立乘區，初始 1.0，handler 用 *= 累乘
  limit?: number;            // Stage 3 傷害上限，多來源時取 Math.min
  outgoingLimit?: number;    // 造成者自己的輸出限制，不隨無視對手防護移除
  flatReduction?: number;    // 固定點數減傷，於倍率之後、傷害上限之前扣除，最低0
  bonusFixed?: number;       // Stage 3.5 固定加法值
  floor?: number;            // Stage 4 保底傷害，多來源時取 Math.max
  pure?: boolean;            // 保底類獨立乘區：後續所有通用增減傷段跳過，自帶鏈與 floor／limit 不受影響
  damageCategory: DamageCategory;
  damageNode?: DamageNode;   // 結算節點與傷害分類分離；動畫不改變節點
  skillType?: string;        // 本次技能的屬性系別，用來判斷是否為「普通系」跳過限制
  skillCategory?: string;    // 物理／特殊／屬性；不同於傷害分類。
  isIncoming?: boolean;
  isCrit?: boolean;
  isTypedSkill?: boolean;
}

export interface PpCostComputation {
  base: number;               // 預設消耗，例如 1
  additionalCost: number;     // 額外消耗
  extraAllSkills: number;     // 額外消耗自身所有技能的PP
  multiplier: number;         // 消耗倍率，預設 1.0
  isIncoming?: boolean;
}

export interface BattleEventContext {
  /** 從指定陣營背包扣一瓶並立即使用；recipient預設自己，空庫存不偽造回復。 */
  useBattleItem?: (inventorySide: 'p1' | 'p2', itemId: string, recipient?: 'p1' | 'p2', picked?: { side: 'p1' | 'p2'; battleId: string }) => boolean;
  /** 通用：把道具放入指定陣營的道具欄位（不超過持有上限）。 */
  grantBattleItem?: (inventorySide: 'p1' | 'p2', itemId: string, count?: number) => boolean;
  /** 指定持有者的通用事件，不偷換成當前操作方。 */
  emitElfEvent?: (side: 'p1' | 'p2', owner: Elf, event: EffectTiming, data: Record<string, unknown>) => void;
  /** 指定持有者的正式上下文，保留個體狀態銀行；不能用場上精靈上下文冒充場下持有者。 */
  contextForElf?: (side:'p1'|'p2',owner:Elf) => BattleEventContext;
  /** 所有傷害類型的指定精靈入口；場下不偷換成真實傷害。 */
  applyDamageToElf?: (side: 'p1' | 'p2', targetId: string, amount: number, type: DamageCategory,
    opts?: { elem?: string; label?: string; onSettled?: import('../battle/settlementReceipt').SettlementCallback; onCalculated?:import('../battle/damageCalculation').DamageCalculationOptions['onCalculated']; reaction?: boolean; applyTypeMatchup?: boolean; pure?: boolean }) => number;
  /** 驅逐：以共用切換隔離狀態，但跳過主動／死亡／登場鉤子。 */
  expel?: (side: 'p1' | 'p2') => boolean;
  /** 當前傷害及其衍生反應收尾；不是下一次出招，不重跑傷害或PP。 */
  afterDamageChain?: (run: (ctx: BattleEventContext) => void) => void;
  roundNumber?: number;
  /** 一次正式出手的識別碼；失效重算不變，另一個獨立出手另取新碼。 */
  actionId?: number;
  specialMode?: 'destiny' | 'interstellar';
  applyTrueDamageToElf?: (side: "p1" | "p2", targetId: string, amount: number, label?: string) => void;
  applyHealToElf?: (side: 'p1' | 'p2', targetId: string, amount: number, opts?: SettlementOptions) => void;
  adjustHpToElf?: (side:'p1'|'p2',targetId:string,amount:number) => void;
  p1FullTeam: Elf[];
  p2FullTeam: Elf[];
  self: Elf;
  target: Elf;
  actor: "p1" | "p2";
  goesFirst?: boolean;
  /** 僅本次命中後入口提供：主技能傷害實際扣除的HP，不含附加傷害。 */
  mainSkillHpReduced?: number;
  /** 本次固有使用條款已在命中閘門前執行，技能runner不得重播。 */
  innateSkillUseHandled?: boolean;
  mainSkillReduction?: import("../battle/damageReductionReceipt").DamageReductionReceipt;
  isEntranceTurn?: boolean;
  currentPhase?: string;
  skill: any;
  opponentSkill?: Skill | null;
  isHit?: boolean;
  moveIndex?: number;
  activeP1: Elf;
  activeP2: Elf;
  p1Timers?: any[];
  p2Timers?: any[];
  rng?: () => number;
  /** 戰鬥中身高／體重（含印記修正，例如魔軀枷鎖每層體重 +200%） */
  getBody?: (side: "p1" | "p2") => { height: number; weight: number };
  /** 文字彈出（Miss／技能無效／附加效果失效） */
  showPopup?: (side: "p1" | "p2", text: string, type: string, label?: string) => void;
  addLog: (msg: string, type?: "info" | "damage" | "heal" | "status" | "effect" | "defeat", sourceCode?: string) => void;
  applyStatusWithImmunityCheck: (side: "p1" | "p2", status: string, duration: number, ignoreDeluImmune?: boolean, targetBattleId?:string,origin?:StatusOrigin) => { success: boolean, immune: boolean };
  applyDeathImmunity: (side: "p1" | "p2", opts: { guardTurns: number; deathImmuneTurns: number; fixedPercentCap?: number; preserveOffField?: boolean }) => void;
  applyInstantKill?: (side:'p1'|'p2',label?:string,opts?:import('../battle/instantKill').InstantKillOptions)=>boolean;
  applyPercentDamage: (side: "p1" | "p2", percent: number) => number | void;
  getStatuses: (elf: Elf) => Record<string, number>;
  applyPinkDamage: (side: "p1" | "p2", amount: number, label?: string, activeP1?: Elf, activeP2?: Elf, dmgType?: string, opts?: { pure?: boolean } & import('../battle/damageCalculation').DamageCalculationOptions) => number;
  applyTrueDamage: (side: "p1" | "p2", amount: number, label?: string, activeP1?: Elf, activeP2?: Elf, opts?: SettlementOptions) => number;
  applySkillTypeDamage: (side: "p1" | "p2", amount: number, label?: string, opts?: { ignoreBlock?: boolean; ignoreLimit?: boolean; ignoreShield?: boolean; floor?: number; elem?: string; category?: "skill_attack" | "skill_attribute" | "skill_extra_action"; node?: DamageNode; pure?: boolean; applyTypeMatchup?: boolean }) => number;
  /** 舊汲取入口（真實傷害）。吸取請使用明確 fixed／percent 的 queueHpDrain。 */
  applyAbsorb: (side: "p1" | "p2", amount: number, label?: string, opts?: SettlementOptions) => void;
  
  // Dynamic state accessors
  getPlayerState: (key: string) => any;
  setPlayerState: (key: string, val: any, acquiredSource?: string) => void;
  getOpponentState: (key: string) => any;
  setOpponentState: (key: string, val: any) => void;
  
  applyHeal: (side: "p1" | "p2", amount: number, opts?: SettlementOptions) => void;
  adjustHp: (side: "p1" | "p2", amount: number) => void;
  /** 回傳實際變化量（舊呼叫端可忽略回傳值） */
  applyStatChange: (side: "p1" | "p2", changes: Record<string, number>, ppChanges?: Record<string, number>) => StatChangeResult;
  applyShield: (side: "p1" | "p2", amount: number) => void;
  applyFixedDamage: (side: "p1" | "p2", amount: number, label?: string, opts?: { unscaled?: boolean }) => number | void;
  updateElf: (side: "p1" | "p2", elfUpdates: Partial<Elf>) => void;
  updateAnyElf: (side: "p1" | "p2", battleId: string, patch: Partial<Elf>) => void;
  targetSide: "p1" | "p2";

  /**
   * 「下N回合」：令 key（通常為 *Turns 通用鍵）在「下一回合起」生效 n 回合。
   * 本回合不生效、本回合結束不扣減；回合結束通用遞減後才寫入（與既有值取大）。
   * 直接 setPlayerState(key, n) 則是「本回合起」生效，且本回合結束就會扣 1（舊行為）。
   * who：'self'／'opp' 相對於 ctx.actor，或直接指定 'p1'／'p2'。
   */
  setNextTurns: (who: "self" | "opp" | "p1" | "p2", key: string, n: number) => void;

  // Tracker callback
  trackCodeExec: (blockName: string, description: string, codeSnippet: string) => void;
  
  // Utilities
  clearTurnEffectsOf: (side: "p1" | "p2", elf?: Elf) => boolean;
  hasTurnEffectOn: (side: "p1" | "p2") => boolean;
  addTimerTo: (side: "p1" | "p2", timer: Timer, isLateMover: boolean) => void;
  consumeTimer?: (side: "p1" | "p2", id: string) => void;
  /** 額外行動：於該方出手流程結束後（後手出手前）逐一執行，每次為獨立的傷害節點（類別：額外行動傷害） */
  queueExtraAction?: (owner: "p1" | "p2", action: ExtraAction) => void;
  setMark: (mark: Omit<Mark, "source"> & { source?: string }, targetSide?: "p1" | "p2") => void;
  /** 第三參數指定單一印記實例：null僅陣營級；未填維持持有者可用印記的舊語義。 */
  clearMark: (id: string, targetSide?: "p1" | "p2", ownerBattleId?: string|null) => void;
  getMarks: (side: "p1" | "p2") => Mark[];
  /** 陣營生命週期使用；一般效果仍用持有者過濾的 getMarks。 */
  getAllMarks?: (side: "p1" | "p2") => Mark[];
  shuffleArray: <T>(arr: T[]) => T[];

  // Position Coordinates & Vanish Utilities
  getEligibleTeam: (side: "p1" | "p2") => Elf[];
  getFullTeam: (side: "p1" | "p2") => Elf[];
  getFirstStarter: (side: "p1" | "p2") => Elf | undefined;
  getNthElf: (side: "p1" | "p2", n: number) => Elf | undefined;
  getAdjacentElves: (side: "p1" | "p2", elf: Elf) => Elf[];
  getSeparatedElves: (side: "p1" | "p2", elf: Elf) => Elf[];
  vanishElf: (side: "p1" | "p2", elf: Elf) => void;
  addExtraElf: (side: "p1" | "p2", extraElf: Elf) => void;
}

export type BattleSkillHandler = (context: BattleEventContext) => void;

/**
 * 技能命中結算後（主傷害、陣亡標記之後，AFTER_ACTION 之前）的技能專屬處理。
 * 以 `*_AFTER_HIT` 匯出於 src/effects/*Registry.ts，鍵＝技能名。用於「造成傷害後／未擊敗對手則／擊敗對手則」。
 * 屬性技能也會呼叫（damageDealt=0）。附加效果失效時不呼叫。
 */
export type BattleSkillAfterHitHandler = (context: BattleEventContext, info: { damageDealt: number; killed: boolean; hit: boolean }) => void;

/**
 * 技能無效（含未命中／閃避／攻擊免疫）時的技能專屬處理。以 `*_ON_INVALID` 匯出，鍵＝技能名。
 * 用於「技能無效時…」，不需 SKILL_MODE 積木。
 */
export type BattleSkillOnInvalidHandler = (context: BattleEventContext, info: { reason: string; kind: "invalid" | "miss" | "evade" | "immune" }) => void;

/**
 * 額外行動是出手流程結束後的獨立行動節點，不等同再次使用技能，亦不觸發一般 ACTION_END。
 * amount＋elem＝以該屬性（吃克制）造成額外行動傷害；run＝在擁有者 ctx 執行自訂結算。
 */
export interface ExtraAction {
  label: string;
  amount?: number;
  elem?: string;
  after?: (ctx: BattleEventContext, dealt: number) => void;
  run?: (ctx: BattleEventContext) => number | void;
}
