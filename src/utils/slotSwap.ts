/** 背包格換位（首頁與星蝕回廊共用的語意）：目標格有人→互換；目標在末端之後→移到最後。回傳新陣列。 */
export function swapSlots<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list];
  const next = [...list];
  if (to >= next.length) { const [moved] = next.splice(from, 1); next.push(moved); return next; }
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
