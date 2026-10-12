/**
 * 傷害帳本：每筆「實際落地」的傷害（SettlementReceipt）一列，結算畫面只讀這裡。
 * 純資料模組，不依賴 React／引擎；通用，不含任何精靈專屬判斷。
 * hpLost = 實際扣掉的體力；shield／barrier 為被護盾、屏障吸收的量（不計入輸出）。
 * 體力調整（adjust_hp）不是傷害，另記在 adjust 欄位，與帳本對帳用。
 */
import type { SettlementReceipt } from './settlementReceipt';

export type Side = 'p1' | 'p2';
export type DamageSourceKind = 'skill' | 'soulmark' | 'status' | 'title' | 'item' | 'reflect' | 'other';

export const SOURCE_KINDS: readonly DamageSourceKind[] = ['skill', 'soulmark', 'status', 'title', 'reflect', 'item', 'other'];
export const SOURCE_KIND_LABEL: Record<DamageSourceKind, string> = {
  skill: '技能', soulmark: '魂印', status: '異常', title: '稱號', item: '道具', reflect: '反射', other: '其他',
};
export const DAMAGE_TYPE_LABEL: Record<string, string> = {
  skill: '技能', skill_attack: '攻擊', skill_attribute: '屬性', fixed: '固定', percent: '百分比', true: '真實', true_damage: '真實',
};

export interface DamageLedgerEntry {
  turn: number;
  targetSide: Side;
  targetBattleId: string;
  targetName: string;
  sourceSide: Side;
  sourceBattleId: string;
  sourceName: string;
  sourceKind: DamageSourceKind;
  /** 技能名／魂印／異常名／稱號… */
  sourceLabel: string;
  damageType: string;
  isCrit: boolean;
  hpLost: number;
  shieldAbsorbed: number;
  barrierAbsorbed: number;
  /** 來源與受擊同側（自傷）：不計入該側「輸出」。 */
  selfInflicted: boolean;
}

export interface HealLedgerEntry { turn: number; side: Side; targetBattleId: string; targetName: string; amount: number }

export interface DamageLedger {
  entries: DamageLedgerEntry[];
  heals: HealLedgerEntry[];
  /** 體力調整（非傷害、非恢復）：增加／減少的總量，對帳用。 */
  adjust: Record<Side, { up: number; down: number }>;
}

export function createDamageLedger(): DamageLedger {
  return { entries: [], heals: [], adjust: { p1: { up: 0, down: 0 }, p2: { up: 0, down: 0 } } };
}

export interface DamageOrigin { sourceSide?: Side; sourceBattleId?: string; sourceName?: string; kind?: DamageSourceKind; label?: string }

