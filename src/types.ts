import { AbilityDefinition } from './effects/types';
import { KitEntry } from './effects/effectSystem.schema';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spatk: number;
  spdef: number;
  speed: number;
}

export interface SoulMark {
  name: string;
  description: string;
  effectType: 'paralyze_chance' | 'burn_chance' | 'heal_on_turn_end' | 'damage_boost' | 'shield' | 'status_immune' | 'speed_boost' | 'custom' | 'none';
  effectValue: number; // e.g. percent or chance
  badgeChar?: string; // Single character representing the soul mark, e.g. "濁"
  wuxu_trait?: boolean;
  trait_wuwo?: boolean;
  trait_warrior?: boolean;
  trait_wuxu_apostle?: boolean;
  trait_stone_thrower?: boolean;
  customCode?: string; // Custom real battle execution code
  ignorePpLimit?: boolean; // 是否可在技能 PP 為 0 時選擇；扣費／回復規則另行處理
}

export interface SkillBadge {
  id?: string;
  text: string;
  description?: string;
  color?: string; // CSS color or Tailwind class e.g. "text-cyan-300"
  bg?: string;    // e.g. "bg-cyan-950/80"
  border?: string;// e.g. "border-cyan-500/50"
  animate?: string; // e.g. "animate-pulse"
}

export interface Skill {
  name: string;
  type: string; // e.g. "電", "火", "草", "水", "無屬性"
  category: '物理' | '特殊' | '屬性';
  power: number;
  pp: number;
  currentPp?: number;
  maxPp?: number;
  charge?: number; // 充能 (馬爾修斯專屬機制)
  accuracy?: number; // 命中率 (0-100), default 100
  isSureHit?: boolean; // 是否必中
  description: string;
  priority?: number; // 先制, default 0
  effectType: 'none' | 'stat_up' | 'stat_down' | 'heal' | 'status_inflict' | 'damage_multiplier' | 'absorb' | 'mercy' | 'special' | 'dispel' | 'buff' | string;
  effectDetail: string; // e.g. "atk+1", "def-1", "heal:30%", "paralyze:30", "double_damage:10"
  isFifthSkill?: boolean; // 是否為第五技能（專屬替換池）
  isAbolished?: boolean; // 是否已廢除（直到戰鬥結束時無法再次選擇使用，視為失去該技能）
  
  // Dynamic Special Marks & Badges Display Slot (印記/特殊標記動態顯示區，無標記時不顯示)
  specialBadge?: SkillBadge;
  specialMarks?: SkillBadge[];
  
  // Skill Stone properties (技能石)
  isSkillStone?: boolean; // 是否為技能石技能
  skillStoneGrade?: 'D' | 'C' | 'B' | 'A' | 'S' | 'SS'; // 技能石等級
  isPerfectSkillStone?: boolean; // 是否為完美技能石
  skillStoneEffect?: string; // 完美技能石特效代碼

  // Effect Classification (A, B, C)
  isCarrying?: boolean; // A: Carrying effect (starts with battle, doesn't respond to additional effect invalidation)
  isInherent?: boolean; // B: Inherent effect (命中前生效, ignores additional effect invalidation, but responds to inherent invalidation)
  // Additional effects (C) are standard:命中後/使用成功後生效
  skillRune?: string; // 附加在該技能欄位上的符文 ('ᛈ', 'ᛁ', 'ᚦᚺ', 'ᚾ', 'ᛃ', 'ᚨ', 'ᛉ', 'ᚱᚷ', 'ᛇ', 'ᛖ')
  isRuneActive?: boolean; // 符文是否處於「激活狀態」（選擇技能階段點擊激活）
  kit?: KitEntry[]; // 模組化效果 Kit (自訂技能 / 詞條式技能效果)
  isPpPenalized?: boolean; // 是否因符文致死處罰導致最大PP上限歸0
  // PP 彈性極限與特權配置 (預備效果庫，支持超出/低於常規PP上限與下限)
  ppMaxOffset?: number; // PP 上限偏移值 (正數表示可高於原始上限X點，負數表示低於上限Y點)
  ppMinOffset?: number; // PP 下限偏移值 (例如 -5 表示允許PP透支至 -5，低於常規0點下限)
  statChanges?: StatChange[];
  statusEffects?: StatusEffect[];
  customCode?: string; // Custom real battle execution code
  templateId?: string; // 模板引擎效果編號
  templateArgs?: any[]; // 模板引擎參數
}

