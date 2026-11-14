import type {KitEntry} from '../effects/effectSystem.schema';
import {MODIS_SOURCE} from './modisSource';
import {action as a} from './reviewedSequenceSkillKits';
import {SEQUENCE_TRIGGERS} from '../effects/sequenceTriggers';
const damageText=MODIS_SOURCE.split(/\r?\n/).find(s=>s.startsWith('自身每次造成技能傷害提升77%'))!;
/** 依出手先制絕對值，只翻倍增傷部分。 */
export const MODIS_DAMAGE_SOUL_KIT:KitEntry[]=[{
 codeId:'effect_sequence',source:'soulmark',role:'innate',node:'before_damage',order:0,customText:damageText,
 params:{clause:{raw:damageText,trig:'outgoing_skill',parsed:true,body:[{acts:[a('priority_exponential_damage',{boost:.77})]}]}},
}];
const c=(id:string,p:any)=>({c:id,p,label:id});
const act=(...acts:any[])=>({acts});
const raw=(prefix:string)=>{const text=MODIS_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));if(!text)throw Error(prefix);return text;};
const e=(text:string,trig:string,body:any[],order:number,cond:any[]=[]):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node:SEQUENCE_TRIGGERS[trig] as KitEntry['node'],order,customText:text,params:{clause:{raw:text,trig,parsed:true,body,...(cond.length?{cond}:{})}}});
const penalty=()=>[a('invalid_turns',{kind:'攻擊',turns:2}),a('status_inflict_guard_turns',{side:'opp',kind:'all',turns:2})];
const drainResult=[
 act(a('pp_drain_slots',{amount:1})),
 {cond:[c('last_hp_lost',{op:'低於',amount:177})],acts:penalty()},
 {live:true,cond:[c('last_hp_lost',{op:'不低於',amount:177}),c('skill_pp_any',{side:'opp',op:'不高於',amount:0})],acts:penalty()},
];
const shared=()=>[
 act(a('clear_turn',{side:'opp',polarity:'positive'})),
 act(a('drain_checked_then',{type:'百分比',ratio:1/4,threshold:177,measure:'lost',belowBody:[],afterBody:drainResult})),
];
const sharedText=MODIS_SOURCE.split('前述兩種出手效果執行時:')[1].split('技能:')[0].trim();
export const MODIS_SOUL_KIT:KitEntry[]=[...MODIS_DAMAGE_SOUL_KIT,
 e(raw('回合開始時若自身上回合'),'round_start',[
  {cond:[c('no_skill_dealt_previous',{side:'self'})],acts:[a('prio_turns',{v:1,turns:1,current:true}),a('flag_set',{key:'previousSkillDamageAbsent',value:true,thisRound:true})],elseActs:[a('flag_set',{key:'previousSkillDamageAbsent',value:false,thisRound:true})]},
  {cond:[c('no_skill_dealt_previous',{side:'opp'})],acts:[a('prio_turns',{side:'opp',v:-1,turns:1,current:true}),a('dmg_mod_turns',{side:'opp',dir:'out_reduce',kind:'非真實',reduce:.5,turns:1})]},
 ],1),
 e(raw('回合開始時若自身上回合'),'self_skill',[
  {cond:[c('player_state',{key:'previousSkillDamageAbsent',equals:true,thisRound:true})],acts:[a('drain',{ratio:1/3})]},
 ],2),
 e(raw('自身每次使用技能時若先出手時')+'\n'+sharedText,'self_skill',[
  act(a('stat',{side:'self',stats:['特攻','防禦','特防','速度','命中'],v:1})),
  {cond:[c('hp_ratio',{side:'opp',op:'不低於',ratio:1/3})],acts:[a('stat',{side:'self',stats:['特攻','防禦','特防','速度'],v:2})]},
  ...shared(),
 ],3,[c('first_move',{})]),
 e(raw('自身每次使用技能時若先出手時')+'\n'+sharedText,'opp_used_skill',[
  act(a('stat',{side:'opp',stats:['全屬性'],v:-1})),
  {cond:[c('hp_ratio',{side:'self',op:'不低於',ratio:1/3})],acts:[a('stat',{side:'opp',stats:['攻擊','特攻','特防','速度'],v:-1})]},
  ...shared(),
 ],4,[c('first_move',{neg:true})]),
];
