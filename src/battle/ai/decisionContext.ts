import { decisionKnowledge, recentBattleEvents } from './knowledge';
import { actionKey, type DecisionReport, type DecisionRequest } from './types';
import { BATTLE_ITEMS } from '../../utils/battleHelpers';
import { PEAK_TURN_LIMIT } from '../turnLimit';
import { checkElfDead } from '../elfAlive';
import { lethalPotion } from './tactics';
import { potionRecoveryBlocked, repeatableFatalSurvival } from './mechanicAwareness';
import type {BattleState} from '../../components/BattleManager';

export function decisionStillCurrent(request:DecisionRequest,now?:BattleState):boolean {
  return !!now && !now.winner && now.turnNumber===request.state.turnNumber && now.phase===request.state.phase
    && (now[request.side].battleId || now[request.side].id)===(request.state[request.side].battleId || request.state[request.side].id)
    && (!!request.forced || (!now[`${request.side}SelectedSkill`] && !now[`${request.side}SelectedItem`] && now[`${request.side}SwitchIndex`] == null));
}

const text = (value:unknown, max=500) => typeof value === 'string' ? value.slice(0,max) : '';
const numericMap = (value:unknown) => Object.fromEntries(Object.entries(value || {}).filter(([,v]) => typeof v === 'number' && Number.isFinite(v)));
/** 網路 DTO 用欄位白名單建立，絕不序列化整個 BattleState／隱藏選招／PRNG。 */
export function buildDecisionContext(request: DecisionRequest, report: DecisionReport) {
  const {state,assumptions} = decisionKnowledge(request.state,request.side);
  const brief = (e:typeof state.p1) => ({name:text(e.name,60),type:text(e.type,40),hp:e.currentHp,maxHp:e.maxHp,
    statuses:numericMap(e.battleStatuses),extra:!!e.isExtra,vanished:!!e.isVanished});
  const active = (e:typeof state.p1) => ({...brief(e), shield:e.shield, barrier:e.barrier,
    stats:numericMap(e.calculatedStats),stages:numericMap(e.statStages),
    skills:e.skills.slice(0,5).map(s=>({name:text(s.name,70),type:s.type,category:s.category,power:s.power,pp:s.pp,priority:s.priority})),
    soul:text(e.soulMark?.description,420)});
  const enemy = request.side === 'p1' ? 'p2' : 'p1';
  const recent = recentBattleEvents(request.state, request.side).map(l => ({turn:l.turn,event:l.text}));
  const threats = (side: typeof enemy) => ({
    repeatableFatalSurvival: repeatableFatalSurvival(state[side]),
    recoveryBlocked: potionRecoveryBlocked(state, side),
    possibleEnemyPotionDamage: lethalPotion(state, side, request.potionRemaining)?.amount,
  });
  const alive = (side: 'p1'|'p2')=>state[`${side}Team`].filter(e=>!e.isExtra&&!e.isVanished&&!checkElfDead(e)).length;
  const effects = (side:'p1'|'p2')=>({
    timers:state[`${side}Timers`].filter(t=>t.remaining>0).slice(0,10).map(t=>({name:text(t.name,50),remaining:t.remaining})),
    marks:state[`${side}Marks`].slice(0,10).map(m=>({name:text(m.name,50),count:m.count})),
  });
  const unique = new Map(report.candidates.map(c => [actionKey(c.action),c]));
  const ranked = [...unique.values()].sort((a,b) => b.score-a.score);
  const local = unique.get(actionKey(report.action));
  const shortlist = local ? [local,...ranked.filter(c => c !== local).slice(0,5)] : ranked.slice(0,6);
  const utility = ranked.find(c => {const action=c.action;return action.kind === 'item' && BATTLE_ITEMS.some(i => i.id === action.id && (i.type === 'special' || i.effect));});
  if (utility && !shortlist.includes(utility)) shortlist.push(utility);
  const switchOption = ranked.find(c=>c.action.kind==='switch');
  if (switchOption && !shortlist.includes(switchOption) && shortlist.length < 8) shortlist.push(switchOption);
  return {input:{context:{turn:state.turnNumber,actingSide:request.side,forcedReplacement:!!request.forced,style:request.settings.style,
    format:request.battleFormat,mode:request.specialMode,risk:request.settings.risk,
    own:active(state[request.side]),opponent:active(state[enemy]),
    ownTeam:state[`${request.side}Team`].slice(0,12).map(brief),
    opponentTeam:state[`${enemy}Team`].slice(0,12).map(brief),
    living:{own:alive(request.side),opponent:alive(enemy)},
    turnsToLimit:request.battleFormat==='peak_6v6'?Math.max(0,PEAK_TURN_LIMIT-state.turnNumber+1):undefined,
    ownEffects:effects(request.side),opponentEffects:effects(enemy),ownThreats:threats(request.side),opponentThreats:threats(enemy),recent,assumptions},
    candidates:shortlist.map((c,index) => ({id:`a${index}`,label:text(c.label,300),score:c.score,
      details:{reason:text(c.reason,180),worst:c.worst,best:c.best,samples:c.samples,
        skill:c.action.kind==='skill' ? text(state[request.side].skills[c.action.slot]?.description,260) : undefined,
        item:c.action.kind === 'item' ? text(BATTLE_ITEMS.find(i => i.id === (c.action as {id:string}).id)?.description) : undefined}}))},shortlist};
}
