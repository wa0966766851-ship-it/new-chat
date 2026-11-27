import type {Elf} from '../types';
import type {ShellBridge} from './bridge';
import {readLastUsedRecord} from './lastTeam';
import {readAnnualBonus} from '../battle/annualBonusPreference';
import {prepareSavedBattleRoster} from '../data/prepareSavedBattleRoster';
import {createBattleInstance} from './teamDraft';
import {bindInitialCounterparts} from '../battle/illusionPresentation';
import {validateSkillStoneLoadout} from '../data/skillStones';
import {readEquipment} from './equipment';
export type DraftSide='p1'|'p2';
export interface PeakSelection{phase:'ban'|'pick';banned:Record<DraftSide,string[]>;picked:Record<DraftSide,string[]>;starters:Record<DraftSide,string>}
export const peakId=(e:Elf)=>e.battleId||e.id;
export function readPeakRules(format:string,storage:Pick<Storage,'getItem'>=localStorage){
 const defaults={ban:format==='peak_3v3'?2:3,pick:format==='peak_3v3'?3:6};
 try{const row=JSON.parse(storage.getItem('seer_peak_draft_rules_v1')||'{}')[format];return row&&Number.isInteger(row.ban)&&row.ban>=0&&row.ban<=4&&Number.isInteger(row.pick)&&row.pick>=1&&row.pick<=6?row:defaults;}catch{return defaults;}
}
const rank=(e:Elf)=>Object.values(e.baseStats).reduce((n,v)=>n+(Number(v)||0),0);
export function peakCandidates(b:ShellBridge):Record<DraftSide,Elf[]>{
 return Object.fromEntries((['p1','p2'] as const).map(side=>{
  const list=[...(readLastUsedRecord(side)?.team||[])].filter(e=>!e.isExtra).slice(0,12),ids=new Set(list.map(e=>e.id));
  for(const elf of b.allElvesCombined){if(list.length>=12)break;if(elf.isExtra||ids.has(elf.id))continue;ids.add(elf.id);list.push(createBattleInstance(elf));}
  return [side,prepareSavedBattleRoster(list,b.allElvesCombined,readAnnualBonus(side),side)];
 })) as Record<DraftSide,Elf[]>;
}
export function initialPeakSelection(teams:Record<DraftSide,Elf[]>,banCount:number,ai:boolean):PeakSelection{
 const banned={p1:ai?[...teams.p1].sort((a,b)=>rank(b)-rank(a)).slice(0,banCount).map(peakId):[],p2:[]};
 return {phase:banCount?'ban':'pick',banned,picked:{p1:[],p2:[]},starters:{p1:'',p2:''}};
}
export function enterPeakPick(state:PeakSelection,teams:Record<DraftSide,Elf[]>,count:number,ai:boolean):PeakSelection{
 const next={...state,phase:'pick' as const,picked:{p1:[] as string[],p2:[] as string[]},starters:{p1:'',p2:''}};
 for(const side of ['p1','p2'] as const){let pool=teams[side].filter(e=>!state.banned[side].includes(peakId(e)));if(side==='p2'&&ai)pool=[...pool].sort((a,b)=>rank(b)-rank(a));next.picked[side]=pool.slice(0,count).map(peakId);next.starters[side]=next.picked[side][0]||'';}
 return next;
}
export function togglePeakCard(state:PeakSelection,side:DraftSide,id:string,limit:number):PeakSelection{
 const field=state.phase==='ban'?'banned':'picked';
 if(field==='picked'&&state.banned[side].includes(id))return state;
 const old=state[field][side],next=old.includes(id)?old.filter(v=>v!==id):old.length<limit?[...old,id]:old;
 return {...state,[field]:{...state[field],[side]:next},starters:field==='picked'?{...state.starters,[side]:next.includes(state.starters[side])?state.starters[side]:next[0]||''}:state.starters};
}
export function launchPeakDraft(b:ShellBridge,teams:Record<DraftSide,Elf[]>,state:PeakSelection,count:number){
 if(state.phase!=='pick')throw Error('請先完成禁用階段');
 const prepared=Object.fromEntries((['p1','p2'] as const).map(side=>{
  const ids=state.picked[side],pool=prepareSavedBattleRoster(teams[side],b.allElvesCombined,readAnnualBonus(side),side);
  const active=pool.filter(e=>ids.includes(peakId(e))&&!state.banned[side].includes(peakId(e)));
  if(active.length!==count||!active.some(e=>peakId(e)===state.starters[side]))throw Error(`${side.toUpperCase()}尚未選滿出戰精靈或指定首發`);
  for(const elf of active)validateSkillStoneLoadout(elf,elf.skills);
  const reserve=pool.filter(e=>!ids.includes(peakId(e))&&!state.banned[side].includes(peakId(e)));
  return [side,bindInitialCounterparts([...active,...reserve],count).slice(0,count)];
 })) as Record<DraftSide,Elf[]>;
 const p1=readEquipment('p1'),p2=readEquipment('p2');
 b.handleStartBattle(b.battleMode,prepared.p1,prepared.p2,state.starters.p1,state.starters.p2,p1.suit,p1.eyewear,p2.suit,p2.eyewear,p1.title,p2.title,b.battleFormat);
 return prepared;
}
