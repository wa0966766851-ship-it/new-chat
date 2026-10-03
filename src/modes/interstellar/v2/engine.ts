/**
 * 星蝕回廊（星際探索 v2）引擎：純函式，輸入舊局面回傳新局面。
 * 所有隨機都走 run.seed + run.nonce（Dice），重新載入不會重擲。
 */
import type { BaseStats, Elf } from "../../../types";
import { Dice, newSeed } from "./rng";
import { ACTS, AFFIXES, AFFIX_BY_ID, EVENTS, EVENT_BY_ID, FINAL_ACT, NODE_META, type EventOps, type NodeKind } from "./content";
import { generateActMap, reachable, type ActMap, type MapNode } from "./map";
import { RELICS, RELIC_BY_ID, applyRelicPanel, relicPool, runMods, type RelicRarity } from "./relics";
import { buildExplorationSnapshot } from "../battleSnapshot";
import { isAliveBySurvivalRule } from "../../../battle/survivalRules";

export const RUN_KEY_V2 = "INTERSTELLAR_ECLIPSE_RUN";
export const META_KEY = "INTERSTELLAR_META";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export type Tier = "low" | "mid" | "high" | "apex";
export interface EnemySpec { id: string; affixes: string[]; }
export interface Encounter { kind: "combat" | "elite" | "boss"; title: string; enemies: EnemySpec[]; reward?: "relic" | "legendary"; scale: number; /** 體力倍率（遠高於其他能力，確保敵方體力明顯超越玩家） */ hpScale?: number; }
export interface ShopItem { kind: "relic" | "elf" | "potion" | "purge" | "mend"; ref?: string; price: number; currency: "beans" | "shards"; sold?: boolean; }
export interface Reward {
  beans: number; shards: number; potions: number; exp: number;
  relicChoices: string[]; recruitChoices: string[];
  relicTaken?: string; recruitTaken?: string; isBoss?: boolean; isFinal?: boolean;
}
export type Scene =
  | { kind: "draft"; offer: string[]; picks: string[] }
  | { kind: "map"; note?: string }
  | { kind: "event"; eventId: string; outcome?: string }
  | { kind: "shop"; stock: ShopItem[]; note?: string }
  | { kind: "rest"; done?: string }
  | { kind: "treasure"; offer: string[]; done?: string }
  | { kind: "altar"; done?: string }
  | { kind: "prelude"; encounter: Encounter }
  | { kind: "reward"; reward: Reward; title: string }
  | { kind: "recruit"; offer: string[]; note: string }
  | { kind: "end"; result: "victory" | "wiped" };

export interface RunV2 {
  schemaVersion: 2; runId: string; revision: number; seed: number; nonce: number;
  act: number; map: ActMap; at: string | null; revealAct?: number;
  team: Elf[]; relics: string[]; beans: number; shards: number; potions: number; eclipse: number;
  equipType: "suit" | "title"; equipId: string; modifiers: string[];
  scene: Scene; pendingBattle: null | { id: string; nodeId: string | null; encounter: Encounter };
  exp: number; stats: { fights: number; elites: number; bosses: number; steps: number };
  chronicle: string[];
  lastBattle?: { win: boolean; outcome: string } | null;
}

