// src/utils/battleHelpers.ts
import { Elf, Skill, BattleItem } from "../types";
import { isStoneThrower } from "../data/skillStones";
import { StatusRegistry } from "../effects/statusRegistry";
import { STATUS_NAMES_MAP } from '../effects/statusAliases';
import { canonicalStatusName, sameStatus } from '../effects/statusIdentity';
export { STATUS_NAMES_MAP } from '../effects/statusAliases';

export interface MonitorMetadata {
  key: string;
  name: string;
  ownerElf: string;
  textDescription: string;
  codeSnippet: string;
}

export const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 取得技能最小PP下限 (支持低於下限 Y 點/負數透支，例如 -5 表示允許透支至-5)
export const getMinPp = (sk?: Skill, elf?: Elf): number => {
  if (!sk) return 0;
  const skillOffset = sk.ppMinOffset || 0;
  const elfOffset = elf?.globalPpMinOffset || 0;
  return skillOffset + elfOffset;
};

// 取得技能常規與特權最大PP上限 (支持高於上限 X 點，正負偏移)
export const getMaxPp = (sk?: Skill, elf?: Elf): number => {
  if (!sk) return 5;
  const baseMax = sk.maxPp !== undefined ? sk.maxPp : (sk.pp !== undefined ? sk.pp : 5);
  const skillOffset = sk.ppMaxOffset || 0;
  const elfOffset = elf?.globalPpMaxOffset || 0;
  const stoneThrowerOffset = (elf && (isStoneThrower(elf) || elf.alienTraits?.gen2Trait?.name?.includes("投石者") || elf.trait_stone_thrower) && sk.isSkillStone) ? 10 : 0;
  return Math.max(0, baseMax + skillOffset + elfOffset + stoneThrowerOffset);
};

// PP 界限彈性轉化規範 (將新 PP 值安全限制在 [getMinPp, getMaxPp] 範圍內)
export const clampSkillPp = (sk: Skill, newPp: number, elf?: Elf): number => {
  const min = getMinPp(sk, elf);
  const max = getMaxPp(sk, elf);
  return Math.max(min, Math.min(max, newPp));
};

export const restoreSkillPp = (sk: Skill, amount: number, elf?: Elf): Skill => {
  const max = getMaxPp(sk, elf);
  const min = getMinPp(sk, elf);
  const current = sk.pp !== undefined ? sk.pp : max;
  return { ...sk, pp: Math.max(min, Math.min(max, current + amount)) };
};

export const isDimensionalDragon = (elf: Elf | undefined | null): boolean => {
  if (!elf || !elf.name) return false;
  return (
    elf.soulMark?.name === "龍" ||
    elf.type === "次元龍" ||
    elf.name.includes("次元龍") ||
    elf.name.includes("龍魂")
  );
};

export const isWuxuShiyan = (elf: Elf | undefined | null): boolean => {
  if (!elf || !elf.name) return false;
  return (
    elf.id === "wuxu_shiyan" ||
    elf.name === "無序.蝕言" ||
    elf.name === "無序·蝕言" ||
    elf.soulMark?.name === "蝕言" ||
    elf.name.includes("蝕言") ||
    (elf.alienTraits?.gen2Trait?.name || "").includes("咒術師") ||
    (elf.alienTraits?.gen2Trait?.name || "").includes("修復")
  );
};

export const getOpeningSpAtk = (elf: Elf | undefined | null): number => {
  if (!elf) return 500;
  return elf.openingSpAtk || elf.calculatedStats?.spatk || elf.baseStats?.spatk || 500;
};

export const getOpeningSpDef = (elf: Elf | undefined | null): number => {
  if (!elf) return 500;
  return elf.openingSpDef || elf.calculatedStats?.spdef || elf.baseStats?.spdef || 500;
};

export const getShiyanSpecialAttackModifiers = (
  attackerElf: Elf | undefined | null,
  defenderTeam: Elf[],
  defenderActiveIdx: number
): { active: boolean; capSpAtk: number; reductionRatio: number } => {
  const benchedShiyan = defenderTeam.find((e, idx) => idx !== defenderActiveIdx && isWuxuShiyan(e) && e.currentHp > 0);
  if (!benchedShiyan) {
    return { active: false, capSpAtk: 0, reductionRatio: 0 };
  }
  const capSpAtk = getOpeningSpAtk(attackerElf);
  const shiyanBaseSpDef = getOpeningSpDef(benchedShiyan);
  const adjustedSpDef = Math.ceil(shiyanBaseSpDef / 10);
  const reductionRatio = Math.min(1.0, adjustedSpDef * 0.02);
  return { active: true, capSpAtk, reductionRatio };
};

export const isOdin = (elf: Elf | undefined | null): boolean => {
  if (!elf || !elf.name) return false;
  return (
    elf.soulMark?.name === "ᛏ" ||
    elf.id === "odin" ||
    elf.name.includes("奧丁") ||
    elf.name.includes("眾神之父")
  );
};

