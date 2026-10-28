/** 收尾先計時、後派發效果：保留後續增刪與同ID刷新，不用舊計時快照覆蓋新值。 */
export function mergeRoundEnd<T extends { id?: unknown }>(before: T[] = [], ticked: T[] = [], after: T[] = []): T[] {
  if (after === before) return ticked;
  const originals = new Map(before.map(e => [e.id, e]));
  const ticks = new Map(ticked.map(e => [e.id, e]));
  const result = after.flatMap(e => {
    const original = originals.get(e.id);
    if (!original) return [e];
    // 2026-10-28 修正：原本用物件身分（e !== original）判斷「有沒有被改過」，
    // 但回合結束期間只要有人重建 effects 陣列（新物件、內容相同），
    // 扣減結果就會被丟棄、回合數回到原值 → 異常永遠不減少。
    // 改成比對「回合數是否真的被改過」：只有實際改動 duration 才採用新值。
    const liveDuration = (e as any)?.duration;
    const beforeDuration = (original as any)?.duration;
    const modified = liveDuration !== beforeDuration;
    if (modified) return [e];
    const tick = ticks.get(e.id);
    return tick ? [tick] : [];
  });
  for (const tick of ticked) if (!originals.has(tick.id) && !result.some(e => e.id === tick.id)) result.push(tick);
  return result;
}
