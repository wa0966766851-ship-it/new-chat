import { BaseStats, Inscription, Elf } from "../types";
import { getEffectiveInscriptions } from "../data/inscriptionsCatalog";
import { SUIT_CATALOG } from "../data/suitsAndEyewears";
import { isStoneThrower, isSkillStone, stoneBasePp } from "../data/skillStones";

/**
 * Returns default effort values ("本攻+體力": 255 HP + 255 Main Attack)
 */

/**
 * Calculates the final battle stats for a Seer Elf based on formulas:
 * Non-HP: floor( ( (Base_Stat * 2 + IV + EV / 4) * Level / 100 + 5 ) * Nature_Multiplier ) + Inscriptions
 * HP: floor( (Base_Stat * 2 + IV + EV / 4) * Level / 100 + 10 + Level ) + Inscriptions
 */

/**
 * Calculates the multiplier for a stat based on its stage (-6 to +6).
 */
export function getStatMultiplier(stage: number, isAccuracy: boolean = false): number {
  if (isAccuracy) {
    if (stage >= 0) {
      return (2 + stage) / 2;
    } else {
      // Special accuracy debuff rules from user:
      // -1: 85%, -2: 70%, -3: 55%, -4: 45%, -5: 35%, -6: 25%
      const accDebuffs = [1.0, 0.85, 0.70, 0.55, 0.45, 0.35, 0.25];
      return accDebuffs[Math.abs(stage)] || 0.25;
    }
  }

  if (stage >= 0) {
    return (2 + stage) / 2; // +1: 1.5, +2: 2.0, ..., +6: 4.0
  } else {
    return 2 / (2 + Math.abs(stage)); // -1: 0.666, -2: 0.5, ..., -6: 0.25
  }
}

/**
 * Calculates the final effective stat value after applying multipliers.
 */
export function calculateEffectiveStat(baseValue: number, stage: number, isAccuracy: boolean = false): number {
  const multiplier = getStatMultiplier(stage, isAccuracy);
  return Math.floor(baseValue * multiplier);
}

/**
 * Seer Type Matchup Matrix (克制係數)
 * Standard Matchups between common Seer attributes.
 */
export const SEER_TYPES = [
  "草", "水", "火", "飛行", "電", "機械", "地面", "普通", "冰", "超能", "戰鬥", "光", "暗影", "神秘", "龍", "聖靈", "次元", "遠古", "邪靈", "自然", "王", "混沌", "神靈", "輪迴", "蟲", "虛空", "無屬性"
];

