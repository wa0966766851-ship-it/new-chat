/**
 * 星蝕回廊（星際探索 v2）引擎：純函式，輸入舊局面回傳新局面。
 * 所有隨機都走 run.seed + run.nonce（Dice），重新載入不會重擲。
 */
import { bindBag } from "../../../battle/bagTargets";
import type { BaseStats, Elf } from "../../../types";
import { Dice, newSeed } from "./rng";
import { clampN, nEffects, banCap, type NEffects } from "./levels";
import { deriveSeed, encodeRunCode, poolSignature } from "./seed";
import { OPEN_SHIELD_BASE, perkOf, type Perk } from "./suitPerks";
import {
  ADVANCE_PP_PRICE, DUP_BASE_CAP, RELIC_PRICE, tokenBasePrice, SHARD_INCOME, SHARD_SHOP_PRICE, advanceStatPrice, applyDupPp, depthMul, depthOf, dupOf, dupStatMul, elfTypes, fixedMulAt, fixedMulEntry, foldDupPp, recruitPriceOf, repeatDropChance, tierRank, tokenLabel, tokenMatches,
  type DropSource, type RecruitToken, type Tier, type TokenSpec,
} from "./recruit";
import { ACTS, AFFIXES, AFFIX_BY_ID, EVENTS, EVENT_BY_ID, FINAL_ACT, NODE_META, type EventOps, type NodeKind } from "./content";
import { generateActMap, reachable, type ActMap, type MapNode } from "./map";
import { RELICS, RELIC_BY_ID, RESCUE_ORDER, applyRelicPanel, isMulRelic, relicPool, runMods, type RelicRarity } from "./relics";
import { BARTER_BY_ID, BARTER_MAX_USES, BARTER_SHOWN, barterLimit, recipeAt, recipesFor, tokenAccepted, type BarterRecipe, type BarterState } from "./barter";
import { buildExplorationSnapshot } from "../battleSnapshot";
import { isAliveBySurvivalRule } from "../../../battle/survivalRules";
import { refreshExplorationElf } from './definitionSync';

export const RUN_KEY_V2 = "INTERSTELLAR_ECLIPSE_RUN";
export const META_KEY = "INTERSTELLAR_META";
export const DEFINITION_SYNC_BACKUP_KEY = `${RUN_KEY_V2}_BEFORE_DEFINITION_SYNC`;
export const definitionSyncBackupKey = (runId:string):string => `${DEFINITION_SYNC_BACKUP_KEY}:${runId}`;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export type { Tier, RecruitToken, TokenSpec } from "./recruit";
export { tokenBasePrice } from "./recruit";
export interface EnemySpec { id: string; affixes: string[]; }
export interface Encounter { kind: "combat" | "elite" | "boss"; title: string; enemies: EnemySpec[]; reward?: "relic" | "legendary"; scale: number; /** 體力倍率（遠高於其他能力，確保敵方體力明顯超越玩家） */ hpScale?: number; /** 層數 L（1…72）；固定值倍率 √depthMul(L) 由此決定 */ depth?: number; }
export interface ShopItem { kind: "relic" | "elf" | "potion" | "purge" | "mend" | "token" | "shard"; ref?: string; /** 招募令商品 */ token?: TokenSpec; /** 星晶商品的數量 */ qty?: number; price: number; currency: "beans" | "shards"; sold?: boolean; }
export interface Reward {
  beans: number; /** 本次獲得的星晶（已入帳） */ shards?: number; /** 本次獲得的招募令（已入帳） */ tokens?: RecruitToken[]; potions: number; exp: number;
  /** 舊存檔：系統給的 3 選 1 */ relicChoices: string[]; recruitChoices: string[];
  relicTaken?: string; recruitTaken?: string; isBoss?: boolean; isFinal?: boolean;
}
export type Scene =
  | { kind: "draft"; offer: string[]; picks: string[] }
  | { kind: "map"; note?: string }
  | { kind: "event"; eventId: string; outcome?: string }
  | { kind: "shop"; stock: ShopItem[]; note?: string; rerolls?: number; freeUsed?: boolean; /** 失與得（以物易物）：本店擺出的配方與剩餘次數 */ barter?: BarterState }
  | { kind: "rest"; done?: string }
  | { kind: "treasure"; offer: string[]; done?: string }
  | { kind: "altar"; done?: string }
  | { kind: "prelude"; encounter: Encounter }
  | { kind: "reward"; reward: Reward; title: string }
  | { kind: "recruit"; offer: string[]; note: string }
  | { kind: "end"; result: "victory" | "wiped"; /** 敗因：全隊陣亡／首領戰敗／放棄戰鬥 */ cause?: DefeatCause; /** 擊倒你的遭遇名稱 */ by?: string };
export type DefeatCause = "wipe" | "boss" | "exit";
/** 敗因的一行說明（敗北結算畫面與紀事共用） */
export const DEFEAT_TEXT: Record<DefeatCause, string> = { wipe: "全隊陣亡", boss: "首領戰敗", exit: "放棄首領戰" };
/** 失敗條件（資源列 tooltip 與開局說明共用） */
export const FAIL_RULE = "失敗條件：全隊（含待命與倉庫）陣亡，或首領戰敗。戰敗但仍有存活者時，自動由存活者補上出戰。保命遺物與套裝特權會在失敗結算前依序觸發。";