export const isCthyaat = (elf: Elf | undefined | null): boolean => {
  if (!elf || !elf.name) return false;
  return (
    elf.soulMark?.name === "濁" ||
    elf.name.includes("布林克克") ||
    elf.name.includes("海妖")
  );
};

// ── PP 值限制
// isZeroPpExempt：PP 為 0 時仍可選擇（「不受PP值限制」）
// isPpCostFree：使用時不消耗 PP（「不消耗PP值」）

const hasStatDown = (elf: Elf) => Object.values(elf.statStages || {}).some(v => (v as number) < 0);
const hasAnyStatus = (elf: Elf) => Object.entries(getStatuses(elf)).some(([k, v]) => !!v && !AUXILIARY_STATUSES.includes(k));
const isSerene = (elf: Elf) => {
  const st = getStatuses(elf);
  return (st["serenity"] || 0) > 0 || (st["平靜"] || 0) > 0 || elf.battleStatus === "serenity" || elf.battleStatus === "平靜";
};
const poemStacks = (elf: Elf) => {
  const m = (elf.marks || []).find((x: any) => x.id === "poem_chapter") as any;
  return m?.effects?.poemHpSnapshots?.length || 0;
};
const isCanglan = (elf: Elf) => !!(elf.name?.includes("滄嵐") || elf.soulMark?.name === "瀾" || elf.id === "canglan");
/** 滄嵐：場上存在不擁有護盾者則使用技能不受PP值限制、不消耗技能PP值 */
const canglanActive = (elf: Elf, opp?: Elf | null) => {
  const field = [elf, opp].filter(Boolean) as Elf[];
  return field.some(e => !((e.shield || 0) > 0));
};

/** 描述中「不受PP值限制」的條件判定（例：自身處於能力下降狀態時…不受PP值限制） */
const textPpExempt = (elf: Elf, text?: string): boolean => {
  if (!text) return false;
  for (const seg of text.split(/[；;\n]/)) {
    const k = seg.search(/不受\s*(技能)?\s*PP/);
    if (k < 0) continue;
    const pre = seg.slice(0, k);
    if (/能力下降狀態時/.test(pre)) { if (hasStatDown(elf)) return true; continue; }
    if (/異常狀態時/.test(pre)) { if (hasAnyStatus(elf)) return true; continue; }
    if (/時/.test(pre) && !/選擇技能時|使用技能時/.test(pre)) continue; // 其他條件無法判定時不給豁免
    return true;
  }
  return false;
};

export const isZeroPpExempt = (elf: Elf, sk: Skill, opp?: Elf | null): boolean => {
  if (!elf || !sk || !elf.name) return false;

  // 1. 專屬機制
  if (elf.name === "變革·馬爾修斯") return true; // 充能系統
  if (isCanglan(elf) && canglanActive(elf, opp)) return true;
  if (elf.name?.includes("墜星") || elf.id === "wuxu_zhuixing") {
    const stoneCount = (elf.skills || []).filter(s => s.isSkillStone).length;
    if (stoneCount >= 4) return true;
  }
  if (isDimensionalDragon(elf) && poemStacks(elf) >= 2) return true; // 詩章 2：使用技能無視PP值限制
  if (sk.name === "星光·光合作用" || sk.name === "星光·花草能量") return true;
  if ((elf.ppLimitIgnoredWhenParalyzedTurns || 0) > 0) {
    const st = getStatuses(elf);
    const turns = Math.max(st["麻痺"] || 0, st["麻痹"] || 0, st.paralyzed || 0);
    if (turns >= (elf.ppLimitIgnoredWhenParalyzedTurns || 0)) return true;
  }
  // 深潛者盛宴：自身處於能力下降狀態時使用技能不受PP值限制
  if (sk.name === "深潛者盛宴" && Object.values(elf.statStages || {}).some((v: any) => typeof v === "number" && v < 0)) return true;

  // 2. 平靜：不受PP值限制且不消耗PP值
  if (isSerene(elf)) return true;
  if (elf.soulMark && (elf.soulMark as any).ignorePpLimit === true) return true;

  // 3. 奧丁 ᚱᚷ 符文：激活後所有技能選擇時不受PP值限制；附有 ᚱᚷ 的技能選擇時即激活
  const isRG = (s: Skill) => s.skillRune === 'ᚱᚷ' || s.specialBadge?.text === 'ᚱᚷ' || !!s.specialBadge?.id?.includes('ᚱᚷ');
  if ((elf.skills || []).some(s => isRG(s) && s.isRuneActive === true)) return true;
  if (isRG(sk)) return true;

  // 4. 已激活標記中的「不受PP」
  const hasPpExemptBadge = (elf.skills || []).some(s => {
    const badge = s.specialBadge;
    if (!badge?.description) return false;
    if (!/不受\s*(技能)?\s*PP/.test(badge.description)) return false;
    if (s.isRuneActive === false || badge.description.includes("【未激活】")) return false;
    return true;
  });
  if (hasPpExemptBadge) return true;

  // 5. 技能描述（含條件判定）
  if (textPpExempt(elf, sk.description)) return true;

  // 6. PP 下限透支
  if (sk.isPpPenalized) return false;
  const minPp = getMinPp(sk, elf);
  if (minPp < 0 && (sk.pp || 0) > minPp) return true;
  return false;
};

