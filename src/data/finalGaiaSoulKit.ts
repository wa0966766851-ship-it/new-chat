import {FINAL_GAIA_SOURCE} from './finalGaiaSource';
import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
const raw=(prefix:string)=>{const s=FINAL_GAIA_SOURCE.split(/\r?\n/).find(s=>s.replace(/^>+/,'').startsWith(prefix));if(!s)throw Error(prefix);return s;};
const soul=(prefix:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(raw(prefix),trig,body,order,'soulmark',true,cond);
const attack=[c('skill_kind',{kind:'攻擊'})];
export const FINAL_GAIA_SOUL_KIT=[
 soul('自身每次受到非真實傷害減少','incoming_nontrue',[act(a('status_duration_damage',{remaining:.6,increase:0}),a('prevented_damage_drain',{ratio:2}))],0),
 soul('每次使用攻擊技能額外削減','self_attack',[act(a('maxhp',{side:'opp',ratio:.6,direction:'decrease'}))],1,[c('abnormal',{side:'self'}),c('abnormal',{side:'opp'})]),
 soul('自身所有技能先制+2','modify_priority',[act(a('prio_bonus',{v:2}))],2,[c('stage_all',{side:'self',kind:'up',neg:true})]),
 soul('則對方所有技能先制-2','team_opponent_modify_priority',[act(a('prio_bonus',{v:-2}))],3,[c('owner_on_field'),c('stage',{side:'opp',kind:'up'})]),
 soul('則對方所有技能先制-2','self_attack',[act(a('ignore',{what:'對手提升視為下降'}))],4,[c('stage',{side:'opp',kind:'up'})]),
 soul('自身所有技能先制+2','before_skill',[act(a('self_down_as_up',{}))],5,[...attack,c('stage_all',{side:'self',kind:'up',neg:true})]),
 ...['team_status_received','team_opponent_status_received'].map((trig,i)=>soul('雙方任一方進入異常狀態時',trig,[act(a('status',{side:'self',status:'砥礪',turns:6,chance:100}))],6+i,[c('owner_on_field')])),
 soul('取消所有非附屬類','entrance',[act(a('status_rules',{whileStatus:'砥礪',cancelExceptCategory:'AUXILIARY',replacePpFree:true}))],8),
 soul('自身每次受到大於等於自身體力上限','fatal',[act(a('survive',{}))],9,[c('has_status',{side:'self',status:'砥礪'}),c('fatal_damage',{basis:'max_hp',op:'不小於',ratio:1})]),
 soul('吸取對手自身已損失體力','phase_end',[act(a('drain',{base:'已損失體力',of:'self',ratio:.6,type:'固定'})),act(a('pp_op',{side:'self',mode:'add',amount:1}))],10),
 soul('若為攻擊技能則命中前','team_opponent_skill_selected',[act(a('drain',{ratio:1/3}))],11,[c('owner_on_field'),c('skill_kind',{kind:'攻擊'})]),
 soul('若對手使用屬性技能','opp_used_status',[act(a('next_selection_no_attack',{}))],12),
 soul('攻擊克制倍數最低','before_skill',[act(a('minimum_matchup',{value:2}))],13,attack),
 soul('無視對手免疫效果','self_attack',[act(a('ignore',{what:'攻擊免疫'}))],14),
 soul('無視對手護盾效果','self_attack',[
  {cond:[c('shield',{side:'opp'})],acts:[a('flag_set',{key:'shieldBypassedThisAction',value:true})],elseActs:[a('flag_set',{key:'shieldBypassedThisAction',value:false})]},
  act(a('ignore',{what:'護盾'})),
 ],15),
 soul('無視對手傷害限制效果','self_attack',[act(a('ignore',{what:'傷害限制'}))],16),
 soul('無視成功則吸取對手300','self_after_use', [{cond:[c('ignore_success',{what:'攻擊免疫'})],acts:[a('drain',{flat:300})]}],17,attack),
 soul('無視成功則消除對手護盾','self_after_use',[{cond:[c('player_state',{key:'shieldBypassedThisAction',equals:true})],acts:[a('clear_shield',{side:'opp',kind:'shield'})]}],18,attack),
 soul('無視成功則令對手100%害怕','self_after_use',[{cond:[c('ignore_success',{what:'傷害限制'})],acts:[a('status',{side:'opp',status:'害怕',chance:100})]}],19,attack),
 soul('使用後汲取對手等同','opp_damage_settled',[act(a('damage_values_record',{key:'dealtNontrueReceipts'}))],20),
 soul('使用後汲取對手等同','self_after_use',[act(a('damage_values_drain',{key:'dealtNontrueReceipts',threshold:500,maxHpThreshold:.25,nextPower:2}))],21,attack),
 soul('自身每次造成非真實傷害提升','outgoing',[act(a('status_duration_damage_boost',{increase:1.6}))],22),
];