export interface PreBattle { team: Elf[]; lineup?: string[]; bench?: string[]; potions: number; eclipse: number; shieldAct?: number }
export interface RunV2 {
  schemaVersion: 2; runId: string; revision: number; seed: number; nonce: number;
  /** 進階難度 N0–N18（舊存檔缺省為 0） */ nLevel?: number;
  /** 禁用精靈 id：本局不會出現在招募池、敵方、獎勵、商店（舊存檔缺省為空） */ bans?: string[];
  /** 精靈池指紋：與局碼一併記錄，用來提醒「池不同則局面不同」 */ poolSig?: string;
  act: number; map: ActMap; at: string | null; revealAct?: number;
  /** 全部精靈（無上限）；lineup＝出戰、bench＝待命（合稱背包，各上限見 lineupSlots/benchSlots），其餘在倉庫 */
  team: Elf[]; lineup?: string[]; bench?: string[]; relics: string[]; beans: number; potions: number; eclipse: number;
  /** 星晶：招募與進階的貨幣 */ shards: number; /** 已用星晶招募的次數（推高下次招募價格；持令招募不計） */ recruitCount?: number;
  /** 限定招募券（招募令）：持有時可免費招募符合條件者／免費進階一次 */ tokens: RecruitToken[]; tokenSeq?: number;
  /** 已套用「星晶保留為貨幣」的存檔格式（舊存檔載入時補上） */ shardsV3?: boolean;
  /** 套裝特權：最近一次使用「每章首戰護盾」的章節；戰敗保留隊伍是否已用 */ shieldAct?: number; lifelineUsed?: boolean;
  equipType: "suit" | "title"; equipId: string; modifiers: string[];
  scene: Scene; pendingBattle: null | { id: string; nodeId: string | null; encounter: Encounter; /** 由局種子衍生的戰鬥亂數種子 */ battleSeed?: number; /** 持有逆時沙漏時：戰前狀態（戰敗將結算時用來回溯） */ pre?: PreBattle };
  /** 最近一次保命觸發（遺物／特權 id 與說明），開始下一場戰鬥時清除 */ lastRescue?: { id: string; text: string } | null; /** 本局已觸發過的保命（依序） */ rescues?: string[];
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
function byTier(pool: Elf[], tiers: Tier[], bans: readonly string[] = []): Elf[] {
  const banned = new Set(bans);
  // 分級以完整精靈池計算（禁用不改變其他精靈的分級），再排除禁用者。
  const usable = usablePool(pool).filter(e => !banned.has(String(e.id)));
  const r = usable.filter(e => tiers.includes(tierOf(pool, e)));
  return r.length ? r : usable;
}
export const bansOf = (run: Pick<RunV2, "bans">): string[] => run.bans ?? [];
/** 可被禁用／招募的精靈（排除未完成資料與極端體力）。 */
export const bannablePool = (pool: Elf[]): Elf[] => usablePool(pool);
const elfKey = (e: Elf) => String(e.id);
export const findElf = (pool: Elf[], id: string) => pool.find(e => elfKey(e) === id);

/* ───────── 建立／存讀 ───────── */
export interface CreateRunOpts { pool: Elf[]; equipType: "suit" | "title"; equipId: string; modifiers: string[]; startingShards: number; seed?: number; nLevel?: number; bans?: string[] }
/** 局碼：同一個局碼可完整重現這一局（見 seed.ts）。 */
export const runCodeOf = (run: RunV2): string => encodeRunCode({ seed: run.seed, nLevel: clampN(run.nLevel), equipType: run.equipType, equipId: run.equipId, modifiers: run.modifiers, bans: bansOf(run), poolSig: run.poolSig });
export const poolSigOf = (pool: Elf[]): string => poolSignature(usablePool(pool).map(elfKey));
export function createRun(opts: CreateRunOpts): RunV2 {
  const seed = (opts.seed ?? newSeed()) >>> 0;
  const nLevel = clampN(opts.nLevel), n = nEffects(nLevel);
  // 超出名額的禁用（例如把 N0 局碼改成 N18）一律截斷，並只保留存在於精靈池者。
  const known = new Set(usablePool(opts.pool).map(elfKey));
  const perk = perkFor(opts.equipType, opts.equipId, n);
  const bans = [...new Set(opts.bans ?? [])].filter(id => known.has(id)).slice(0, banCapFor(nLevel, perk));
  const dice = new Dice(seed, 0);
  const map = generateActMap(1, dice);
  const offer = dice.sample(byTier(opts.pool, ["low", "mid"], bans), 6).map(elfKey);
  const potions = Math.max(0, 3 - (opts.modifiers.includes("no_potions") ? 2 : 0) + n.startPotions + (perk?.potions ?? 0));
  let run: RunV2 = prerollMysteries({
    schemaVersion: 2, runId: `run-${seed.toString(36)}-${nLevel}`, revision: 0, seed, nonce: dice.nonce, nLevel, bans, poolSig: poolSigOf(opts.pool),
    act: 1, map, at: map.nodes.find(n => n.col === 0)!.id, team: [], relics: [], beans: Math.max(0, 120 + n.startBeans + (perk?.beans ?? 0)),
    shards: Math.max(0, opts.startingShards + n.startShards), recruitCount: 0, shardsV3: true, tokens: [], tokenSeq: 0, potions, eclipse: 0,
    equipType: opts.equipType, equipId: opts.equipId, modifiers: opts.modifiers,
    scene: { kind: "draft", offer, picks: [] }, pendingBattle: null, exp: 0,
    stats: { fights: 0, elites: 0, bosses: 0, steps: 0 }, chronicle: ["你點燃了第一盞燈。星蝕回廊的門在背後關上。"],
  });
  // 起始星晶＝開局數量＋N 等級；起始招募令：套裝特權附贈的任意／指定屬性／雙屬性／重複令
  const lead = (spec: Omit<TokenSpec, "tier">, count = 1) => { for (let i = 0; i < count; i++) run = mintToken(run, spec); };
  lead({ kind: "any", types: [], match: "has" }, Math.max(0, perk?.anyTokens ?? 0));
  if (perk?.typeToken) lead({ kind: "types", types: [perk.typeToken], match: "has" });
  if (perk?.dualToken) lead({ kind: "types", types: [...perk.dualToken], match: "exact" });
  if (perk?.repeatTokens) lead({ kind: "any", types: [], match: "has", repeat: true }, perk.repeatTokens);
  if (n.startCurse) {
    const d = new Dice(run.seed, run.nonce);
    const c = rollRelics(run, d, 1, { cursed: 1 })[0];
    run = { ...run, nonce: d.nonce };
    if (c) run = gainRelic(run, c);
  }
  return run;
}
/** 套裝特權：N12 起失效。 */
function perkFor(type: "suit" | "title", id: string, n: NEffects): Perk | null { return n.perksOff ? null : perkOf(type, id); }
/** 這一局生效中的套裝特權（N12 起為 null） */
export const runPerk = (run: Pick<RunV2, "equipType" | "equipId" | "nLevel">): Perk | null => perkFor(run.equipType, run.equipId, nEffects(clampN(run.nLevel)));
/** 禁用名額：N 等級決定，套裝特權可再 +n。 */
export const banCapFor = (nLevel: number, perk?: Perk | null): number => banCap(nLevel) + (perk?.banBonus ?? 0);
export const levelOf = (run: Pick<RunV2, "nLevel">): NEffects => nEffects(clampN(run.nLevel));
export function loadRunV2(storage: Pick<Storage, "getItem">): RunV2 | null {
  const raw = storage.getItem(RUN_KEY_V2); if (!raw) return null;
  try { const r = JSON.parse(raw); return r?.schemaVersion === 2 && r.map && Array.isArray(r.team) ? migrateRun({ ...r, nLevel: clampN(r.nLevel), bans: Array.isArray(r.bans) ? r.bans.map(String) : [] }) : null; } catch { return null; }
}
/**
 * 舊存檔相容：星晶保留為貨幣，原數量不變，不轉成任意令。
 * 第 2 階段（星晶→任意令）曾把 N 顆星晶換成 N 張強度頂階的任意令且保留 shards；這裡把那批令（序號 < N）移除，星晶維持原數，只做一次（shardsV3）。
 */
export function migrateRun(r: any): RunV2 {
  const shards = Math.max(0, Math.floor(Number(r.shards) || 0));
  let tokens: RecruitToken[] = Array.isArray(r.tokens) ? r.tokens : [];
  if (!r.shardsV3 && Array.isArray(r.tokens) && shards > 0) {
    const migrated = new Set(Array.from({ length: shards }, (_, i) => `${r.runId}:t${i}`));
    tokens = tokens.filter(t => !(migrated.has(t.id) && t.kind === "any" && !t.repeat && t.tier === "apex"));
  }
  const sc: any = r.scene;
  const scene = sc?.kind === "shop" && Array.isArray(sc.stock) ? { ...sc, stock: sc.stock.filter((x: ShopItem) => x.sold || x.currency !== "shards" || x.kind === "shard") } : r.scene;
  return { ...r, shards, recruitCount: Math.max(0, Math.floor(Number(r.recruitCount) || 0)), shardsV3: true, tokens, tokenSeq: r.tokenSeq ?? tokens.length, scene } as RunV2;
}
/** 只在非戰鬥中更新定義；未結算的戰鬥必須沿用原快照，不能在中途換魂印／技能。 */
export function syncRunDefinitions(run:RunV2,pool:readonly Elf[]):RunV2 {
  if(run.pendingBattle)return run;
  let changed=false;
  const team=run.team.map(saved=>{
    let next=refreshExplorationElf(saved,pool);
    if(next===saved)return saved;
    if(JSON.stringify(next.baseStats)!==JSON.stringify(saved.baseStats)) {
      // 只同步新面板及體力上限，仍保留已損失體力／死亡／負血，不清除個體持續狀態。
      const snapshot=snapshotElf(run,{...next,explorationVitals:true} as Elf);
      next={...next,calculatedStats:snapshot.calculatedStats,maxHp:snapshot.maxHp,currentHp:snapshot.currentHp};
    }
    changed=true;return next;
  });
  return changed?{...run,team}:run;
}
/** 每局首次覆寫前留下完整存檔；相同定義不加revision、不重複備份。 */
export function resumeRunV2(storage:Storage,pool:readonly Elf[]):RunV2|null {
  const run=loadRunV2(storage);if(!run)return null;
  const next=syncRunDefinitions(run,pool);if(next===run)return run;
  const backupKey=definitionSyncBackupKey(run.runId);
  if(!storage.getItem(backupKey))storage.setItem(backupKey,JSON.stringify(run));
  return saveRunV2(storage,next);
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
/** 局內修正：遺物＋套裝特權＋N 等級。 */
export const mods = (run: RunV2) => {
  const m = runMods(run.relics), n = levelOf(run), p = perkFor(run.equipType, run.equipId, n);
  return {
    ...m,
    beansMult: Math.max(0, m.beansMult + (p?.beansMult ?? 0)),
    shopMult: m.shopMult * (p?.shopMult ?? 1) * n.shopMult,
    eclipsePerMove: m.eclipsePerMove + (p?.eclipsePerMove ?? 0) + n.eclipsePerMove,
    restHealMult: m.restHealMult * (p?.restHealMult ?? 1) * n.restHealMult,
    revealMystery: m.revealMystery || !!p?.revealMystery,
    eliteRelicChoice: m.eliteRelicChoice + (p?.eliteRelicChoice ?? 0),
    extraRewardChoice: m.extraRewardChoice + (p?.extraRewardChoice ?? 0),
    expMult: 1 + (p?.expMult ?? 0),
  };
};
const isAlive = (e: Elf) => isAliveBySurvivalRule(e.currentHp, e.survivalRule);
export const actDef = (run: RunV2) => ACTS[run.act - 1] ?? ACTS[ACTS.length - 1];

/** 面板：裝備 → 遺物（含倍增）→ 個體淬鍊 → 重複招募強化 → 難度詛咒 */
function panelFor(run: RunV2, elf: Elf) {
  return (s: BaseStats): BaseStats => {
    let out = applyRelicPanel(s, run.relics);
    const boost = Number((elf as any).runBoost) || 0;
    if (boost) out = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.floor(Number(v) * (1 + boost))])) as unknown as BaseStats;
    // 重複招募的強化層數：全能力 +40%／層（接在個體淬鍊之後）
    const dm = dupStatMul(elf);
    if (dm !== 1) out = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.floor(Number(v) * dm)])) as unknown as BaseStats;
    if (run.modifiers.includes("weak_body")) out = { ...out, hp: Math.floor(out.hp * .8) };
    if (run.modifiers.includes("high_gravity")) out = { ...out, speed: Math.floor(out.speed * .85) };
    return out;
  };
}
export function snapshotElf(run: RunV2, elf: Elf): Elf {
  return { ...buildExplorationSnapshot(elf, elf.baseStats, run.equipType === "suit" ? run.equipId : undefined, run.equipType === "title" ? run.equipId : undefined, panelFor(run, elf)), explorationVitals: true } as Elf;
}
/* ───────── 背包（出戰＋待命）與倉庫 ───────── */
const bid = (e: Elf) => String(e.battleId || e.id);
/** 出戰上限：第 1 章 3 隻，每章 +1，最多 6；提燈者之心等遺物再 +1（仍以 6 為上限）。 */
const baseSlots = (run: RunV2) => Math.min(6, 3 + (run.act - 1) + runMods(run.relics).lineupBonus);
export function lineupSlots(run: RunV2): number {
  return Math.max(1, baseSlots(run) + levelOf(run).lineupSlots);
}
/** 待命上限與出戰同步成長（背包 6 → 12，同首頁 6 出戰＋6 待命）；高 N 等級縮減。 */
export const benchSlots = (run: RunV2) => Math.max(0, baseSlots(run) + levelOf(run).benchSlots);
/** 實際出戰名單：依 lineup 順序取存在於隊伍的精靈；舊存檔無名單時以隊伍順序的存活者補滿。 */
export function lineupOf(run: RunV2): Elf[] {
  const slots = lineupSlots(run);
  const byId = new Map(run.team.map(e => [bid(e), e]));
  const picked = (run.lineup ?? []).map(id => byId.get(id)).filter(Boolean) as Elf[];
  const out = picked.slice(0, slots);
  if (out.length < slots) for (const e of run.team) { if (out.length >= slots) break; if (!out.includes(e) && isAlive(e) && picked.length === 0) out.push(e); }
  return out;
}
/** 待命：bench 順序；舊存檔無 bench 時以隊伍順序補滿。 */
export function benchOf(run: RunV2): Elf[] {
  const slots = benchSlots(run);
  const lu = lineupOf(run);
  const byId = new Map(run.team.map(e => [bid(e), e]));
  const src = run.bench ? run.bench.map(id => byId.get(id)).filter(Boolean) as Elf[] : run.team;
  return src.filter(e => !lu.includes(e)).slice(0, slots);
}
/** 倉庫：不在背包內的其餘精靈（無上限）。 */
export function storageOf(run: RunV2): Elf[] {
  const bag = new Set([...lineupOf(run), ...benchOf(run)]);
  return run.team.filter(e => !bag.has(e));
}
export const inLineup = (run: RunV2, e: Elf) => lineupOf(run).includes(e);
/** 背包／倉庫隨時可整理（含倉庫）；只有戰鬥結算中、選秀與終局不行。 */
export const canEditBag = (run: RunV2) => !run.pendingBattle && run.scene.kind !== "draft" && run.scene.kind !== "end";
function withBag(run: RunV2, lineup: string[], bench: string[]): RunV2 {
  const ls = new Set(lineup);
  return { ...run, lineup, bench: bench.filter(x => !ls.has(x)).slice(0, benchSlots(run)) };
}
/** 出戰 ↔ 待命（滿則下場者改入倉庫；地圖與迎戰前可調整） */
export function toggleLineup(run: RunV2, idx: number): RunV2 {
  if (!canEditBag(run)) return run;
  const e = run.team[idx]; if (!e) return run;
  const cur = lineupOf(run).map(bid), bench = benchOf(run).map(bid);
  const id = bid(e);
  if (cur.includes(id)) { if (cur.length <= 1) return run; return withBag(run, cur.filter(x => x !== id), [id, ...bench]); }
  if (cur.length >= lineupSlots(run)) return run;
  return withBag(run, [...cur, id], bench.filter(x => x !== id));
}
/** 待命 ↔ 倉庫 */
export function toggleStorage(run: RunV2, idx: number): RunV2 {
  if (!canEditBag(run)) return run;
  const e = run.team[idx]; if (!e) return run;
  const id = bid(e), cur = lineupOf(run).map(bid), bench = benchOf(run).map(bid);
  if (cur.includes(id)) return run;
  if (bench.includes(id)) return { ...run, lineup: cur, bench: bench.filter(x => x !== id) };
  if (bench.length >= benchSlots(run)) return run;
  return withBag(run, cur, [...bench, id]);
}
/** 設為首發：移到出戰名單最前（滿員則最後一位退回待命） */
export function setStarter(run: RunV2, idx: number): RunV2 {
  if (!canEditBag(run)) return run;
  const e = run.team[idx]; if (!e || !isAlive(e)) return run;
  const id = bid(e);
  const bench = benchOf(run).map(bid);
  let cur = lineupOf(run).map(bid).filter(x => x !== id);
  let out: string[] = [];
  if (cur.length >= lineupSlots(run)) { out = cur.slice(lineupSlots(run) - 1); cur = cur.slice(0, lineupSlots(run) - 1); }
  return withBag(run, [id, ...cur], [...out, ...bench.filter(x => x !== id)]);
}
export type BagZone = "lineup" | "bench" | "storage";
export const bagIdOf = bid;
/** 目前三區的成員 id（出戰／待命依順序，倉庫依隊伍順序）。 */
export function bagLists(run: RunV2): Record<BagZone, string[]> {
  return { lineup: lineupOf(run).map(bid), bench: benchOf(run).map(bid), storage: storageOf(run).map(bid) };
}
export function bagZoneOf(run: RunV2, id: string): { zone: BagZone; index: number } | null {
  const l = bagLists(run);
  for (const zone of ["lineup", "bench", "storage"] as const) { const index = l[zone].indexOf(id); if (index >= 0) return { zone, index }; }
  return null;
}
/**
 * 把成員移到某區：
 * - 指定 index 且該位有人 → 兩者交換（跨區亦然，倉庫也可以互換）；
 * - 未指定 index（或超出末端）→ 放到該區末端，區滿則不動；
 * - 同區拖到另一位 → 兩者互換位置；
 * 出戰區至少 1 人；陣亡者不能從其他區進入出戰區，原本的陣亡者可逐隻換下。
 */