/** 使用技能時不消耗 PP */
export const isPpCostFree = (elf: Elf, sk: Skill, opp?: Elf | null): boolean => {
  if (!elf || !sk) return false;
  if (elf.name === "變革·馬爾修斯") return true;               // 充能系統另計
  if (elf.name?.includes("奧佩婭")) return true;               // 自身使用技能時：不消耗技能PP值
  if (isCanglan(elf) && canglanActive(elf, opp)) return true;
  if (isSerene(elf)) return true;                               // 平靜
  if (sk.name === "星光·光合作用" || sk.name === "星光·花草能量") return true;
  // 深潛者盛宴：自身處於能力下降狀態時使用技能不受PP值限制
  if (sk.name === "深潛者盛宴" && Object.values(elf.statStages || {}).some((v: any) => typeof v === "number" && v < 0)) return true;
  if (sk.description && /不消耗\s*(技能)?\s*PP/.test(sk.description) && textPpExempt(elf, sk.description.replace(/不消耗\s*(技能)?\s*PP/g, "不受PP"))) return true;
  return false;
};

export const BATTLE_ITEMS: BattleItem[] = [
  { id: 'hp_330', name: '全滿體力藥劑', description: '回復 330 點體力。不受減療影響。', type: 'hp', value: 330 },
  { id: 'hp_300', name: '超級體力藥劑', description: '回復 300 點體力。不受減療影響。', type: 'hp', value: 300 },
  { id: 'hp_250', name: '高級體力藥劑', description: '回復 250 點體力。不受減療影響。', type: 'hp', value: 250 },
  { id: 'hp_150', name: '中級體力藥劑', description: '回復 150 點體力。不受減療影響。', type: 'hp', value: 150 },
  { id: 'hp_100', name: '初級體力藥劑', description: '回復 100 點體力。不受減療影響。', type: 'hp', value: 100 },
  { id: 'hp_50', name: '微量體力藥劑', description: '回復 50 點體力。不受減療影響。', type: 'hp', value: 50 },
  { id: 'hp_20', name: '迷你體力藥劑', description: '回復 20 點體力。不受減療影響。', type: 'hp', value: 20 },
  { id: 'pp_35', name: '終極活力藥劑', description: '回復 35 點 PP 值。', type: 'pp', ppValue: 35 },
  { id: 'pp_20', name: '高級活力藥劑', description: '回復 20 點 PP 值。', type: 'pp', ppValue: 20 },
  { id: 'pp_15', name: '中級活力藥劑', description: '回復 15 點 PP 值。', type: 'pp', ppValue: 15 },
  { id: 'pp_10', name: '初級活力藥劑', description: '回復 10 點 PP 值。', type: 'pp', ppValue: 10 },
  { id: 'pp_5', name: '微量活力藥劑', description: '回復 5 點 PP 值。', type: 'pp', ppValue: 5 },
  { id: 'hybrid_150_2', name: '復甦藥劑', description: '回復 150 點體力與 2 點 PP 值。', type: 'hybrid', value: 150, ppValue: 2 },
  { id: 'special_170_clear', name: '淨化藥劑', description: '回復 170 點體力並解除異常狀態。', type: 'special', value: 170, effect: 'clear_status' },
  { id: 'special_5_debuff', name: '解弱化藥劑', description: '回復 5 點 PP 值並解除能力下降。', type: 'special', ppValue: 5, effect: 'clear_debuff' },
];

// 藥劑分類：恢復體力 / PP值 / 解除異常與弱化 / 複合型 / 特殊
export type ItemCategory = "hp" | "pp" | "cleanse" | "hybrid" | "special";
export const ITEM_CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: "hp", label: "恢復體力" },
  { key: "pp", label: "PP值" },
  { key: "cleanse", label: "解除異常與弱化" },
  { key: "hybrid", label: "複合型" },
  { key: "special", label: "特殊" },
];
export const getItemCategory = (item: BattleItem): ItemCategory => {
  const c = (item as any).category as ItemCategory | undefined;
  if (c) return c;
  if (item.effect === "clear_status" || item.effect === "clear_debuff") return "cleanse";
  if (item.type === "hp") return "hp";
  if (item.type === "pp") return "pp";
  if (item.type === "hybrid") return "hybrid";
  return "special";
};

export const AUXILIARY_STATUSES = [
  "normal", "gradual_freeze", "漸凍", "星哲", "星賜", "星佑", "星護", "星贖", "xingshu",
  "雷解", "平靜", "山神守護", "狂暴", "furious", "神話", "免疫", "異常抵抗", "致命詛咒", "虛弱詛咒", "烈焰詛咒", "flame_curse", "weakness_curse", "fatal_curse", "砥礪", "超頻",
  "star_bless", "star_guard", "star_redemption", "star_gift", "star_bearer", "星執者"
];

