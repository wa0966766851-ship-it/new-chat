import type { BattleState } from '../../components/BattleManager';

export type AISide = 'p1' | 'p2';
export type AIStyle = 'balanced' | 'aggressive' | 'defensive' | 'disruptive' | 'sustain' | 'attrition';
export type AIRisk = 'conservative' | 'balanced' | 'reckless';
/** 傳輸只用槽位／ID，不把投影技能寫回真正持有者。 */
export type PlannedAction =
  | { kind: 'skill'; slot: number }
  | { kind: 'switch'; index: number }
  | { kind: 'item'; id: string; picked?: {side: AISide; battleId: string} }
  | { kind: 'wait' };
export interface AISettings {
  mode: 'planner' | 'heuristic';
  difficulty: 'easy' | 'balanced' | 'hard';
  style: AIStyle;
  ownStyle?: AIStyle | 'follow';
  risk?: AIRisk;
  ownRisk?: AIRisk | 'follow';
  budgetMs: number;
  explain: boolean;
  modelEnabled?: boolean;
  modelTimeoutMs?: number;
  allowOffensivePotions?: boolean;
  allowStatusPotions?: boolean;
  allowDamagePotions?: boolean;
}
export interface ScorePart { key: string; label: string; value: number }
export interface PositionScore { total: number; parts: ScorePart[] }
export interface CandidateReport {
  action: PlannedAction;
  label: string;
  score: number;
  positionDelta: number;
  strategyBonus: number;
  reason: string;
  samples: number;
  losesToLethalPotion?: boolean;
  worst: number;
  best?: number;
  parts: ScorePart[];
}
export interface DecisionReport {
  model?: {status:'used'|'agreed'|'local'|'low-confidence'|'unavailable'|'stale'|'limit';confidence?:number;inputTokens?:number;choice?:string;localAction?:PlannedAction;suggestedAction?:PlannedAction;suggestedLabel?:string;scoreGap?:number;threshold?:number;providerMs?:number;prepared?:boolean};
  selectionWaitMs?: number;
  timing?: {preparation:'hit'|'miss'|'none'; preparationMismatch?:string; localMs: number; waitBudgetMs: number;
    workerStartupMs?:number; firstSweepMs?:number; modelMs?:number; modelWaitExpired?:boolean};
  firstSweepMs?: number;
  workerStartupMs?: number;
  lookahead?: boolean;
  style?: AIStyle;
  risk?: AIRisk;
  side: AISide;
  turn: number;
  mode: 'planner' | 'heuristic';
  forced: boolean;
  action: PlannedAction;
  candidates: CandidateReport[];
  elapsedMs: number;
  simulations: number;
  completedSweeps: number;
  timedOut: boolean;
  fallbackReason?: string;
  assumptions: string[];
}
export interface DecisionRequest {
  state: BattleState;
  side: AISide;
  forced?: boolean;
  settings: AISettings;
  /** 對側獨立設定；推演回應不沿用出手方的託管風格。 */
  opponentSettings?: AISettings;
  seed: number;
  p1Suit?: string;
  p2Suit?: string;
  p1Title?: string;
  p2Title?: string;
  battleFormat?: 'normal_6v6' | 'solo_1v1' | 'peak_6v6' | 'peak_3v3';
  specialMode?: 'destiny' | 'interstellar';
  potionRemaining?: number;
  shortlistSearch?: boolean;
  repeatedAttack?: string;
  prdCounters?: [string, number][];
  prngCounters?: Record<string, number>;
  runtime?: { deathHandled: string[]; pendingFinalize: boolean };
}
export const opposite = (side: AISide): AISide => side === 'p1' ? 'p2' : 'p1';
export const actionKey = (a: PlannedAction) => a.kind === 'skill' ? `skill:${a.slot}` : a.kind === 'switch' ? `switch:${a.index}` : a.kind === 'item' ? `item:${a.id}${a.picked ? `:${a.picked.side}:${JSON.stringify(a.picked.battleId)}` : ''}` : 'wait';
