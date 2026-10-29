import type { AISettings, DecisionReport } from './types';
import { AI_STYLES, AI_RISKS } from './styles';

export const AI_SETTINGS_KEY = 'seer_local_battle_ai_v1';
export const AI_SETTINGS_EVENT = 'seer-ai-settings';
export const AI_DECISION_EVENT = 'seer-ai-decision';
export const DEFAULT_AI_SETTINGS: AISettings = { mode: 'planner', difficulty: 'balanced', style: 'balanced', risk:'balanced', budgetMs: 600, explain: true };
const number = (v: unknown, lo: number, hi: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : fallback;
let sessionSettings: AISettings | undefined;
let storageWriteFailed = false;
export function normalizeAISettings(input: Partial<AISettings> | null | undefined): AISettings {
  return {
    mode: input?.mode === 'heuristic' ? 'heuristic' : 'planner',
    difficulty: ['easy', 'balanced', 'hard'].includes(input?.difficulty) ? input.difficulty : 'balanced',
    style: Object.hasOwn(AI_STYLES,input?.style || '') ? input.style : 'balanced',
    ownStyle: Object.hasOwn(AI_STYLES,input?.ownStyle || '') ? input.ownStyle : 'follow',
    risk: Object.hasOwn(AI_RISKS,input?.risk || '') ? input.risk : 'balanced',
    ownRisk: Object.hasOwn(AI_RISKS,input?.ownRisk || '') ? input.ownRisk : 'follow',
    budgetMs: number(input?.budgetMs, 100, 2000, DEFAULT_AI_SETTINGS.budgetMs),
    explain: typeof input?.explain === 'boolean' ? input.explain : true,
  };
}
export function settingsForSide(settings:AISettings,side:'p1'|'p2'):AISettings {
  if(side!=='p1')return settings;
  return {...settings,style:settings.ownStyle&&settings.ownStyle!=='follow'?settings.ownStyle:settings.style,
    risk:settings.ownRisk&&settings.ownRisk!=='follow'?settings.ownRisk:settings.risk};
}
export function readAISettings(): AISettings {
  if (storageWriteFailed && sessionSettings) return { ...sessionSettings };
  try { return normalizeAISettings(JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) || 'null')); }
  catch { return { ...(sessionSettings || DEFAULT_AI_SETTINGS) }; }
}
export function writeAISettings(value: Partial<AISettings>): AISettings {
  const next = normalizeAISettings(value);
  sessionSettings = next;
  try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(next)); storageWriteFailed = false; }
  catch { storageWriteFailed = true; /* 私密模式／容量不足仍可使用本次設定 */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new window.CustomEvent(AI_SETTINGS_EVENT, { detail: next }));
  return next;
}
// 僅保留當前頁面兩側最後一筆，不寫入存檔、不累積完整戰局。
const latest: Partial<Record<'p1' | 'p2', DecisionReport>> = {};
export const latestDecisions = () => ({ ...latest });
export function publishDecision(report: DecisionReport) {
  latest[report.side] = report;
  if (typeof window !== 'undefined') window.dispatchEvent(new window.CustomEvent(AI_DECISION_EVENT, { detail: report }));
}
export function clearDecisions() {
  delete latest.p1; delete latest.p2;
  if (typeof window !== 'undefined') window.dispatchEvent(new window.CustomEvent(AI_DECISION_EVENT));
}
export const searchLimits = (settings: AISettings) => settings.difficulty === 'easy'
  ? { responses: 1, seeds: 1, maxSimulations: 48, randomness: 0.18 }
  : settings.difficulty === 'hard'
    ? { responses: 3, seeds: 2, maxSimulations: 144, randomness: 0 }
    : { responses: 2, seeds: 2, maxSimulations: 96, randomness: 0.04 };
