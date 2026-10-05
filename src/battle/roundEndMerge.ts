/** 收尾先計時、後派發效果：保留後續增刪與同ID刷新，不用舊計時快照覆蓋新值。 */
export function mergeRoundEnd<T extends { id?: unknown }>(before: T[] = [], ticked: T[] = [], after: T[] = []): T[] {
  if (after === before) return ticked;
  const originals = new Map(before.map(e => [e.id, e]));
  const ticks = new Map(ticked.map(e => [e.id, e]));
  const result = after.flatMap(e => {
    if (!originals.has(e.id) || e !== originals.get(e.id)) return [e];
    const tick = ticks.get(e.id);
    return tick ? [tick] : [];
  });
  for (const tick of ticked) if (!originals.has(tick.id) && !result.some(e => e.id === tick.id)) result.push(tick);
  return result;
}