// Simple matchup chart multiplier lookup: attackerType -> defenderType -> multiplier
// By default, if not specified, it's 1.0.
export const TYPE_MATCHUPS: { [attacker: string]: { [defender: string]: number } } = {
  "草": { "水": 2.0, "地面": 2.0, "光": 2.0, "草": 0.5, "火": 0.5, "飛行": 0.5, "機械": 0.5, "聖靈": 0.5, "遠古": 0.5, "混沌": 0.5, "神靈": 0.5 },
  "水": { "火": 2.0, "地面": 2.0, "草": 0.5, "水": 0.5, "聖靈": 0.5, "自然": 0.5, "混沌": 0.5, "神靈": 0.5 },
  "火": { "草": 2.0, "機械": 2.0, "冰": 2.0, "水": 0.5, "火": 0.5, "聖靈": 0.5, "自然": 0.5, "混沌": 0.5, "神靈": 0.5 },
  "飛行": { "草": 2.0, "戰鬥": 2.0, "蟲": 2.0, "電": 0.5, "遠古": 0.5, "次元": 0.5, "自然": 0.5, "混沌": 0.5, "冰": 0.5 },
  "電": { "水": 2.0, "飛行": 2.0, "暗影": 2.0, "次元": 2.0, "混沌": 2.0, "虛空": 2.0, "地面": 0.0, "神秘": 0.5, "聖靈": 0.5, "自然": 0.5, "神靈": 0.5 },
  "機械": { "冰": 2.0, "戰鬥": 2.0, "遠古": 2.0, "邪靈": 2.0, "神靈": 2.0, "地面": 0.5, "火": 0.5, "次元": 0.5 },
  "地面": { "火": 2.0, "電": 2.0, "機械": 2.0, "王": 2.0, "輪迴": 2.0, "飛行": 0.0, "草": 0.5, "水": 0.5, "冰": 0.5, "自然": 0.5, "蟲": 0.5 },
  "普通": {},
  "冰": { "草": 2.0, "飛行": 2.0, "地面": 2.0, "次元": 2.0, "遠古": 2.0, "輪迴": 2.0, "蟲": 2.0, "火": 0.5, "機械": 0.5, "戰鬥": 0.5, "龍": 0.5, "聖靈": 0.5, "混沌": 0.5, "神靈": 0.5 },
  "超能": { "戰鬥": 2.0, "神秘": 2.0, "自然": 2.0, "光": 0.5, "暗影": 0.5, "次元": 0.5, "虛空": 0.5 },
  "戰鬥": { "機械": 2.0, "冰": 2.0, "龍": 2.0, "聖靈": 2.0, "超能": 0.5, "暗影": 0.5, "邪靈": 0.5, "王": 0.5 },
  "光": { "超能": 2.0, "暗影": 2.0, "蟲": 2.0, "草": 0.0, "機械": 0.5, "冰": 0.5, "光": 0.5, "聖靈": 0.5, "邪靈": 0.5, "自然": 0.5, "神靈": 0.5, "輪迴": 0.5, "虛空": 0.5 },
  "暗影": { "超能": 2.0, "暗影": 2.0, "次元": 2.0, "機械": 0.5, "冰": 0.5, "光": 0.5, "聖靈": 0.5, "邪靈": 0.5, "神靈": 0.5 },
  "神秘": { "電": 2.0, "神秘": 2.0, "聖靈": 2.0, "自然": 2.0, "王": 2.0, "神靈": 2.0, "輪迴": 2.0, "地面": 0.5, "戰鬥": 0.5, "邪靈": 0.5, "混沌": 0.5, "蟲": 0.5 },
  "龍": { "冰": 2.0, "龍": 2.0, "聖靈": 2.0, "邪靈": 2.0, "草": 0.5, "水": 0.5, "火": 0.5, "電": 0.5, "遠古": 0.5, "蟲": 0.5 },
  "聖靈": { "草": 2.0, "水": 2.0, "火": 2.0, "電": 2.0, "冰": 2.0, "遠古": 2.0, "虛空": 2.0, "戰鬥": 0.5, "神秘": 0.5, "龍": 0.5, "輪迴": 0.5 },
  "次元": { "飛行": 2.0, "機械": 2.0, "超能": 2.0, "邪靈": 2.0, "自然": 2.0, "蟲": 2.0, "虛空": 2.0, "暗影": 0.0, "冰": 0.5, "王": 0.5, "混沌": 0.5, "神靈": 0.5, "輪迴": 0.5 },
  "遠古": { "草": 2.0, "飛行": 2.0, "神秘": 2.0, "龍": 2.0, "虛空": 2.0, "機械": 0.5, "冰": 0.5, "王": 0.5, "輪迴": 0.5 },
  "邪靈": { "光": 2.0, "暗影": 2.0, "神秘": 2.0, "次元": 2.0, "自然": 2.0, "神靈": 0.0, "機械": 0.5, "冰": 0.5, "超能": 0.5, "聖靈": 0.5, "王": 0.5, "混沌": 0.5, "輪迴": 0.5 },
  "自然": { "草": 2.0, "水": 2.0, "火": 2.0, "飛行": 2.0, "電": 2.0, "地面": 2.0, "光": 2.0, "王": 2.0, "輪迴": 2.0, "機械": 0.5, "超能": 0.5, "戰鬥": 0.5, "暗影": 0.5, "神秘": 0.5, "次元": 0.5, "邪靈": 0.5, "混沌": 0.5, "虛空": 0.5 },
  "王": { "戰鬥": 2.0, "暗影": 2.0, "次元": 2.0, "邪靈": 2.0, "超能": 0.5, "自然": 0.5, "蟲": 0.5 },
  "混沌": { "飛行": 2.0, "冰": 2.0, "神秘": 2.0, "次元": 2.0, "邪靈": 2.0, "自然": 2.0, "神靈": 2.0, "虛空": 0.0, "電": 0.5, "機械": 0.5, "戰鬥": 0.5, "輪迴": 0.5 },
  "神靈": { "草": 2.0, "水": 2.0, "火": 2.0, "電": 2.0, "冰": 2.0, "遠古": 2.0, "邪靈": 2.0, "混沌": 2.0, "機械": 0.5, "戰鬥": 0.5, "龍": 0.5 },
  "輪迴": { "光": 2.0, "暗影": 2.0, "聖靈": 2.0, "次元": 2.0, "邪靈": 2.0, "混沌": 2.0, "冰": 0.5, "超能": 0.5, "自然": 0.5, "虛空": 0.5 },
  "蟲": { "草": 2.0, "地面": 2.0, "戰鬥": 2.0, "混沌": 2.0, "蟲": 2.0, "水": 0.5, "火": 0.5, "冰": 0.5, "光": 0.5 },
  "虛空": { "超能": 2.0, "戰鬥": 2.0, "光": 2.0, "神秘": 2.0, "自然": 2.0, "輪迴": 2.0, "虛空": 2.0, "飛行": 0.5, "暗影": 0.5, "聖靈": 0.5, "次元": 0.5 }
};