/* ───────── 精靈池與分級 ───────── */
const total = (e: Elf) => Object.values(e.baseStats || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
/** 可用精靈：排除未完成資料、極端體力（如百萬體力的機制精靈）、額外精靈。 */
export function usablePool(pool: Elf[]): Elf[] {
  return pool.filter(e => total(e) >= 500 && (e.skills?.length ?? 0) > 0 && !(e as any).isExtra && (e.calculatedStats?.hp ?? 0) < 20000);
}
export function tierOf(pool: Elf[], elf: Elf): Tier {
  const sorted = usablePool(pool).map(total).sort((a, b) => a - b);
  const rank = sorted.findIndex(t => t >= total(elf)) / Math.max(1, sorted.length - 1);
  return rank >= .9 ? "apex" : rank >= .7 ? "high" : rank >= .4 ? "mid" : "low";
}
function byTier(pool: Elf[], tiers: Tier[]): Elf[] {
  const usable = usablePool(pool);
  const r = usable.filter(e => tiers.includes(tierOf(pool, e)));
  return r.length ? r : usable;
}
const elfKey = (e: Elf) => String(e.id);
export const findElf = (pool: Elf[], id: string) => pool.find(e => elfKey(e) === id);

/* ───────── 建立／存讀 ───────── */
export function createRun(opts: { pool: Elf[]; equipType: "suit" | "title"; equipId: string; modifiers: string[]; startingShards: number; seed?: number }): RunV2 {
  const seed = opts.seed ?? newSeed();
  const dice = new Dice(seed, 0);
  const map = generateActMap(1, dice);
  const offer = dice.sample(byTier(opts.pool, ["low", "mid"]), 6).map(elfKey);
  const potions = Math.max(0, 3 - (opts.modifiers.includes("no_potions") ? 2 : 0));
  return prerollMysteries({
    schemaVersion: 2, runId: globalThis.crypto?.randomUUID?.() ?? `run-${seed}`, revision: 0, seed, nonce: dice.nonce,
    act: 1, map, at: map.nodes.find(n => n.col === 0)!.id, team: [], relics: [], beans: 120, shards: opts.startingShards, potions, eclipse: 0,
    equipType: opts.equipType, equipId: opts.equipId, modifiers: opts.modifiers,
    scene: { kind: "draft", offer, picks: [] }, pendingBattle: null, exp: 0,
    stats: { fights: 0, elites: 0, bosses: 0, steps: 0 }, chronicle: ["你點燃了第一盞燈。星蝕回廊的門在背後關上。"],
  });
}
export function loadRunV2(storage: Pick<Storage, "getItem">): RunV2 | null {
  const raw = storage.getItem(RUN_KEY_V2); if (!raw) return null;
  try { const r = JSON.parse(raw); return r?.schemaVersion === 2 && r.map && Array.isArray(r.team) ? r : null; } catch { return null; }
}
/** 寫入：不覆蓋較新的修訂（例如戰鬥結算已寫入的局面）。 */
export function saveRunV2(storage: Storage, run: RunV2): RunV2 {
  const cur = loadRunV2(storage);
  if (cur && cur.runId === run.runId && cur.revision > run.revision) return cur;
  const next = { ...run, revision: (cur?.runId === run.runId ? cur.revision : run.revision) + 1 };
  storage.setItem(RUN_KEY_V2, JSON.stringify(next));
  return next;
}

/* ───────── 局面工具 ───────── */
const withDice = <T,>(run: RunV2, f: (d: Dice) => T): [T, number] => { const d = new Dice(run.seed, run.nonce); const v = f(d); return [v, d.nonce]; };
const log = (run: RunV2, line: string): RunV2 => ({ ...run, chronicle: [line, ...run.chronicle].slice(0, 40) });
export const mods = (run: RunV2) => runMods(run.relics);
const isAlive = (e: Elf) => isAliveBySurvivalRule(e.currentHp, e.survivalRule);
export const actDef = (run: RunV2) => ACTS[run.act - 1] ?? ACTS[ACTS.length - 1];

/** 面板：裝備 → 遺物 → 個體淬鍊 → 難度詛咒 */
function panelFor(run: RunV2, elf: Elf) {
  return (s: BaseStats): BaseStats => {
    let out = applyRelicPanel(s, run.relics);
    const boost = Number((elf as any).runBoost) || 0;
    if (boost) out = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.floor(Number(v) * (1 + boost))])) as unknown as BaseStats;
    if (run.modifiers.includes("weak_body")) out = { ...out, hp: Math.floor(out.hp * .8) };
    if (run.modifiers.includes("high_gravity")) out = { ...out, speed: Math.floor(out.speed * .85) };
    return out;
  };
}
export function snapshotElf(run: RunV2, elf: Elf): Elf {
  return { ...buildExplorationSnapshot(elf, elf.baseStats, run.equipType === "suit" ? run.equipId : undefined, run.equipType === "title" ? run.equipId : undefined, panelFor(run, elf)), explorationVitals: true } as Elf;
}
/** 遺物或淬鍊改變面板後同步隊伍體力上限（保留已損失量）。 */
function syncTeam(run: RunV2): RunV2 { return { ...run, team: run.team.map(e => snapshotElf(run, e)) }; }

/* ───────── 選秀 ───────── */
export function toggleDraft(run: RunV2, id: string): RunV2 {
  if (run.scene.kind !== "draft") return run;
  const picks = run.scene.picks.includes(id) ? run.scene.picks.filter(x => x !== id) : run.scene.picks.length < 3 ? [...run.scene.picks, id] : run.scene.picks;
  return { ...run, scene: { ...run.scene, picks } };
}
export function confirmDraft(run: RunV2, pool: Elf[]): RunV2 {
  if (run.scene.kind !== "draft" || run.scene.picks.length !== 3) return run;
  const team = run.scene.picks.map((id, i) => ({ ...findElf(pool, id)!, battleId: `run-${run.seed}-${i}-${id}` })).filter(e => e.id !== undefined) as Elf[];
  return syncTeam(log({ ...run, team, scene: { kind: "map" } }, `持燈者：${team.map(e => e.name).join("、")}。`));
}

