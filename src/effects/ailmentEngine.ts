import { StatusRegistry } from './statusRegistry';
import { BattleEventContext } from './types';

// 別名對照表（包含常見繁簡體、英文 ID 或簡稱與 statusRegistry 中 name 的映射）
const AILMENT_ALIAS_MAP: Record<string, string> = {
  "麻痺": "麻痹",
  "凍結": "冰封",
  "冰凍": "冰封",
  "frozen": "冰封",
  "paralyzed": "麻痹",
  "feared": "害怕",
  "sleep": "睡眠",
  "petrified": "石化",
  "paralyzed_lock": "癱瘓",
  "cursed": "詛咒",
  "fanatic": "狂信",
  "deep_sleep": "沉睡",
  "ice_sealed": "冰封",
  "incinerated": "焚燼",
  "infected": "感染",
};

/**
 * 判斷指定之異常狀態名稱或 ID 是否屬於「控制類異常」
 * 讀取 src/effects/statusRegistry.ts 中的資料進行動態判定
 * 
 * @param name 異常狀態名稱或 ID (例如: "麻痹", "害怕", "feared", "冰封")
 * @return boolean 是否屬於控制類異常
 */
export function isControlAilment(name: string): boolean {
  if (!name || typeof name !== 'string') return false;

  const normalized = AILMENT_ALIAS_MAP[name] || name;
  const entry = StatusRegistry[normalized] || StatusRegistry[name];

  if (entry) {
    return entry.categories.includes('CONTROL');
  }

  return false;
}

/**
 * 查詢異常狀態所屬的主分類名稱
 */
export function getAilmentCategory(name: string): string | null {
  if (!name) return null;
  const normalized = AILMENT_ALIAS_MAP[name] || name;
  const entry = StatusRegistry[normalized] || StatusRegistry[name];

  if (entry && entry.categories.length > 0) {
    return entry.categories[0];
  }
  return null;
}

/**
 * 檢查目標精靈是否具備「控制類異常免疫」機制 (包含奧丁決鬥場地、魔王咒怨5層、通用控免等)
 */
export function checkControlImmunity(
  ctx: BattleEventContext,
  targetSide: "p1" | "p2",
  statusName: string
): { immune: boolean; reason?: string } {
  // 若該異常不是控制類，不觸發控制類專屬免疫
  if (!isControlAilment(statusName)) {
    return { immune: false };
  }

  const targetElf = targetSide === "p1" ? ctx.activeP1 : ctx.activeP2;
  const targetSideKey = targetSide;

  // 1. 奧丁 / 決鬥場地 (Duel Field)
  const isOdin = targetElf?.name?.includes("奧丁");
  const isDuelActive = ctx.getPlayerState(`${targetSideKey}_duelActive`) || ctx.getPlayerState("duelActive");
  if (isOdin || isDuelActive) {
    return {
      immune: true,
      reason: `⚡ 【眾神之父·奧丁】：神聖決鬥戰場下，免疫控制類異常【${statusName}】！`
    };
  }

  // 2. 魔王咒怨 (Demon Grudge) 達到 5 層
  const targetMarks = ctx.getMarks(targetSide) || [];
  const grudgeMark = targetMarks.find((m) => m.id === "demon_grudge");
  if (grudgeMark && grudgeMark.count >= 5) {
    return {
      immune: true,
      reason: `👿 【魔王咒怨】：【${targetElf?.name || '精靈'}】的【魔王咒怨】達到 ${grudgeMark.count} 層 (≥5層)，免疫控制類異常【${statusName}】！`
    };
  }

  // 3. 通用/技能專屬 免疫控制狀態回合數
  const immuneControlTurns = ctx.getPlayerState(`${targetSideKey}_immuneControlTurns`) || ctx.getPlayerState("immuneControlTurns") || 0;
  if (immuneControlTurns > 0) {
    return {
      immune: true,
      reason: `🛡️ 【免疫控制】：【${targetElf?.name || '精靈'}】處於免疫控制狀態 (剩餘 ${immuneControlTurns} 回合)，免疫了【${statusName}】！`
    };
  }

  return { immune: false };
}
