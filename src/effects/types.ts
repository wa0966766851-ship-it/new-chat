import { Elf, Skill, BattleLog, BattleItem, BattleEffect, EffectSubCategory } from "../types";
import { Timer } from "../battle/timers";
import { Mark } from "../battle/marks";

export enum EffectTiming {
  BEFORE_DAMAGE = "BEFORE_DAMAGE",
  AFTER_DAMAGE = "AFTER_DAMAGE",
  ON_ENTRANCE = "ON_ENTRANCE",
  BEFORE_ACTION = "BEFORE_ACTION",
  OPPONENT_ACTION = "OPPONENT_ACTION",
  AFTER_ACTION = "AFTER_ACTION",
  ACTION_END = "ACTION_END",
  EXTRA_ACTION_START = "EXTRA_ACTION_START",
  EXTRA_ACTION_END = "EXTRA_ACTION_END",
  ROUND_START = "ROUND_START",
  ROUND_END = "ROUND_END",
  FATAL_RESIST = "FATAL_RESIST",
  ON_KILL = "ON_KILL",
  ON_SWITCH_OUT = "ON_SWITCH_OUT",
  ON_DAMAGED = "ON_DAMAGED",
  OPPONENT_DAMAGE = "OPPONENT_DAMAGE",
  DEATH_NODE_1 = "DEATH_NODE_1",
  DEATH_NODE_2 = "DEATH_NODE_2",
  BATTLE_PHASE_END = "BATTLE_PHASE_END",
  BEFORE_SKILL = "BEFORE_SKILL",
  ON_SKILL_HIT = "ON_SKILL_HIT",
  ENFORCE = "ENFORCE",
  ON_PP_CONSUME = "ON_PP_CONSUME",
  BEFORE_TURN_RESOLVE = "BEFORE_TURN_RESOLVE",
  MODIFY_PRIORITY = "MODIFY_PRIORITY",
  CHECK_REBIRTH_PENDING = "CHECK_REBIRTH_PENDING",
  BEFORE_STATUS_APPLY = "BEFORE_STATUS_APPLY",
  ON_STATUS_IMMUNIZED = "ON_STATUS_IMMUNIZED",
  EXTRA_ELF_NODE = "EXTRA_ELF_NODE",
  TRUE_DAMAGE_TAKEN = "TRUE_DAMAGE_TAKEN",
  BATTLE_END = "BATTLE_END",
  ELF_ENTERED = "ELF_ENTERED",
}

export interface PriorityComputation {
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
  base: number;              // Stage 0 結果，唯讀
  increasePercent: number;   // Stage 1 增傷總和，初始 0，handler 只能用 += 累加
  decreasePercent: number;   // Stage 1 減傷總和，初始 0，handler 只能用 += 累加
  multiplier: number;        // Stage 2 獨立乘區，初始 1.0，handler 用 *= 累乘
  limit?: number;            // Stage 3 傷害上限，多來源時取 Math.min
  bonusFixed?: number;       // Stage 3.5 固定加法值
  floor?: number;            // Stage 4 保底傷害，多來源時取 Math.max
  pure?: boolean;            // 保底類獨立乘區：後續所有通用增減傷段跳過，自帶鏈與 floor／limit 不受影響
  damageCategory: DamageCategory;
  damageNode?: DamageNode;   // 結算節點與傷害分類分離；動畫不改變節點
  skillType?: string;        // 本次技能的屬性系別，用來判斷是否為「普通系」跳過限制
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
  p1FullTeam: Elf[];
  p2FullTeam: Elf[];
  self: Elf;
  target: Elf;
  actor: "p1" | "p2";
  goesFirst?: boolean;
  isEntranceTurn?: boolean;
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
  applyStatusWithImmunityCheck: (side: "p1" | "p2", status: string, duration: number, ignoreDeluImmune?: boolean) => { success: boolean, immune: boolean };
  applyDeathImmunity: (side: "p1" | "p2", opts: { guardTurns: number; deathImmuneTurns: number; fixedPercentCap?: number; preserveOffField?: boolean }) => void;
  applyPercentDamage: (side: "p1" | "p2", percent: number) => void;
  getStatuses: (elf: Elf) => Record<string, number>;
  applyPinkDamage: (side: "p1" | "p2", amount: number, label?: string, activeP1?: Elf, activeP2?: Elf, dmgType?: string, opts?: { pure?: boolean }) => number;
  applyTrueDamage: (side: "p1" | "p2", amount: number, label?: string, activeP1?: Elf, activeP2?: Elf) => number;
  applySkillTypeDamage: (side: "p1" | "p2", amount: number, label?: string, opts?: { ignoreBlock?: boolean; ignoreLimit?: boolean; ignoreShield?: boolean; floor?: number; elem?: string; category?: "skill_attribute" | "skill_extra_action"; node?: DamageNode; pure?: boolean }) => number;
  applyAbsorb: (side: "p1" | "p2", amount: number) => void;
  
  // Dynamic state accessors
  getPlayerState: (key: string) => any;
  setPlayerState: (key: string, val: any) => void;
  getOpponentState: (key: string) => any;
  setOpponentState: (key: string, val: any) => void;
  
  applyHeal: (side: "p1" | "p2", amount: number) => void;
  adjustHp: (side: "p1" | "p2", amount: number) => void;
  applyStatChange: (side: "p1" | "p2", changes: Record<string, number>, ppChanges?: Record<string, number>) => void;
  applyShield: (side: "p1" | "p2", amount: number) => void;
  applyFixedDamage: (side: "p1" | "p2", amount: number, label?: string) => number | void;
  updateElf: (side: "p1" | "p2", elfUpdates: Partial<Elf>) => void;
  updateAnyElf: (side: "p1" | "p2", battleId: string, patch: Partial<Elf>) => void;
  targetSide: "p1" | "p2";
  
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
  clearMark: (id: string, targetSide?: "p1" | "p2") => void;
  getMarks: (side: "p1" | "p2") => Mark[];
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
