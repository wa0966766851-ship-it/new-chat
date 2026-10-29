/**
 * 戰鬥啟動 — 兩殼共用
 *
 * 為什麼需要它：
 *   點「對戰」只是把 view 設成 "battle"，但 BattleScreen 需要 p1Team/p2Team。
 *   沒有隊伍時 LegacyScenes 的 battle 分支不會渲染，畫面會落回上一個頁面，
 *   看起來像「點了沒反應」。
 *
 *   這裡把「準備隊伍 → 呼叫 handleStartBattle」集中成一個函式，
 *   兩殼都用它，避免各自實作導致行為不同。
 */
import type { Elf } from "../types";
import type { ShellBridge, BattleFormat } from "./bridge";
import { readLastUsedRecord, summarizeTeam } from "./lastTeam";
import { readEquipment } from './equipment';
import { readAnnualBonus } from '../battle/annualBonusPreference';
import { prepareSavedBattleRoster } from '../data/prepareSavedBattleRoster';
import { bindInitialCounterparts } from '../battle/illusionPresentation';
import { validateSkillStoneLoadout } from '../data/skillStones';

export interface LaunchOptions {
  /** 指定賽制；沒給就用 bridge 目前的 */
  format?: BattleFormat;
  /** 指定隊伍；沒給就讀上次使用紀錄，再退回精靈池 */
  p1?: Elf[];
  p2?: Elf[];
  /** 是否允許在沒有存檔時用精靈池自動配對 */
  allowQuickMatch?: boolean;
}

export interface LaunchResult {
  ok: boolean;
  /** 失敗原因（給 UI 顯示） */
  reason?: "no-elves" | "same-team" | "not-ready" | "requires-bp" | "invalid-roster";
  team1?: Elf[];
  team2?: Elf[];
}

/** 從各種來源組出可用的雙方隊伍 */
export function resolveTeams(b: ShellBridge, opts: LaunchOptions = {}): LaunchResult {
  const fmt = opts.format ?? b.battleFormat;
  // 一般 6v6 與單挑用 6 隻；巔峰系列需要 12 隻（6 出戰 + 6 待命）
  const size = fmt.startsWith('peak_') ? 12 : 6;

  const fromRecord = (side: "p1" | "p2") => {
    const rec = readLastUsedRecord(side);
    if (!rec) return null;
    const summary = summarizeTeam(rec);
    // 保留待命區直到綁定幻化對應；單挑首發也必須在切片前解析。
    return summary.members.length ? summary.members : null;
  };

  let team1 = opts.p1 ?? fromRecord("p1");
  let team2 = opts.p2 ?? fromRecord("p2");

  if (!team1 || !team2) {
    if (!opts.allowQuickMatch) return { ok: false, reason: "not-ready" };
    // 快速配對：用精靈池對切
    const pool = b.allElvesCombined;
    const half = Math.max(size, 6);
    if (pool.length < 2) return { ok: false, reason: "no-elves" };
    team1 = team1 ?? pool.slice(0, half);
    team2 = team2 ?? pool.slice(half, half * 2);
    if (!team2.length) return { ok: false, reason: "same-team" };
  }

  const select = (team: Elf[], side: 'p1' | 'p2') => {
    if (fmt !== 'solo_1v1') return team.slice(0, size);
    const starter = readLastUsedRecord(side)?.starterId;
    const active = team.slice(0, 6);
    return [active.find(e => e.battleId === starter || e.id === starter) ?? active[0]].filter(Boolean);
  };
  return { ok: true, team1: select(team1, 'p1'), team2: select(team2, 'p2') };
}

/** 準備並啟動戰鬥；回傳是否真的啟動 */
export function launchBattle(b: ShellBridge, opts: LaunchOptions = {}): LaunchResult {
  const fmt = opts.format ?? b.battleFormat;
  // 選禁尚未完成前，12格候選池不是實際參戰隊伍。
  if (fmt.startsWith('peak_')) return { ok: false, reason: 'requires-bp' };
  const resolved = resolveTeams(b, opts);
  if (!resolved.ok || !resolved.team1 || !resolved.team2) return resolved;

  if (opts.format) b.setBattleFormat(opts.format);

  const rec1 = readLastUsedRecord("p1");
  const rec2 = readLastUsedRecord("p2");
  const prepare = (side: 'p1' | 'p2', selected: Elf[], record: typeof rec1, explicit?: Elf[]) => {
    const source = explicit ?? record?.team ?? selected;
    const roster = bindInitialCounterparts(prepareSavedBattleRoster(source, b.allElvesCombined, readAnnualBonus(side), side), 6);
    const active = roster.slice(0, 6);
    const starter = active.find(elf => elf.battleId === record?.starterId || elf.id === record?.starterId) ?? active[0];
    const team = fmt === 'solo_1v1' ? [starter] : active;
    for (const elf of team) validateSkillStoneLoadout(elf, elf.skills);
    return { team, starterId: starter.battleId! };
  };
  let p1: ReturnType<typeof prepare>, p2: ReturnType<typeof prepare>;
  try {
    p1 = prepare('p1', resolved.team1, rec1, opts.p1);
    p2 = prepare('p2', resolved.team2, rec2, opts.p2);
  } catch { return { ok: false, reason: 'invalid-roster' }; }
  const gear1 = readEquipment('p1'), gear2 = readEquipment('p2');

  b.handleStartBattle(
    b.battleMode, p1.team, p2.team, p1.starterId, p2.starterId,
    gear1.suit, gear1.eyewear, gear2.suit, gear2.eyewear, gear1.title, gear2.title,
    fmt
  );

  return { ok: true, team1: p1.team, team2: p2.team };
}

/** 給 UI 用的失敗訊息 */
export function launchFailureMessage(reason?: LaunchResult["reason"]): string {
  switch (reason) {
    case 'requires-bp': return '巔峰對戰需要先完成選禁，請使用戰前設定。';
    case 'invalid-roster': return '陣容的能力或技能石配置無效，請先在戰前設定修正。';
    case "no-elves": return "精靈池是空的，請先到「編成」加入精靈。";
    case "same-team": return "精靈數量不足，無法組成雙方隊伍。";
    case "not-ready": return "尚未保存陣容。請先到「編成」組隊並儲存，或使用快速配對。";
    default: return "無法開始對戰。";
  }
}
