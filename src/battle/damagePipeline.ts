/**
 * 傷害分層（使用者確認，2026-10-11）：
 *   A 公式輸入（忽略雙防、雙攻合一、能力等級、威力、克制、本系）
 *   B 公式替換（傷害固定為某值；不吃暴擊、不乘連擊）
 *   C 公式本體＋固定加值（強攻＋80 等直接加進公式結果）
 *   D 增傷：每個「提升X%」各自相乘 ×Π(1+X)；描述明寫「加法結算」的同組先加總
 *     「翻倍／變為N倍」為獨立乘區 ×ΠN（multiplier）
 *   E 減傷：各自相乘 ×Π(1−X)；同組加總時最高100%（不溢出）
 *   F 上限／保底（真實傷害不受上限與保底影響）
 *   G 落地：抗性、護盾、存活規則、抵抗致死
 *
 * createDamageComp 讓舊寫法 `comp.increasePercent += x`、`addDamageReduction` 自動落入上面規則：
 * 每次寫入都視為一個獨立來源，彼此相乘。需要同組加總時用 addDamageIncrease／addGroupedReduction 並給 group。
 */
import type { DamageComputation } from '../effects/types';
import type { Elf, Skill } from '../types';
import { SUIT_CATALOG } from '../data/suitsAndEyewears';
import { TITLE_CATALOG } from '../data/titles';
import { addDamageReduction } from './damageReduction';

const INC = Symbol('increaseGroups');
const ADD = Symbol('additiveToTotal');
const DEC = Symbol('reductionGroups');
type Groups = Map<string, number>;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function createDamageComp<T extends Partial<DamageComputation>>(init: T): T & DamageComputation {
  const inc: Groups = new Map(), dec: Groups = new Map();
  let seq = 0;
  // 去除浮點誤差（例：1.5×1.7−1 不能變成 1.5499999…，否則取整少 1）
  const tidy = (n: number) => Math.round(n * 1e10) / 1e10;
  // 「可與其他來源加算」：加在其他增傷相乘後的總增幅上（沒有其他增傷時就是它本身）
  const add = { total: 0 };
  const incValue = () => tidy([...inc.values()].reduce((p, g) => p * (1 + g), 1) - 1 + add.total);
  const decValue = () => tidy(1 - [...dec.values()].reduce((p, g) => p * (1 - clamp01(g)), 1));
  const comp: any = { multiplier: 1, trackReduction:true, multiplierReductionProduct:1, ...init };
  const startInc = Number(comp.increasePercent) || 0, startDec = Number(comp.decreasePercent) || 0;
  delete comp.increasePercent; delete comp.decreasePercent;
  Object.defineProperty(comp, INC, { value: inc, enumerable: false });
  Object.defineProperty(comp, ADD, { value: add, enumerable: false });
  Object.defineProperty(comp, DEC, { value: dec, enumerable: false });
  Object.defineProperty(comp, 'increasePercent', {
    enumerable: true, configurable: true,
    get: incValue,
    // 舊寫法 `+= x`：差值即一個獨立來源（相乘）
    set(v: number) { const d = (Number(v) || 0) - incValue(); if (Math.abs(d) > 1e-12) inc.set(`#${++seq}`, d); },
  });
  Object.defineProperty(comp, 'decreasePercent', {
    enumerable: true, configurable: true,
    get: decValue,
    // addDamageReduction 以 1−(1−舊)(1−新) 寫回：換算成一個獨立來源；變小時（重設）改為單一來源
    set(v: number) {
      const next = clamp01(Number(v) || 0), cur = decValue();
      if (Math.abs(next - cur) < 1e-12) return;
      if (next > cur && cur < 1) dec.set(`#${++seq}`, 1 - (1 - next) / (1 - cur));
      else { dec.clear(); if (next > 0) dec.set(`#${++seq}`, next); }
    },
  });
  if (startInc) comp.increasePercent = startInc;
  if (startDec) comp.decreasePercent = startDec;
  return comp;
}

