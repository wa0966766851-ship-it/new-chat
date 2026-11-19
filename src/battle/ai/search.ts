import { heuristicRanking } from './heuristic';
import { evaluatePosition } from './evaluation';
import { strategyAdjustment } from './hooks';
import { decisionKnowledge } from './knowledge';
import { fallbackDecision } from './decision';
import { searchLimits } from './settings';
import { riskAdjustedScore } from './styles';
import { makeRng } from '../../utils/rng';
import { actionKey, opposite, type CandidateReport, type DecisionRequest, type DecisionReport, type PlannedAction, type PositionScore } from './types';
import { isCriticalDecision, lethalPotion } from './tactics';
import { repeatableFatalSurvival } from './mechanicAwareness';
import type { BattleState } from '../../components/BattleManager';

export type Simulator = (request: DecisionRequest, action: PlannedAction, reply: PlannedAction, seed: number, deadline: number) => Promise<BattleState>;
const compareCandidates = (a:CandidateReport,b:CandidateReport) =>
  Number(!!a.losesToLethalPotion) - Number(!!b.losesToLethalPotion) || b.score-a.score;

/** 同一輪所有候選共用對手回應及種子；只公布完整的一輪，避免先算者取得不公平優勢。 */
export async function planDecision(request: DecisionRequest, simulate: Simulator,
  progress: (report: DecisionReport) => void = () => {}, assumptions: string[] = []): Promise<DecisionReport> {
  const begin = performance.now(), deadline = begin + request.settings.budgetMs;
  let result = fallbackDecision(request, undefined, assumptions);
  if (request.settings.mode === 'heuristic' || request.state.winner) return result;
  const limits = searchLimits(request.settings), base = evaluatePosition(request.state, request.side, request.settings, request.battleFormat);
  if (request.settings.risk && request.settings.risk !== 'balanced') limits.seeds = Math.max(2, limits.seeds);
  const candidates = request.shortlistSearch ? result.candidates.slice(0,2) : result.candidates;
  if(request.shortlistSearch) {
    for(const kind of ['switch','item'] as const) {
      if(candidates.some(c=>c.action.kind===kind))continue;
      const representative=result.candidates.find(c=>c.action.kind===kind && c.score>0);
      if(representative)candidates.push(representative);
    }
    for (const candidate of result.candidates) {
      if (candidates.length >= 4) break;
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
    assumptions=[...assumptions,`比較 ${candidates.length} 個代表候選，共 ${result.candidates.length} 個合法行動。`];
  }
  const opponentKnowledge = decisionKnowledge(request.state, opposite(request.side));
  const replies: PlannedAction[] = request.forced ? [{kind:'wait'}] : heuristicRanking({ ...request, settings:request.opponentSettings || request.settings, state: opponentKnowledge.state, side: opposite(request.side), forced: false })
    .slice(0, limits.responses).map(c => c.action);
  const potion = request.forced ? undefined : lethalPotion(request.state, request.side, request.potionRemaining);
  if (potion) {
    const distinct = replies.filter(reply => actionKey(reply) !== actionKey(potion.action));
    replies.splice(0, replies.length, potion.action, ...distinct.slice(0, limits.responses - 1));
  }
  if (!replies.length) replies.push({ kind: 'wait' });
  const samples: PositionScore[][] = candidates.map(() => []);
  let simulations = 0, sweeps = 0, interrupted = false;
  let firstSweepMs: number | undefined;
  const lookaheadSamples = new Map<string, BattleState>();
  let lookaheadSeed = request.seed;
  for (let sample = 0; sample < limits.seeds * replies.length; sample++) {
    if (simulations + candidates.length > limits.maxSimulations || performance.now() >= deadline) { interrupted = true; break; }
    // 先覆蓋不同種子，再擴充對手回應；候選多／預算短時仍能比較機率波動。
    const seed = (request.seed + Math.imul(Math.floor(sample / replies.length) + 1, 0x9e3779b9)) >>> 0;
    const sweep: PositionScore[] = [];
    const preview: BattleState[] = [];
    try {
      for (const candidate of candidates) {
        if (performance.now() >= deadline) { interrupted = true; break; }
        const after = await simulate(request, candidate.action, replies[sample % replies.length], seed, deadline);
        simulations++;
        if (!sweeps) preview.push(after);
        sweep.push(evaluatePosition(after, request.side, request.settings, request.battleFormat));
      }
    } catch (error) {
      result.fallbackReason = '推演分支未完成：' + (error instanceof Error ? error.message : String(error));
    }
    if (sweep.length !== candidates.length) break; // 丟棄不完整比較，不把未計算者當0分
    sweeps++;
    if (sweeps === 1) {
      firstSweepMs = performance.now() - begin;
      lookaheadSeed = seed;
      candidates.forEach((candidate, i) => lookaheadSamples.set(actionKey(candidate.action), preview[i]));
    }
    sweep.forEach((score, i) => samples[i].push(score));
    const ranked = candidates.map((candidate, i) => {
      const outcomes = samples[i], mean = outcomes.reduce((n, s) => n + s.total, 0) / outcomes.length;
      const worst = Math.min(...outcomes.map(s => s.total));
      const best = Math.max(...outcomes.map(s => s.total));
      const strategic = strategyAdjustment(request.state, request.side, candidate.action);
      const stalled = request.repeatedAttack && request.repeatedAttack===candidate.label &&
        repeatableFatalSurvival(request.state[opposite(request.side)]) && mean - base.total <= 5;
      const bonus = strategic.bonus - (stalled ? 5 : 0);
      const losesToLethalPotion = !!potion && lookaheadSamples.get(actionKey(candidate.action))?.winner===opposite(request.side);
      const keys = new Set(outcomes.flatMap(s => s.parts.map(p => p.key)));
      return { ...candidate, samples: outcomes.length, losesToLethalPotion, worst: worst - base.total, best:best-base.total, strategyBonus: bonus,
        positionDelta: mean - base.total, score: riskAdjustedScore(mean,worst,best,request.settings.risk) - base.total + bonus,
        reason: losesToLethalPotion ? '推演被對手的優先藥劑擊敗' : strategic.reason || (stalled ? '重複攻擊後局面未改善' : '真實引擎推演：局面平均差、最差與最佳回應風險'),
        parts: [...keys].map(key => ({ key, label: outcomes.flatMap(s => s.parts).find(p => p.key === key)!.label,
          value: outcomes.reduce((n, s) => n + (s.parts.find(p => p.key === key)?.value || 0), 0) / outcomes.length - (base.parts.find(p => p.key === key)?.value || 0) })),
      };
    }).sort(compareCandidates);
    result = { ...result, mode: 'planner', action: ranked[0].action, candidates: ranked, completedSweeps: sweeps,
      assumptions, simulations, firstSweepMs, elapsedMs: performance.now() - begin };
    progress(result);
  }
  // 只在關鍵局面且首組夠快時，比較前兩名在同一份對手回應後的次回合。
  if (request.shortlistSearch && !request.forced && request.specialMode !== 'interstellar' &&
      (isCriticalDecision(request) || request.repeatedAttack) && firstSweepMs !== undefined &&
      performance.now() + firstSweepMs < deadline && result.candidates.length >= 2 &&
      Math.abs(result.candidates[0].score - result.candidates[1].score) <= 40) {
    const top = result.candidates.slice(0,2), deeper: typeof top = [];
    try {
      for (const candidate of top) {
        const after = lookaheadSamples.get(actionKey(candidate.action))!;
        if (after.winner || after.phase.startsWith('forced_switch')) break;
        const next = {...request,state:after,repeatedAttack:undefined,runtime:undefined};
        const own = heuristicRanking(next)[0]?.action;
        const reply = lethalPotion(after, next.side, next.potionRemaining)?.action ||
          heuristicRanking({...next,state:decisionKnowledge(after,opposite(next.side)).state,side:opposite(next.side),
            settings:next.opponentSettings || next.settings})[0]?.action;
        if (!own || !reply || performance.now() >= deadline) break;
        const future = await simulate(next, own, reply, lookaheadSeed, deadline);
        simulations++;
        const delta = evaluatePosition(future,next.side,next.settings,next.battleFormat).total -
          evaluatePosition(after,next.side,next.settings,next.battleFormat).total;
        deeper.push({...candidate,score:candidate.score + Math.max(-40,Math.min(40,delta * 0.35)),
          reason:candidate.reason + '；已比較下一回合'});
      }
    } catch { /* 次回合分支未完整時沿用已完成的公平比較 */ }
    if (deeper.length === top.length) {
      const ranked = [...deeper.sort(compareCandidates),...result.candidates.slice(2)];
      result = {...result,action:ranked[0].action,candidates:ranked,lookahead:true};
      progress({...result,simulations});
    }
  }
  if (sweeps && limits.randomness > 0 && request.settings.risk !== 'conservative') {
    const rng = makeRng(request.seed ^ 0xa11ce);
    if (rng() < limits.randomness) {
      // 混合策略（2026-11-08）：只在分數相近（差 ≤15）的候選間抽，且依分數加權（softmax，T=5）——
      // 越接近最佳越常被選；比均勻亂抽更不吃虧，又讓對手讀不出固定套路。
      const top = result.candidates[0].score;
      const near = result.candidates.filter(c => c.losesToLethalPotion===result.candidates[0].losesToLethalPotion && Math.abs(top - c.score) <= 15);
      const w = near.map(c => Math.exp((c.score - top) / 5)), total = w.reduce((a, b) => a + b, 0);
      let r = rng() * total, pick = near[0];
      for (let i = 0; i < near.length; i++) { r -= w[i]; if (r <= 0) { pick = near[i]; break; } }
      result.action = pick.action;
    }
  }
  const sampleNote = sweeps === 1 ? ['只完成一組回應／機率樣本，不能區分結果波動。'] : [];
  if(sweeps>0&&sweeps<limits.seeds*replies.length)sampleNote.push(`已比較${sweeps}/${limits.seeds*replies.length}組回應／機率樣本，其他分支尚未驗算。`);
  return { ...result, assumptions:[...result.assumptions,...sampleNote], elapsedMs: performance.now() - begin, simulations, completedSweeps: sweeps,
    firstSweepMs, timedOut: interrupted || performance.now() >= deadline,
    fallbackReason: sweeps ? result.fallbackReason : result.fallbackReason || '預算內未完成全候選比較，使用合法啟發式回退。' };
}
