import type { Elf } from '../types';
// 不引入 stateScopes（會連帶拉進狀態／印記／計時器）：首頁的背包綁定只需要這個純函式模組。
const identity = (elf: Pick<Elf, 'id' | 'battleId'>) => elf.battleId || elf.id;

/**
 * 「指定背包內精靈」的唯一解析入口（幻化、幻化指令共用）。
 *
 * 背包模型：開局時雙方各有「出戰區」（進入戰鬥隊伍）與「待命區」（不進入隊伍，只留快照）。
 * 位數 = 該精靈在自己那一區的原始排序，開局即寫入 initialBagSlot，之後不因換人、召喚、
 * 死亡或消逝而重編；禁用（BP ban）、未選出的精靈在建立背包時就已排除，待命區因此是「壓緊後」的順序。
 *
 * 對應規則（可預測、可測試）：
 *   1. 目標區 = 與自己相反的一區；偏好位置 = 自己的位數 % 目標區人數（待命不足時循環）。
 *   2. 偏好位置不合法（已消逝、就是自己）時，保持目標區原本的相對順序，往後順延（到尾端接回開頭），
 *      取第一個合法者。
 *   3. 目標區沒有任何合法者 → 回傳 undefined，呼叫端不發動效果並記錄日誌。
 */
const strip = (e: Elf): Elf => structuredClone({ ...e, initialCounterpart: undefined, initialBench: undefined, illusion: undefined });

export function pickByBagSlot<T>(others: readonly T[], slot: number, isLegal: (e: T) => boolean = () => true): T | undefined {
  const n = others.length;
  for (let k = 0; k < n; k++) {
    const candidate = others[(((slot % n) + n) % n + k) % n];
    if (isLegal(candidate)) return candidate;
  }
  return undefined;
}

/** roster = 出戰區（前 activeCount 隻）＋待命區（其餘，已排除禁用與未選）。 */
export function bindBag(roster: readonly Elf[], activeCount: number): Elf[] {
  const active = roster.slice(0, activeCount), standby = roster.slice(activeCount);
  const bench = standby.map(strip);
  const front = active.map(strip);
  return roster.map((elf, index) => {
    if (index < activeCount) {
      const counterpart = pickByBagSlot(bench, index);
      return { ...elf, initialBagGroup: 'active', initialBagSlot: index, initialBench: bench, initialCounterpart: counterpart };
    }
    const slot = index - activeCount;
    return { ...elf, initialBagGroup: 'standby', initialBagSlot: slot, initialBench: undefined, initialCounterpart: pickByBagSlot(front, slot) };
  });
}

/** 該隊的待命區快照（所有出戰精靈共享同一份，任何一隻存活或消逝都不影響讀取）。 */
export function benchOfTeam(team: readonly Elf[]): Elf[] {
  return team.find(e => e.initialBench)?.initialBench ?? [];
}

/** 出戰區（含已陣亡，不含召喚物與額外精靈），依開局位數排序。 */
export function activeBagOf(team: readonly Elf[]): Elf[] {
  return team.filter(e => !e.isExtra && !e.summonerId)
    .map((e, i) => ({ e, i })).sort((a, b) => (a.e.initialBagSlot ?? a.i) - (b.e.initialBagSlot ?? b.i) || a.i - b.i).map(x => x.e);
}

const liveOf = (team: readonly Elf[], elf: Elf): Elf | undefined => team.find(e => identity(e) === identity(elf));

/** 自己的「初始另一背包對應位數」精靈；team 為當前這場戰鬥自己一方的實際隊伍。 */
export function correspondingBagElf(team: readonly Elf[], self: Elf): Elf | undefined {
  const legal = (e: Elf) => identity(e) !== identity(self) && !liveOf(team, e)?.isVanished && !e.isVanished;
  if (self.initialBagSlot === undefined) {
    // 舊資料／測試只帶單一快照：仍須通過合法性檢查。
    const c = self.initialCounterpart;
    return c && legal(c) ? c : undefined;
  }
  const others = (self.initialBagGroup ?? 'active') === 'active' ? benchOfTeam(team) : activeBagOf(team);
  return pickByBagSlot(others, self.initialBagSlot, legal);
}

export interface BagEntry { side: 'p1' | 'p2'; elf: Elf; zone: 'active' | 'standby' }
/** 雙方當前背包（出戰＋待命）：已消逝者不列入；用於幻化指令的挑選與驗證。 */
export function listBagElves(teams: Record<'p1' | 'p2', readonly Elf[]>): BagEntry[] {
  const out: BagEntry[] = [];
  for (const side of ['p1', 'p2'] as const) {
    for (const elf of activeBagOf(teams[side])) if (!elf.isVanished) out.push({ side, elf, zone: 'active' });
    for (const elf of benchOfTeam(teams[side])) out.push({ side, elf, zone: 'standby' });
  }
  return out;
}

/** 以 battleId 在雙方當前背包找精靈（不使用索引、不使用預設陣容）。 */
export function findBagElf(teams: Record<'p1' | 'p2', readonly Elf[]>, side: 'p1' | 'p2', battleId: string): Elf | undefined {
  return listBagElves(teams).find(x => x.side === side && identity(x.elf) === battleId)?.elf;
}
