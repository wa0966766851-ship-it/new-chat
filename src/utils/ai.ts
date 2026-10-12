import type { Elf, Skill, BattleItem } from '../types';
import type { BattleState } from '../components/BattleManager';
import { BATTLE_ITEMS } from './battleHelpers';
import { heuristicRanking } from '../battle/ai/heuristic';
import { decisionKnowledge } from '../battle/ai/knowledge';
import { readAISettings, settingsForSide } from '../battle/ai/settings';
import { legalActions } from '../battle/ai/legalActions';
import { type PlannedAction, type DecisionRequest } from '../battle/ai/types';

export interface AIAction { type: 'skill' | 'switch' | 'item'; skill?: Skill; switchIndex?: number; item?: BattleItem }
export function materializeAiAction(state: BattleState, side: 'p1' | 'p2', action: PlannedAction): AIAction {
  if (action.kind === 'skill') return { type: 'skill', skill: state[side].skills[action.slot] };
  if (action.kind === 'switch') return { type: 'switch', switchIndex: action.index };
  if (action.kind === 'item') return { type: 'item', item: BATTLE_ITEMS.find(i => i.id === action.id) };
  return { type: 'skill', skill: { name: '等待', type: '無', category: '屬性', power: 0, pp: 0, priority: 0, description: '沒有可用行動，等待本回合結束。', effectType: 'none', effectDetail: '' } };
}
function fallbackRequest(state: BattleState, side: 'p1' | 'p2', p1Suit?: string, p2Suit?: string, rng: () => number = Math.random, forced = false): DecisionRequest {
  return { state: decisionKnowledge(state, side).state, side, p1Suit, p2Suit, forced,
    seed: Math.floor(rng() * 0xffffffff), settings: settingsForSide(readAISettings(),side) };
}
/** 相容既有同步入口：修正合法性與方向；完整推演由畫面注入的背景服務負責。 */
export const pickAiAction = (state: BattleState, side: 'p1' | 'p2', p1Suit?: string, p2Suit?: string, rng: () => number = Math.random): AIAction => {
  try {
    const ranked = heuristicRanking(fallbackRequest(state, side, p1Suit, p2Suit, rng));
    return materializeAiAction(state, side, ranked[0]?.action || { kind: 'wait' });
  } catch { return materializeAiAction(state, side, legalActions(state, side)[0] || { kind: 'wait' }); }
};
export const pickAiForcedSwitch = (state: BattleState, side: 'p1' | 'p2', p1Suit?: string, p2Suit?: string, rng: () => number = Math.random): number => {
  let best: PlannedAction | undefined;
  try { best = heuristicRanking(fallbackRequest(state, side, p1Suit, p2Suit, rng, true))[0]?.action; }
  catch { best = legalActions(state, side, true)[0]; }
  return best?.kind === 'switch' ? best.index : -1;
};
