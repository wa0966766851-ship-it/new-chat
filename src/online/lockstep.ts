/**
 * 雙人連線對戰（同步回合制，2026-11-27）。
 *
 * 雙方各跑一份「同一個種子、同一份隊伍」的戰鬥引擎，只交換每一步的選擇：
 * - 房主是 P1、加入者是 P2（兩邊引擎方向相同，結算順序與亂數消耗才會一致）。
 * - 選擇以「技能槽／背包位置／道具編號」表達，到對方引擎再還原成同一個技能物件。
 * - 每回合開始時雙方交換戰況摘要（checksum）；不一致就停止對戰並提示，不讓兩邊各打各的。
 */
import type { Elf } from '../types';
import type { BattleState } from '../components/BattleManager';
import type { LockstepSelection } from '../engine/battleEngine';
import { compactBuiltinOverrides } from '../data/savedTeamCompact';
import { normalizeElfStats } from '../utils/elfStats';

export type { LockstepSelection };
export type OnlineSide = 'p1' | 'p2';

/** 戰前交換的隊伍：以內建精靈為底的差異，加上首發與配裝。 */
export interface OnlineLoadout {
  team: Partial<Elf>[];
  starterId: string;
  equipment: { suit: string; eyewear: string; title: string; flame: string };
  /** 還原後完整隊伍的摘要：雙方精靈資料或版本不同時拒絕開戰。 */
  digest: string;
}

export function fnv1a(text: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** 物件鍵排序後序列化（摘要用，與屬性順序無關）。 */
export function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined && typeof v !== 'function').sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
}

export function encodeLoadout(team: Elf[], starterId: string, equipment: OnlineLoadout['equipment'], catalog: Elf[]): OnlineLoadout {
  const patches = compactBuiltinOverrides(Object.fromEntries(team.map(e => [e.id, e])), catalog);
  const hydrated = hydrateTeam(team.map(e => patches[e.id] as Partial<Elf>), catalog);
  return { team: team.map(e => patches[e.id] as Partial<Elf>), starterId, equipment: { ...equipment }, digest: fnv1a(canonical(hydrated)) };
}

export function hydrateTeam(patches: Partial<Elf>[], catalog: Elf[]): Elf[] {
  return patches.map(patch => {
    const base = catalog.find(e => String(e.id) === String(patch?.id) && !e.isExtra && !e.isCustom);
    if (!base) throw Error('對手隊伍含有本機沒有的精靈，請確認雙方版本相同');
    return normalizeElfStats({ ...structuredClone(base), ...structuredClone(patch) }) as Elf;
  });
}

/** 驗證並還原對手送來的隊伍；任何不符都拋出可顯示的錯誤。 */
export function decodeLoadout(value: unknown, catalog: Elf[], expectedSize?: number): { team: Elf[]; loadout: OnlineLoadout } {
  const v = value as OnlineLoadout;
  if (!v || typeof v !== 'object' || !Array.isArray(v.team) || v.team.length < 1 || v.team.length > 6) throw Error('對手隊伍格式不符');
  if (expectedSize !== undefined && v.team.length !== expectedSize) throw Error('雙方隊伍數量不同（一方是 6 隻隊伍、一方是單隻精靈），請用同一種方式進入房間');
  if (typeof v.starterId !== 'string' || typeof v.digest !== 'string' || !v.equipment || typeof v.equipment !== 'object') throw Error('對手隊伍格式不符');
  for (const key of ['suit', 'eyewear', 'title', 'flame'] as const) if (typeof v.equipment[key] !== 'string' || v.equipment[key].length > 64) throw Error('對手配裝格式不符');
  const ids = v.team.map(e => String(e?.id));
  if (new Set(ids).size !== ids.length) throw Error('對手隊伍有重複精靈');
  if (!ids.includes(v.starterId)) throw Error('對手首發不在隊伍中');
  const team = hydrateTeam(v.team, catalog);
  if (fnv1a(canonical(team)) !== v.digest) throw Error('雙方精靈資料不同，請確認雙方是同一個遊戲版本');
  return { team, loadout: v };
}

/** 大訊息切片（資料通道單筆上限 48KB）。 */
export const CHUNK = 24_000;
export function chunks(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK) out.push(text.slice(i, i + CHUNK));
  return out.length ? out : [''];
}

/**
 * 戰況摘要：只取會影響結算的欄位（體力、異常、能力等級、PP、印記、計時器、場上位置、勝負）。
 * 不含日誌、動畫、隨機產生的計時器編號與額外精靈的臨時編號。
 */
export function battleChecksum(state: BattleState): string {
  const elf = (e: any) => e && ({
    n: e.name, hp: e.currentHp, mhp: e.maxHp, sh: e.shield || 0, br: e.barrier || 0,
    st: Object.entries(e.statuses || e.status || {}).map(([k, v]: [string, any]) => [k, v?.turns ?? v?.remaining ?? v]).sort(),
    sg: e.statStages || {}, pp: (e.skills || []).map((s: any) => s.pp ?? s.currentPp ?? null),
  });
  const side = (k: OnlineSide) => ({
    a: (state as any)[`${k}ActiveIndex`],
    team: ((state as any)[`${k}Team`] || []).map(elf),
    marks: ((state as any)[`${k}Marks`] || []).map((m: any) => [m.name || m.id, m.count, m.remainingRounds ?? null]).sort(),
    timers: ((state as any)[`${k}Timers`] || []).map((t: any) => [t.name, t.remaining]).sort(),
  });
  return fnv1a(canonical({ t: state.turnNumber, w: state.winner ?? null, p1: side('p1'), p2: side('p2') }));
}

/**
 * 對手選擇的佇列：選擇只在引擎進到「該回合、該階段」時才套用；
 * 太早到的先排隊，每次引擎狀態提交後重試。順序固定，雙方引擎看到的輸入序列相同。
 */
export function createRemoteQueue(apply: (selection: LockstepSelection) => boolean) {
  const queue: LockstepSelection[] = [];
  return {
    push(selection: LockstepSelection) { queue.push(selection); this.flush(); },
    flush() {
      while (queue.length && apply(queue[0])) queue.shift();
    },
    get pending() { return queue.length; },
  };
}

/** 對手送來的選擇格式檢查（不信任對方）。 */
export function validSelection(value: unknown, remoteSide: OnlineSide): value is LockstepSelection {
  const v = value as Record<string, unknown>;
  if (!v || typeof v !== 'object' || v.side !== remoteSide || !Number.isSafeInteger(v.turn) || typeof v.phase !== 'string' || (v.phase as string).length > 32) return false;
  const int = (x: unknown, max: number) => Number.isSafeInteger(x) && (x as number) >= 0 && (x as number) < max;
  switch (v.kind) {
    case 'skill': return int(v.slot, 16);
    case 'wait': case 'pass': return true;
    case 'switch': return int(v.index, 12);
    case 'item': return typeof v.id === 'string' && v.id.length <= 64 && (v.picked === undefined ||
      (typeof v.picked === 'object' && v.picked !== null && ['p1', 'p2'].includes((v.picked as any).side) && typeof (v.picked as any).battleId === 'string' && (v.picked as any).battleId.length <= 96));
    default: return false;
  }
}