// Global for runtime overrides
let dynamicMatchups: any = null;

export function setDynamicMatchups(overrides: any) {
  dynamicMatchups = overrides;
}

export function normalizeDualType(t: string): string {
  if (!t) return "普通";
  if (t === "混沌暗影" || t === "混沌/暗影" || t === "混沌·暗影") return "混沌.暗影";
  if (t === "冰暗影" || t === "冰/暗影" || t === "冰·暗影") return "冰.暗影";
  if (t === "聖靈光" || t === "光聖靈" || t === "聖靈/光" || t === "聖靈·光") return "聖靈.光";
  if (t === "混沌水" || t === "水混沌" || t === "混沌/水" || t === "混沌·水") return "混沌.水";
  if (t === "飛行超能" || t === "飛行/超能" || t === "飛行·超能") return "飛行.超能";
  return t;
}

export function getAttributeBadgeColor(type: string): string {
  if (!type) return "bg-neutral-600/30 text-neutral-300 border border-neutral-500/50";
  const norm = normalizeDualType(type);
  const colors: { [key: string]: string } = {
    草: "bg-emerald-600/30 text-emerald-400 border border-emerald-500/50",
    水: "bg-blue-600/30 text-blue-400 border border-blue-500/50",
    火: "bg-rose-600/30 text-rose-400 border border-rose-500/50",
    電: "bg-amber-600/30 text-amber-400 border border-amber-500/50",
    地: "bg-amber-800/30 text-amber-500 border border-amber-800/50",
    地面: "bg-amber-800/30 text-amber-500 border border-amber-800/50",
    飛行: "bg-sky-600/30 text-sky-400 border border-sky-500/50",
    光: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    暗影: "bg-purple-900/40 text-purple-300 border border-purple-800/50",
    戰鬥: "bg-orange-700/30 text-orange-400 border border-orange-600/50",
    機械: "bg-slate-500/30 text-slate-300 border border-slate-400/50",
    冰: "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30",
    聖靈: "bg-indigo-600/30 text-indigo-300 border border-indigo-500/50",
    神靈: "bg-amber-500/20 text-amber-200 border border-amber-400/50",
    普通: "bg-neutral-600/30 text-neutral-300 border border-neutral-500/50",
    無屬性: "bg-neutral-600/30 text-neutral-300 border border-neutral-500/50",
    王: "bg-amber-500/30 text-amber-300 border border-amber-500/50",
    混沌: "bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-800/50",
    輪迴: "bg-teal-600/30 text-teal-300 border border-teal-500/50",
    次元: "bg-violet-600/30 text-violet-300 border border-violet-500/50",
    遠古: "bg-stone-600/30 text-stone-300 border border-stone-500/50",
    邪靈: "bg-pink-900/40 text-pink-400 border border-pink-800/50",
    自然: "bg-green-600/30 text-green-300 border border-green-500/50",
    神秘: "bg-purple-600/30 text-purple-300 border border-purple-500/50",
    龍: "bg-indigo-800/40 text-indigo-300 border border-indigo-700/50",
    蟲: "bg-lime-600/30 text-lime-300 border border-lime-500/50",
    虛空: "bg-slate-800/60 text-slate-300 border border-slate-700/50",
    超能: "bg-pink-600/30 text-pink-400 border border-pink-500/50",
    未知: "bg-slate-800/80 text-slate-400 border border-slate-600/60",
    未知精靈: "bg-slate-800/80 text-slate-400 border border-slate-600/60",
    "混沌.暗影": "bg-fuchsia-950/60 text-fuchsia-300 border border-purple-700/60",
    "冰.暗影": "bg-cyan-950/60 text-cyan-300 border border-purple-700/60",
    "聖靈.光": "bg-indigo-950/60 text-yellow-300 border border-indigo-500/60",
    "混沌.水": "bg-fuchsia-950/60 text-blue-300 border border-blue-600/60",
    "水.混沌": "bg-blue-950/60 text-fuchsia-300 border border-fuchsia-600/60",
    "飛行.超能": "bg-sky-950/60 text-pink-300 border border-sky-500/60",
    "聖靈.神秘": "bg-indigo-950/60 text-purple-300 border border-indigo-500/60",
  };
  const primary = norm.split(".")[0];
  return colors[norm] || colors[type] || colors[primary] || "bg-violet-600/30 text-violet-400 border border-violet-500/50";
}

