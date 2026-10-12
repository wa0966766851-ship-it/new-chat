import { heuristicRanking } from './heuristic';
import { evaluatePosition } from './evaluation';
import { strategyAdjustment } from './hooks';
import { decisionKnowledge } from './knowledge';
import { fallbackDecision } from './decision';
import { searchLimits } from './settings';
import { riskAdjustedScore } from './styles';
import { makeRng } from '../../utils/rng';
import { opposite, type DecisionRequest, type DecisionReport, type PlannedAction, type PositionScore } from './types';
import type { BattleState } from '../../components/BattleManager';

export type Simulator = (request: DecisionRequest, action: PlannedAction, reply: PlannedAction, seed: number, deadline: number) => Promise<BattleState>;
/** 同一輪所有候選共用對手回應及種子；只公布完整的一輪，避免先算者取得不公平優勢。 */
export async function planDecision(request: DecisionRequest, simulate: Simulator,
  progress: (report: DecisionReport) => void = () => {}, assumptions: string[] = []): Promise<DecisionReport> {
  const begin = performance.now(), deadline = begin + request.settings.budgetMs;
  let result = fallbackDecision(request, undefined, assumptions);
  if (request.settings.mode === 'heuristic' || request.state.winner) return result;
  const limits = searchLimits(request.settings), base = evaluatePosition(request.state, request.side, request.settings);
  if (request.settings.risk && request.settings.risk !== 'balanced') limits.seeds = Math.max(2, limits.seeds);
  const candidates = result.candidates;
  const opponentKnowledge = decisionKnowledge(request.state, opposite(request.side));
  const replies: PlannedAction[] = request.forced ? [{kind:'wait'}] : heuristicRanking({ ...request, settings:request.opponentSettings || request.settings, state: opponentKnowledge.state, side: opposite(request.side), forced: false })
    .slice(0, limits.responses).map(c => c.action);
  if (!replies.length) replies.push({ kind: 'wait' });
  const samples: PositionScore[][] = candidates.map(() => []);
  let simulations = 0, sweeps = 0, interrupted = false;
  for (let sample = 0; sample < limits.seeds * replies.length; sample++) {
    if (simulations + candidates.length > limits.maxSimulations || performance.now() >= deadline) { interrupted = true; break; }
    // 先覆蓋不同種子，再擴充對手回應；候選多／預算短時仍能比較機率波動。
    const seed = (request.seed + Math.imul(sample % limits.seeds + 1, 0x9e3779b9)) >>> 0;
    const sweep: PositionScore[] = [];
    try {
      for (const candidate of candidates) {
        if (performance.now() >= deadline) { interrupted = true; break; }
        const after = await simulate(request, candidate.action, replies[Math.floor(sample / limits.seeds)], seed, deadline);
        simulations++;
        sweep.push(evaluatePosition(after, request.side, request.settings));
      }
    } catch (error) {
      result.fallbackReason = '推演分支未完成：' + (error instanceof Error ? error.message : String(error));
    }
    if (sweep.length !== candidates.length) break; // 丟棄不完整比較，不把未計算者當0分
    sweeps++;
    sweep.forEach((score, i) => samples[i].push(score));
    const ranked = candidates.map((candidate, i) => {
      const outcomes = samples[i], mean = outcomes.reduce((n, s) => n + s.total, 0) / outcomes.length;
      const worst = Math.min(...outcomes.map(s => s.total));
      const best = Math.max(...outcomes.map(s => s.total));
      const strategic = strategyAdjustment(request.state, request.side, candidate.action);
      const keys = new Set(outcomes.flatMap(s => s.parts.map(p => p.key)));
      return { ...candidate, samples: outcomes.length, worst: worst - base.total, best:best-base.total, strategyBonus: strategic.bonus,
        positionDelta: mean - base.total, score: riskAdjustedScore(mean,worst,best,request.settings.risk) - base.total + strategic.bonus,
        reason: strategic.reason || '真實引擎推演：局面平均差、最差與最佳回應風險',
        parts: [...keys].map(key => ({ key, label: outcomes.flatMap(s => s.parts).find(p => p.key === key)!.label,
          value: outcomes.reduce((n, s) => n + (s.parts.find(p => p.key === key)?.value || 0), 0) / outcomes.length - (base.parts.find(p => p.key === key)?.value || 0) })),
      };
    }).sort((a, b) => b.score - a.score);
    result = { ...result, mode: 'planner', action: ranked[0].action, candidates: ranked, completedSweeps: sweeps,
      assumptions, simulations, elapsedMs: performance.now() - begin };
    progress(result);
  }
  if (sweeps && limits.randomness > 0 && request.settings.risk !== 'conservative') {
    const rng = makeRng(request.seed ^ 0xa11ce);
    if (rng() < limits.randomness) {
      const near = result.candidates.filter(c => result.candidates[0].score - c.score <= 15);
      result.action = near[Math.min(near.length - 1, Math.floor(rng() * near.length))].action;
    }
  }
  const sampleNote = sweeps === 1 ? ['只完成一組回應／機率樣本，不能區分結果波動。'] : [];
  if(sweeps>0&&sweeps<limits.seeds*replies.length)sampleNote.push(`已比較${sweeps}/${limits.seeds*replies.length}組回應／機率樣本，其他分支尚未驗算。`);
  return { ...result, assumptions:[...result.assumptions,...sampleNote], elapsedMs: performance.now() - begin, simulations, completedSweeps: sweeps,
    timedOut: interrupted || performance.now() >= deadline,
    fallbackReason: sweeps ? result.fallbackReason : result.fallbackReason || '預算內未完成全候選比較，使用合法啟發式回退。' };
}