export type StatusCategory = 
  | 'CONTROL' 
  | 'WEAKENING' 
  | 'RESTRICTIVE' 
  | 'EVOLUTIONARY' 
  | 'AUXILIARY' 
  | 'MARK' 
  | 'INDICIA' 
  | 'NONE' 
  | string;

export type EffectSource = 'skill' | 'soulmark' | 'mechanic' | 'item';

export type TimerUnit = 'round' | 'use' | 'permanent';
export type EffectCategory = 'turn_effect' | 'other';
export type TickPoint = 'round_end' | 'action_end' | 'on_use';

export type EffectSubCategory = "FIXED" | "PERCENT" | "HP_BASED" | string;

export interface BattleEffect {
  id: string; // Internal ID for logic
  name: string; // Display name
  duration?: number; // For compatibility with legacy code
  unit?: TimerUnit; // 計數單位: 回合, 次數, 永久
  category?: EffectCategory | EffectSubCategory | string; // 是否為「回合類效果」
  remaining?: number; // 剩餘計數
  tickAt?: TickPoint; // 觸發跳錶點
  isClearable?: boolean; // Tag for "Turn-based effects" (legacy skills)
  isLateMover?: boolean;
  source?: string; // e.g. "skill", "soulmark", etc.
  type?: "buff" | "debuff" | "control" | "shield" | "mark" | string;
  value?: number | string | any; // Optional numeric or complex value
  stacks?: number;
  maxStacks?: number;
  description?: string;
  metadata?: any; // Additional data
  isTurnBased?: boolean;
  isPositive?: boolean;
  binding?: "SELF" | "OPPONENT" | string;
  statusCategory?: string;
  statChanges?: any[];
}

export interface StatusEffect {
  name: string;
  duration: number;
  category: StatusCategory;
}

export interface BattleStatusEffect {
  name: string;
  categories: StatusCategory[];
  description: string;
}

export interface Inscription {
  id?: string;
  name: string;
  stats: BaseStats; // { hp, atk, def, spatk, spdef, speed }
  description?: string;
}

export interface DecompositionReport {
  decomposedTags: string[];
  referencedEffects: { name: string; source: string; syntax: string }[];
  newCatalogedEffects: { name: string; syntax: string; reason: string }[];
  templateSummary: string;
}

export type StatType = 'atk' | 'def' | 'spatk' | 'spdef' | 'speed' | 'accuracy';

export interface StatChange {
  stat: StatType | 'all';
  value: number;
}

export interface Elf {
  id: string; // unique identifier (especially for customized/saved elves)
  name: string;
  type: string;
  originalType?: string;
  /** 屬性被剝離（顯示為無屬性）；下場時恢復 originalType。 */
  typePeeled?: boolean;
  level: number;
  baseStats: BaseStats;
  ivs?: BaseStats; // individual values (0-31), if undefined we assume 31
  evs?: BaseStats; // effort values (0-255), if undefined we assume 255 for main, 0 for others
  natureModifiers?: { [key in keyof BaseStats]?: number }; // nature multipliers (0.9, 1.0, 1.1)
  inscriptions?: Inscription[]; // 3顆刻印孔
  calculatedStats: BaseStats; // derived from baseStats, iv, ev, level, and nature
  openingSpAtk?: number; // 戰鬥開始時的基礎面板特攻值快照
  openingSpDef?: number; // 戰鬥開始時的基礎面板特防值快照
  currentHp: number; // active HP during battle
  path?: string; // image path or name
  seerId?: number | string; // 賽爾號官方寵物ID（頭像/全身圖對應；未填則依名稱自動比對）
  description?: string; // text description that can be adjusted
  rawPrompt?: string; // 原始文本 (不經結構化拆解的真實用戶輸入文本)
  maxHp: number; // maximum HP in battle
  soulMark: SoulMark;
  trait?: SoulMark;
  abilities?: AbilityDefinition[]; // New abilities system
  skills: Skill[];
  skillPool?: Skill[]; // 該精靈所擁有的完整技能庫/技能池（包含所有可替換技能）
  height?: number; // 精靈身高
  weight?: number; // 精靈體重
  gender?: string; // 性別 (預設 無性別)
  specialModeRating?: string; // 特殊模式評級 (預設 未評級)
  isCustom?: boolean; // flag to identify if created by user
  battleId?: string; // 戰鬥唯一識別碼
  battleRating?: number; // 戰鬥評分
  resistances?: ElfResistances; // 傷害抗性與異常抗性配置
  critValue?: number; // 每 1 點代表 1/16 的暴擊率，預設為 1 (6.25%)
  decompositionReport?: DecompositionReport; // AI效果解構與庫存引用分析報告
  