// 雙攻單：F(x1, x2)
function calcDualAttackVsSingle(x1: number, x2: number): number {
  if (x1 + x2 === 4) return 4;                    // x1=x2=2 的情況
  if (x1 * x2 === 0) return (x1 + x2) / 4;         // 其中一個是0（完全無效）
  return (x1 + x2) / 2;                             // 其餘情況
}

export function getTypeMatchup(attackerType: string, defenderType: string): number {
  if (attackerType === "普通" || attackerType === "無屬性") return 1.0;

  const normA = normalizeDualType(attackerType);
  const normD = normalizeDualType(defenderType);
  const aTypes = normA.split(".");
  const dTypes = normD.split(".");

  // 單攻單：直接查表
  if (aTypes.length === 1 && dTypes.length === 1) return getSingleTypeMatchup(aTypes[0], dTypes[0]);
  // 單攻雙：A 打 C、A 打 D 兩個係數同樣套用 F(x1,x2)（雙克制＝4、含無效＝和/4、其餘＝和/2）
  if (aTypes.length === 1 && dTypes.length === 2) {
    return calcDualAttackVsSingle(getSingleTypeMatchup(aTypes[0], dTypes[0]), getSingleTypeMatchup(aTypes[0], dTypes[1]));
  }

  // 雙攻單：攻擊方兩個屬性，防守方一個屬性 → 直接套用 F(x1,x2)
  if (aTypes.length === 2 && dTypes.length === 1) {
    const x1 = getSingleTypeMatchup(aTypes[0], dTypes[0]);
    const x2 = getSingleTypeMatchup(aTypes[1], dTypes[0]);
    return calcDualAttackVsSingle(x1, x2);
  }

  // 雙攻雙：攻擊方兩個屬性，防守方兩個屬性 → 分別對C、對D算F，再取平均 G=(FC+FD)/2
  if (aTypes.length === 2 && dTypes.length === 2) {
    const [c, d] = dTypes;
    const xC1 = getSingleTypeMatchup(aTypes[0], c);
    const xC2 = getSingleTypeMatchup(aTypes[1], c);
    const FC = calcDualAttackVsSingle(xC1, xC2);

    const xD1 = getSingleTypeMatchup(aTypes[0], d);
    const xD2 = getSingleTypeMatchup(aTypes[1], d);
    const FD = calcDualAttackVsSingle(xD1, xD2);

    return (FC + FD) / 2;
  }

  return 1.0; // 理論上不會走到這裡，防禦性預設值
}

