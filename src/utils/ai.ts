import type { Elf, Skill, BattleItem } from '../types';
import type { BattleState } from '../components/BattleManager';
import { BATTLE_ITEMS } from './battleHelpers';
import { heuristicRanking } from '../battle/ai/heuristic';
import { decisionKnowledge } from '../battle/ai/knowledge';
import { readAISettings, settingsForSide } from '../battle/ai/settings';
import { legalActions } from '../battle/ai/legalActions';
import { aiLegalActions } from '../battle/ai/actionPolicy';
import { type PlannedAction, type DecisionRequest, type AISettings } from '../battle/ai/types';

export interface AIAction { type: 'skill' | 'switch' | 'item'; skill?: Skill; switchIndex?: number; item?: BattleItem }
export function materializeAiAction(state: BattleState, side: 'p1' | 'p2', action: PlannedAction): AIAction {
  if (action.kind === 'skill') return { type: 'skill', skill: state[side].skills[action.slot] };
  if (action.kind === 'switch') return { type: 'switch', switchIndex: action.index };
  if (action.kind === 'item') {
    const item = BATTLE_ITEMS.find(i => i.id === action.id);
    return {type: 'item', item: item ? {...item, ...(action.picked ? {picked: {...action.picked}} : {})} : undefined};
  }
  return { type: 'skill', skill: { name: '等待', type: '無', category: '屬性', power: 0, pp: 0, priority: 0, description: '沒有可用行動，等待本回合結束。', effectType: 'none', effectDetail: '' } };
}
/** 本地回退：可帶入指定 AI 設定與賽制（自我對戰／無背景服務時；未提供則讀使用者設定）。 */
export interface FallbackOptions { settings?: AISettings; battleFormat?: DecisionRequest['battleFormat'] }
function fallbackRequest(state: BattleState, side: 'p1' | 'p2', p1Suit?: string, p2Suit?: string, rng: () => number = Math.random, forced = false, opts: FallbackOptions = {}): DecisionRequest {
  const settings = opts.settings ?? readAISettings();
  return { state: decisionKnowledge(state, side).state, side, p1Suit, p2Suit, forced,
    seed: Math.floor(rng() * 0xffffffff), settings: settingsForSide(settings,side), opponentSettings: settingsForSide(settings, side === 'p1' ? 'p2' : 'p1'),
    battleFormat: opts.battleFormat };
}
/** 相容既有同步入口：修正合法性與方向；完整推演由畫面注入的背景服務負責。 */
export const pickAiAction = (state: BattleState, side: 'p1' | 'p2', p1Suit?: string, p2Suit?: string, rng: () => number = Math.random, opts: FallbackOptions = {}): AIAction => {
  try {
    const ranked = heuristicRanking(fallbackRequest(state, side, p1Suit, p2Suit, rng, false, opts));
    return materializeAiAction(state, side, ranked[0]?.action || { kind: 'wait' });
  } catch { return materializeAiAction(state, side, aiLegalActions({state,side,settings:opts.settings ?? readAISettings()})[0] || { kind: 'wait' }); }
};
export const pickAiForcedSwitch = (state: BattleState, side: 'p1' | 'p2', p1Suit?: string, p2Suit?: string, rng: () => number = Math.random, opts: FallbackOptions = {}): number => {
  let best: PlannedAction | undefined;
  try { best = heuristicRanking(fallbackRequest(state, side, p1Suit, p2Suit, rng, true, opts))[0]?.action; }
  catch { best = legalActions(state, side, true)[0]; }
  return best?.kind === 'switch' ? best.index : -1;
};
