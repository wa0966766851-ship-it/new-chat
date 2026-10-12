/** 結算畫面的純資料層：勝負文字、MVP、各圖表的資料列。畫面與測試共用，數字一律來自傷害帳本彙總。 */
import { safePct } from '../utils/formatBigNumber';
import { SOURCE_KINDS, SOURCE_KIND_LABEL, pickMvp, type DamageSourceKind, type ElfTally, type LedgerSummary, type Side } from './damageLedger';

export type Outcome = 'victory' | 'defeat' | 'p1win' | 'p2win' | 'draw';
export interface OutcomeView { outcome: Outcome; en: string; zh: string; tone: 'win' | 'lose' | 'draw'; winnerSide: Side | null }

/** 對戰 AI（PVE）以 P1 視角；雙人同屏顯示 P1／P2 勝利。 */
export function outcomeView(winner: 'p1' | 'p2' | 'draw', battleMode: 'PVE' | 'PVP' | string): OutcomeView {
  if (winner === 'draw') return { outcome: 'draw', en: 'DRAW', zh: '平手', tone: 'draw', winnerSide: null };
  if (battleMode === 'PVE') return winner === 'p1'
    ? { outcome: 'victory', en: 'VICTORY', zh: '勝利', tone: 'win', winnerSide: 'p1' }
    : { outcome: 'defeat', en: 'DEFEAT', zh: '敗北', tone: 'lose', winnerSide: 'p2' };
  return { outcome: winner === 'p1' ? 'p1win' : 'p2win', en: 'VICTORY', zh: `${winner.toUpperCase()} 勝利`, tone: 'win', winnerSide: winner };
}

export interface KindSlice { kind: DamageSourceKind; label: string; value: number; pct: number }
/** 依來源種類的占比（已排序，0 值略過）。 */
export function kindSlices(summary: LedgerSummary, side: Side): KindSlice[] {
  const total = summary.totalDealt[side];
  return SOURCE_KINDS.map(kind => ({ kind, label: SOURCE_KIND_LABEL[kind], value: summary.byKind[side][kind], pct: total > 0 ? safePct(summary.byKind[side][kind], total) : 0 }))
    .filter(s => s.value > 0).sort((a, b) => b.value - a.value);
}

/** 深色背景上色盲可分的一組：藍、黃、紅橙、綠青、粉、淺灰、灰（明度與色相都拉開；圖例同時有文字與數值）。 */
export const KIND_COLOR: Record<DamageSourceKind, string> = {
  skill: '#4f9dff', soulmark: '#ffd23f', status: '#ff7a3d', title: '#2dd4bf', reflect: '#f472b6', item: '#f1f5f9', other: '#8b98a9',
};

export interface RankRow extends ElfTally { value: number; pct: number; mvp: boolean }
export function rankRows(summary: LedgerSummary, metric: 'dealt' | 'taken', mvpSides: Side[]): Record<Side, RankRow[]> {
  const out: Record<Side, RankRow[]> = { p1: [], p2: [] };
  const mvps = new Set(mvpSides.map(s => pickMvp(summary, s)).filter(Boolean).map(e => `${e!.side}:${e!.battleId}`));
  for (const side of ['p1', 'p2'] as const) {
    const rows = summary.byElf.filter(e => e.side === side && (e.dealt > 0 || e.taken > 0));
    const max = Math.max(1, ...rows.map(e => e[metric]));
    out[side] = rows.sort((a, b) => b[metric] - a[metric]).map(e => ({ ...e, value: e[metric], pct: safePct(e[metric], max), mvp: mvps.has(`${e.side}:${e.battleId}`) && e.dealt > 0 }));
  }
  return out;
}

export function topLabels(summary: LedgerSummary, n = 5) { return summary.byLabel.slice(0, n); }

/**
 * 結算頂部主視覺的角色選擇（純資料）。
 * 勝利／雙人同屏：勝方輸出最高者（MVP）。
 * 敗北（PVE）：我方（P1）輸出最高者「我方最佳」，全為 0 則我方首發；對手 MVP 另列為小字。
 * 平手：雙方各自輸出最高者。無輸出紀錄的一方略過（敗北例外，見上）。
 */
export interface HeroView { primary: ElfTally[]; primaryLabel: 'MVP' | '我方最佳'; opponentMvp: ElfTally | null }
export function heroView(summary: LedgerSummary, view: OutcomeView, own: { p1: { battleId?: string; id?: string; name: string }[] }): HeroView {
  if (view.tone === 'lose') {
    const mine = pickMvp(summary, 'p1');
    let best: ElfTally | null = mine && mine.dealt > 0 ? mine : null;
    if (!best) {
      const first = own.p1[0];
      best = first ? { side: 'p1', battleId: first.battleId || first.id || '', name: first.name, dealt: 0, taken: 0 } : null;
    }
    const opp = pickMvp(summary, 'p2');
    return { primary: best ? [best] : [], primaryLabel: '我方最佳', opponentMvp: opp && opp.dealt > 0 ? opp : null };
  }
  const sides: Side[] = view.winnerSide ? [view.winnerSide] : ['p1', 'p2'];
  const primary = sides.map(s => pickMvp(summary, s)).filter((e): e is ElfTally => !!e && e.dealt > 0);
  return { primary, primaryLabel: 'MVP', opponentMvp: null };
}

/** 排行榜要標 MVP 的陣營：勝方；敗北時只標我方最佳（P1）。 */
export function rankMvpSides(view: OutcomeView): Side[] {
  return view.tone === 'lose' ? ['p1'] : view.winnerSide ? [view.winnerSide] : ['p1', 'p2'];
}

/** 技能貢獻榜的顯示名：魂印來源顯示精靈資料的魂印名，技能顯示技能名；原標籤放 tooltip。 */
export function labelDisplay(l: { kind: DamageSourceKind; label: string }, elf?: { soulMark?: { name?: string } } | null): { text: string; tip: string } {
  if (l.kind === 'soulmark') {
    const name = elf?.soulMark?.name?.trim();
    if (name && name !== '無' && name.toLowerCase() !== 'none') return { text: name, tip: l.label };
  }
  return { text: l.label, tip: l.label };
}

/** 回合走勢的刻度：依資料自動取整（1／2／2.5／5 × 10^n），回傳上限與刻度值（含 0）。 */
export function niceScale(max: number, target = 4): { max: number; ticks: number[] } {
  if (!(max > 0) || !Number.isFinite(max)) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / target, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p);
  const top = Math.max(2, Math.ceil(max / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1e6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max: top, ticks };
}

/** 回合數 ≤ 4 用分組柱狀，更長用折線。 */
export const trendKind = (turns: number): 'bars' | 'line' => (turns <= 4 ? 'bars' : 'line');