function getSingleTypeMatchup(attacker: string, defender: string): number {
  if (attacker === "普通" || attacker === "無屬性") return 1.0;
  
  // Check dynamic overrides first
  if (dynamicMatchups && dynamicMatchups[attacker] && dynamicMatchups[attacker][defender] !== undefined) {
    return dynamicMatchups[attacker][defender];
  }

  const attackerRelations = TYPE_MATCHUPS[attacker];
  if (!attackerRelations) return 1.0;
  
  const multiplier = attackerRelations[defender];
  return multiplier !== undefined ? multiplier : 1.0;
}

/**
 * 徹底重置精靈於對局開始或結束時的所有狀態 (PP、體力、能力值上限與各類印記與暫存效果)
 */
export function resetElfStateForBattle(elf: Elf, isStarter: boolean = false, suit?: string): Elf {
  if (!elf) return elf;
  const cloned: Elf = JSON.parse(JSON.stringify(elf));
  cloned.effects = [];
  delete cloned.illusion;
  delete (cloned as any).orbHpBonus;
  cloned.originalType = cloned.originalType || cloned.type;
  cloned.type = cloned.originalType;
  
  // 1. 重置 PP 值與 PP 值上限，清空符文與 PP 限制印記
  if (cloned.skills) {
    cloned.skills = cloned.skills.map((s: any) => {
      const originalMax = isSkillStone(s) ? stoneBasePp(s) : s.maxPp !== undefined ? s.maxPp : (s.pp !== undefined ? s.pp : 5);
      // 投石者（墜星特有）：裝備的技能石 PP 上限 +10
      const stoneOffset = isSkillStone(s) && isStoneThrower(cloned) ? 10 : 0;
      const effectiveMax = Math.max(0, originalMax + (s.ppMaxOffset || 0) + (cloned.globalPpMaxOffset || 0) + stoneOffset);
      const cleanSk: any = {
        ...s,
        maxPp: originalMax,
        pp: effectiveMax,
      };
      if (cloned.name === "變革·馬爾修斯") {
        cleanSk.charge = effectiveMax;
      }
      delete cleanSk.skillRune;
      delete cleanSk.isRuneActive;
      delete cleanSk.isPpPenalized;
      return cleanSk;
    });
  }

  // 2. 重置體力值與體力上限
  if (cloned.name && cloned.name.includes("魔獅迪露")) {
    cloned.maxHp = 3000000;
    cloned.currentHp = 3000000;
  } else {
    // 若有自訂或保存的原始體力上限則還原，並讓當前體力回滿
    if (cloned.calculatedStats && cloned.calculatedStats.hp > 0) {
      cloned.maxHp = cloned.calculatedStats.hp;
    } else if (Number.isFinite((cloned as any).originalMaxHp) && (cloned as any).originalMaxHp > 0) {
      cloned.maxHp = (cloned as any).originalMaxHp;
    }
    cloned.currentHp = cloned.maxHp;
  }
  if (cloned.survivalRule?.mode === "god_descent") {
    cloned.survivalRule = { ...cloned.survivalRule, active: true, preserveOffField: true, minHp: -70 * cloned.maxHp };
  } else if (cloned.survivalRule?.mode === "freeze_at_zero") {
    cloned.survivalRule = { ...cloned.survivalRule, active: true, preserveOffField: true, minHp: 0 };
  }

  // 3. 重置能力等級與印記狀態
  cloned.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
  cloned.openingSpAtk = cloned.calculatedStats?.spatk || cloned.baseStats?.spatk || 500;
  cloned.openingSpDef = cloned.calculatedStats?.spdef || cloned.baseStats?.spdef || 500;
  cloned.battleStatus = "normal";
  cloned.battleStatusDuration = 0;
  cloned.battleStatuses = {};
  cloned.effects = [];
  cloned.marks = [];
  cloned.demonShackles = undefined;
  
  const suitDef = suit ? SUIT_CATALOG[suit] : undefined;
  cloned.shield = isStarter ? (suitDef?.effects?.starterShield || 0) : 0;
  
  cloned.barrier = 0;
  cloned.bonusPriorityTurns = 0;
  delete (cloned as any).canRevive;
  delete (cloned as any).isRevived;

  // 4. 清空奧丁、斯嘉麗、珀妮、馬爾修斯等所有戰鬥專屬暫存旗標與效果印記
  delete cloned.hasTyrRune;
  delete cloned.hasNydDebuff;
  delete cloned.odinTurnsInBattle;
  delete cloned.odinNextKillTransferRunes;
  delete cloned.odinNextDeathTransferRunes;
  delete cloned.odinDrainHp5Turns;
  delete cloned.odinDmgBoost3Turns;
  delete cloned.odinNoSwitch2Turns;
  delete cloned.odinNext2TurnsPriority2;
  delete (cloned as any).scarletReincarnationUsed;
  delete (cloned as any).puniReincarnationUsed;
  delete (cloned as any).blakeReviveUsed;
  delete (cloned as any).deluTurnStartLowHp;
  delete (cloned as any).puniShengYingStacks;
  delete (cloned as any).puniHolyLightTurns;
  delete (cloned as any).marsRecordedStatuses;
  const isWarrior = Boolean(cloned.name === "無序.六刃" || cloned.name === "無序·六刃" || cloned.soulMark?.name === "無序" || cloned.soulMark?.wuxu_trait || cloned.soulMark?.trait_warrior || cloned.alienTraits?.gen2Trait?.name?.includes("戰士"));
  if (isWarrior) {
    cloned.isConcealed = true;
  } else {
    delete (cloned as any).isConcealed;
  }
  if (cloned.name === "湮滅之主・咤克斯" || cloned.id === "zhakesi" || cloned.soulMark?.name === "咤") {
    delete cloned.alienTraits;
    delete cloned.isAlienElf;
    delete cloned.category;
    cloned.isAlienElf = false;
  }
  delete (cloned as any).isVanished;
  delete (cloned as any).hasDiedTriggered;
  delete (cloned as any).turnDamageStats;
  delete (cloned as any).hasDied;
  delete (cloned as any).soulDirgeStacks;
  delete (cloned as any).isUnclearableTurn;
  (cloned as any).isFirstStarter = isStarter;

  // 5. 蓓麗安特 (Beliant) 專屬初始化：星執
  if (cloned.name === "蓓麗安特" || cloned.soulMark?.name === "蓓") {
    // 找出異常抗性最高項 (Slots 中的最高機率項)
    let highestStatus = "無";
    let highestRate = -1;
    if (cloned.resistances?.statusResist?.slots) {
      cloned.resistances.statusResist.slots.forEach(slot => {
        if (slot.status && slot.rate > highestRate) {
          highestRate = slot.rate;
          highestStatus = slot.status;
        }
      });
    }
    cloned.starGovernanceStatus = highestStatus;
    cloned.isStarGovernorActive = false;
    cloned.starGovernorEnergy = 0;
  }

  return cloned;
}


