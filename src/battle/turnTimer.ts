import type {BattleState} from '../components/BattleManager';
import {legalActions} from './ai/legalActions';
import type {AISide,PlannedAction} from './ai/types';
import {orderSkillsForDisplay} from './skillSlot';
import {checkElfDead} from './elfAlive';

export type TurnTimerMode = 'off'|'ordered'|'auto';
export interface TurnTimerSettings {mode:TurnTimerMode;seconds:number}
export const TURN_TIMER_KEY = 'seer_turn_timer_v1', TURN_TIMER_EVENT = 'seer-turn-timer-settings';
export function normalizeTurnTimer(input?:Partial<TurnTimerSettings>):TurnTimerSettings {
  return {mode:input?.mode === 'ordered' || input?.mode === 'auto' ? input.mode : 'off',seconds:typeof input?.seconds === 'number' && Number.isFinite(input.seconds) ? Math.round(Math.max(5,Math.min(60,input.seconds))) : 30};
}
let session:TurnTimerSettings|undefined;
let storageFailed=false;
export function readTurnTimer():TurnTimerSettings {if(storageFailed && session)return {...session};try {return normalizeTurnTimer(JSON.parse(localStorage.getItem(TURN_TIMER_KEY) || 'null'));} catch {return session || normalizeTurnTimer();}}
export function writeTurnTimer(input:Partial<TurnTimerSettings>) {session=normalizeTurnTimer(input);try {localStorage.setItem(TURN_TIMER_KEY,JSON.stringify(session));storageFailed=false;} catch {storageFailed=true;} window.dispatchEvent(new CustomEvent(TURN_TIMER_EVENT));return session;}
/** 僅對正在等待人工操作的側計時；已選招等待 AI 及演出皆不扣時。 */
export function timerTurn(state:BattleState,battleMode:'PVE'|'PVP'): {side:AISide;forced:boolean}|undefined {
  if (state.winner) return;
  if (state.phase.startsWith('forced_switch')) {
    if (state.phase !== 'forced_switch_p2' && checkElfDead(state.p1)) return {side:'p1',forced:true};
    if (battleMode === 'PVP' && state.phase !== 'forced_switch_p1' && checkElfDead(state.p2)) return {side:'p2',forced:true};
    return;
  }
  const side = state.phase === 'p1_select' ? 'p1' : state.phase === 'p2_select' && battleMode === 'PVP' ? 'p2' : undefined;
  if (!side || state[`${side}SelectedSkill`] || state[`${side}SelectedItem`] || state[`${side}SwitchIndex`] != null) return;
  return {side,forced:false};
}
export function timeoutAction(state:BattleState,side:AISide,forced=false):PlannedAction {
  const actions = legalActions(state,side,forced);
  if (forced) return actions.find(a => a.kind === 'switch') || {kind:'wait'};
  const displayed=orderSkillsForDisplay(state[side].skills);
  const ordered=[...displayed.filter(row=>row.isFifth),...displayed.filter(row=>!row.isFifth).slice(0,4)];
  for (const {slot} of ordered) {
    const action=actions.find(a => a.kind === 'skill' && a.slot === slot); if(action)return action;
  }
  return {kind:'wait'};
}