  // Battle state tracking (added dynamically during battle)
  statStages?: {
    atk: number; // range -6 to +6
    def: number;
    spatk: number;
    spdef: number;
    speed: number;
    accuracy: number;
  };
  isVanished?: boolean; // Flag to identify if the elf has vanished
  isExtra?: boolean; // 標示該精靈是否為額外/待命後備精靈 (Peak 模式 50 回合勝負判定時預設不計入)
  badge?: string; // 精靈徽章圖示或標籤 (例如: ✨, 🦑, 👻)
  hasDiedTriggered?: boolean; // Flag for Brinkk revival
  battleStatus?: string; // e.g. 'normal', 'paralyzed', 'burned', 'disarmed', 'decayed', 'hypothermia', 'sluggish', etc.
  battleStatusDuration?: number; // duration of state in turns
  battleStatuses?: Record<string, number>; // ID to remaining turns mapping for multi-status support
  effects?: BattleEffect[];
  marks?: import('./battle/marks').Mark[];
  soulDirgeStacks?: number; // 魂殤 stacks (0-4)
  demonShackles?: number; // 魔軀枷鎖 stacks (0-5)，綁定在精靈個體身上，下場後保留
  shield?: number; // active shield points (抵擋攻擊傷害)
  barrier?: number; // active barrier points (抵擋固定/百分比傷害)
  kit?: KitEntry[]; // 模組化效果 Kit (自訂精靈 / 詞條式魂印與技能)
  
  // Alien Elves (異能精靈) & Traits (特質)
  category?: string; // e.g. "異能精靈"
  isAlienElf?: boolean; // 類型：是否為異能精靈 (或由特質「戰士」賦予)
  alienTraits?: {
    gen2Trait?: { name: string; description: string; mechanics?: Record<string, any> }; // 二代特質 (例如: 無我, 戰士)
    exclusiveTrait?: { name: string; description: string; mechanics?: Record<string, any> }; // 專屬特質 (例如: 無序星魂使徒)
    /** 同一精靈擁有複數專屬特質時使用；舊資料仍可沿用 exclusiveTrait。 */
    exclusiveTraits?: Array<{ name: string; description: string; mechanics?: Record<string, any> }>;
    alienTrait?: { name: string; description: string }; // 異能特質 (一代通用特質)
    generalTrait?: { name: string; description: string }; // 通用特性
  };
  isConcealed?: boolean; // 隱匿：印記狀態 (立繪黑影，技能顯示為未知技能)
  trait_stone_thrower?: boolean; // 投石者特質
  tempMaxHpBoost?: number; // 臨時體力上限增量 (下場後消失)
  
  // Invalidation & Immunity Flags
  isInherentInvalid?: boolean; // 技能固有效果失效 (B effects disabled)
  isAdditionalInvalid?: boolean; // 技能附加效果失效 (C effects disabled)
  isSkillInvalid?: boolean; // 技能無效 (Attack skills negated)
  isAttackImmune?: boolean; // 攻擊免疫 (Immune to attack effects, bypassable by "Ignore Immunity")
  statusImmuneTurns?: number; // 異常抵抗回合數 (Immunity to status abnormalities)
  cannotUseAttrSkillsTurns?: number; // 屬性技能無效回合數
  cannotUseAttackSkillsTurns?: number; // 攻擊技能無效回合數
  cannotActThisTurn?: boolean; // 當回合無法行動
  