/* ───────── 地圖移動 ───────── */
export const currentNode = (run: RunV2): MapNode => run.map.nodes.find(n => n.id === run.at) ?? run.map.nodes.find(n => n.col === 0)!;
export const movesFrom = (run: RunV2) => run.scene.kind === "map" ? reachable(run.map, run.at) : [];
export const isRevealed = (run: RunV2) => run.revealAct === run.act || mods(run).revealMystery;
/** 「？」的真身在生成地圖時就以種子決定，看穿遺物只是讓它顯示。 */
function resolveMystery(run: RunV2, node: MapNode): [NodeKind, number] {
  if (node.kind !== "mystery") return [node.kind, run.nonce];
  if (node.revealed) return [node.revealed, run.nonce];
  return withDice(run, d => d.weighted<NodeKind>([{ item: "event", w: 55 }, { item: "combat", w: 22 }, { item: "shop", w: 10 }, { item: "treasure", w: 13 }]));
}
export function moveTo(run: RunV2, nodeId: string, pool: Elf[]): RunV2 {
  if (run.scene.kind !== "map" || run.pendingBattle) return run;
  const target = movesFrom(run).find(n => n.id === nodeId); if (!target) return run;
  const [kind, nonce] = resolveMystery(run, target);
  const m = mods(run);
  let next: RunV2 = { ...run, nonce, at: target.id, stats: { ...run.stats, steps: run.stats.steps + 1 },
    map: { ...run.map, nodes: run.map.nodes.map(n => n.id === target.id ? { ...n, visited: true, revealed: n.kind === "mystery" ? kind : n.revealed } : n) },
    eclipse: Math.max(0, run.eclipse + 3 + m.eclipsePerMove + (kind === "elite" ? 3 : 0)) };
  // 全蝕：每步全隊失去 5% 最大體力（不致死）
  if (next.eclipse >= 100) next = { ...next, team: next.team.map(e => isAlive(e) ? { ...e, currentHp: Math.max(1, e.currentHp - Math.floor(e.maxHp * .05)) } : e) };
  return enterNode(next, kind, pool);
}
function enterNode(run: RunV2, kind: NodeKind, pool: Elf[]): RunV2 {
  switch (kind) {
    case "combat": case "elite": case "boss": {
      const [enc, nonce] = withDice(run, d => rollEncounter(run, kind, pool, d));
      return { ...run, nonce, scene: { kind: "prelude", encounter: enc } };
    }
    case "event": case "mystery": {
      const [ev, nonce] = withDice(run, d => d.pick(EVENTS.filter(e => (e.minAct ?? 1) <= run.act && !run.chronicle.some(c => c.startsWith(`【${e.title}】`)))) ?? d.pick(EVENTS));
      return log({ ...run, nonce, scene: { kind: "event", eventId: ev.id } }, `【${ev.title}】`);
    }
    case "shop": { const [stock, nonce] = withDice(run, d => rollShop(run, pool, d)); return { ...run, nonce, scene: { kind: "shop", stock } }; }
    case "treasure": { const [offer, nonce] = withDice(run, d => rollRelics(run, d, 3, { common: 50, rare: 42, legendary: run.act >= 3 ? 8 : 0 })); return { ...run, nonce, scene: { kind: "treasure", offer } }; }
    case "rest": return { ...run, scene: { kind: "rest" } };
    case "altar": return { ...run, scene: { kind: "altar" } };
  }
}
export function backToMap(run: RunV2, note?: string): RunV2 { return { ...run, scene: { kind: "map", note } }; }

/* ───────── 遺物 ───────── */
function rollRelics(run: RunV2, d: Dice, n: number, w: Partial<Record<RelicRarity, number>>): string[] {
  const owned = new Set(run.relics);
  const out: string[] = [];
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    const rarity = d.weighted((Object.entries(w) as [RelicRarity, number][]).map(([item, ww]) => ({ item, w: ww })));
    const cands = relicPool(rarity).filter(r => !owned.has(r.id) && !out.includes(r.id));
    if (cands.length) out.push(d.pick(cands).id);
  }
  return out;
}
export function gainRelic(run: RunV2, id: string): RunV2 {
  const def = RELIC_BY_ID[id]; if (!def) return run;
  let next: RunV2 = { ...run, relics: [...run.relics, id] };
  if (def.run?.potions) next = { ...next, potions: next.potions + def.run.potions };
  return syncTeam(log(next, `${def.rarity === "cursed" ? "被纏上" : "取得"}【${def.name}】。`));
}