/**
 * 戰鬥中的身高／體重（納入印記等修正）
 * - 印記 effects.weightIncreasePercentPerStack / heightIncreasePercentPerStack：每層 +X（2.0 = +200%）
 * - 印記 effects.weightMultiplier / heightMultiplier：直接相乘
 */
export function getEffectiveBody(elf: Elf, marks: { count?: number; effects?: Record<string, any> }[] = []): { height: number; weight: number } {
  let h = Number(elf?.height || 0), w = Number(elf?.weight || 0);
  let hPct = 0, wPct = 0, hMul = 1, wMul = 1;
  for (const m of marks || []) {
    const n = Math.max(0, m?.count || 0);
    const e = m?.effects || {};
    if (!n) continue;
    if (typeof e.weightIncreasePercentPerStack === "number") wPct += e.weightIncreasePercentPerStack * n;
    if (typeof e.heightIncreasePercentPerStack === "number") hPct += e.heightIncreasePercentPerStack * n;
    if (typeof e.weightMultiplier === "number") wMul *= e.weightMultiplier;
    if (typeof e.heightMultiplier === "number") hMul *= e.heightMultiplier;
  }
  return { height: Math.round(h * (1 + hPct) * hMul * 10) / 10, weight: Math.round(w * (1 + wPct) * wMul * 10) / 10 };
}
import { calculateElfStats, getDefaultEvs } from "./elfStats";
export { calculateElfStats, getDefaultEvs } from "./elfStats";