function planBagMove(run: RunV2, id: string, zone: BagZone, index?: number): { lists: Record<BagZone, string[]> } | { issue: string } {
  if (!canEditBag(run)) return { issue: "目前不能整理背包" };
  if (!["lineup", "bench", "storage"].includes(zone) || (index !== undefined && (!Number.isInteger(index) || index < 0))) return { issue: "無效的背包位置" };
  const lists = bagLists(run);
  const previousLineup = new Set(lists.lineup);
  const from = bagZoneOf(run, id); if (!from) return { issue: "找不到精靈" };
  const src = lists[from.zone], dst = lists[zone];
  if (zone === from.zone) {
    if (zone === "storage" || index === undefined) return { issue: "精靈已在此區" };
    const j = Math.min(index, dst.length - 1); if (j === from.index || j < 0) return { issue: "精靈已在此位置" };
    [dst[from.index], dst[j]] = [dst[j], dst[from.index]];
  } else {
    const occupant = index !== undefined && index < dst.length ? dst[index] : undefined;
    if (occupant !== undefined) { src[from.index] = occupant; dst[index!] = id; }
    else { src.splice(from.index, 1); dst.push(id); }
  }
  const byId = new Map(run.team.map(e => [bid(e), e]));
  if (!lists.lineup.length) return { issue: "出戰區至少保留一隻精靈" };
  if (lists.lineup.length > lineupSlots(run) || lists.bench.length > benchSlots(run)) return { issue: "背包位置已滿" };
  if (lists.lineup.some(x => !byId.get(x) || (!previousLineup.has(x) && !isAlive(byId.get(x)!)))) return { issue: "陣亡者不能進入出戰區，需在星爐復甦" };
  return { lists };
}
/** 更換視窗與拖拉共用相同判定，避免清單可選卻換不成功。 */
export function bagMoveIssue(run: RunV2, id: string, zone: BagZone, index?: number): string | false {
  const plan = planBagMove(run, id, zone, index);
  return "issue" in plan ? plan.issue : false;
}
export function moveBagMember(run: RunV2, id: string, zone: BagZone, index?: number): RunV2 {
  const plan = planBagMove(run, id, zone, index);
  return "issue" in plan ? run : { ...run, lineup: plan.lists.lineup, bench: plan.lists.bench };
}
/** 兩名成員互換位置（拖拉／點選互換用）。 */
export function swapBagMembers(run: RunV2, a: string, b: string): RunV2 {
  if (a === b) return run;
  const to = bagZoneOf(run, b); if (!to) return run;
  return moveBagMember(run, a, to.zone, to.index);
}
/** 出戰與待命整排對調（首頁「對調出戰／待命」）。待命有陣亡者或人數超出出戰上限時不動。 */
export function swapLineupBench(run: RunV2): RunV2 {
  if (!canEditBag(run)) return run;
  const { lineup, bench } = bagLists(run);
  const byId = new Map(run.team.map(e => [bid(e), e]));
  if (!bench.length || bench.length > lineupSlots(run) || lineup.length > benchSlots(run) || bench.some(x => !isAlive(byId.get(x)!))) return run;
  return { ...run, lineup: bench, bench: lineup };
}
/** 待命全部存入倉庫。 */
export function stashBench(run: RunV2): RunV2 {
  if (!canEditBag(run) || !benchOf(run).length) return run;
  return { ...run, lineup: lineupOf(run).map(bid), bench: [] };
}
/** 補位：出戰→待命依序由待命、倉庫補滿 */
function refillBag(run: RunV2): RunV2 {
  const cur = lineupOf(run).map(bid); let bench = benchOf(run).map(bid);
  while (cur.length < lineupSlots(run) && bench.length) cur.push(bench.shift()!);
  const used = new Set([...cur, ...bench]);
  for (const e of run.team) { if (cur.length >= lineupSlots(run)) break; if (!used.has(bid(e)) && isAlive(e)) { cur.push(bid(e)); used.add(bid(e)); } }
  for (const e of run.team) { if (bench.length >= benchSlots(run)) break; if (!used.has(bid(e))) { bench.push(bid(e)); used.add(bid(e)); } }
  return { ...run, lineup: cur, bench };
}
/** 新成員：出戰有空位→出戰；待命有空位→待命；否則送入倉庫 */
function autoJoin(run: RunV2, e: Elf): RunV2 {
  const cur = lineupOf(run).map(bid), bench = benchOf(run).map(bid);
  if (cur.length < lineupSlots(run)) return { ...run, lineup: [...cur, bid(e)], bench };
  if (bench.length < benchSlots(run)) return { ...run, lineup: cur, bench: [...bench, bid(e)] };
  return { ...run, lineup: cur, bench };
}
export function bagPlace(run: RunV2, e: Elf): "lineup" | "bench" | "storage" {
  return lineupOf(run).includes(e) ? "lineup" : benchOf(run).includes(e) ? "bench" : "storage";
}