/* ───────── 遭遇 ───────── */
function rollEncounter(run: RunV2, kind: "combat" | "elite" | "boss", pool: Elf[], d: Dice, reward?: "relic" | "legendary"): Encounter {
  const a = run.act, e = run.eclipse;
  const tierFor: Record<string, Tier[]> = {
    combat: a <= 1 ? ["low"] : a <= 2 ? ["low", "mid"] : a <= 4 ? ["mid", "high"] : ["high", "apex"],
    elite: a <= 2 ? ["mid", "high"] : ["high", "apex"],
    boss: a >= FINAL_ACT ? ["apex"] : a >= 4 ? ["apex", "high"] : ["high", "apex"],
  };
  const count = kind === "boss" ? (a >= 4 ? 2 : 1) : kind === "elite" ? (a >= 4 ? 3 : 2) : a <= 2 ? 1 : a <= 4 ? d.int(1, 2) : 2;
  const candidates = byTier(pool, tierFor[kind]);
  const picked = d.sample(candidates, Math.min(count, candidates.length));
  const affixCount = kind === "boss" ? 2 + (a >= 5 ? 1 : 0) + (run.modifiers.includes("strong_boss") ? 1 : 0) : kind === "elite" ? 1 + (e >= 50 ? 1 : 0) + (a >= 4 ? 1 : 0) : e >= 75 ? 1 : 0;
  const enemies = picked.map((el, i) => ({ id: elfKey(el), affixes: d.sample(AFFIXES.map(x => x.id), kind === "boss" && i > 0 ? Math.max(0, affixCount - 1) : affixCount) }));
  // 能力倍率：攻防速 ×1.15 起跳，每章 +0.15；體力另計，一般 ×2.5、夢魘 ×4、王座 ×7 起跳並隨章節大幅成長。
  const scale = 1.15 + 0.15 * (a - 1) + (e >= 25 ? .1 : 0) + (kind === "elite" ? .15 : 0) + (kind === "boss" ? .3 + (e >= 75 ? .15 : 0) + (a >= FINAL_ACT ? .2 : 0) : 0);
  const hpScale = (kind === "boss" ? 7 + 1.5 * (a - 1) : kind === "elite" ? 4 + .75 * (a - 1) : 2.5 + .5 * (a - 1)) * (kind === "boss" && a >= FINAL_ACT ? 1.3 : 1) * (e >= 100 ? 1.2 : 1);
  const lead = findElf(pool, enemies[0]?.id ?? "");
  const title = kind === "boss" ? `${actDef(run).name}之主・${lead?.name ?? "？"}` : kind === "elite" ? `夢魘・${lead?.name ?? "？"}` : `遭遇・${lead?.name ?? "？"}`;
  return { kind, title, enemies, reward, scale: Math.round(scale * 100) / 100, hpScale: Math.round(hpScale * 100) / 100 };
}
/** 敵方戰鬥資料：面板×倍率×詞綴 */
/** 敵方體力下限：至少為我方最高體力的倍數（一般 1.5、夢魘 2.5、王座 4，每章 +0.25），確保體力明顯超越玩家。 */
export function enemyHpFloor(run: RunV2, enc: Encounter): number {
  const top = Math.max(0, ...run.team.map(e => snapshotElf(run, e).maxHp || 0));
  const k = (enc.kind === "boss" ? 4 : enc.kind === "elite" ? 2.5 : 1.5) + 0.25 * (run.act - 1);
  return Math.floor(top * k);
}
export function buildEnemies(enc: Encounter, pool: Elf[], minHp = 0): Elf[] {
  return enc.enemies.map((spec, i) => {
    const base = findElf(pool, spec.id)!;
    const statMul: Record<string, number> = {};
    for (const a of spec.affixes) for (const [k, v] of Object.entries(AFFIX_BY_ID[a]?.stat ?? {})) statMul[k] = (statMul[k] ?? 1) * Number(v);
    const panel = (s: BaseStats): BaseStats => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.floor(Number(v) * (k === "hp" ? (enc.hpScale ?? enc.scale) : enc.scale) * (statMul[k] ?? 1))])) as unknown as BaseStats;
    const panelWithFloor = (st: BaseStats): BaseStats => { const p = panel(st); return minHp > p.hp ? { ...p, hp: minHp } : p; };
    return { ...buildExplorationSnapshot(base, base.baseStats, undefined, undefined, panelWithFloor), battleId: `foe-${i}-${spec.id}` } as Elf;
  });
}
export const enemyAffixRelics = (enc: Encounter) => [...new Set(enc.enemies.flatMap(e => e.affixes).filter(a => !AFFIX_BY_ID[a]?.stat))];

/** 開戰：寫入 pendingBattle，回傳雙方隊伍與給 BattleScreen 的遺物清單。 */
export function startBattle(run: RunV2, pool: Elf[], battleId: string): { run: RunV2; p1: Elf[]; p2: Elf[]; relics: string[]; enemyRelics: string[] } | null {
  if (run.scene.kind !== "prelude") return null;
  const enc = run.scene.encounter;
  const p1 = run.team.map(e => snapshotElf(run, e)).map(e => run.relics.includes("void_shield_gen") ? { ...e, shield: (e.shield || 0) + 500 } : e);
  if (!p1.some(isAlive)) return null;
  // 已陣亡者排在後面，首發為第一隻存活者
  const ordered = [...p1.filter(isAlive), ...p1.filter(e => !isAlive(e))];
  const p2 = buildEnemies(enc, pool, enemyHpFloor(run, enc));
  const relics = run.relics.map(id => id === "eclipse_crown" ? `eclipse_crown:${run.eclipse}` : id);
  return { run: { ...run, pendingBattle: { id: battleId, nodeId: run.at, encounter: enc } }, p1: ordered, p2, relics, enemyRelics: enemyAffixRelics(enc) };
}
/** 撤離（只限一般遭遇）：失去 15% 賽爾豆，蝕度 +5 */
export function fleeEncounter(run: RunV2): RunV2 {
  if (run.scene.kind !== "prelude" || run.scene.encounter.kind === "boss") return run;
  return backToMap(log({ ...run, beans: Math.floor(run.beans * .85), eclipse: run.eclipse + 5 }, "你撤退了。黑暗記住了你的背影。"), "撤離成功：失去 15% 賽爾豆，蝕度 +5。");
}

