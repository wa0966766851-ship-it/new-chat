export type BattleSide = "p1" | "p2";

export interface OwnedExtraAction {
  owner: BattleSide;
}

/**
 * 逐項抽取指定一方的額外行動。每次執行後都重新讀取佇列，因此執行途中新增的連鎖
 * 會在同一個額外行動節點繼續結算；另一方的項目保持原順序。
 */
export async function drainExtraActionQueue<T extends OwnedExtraAction>(opts: {
  owner: BattleSide;
  readQueue: () => T[];
  writeQueue: (queue: T[]) => void;
  canContinue: () => boolean;
  execute: (action: T) => void | Promise<void>;
  limit?: number;
}): Promise<{ resolved: number; truncated: boolean }> {
  const limit = opts.limit ?? 32;
  let resolved = 0;
  while (resolved < limit) {
    const queue = opts.readQueue();
    const index = queue.findIndex(action => action.owner === opts.owner);
    if (index < 0 || !opts.canContinue()) break;
    const action = queue[index];
    opts.writeQueue([...queue.slice(0, index), ...queue.slice(index + 1)]);
    await opts.execute(action);
    resolved++;
  }
  const truncated = resolved >= limit && opts.readQueue().some(action => action.owner === opts.owner);
  if (truncated) opts.writeQueue(opts.readQueue().filter(action => action.owner !== opts.owner));
  return { resolved, truncated };
}