/* ───────── 招募令 ───────── */
const TIER_LIST: Tier[] = ["low", "mid", "high", "apex"];
/** 招募令強度上限：隨章節成長（第 1 章 Ⅱ、第 2–3 章 Ⅲ、之後 Ⅳ），套裝「招募令強度上限 +1 階」再升一階。 */
export function tokenTierCap(run: Pick<RunV2, "act" | "equipType" | "equipId" | "nLevel">): Tier {
  const base = run.act <= 1 ? 1 : run.act <= 3 ? 2 : 3;
  return TIER_LIST[Math.min(3, base + (runPerk(run)?.tokenTierUp ? 1 : 0))];
}
/** 發一張令（id 由局種子序號衍生，可重現）。spec.tier 缺省時套用目前的強度上限。 */
export function mintToken(run: RunV2, spec: TokenSpec): RunV2 {
  const seq = run.tokenSeq ?? run.tokens.length;
  const token: RecruitToken = { ...spec, types: [...spec.types], tier: spec.tier ?? tokenTierCap(run), id: `${run.runId}:t${seq}` };
  return { ...run, tokens: [...run.tokens, token], tokenSeq: seq + 1 };
}
export const anyTokenCount = (run: Pick<RunV2, "tokens">): number => run.tokens.filter(t => t.kind === "any" && !t.repeat).length;
/** 花掉 n 張任意令（優先花強度上限低者）；不足則回傳 null。 */
export function spendAnyTokens(run: RunV2, n: number): RunV2 | null {
  const anys = run.tokens.filter(t => t.kind === "any" && !t.repeat).sort((a, b) => tierRank(a.tier ?? "apex") - tierRank(b.tier ?? "apex"));
  if (anys.length < n) return null;
  const drop = new Set(anys.slice(0, n).map(t => t.id));
  return { ...run, tokens: run.tokens.filter(t => !drop.has(t.id)) };
}
/** 目前可招募的候選池（已排除未完成資料、禁用）。 */
function recruitPool(run: RunV2, pool: Elf[], cap: Tier | undefined): Elf[] {
  const owned = new Set(run.team.map(e => String(e.id))), banned = new Set(bansOf(run));
  // 不走 byTier：它在該階沒人時會退回全體，這裡的強度上限必須是硬限制。
  return usablePool(pool).filter(e => !owned.has(elfKey(e)) && !banned.has(elfKey(e)) && (!cap || tierRank(tierOf(pool, e)) <= tierRank(cap)));
}
/** 隨機生成一張指定款式的令（類型取自目前真的有候選的屬性）；無法成立時退回任意令。 */
export function rollTokenSpec(run: RunV2, pool: Elf[], d: Dice, want: "has" | "exact" | "either" | "any" | "repeat", tier?: Tier): TokenSpec {
  const cap = tier ?? tokenTierCap(run);
  const cands = recruitPool(run, pool, cap);
  if (want === "repeat") return { kind: "any", types: [], match: "has", repeat: true, tier: cap };
  if (want === "exact") {
    const pairs = [...new Set(cands.map(elfTypes).filter(t => t.length === 2).map(t => [...t].sort().join("|")))];
    if (pairs.length) return { kind: "types", types: d.pick(pairs).split("|"), match: "exact", tier: cap };
    want = "has";
  }
  const kinds = [...new Set(cands.flatMap(elfTypes))];
  if (want === "has" && kinds.length) return { kind: "types", types: [d.pick(kinds)], match: "has", tier: cap };
  if (want === "either" && kinds.length >= 2) return { kind: "types", types: d.sample(kinds, 2), match: "either", tier: cap };
  if (want === "either" && kinds.length) return { kind: "types", types: [kinds[0]], match: "has", tier: cap };
  return { kind: "any", types: [], match: "has", tier: cap };
}
/**
 * 這張令可以招募誰。
 * 一般令：符合條件、強度不超過上限、未被禁用、未持有；重複招募令：隊伍裡已持有且還有強化空間的精靈。
 */
export function eligibleElves(run: RunV2, pool: Elf[], token: RecruitToken): Elf[] {
  if (token.repeat) return run.team.filter(e => dupOptions(run, e).stat || dupOptions(run, e).pp);
  return recruitPool(run, pool, token.tier).filter(e => tokenMatches(token, e));
}
/** 重複招募的強化上限（基礎 3 層，套裝特權 +n）。 */
export const dupCapOf = (run: Pick<RunV2, "equipType" | "equipId" | "nLevel">): number => DUP_BASE_CAP + (runPerk(run)?.dupCap ?? 0);
export function dupOptions(run: RunV2, e: Elf): { stat: boolean; pp: boolean; layers: number; cap: number } {
  const d = dupOf(e), cap = dupCapOf(run);
  return { stat: d.stat < cap, pp: !d.pp && e.skills.some(s => (s.maxPp ?? s.pp) > 0), layers: d.stat, cap };
}
/** 星晶招募的價格（持令招募免費，不用這個）。 */
export const recruitPrice = (run: Pick<RunV2, "recruitCount" | "act">, pool: Elf[], elf: Elf): number => recruitPriceOf(run.recruitCount ?? 0, run.act, tierOf(pool, elf));
/** 星晶可招募的候選池：沒有屬性或強度限制，只排除已持有與禁用。 */
export const shardCandidates = (run: RunV2, pool: Elf[]): Elf[] => recruitPool(run, pool, undefined);
/** 持有的令裡，哪一張最適合用來招募這隻（優先用限制最多、價值最低者）；沒有則 null。 */
export function tokenFor(run: RunV2, pool: Elf[], elf: Elf): RecruitToken | null {
  const rank = (t: RecruitToken) => (t.kind === "any" ? 3 : t.match === "exact" ? 0 : t.match === "either" ? 2 : 1) * 10 + tierRank(t.tier ?? "apex");
  const ok = run.tokens.filter(t => !t.repeat && eligibleElves(run, pool, t).some(e => elfKey(e) === elfKey(elf)));
  return ok.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}
/** 用星晶招募任一隻（沒有屬性／強度限制）；星晶不足、已持有、被禁用一律回傳原局面。 */
export function recruitWithShards(run: RunV2, elfId: string, pool: Elf[]): RunV2 {
  if (!canEditBag(run)) return run;
  const elf = shardCandidates(run, pool).find(e => elfKey(e) === elfId); if (!elf) return run;
  const price = recruitPrice(run, pool, elf); if (run.shards < price) return run;
  const next = addMember({ ...run, shards: run.shards - price, recruitCount: (run.recruitCount ?? 0) + 1 }, elfId, pool);
  return next === run ? run : log(next, `花費 ${price} 星晶招募。`);
}
/** 進階（強化）一隻已持有的精靈：每個選項要花多少星晶，已達上限者為 null。 */
export function advanceInfo(run: RunV2, e: Elf): { stat: number | null; pp: number | null; layers: number; cap: number; hasPp: boolean } {
  const o = dupOptions(run, e);
  return { stat: o.stat ? advanceStatPrice(o.layers) : null, pp: o.pp ? ADVANCE_PP_PRICE : null, layers: o.layers, cap: o.cap, hasPp: dupOf(e).pp };
}
/** 持有重複招募令（有就免費進階一次）。 */
export const repeatTokenOf = (run: Pick<RunV2, "tokens">): RecruitToken | null => run.tokens.find(t => t.repeat) ?? null;
function applyDup(run: RunV2, target: Elf, how: "stat" | "pp"): RunV2 {
  const d = dupOf(target), next = how === "stat" ? { stat: d.stat + 1, pp: d.pp } : { stat: d.stat, pp: true };
  const team = run.team.map(e => e === target ? { ...e, dup: next } as Elf : e);
  return syncTeam(log({ ...run, team }, `【${target.name}】進階：${how === "stat" ? `全能力強化至第 ${next.stat} 層（+${Math.round(next.stat * 40)}%）` : "戰鬥 PP 與上限 ×2"}。`));
}
/**
 * 進階：優先使用重複招募令（免費一次），否則花星晶（價格依層數）。
 * 層數已滿、PP×2 已選過、星晶不足、不是隊員一律回傳原局面。
 */