/* ───────── 戰鬥結算 ───────── */
export function settleBattleV2(run: RunV2, battleId: string, winner: string, team: Elf[] | undefined, pool: Elf[]): RunV2 {
  const pb = run.pendingBattle;
  if (!pb || pb.id !== battleId) return run;
  const win = winner === "p1";
  // 隊伍延續：體力、PP（以 battleId 對應）
  let next: RunV2 = { ...run, pendingBattle: null, lastBattle: { win, outcome: winner },
    team: run.team.map(e => {
      const after = team?.find(x => (x.battleId || x.id) === (e.battleId || e.id)); if (!after) return e;
      return { ...e, maxHp: after.maxHp, currentHp: Math.min(after.maxHp, Math.max(0, after.currentHp)), survivalRule: after.survivalRule,
        skills: e.skills.map((s, i) => ({ ...s, pp: after.skills?.[i]?.pp ?? s.pp })), explorationVitals: true } as Elf;
    }) };
  if (!next.team.some(isAlive) || (!win && pb.encounter.kind === "boss")) {
    return log({ ...next, scene: { kind: "end", result: "wiped" } }, "燈熄了。");
  }
  if (!win) {
    // 撤退／失敗（非首領）：失去 2 點蝕度保護，回到地圖
    return backToMap(log({ ...next, eclipse: next.eclipse + 6 }, `敗走於【${pb.encounter.title}】。`), "戰敗撤離：蝕度 +6。");
  }
  const enc = pb.encounter; const a = run.act; const m = mods(run);
  const eclipseBonus = run.eclipse >= 100 ? 1.5 : run.eclipse >= 50 ? 1.25 : 1;
  const baseBeans = enc.kind === "boss" ? 180 + a * 50 : enc.kind === "elite" ? 90 + a * 30 : 40 + a * 15;
  const modMult = 1 + next.modifiers.length * .1;
  const reward: Reward = {
    beans: Math.floor(baseBeans * m.beansMult * eclipseBonus), shards: enc.kind === "boss" ? 2 : enc.kind === "elite" ? 1 : 0,
    potions: 0, exp: Math.floor((enc.kind === "boss" ? 150 : enc.kind === "elite" ? 60 : 20) * modMult),
    relicChoices: [], recruitChoices: [], isBoss: enc.kind === "boss", isFinal: enc.kind === "boss" && a >= FINAL_ACT,
  };
  const [rolled, nonce] = withDice(next, d => {
    const r = { ...reward };
    if (enc.kind === "boss") r.relicChoices = rollRelics(next, d, 3 + m.extraRewardChoice, { boss: 70, legendary: 30 });
    else if (enc.kind === "elite" || enc.reward) {
      const w = enc.reward === "legendary" ? { legendary: 100 } : { common: 20, rare: 70, legendary: 10 };
      r.relicChoices = rollRelics(next, d, 3 + m.extraRewardChoice + (enc.kind === "elite" ? m.eliteRelicChoice : 0), w);
    } else if (d.chance(.4)) r.relicChoices = rollRelics(next, d, 2, { common: 80, rare: 20 });
    const recruitChance = enc.kind === "boss" ? 1 : enc.kind === "elite" ? .5 : .35;
    if (d.chance(recruitChance)) {
      const tiers: Tier[] = enc.kind === "boss" ? ["high", "apex"] : a >= 4 ? ["mid", "high"] : ["low", "mid"];
      const owned = new Set(next.team.map(e => String(e.id)));
      r.recruitChoices = d.sample(byTier(pool, tiers).filter(e => !owned.has(String(e.id))), 3).map(elfKey);
    }
    if (enc.kind === "combat" && d.chance(.25)) r.potions = 1;
    if (enc.kind === "elite") r.potions = 1;
    return r;
  });
  next = { ...next, nonce, beans: next.beans + rolled.beans, shards: next.shards + rolled.shards, potions: next.potions + rolled.potions, exp: next.exp + rolled.exp,
    stats: { ...next.stats, fights: next.stats.fights + 1, elites: next.stats.elites + (enc.kind === "elite" ? 1 : 0), bosses: next.stats.bosses + (enc.kind === "boss" ? 1 : 0) } };
  return log({ ...next, scene: { kind: "reward", reward: rolled, title: enc.kind === "boss" ? "王座傾倒" : enc.kind === "elite" ? "夢魘消散" : "戰鬥結束" } }, `擊敗【${enc.title}】。`);
}
export function settleStoredBattleV2(storage: Storage, runId: string, battleId: string, winner: string, team: Elf[] | undefined, pool: Elf[]): RunV2 | null {
  const run = loadRunV2(storage); if (!run || run.runId !== runId) return null;
  const next = settleBattleV2(run, battleId, winner, team, pool);
  return next === run ? run : saveRunV2(storage, next);
}
export function consumePotionV2(storage: Storage, runId: string, battleId: string): boolean {
  const run = loadRunV2(storage);
  if (!run || run.runId !== runId || run.pendingBattle?.id !== battleId || run.potions <= 0) return false;
  saveRunV2(storage, { ...run, potions: run.potions - 1 }); return true;
}