const STATUS_LABEL = /^[【\[]?(麻[痹痺]|害怕|睡眠|石化|癱瘓|詛咒|狂信|沉睡|冰封|凍結|焚燼|感染|中毒|燒傷|寄生|凍傷|混亂|衰弱|易燃|流血|失明|烈焰詛咒|束縛|失神|沉默|臣服|沸湧|遲鈍|繳械|腐朽|失溫|窒息|凝滯|漸凍|致命詛咒|虛弱詛咒|流失|恐懼)/;
const other = (side: Side): Side => (side === 'p1' ? 'p2' : 'p1');

export interface LedgerRecordInput {
  turn: number;
  targetSide: Side;
  targetBattleId: string;
  targetName: string;
  /** 受擊當下雙方出戰精靈（來源缺值時回推）。 */
  active: Record<Side, { battleId: string; name: string }>;
  receipt: Pick<SettlementReceipt, 'hpLost' | 'shieldAbsorbed' | 'barrierAbsorbed'>;
  /** 傷害 effect 的 data（只讀既有欄位）。 */
  data: Record<string, any>;
  damageType: string;
}

/** 由既有欄位推斷來源種類；顯式 data.ledger 優先。 */
export function buildLedgerEntry(input: LedgerRecordInput): DamageLedgerEntry {
  const { data, targetSide } = input;
  const explicit: DamageOrigin = data.ledger || {};
  const rawLabel = String(data.label || '').trim();
  let kind: DamageSourceKind;
  let label: string;
  if (explicit.kind) { kind = explicit.kind; label = explicit.label || rawLabel || SOURCE_KIND_LABEL[kind]; }
  else if (data.skillName) { kind = 'skill'; label = String(data.skillName); }
  else if (STATUS_LABEL.test(rawLabel)) { kind = 'status'; label = rawLabel.replace(/[【】\[\]]/g, '') || '異常'; }
  else if (data.ledgerOrigin?.skillName) { kind = 'skill'; label = String(data.ledgerOrigin.skillName); }
  else if (data.sourceElfName) { kind = 'soulmark'; label = rawLabel.replace(/[【】]/g, '') || '魂印附加'; }
  else { kind = 'other'; label = rawLabel || '其他'; }
  // 異常、稱號、反射沒有明確施加者時，記在受擊方的對手身上。
  const credited = !explicit.sourceSide && (kind === 'status' || kind === 'title' || kind === 'reflect');
  const sourceSide: Side = explicit.sourceSide ?? (credited ? other(targetSide) : (data.sourceSide ?? other(targetSide)));
  const activeSrc = input.active[sourceSide];
  const sameBody = !credited && !explicit.sourceSide && data.sourceSide === sourceSide;
  return {
    turn: input.turn,
    targetSide, targetBattleId: input.targetBattleId, targetName: input.targetName,
    sourceSide,
    sourceBattleId: explicit.sourceBattleId ?? (sameBody && data.sourceBattleId ? String(data.sourceBattleId) : activeSrc?.battleId) ?? '',
    sourceName: explicit.sourceName ?? (sameBody && data.sourceElfName ? String(data.sourceElfName) : activeSrc?.name) ?? '',
    sourceKind: kind, sourceLabel: label,
    damageType: input.damageType,
    isCrit: !!data.isCrit,
    hpLost: Math.max(0, Math.round(input.receipt.hpLost || 0)),
    shieldAbsorbed: Math.max(0, input.receipt.shieldAbsorbed || 0),
    barrierAbsorbed: Math.max(0, input.receipt.barrierAbsorbed || 0),
    selfInflicted: sourceSide === targetSide,
  };
}

export function recordDamage(ledger: DamageLedger, input: LedgerRecordInput): DamageLedgerEntry | null {
  const entry = buildLedgerEntry(input);
  if (entry.hpLost <= 0 && entry.shieldAbsorbed <= 0 && entry.barrierAbsorbed <= 0) return null;
  ledger.entries.push(entry);
  return entry;
}
export function recordHeal(ledger: DamageLedger, heal: HealLedgerEntry) {
  if (heal.amount > 0) ledger.heals.push(heal);
}
export function recordAdjust(ledger: DamageLedger, side: Side, delta: number) {
  if (delta > 0) ledger.adjust[side].up += delta; else if (delta < 0) ledger.adjust[side].down += -delta;
}

// ───────── 彙總 ─────────
export interface ElfTally { side: Side; battleId: string; name: string; dealt: number; taken: number }
export interface LabelTally { side: Side; kind: DamageSourceKind; label: string; total: number; hits: number; /** 首次記到此來源時的施加精靈（顯示魂印／技能名用）。 */ sourceBattleId: string; sourceName: string }
export interface TurnTally { turn: number; p1: number; p2: number }
export interface LedgerSummary {
  totalDealt: Record<Side, number>;
  byKind: Record<Side, Record<DamageSourceKind, number>>;
  byType: Record<Side, Record<string, number>>;
  byElf: ElfTally[];
  byLabel: LabelTally[];
  perTurn: TurnTally[];
  maxHit: DamageLedgerEntry | null;
  crits: Record<Side, number>;
  absorbed: Record<Side, { shield: number; barrier: number }>;
  heal: Record<Side, number>;
  hpLostTotal: Record<Side, number>;
  turns: number;
}

const zeroKinds = (): Record<DamageSourceKind, number> => ({ skill: 0, soulmark: 0, status: 0, title: 0, item: 0, reflect: 0, other: 0 });

export function summarizeLedger(ledger: DamageLedger, turns = 0): LedgerSummary {
  const totalDealt = { p1: 0, p2: 0 };
  const byKind = { p1: zeroKinds(), p2: zeroKinds() };
  const byType: Record<Side, Record<string, number>> = { p1: {}, p2: {} };
  const elves = new Map<string, ElfTally>();
  const labels = new Map<string, LabelTally>();
  const turnMap = new Map<number, TurnTally>();
  const crits = { p1: 0, p2: 0 };
  const absorbed = { p1: { shield: 0, barrier: 0 }, p2: { shield: 0, barrier: 0 } };
  const hpLostTotal = { p1: 0, p2: 0 };
  let maxHit: DamageLedgerEntry | null = null;
  const elf = (side: Side, battleId: string, name: string) => {
    const key = `${side}:${battleId || name}`;
    let t = elves.get(key);
    if (!t) { t = { side, battleId, name, dealt: 0, taken: 0 }; elves.set(key, t); }
    return t;
  };
  for (const e of ledger.entries) {
    hpLostTotal[e.targetSide] += e.hpLost;
    elf(e.targetSide, e.targetBattleId, e.targetName).taken += e.hpLost;
    // 護盾／屏障吸收：記在「受擊方擋下的量」
    absorbed[e.targetSide].shield += e.shieldAbsorbed;
    absorbed[e.targetSide].barrier += e.barrierAbsorbed;
    if (e.selfInflicted || e.hpLost <= 0) continue;
    const s = e.sourceSide;
    totalDealt[s] += e.hpLost;
    byKind[s][e.sourceKind] += e.hpLost;
    byType[s][e.damageType] = (byType[s][e.damageType] || 0) + e.hpLost;
    elf(s, e.sourceBattleId, e.sourceName).dealt += e.hpLost;
    const lk = `${s}|${e.sourceKind}|${e.sourceLabel}`;
    const lt = labels.get(lk) || { side: s, kind: e.sourceKind, label: e.sourceLabel, total: 0, hits: 0, sourceBattleId: e.sourceBattleId, sourceName: e.sourceName };
    lt.total += e.hpLost; lt.hits += 1; labels.set(lk, lt);
    const tt = turnMap.get(e.turn) || { turn: e.turn, p1: 0, p2: 0 };
    tt[s] += e.hpLost; turnMap.set(e.turn, tt);
    if (e.isCrit) crits[s] += 1;
    if (!maxHit || e.hpLost > maxHit.hpLost) maxHit = e;
  }
  const maxTurn = Math.max(turns, ...turnMap.keys(), 0);
  const perTurn: TurnTally[] = [];
  for (let t = 1; t <= maxTurn; t++) perTurn.push(turnMap.get(t) || { turn: t, p1: 0, p2: 0 });
  const heal = { p1: 0, p2: 0 };
  for (const h of ledger.heals) heal[h.side] += h.amount;
  return {
    totalDealt, byKind, byType,
    byElf: [...elves.values()],
    byLabel: [...labels.values()].sort((a, b) => b.total - a.total),
    perTurn, maxHit, crits, absorbed, heal, hpLostTotal, turns: maxTurn,
  };
}

/** 勝方 MVP：該側輸出最高的精靈（同分取先出現者）。 */
export function pickMvp(summary: LedgerSummary, side: Side): ElfTally | null {
  const pool = summary.byElf.filter(e => e.side === side);
  let best: ElfTally | null = null;
  for (const e of pool) if (!best || e.dealt > best.dealt) best = e;
  return best;
}

export const formatInt = (n: number) => Math.round(n).toLocaleString('en-US');