export function advanceElf(run: RunV2, bagId: string, how: "stat" | "pp", opts: { useToken?: boolean } = {}): RunV2 {
  if (!canEditBag(run)) return run;
  const target = run.team.find(e => bid(e) === bagId); if (!target) return run;
  const info = advanceInfo(run, target), price = how === "stat" ? info.stat : info.pp;
  if (price == null) return run;
  const tok = opts.useToken === false ? null : repeatTokenOf(run);
  if (tok) return applyDup({ ...run, tokens: run.tokens.filter(t => t.id !== tok.id) }, target, how);
  if (run.shards < price) return run;
  return applyDup({ ...run, shards: run.shards - price }, target, how);
}
/**
 * 用一張令免費招募／進階。一般令：把 elfId 的精靈加入隊伍；重複招募令：elfId 為隊伍成員的 bagId，另須指定 dup＝強化或雙倍 PP。
 * 不合規則（條件不符、被禁用、已持有、層數已滿、PP×2 已選過）一律回傳原局面，令不消耗。
 */
export function recruitWithToken(run: RunV2, tokenId: string, elfId: string, pool: Elf[], dup?: "stat" | "pp"): RunV2 {
  if (!canEditBag(run)) return run;
  const token = run.tokens.find(t => t.id === tokenId); if (!token) return run;
  const rest = { ...run, tokens: run.tokens.filter(t => t.id !== tokenId) };
  if (token.repeat) {
    const target = run.team.find(e => bid(e) === elfId); if (!target || !dup) return run;
    const o = dupOptions(run, target); if (dup === "stat" ? !o.stat : !o.pp) return run;
    return applyDup(rest, target, dup);
  }
  if (!eligibleElves(run, pool, token).some(e => elfKey(e) === elfId)) return run;
  const next = addMember(rest, elfId, pool); if (next === rest) return run;
  return next;
}
/** 現在能不能招募或進階（背包可整理且有星晶或令）。 */
export const canRecruitNow = (run: RunV2): boolean => canEditBag(run) && (run.shards > 0 || run.tokens.length > 0);

