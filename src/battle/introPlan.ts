/** 入戰動畫的純規劃：是否播放、長度、賽制名稱。不含畫面，供 BattleScreen 與測試共用。 */
export type BattleFormatId = 'normal_6v6' | 'solo_1v1' | 'peak_6v6' | 'peak_3v3';

export const FORMAT_LABEL: Record<BattleFormatId, string> = {
  normal_6v6: '自由戰', solo_1v1: '單挑 1V1', peak_6v6: '巔峰 6V6', peak_3v3: '巔峰 3V3',
};
export const formatLabel = (format?: string) => FORMAT_LABEL[format as BattleFormatId] ?? '自由戰';

/** 完整版與縮短版（重來）、減少動態效果版的總長（毫秒）。 */
export const INTRO_MS = { full: 2600, short: 1400, reduced: 700 } as const;

export interface IntroPlanInput {
  /** 動畫設定的「入戰動畫」開關 */
  enabled: boolean;
  /** 特殊模式（命運之輪、星際探索）有自己的開場，不疊加 */
  specialMode?: string;
  /** 重來（非首次進入） */
  replay?: boolean;
  reducedMotion?: boolean;
}
export interface IntroPlan { play: boolean; ms: number; variant: 'full' | 'short' | 'reduced' }

export function planIntro(input: IntroPlanInput): IntroPlan {
  if (!input.enabled || input.specialMode) return { play: false, ms: 0, variant: 'short' };
  if (input.reducedMotion) return { play: true, ms: INTRO_MS.reduced, variant: 'reduced' };
  return input.replay ? { play: true, ms: INTRO_MS.short, variant: 'short' } : { play: true, ms: INTRO_MS.full, variant: 'full' };
}

export function prefersReducedMotion(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * 動畫期間的行動閘門：引擎的托管（AI）出手前會等這個 promise。
 * 通用機制，與任何精靈無關。
 */
export function createActionGate() {
  let release: (() => void) | null = null;
  let promise: Promise<void> | null = null;
  return {
    hold() { if (!promise) promise = new Promise<void>(r => { release = r; }); },
    open() { const r = release; release = null; promise = null; r?.(); },
    wait: (): Promise<void> | null => promise,
    get held() { return promise !== null; },
  };
}
