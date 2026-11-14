import {FINAL_GAIA_SOURCE} from './finalGaiaSource';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
const raw=(prefix:string)=>{const s=FINAL_GAIA_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));if(!s)throw Error(prefix);return s;};
const line=(prefix:string,trig:string,body:any[],order:number,innate=false)=>e(raw(prefix),trig,body,order,'skill',innate);
const di=(side:string,turns=3)=>a('status',{side,status:'砥礪',turns,chance:100});
export const FINAL_GAIA_WAR=skill('終焉聖戰','戰鬥','物理',90,20,4,[
 property('先制+4','base_priority',4,0),
 line('消除對手回合類效果，消除成功','use',[act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('pp_attack_absorb_to',{remaining:1})]}],1),
 line('命中後降低對手','after_hit',[act(a('pp_reduce_stop',{amount:2}))],2),
 line('技能無效時消除','self_invalid',[act(a('clear_turn',{side:'opp'}),di('both'))],3),
]);
export const FINAL_GAIA_WILL=skill('戰意湧現','戰鬥','特殊',0,10,0,[
 property('必中','sure_hit',true,0),
 line('令雙方全屬性+1','use',[{cond:[c('hp_ratio',{side:'self',op:'高於',ratio:.5})],acts:[a('stat',{side:'both',stats:['全屬性'],v:2})],elseActs:[a('stat',{side:'both',stats:['全屬性'],v:1})]}],1),
 line('對手下次主動或死亡','use',[act(a('transfer_next_departure',{}))],2),
 line('為雙方附加砥礪3','use',[act(a('flag_set',{key:'statusPairFailedThisAction',value:false})),act(di('self')),{chain:'fail',acts:[a('flag_set',{key:'statusPairFailedThisAction',value:true})]},act(di('opp')),{chain:'fail',acts:[a('flag_set',{key:'statusPairFailedThisAction',value:true})]},{live:true,cond:[c('player_state',{key:'statusPairFailedThisAction',equals:true})],acts:[a('status',{side:'opp',status:'害怕',chance:100})]}],3),
 line('5回合內吸取對手','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[act(a('drain',{ratio:.5})),{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[a('drain',{ratio:1/3})]}]}))],4),
 line('下2回合自身所有技能先制','use',[act(a('prio_turns',{v:2,turns:2,next:true}))],5),
 line('下2回合自身所有技能造成','use',[act(a('dmg_mod_turns',{dir:'out',kind:'技能',boost:1.5,turns:2,next:true}))],6),
],{sure:true});
export const FINAL_GAIA_UNBOWED=skill('永不屈服','戰鬥','物理',150,5,2,[
 property('先制+2','base_priority',2,0),property('必中','sure_hit',true,1),
 line('反轉自身所有能力下降','use',[act(a('stat_reverse',{side:'self',kind:'down'})),{chain:'success',acts:[a('invalid_next',{kind:'屬性',uses:1})]}],2),
 line('為自身附加砥礪，自身','use',[{cond:[c('has_status',{side:'self',status:'砥礪'})],acts:[a('maxhp_flat_reduce',{amount:60})],elseActs:[di('self')]}],3),
 line('令對手所有技能PP值為0','use',[act(a('zero_pp_max_zero',{}))],4),
],{sure:true});
export const FINAL_GAIA_DRILL=skill('砥兵礪伍','戰鬥','特殊',0,10,0,[
 property('必中','sure_hit',true,0),
 line('3回合內對手使用攻擊','use',[act(a('timed',{turns:3,from:'now',trig:'opp_attack',body:[act(a('pp_zero_random',{count:2}))]}))],1),
 line('3回合內對手使用屬性','use',[act(a('timed',{turns:3,from:'now',trig:'opp_status',body:[act(a('add_invalid_turns',{kind:'屬性',turns:2,next:true}))]}))],2),
 line('3回合內對手體力恢復','use',[act(a('heal_reduce_turns',{turns:3,ratio:1}))],3),
 line('3回合內自身使用技能吸取','use',[act(a('timed',{turns:3,from:'now',trig:'self_skill',initial:true,body:[act(a('drain_checked_then',{type:'固定',flat:300,threshold:1,measure:'lost',belowBody:[act(a('dmg',{flat:300,type:'真實'}))],afterBody:[]}))]}))],4),
],{sure:true});
export const FINAL_GAIA_STONE=skill('戰神.夷石錄','戰鬥','物理',190,5,0,[
 property('必中','sure_hit',true,0),
 line('吸取並反轉對手能力提升','use',[act(a('stat_steal',{mode:'吸取',reverse:true}))],1),
 line('雙方每有1回合砥礪','use',[act(a('seal_by_status_turns',{status:'砥礪'}))],2),
 line('對手不處於能力上升','use',[{cond:[c('stage',{side:'opp',kind:'up',neg:true})],acts:[a('pp_zero_random',{count:2})]}],3),
 e(raw('下次擊敗對手時，則敵方')+'\n'+raw('下次擊敗對手時，則吸取'),'use',[act(a('watch',{key:'nextKillEnemyEntry',trig:'kill',body:[act(a('next_enemy_entry',{statuses:['砥礪','害怕'],duration:3,drainRatio:.5}))]}))],4),
],{sure:true,fifth:true});
export const FINAL_GAIA_SKILLS=[FINAL_GAIA_WAR,FINAL_GAIA_WILL,FINAL_GAIA_UNBOWED,FINAL_GAIA_DRILL,FINAL_GAIA_STONE];