/* ───────── 重複招募令的隨機掉落 ───────── */
/** 以來源機率擲一次重複招募令；擲骰走 Dice，同一局種子可重現。 */
export function rollRepeatDrop(run: Pick<RunV2, "nLevel">, d: Dice, source: DropSource): boolean {
  return d.chance(repeatDropChance(source, clampN(run.nLevel)));
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
  const slots = Math.max(1, Math.min(team.length, lineupSlots(run)));
  return syncTeam(log({ ...run, team, lineup: team.slice(0, slots).map(bid), bench: team.slice(slots).map(bid).slice(0, benchSlots(run)), scene: { kind: "map" } }, `持燈者：${team.map(e => e.name).join("、")}。`));
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
    case "shop": { const [shop, nonce] = withDice(run, d => ({ stock: rollShop(run, pool, d), barter: rollBarter(run, d) })); return { ...run, nonce, scene: { kind: "shop", stock: shop.stock, barter: shop.barter } }; }
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
/** 依章節挑一件尚未持有的倍增遺物（前期稜鏡／晶簇、中期晶簇／雙生之核、後期雙生之核／黑日之心）。 */
function pickMulRelic(run: RunV2, d: Dice): string | null {
  const owned = new Set(run.relics);
  const order = run.act <= 2 ? ["mul_prism", "mul_cluster"] : run.act <= 4 ? ["mul_cluster", "twin_core"] : ["twin_core", "black_sun_heart"];
  const first = order.filter(id => !owned.has(id)), c = first.length ? first : ["mul_cluster", "mul_prism"].filter(id => !owned.has(id));
  return c.length ? d.pick(c) : null;
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
  const candidates = byTier(pool, tierFor[kind], bansOf(run));
  const picked = d.sample(candidates, Math.min(count, candidates.length));
  const lv = levelOf(run);
  const affixCount = (kind === "boss" ? 2 + (a >= 5 ? 1 : 0) + (run.modifiers.includes("strong_boss") ? 1 : 0) : kind === "elite" ? 1 + (e >= 50 ? 1 : 0) + (a >= 4 ? 1 : 0) : e >= 75 ? 1 : 0) + (kind === "combat" ? 0 : lv.affixBonus);
  const enemies = picked.map((el, i) => ({ id: elfKey(el), affixes: d.sample(AFFIXES.map(x => x.id), kind === "boss" && i > 0 ? Math.max(0, affixCount - 1) : affixCount) }));
  // 深度曲線：敵方能力＝depthMul(L) × 類型加成（夢魘 ×1.15、王座 ×1.3）× 蝕度階段 × (1+N)；
  // 體力＝depthMul(L) × 類型體力係數（一般 2.5、夢魘 4、王座 7）× 蝕度 × (1+N)。L＝(章−1)×12 + min(欄,12)。
  const depth = depthOf(a, currentNode(run).col);
  const { scale, hpScale } = enemyScales(kind, depth, e);
  const lead = findElf(pool, enemies[0]?.id ?? "");
  const title = kind === "boss" ? `${actDef(run).name}之主・${lead?.name ?? "？"}` : kind === "elite" ? `夢魘・${lead?.name ?? "？"}` : `遭遇・${lead?.name ?? "？"}`;
  return { kind, title, enemies, reward, scale: Math.round(scale * (1 + lv.enemyStat) * 100) / 100, hpScale: Math.round(hpScale * (1 + lv.enemyHp) * 100) / 100, depth };
}
/** 敵方倍率（未乘 N 等級）：depthMul(L) × 類型加成 × 蝕度階段；體力另用類型體力係數。 */
export function enemyScales(kind: "combat" | "elite" | "boss", depth: number, eclipse: number): { scale: number; hpScale: number } {
  const dm = depthMul(depth);
  return {
    scale: dm * (kind === "elite" ? 1.15 : kind === "boss" ? 1.3 : 1) * (eclipse >= 25 ? 1.1 : 1) * (kind === "boss" && eclipse >= 75 ? 1.15 : 1),
    hpScale: dm * (kind === "boss" ? 7 : kind === "elite" ? 4 : 2.5) * (eclipse >= 100 ? 1.2 : 1),
  };
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
/** 戰鬥亂數種子與戰鬥 id 皆由局種子衍生：同局同節點同進度永遠相同。 */
export const battleSeedOf = (run: RunV2): number => deriveSeed(run.seed, "battle", run.at ?? "-", run.nonce, run.stats.fights) || 1;
export const battleIdOf = (run: RunV2): string => `${run.runId}:b${run.stats.fights}:${run.at ?? "-"}:${run.nonce}`;
export function startBattle(run: RunV2, pool: Elf[], battleId: string): { run: RunV2; p1: Elf[]; p2: Elf[]; relics: string[]; enemyRelics: string[]; battleSeed: number } | null {
  if (run.scene.kind !== "prelude") return null;
  const enc = run.scene.encounter, perk = runPerk(run);
  run = ensureFighters(run);
  // 首領戰前回滿（套裝特權）：出戰存活者體力與 PP 回滿，寫回存檔
  if (perk?.bossHeal && enc.kind === "boss") {
    const front = new Set(lineupOf(run).map(bid));
    run = { ...run, team: run.team.map(e => front.has(bid(e)) && isAlive(e) ? { ...e, currentHp: e.maxHp, skills: e.skills.map(s => ({ ...s, pp: s.maxPp ?? s.pp })) } as Elf : e) };
  }
  // 固定值（護盾、固定傷害、藥劑回復）依層數乘 √depthMul，敵我同一曲線
  const L = enc.depth ?? depthOf(run.act, currentNode(run).col), fm = fixedMulAt(L);
  const openShield = !!perk?.openShield && run.shieldAct !== run.act;
  // 只派出出戰名單中的存活者（名單順序＝出場順序）；雙倍 PP 只改戰鬥副本
  // 幻化「指定背包內精靈」以回廊背包為準：位數取自完整出戰名單（含已倒下者），待命取自 benchOf。
  const lineupAll = lineupOf(run);
  const bag = bindBag([...lineupAll, ...benchOf(run)].map(e => snapshotElf(run, e)), lineupAll.length);
  const p1 = lineupAll.flatMap((e, i) => isAlive(e) ? [applyDupPp(bag[i])] : []).map(e => {
    const gain = (run.relics.includes("void_shield_gen") ? Math.round(500 * fm) : 0) + (openShield ? Math.round(OPEN_SHIELD_BASE * fm) : 0);
    return gain ? { ...e, shield: (e.shield || 0) + gain } : e;
  });
  if (!p1.length) return null;
  const ordered = p1;
  const p2 = buildEnemies(enc, pool, enemyHpFloor(run, enc));
  const relics = [...run.relics.map(id => id === "eclipse_crown" ? `eclipse_crown:${run.eclipse}` : id), fixedMulEntry(L)];
  // 逆時沙漏：記下戰前狀態（含首領戰前回滿、尚未加護盾），戰敗將結算時回溯
  const pre: PreBattle | undefined = run.relics.includes("reverse_hourglass") ? { team: run.team, lineup: run.lineup, bench: run.bench, potions: run.potions, eclipse: run.eclipse, shieldAct: run.shieldAct } : undefined;
  return { run: { ...run, lastRescue: null, shieldAct: openShield ? run.act : run.shieldAct, pendingBattle: { id: battleId, nodeId: run.at, encounter: enc, battleSeed: battleSeedOf(run), ...(pre ? { pre } : {}) } }, p1: ordered, p2, relics, enemyRelics: [...enemyAffixRelics(enc), fixedMulEntry(L)], battleSeed: battleSeedOf(run) };
}
/** 撤離（只限一般遭遇）：失去 15% 賽爾豆，蝕度 +5 */
export function fleeEncounter(run: RunV2): RunV2 {
  if (run.scene.kind !== "prelude" || run.scene.encounter.kind === "boss") return run;
  return backToMap(log({ ...run, beans: Math.floor(run.beans * .85), eclipse: run.eclipse + 5 }, "你撤退了。黑暗記住了你的背影。"), "撤離成功：失去 15% 賽爾豆，蝕度 +5。");
}

/* ───────── 戰鬥結算 ───────── */
/** 出戰名單全滅但隊伍還有存活者：由待命、倉庫的存活者補上出戰（陣亡者退到待命／倉庫）。 */
export function ensureFighters(run: RunV2): RunV2 {
  if (lineupOf(run).some(isAlive)) return run;
  const alive = [...benchOf(run), ...storageOf(run)].filter(isAlive);
  if (!alive.length) return run;
  const lineup = alive.slice(0, lineupSlots(run)).map(bid), used = new Set(lineup);
  const bench = [...lineupOf(run).map(bid), ...benchOf(run).map(bid)].filter(id => !used.has(id)).slice(0, benchSlots(run));
  return { ...run, lineup, bench };
}
/** 持有的保命來源（依消耗順序）：套裝特權尚未用掉、再來是保命遺物 */
export function rescueSources(run: RunV2): string[] {
  const out: string[] = [];
  if (runPerk(run)?.lifeline && !run.lifelineUsed) out.push("perk:fate_defier");
  for (const id of RESCUE_ORDER) if (run.relics.includes(id)) out.push(id);
  return out;
}
const healTo = (team: Elf[], p: number): Elf[] => team.map(e => ({ ...e, currentHp: Math.max(isAlive(e) ? e.currentHp : 0, Math.floor(e.maxHp * p)) }) as Elf);
/** 戰敗將被結算時觸發保命。回傳新局面；沒有任何保命時回傳 null。每次只消耗一個來源。 */
function rescueRun(next: RunV2, pb: NonNullable<RunV2["pendingBattle"]>): RunV2 | null {
  const src = rescueSources(next)[0]; if (!src) return null;
  const enc = pb.encounter, retry = (r: RunV2): RunV2 => ({ ...r, nonce: r.nonce + 1, scene: { kind: "prelude", encounter: enc } });
  const mark = (r: RunV2, id: string, text: string): RunV2 => log({ ...r, lastRescue: { id, text }, rescues: [...(r.rescues ?? []), id] }, text);
  const drop = (r: RunV2, id: string): RunV2 => syncTeam({ ...r, relics: r.relics.filter((x, i) => i !== r.relics.indexOf(id)) });
  if (src === "perk:fate_defier") {
    // 套裝特權「戰敗保留隊伍」：每局一次，全隊以 30% 體力回到原地（首領戰敗則重回戰前）
    const kept = mark({ ...next, team: healTo(next.team, .3), lifelineUsed: true, eclipse: next.eclipse + 6 }, src, "逆命者：燈幾乎熄了，又被誰護住。全隊 30% 體力，蝕度 +6。");
    return enc.kind === "boss" ? retry(kept) : backToMap(ensureFighters(kept), "戰敗，隊伍被保下：全隊 30% 體力，蝕度 +6。");
  }
  if (src === "substitute_doll") {
    // 替身人偶：失去一半賽爾豆與一件隨機遺物，全隊 40% 體力繼續
    let r = drop(next, src);
    const d = new Dice(r.seed, r.nonce), cands = r.relics.filter(x => !(RESCUE_ORDER as readonly string[]).includes(x)), lost = cands.length ? d.pick(cands) : null; // 其他保命遺物不會被當成代價
    r = { ...r, nonce: d.nonce, beans: Math.floor(r.beans / 2) };
    if (lost) r = drop(r, lost);
    r = { ...r, team: healTo(r.team, .4) };
    r = mark(r, src, `替身人偶碎了：失去一半賽爾豆${lost ? `與【${RELIC_BY_ID[lost]?.name ?? lost}】` : ""}，全隊 40% 體力。`);
    return enc.kind === "boss" ? retry(r) : backToMap(ensureFighters(r), "替身人偶代你死了一次：全隊 40% 體力。");
  }
  if (src === "undying_core") {
    // 不滅星核：全隊 50% 體力，留在原節點重戰
    const r = mark({ ...drop(next, src), team: healTo(next.team, .5) }, src, "不滅星核碎裂：全隊回復至 50% 體力，原地重戰。");
    return retry(r);
  }
  // 逆時沙漏：回到戰前狀態（體力、PP、藥劑、背包編排），蝕度 +10，可改隊重戰
  const pre = pb.pre;
  if (!pre) return null;
  const r = mark({ ...drop(next, src), team: pre.team, lineup: pre.lineup, bench: pre.bench, potions: pre.potions, shieldAct: pre.shieldAct, eclipse: pre.eclipse + 10 }, src, "逆時沙漏倒轉：回到戰前，蝕度 +10。可改隊重戰。");
  return retry(r);
}

export function settleBattleV2(run: RunV2, battleId: string, winner: string, team: Elf[] | undefined, pool: Elf[]): RunV2 {
  const pb = run.pendingBattle;
  if (!pb || pb.id !== battleId) return run;
  const win = winner === "p1";
  // 隊伍延續：體力、PP（以 battleId 對應）
  let next: RunV2 = { ...run, pendingBattle: null, lastBattle: { win, outcome: winner },
    team: run.team.map(e => {
      const after = team?.find(x => (x.battleId || x.id) === (e.battleId || e.id)); if (!after) return e;
      return { ...e, maxHp: after.maxHp, currentHp: Math.min(after.maxHp, Math.max(0, after.currentHp)), survivalRule: after.survivalRule,
        skills: e.skills.map((s, i) => ({ ...s, pp: foldDupPp(e, after.skills?.[i]?.pp, s.pp, s.maxPp) })), explorationVitals: true } as Elf;
    }) };
  const fatal = !next.team.some(isAlive) || (!win && pb.encounter.kind === "boss");
  if (fatal) {
    // 失敗將被結算：先依序嘗試保命（套裝特權 → 替身人偶 → 不滅星核 → 逆時沙漏），都沒有才結算敗北
    const saved = rescueRun(next, pb);
    if (saved) return saved;
    const cause: DefeatCause = winner === "exit" ? "exit" : pb.encounter.kind === "boss" && next.team.some(isAlive) ? "boss" : "wipe";
    return log({ ...next, lastRescue: null, scene: { kind: "end", result: "wiped", cause, by: pb.encounter.title } }, `敗北：${DEFEAT_TEXT[cause]}（${pb.encounter.title}）。燈熄了。`);
  }
  if (!win) {
    // 撤退／失敗（非首領、仍有存活者）：蝕度 +6，回到地圖；出戰名單全滅時由存活者補上
    const reformed = ensureFighters(next);
    return backToMap(log({ ...reformed, eclipse: reformed.eclipse + 6 }, `敗走於【${pb.encounter.title}】。`), reformed !== next ? "戰敗撤離：蝕度 +6。出戰全滅，已由存活者補位。" : "戰敗撤離：蝕度 +6。");
  }
  const enc = pb.encounter; const a = run.act; const m = mods(run);
  const eclipseBonus = run.eclipse >= 100 ? 1.5 : run.eclipse >= 50 ? 1.25 : 1;
  const baseBeans = enc.kind === "boss" ? 180 + a * 50 : enc.kind === "elite" ? 90 + a * 30 : 40 + a * 15;
  const modMult = (1 + next.modifiers.length * .1) * m.expMult;
  const reward: Reward = {
    beans: Math.floor(baseBeans * m.beansMult * eclipseBonus), tokens: [],
    potions: 0, exp: Math.floor((enc.kind === "boss" ? 150 : enc.kind === "elite" ? 60 : 20) * modMult),
    relicChoices: [], recruitChoices: [], isBoss: enc.kind === "boss", isFinal: enc.kind === "boss" && a >= FINAL_ACT,
  };
  const [rolled, nonce] = withDice(next, d => {
    const r = { ...reward };
    const choices = Math.max(1, 3 + m.extraRewardChoice + levelOf(next).rewardChoice);
    if (enc.kind === "boss") {
      r.relicChoices = rollRelics(next, d, choices, { boss: 70, legendary: 30 });
      // 每章保證至少一個倍增遺物選項，讓玩家倍率追得上敵方曲線
      if (!r.relicChoices.some(isMulRelic)) { const mul = pickMulRelic(next, d); if (mul) r.relicChoices = [...r.relicChoices.slice(0, Math.max(0, choices - 1)), mul]; }
    }
    else if (enc.kind === "elite" || enc.reward) {
      const w = enc.reward === "legendary" ? { legendary: 100 } : { common: 20, rare: 70, legendary: 10 };
      r.relicChoices = rollRelics(next, d, Math.max(1, choices + (enc.kind === "elite" ? m.eliteRelicChoice : 0)), w);
    } else if (d.chance(.4)) r.relicChoices = rollRelics(next, d, 2, { common: 80, rare: 20 });
    // 星晶：首領 3、夢魘 1、一般 20% 給 1
    r.shards = enc.kind === "boss" ? SHARD_INCOME.boss : enc.kind === "elite" ? SHARD_INCOME.elite : d.chance(SHARD_INCOME.combatChance) ? SHARD_INCOME.combat : 0;
    // 招募令（限定招募券）：首領 1 張任意令；夢魘 50% 雙屬性令、否則任一屬性令；一般 15% 單屬性令；重複招募令依來源機率隨機掉落（不限章節）
    const specs: TokenSpec[] = [];
    if (enc.kind === "boss") specs.push(rollTokenSpec(next, pool, d, "any"));
    else if (enc.kind === "elite") specs.push(rollTokenSpec(next, pool, d, d.chance(.5) ? "exact" : "either"));
    else if (d.chance(.15)) specs.push(rollTokenSpec(next, pool, d, "has"));
    if (rollRepeatDrop(next, d, enc.kind === "boss" ? "boss" : enc.kind === "elite" ? "elite" : "combat")) specs.push(rollTokenSpec(next, pool, d, "repeat"));
    r.tokens = specs.map(spec => ({ ...spec, types: [...spec.types], id: "" }));
    if (enc.kind === "combat" && d.chance(.25)) r.potions = 1;
    if (enc.kind === "elite") r.potions = 1;
    return r;
  });
  // 令入帳（id 在此由局序號決定）
  for (const t of rolled.tokens ?? []) next = mintToken(next, t);
  rolled.tokens = next.tokens.slice(next.tokens.length - (rolled.tokens?.length ?? 0));
  next = { ...next, nonce, beans: next.beans + rolled.beans, shards: next.shards + (rolled.shards ?? 0), potions: next.potions + rolled.potions, exp: next.exp + rolled.exp,
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
/** 隊伍沒有上限；出戰名單有空位就自動上場，否則待命。（replaceIdx 保留舊參數相容，不再使用） */
function addMember(run: RunV2, id: string, pool: Elf[], _replaceIdx = -1): RunV2 {
  const base = findElf(pool, id); if (!base) return run;
  const elf = snapshotElf(run, { ...base, battleId: `run-${run.seed}-${run.nonce}-${id}` } as Elf);
  const joined = autoJoin({ ...run, team: [...run.team, elf] }, elf);
  const place = bagPlace(joined, elf);
  return log({ ...joined, nonce: run.nonce + 1 }, `【${base.name}】加入了隊伍${place === "bench" ? "（待命）" : place === "storage" ? "（背包已滿，送入倉庫）" : ""}。`);
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
  const team = run.team.map(e => ({ ...e, currentHp: isAlive(e) ? e.maxHp : levelOf(run).noRevive ? e.currentHp : Math.floor(e.maxHp * .5), skills: e.skills.map(s => ({ ...s, pp: s.maxPp ?? s.pp })) }) as Elf);
  const potions = Math.max(run.potions, 3) + (run.relics.includes("apothecary_lamp") ? 2 : 0);
  const next = prerollMysteries({ ...run, act, map, nonce, at: map.nodes.find(n => n.col === 0)!.id, team, potions, eclipse: Math.max(0, run.eclipse - 15), scene: { kind: "map", note: `第 ${act} 章：${ACTS[act - 1]?.name}・背包 ${Math.min(6, 3 + (act - 1) + mods(run).lineupBonus)} 出戰＋${Math.min(6, 3 + (act - 1) + mods(run).lineupBonus)} 待命` } });
  // 出戰上限提高：以待命中的夥伴依序補上空位
  return log(refillBag(next), `進入【${ACTS[act - 1]?.name}】。`);
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
    recruitToken: want => { cur = mintToken(cur, rollTokenSpec(cur, pool, dice, want)); },
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
    battle: (kind, reward) => { pendingScene = { kind: "prelude", encounter: rollEncounter({ ...cur, nonce: dice.nonce }, kind, pool, dice, reward) }; },
    reveal: () => { cur = { ...cur, revealAct: cur.act }; },
    sacrifice: () => { if (cur.team.length <= 1) return null; const t = cur.team[Math.floor(dice.next() * cur.team.length)]; cur = { ...cur, team: cur.team.filter(e => e !== t) }; return t.name; },
  };
  let outcome = ch.apply(ops);
  // 任何事件的結果都有機率額外掉一枚重複招募令（戰鬥類事件等結算後才給的不在此列）
  if (!pendingScene && rollRepeatDrop(cur, dice, "event")) { cur = mintToken(cur, rollTokenSpec(cur, pool, dice, "repeat")); outcome += "　一枚重複招募令落在腳邊。"; }
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
function rollShop(run: RunV2, pool: Elf[], d: Dice): ShopItem[] {
  const f = (1 + .1 * (run.act - 1)) * mods(run).shopMult;
  const relics = [...rollRelics(run, d, 2, { common: 1 }), ...rollRelics(run, d, 1, { rare: 85, legendary: 15 })];
  const tokenMul = run.modifiers.includes("cost_recruit") ? 1.25 : 1;
  // 招募令兩欄：一張單屬性令；稀有欄在雙屬性／任一屬性／任意之間抽，另有機率（不限章節）換成重複招募令
  const want = d.weighted<"exact" | "either" | "any">([{ item: "exact", w: 35 }, { item: "either", w: 25 }, { item: "any", w: 40 }]);
  const specs = [rollTokenSpec(run, pool, d, "has"), rollRepeatDrop(run, d, "shop") ? rollTokenSpec(run, pool, d, "repeat") : rollTokenSpec(run, pool, d, want)];
  return [
    ...relics.map(id => ({ kind: "relic" as const, ref: id, price: Math.round(RELIC_PRICE[RELIC_BY_ID[id].rarity] * f), currency: "beans" as const })),
    ...specs.map(token => ({ kind: "token" as const, token, price: Math.round(tokenBasePrice(token) * f * tokenMul), currency: "beans" as const })),
    ...[0, 1].map(() => ({ kind: "shard" as const, qty: 1, price: Math.round(SHARD_SHOP_PRICE * f * tokenMul), currency: "beans" as const })),
    { kind: "potion", price: Math.round(45 * f), currency: "beans" },
    { kind: "mend", price: Math.round(60 * f), currency: "beans" },
    { kind: "purge", price: Math.round(100 * f), currency: "beans" },
  ];
}
export function shopBuy(run: RunV2, idx: number, pool: Elf[], _replaceIdx = -1): RunV2 {
  if (run.scene.kind !== "shop") return run;
  const item = run.scene.stock[idx]; if (!item || item.sold) return run;
  // 舊存檔以星晶標價的精靈商品已在載入時移除；商店只收賽爾豆
  if (item.currency !== "beans" || run.beans < item.price) return run;
  const pay = (r: RunV2): RunV2 => ({ ...r, beans: r.beans - item.price });
  let next = run;
  if (item.kind === "relic") next = gainRelic(pay(run), item.ref!);
  else if (item.kind === "shard") next = log({ ...pay(run), shards: run.shards + (item.qty ?? 1) }, `購入 ${item.qty ?? 1} 星晶。`);
  else if (item.kind === "token") { if (!item.token) return run; next = log(mintToken(pay(run), item.token), `購入【${tokenLabel({ ...item.token, id: "" })}】。`); }
  else if (item.kind === "potion") next = pay({ ...run, potions: run.potions + 1 });
  else if (item.kind === "mend") next = pay({ ...run, team: run.team.map(e => isAlive(e) ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + Math.floor(e.maxHp * .3)) } : e) });
  else if (item.kind === "purge") { const c = run.relics.find(r => r.startsWith("curse_")); if (!c) return run; next = syncTeam(log(pay({ ...run, relics: run.relics.filter((_, i) => i !== run.relics.indexOf(c)) }), `擺脫了【${RELIC_BY_ID[c]?.name}】。`)); }
  else return run;
  const stock = (run.scene.stock).map((s, i) => i === idx ? { ...s, sold: s.kind !== "potion" && s.kind !== "mend" } : s);
  return { ...next, scene: { ...run.scene, kind: "shop", stock } };
}
/** 刷新商品：套裝「每層免費刷新 1 次」用完後，每次 40 賽爾豆（×商店係數），逐次 +20。 */
export function shopRerollCost(run: RunV2): number {
  if (run.scene.kind !== "shop") return 0;
  if (runPerk(run)?.freeReroll && !run.scene.freeUsed) return 0;
  return Math.round((40 + 20 * (run.scene.rerolls ?? 0)) * (1 + .1 * (run.act - 1)) * mods(run).shopMult);
}
export function shopReroll(run: RunV2, pool: Elf[]): RunV2 {
  if (run.scene.kind !== "shop") return run;
  const cost = shopRerollCost(run); if (run.beans < cost) return run;
  const free = cost === 0 && !run.scene.freeUsed && !!runPerk(run)?.freeReroll;
  const [stock, nonce] = withDice(run, d => rollShop(run, pool, d));
  return { ...run, nonce, beans: run.beans - cost, scene: { kind: "shop", stock, rerolls: (run.scene.rerolls ?? 0) + (free ? 0 : 1), freeUsed: run.scene.freeUsed || free, barter: run.scene.barter } };
}


/* ───────── 失與得：以物易物 ───────── */
/** 本店擺出的配方（種子可重現）與可兌換次數；章節決定有哪些配方，N 等級決定次數。 */
function rollBarter(run: RunV2, d: Dice): BarterState {
  const offers = d.sample(recipesFor(run.act).map(r => r.id), BARTER_SHOWN);
  return { offers, left: barterLimit(clampN(run.nLevel)), uses: {} };
}
/** 目前商店擺出的配方（已套用 N 等級） */
export function barterRecipesOf(run: RunV2): BarterRecipe[] {
  if (run.scene.kind !== "shop" || !run.scene.barter) return [];
  const n = clampN(run.nLevel);
  return run.scene.barter.offers.map(id => BARTER_BY_ID[id]).filter(Boolean).map(r => recipeAt(r, n));
}
/** 這條配方可以用哪些東西付：遺物（背包索引）／令（id）；其餘貨幣只看數量 */
export function barterGiveChoices(run: RunV2, r: BarterRecipe): { relics: number[]; tokens: string[] } {
  return {
    relics: r.give.kind === "relic" ? run.relics.map((id, i) => (r.give.rarities ?? []).includes(RELIC_BY_ID[id]?.rarity) ? i : -1).filter(i => i >= 0) : [],
    tokens: r.give.kind === "token" ? run.tokens.filter(t => tokenAccepted(t, r)).map(t => t.id) : [],
  };
}
/** 不能兌換的原因（可以時為 null），給介面 tooltip */
export function barterBlock(run: RunV2, id: string): string | null {
  if (run.scene.kind !== "shop" || !run.scene.barter) return "這裡沒有兌換";
  const b = run.scene.barter, base = BARTER_BY_ID[id];
  if (!base || !b.offers.includes(id)) return "本店沒有這條兌換";
  if (b.left <= 0) return "本店的兌換次數已用完";
  if ((b.uses[id] ?? 0) >= BARTER_MAX_USES) return `這條兌換在本店最多 ${BARTER_MAX_USES} 次`;
  const r = recipeAt(base, clampN(run.nLevel)), g = r.give;
  if (g.kind === "beans" && run.beans < g.qty) return "賽爾豆不足";
  if (g.kind === "shard" && run.shards < g.qty) return "星晶不足";
  if (g.kind === "potion" && run.potions < g.qty) return "藥劑不足";
  if (g.kind === "relic" && !barterGiveChoices(run, r).relics.length) return "沒有符合的遺物";
  if (g.kind === "token" && !barterGiveChoices(run, r).tokens.length) return "沒有符合的招募令";
  return null;
}
/** 兌換一次。relic＝run.relics 的索引；token＝令 id（缺省取第一個可用者）。 */
export function barterTrade(run: RunV2, id: string, pick: { relic?: number; token?: string } = {}, pool: Elf[] = []): RunV2 {
  if (barterBlock(run, id) || run.scene.kind !== "shop" || !run.scene.barter) return run;
  const b = run.scene.barter, r = recipeAt(BARTER_BY_ID[id], clampN(run.nLevel)), g = r.give, t = r.get;
  const choices = barterGiveChoices(run, r);
  let next: RunV2 = run, paid = "";
  if (g.kind === "beans") { next = { ...next, beans: next.beans - g.qty }; paid = `${g.qty} 賽爾豆`; }
  else if (g.kind === "shard") { next = { ...next, shards: next.shards - g.qty }; paid = `${g.qty} 星晶`; }
  else if (g.kind === "potion") { next = { ...next, potions: next.potions - g.qty }; paid = `${g.qty} 藥劑`; }
  else if (g.kind === "relic") {
    const idx = pick.relic !== undefined && choices.relics.includes(pick.relic) ? pick.relic : choices.relics[0];
    const rid = run.relics[idx]; paid = `【${RELIC_BY_ID[rid]?.name ?? rid}】`;
    next = syncTeam({ ...next, relics: next.relics.filter((_, i) => i !== idx) });
  } else {
    const tid = pick.token && choices.tokens.includes(pick.token) ? pick.token : choices.tokens[0];
    const tk = run.tokens.find(x => x.id === tid)!; paid = `【${tokenLabel(tk)}】`;
    next = { ...next, tokens: next.tokens.filter(x => x.id !== tid) };
  }
  let got = "";
  if (t.kind === "beans") { next = { ...next, beans: next.beans + t.qty }; got = `${t.qty} 賽爾豆`; }
  else if (t.kind === "shard") { next = { ...next, shards: next.shards + t.qty }; got = `${t.qty} 星晶`; }
  else if (t.kind === "potion") { next = { ...next, potions: next.potions + t.qty }; got = `${t.qty} 藥劑`; }
  else if (t.kind === "token") {
    const d = new Dice(next.seed, next.nonce), spec = rollTokenSpec(next, pool, d, "has", t.tokenTier);
    next = mintToken({ ...next, nonce: d.nonce }, spec); got = `【${tokenLabel({ ...spec, id: "" })}】`;
  }
  const barter: BarterState = { ...b, left: b.left - 1, uses: { ...b.uses, [id]: (b.uses[id] ?? 0) + 1 } };
  return log({ ...next, scene: { ...run.scene, barter } }, `失與得：以 ${paid} 換得 ${got}。`);
}

/* ───────── 星爐 ───────── */
export function restAction(run: RunV2, action: "mend" | "revive" | "temper", targetIdx = -1): RunV2 {
  if (run.scene.kind !== "rest" || run.scene.done) return run;
  const m = mods(run);
  if (action === "mend") {
    const p = .35 * m.restHealMult;
    const bag = new Set([...lineupOf(run), ...benchOf(run)]);
    const team = run.team.map(e => bag.has(e) && isAlive(e) ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + Math.floor(e.maxHp * p)), skills: e.skills.map(s => ({ ...s, pp: s.maxPp ?? s.pp })) } as Elf : e);
    return { ...run, team, potions: run.potions + 1, scene: { kind: "rest", done: `火光裡，傷口合上了。背包精靈恢復 ${Math.round(p * 100)}% 體力，技能 PP 回滿，藥劑 +1。` } };
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
  { id: "dark", label: "暗之契", hint: "蝕度 +15：星晶 +3" },
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
  } else { next = { ...run, eclipse: run.eclipse + 15, shards: run.shards + 3 }; text = "月影爬上你的手臂。三枚星晶落在掌心。"; }
  if (rollRepeatDrop(next, d, "altar")) { next = mintToken(next, rollTokenSpec(next, [], d, "repeat")); text += "　一枚重複招募令從石縫滑出。"; }
  return { ...next, nonce: d.nonce, scene: { kind: "altar", done: text } };
}

/* ───────── 寶匣 ───────── */
export function takeTreasure(run: RunV2, id: string): RunV2 {
  if (run.scene.kind !== "treasure" || run.scene.done || !run.scene.offer.includes(id)) return run;
  let next = gainRelic(run, id);
  let done = RELIC_BY_ID[id]?.name ?? "";
  const d = new Dice(run.seed, next.nonce);
  if (rollRepeatDrop(next, d, "treasure")) { next = mintToken(next, rollTokenSpec(next, [], d, "repeat")); done += "　匣底還壓著一枚重複招募令。"; }
  return { ...next, nonce: d.nonce, scene: { ...run.scene, done } } as RunV2;
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