export const ALL_CONTROL_STATUSES = [
  "paralyzed", "paralyzed_lock", "ice_sealed", "infected", "feared",
  "fatigued", "incinerated", "sleep", "deep_sleep", "frozen", "petrified",
  "confused", "trance", "levitation", "fanatic", "cursed", "curse",
  "麻痺", "麻痹", "害怕", "疲憊", "睡眠", "石化", "癱瘓", "狂信",
  "沉睡", "冰封", "焚燼", "感染", "神游", "空定", "混亂", "詛咒"
];

export const isControlStatus = (status?: string) => {
  if (!status || status === "normal") return false;
  const entry = StatusRegistry[canonicalStatusName(status)] || StatusRegistry[status];
  if (entry) return entry.categories.includes('CONTROL');
  return ALL_CONTROL_STATUSES.includes(status);
};

// Multi-status helpers
export const getStatuses = (elf: any): Record<string, number> => {
  if (!elf) return {};
  // 查詢不得修改精靈；明確存在的空 map 代表已清除，不復活舊單狀態欄位。
  const merged: Record<string, number> = { ...(elf.battleStatuses || {}) };
  if (elf.battleStatuses === undefined && elf.battleStatus && elf.battleStatus !== 'normal') {
    merged[elf.battleStatus] = elf.battleStatusDuration ?? 1;
  }
  if (Array.isArray(elf.effects)) {
    for (const eff of elf.effects) {
      if (eff && eff.id && typeof eff.duration === "number") {
        merged[eff.id] = eff.duration;
      }
    }
  }
  return Object.fromEntries(Object.entries(merged).filter(([, duration]) => Number.isFinite(duration) && duration > 0));
};

export const isAbnormal = (elf: any): boolean => {
  const statuses = getStatuses(elf);
  return Object.values(statuses).some(turns => turns > 0);
};

export const syncLegacy = (elf: any) => {
  const statuses = elf.battleStatuses || {};
  const keys = Object.keys(statuses).filter(k => statuses[k] > 0);
  if (keys.length === 0) {
    elf.battleStatus = "normal";
    elf.battleStatusDuration = 0;
  } else {
    // Prioritize control statuses for the single display string (legacy compatibility)
    const controls = keys.filter(k => isControlStatus(k));
    const picked = controls.length > 0 ? controls[0] : keys[0];
    elf.battleStatus = picked;
    elf.battleStatusDuration = statuses[picked];
  }
};

export const addStatusEffect = (elf: any, statusId: string, duration: number) => {
  if (!elf || !statusId || statusId === "normal" || !Number.isFinite(duration) || duration <= 0) return;
  const statuses = getStatuses(elf);
  const name = canonicalStatusName(statusId);
  for (const key of Object.keys(statuses)) if (sameStatus(key, name)) { duration = Math.max(statuses[key], duration); delete statuses[key]; }
  statuses[name] = duration;
  elf.battleStatuses = statuses;
  elf.effects = (elf.effects || []).filter((e: any) => !sameStatus(e.id, name));
  elf.effects.push({ id: name, name, duration, stacks: 1 });
  syncLegacy(elf);
};

export const removeStatusEffect = (elf: any, statusId: string) => {
  const statuses = getStatuses(elf);
  for (const key of Object.keys(statuses)) if (sameStatus(key, statusId)) delete statuses[key];
  elf.battleStatuses = statuses;
  elf.effects = (elf.effects || []).filter((e: any) => !sameStatus(e.id, statusId));
  syncLegacy(elf);
};

export const clearAllStatuses = (elf: any, includeBoss = false) => {
  if (!elf) return;
  const statuses = getStatuses(elf);
  const protectedStatus = (id: string) => !includeBoss && StatusRegistry[canonicalStatusName(id)]?.categories.includes('BOSS_ONLY');
  elf.battleStatuses = Object.fromEntries(Object.entries(statuses).filter(([id]) => protectedStatus(id)));
  elf.effects = (elf.effects || []).filter((e: any) => protectedStatus(e.id));
  syncLegacy(elf);
};

export const isAuxiliaryStatus = (statusName: string): boolean => {
  const normalized = STATUS_NAMES_MAP[statusName] || statusName;
  const entry = StatusRegistry[normalized] || StatusRegistry[statusName];
  if (entry) {
    return entry.categories.includes('AUXILIARY') || entry.categories.includes('BOSS_ONLY') || entry.categories.includes('NO_EFFECT');
  }
  return AUXILIARY_STATUSES.includes(statusName);
};

export const reduceStatusDuration = (elf: any, reduction: number) => {
  if (!elf || reduction <= 0) return;
  const statuses = getStatuses(elf);
  Object.keys(statuses).forEach(k => {
    if (!isAuxiliaryStatus(k)) {
      statuses[k] = (statuses[k] || 1) - reduction;
      if (statuses[k] <= 0) {
        delete statuses[k];
      }
    }
  });
  elf.battleStatuses = statuses;
  elf.effects = (elf.effects || []).filter((e: any) => statuses[e.id] > 0).map((e: any) => ({ ...e, duration: statuses[e.id] }));
  syncLegacy(elf);
};