  // Opeia (蟲后·奧佩婭) & Custom Tracking Properties
  opeiaTempStatBonus?: number; // 臨時能力值加成 (n*10%)
  opeiaComboCount?: number; // 前 n 次攻擊技能連擊次數+1
  opeiaEnemyDmgReduction?: number; // 敵方攻擊威力降低比例
  opeiaIgnoreImmunities?: boolean; // 無視對手攻擊免疫/抵擋/轉化/傷害限制
  nextPropSkillAdditionalInvalid?: boolean; // 下次屬性技能附加效果失效
  nextAtkSkillAdditionalInvalid?: boolean; // 下次攻擊技能附加效果失效
  opeiaDmgReduction99Turns?: number; // 2回合內非真實傷害降低99%
  treatAsBugTurns?: number; // 將對手視為蟲系回合數
  opeiaDrainStatsTurns?: number; // 3回合內每回合吸取3項能力值-1
  cannotSwitchTurns?: number; // 無法主動切換精靈回合數
  enemyVulnerableTurns?: number; // 受到傷害提升150%回合數
  bonusPriorityTurns?: number; // 先制提升回合數
  nextSkillInvalid?: boolean; // 下次技能無效
  opeiaDrainHpTurns?: number; // 5回合內吸取最大體力1/3
  opeiaFixedDmgTurns?: number; // 4回合內附加300固定傷害
  opeiaEnterCount?: number; // 登場次數
  boundTrueDamageTurns?: number; // 綁定真實傷害回合數
  noHealTurns?: number; // 體力恢復量下降100%
  
  // Odin (眾神之父·奧丁) & Rune System Tracking Properties
  hasTyrRune?: boolean; // 是否持有ᛏ符文（登場或順延附加，提升所有能力值20%，且出戰時發起決鬥）
  hasNydDebuff?: boolean; // 是否已被 ᚾ 符文扣減20%能力值
  odinTurnsInBattle?: number; // 當前在場回合數紀錄
  odinIgnoreImmunityNext?: boolean; // 無視對手免疫攻擊效果成功，下次攻擊無視免疫
  odinImmuneNextAttack?: boolean; // 免疫下次受到的攻擊
  odinDrainHp5Turns?: number; // 5回合內使用技能吸取對手最大體力1/3
  odinDmgBoost3Turns?: number; // 3回合內造成技能傷害提升100%
  odinNoSwitch2Turns?: number; // 2回合內對手無法主動切換
  odinNext2TurnsPriority2?: number; // 下2回合先制+2
  odinNextKillTransferRunes?: boolean; // 下次擊敗對手時同步符文激活狀態
  odinNextDeathTransferRunes?: boolean; // 下次被擊敗時附加激活符文
  // Delu (魔獅迪露) Custom Tracking Properties
  priorityBoostTurns?: number;
  priorityBoostAmount?: number;
  drainHpSkillTurns?: number;
  drainHpSkillAmount?: number;
  // PP 彈性極限與特權配置 (精靈全域附加效果/異常狀態影響)
  globalPpMaxOffset?: number; // 精靈全體技能 PP 上限偏移值 (X/Y 正負數字)
  globalPpMinOffset?: number; // 精靈全體技能 PP 下限偏移值 (例如允許透支/負數PP)
  faithTarget?: string; // 狂信信仰綁定對象
  poemStacks?: number; // 詩章層數 (次元龍機制)
  // Destiny Wheel (命運之輪模式) 特效與評級欄位
  destinyRank?: 'S' | 'A' | 'B' | 'C';
  interceptorEffect?: {
    id: string;
    name: string;
    description: string;
    type: 'on_enter' | 'on_death';
    triggerLog: string;
  };
  interceptorTriggered?: boolean;
  guildBonuses?: BaseStats; // 戰隊加成 (HP:+30, Atk/Def/Spatk/Spdef:+15, Speed:+10)
  hasAnnualBonus?: boolean; // 年費加成 (全能力+10)
  turnDamageStats?: {
    skill: number;
    fixed: number;
    percent: number;
    trueDmg: number;
    heal: number;
    startHp: number;
  };
  // 六界神王 (Six Realms God King) properties
  entryHp?: number;
  entrySkillsPp?: number[];
  learnedSecrets?: string[];
  skillsUsedThisGame?: string[];
  lastFatalDamageTaken?: number;
  damageTakenThisTurn?: number;
  liujieImmuneStatusThisTurn?: boolean;
  liujieAtkDmgBoostThisTurn?: boolean;
  liujieArts?: string[];
  critNextTurn?: boolean;
  liujieLimit400NextTurn?: boolean;
  liujieTimeNextTurnPriority?: number;
  liujieNextTurnPriority?: number;
  // Beliant (蓓麗安特) properties
  starGovernanceStatus?: string; // 星執：記錄的異常抗性最高項
  starGovernorEnergy?: number; // 星執者能量
  isStarGovernorActive?: boolean; // 是否處於星執者狀態
  // Destiny Wheel C-rank additions
  darkScarTurns?: number; // 黯痕印記剩餘回合 (悲歌.索比拉特)
  darkScarDurationBonus?: number; // 黯痕額外加成回合
  tookDamageThisTurn?: boolean; // 當回合是否受到傷害
  guardianMarkValue?: number; // 守護印記減傷值 (帝皇之盾)
  guardianMarkTurns?: number; // 守護印記剩餘回合
  bajieMaxHpReductionTurns?: number; // 八戒上限削減剩餘回合
  pitesalaluoFatalSurviveUsed?: boolean; // 皮特薩拉羅名刀是否已觸發
  deathImmunity?: { guardTurns: number; deathImmuneTurns: number; fixedPercentCap?: number; preserveOffField?: boolean };
  /** 非正體力存活規則（六刃鎖0、雷伊神降負體力）；存放於精靈本體，換場後保留。 */
  survivalRule?: import('./battle/survivalRules').NonPositiveSurvivalRule;
  /** body 圖的呈現方式；scene 會保留整張場景圖並柔化矩形邊緣。 */
  artPresentation?: 'sprite' | 'scene';
  /** 規則型特質：用資料欄位接入通用引擎，避免以名稱硬編碼。 */
  suppressAbnormalSideEffectsWhenParalyzed?: boolean;
  ppLimitIgnoredWhenParalyzedTurns?: number;
  useAtkSpAtkSumForAttacks?: boolean;
  treatOpponentBoostAsDoubleDrop?: boolean;
  ownTurnEffectsUnclearable?: boolean;
  collapseOpponentTurnEffectsToOne?: boolean;
  paralyzeBothOnOwnStatChangeTurns?: number;
}

