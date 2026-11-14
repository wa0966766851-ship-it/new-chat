/**
 * 命運之輪 AI 禁用／選角（2026-11-07 改版）。
 *
 * 舊版只看等級（S>C 攔截>A>B），不看雙方實際抽到什麼，也不認得新精靈的實力。新版：
 * - 精靈價值＝實戰分數（scripts/selfplay.ts 產生的 elfStrength.json，依場數加權）＋等級先驗＋攔截效果。
 *   新精靈沒有實戰紀錄時用等級先驗，有紀錄後自動以實戰為主（不用改程式）。
 * - 禁用：看對方池子裡誰最能剋我方抽到的精靈（屬性對位）、價值與攔截威脅，禁最危險的 3 隻。
 * - 選角：從剩下的精靈貪婪挑 6 隻，兼顧價值、對對方剩餘精靈的剋制面、屬性多樣性與覆蓋率。
 * - 首發：對對方可能首發（價值最高者）與整體對位最有利者；保留攔截卡首發的偏好。
 */
import type { DestinyElfInstance } from './destinyGacha';
import { getTypeMatchup } from './statCalculator';
import strengthData from '../data/elfStrength.json';

interface StrengthRow { id: string; games: number; wins: number; score: number; adjusted?: number }
const STRENGTH = new Map<string, StrengthRow>(((strengthData as any)?.elves || []).map((r: StrengthRow) => [String(r.id), r]));
const RANK_PRIOR: Record<string, number> = { S: 80, A: 64, B: 54, C: 50 };
const INTERCEPTOR_BONUS: Record<string, number> = { block_attack: 18, dirge_shield: 16, pp_chain: 14 };

/** 該精靈的實戰紀錄（selfplay 統計；沒有紀錄回傳 undefined）。 */
export const strengthOf = (id: unknown): StrengthRow | undefined => { const r = STRENGTH.get(String(id)); return r && r.games > 0 ? r : undefined; };

/** 精靈價值（0～100 左右）：實戰分數與等級先驗依場數混合。 */
export function draftValue(e: DestinyElfInstance, strength: Map<string, StrengthRow> = STRENGTH): number {
  const prior = (RANK_PRIOR[e.destinyRank] ?? 52) + (e.interceptorEffect ? INTERCEPTOR_BONUS[e.interceptorEffect.id] ?? 10 : 0);
  const row = strength.get(String(e.id));
  if (!row || !(row.games > 0)) return prior;
  const w = row.games / (row.games + 10);
  // 有「調整後貢獻」時優先用（已扣除隊友／對手影響），否則用隊伍勝率
  return prior * (1 - w) + (row.adjusted ?? row.score) * 100 * w;
}
/** 屬性對位：正＝e 對 f 有利。 */
export function matchup(e: { type: string }, f: { type: string }): number {
  try { return getTypeMatchup(e.type, f.type) - getTypeMatchup(f.type, e.type); } catch { return 0; }
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** AI 禁用對方池中的 count 隻：威脅＝價值＋對我方池的平均剋制。 */
export function aiBan(opponentPool: DestinyElfInstance[], ownPool: DestinyElfInstance[] = [], count = 3, strength = STRENGTH): string[] {
  const threat = (p: DestinyElfInstance) => draftValue(p, strength) + 14 * avg(ownPool.map(q => Math.max(0, matchup(p, q))))
    + (p.interceptorEffect ? 4 : 0);
  return [...opponentPool].sort((a, b) => threat(b) - threat(a)).slice(0, count).map(e => e.instanceId);
}

/** AI 從自己未被禁的精靈挑 6 隻並決定首發。 */
export function aiPick(ownPool: DestinyElfInstance[], opponentPool: DestinyElfInstance[] = [], size = 6, strength = STRENGTH): { pickedIds: string[]; starterId: string } {
  const available = ownPool.filter(e => !e.isBanned);
  const foes = opponentPool.filter(e => !e.isBanned);
  const picked: DestinyElfInstance[] = [];
  const countered = new Set<string>();
  while (picked.length < Math.min(size, available.length)) {
    const types = new Set(picked.map(e => e.type));
    let best: DestinyElfInstance | null = null, bestScore = -Infinity;
    for (const e of available) {
      if (picked.includes(e)) continue;
      const vsFoes = foes.map(f => matchup(e, f));
      const newCover = foes.filter(f => !countered.has(f.instanceId) && matchup(e, f) > 0).length;
      const score = draftValue(e, strength) + 10 * avg(vsFoes) + 4 * newCover + (types.has(e.type) ? -6 : 3);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (!best) break;
    picked.push(best);
    for (const f of foes) if (matchup(best, f) > 0) countered.add(f.instanceId);
  }
  // 首發：對方最可能首發（價值最高）的對位＋整體對位＋價值；攔截卡（時空枷鎖／封技）仍偏好首發。
  const foeLead = [...foes].sort((a, b) => draftValue(b, strength) - draftValue(a, strength))[0];
  const leadScore = (e: DestinyElfInstance) => draftValue(e, strength) * 0.4 + (foeLead ? 18 * matchup(e, foeLead) : 0)
    + 8 * avg(foes.map(f => matchup(e, f))) + (e.interceptorEffect && ['pp_chain', 'block_attack'].includes(e.interceptorEffect.id) ? 12 : 0);
  const starter = [...picked].sort((a, b) => leadScore(b) - leadScore(a))[0];
  return { pickedIds: picked.map(e => e.instanceId), starterId: starter?.instanceId ?? '' };
}