/* ───────── 獎勵 ───────── */
export function takeRewardRelic(run: RunV2, id: string): RunV2 {
  if (run.scene.kind !== "reward" || run.scene.reward.relicTaken || !run.scene.reward.relicChoices.includes(id)) return run;
  const next = gainRelic(run, id);
  return { ...next, scene: { ...run.scene, reward: { ...run.scene.reward, relicTaken: id } } };
}
export function takeRewardRecruit(run: RunV2, id: string, pool: Elf[], replaceIdx = -1): RunV2 {
  if (run.scene.kind !== "reward" || run.scene.reward.recruitTaken || !run.scene.reward.recruitChoices.includes(id)) return run;
  const next = addMember(run, id, pool, replaceIdx); if (next === run) return run;
  return { ...next, scene: { ...run.scene, reward: { ...run.scene.reward, recruitTaken: id } } };
}
function addMember(run: RunV2, id: string, pool: Elf[], replaceIdx: number): RunV2 {
  const base = findElf(pool, id); if (!base) return run;
  const max = mods(run).maxTeam;
  const elf = snapshotElf(run, { ...base, battleId: `run-${run.seed}-${run.nonce}-${id}` } as Elf);
  const team = [...run.team];
  if (replaceIdx >= 0 && replaceIdx < team.length) team[replaceIdx] = elf; else if (team.length < max) team.push(elf); else return run;
  return log({ ...run, team, nonce: run.nonce + 1 }, `【${base.name}】加入了隊伍。`);
}
/** 離開獎勵：首領之後進入下一章（全隊回復、陣亡者以 50% 復甦） */
export function leaveReward(run: RunV2, pool: Elf[]): RunV2 {
  if (run.scene.kind !== "reward") return run;
  if (run.scene.reward.isFinal) return log({ ...run, exp: run.exp + 500, scene: { kind: "end", result: "victory" } }, "太陽重新升起。");
  if (!run.scene.reward.isBoss) return backToMap(run);
  return advanceAct(run, pool);
}
function advanceAct(run: RunV2, _pool: Elf[]): RunV2 {
  const act = run.act + 1;
  const [map, nonce] = withDice(run, d => generateActMap(act, d));
  const team = run.team.map(e => ({ ...e, currentHp: isAlive(e) ? e.maxHp : Math.floor(e.maxHp * .5), skills: e.skills.map(s => ({ ...s, pp: s.maxPp ?? s.pp })) }) as Elf);
  const potions = Math.max(run.potions, 3) + (run.relics.includes("apothecary_lamp") ? 2 : 0);
  return log(prerollMysteries({ ...run, act, map, nonce, at: map.nodes.find(n => n.col === 0)!.id, team, potions, eclipse: Math.max(0, run.eclipse - 15), scene: { kind: "map", note: `第 ${act} 章：${ACTS[act - 1]?.name}` } }), `進入【${ACTS[act - 1]?.name}】。`);
}

