import { Elf, Skill, BattleLog, BattleItem } from "../types";
import { Timer } from "../battle/timers";
import { Mark } from "../battle/marks";

export interface TurnDamageStats {
  skillDmg: number;
  fixedDmg: number;
  percentDmg: number;
  trueDmg: number;
  hpChange: number;
  heal: number;
  lastType: 'skill' | 'crit' | 'fixed' | 'percent' | 'true' | 'absorb' | 'heal' | 'adjust_up' | 'adjust_down' | null;
  lastAmount?: number;
}

export interface LastActionInfo {
  side: 'p1' | 'p2';
  targetElfName: string;
  amount: number;
  type: 'skill' | 'crit' | 'fixed' | 'percent' | 'true' | 'absorb' | 'heal' | 'adjust_up' | 'adjust_down';
  label: string;
}

export type BattlePhase = 
  | "p1_select" 
  | "p2_select" 
  | "resolving" 
  | "forced_switch_p1" 
  | "forced_switch_p2" 
  | "forced_switch_both" 
  | "game_over";

export interface EffectItem {
  type: 'damage' | 'heal' | 'adjust_hp' | 'status' | 'stat_change' | 'log' | 'animation' | 'switch' | 'death';
  side: 'p1' | 'p2';
  data: any;
  delay?: number;
}

export interface BattleState {
  p1Team: Elf[];
  p2Team: Elf[];
  p1ActiveIndex: number;
  p2ActiveIndex: number;
  p1: Elf;
  p2: Elf;
  p1StartHp: number;
  p2StartHp: number;
  turnNumber: number;
  phase: BattlePhase;
  logs: BattleLog[];
  p1SelectedSkill: Skill | null;
  p2SelectedSkill: Skill | null;
  p1SwitchIndex: number | null;
  p2SwitchIndex: number | null;
  p1SelectedItem: BattleItem | null;
  p2SelectedItem: BattleItem | null;
  winner: string | null;
  isAutoBattle: boolean;
  p1LastDamage: number;
  p2LastDamage: number;
  lastDamage: number;
  p1TurnStats: TurnDamageStats;
  p2TurnStats: TurnDamageStats;
  p1RegistryState: Record<string, any>;
  p2RegistryState: Record<string, any>;
  p1Timers: Timer[];
  p2Timers: Timer[];
  p1Marks: Mark[];
  p2Marks: Mark[];
  activeSkillAnim: any;
  floatingDamagePopups: any[];
  isTyrDuelField: boolean;
  consoleShake: { p1: boolean; p2: boolean };
  damageDealt: Record<string, number>;
  lastActionInfo?: LastActionInfo | null;
}

export type BattleAction =
  | { type: 'UPDATE_ELF'; side: 'p1' | 'p2'; elf: Partial<Elf>; targetId?: string }
  | { type: 'UPDATE_TEAM'; side: 'p1' | 'p2'; team: Elf[] }
  | { type: 'SET_ACTIVE_INDEX'; side: 'p1' | 'p2'; index: number }
  | { type: 'SET_PHASE'; phase: BattlePhase }
  | { type: 'ADD_LOG'; log: BattleLog }
  | { type: 'SET_SKILL'; side: 'p1' | 'p2'; skill: Skill | null }
  | { type: 'SET_SWITCH_INDEX'; side: 'p1' | 'p2'; index: number | null }
  | { type: 'SET_ITEM'; side: 'p1' | 'p2'; item: BattleItem | null }
  | { type: 'SET_WINNER'; winner: string | null }
  | { type: 'SET_AUTO_BATTLE'; isAuto: boolean }
  | { type: 'SET_START_HP'; side: 'p1' | 'p2'; hp: number }
  | { type: 'SET_TURN'; turn: number }
  | { type: 'UPDATE_TURN_STATS'; side: 'p1' | 'p2'; stats: Partial<TurnDamageStats> }
  | { type: 'UPDATE_REGISTRY_STATE'; side: 'p1' | 'p2'; state: Record<string, any> }
  | { type: 'SET_TIMERS'; side: 'p1' | 'p2'; timers: Timer[] }
  | { type: 'SET_MARKS'; side: 'p1' | 'p2'; marks: Mark[] }
  | { type: 'SET_LAST_DAMAGE'; side: 'p1' | 'p2'; damage: number }
  | { type: 'SET_LAST_ACTION_INFO'; info: LastActionInfo | null }
  | { type: 'ADD_DAMAGE_POPUP'; popup: any }
  | { type: 'REMOVE_DAMAGE_POPUP'; id: string }
  | { type: 'SET_SKILL_ANIM'; anim: any }
  | { type: 'SET_TYR_FIELD'; active: boolean }
  | { type: 'SET_SHAKE'; side: 'p1' | 'p2'; isShaking: boolean }
  | { type: 'TRACK_DAMAGE'; amount: number; elfName: string }
  | { type: 'FORCED_SWITCH'; side: 'p1' | 'p2'; index: number; newElf: Elf }
  | { type: 'RESET_BATTLE'; initialState: Partial<BattleState> }
  | { type: 'REPLACE_STATE'; state: BattleState };

