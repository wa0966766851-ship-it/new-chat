import {TIANXIE_SOURCE} from './tianxieSource';
import {TIANXIE_MARK_ID,tianxieMark} from './tianxieMark';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
const lines=TIANXIE_SOURCE.split(/\r?\n/);
const raw=(name:string,prefix:string)=>{const start=lines.findIndex(s=>s===name||s===name+'(第五技能)'),i=lines.findIndex((s,n)=>n>start&&s.startsWith(prefix));if(start<0||i<0)throw Error(`${name}/${prefix}`);return lines[i];};
const line=(name:string,prefix:string,trig:string,body:any[],order:number,innate=false,conditions:any[]=[])=>e(raw(name,prefix),trig,body,order,'skill',innate,conditions);
const curse=()=>a('status',{side:'opp',status:'詛咒',chance:100});
const decay='凋零';
export const TIANXIE_DECAY=skill(decay,'邪靈.龍','物理',90,20,3,[
 line(decay,'消除對手回合','use',[act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('drain',{ratio:.5})]}],0),
 line(decay,'消除對手能力','use',[act(a('stat_clear',{side:'opp',kind:'up'})),{chain:'success',acts:[a('status',{side:'opp',status:'虛弱詛咒',chance:100})]},{chain:'fail',acts:[a('invalid_next',{kind:'屬性',uses:1})]}],1),
 line(decay,'吸取對手250','use',[{cond:[c('hp_cmp',{side:'opp',op:'高於'})],acts:[a('drain',{flat:350})],elseActs:[a('drain',{flat:250})]}],2),
]);
const survive='劫難餘生';
export const TIANXIE_SURVIVE=skill(survive,'無屬性','屬性',0,5,1,[
 property('必中；','sure_hit',true,0),property('爆擊率0','base_crit_chance',0,1),
 line(survive,'5回合內免疫','use',[act(a('immune_status_turns',{turns:5,reflect:true}))],2),
 line(survive,'消除對手回合','use',[act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('immune_status_count',{count:1})]}],3),
 line(survive,'5回合內每回合','use',[act(a('timed',{turns:5,from:'now',trig:'self_after_use',body:[{cond:[c('hp_cmp',{side:'self',op:'高於'})],acts:[a('dmg',{flat:600,type:'固定'})],elseActs:[a('dmg',{flat:300,type:'固定'})]}]}))],4),
 line(survive,'2回合內，自身','use',[act(a('freeze_turn_effects',{turns:2}))],5),
 line(survive,'自身下2回合','use',[act(a('crit_turns',{turns:2,next:true}),a('sure_hit_turns',{turns:2,next:true}),a('timed',{turns:2,from:'next',trig:'self_attack',body:[act(a('ignore',{what:'抵擋傷害'}),a('ignore',{what:'轉化傷害'}))]}))],6),
],{sure:true});
const origin='朔源皆難';
export const TIANXIE_ORIGIN=skill(origin,'邪靈.龍','特殊',0,20,3,[
 property('必中','sure_hit',true,0),
 line(origin,'命中後100%','after_hit',[act(a('status',{side:'opp',status:'害怕',chance:100})),{chain:'fail',acts:[a('stat',{side:'opp',stats:['全屬性'],v:-1})]}],1),
 line(origin,'解除自身所處','use',[act(a('cure_status',{side:'self'})),{chain:'success',acts:[a('pp_op',{side:'self',mode:'recover'}),a('clear_turn',{side:'opp'})]}],2),
 line(origin,'3回合內每回合結束','use',[act(a('timed',{turns:3,from:'now',trig:'round_end',body:[act(a('stat_steal_random',{count:4,v:1,stats:['atk','def','speed','accuracy']}))]}))],3),
 line(origin,'5回合內自身使用','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[act(a('heal_then',{side:'self',ratio:.5,damageEqualType:'百分比',body:[{cond:[c('last_amount',{op:'低於',amount:150})],acts:[a('dmg',{flat:150,type:'真實'}),tianxieMark()]}]}))]}))],4),
 line(origin,'3回合內自身使用技能吸取','use',[act(a('timed',{turns:3,from:'now',trig:'self_skill',initial:true,body:[act(a('drain',{base:'stat:攻擊',of:'self',ratio:.5,type:'固定'}))]}))],5),
],{sure:true});
const lone='難·孤掌難鳴';
export const TIANXIE_LONE=skill(lone,'邪靈.龍','物理',150,5,0,[
 line(lone,'無​​視對手技能','before_skill',[act(a('ignore',{what:'傷害限制'}))],0,true),
 line(lone,'無​​視對手技能','self_after_use',[act(curse())],1,true,[c('ignore_success',{what:'傷害限制'})]),
 line(lone,'100%令自身平靜','use',[act(a('status',{side:'self',status:'平靜',chance:100}),a('seal_by_status_turns',{status:'平靜',side:'self',skillInvalid:true}))],2),
 line(lone,'自身體力低於','use',[{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:1/3})],acts:[a('boost',{mult:4,kind:'攻擊'})]}],3),
 line(lone,'技能無效時','self_invalid',[act(tianxieMark())],4,false,[c('skill_invalid')]),
],{accuracy:94});
const fifth='難·逆鱗天判';
const marked=c('mark_count',{side:'opp',id:TIANXIE_MARK_ID,op:'高於',amount:0});
export const TIANXIE_FIFTH=skill(fifth,'邪靈.龍','物理',160,5,0,[
 property('必中','sure_hit',true,0),
 line(fifth,'解除並將自身','use',[act(a('stat_transfer_down',{requireOpponentApplied:true})),{chain:'success',acts:[curse()]}],1),
 line(fifth,'若打出致命','after_hit',[{cond:[c('crit')],acts:[a('immune_status_count',{count:1})]}],2),
 line(fifth,'吸取對手等同','use',[act(a('drain_checked_then',{type:'百分比',ratio:1/3,threshold:1,measure:'lost',belowBody:[act(a('status',{side:'opp',status:'疲憊',chance:100}))]}))],3),
 line(fifth,'對手識別屬性','outgoing_power',[{cond:[marked],acts:[a('power_mod',{boost:3})],elseActs:[a('power_mod',{boost:1.5})]}],4,true,[c('type_is',{side:'opp',type:'龍'})]),
],{sure:true,fifth:true});
export const TIANXIE_READY_SKILLS=[TIANXIE_DECAY,TIANXIE_SURVIVE,TIANXIE_ORIGIN,TIANXIE_LONE,TIANXIE_FIFTH];