/* ───────── 事件 ───────── */
export function chooseEvent(run: RunV2, idx: number, pool: Elf[]): RunV2 {
  if (run.scene.kind !== "event" || run.scene.outcome) return run;
  const ev = EVENT_BY_ID[run.scene.eventId]; const ch = ev?.choices[idx]; if (!ch) return run;
  if (ch.require?.(run)) return run;
  let cur: RunV2 = run; const dice = new Dice(run.seed, run.nonce);
  let pendingScene: Scene | null = null;
  const ops: EventOps = {
    get run() { return cur; }, dice,
    beans: n => { cur = { ...cur, beans: Math.max(0, cur.beans + n) }; },
    shards: n => { cur = { ...cur, shards: Math.max(0, cur.shards + n) }; },
    potions: n => { cur = { ...cur, potions: Math.max(0, cur.potions + n) }; },
    eclipse: n => { cur = { ...cur, eclipse: Math.max(0, cur.eclipse + n) }; },
    healTeam: p => { cur = { ...cur, team: cur.team.map(e => isAlive(e) ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + Math.floor(e.maxHp * p)) } : e) }; },
    hurtTeam: p => { cur = { ...cur, team: cur.team.map(e => isAlive(e) ? { ...e, currentHp: Math.max(1, e.currentHp - Math.floor(e.maxHp * p)) } : e) }; },
    restorePp: () => { cur = { ...cur, team: cur.team.map(e => ({ ...e, skills: e.skills.map(s => ({ ...s, pp: s.maxPp ?? s.pp })) }) as Elf) }; },
    relic: rarity => { const id = rollRelics({ ...cur, nonce: dice.nonce }, dice, 1, { [rarity]: 1 })[0] ?? rollRelics(cur, dice, 1, { common: 1 })[0]; if (id) cur = gainRelic(cur, id); return RELIC_BY_ID[id]?.name ?? "空無"; },
    relicId: id => { cur = gainRelic(cur, id); return RELIC_BY_ID[id]?.name ?? id; },
    curse: () => { const c = rollRelics(cur, dice, 1, { cursed: 1 })[0]; if (c) cur = gainRelic(cur, c); return RELIC_BY_ID[c]?.name ?? "無名詛咒"; },
    removeCurse: () => { const c = cur.relics.find(r => r.startsWith("curse_")); if (!c) return null; cur = syncTeam({ ...cur, relics: cur.relics.filter((r, i) => i !== cur.relics.indexOf(c)) }); return RELIC_BY_ID[c]?.name ?? c; },
    empowerRandom: p => { const alive = cur.team.filter(isAlive); if (!alive.length) return null; const t = alive[Math.floor(dice.next() * alive.length)]; cur = syncTeam({ ...cur, team: cur.team.map(e => e === t ? { ...e, runBoost: (Number((e as any).runBoost) || 0) + p } as Elf : e) }); return t.name; },
    recruitOffer: (tier, n) => { const tiers: Tier[] = tier === "low" ? ["low"] : tier === "mid" ? ["low", "mid"] : ["high", "apex"]; const owned = new Set(cur.team.map(e => String(e.id))); pendingScene = { kind: "recruit", offer: dice.sample(byTier(pool, tiers).filter(e => !owned.has(String(e.id))), n).map(elfKey), note: ev.title }; },
    battle: (kind, reward) => { pendingScene = { kind: "prelude", encounter: rollEncounter({ ...cur, nonce: dice.nonce }, kind, pool, dice, reward) }; },
    reveal: () => { cur = { ...cur, revealAct: cur.act }; },
    sacrifice: () => { if (cur.team.length <= 1) return null; const t = cur.team[Math.floor(dice.next() * cur.team.length)]; cur = { ...cur, team: cur.team.filter(e => e !== t) }; return t.name; },
  };
  const outcome = ch.apply(ops);
  cur = { ...cur, nonce: dice.nonce };
  cur = log(cur, `　${ch.label}：${outcome}`);
  return { ...cur, scene: pendingScene ? pendingScene : { kind: "event", eventId: ev.id, outcome } };
}
export function recruitFromOffer(run: RunV2, id: string | null, pool: Elf[], replaceIdx = -1): RunV2 {
  if (run.scene.kind !== "recruit") return run;
  if (!id) return backToMap(run);
  const next = addMember(run, id, pool, replaceIdx);
  return next === run ? run : backToMap(next);
}

/* ───────── 商店 ───────── */
const relicPrice: Record<RelicRarity, number> = { common: 90, rare: 160, legendary: 260, cursed: 0, boss: 320 };
function rollShop(run: RunV2, pool: Elf[], d: Dice): ShopItem[] {
  const f = (1 + .1 * (run.act - 1)) * mods(run).shopMult;
  const relics = [...rollRelics(run, d, 2, { common: 1 }), ...rollRelics(run, d, 1, { rare: 85, legendary: 15 })];
  const owned = new Set(run.team.map(e => String(e.id)));
  const elves = d.sample(byTier(pool, run.act >= 4 ? ["mid", "high", "apex"] : ["low", "mid", "high"]).filter(e => !owned.has(String(e.id))), 2);
  const extra = run.modifiers.includes("cost_recruit") ? 1 : 0;
  const tierCost: Record<Tier, number> = { low: 1, mid: 1, high: 2, apex: 3 };
  return [
    ...relics.map(id => ({ kind: "relic" as const, ref: id, price: Math.round(relicPrice[RELIC_BY_ID[id].rarity] * f), currency: "beans" as const })),
    ...elves.map(e => ({ kind: "elf" as const, ref: elfKey(e), price: tierCost[tierOf(pool, e)] + extra, currency: "shards" as const })),
    { kind: "potion", price: Math.round(45 * f), currency: "beans" },
    { kind: "mend", price: Math.round(60 * f), currency: "beans" },
    { kind: "purge", price: Math.round(100 * f), currency: "beans" },
  ];
}
export function shopBuy(run: RunV2, idx: number, pool: Elf[], replaceIdx = -1): RunV2 {
  if (run.scene.kind !== "shop") return run;
  const item = run.scene.stock[idx]; if (!item || item.sold) return run;
  const wallet = item.currency === "beans" ? run.beans : run.shards; if (wallet < item.price) return run;
  const pay = (r: RunV2): RunV2 => item.currency === "beans" ? { ...r, beans: r.beans - item.price } : { ...r, shards: r.shards - item.price };
  let next = run;
  if (item.kind === "relic") next = gainRelic(pay(run), item.ref!);
  else if (item.kind === "elf") { const added = addMember(run, item.ref!, pool, replaceIdx); if (added === run) return run; next = pay(added); }
  else if (item.kind === "potion") next = pay({ ...run, potions: run.potions + 1 });
  else if (item.kind === "mend") next = pay({ ...run, team: run.team.map(e => isAlive(e) ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + Math.floor(e.maxHp * .3)) } : e) });
  else if (item.kind === "purge") { const c = run.relics.find(r => r.startsWith("curse_")); if (!c) return run; next = syncTeam(log(pay({ ...run, relics: run.relics.filter((_, i) => i !== run.relics.indexOf(c)) }), `擺脫了【${RELIC_BY_ID[c]?.name}】。`)); }
  const stock = (run.scene.stock).map((s, i) => i === idx ? { ...s, sold: s.kind !== "potion" && s.kind !== "mend" } : s);
  return { ...next, scene: { kind: "shop", stock } };
}