export interface BattleItem {
  id: string;
  name: string;
  description: string;
  type: 'hp' | 'pp' | 'hybrid' | 'special';
  value?: number;
  ppValue?: number;
  effect?: 'clear_status' | 'clear_debuff';
}

export interface BattleLog {
  turn: number;
  text: string;
  type: 'info' | 'player1' | 'player2' | 'damage' | 'heal' | 'effect' | 'status' | 'debuff' | 'defeat';
  sourceCode?: string;
}

export type BattleMode = 'PVP' | 'PVE'; // Real vs Real vs Real vs AI

export interface ResistanceSlot {
  id: string; // 'c1' | 'c2' | 'c3' | 'w1' | 'w2' | 'w3'
  category: 'control' | 'weakening';
  status: string; // 選擇的異常名稱
  rate: number; // 基礎觸發機率 (0% - 50%，加上全免 5% 最高可達 55%)
}

export interface ElfResistances {
  damageResist: {
    crit: number; // 致命一擊傷害抗性 (0% - 35%，預設 35%)
    fixed: number; // 固定傷害抗性 (0% - 35%，預設 35%)
    percent: number; // 百分比傷害抗性 (0% - 35%，預設 35%)
  };
  statusResist: {
    allImmune: boolean; // 5% 全免抗性開關 (預設 true)
    selectedStatuses: string[]; // 自選異常種類 (最多 6 種異常)
    slots?: ResistanceSlot[]; // 6個獨立卡片/插槽配置 (3個控制類，3個弱化類)
  };
}

export interface GameState {
  view: 'start' | 'custom' | 'battle';
  battleMode: BattleMode;
  p1Elf: Elf | null;
  p2Elf: Elf | null;
}