export const isStatusActive = (elf: any, statusId: string) => {
  const statuses = getStatuses(elf);
  return Object.entries(statuses).some(([key, turns]) => turns > 0 && sameStatus(key, statusId));
};

export const hasAnyAbnormalStatus = (elf: any) => {
  if (!elf) return false;
  const statuses = getStatuses(elf);
  return Object.keys(statuses).some(k => !isAuxiliaryStatus(k) && statuses[k] > 0);
};

export const isElfActionDisabled = (elf: any, opponent?: any) => {
  if (!elf) return false;
  const statuses = getStatuses(elf);
  if (elf.suppressAbnormalSideEffectsWhenParalyzed && Math.max(statuses["麻痺"] || 0, statuses["麻痹"] || 0, statuses.paralyzed || 0) > 0) return false;
  for (const stId of Object.keys(statuses)) {
    if (statuses[stId] > 0) {
      const entry = StatusRegistry[canonicalStatusName(stId)];
      for (const m of entry?.mechanics || []) {
        if (m.type !== "CANT_ACT") continue;
        // 狂信：只有對手為信仰對象時無法行動
        if ((m.params as any)?.condition === "FAITH_TARGET") {
          if (elf.faithTarget && opponent?.name === elf.faithTarget) return true;
          continue;
        }
        return true;
      }
    }
  }
  return false;
};

export const isElfSkillSelectionDisabled = (elf: any) => {
  if (!elf) return false;
  const statuses = getStatuses(elf);
  for (const stId of Object.keys(statuses)) {
    if (statuses[stId] > 0) {
      if (stId === "眩暈") return true;
      const entry = StatusRegistry[stId];
      if (entry?.mechanics?.some(m => m.type === "MODIFIER_LIMIT" && (m.params as any)?.disableAllSkillSelection)) return true;
    }
  }
  return false;
};

/** 「無法主動切換精靈 N 回合」：寫在被限制方的註冊狀態 noSwitchTurns（或 p1_/p2_ 前綴） */
export const getNoSwitchTurns = (state: any, side: "p1" | "p2"): number => {
  const reg = state?.[side === "p1" ? "p1RegistryState" : "p2RegistryState"] || {};
  return Math.max(reg.noSwitchTurns || 0, reg[`${side}_noSwitchTurns`] || 0);
};

export const isElfSwitchDisabled = (elf: any, oppElf: any, isTyrDuelField: boolean, noSwitchTurns: number) => {
  if (!elf) return false;
  if (noSwitchTurns > 0) return true;
  if ((elf.odinNoSwitch2Turns || 0) > 0) return true;
  if (isTyrDuelField && elf.currentHp > 0 && oppElf && oppElf.currentHp > 0) return true;
  if (elf.battleStatus === "paralyzed_lock" || elf.battleStatus === "癱瘓") return true;

  const statuses = getStatuses(elf);
  for (const stId of Object.keys(statuses)) {
    if (statuses[stId] > 0) {
      if (stId === "paralyzed_lock" || stId === "癱瘓") return true;
      const entry = StatusRegistry[stId];
      if (entry?.mechanics?.some(m => m.type === "CANT_SWITCH")) return true;
    }
  }
  return false;
};

export const isElfItemDisabled = (elf: any) => {
  if (!elf) return false;
  if (elf.battleStatus === "繳械" || elf.battleStatus === "失溫") return true;

  const statuses = getStatuses(elf);
  for (const stId of Object.keys(statuses)) {
    if (statuses[stId] > 0) {
      if (stId === "繳械" || stId === "失溫") return true;
      const entry = StatusRegistry[stId];
      if (entry?.mechanics?.some(m => m.type === "MODIFIER_LIMIT" && (m.params as any)?.disablePotions)) return true;
    }
  }
  return false;
};