/* ───────── 星爐 ───────── */
export function restAction(run: RunV2, action: "mend" | "revive" | "temper", targetIdx = -1): RunV2 {
  if (run.scene.kind !== "rest" || run.scene.done) return run;
  const m = mods(run);
  if (action === "mend") {
    const p = .35 * m.restHealMult;
    const team = run.team.map(e => isAlive(e) ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + Math.floor(e.maxHp * p)), skills: e.skills.map(s => ({ ...s, pp: s.maxPp ?? s.pp })) } as Elf : e);
    return { ...run, team, potions: run.potions + 1, scene: { kind: "rest", done: `火光裡，傷口合上了。全隊恢復 ${Math.round(p * 100)}% 體力，技能 PP 回滿，藥劑 +1。` } };
  }
  if (action === "revive") {
    const t = run.team[targetIdx]; if (!t || isAlive(t)) return run;
    const team = run.team.map((e, i) => i === targetIdx ? { ...e, currentHp: Math.floor(e.maxHp * .5), skills: e.skills.map(s => ({ ...s, pp: s.maxPp ?? s.pp })) } as Elf : e);
    return log({ ...run, team, scene: { kind: "rest", done: `【${t.name}】從灰裡坐了起來。` } }, `【${t.name}】復甦。`);
  }
  const t = run.team[targetIdx]; if (!t) return run;
  const team = run.team.map((e, i) => i === targetIdx ? { ...e, runBoost: (Number((e as any).runBoost) || 0) + .08 } as Elf : e);
  return syncTeam(log({ ...run, team, scene: { kind: "rest", done: `【${t.name}】被星火淬鍊，全能力 +8%。` } }, `淬鍊【${t.name}】。`));
}

/* ───────── 祭壇 ───────── */
export const ALTAR_PACTS = [
  { id: "blood", label: "血之契", hint: "全隊失去 20% 體力：稀有遺物" },
  { id: "curse", label: "蝕之契", hint: "得到詛咒：傳說遺物" },
  { id: "dark", label: "暗之契", hint: "蝕度 +15：星晶 +2" },
] as const;
export function altarPact(run: RunV2, pact: "blood" | "curse" | "dark" | "leave"): RunV2 {
  if (run.scene.kind !== "altar" || run.scene.done) return run;
  if (pact === "leave") return backToMap(run);
  const d = new Dice(run.seed, run.nonce);
  let next: RunV2 = run; let text = "";
  if (pact === "blood") {
    next = { ...run, team: run.team.map(e => isAlive(e) ? { ...e, currentHp: Math.max(1, e.currentHp - Math.floor(e.maxHp * .2)) } : e) };
    const id = rollRelics(next, d, 1, { rare: 1 })[0]; next = id ? gainRelic(next, id) : next; text = `血滲進石縫。祭壇吐出【${RELIC_BY_ID[id]?.name}】。`;
  } else if (pact === "curse") {
    const c = rollRelics(run, d, 1, { cursed: 1 })[0]; const id = rollRelics(run, d, 1, { legendary: 1 })[0];
    if (c) next = gainRelic(next, c); if (id) next = gainRelic(next, id); text = `你接下了【${RELIC_BY_ID[c]?.name}】，也接下了【${RELIC_BY_ID[id]?.name}】。`;
  } else { next = { ...run, eclipse: run.eclipse + 15, shards: run.shards + 2 }; text = "月影爬上你的手臂。兩顆星晶落在掌心。"; }
  return { ...next, nonce: d.nonce, scene: { kind: "altar", done: text } };
}

/* ───────── 寶匣 ───────── */
export function takeTreasure(run: RunV2, id: string): RunV2 {
  if (run.scene.kind !== "treasure" || run.scene.done || !run.scene.offer.includes(id)) return run;
  const next = gainRelic(run, id);
  return { ...next, scene: { ...run.scene, done: RELIC_BY_ID[id]?.name } } as RunV2;
}

/* ───────── 其他 ───────── */
export const nodeLabel = (run: RunV2, n: MapNode) => {
  const kind = n.kind === "mystery" && (n.visited || isRevealed(run)) ? (n.revealed ?? n.kind) : n.kind;
  return { kind, ...NODE_META[kind] };
};
/** 「？」節點的真身在地圖生成後預先決定（看穿時可見）。 */
export function prerollMysteries(run: RunV2): RunV2 {
  let nonce = run.nonce;
  const nodes = run.map.nodes.map(n => {
    if (n.kind !== "mystery" || n.revealed) return n;
    const [kind, nn] = resolveMystery({ ...run, nonce }, n); nonce = nn; return { ...n, revealed: kind };
  });
  return { ...run, nonce, map: { ...run.map, nodes } };
}
export const relicCount = () => RELICS.length;
