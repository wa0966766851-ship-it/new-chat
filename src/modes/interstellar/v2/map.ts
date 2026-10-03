import { Dice } from "./rng";
import type { NodeKind } from "./content";

export interface MapNode {
  id: string; col: number; lane: number; x: number; y: number;
  kind: NodeKind; next: string[];
  /** 「？」的真身（生成時以種子決定；看穿或踏入後顯示） */
  revealed?: NodeKind;
  visited?: boolean;
}
export interface ActMap { act: number; nodes: MapNode[]; cols: number; lanes: number; }

/**
 * 隨機路網：每章欄數、軌道數、路徑數、合流與支線都不同。
 * 0 起點 → 1..N 路途 → N+1 星爐 → N+2 王座。相鄰欄只能平移或斜移一格；同一對欄位不出現 X 形交叉。
 */
export function generateActMap(act: number, dice: Dice): ActMap {
  const N = 9 + dice.int(0, 3) + (act >= 4 ? 1 : 0);          // 路途欄數 9–13
  const LANES = act >= 3 ? 6 : 5;
  const restCol = N + 1, bossCol = N + 2;
  const id = (c: number, l: number) => `A${act}-${c}-${l}`;
  const start = `A${act}-start`, boss = `A${act}-boss`;
  const edges = new Map<string, Set<string>>();
  const used = new Set<string>();
  const link = (a: string, b: string) => { if (!edges.has(a)) edges.set(a, new Set()); edges.get(a)!.add(b); used.add(a); used.add(b); };
  const crosses = (c: number, from: number, to: number) => from !== to && !!edges.get(id(c, to))?.has(id(c + 1, from));

  const paths = dice.int(5, 7);
  const firstLanes = dice.shuffle(Array.from({ length: LANES }, (_, i) => i));
  for (let p = 0; p < paths; p++) {
    let lane = p < LANES ? firstLanes[p] : dice.int(0, LANES - 1);
    link(start, id(1, lane));
    for (let c = 1; c <= N; c++) {
      let nl = Math.max(0, Math.min(LANES - 1, lane + dice.pick([-1, -1, 0, 1, 1])));
      if (crosses(c, lane, nl)) nl = lane;
      link(id(c, lane), id(c + 1, nl));
      lane = nl;
    }
    link(id(restCol, lane), boss);
  }
  // 支線：隨機補幾條斜向連線（不交叉），增加選擇
  for (let k = 0; k < N; k++) {
    const c = dice.int(1, N - 1), l = dice.int(0, LANES - 1), nl = Math.max(0, Math.min(LANES - 1, l + dice.pick([-1, 1])));
    if (used.has(id(c, l)) && used.has(id(c + 1, nl)) && !crosses(c, l, nl)) link(id(c, l), id(c + 1, nl));
  }

  const treasureCol = Math.round(N / 2) + dice.int(-1, 1);
  const midRestCol = dice.chance(.6) ? Math.round(N * .7) : -1;
  const nodes = new Map<string, MapNode>();
  const xOf = (c: number) => 4 + c * (92 / bossCol);
  const yOf = (l: number) => 10 + l * (80 / (LANES - 1));
  nodes.set(start, { id: start, col: 0, lane: -1, x: 3, y: 50, kind: "rest", next: [...(edges.get(start) ?? [])], visited: true });
  nodes.set(boss, { id: boss, col: bossCol, lane: -1, x: 96, y: 50, kind: "boss", next: [] });
  const parents = new Map<string, string[]>();
  for (const [a, set] of edges) for (const b of set) parents.set(b, [...(parents.get(b) ?? []), a]);

  for (let c = 1; c <= restCol; c++) for (let l = 0; l < LANES; l++) {
    const nid = id(c, l); if (!used.has(nid)) continue;
    const ps = (parents.get(nid) ?? []).map(p => nodes.get(p)?.kind);
    let kind: NodeKind;
    if (c === 1) kind = dice.chance(.8) ? "combat" : "mystery";
    else if (c === restCol) kind = "rest";
    else if (c === treasureCol && dice.chance(.55)) kind = "treasure";
    else if (c === midRestCol && dice.chance(.5)) kind = "rest";
    else {
      const late = c / N;
      const table: { item: NodeKind; w: number }[] = [
        { item: "combat", w: 34 }, { item: "mystery", w: 22 }, { item: "event", w: 8 },
        { item: "elite", w: c >= 3 ? 10 + act * 1.5 + late * 6 : 0 }, { item: "shop", w: c >= 2 ? 7 : 0 },
        { item: "rest", w: c >= 4 ? 5 : 0 }, { item: "altar", w: c >= 2 ? 6 + act : 0 }, { item: "treasure", w: 3 },
      ];
      kind = dice.weighted(table);
      // 同一路上不連續出現相同的特殊節點
      for (let tries = 0; tries < 4 && kind !== "combat" && kind !== "mystery" && ps.includes(kind); tries++) kind = dice.weighted(table);
      if (kind !== "combat" && kind !== "mystery" && ps.includes(kind)) kind = "combat";
    }
    const jx = c === restCol ? 0 : dice.int(-12, 12) / 10, jy = dice.int(-50, 50) / 10;
    nodes.set(nid, { id: nid, col: c, lane: l, x: xOf(c) + jx, y: Math.max(6, Math.min(94, yOf(l) + jy)), kind, next: [...(edges.get(nid) ?? [])] });
  }
  return { act, nodes: [...nodes.values()], cols: bossCol + 1, lanes: LANES };
}

/** 從目前位置可前往的節點 */
export function reachable(map: ActMap, currentId: string | null): MapNode[] {
  const cur = map.nodes.find(n => n.id === currentId) ?? map.nodes.find(n => n.col === 0)!;
  return cur.next.map(id => map.nodes.find(n => n.id === id)!).filter(Boolean);
}
