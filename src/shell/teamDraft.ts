/**
 * 隊伍草稿 — Aegis 原生編成的資料層
 *
 * 為什麼需要它：
 *   Legacy 的編成在 StartScreen 裡（一整張表 + 拖曳 + 背包），手機上不能用。
 *   Aegis 需要自己的編成，但**存檔格式必須與 Legacy 完全一致**，
 *   否則兩邊會各自看到不同的隊伍。
 *
 * 寫入目標就是 Legacy 讀的同一個 key：
 *   seer_last_used_p1_team / seer_last_used_p2_team
 *   { team: Elf[], starterId: string, timestamp: string }
 *
 * 讀取（lastTeam.ts）與寫入（這裡）共用同一份契約，所以兩殼永遠同步。
 */
import type { Elf } from "../types";
import { LAST_USED_P1_KEY, LAST_USED_P2_KEY } from "./lastTeam";

export const TEAM_CAPACITY = 12;

/** 從精靈資料建立戰鬥實例（與 StartScreen 的 createInstance 行為一致） */
export function createBattleInstance(elf: Elf): Elf {
  const latest = JSON.parse(JSON.stringify(elf)) as Elf;
  return {
    ...latest,
    battleId: `${elf.id || elf.name}_inst_${Math.random().toString(36).slice(2, 11)}`,
    statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 },
    battleStatus: "normal",
    battleStatusDuration: 0,
    shield: 0,
    currentHp: latest.calculatedStats?.hp ?? latest.maxHp ?? 0,
    skills: (latest.skills ?? []).map(s => ({ ...s, currentPp: s.pp })),
  } as Elf;
}

export interface TeamDraft {
  members: Elf[];
  starterBattleId: string;
}

export function emptyDraft(): TeamDraft {
  return { members: [], starterBattleId: "" };
}

export function addMember(draft: TeamDraft, elf: Elf): TeamDraft {
  if (draft.members.length >= TEAM_CAPACITY) return draft;
  // 同一隻精靈（用 id/name 判斷）不重複加入
  const key = elf.id || elf.name;
  if (draft.members.some(m => (m.id || m.name) === key)) return draft;
  const inst = createBattleInstance(elf);
  const members = [...draft.members, inst];
  return {
    members,
    starterBattleId: draft.starterBattleId || inst.battleId || "",
  };
}

export function removeMember(draft: TeamDraft, battleId: string): TeamDraft {
  const members = draft.members.filter(m => m.battleId !== battleId);
  return {
    members,
    starterBattleId: draft.starterBattleId === battleId
      ? (members[0]?.battleId ?? "")
      : draft.starterBattleId,
  };
}

export function setStarter(draft: TeamDraft, battleId: string): TeamDraft {
  if (!draft.members.slice(0, 6).some(m => m.battleId === battleId)) return draft;
  return { ...draft, starterBattleId: battleId };
}

export function moveMember(draft: TeamDraft, from: number, to: number): TeamDraft {
  if (to < 0 || from < 0 || from >= draft.members.length || to >= draft.members.length || from === to) return draft;
  const members = [...draft.members];
  const [item] = members.splice(from, 1);
  members.splice(to, 0, item);
  return { ...draft, members, starterBattleId: members.slice(0, 6).some(m => m.battleId === draft.starterBattleId) ? draft.starterBattleId : members[0]?.battleId ?? '' };
}

/** 寫回 Legacy 的存檔位置（兩殼共用） */
export function saveDraft(side: "p1" | "p2", draft: TeamDraft): boolean {
  if (typeof window === "undefined") return false;
  const record = {
    team: draft.members,
    starterId: draft.starterBattleId,
    timestamp: new Date().toLocaleTimeString(),
  };
  try {
    window.localStorage.setItem(side === "p1" ? LAST_USED_P1_KEY : LAST_USED_P2_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/** 把已存的紀錄載回草稿（編輯既有隊伍用） */
export function draftFromRecord(record: { team: Elf[]; starterId: string } | null): TeamDraft {
  if (!record || !record.team?.length) return emptyDraft();
  return { members: record.team, starterBattleId: record.starterId || record.team[0]?.battleId || "" };
}
