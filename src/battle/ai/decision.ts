import { heuristicRanking } from './heuristic';
import { actionLabel, legalActions } from './legalActions';
import type { DecisionReport, DecisionRequest } from './types';

export function fallbackDecision(request: DecisionRequest, reason?: string, assumptions: string[] = [], legalOnly = false): DecisionReport {
  let candidates: DecisionReport['candidates'] = [];
  if (!legalOnly) try { candidates = heuristicRanking(request); } catch { /* 最後一道防線仍只選合法行動 */ }
  const action = candidates[0]?.action || legalActions(request.state, request.side, request.forced, request.potionRemaining)[0] || { kind: 'wait' };
  if (!candidates.length) candidates = [{ action, label: actionLabel(request.state, request.side, action), score: 0,
    positionDelta: 0, strategyBonus: 0, reason: '合法行動保底', samples: 0, worst: 0, parts: [] }];
  return { side: request.side, style:request.settings.style, risk:request.settings.risk||'balanced', turn: request.state.turnNumber, mode: 'heuristic', forced: !!request.forced, action,
    candidates, elapsedMs: 0, simulations: 0, completedSweeps: 0, timedOut: false, fallbackReason: reason,
    assumptions:[...assumptions,'快速評估沒有機率取樣；保守／激進的波動偏好需背景推演才能比較。'] };
}
