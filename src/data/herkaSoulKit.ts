import {HERKA_SOURCE} from './herkaSource';
import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
const raw=(prefix:string)=>{const s=HERKA_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));if(!s)throw Error(prefix);return s;};
const guard=[c('is_boss',{side:'opp',neg:true})];
const block=[a('flag_set',{key:'ppSumCapUntilBlock',value:true}),a('block_damage_uses',{uses:1,kind:'攻擊',key:'ppRecoveryAttackBlock',onBlock:[
 act(a('flag_set',{key:'ppSumCapUntilBlock',value:false}),a('priority_disabled_turns',{side:'opp',turns:1,next:true})),
]})];
export const HERKA_ENTRANCE_BODY=[
 act(a('pp_restore_slots',{side:'both'})),
 {live:true,cond:[c('last_amount',{op:'高於',amount:0}),c('skill_pp_all',{side:'self'}),c('skill_pp_all',{side:'opp'})],acts:[a('settlement_flow',{body:[act(a('clear_turn',{side:'opp'})),act(a('status_from_amount',{side:'opp',status:'繳械'}))]})],elseActs:block},
 {chain:'fail',acts:block},
];
const useText=raw('自身使用技能時');
export const HERKA_SOUL_KIT=[
 e(raw('登場時恢復'),'entrance',HERKA_ENTRANCE_BODY,0,'soulmark',true,guard),
 e(raw('登場時恢復'),'incoming_nontrue',[{cond:[c('player_state',{key:'ppSumCapUntilBlock',equals:true})],acts:[a('pp_sum_cap',{factor:2})]}],1,'soulmark',true,guard),
 e(raw('，之後每回合結束'),'round_end',[{cond:[c('unacted')],acts:[a('watch',{key:'repeatEntryAfterPreventedAction',trig:'round_start',body:[
  ...HERKA_ENTRANCE_BODY,
  act(a('copy_status_durations',{side:'opp'}),a('cure_status',{side:'self',cls:'非附屬類'})),
 ]})]}],2,'soulmark',true,guard),
 e(useText,'self_skill',[act(a('pp_op',{side:'opp',mode:'reduce',amount:2}))],3,'soulmark',true,guard),
 e(useText,'self_after_use',[
  {live:true,cond:[c('pp_full',{neg:true})],acts:[a('settlement_flow',{body:[
   act(a('drain',{flat:300,true:true})),act(a('status',{side:'opp',status:'繳械',chance:70})),
   {chain:'fail',acts:[a('pp_zero',{highestOnly:true}),a('drain',{cur:true,ratioCur:.7})]},
  ]})]},
  act(a('pp_deficit_repeat',{side:'both',body:[act(a('drain',{flat:30}))]})),
 ],4,'soulmark',true,guard),
 e('下場時結束本次抵擋附帶的PP傷害上限','switch_out',[act(a('flag_set',{key:'ppSumCapUntilBlock',value:false}))],5,'soulmark'),
];
