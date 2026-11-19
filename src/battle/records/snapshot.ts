import type {BattleState} from '../../components/BattleManager';
import type {Elf} from '../../types';
import {cleanRecordData} from './schema';
const elfSummary=(e:Elf, detailed=true)=>({id:e.id,battleId:e.battleId,name:e.name,type:e.type,hp:e.currentHp,maxHp:e.maxHp,isExtra:e.isExtra,isVanished:e.isVanished,
  stats:detailed?e.calculatedStats:undefined,stages:e.statStages,statuses:e.battleStatuses,shield:e.shield,barrier:e.barrier,
  skills:(e.skills ?? []).slice(0,12).map(s=>({name:detailed?s.name?.slice(0,100):undefined,type:detailed?s.type:undefined,category:detailed?s.category:undefined,power:detailed?s.power:undefined,pp:s.pp,charge:s.charge,isFifthSkill:s.isFifthSkill,isAbolished:s.isAbolished}))});
const flat=(value:unknown)=>Object.fromEntries(Object.entries(value||{}).filter(([,v])=>v===null||['string','number','boolean'].includes(typeof v)||Array.isArray(v)&&v.every(x=>['string','number','boolean'].includes(typeof x))));
const timers=(rows:BattleState['p1Timers'])=>rows.map(t=>({...flat(t),payload:flat(t.payload),origin:t.origin,presentation:t.presentation}));
const marks=(rows:BattleState['p1Marks'])=>rows.map(m=>({...flat(m),effects:flat(m.effects),origin:m.origin}));
export function battleRecordSnapshot(state:BattleState, opening=false) {return cleanRecordData({turn:state.turnNumber,phase:state.phase,winner:state.winner,isAutoBattle:state.isAutoBattle,
  p1:elfSummary(state.p1),p2:elfSummary(state.p2),
  p1Team:state.p1Team.filter(Boolean).map(e=>elfSummary(e,opening)),p2Team:state.p2Team.filter(Boolean).map(e=>elfSummary(e,opening)),
  selected:{p1:state.p1SelectedSkill?.name,p2:state.p2SelectedSkill?.name,p1Item:state.p1SelectedItem?.name,p2Item:state.p2SelectedItem?.name,p1Switch:state.p1SwitchIndex,p2Switch:state.p2SwitchIndex},
  inventory:{p1:state.p1ItemInventory,p2:state.p2ItemInventory},timers:{p1:timers(state.p1Timers),p2:timers(state.p2Timers)},marks:{p1:marks(state.p1Marks),p2:marks(state.p2Marks)}});}