const MAX_LOGS = 400;

export const battleReducer = (state: BattleState, action: BattleAction): BattleState => {
  switch (action.type) {
    case 'UPDATE_ELF':
      if (action.side === 'p1') {
        const newTeam = [...state.p1Team];
        const targetIndex = action.targetId
          ? newTeam.findIndex((elf) => (elf.battleId || elf.id) === action.targetId || elf.id === action.targetId)
          : state.p1ActiveIndex;
        const resolvedIndex = targetIndex >= 0 ? targetIndex : state.p1ActiveIndex;
        const newElf = { ...(newTeam[resolvedIndex] || state.p1), ...action.elf };
        newTeam[resolvedIndex] = newElf;
        const isActive = resolvedIndex === state.p1ActiveIndex;
        return { 
          ...state, 
          p1: isActive ? newElf : state.p1,
          p1Team: newTeam,
          ...(isActive && action.elf.marks ? { p1Marks: action.elf.marks } : {})
        };
      } else {
        const newTeam = [...state.p2Team];
        const targetIndex = action.targetId
          ? newTeam.findIndex((elf) => (elf.battleId || elf.id) === action.targetId || elf.id === action.targetId)
          : state.p2ActiveIndex;
        const resolvedIndex = targetIndex >= 0 ? targetIndex : state.p2ActiveIndex;
        const newElf = { ...(newTeam[resolvedIndex] || state.p2), ...action.elf };
        newTeam[resolvedIndex] = newElf;
        const isActive = resolvedIndex === state.p2ActiveIndex;
        return { 
          ...state, 
          p2: isActive ? newElf : state.p2,
          p2Team: newTeam,
          ...(isActive && action.elf.marks ? { p2Marks: action.elf.marks } : {})
        };
      }
    case 'UPDATE_TEAM':
      return action.side === 'p1' 
        ? { ...state, p1Team: action.team }
        : { ...state, p2Team: action.team };
    case 'SET_ACTIVE_INDEX':
      if (action.side === 'p1') {
        const elf = state.p1Team[action.index];
        const resetStats = { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null };
        return { 
          ...state, 
          p1ActiveIndex: action.index, 
          p1: { ...elf },
          p1Marks: elf.marks || [],
          p1StartHp: elf.currentHp,
          p1TurnStats: resetStats
        };
      } else {
        const elf = state.p2Team[action.index];
        const resetStats = { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null };
        return { 
          ...state, 
          p2ActiveIndex: action.index, 
          p2: { ...elf },
          p2Marks: elf.marks || [],
          p2StartHp: elf.currentHp,
          p2TurnStats: resetStats
        };
      }
    case 'SET_START_HP':
      return action.side === 'p1'
        ? { ...state, p1StartHp: action.hp }
        : { ...state, p2StartHp: action.hp };
    case 'SET_PHASE':
      return { ...state, phase: action.phase };
    case 'ADD_LOG': {
      // 日誌上限，避免長時間對戰後陣列無限成長
      const next = state.logs.length >= MAX_LOGS ? state.logs.slice(-(MAX_LOGS - 1)) : state.logs.slice();
      next.push(action.log);
      return { ...state, logs: next };
    }
    case 'SET_SKILL': {
      // 複製一份：效果處理可能改寫本次行動的技能（如威力），不可污染精靈技能欄位上的原物件
      const picked = action.skill ? { ...action.skill } : null;
      return action.side === 'p1'
        ? { ...state, p1SelectedSkill: picked }
        : { ...state, p2SelectedSkill: picked };
    }
    case 'SET_SWITCH_INDEX':
      return action.side === 'p1'
        ? { ...state, p1SwitchIndex: action.index }
        : { ...state, p2SwitchIndex: action.index };
    case 'SET_ITEM':
      return action.side === 'p1'
        ? { ...state, p1SelectedItem: action.item }
        : { ...state, p2SelectedItem: action.item };
    case 'SET_WINNER':
      return { ...state, winner: action.winner };
    case 'SET_AUTO_BATTLE':
      return { ...state, isAutoBattle: action.isAuto };
    case 'SET_TURN':
      return { ...state, turnNumber: action.turn };
    case 'UPDATE_TURN_STATS':
      if (action.side === 'p1') {
        return { ...state, p1TurnStats: { ...state.p1TurnStats, ...action.stats } };
      } else {
        return { ...state, p2TurnStats: { ...state.p2TurnStats, ...action.stats } };
      }
    case 'UPDATE_REGISTRY_STATE':
      return action.side === 'p1'
        ? { ...state, p1RegistryState: { ...state.p1RegistryState, ...action.state } }
        : { ...state, p2RegistryState: { ...state.p2RegistryState, ...action.state } };
    case 'SET_TIMERS':
      return { ...state, [`${action.side}Timers`]: action.timers };
    case 'SET_MARKS':
      return { ...state, [`${action.side}Marks`]: action.marks };
    case 'SET_LAST_DAMAGE':
      if (action.side === 'p1') {
        return { ...state, p1LastDamage: action.damage, lastDamage: action.damage };
      } else {
        return { ...state, p2LastDamage: action.damage, lastDamage: action.damage };
      }
    case 'SET_LAST_ACTION_INFO':
      return { ...state, lastActionInfo: action.info };
    case 'ADD_DAMAGE_POPUP':
      return { ...state, floatingDamagePopups: [...state.floatingDamagePopups, action.popup] };
    case 'REMOVE_DAMAGE_POPUP':
      return { ...state, floatingDamagePopups: state.floatingDamagePopups.filter(p => p.id !== action.id) };
    case 'SET_SKILL_ANIM':
      return { ...state, activeSkillAnim: action.anim };
    case 'SET_SHAKE':
      return { ...state, consoleShake: { ...state.consoleShake, [action.side]: action.isShaking } };
    case 'SET_TYR_FIELD':
      return { ...state, isTyrDuelField: action.active };
    case 'TRACK_DAMAGE':
      return { 
        ...state, 
        damageDealt: { 
          ...state.damageDealt, 
          [action.elfName]: (state.damageDealt[action.elfName] || 0) + action.amount 
        } 
      };
    case 'FORCED_SWITCH':
      if (action.side === 'p1') {
        const resetStats = { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null };
        return { 
          ...state, 
          p1: action.newElf, 
          p1Marks: action.newElf.marks || [],
          p1ActiveIndex: action.index,
          p1SelectedSkill: null,
          p1StartHp: action.newElf.currentHp,
          p1TurnStats: resetStats
        };
      } else {
        const resetStats = { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null };
        return { 
          ...state, 
          p2: action.newElf, 
          p2Marks: action.newElf.marks || [],
          p2ActiveIndex: action.index,
          p2SelectedSkill: null,
          p2StartHp: action.newElf.currentHp,
          p2TurnStats: resetStats
        };
      }
    case 'REPLACE_STATE':
      return action.state;
    case 'RESET_BATTLE':
      return { ...state, ...action.initialState };
    default:
      return state;
  }
};