export const EFFECT_MONITOR_METADATA: MonitorMetadata[] = [
  {
    key: "ImmuneStatDebuffTurns",
    name: "星垂穹儀 · 命運干涉 (屬性降免)",
    ownerElf: "蓓麗安特",
    textDescription: "5 回合內自身免疫受到的能力下降狀態",
    codeSnippet: `// 判定能力下降時攔截
const isImmune = getPlayerState("ImmuneStatDebuffTurns") > 0;
if (isImmune) {
  addLog("✨ 【星垂穹儀】命運干涉：自身免疫受到的能力下降狀態！");
  return;
}`
  },
  {
    key: "BelienteVaultTurns",
    name: "星垂穹儀 · 星河祈願 (切換守護)",
    ownerElf: "蓓麗安特",
    textDescription: "自身下次主動切換下場後，令新出戰精靈抵擋下次傷害、恢復300體力並附加星賜",
    codeSnippet: `// 己方精靈手動或被動下場，新精靈登場時觸發
if (getPlayerState("BelienteVaultTurns") > 0) {
  newElf.shield = (newElf.shield || 0) + 300;
  newElf.currentHp = Math.min(newElf.maxHp, newElf.currentHp + 300);
  applyStatusWithImmunityCheck(side, "star_gift", 3);
  setPlayerState("BelienteVaultTurns", 0);
}`
  },
  {
    key: "DmgToHealNextTurn",
    name: "星垂穹儀 · 星光倒流 (傷害轉化)",
    ownerElf: "蓓麗安特",
    textDescription: "令自身下 1 次受到的攻擊傷害轉化為體力",
    codeSnippet: `// 受到對手攻擊傷害結算時
if (getPlayerState("DmgToHealNextTurn")) {
  self.currentHp = Math.min(self.maxHp, self.currentHp + damageAmount);
  addLog("✨ 【星光倒流】：將受到的傷害轉化為等量體力恢復！");
  setPlayerState("DmgToHealNextTurn", false);
}`
  },
  {
    key: "BelienteBuffLockTurns",
    name: "星河入眸 · 星河守護 (強化保護)",
    ownerElf: "蓓麗安特",
    textDescription: "3 回合內能力提升狀態無法 be 消除或吸取",
    codeSnippet: `// 對手使用消強或吸強效果時
if (getPlayerState("BelienteBuffLockTurns") > 0) {
  addLog("✨ 【星河守護】：受星光保護，能力提升無法被消除或吸取！");
  return; // 拒絕消強
}`
  },
  {
    key: "ImmuneReflectTurns",
    name: "星河入眸 · 星瀾反噬 (異常彈控)",
    ownerElf: "蓓麗安特",
    textDescription: "5 回合內自身免疫並反彈所有受到的異常狀態",
    codeSnippet: `// 受到異常狀態影響時攔截並彈回
if (getPlayerState("ImmuneReflectTurns") > 0) {
  addLog("✨ 【星瀾反噬】：反彈異常狀態！反射給對手！");
  applyStatusWithImmunityCheck(oppSide, incomingStatus, duration);
  return;
}`
  },
  {
    key: "BelienteRegenTurns",
    name: "星河入眸 · 星能沐浴 (每回合回血與百分比傷害)",
    ownerElf: "蓓麗安特",
    textDescription: "4 回合內每回合恢復自身最大體力的 1/2 並造成等量百分比傷害",
    codeSnippet: `// 回合結束時觸發
if (getPlayerState("BelienteRegenTurns") > 0) {
  const healVal = Math.floor(self.maxHp / 2);
  self.currentHp = Math.min(self.maxHp, self.currentHp + healVal);
  applyPinkDamage(oppSide, healVal, "星能沐浴");
}`
  },
  {
    key: "BelienteDrainHpTurns",
    name: "星河入眸 · 星河洞悉 (吸取固定體力)",
    ownerElf: "蓓麗安特",
    textDescription: "3 回合內使用技能汲取對手 240 點體力",
    codeSnippet: `// 使用技能後觸發吸血
if (getPlayerState("BelienteDrainHpTurns") > 0) {
  const actualDrain = applyPinkDamage(oppSide, 240, "星河洞悉");
  self.currentHp = Math.min(self.maxHp, self.currentHp + actualDrain);
}`
  },
  {
    key: "DodgeTurns",
    name: "星河入眸 / 萬魂歸寂 · 閃避守護",
    ownerElf: "蓓麗安特 / 悲歌·索比拉特",
    textDescription: "100% 閃避對手的攻擊技能，處於閃避狀態",
    codeSnippet: `// 對手出招時判定是否躲避
if (getPlayerState("DodgeTurns") > 0) {
  addLog("✨ 完美迴避了對手的攻擊技能！");
  isEvaded = true;
}`
  },
  {
    key: "BelienteDodgePunishTurns",
    name: "星河入眸 · 命運拷問 (未閃避懲罰)",
    ownerElf: "蓓麗安特",
    textDescription: "若閃避被突破/被命中，則清空對手 2 項技能的 PP",
    codeSnippet: `// 閃避失效或被命中時觸發
if (getPlayerState("BelienteDodgePunishTurns") > 0) {
  const valid = target.skills.filter(s => s.pp > 0);
  const toClear = shuffleArray(valid).slice(0, 2);
  toClear.forEach(s => { s.pp = 0; });
  addLog("✨ 【命運拷問】：自身受到命中，清空對手 2 項技能的所有 PP！");
}`
  },
  {
    key: "BelienteExtraDmgTurns",
    name: "星河入眸 · 星淵崩落 (傷害翻倍)",
    ownerElf: "蓓麗安特",
    textDescription: "下 2 回合造成的傷害額外 100%",
    codeSnippet: `// 攻擊威力/傷害計算
if (getPlayerState("BelienteExtraDmgTurns") > 0) {
  finalDamage *= 2.0;
}`
  },
  {
    key: "BelientePriorityTurns",
    name: "星河入眸 · 星河之速 (先制+3)",
    ownerElf: "蓓麗安特",
    textDescription: "下 2 回合令自身使用所有技能先制 +3",
    codeSnippet: `// 出招優先度判定
if (getPlayerState("BelientePriorityTurns") > 0) {
  skillPriority += 3;
}`
  },
  {
    key: "BelienteNextSureHit",
    name: "星祈·繞指星瀾 · 星宿傳承 (必定先手)",
    ownerElf: "蓓麗安特",
    textDescription: "己方下一隻登場精靈首次使用所有技能必定先手，且登場時獲得能量",
    codeSnippet: `// 新出戰精靈出招判定
if (getPlayerState("BelienteNextSureHit")) {
  skillPriority += 99; // 擁有最高優先度
  setPlayerState("BelienteNextSureHit", false);
}`
  },
  {
    key: "BelienteAttributeInvalidTurns",
    name: "星執·浩邃星幕 · 星辰封鎖 (封印對手屬性技)",
    ownerElf: "蓓麗安特",
    textDescription: "對手 3 回合內屬性技能無效",
    codeSnippet: `// 敵方出招屬性技能判定
if (getOpponentState("BelienteAttributeInvalidTurns") > 0) {
  addLog("✨ 【星辰封鎖】：對手屬性技能受星軌結界壓制而失敗！");
  return false;
}`
  },
  {
    key: "BelienteWeakenTurns",
    name: "星執·浩邃星幕 · 混沌星河 (攻擊附加隨機弱化)",
    ownerElf: "蓓麗安特",
    textDescription: "3 回合內自身使用技能後 100% 隨機附加 2 種弱化類異常狀態",
    codeSnippet: `// 主動擊中對手後
if (getPlayerState("BelienteWeakenTurns") > 0) {
  applyRandomWeaken(oppSide, 2);
}`
  },
  {
    key: "BelienteNextElfAdditionalInvalid",
    name: "星執·浩邃星幕 · 星辰湮滅 (登場首次附加無效)",
    ownerElf: "蓓麗安特",
    textDescription: "當回合擊敗對手，令對手下隻登場精靈首次技能附加效果失效",
    codeSnippet: `// 敵方新精靈登場後首次出招
if (getOpponentState("BelienteNextElfAdditionalInvalid")) {
  addLog("✨ 【星辰湮滅】：對手首次技能的所有附加效果失效！");
  setOpponentState("BelienteNextElfAdditionalInvalid", false);
}`
  },
  {
    key: "ChaosBlakeJieranTurns",
    name: "孑然孤夢 · 夢魘吸食 (回合吸血)",
    ownerElf: "混沌·布萊克",
    textDescription: "4 回合內每回合吸取對手最大體力 1/3（自身半血以下效果翻倍，對手免疫則附加 250 點真傷）",
    codeSnippet: `// 混沌·布萊克回合結束
if (getPlayerState("ChaosBlakeJieranTurns") > 0) {
  let ratio = 0.33;
  if (self.currentHp < self.maxHp / 2) ratio = 0.66;
  const actualDrain = applyPinkDamage(oppSide, self.maxHp * ratio);
  if (oppImmune) {
    applyTrueDamage(oppSide, 250);
  }
}`
  },
  {
    key: "ChaosBlakeJieranCritHealTurns",
    name: "孑然孤夢 · 宿命狙擊 (暴擊吸血)",
    ownerElf: "混沌·布萊克",
    textDescription: "下 2 回合致命一擊吸取對手 350 體力",
    codeSnippet: `// 暴擊結算
if (getPlayerState("ChaosBlakeJieranCritHealTurns") > 0 && isCrit) {
  const heal = applyPinkDamage(oppSide, 350);
  self.currentHp = Math.min(self.maxHp, self.currentHp + heal);
}`
  },
  {
    key: "ChaosBlakeJieranPriorityCritTurns",
    name: "孑然孤夢 · 噩夢先鋒 (先制+2與必暴擊)",
    ownerElf: "混沌·布萊克",
    textDescription: "下 2 回合所有技能先制 +2 且必定致命",
    codeSnippet: `// 出招與暴擊率計算
if (getPlayerState("ChaosBlakeJieranPriorityCritTurns") > 0) {
  skillPriority += 2;
  isCritGuaranteed = true;
}`
  },
  {
    key: "ChaosBlakeNextFirst",
    name: "夜洛烏澤 · 黑夜支配者 (必定先手)",
    ownerElf: "混沌·布萊克",
    textDescription: "吸取對手能力提升狀態，成功則下 1 回合必定先出手",
    codeSnippet: `// 回合出招順序判定
if (getPlayerState("ChaosBlakeNextFirst")) {
  skillPriority += 50;
  setPlayerState("ChaosBlakeNextFirst", false);
}`
  },
  {
    key: "ChaosBlakeAnyaoyTurns",
    name: "暗耀明滅 · 混沌主宰 (招式干涉/全能反制)",
    ownerElf: "混沌·布萊克",
    textDescription: "3 回合內對手使用攻擊技能則自身全屬性+1且對手屬性技能失效；使用屬性技能則對手全屬性-1且其攻擊技能失效並附加效果失效",
    codeSnippet: `// 對手出招時
if (getPlayerState("ChaosBlakeAnyaoyTurns") > 0) {
  if (oppSkill.isAttack) {
    stagesPlusOne(self);
    oppSkill.effectsInvalid = true; // 屬性無效
  } else {
    stagesMinusOne(target);
    oppSkill.damageInvalid = true; // 攻擊技能無傷害
  }
}`
  },
  {
    key: "ChaosBlakeAnyaoyImmuneReflectTurns",
    name: "暗耀明滅 · 暗黑回溯 (異常抵抗與反彈)",
    ownerElf: "混沌·布萊克",
    textDescription: "5 回合內免疫並反彈除狂暴外所有受到的異常狀態",
    codeSnippet: `// 判定受到異常狀態時
if (getPlayerState("ChaosBlakeAnyaoyImmuneReflectTurns") > 0) {
  if (incomingStatus !== "frenzy") {
    addLog("🌑 【暗黑回溯】：除狂暴外反彈此異常狀態！");
    applyStatusWithImmunityCheck(oppSide, incomingStatus, duration);
    return;
  }
}`
  },
  {
    key: "HealTurns",
    name: "陰世遊靈 · 萬魂復甦 (回合回血)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "4 回合內每回合恢復自身最大體力 1/3",
    codeSnippet: `// 悲歌·索比拉特回合結束
if (getPlayerState("HealTurns") > 0) {
  const healAmt = Math.floor(self.maxHp * 0.33);
  self.currentHp = Math.min(self.maxHp, self.currentHp + healAmt);
}`
  },
  {
    key: "TrueDamageTurns",
    name: "陰世遊靈 · 冤魂索命 (附加真傷)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "3 回合內每回合附加 300 點真實傷害",
    codeSnippet: `// 攻擊命中或回合結束
if (getPlayerState("TrueDamageTurns") > 0) {
  applyTrueDamage(oppSide, 300);
}`
  },
  {
    key: "PriorityBoostTurns",
    name: "陰世遊靈 · 遊魂先制 (先制+2)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "下 2 回合自身所有技能先制 +2",
    codeSnippet: `// 出招優先度計算
if (getPlayerState("PriorityBoostTurns") > 0) {
  skillPriority += 2;
}`
  },
  {
    key: "DarkScarBonusTurns",
    name: "影之牢籠 · 詛咒之印 (換人受到詛咒印記傷害)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "令對手下隻精靈額外受到詛詛咒印記傷害",
    codeSnippet: `// 對手切換精靈登場時觸發
if (getOpponentState("DarkScarBonusTurns") > 0) {
  applyPinkDamage(oppSide, 200, "詛咒之印記爆發");
}`
  },
  {
    key: "StatusReflectTurns",
    name: "幽冥噬魂 · 幽影彈控 (異常抵抗與彈控)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "5 回合內自身免疫並反彈所有異常狀態",
    codeSnippet: `// 判定異常狀態附加
if (getPlayerState("StatusReflectTurns") > 0) {
  addLog("✨ 【幽影彈控】：反彈異常狀態！");
  applyStatusWithImmunityCheck(oppSide, incomingStatus, duration);
  return;
}`
  },
  {
    key: "FearSkillTurns",
    name: "幽冥噬魂 · 恐怖凝視 (受擊100%害怕)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "3 回合內若自身受攻擊則 100% 令對手害怕",
    codeSnippet: `// 受到對手攻擊命中時觸發
if (getPlayerState("FearSkillTurns") > 0) {
  applyStatusWithImmunityCheck(oppSide, "feared", 1);
}`
  },
  {
    key: "BindTurns",
    name: "幽冥噬魂 · 陰影枷鎖 (束縛)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "令對手進入 3 回合束縛狀態 (無法切換並每回合受150固定傷害)",
    codeSnippet: `// 敵方回合結束或切換精靈時
if (getPlayerState("BindTurns") > 0) {
  applyPinkDamage(oppSide, 150, "陰影枷鎖勒緊");
}`
  },
  {
    key: "SealPropertyTurns",
    name: "黯·萬魂歸寂 · 冥河封鎖 (屬性封印)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "對手 2 回合內無法使用屬性技能",
    codeSnippet: `// 對手意圖使用屬性技能時判定
if (getPlayerState("SealPropertyTurns") > 0) {
  addLog("✨ 【冥河封鎖】：屬性技能受封鎖施放失敗！");
  return false;
}`
  },
  {
    key: "SurviveTurns",
    name: "黯·萬魂歸寂 · 不死意志 (免死)",
    ownerElf: "悲歌·索比拉特",
    textDescription: "3 回合內若自身體力歸零則觸發免死並恢復1點體力",
    codeSnippet: `// 自身體力因攻擊、固傷、真傷扣減至0 or 以下時
if (getPlayerState("SurviveTurns") > 0 && self.currentHp <= 0) {
  self.currentHp = 1;
  addLog("✨ 【不死意志】：體力歸零！觸發免死金身，保留 1 點體力！");
}`
  }
];
