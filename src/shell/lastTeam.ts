/**
 * 上次使用陣容 — 唯讀存取
 *
 * Aegis 大廳要顯示「我的隊伍」，但 StartScreen 把紀錄存在 localStorage
 * 且格式與戰鬥用的 Elf 不同（含 battleId、技能 PP 已同步）。
 * 這裡只做「讀 + 清理 + 摘要」，**不寫入**、不改 StartScreen 的任何行為。
 *
 * 寫入仍由 StartScreen 的「保存上次使用紀錄」負責，兩殼共用同一份資料。
 */
import type { Elf } from "../types";

export const LAST_USED_P1_KEY = "seer_last_used_p1_team";
export const LAST_USED_P2_KEY = "seer_last_used_p2_team";

export interface LastUsedRecord {
  team: Elf[];
  starterId: string;
  timestamp?: string;
}

function sanitize(team: unknown): Elf[] {
  if (!Array.isArray(team)) return [];
  return team.filter((e: any) => e && typeof e === "object" && e.name && e.calculatedStats) as Elf[];
}

export function readLastUsedRecord(side: "p1" | "p2"): LastUsedRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(side === "p1" ? LAST_USED_P1_KEY : LAST_USED_P2_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const team = sanitize(parsed?.team);
    if (!team.length) return null;
    return { team, starterId: String(parsed?.starterId ?? ""), timestamp: parsed?.timestamp };
  } catch {
    return null;
  }
}

/**
 * 隊伍結構（與 Legacy 完全一致，2026-10-21 修正）
 *
 *   前 6 格 = **出戰背包**（active）：實際會上場的 6 隻
 *   後 6 格 = **待命背包**（standby）：巔峰 BP 備用池，開局不上場
 *
 * 這與「額外精靈（isExtra）」是兩件不同的事：
 *   待命 = 玩家自己排的後備 6 隻
 *   額外 = 戰鬥中由技能召喚出來的單位（brinkk 等），不屬於隊伍
 *
 * 之前把兩者混為一談是錯的，這裡明確分開。
 */
export const ACTIVE_SLOTS = 6;
export const STANDBY_SLOTS = 6;

export interface TeamSummary {
  hasTeam: boolean;
  /** 總人數（出戰 + 待命） */
  count: number;
  /** 隊伍上限（12 = 6 出戰 + 6 待命） */
  capacity: number;
  /** 出戰 6 隻 */
  active: Elf[];
  /** 待命 6 隻 */
  standby: Elf[];
  starter: Elf | null;
  members: Elf[];
  /** 最後保存時間字串（原樣，不解析） */
  savedAt?: string;
}

export function summarizeTeam(record: LastUsedRecord | null, capacity = 12): TeamSummary {
  if (!record || !record.team.length) {
    return { hasTeam: false, count: 0, capacity, active: [], standby: [], starter: null, members: [], savedAt: record?.timestamp };
  }
  // 壞存檔容錯：null、非物件、缺 calculatedStats 一律視為無效項目
  const members = record.team
    .slice(0, capacity)
    .filter((e): e is Elf => !!e && typeof e === "object" && !!(e as Elf).name && !!(e as Elf).calculatedStats);
  const active = members.slice(0, ACTIVE_SLOTS);
  const standby = members.slice(ACTIVE_SLOTS, ACTIVE_SLOTS + STANDBY_SLOTS);
  // 壞存檔可能有 null 項目，find 前必須先過濾，否則整頁白屏
  const starter =
    active.find((e) => e?.battleId && e.battleId === record.starterId) ??
    active.find((e) => e?.id && e.id === record.starterId) ??
    active[0] ??
    null;
  // count 必須與 members 一致（截斷後的真實人數），不能回報原始長度
  return { hasTeam: true, count: members.length, capacity, active, standby, starter, members, savedAt: record.timestamp };
}

/**
 * 從任意成員陣列建立完整 TeamSummary
 *
 * 為什麼需要它：
 *   大廳在「沒有存檔」時會用精靈池組一個預覽隊伍。
 *   之前各處手動拼物件（{ hasTeam, count, capacity, starter, members }），
 *   漏掉 active / standby，導致 p1.active.length 直接 crash。
 *   統一由這裡產生，就不會再漏。
 */
export function buildTeamSummary(members: Elf[], opts?: { hasTeam?: boolean; capacity?: number; starter?: Elf | null }): TeamSummary {
  const capacity = opts?.capacity ?? 12;
  const list = members.slice(0, capacity);
  const active = list.slice(0, ACTIVE_SLOTS);
  const standby = list.slice(ACTIVE_SLOTS, ACTIVE_SLOTS + STANDBY_SLOTS);
  return {
    hasTeam: opts?.hasTeam ?? list.length > 0,
    count: list.length,
    capacity,
    active,
    standby,
    starter: opts?.starter ?? active[0] ?? null,
    members: list,
  };
}

/** 隊員的血量百分比（0–100），給大廳的細條用 */
export function hpPercent(elf: Elf): number {
  const max = elf.maxHp || elf.calculatedStats?.hp || 1;
  const cur = elf.currentHp ?? max;
  return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
}