/**
 * 增傷：沒有 group 時為獨立來源；同 group 先加總（描述寫「加法結算」）。
 * group＝'total'：描述寫「可與其他來源加算」→ 直接加到其他增傷相乘後的總增幅上（例：其他增傷合計×2、玲瓏+50% → ×2.5）。
 */
export function addDamageIncrease(comp: DamageComputation, rate: number, group?: string): void {
  const groups: Groups | undefined = (comp as any)[INC];
  const add: { total: number } | undefined = (comp as any)[ADD];
  if (group === 'total' && add) { add.total += rate; return; }
  if (group && groups) groups.set(`g:${group}`, (groups.get(`g:${group}`) || 0) + rate);
  else comp.increasePercent = (comp.increasePercent || 0) + rate;
}

/** 同組加總的減傷（最高100%），與其他來源相乘。不經減傷覆寫政策，呼叫端需自行判斷適用類別。 */
export function addGroupedReduction(comp: DamageComputation, rate: number, group: string): void {
  const groups: Groups | undefined = (comp as any)[DEC];
  if (groups) groups.set(`g:${group}`, (groups.get(`g:${group}`) || 0) + rate);
  else addDamageReduction(comp as any, rate);
}

/**
 * 套裝／稱號／刻印對攻擊傷害的修正（依描述皆為「傷害提升／減少X%」，歸在增傷／減傷層，不在公式內）。
 * 回傳的 multiplier 只供 AI 估算使用。
 */
export function equipmentDamageFactors(opts: {
  actor: Elf; target: Elf; skill: Skill; side: 'p1' | 'p2'; isCrit: boolean;
  p1Suit?: string; p2Suit?: string; p1Title?: string; p2Title?: string;
}): { increases: { rate: number; group: string }[]; reductions: number[]; multiplier: number } {
  const { actor, skill, side, isCrit } = opts;
  const suitId = side === 'p1' ? opts.p1Suit : opts.p2Suit;
  const oppSuitId = side === 'p1' ? opts.p2Suit : opts.p1Suit;
  const suit = suitId ? SUIT_CATALOG[suitId] : undefined, oppSuit = oppSuitId ? SUIT_CATALOG[oppSuitId] : undefined;
  const titleId = side === 'p1' ? opts.p1Title : opts.p2Title;
  const title = titleId ? TITLE_CATALOG[titleId] : undefined;
  const increases: { rate: number; group: string }[] = [], reductions: number[] = [];
  const dealt = suit?.effects?.damageDealtMultiplier;
  if (dealt && dealt !== 1) increases.push({ rate: dealt - 1, group: `suit:${suitId}` });
  const elem = suit?.effects?.elementalDamageBonus;
  if (elem && String(skill.type || '').includes(elem.element)) increases.push({ rate: elem.multiplier - 1, group: `suit:${suitId}:element` });
  if (isCrit && suit?.effects?.critDamageMultiplier) increases.push({ rate: suit.effects.critDamageMultiplier - 1, group: `suit:${suitId}:crit` });
  const tdealt = title?.effects?.damageDealtMultiplier;
  // 描述寫「可與其他來源加算」（玲瓏）→ 加到總增幅上；否則為獨立來源
  if (tdealt && tdealt !== 1) increases.push({ rate: tdealt - 1, group: /可與其他來源加算/.test(title?.description || '') ? 'total' : `title:${titleId}` });
  if (actor.inscriptions?.some(i => i && (i.id === 'liuren_qianghua' || i.name === '強化'))) increases.push({ rate: 0.2, group: 'inscription:強化' });
  const taken = oppSuit?.effects?.damageTakenMultiplier;
  if (taken && taken < 1) reductions.push(1 - taken);
  const product = increases.filter(x => x.group !== 'total').reduce((p, x) => p * (1 + x.rate), 1);
  const multiplier = (product + increases.filter(x => x.group === 'total').reduce((n, x) => n + x.rate, 0)) * reductions.reduce((p, r) => p * (1 - r), 1);
  return { increases, reductions, multiplier };
}

/** 取整：吸收浮點誤差（例：100×2.55＝254.999…應為 255）。 */
export const floorDamage = (x: number) => Math.floor(x + 1e-7);
