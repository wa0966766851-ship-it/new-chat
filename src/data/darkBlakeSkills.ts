import {DARK_BLAKE_SOURCE} from './darkBlakeSource';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
import {SHADOW_MARK} from './shadowPairKit';
import type {KitEntry} from '../effects/effectSystem.schema';
/** 晻藹夜靈.布萊克（5053）技能；每句一個條目，只用通用積木。屬性技能依專案慣例為無屬性。 */
const line=(text:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(text,trig,body,order,'skill',false,cond);
/** 攜帶類常駐效果：裝備即在已接通事件監控，不需選中或使用（connectedEffects 的角色過濾）。 */
const carried=(text:string,trig:string,body:any[],order:number,cond:any[]=[]):KitEntry=>({...e(text,trig,body,order,'skill',false,cond),role:'carried'});
/** 致死保留封印（攜帶常駐、無條件）：布萊克在場時，對手在場精靈的致死保留本場僅1次。 */
const carriedFatalSeal=(text:string,order:number,cond:any[]=[])=>carried(text,'round_start',[
 {cond:[c('owner_on_field',{}),...cond],acts:[a('seal_fatal_resist',{side:'opp'})]},
],order);
const shadow={...SHADOW_MARK,side:'self',scope:'elf',persistsOffField:true};
const hasShadow=c('mark_count',{side:'self',id:SHADOW_MARK.id,op:'不小於',amount:1});
const noShadow=c('mark_count',{side:'self',id:SHADOW_MARK.id,op:'低於',amount:1});
const noLoss=c('last_no_dmg');

export const NB_XUANWEN=skill('玄文處幽','暗影','物理',90,20,3,[
 property('先制+3','base_priority',3,0),
 property('必中','sure_hit',true,1),
 line('將自身能力下降狀態反饋給對手，附加成功則100%令對手害怕，未觸發或附加失敗則令對手下次施放的技能無效並解除自身異常狀態','use',[
  act(a('stat_transfer',{})),
  {chain:'success',acts:[a('status',{side:'opp',status:'害怕',chance:100})]},
  {chain:'any_fail',acts:[a('invalid_next',{kind:'all',uses:1}),a('cure_status',{side:'self'})]},
 ],2),
 line('吸取對手能力提升狀態，吸取成功則自身下兩次技能必定先手且造成技能傷害翻倍','use',[
  act(a('stat_steal',{mode:'吸取'})),
  {chain:'success',acts:[a('first_next',{uses:2}),a('dmg_mod_uses',{uses:2,boost:1,kind:'技能'})]},
 ],3),
 line('附加自身當前攻擊值30%的百分比傷害並恢復自身等量體力，對手體力未減少則轉變為附加等量真實傷害','use',[
  act(a('drain',{base:'stat:攻擊',of:'self',ratio:.3,type:'百分比'})),
  {cond:[noLoss],acts:[a('dmg_from_last',{basis:'requested_damage',ratio:1,type:'真實'})]},
 ],4),
],{sure:true});
export const NB_NEWNIGHT=skill('新生之夜','無屬性','屬性',0,5,1,[
 property('先制+1','base_priority',1,0),
 line('自身攻擊、雙防、速度、命中+1，存在雙重暗影時額外攻擊、速度+1，不存在雙重暗影時為自身補充1道雙重暗影','use',[
  act(a('stat',{side:'self',stats:['攻擊','防禦','特防','速度','命中'],v:1})),
  {pre:true,cond:[hasShadow],acts:[a('stat',{side:'self',stats:['攻擊','速度'],v:1})]},
  {pre:true,cond:[noShadow],acts:[a('resource_mark_add',{...shadow,amount:1})]},
 ],1),
 line('為自身附加6回合狂暴，自身已處於狂暴狀態則額外自身攻擊、雙防、速度、命中+1','use',[
  {pre:true,cond:[c('has_status',{side:'self',status:'狂暴'})],acts:[a('stat',{side:'self',stats:['攻擊','防禦','特防','速度','命中'],v:1})]},
  act(a('status',{side:'self',status:'狂暴',turns:6,chance:100})),
 ],2),
 line('5回合內使用技能後吸取對手最大體力⅓，自身體力低於最大體力½時額外吸取對手最大體力½，若吸取後自身體力未增加或對手體力未減少則2回合對手屬性技能固有效果失效','use',[act(a('timed',{turns:5,from:'now',trig:'self_after_skill',label:'新生之夜·吸取',body:[
  act(a('drain_checked_then',{type:'百分比',ratio:1/3,extraRatio:1/2,extraBelowHpRatio:.5,measure:'either',threshold:1,belowBody:[act(a('effect_turns',{keys:{inherentInvalid:'屬性'},turns:2,side:'opp'}))]})),
 ]}))],3),
 line('自身下2次攻擊必定打出致命一擊且無視對手抵擋、免疫效果','use',[act(
  a('crit_uses',{uses:2}),
  a('timed_uses',{uses:2,trig:'self_attack',label:'新生之夜·無視',body:[act(a('ignore',{what:'抵擋傷害'}),a('ignore',{what:'免疫'}))]}),
 )],4),
 line('下2回合自身所有技能先制+2','use',[act(a('prio_turns',{turns:2,v:2,next:true}))],5),
],{sure:true});
export const NB_INVERTED=skill('繩墨倒懸','無屬性','屬性',0,5,3,[
 property('先制+3','base_priority',3,0),
 line('將自身所有異常狀態附加給對手並解除自身所有異常狀態，解除成功則2回合內對手所有技能附加效果失效且無法附加在場精靈任一方異常狀態','use',[
  act(a('status_hand_over',{allStatuses:true})),
  {chain:'success',acts:[a('cure_status',{side:'self'}),a('add_invalid_turns',{kind:'all',turns:2}),a('status_inflict_guard_turns',{side:'opp',kind:'all',turns:2})]},
 ],1),
 line('5回合內對手使用攻擊技能則100%令對手害怕','use',[act(a('timed',{turns:5,from:'now',trig:'opp_used_attack',label:'繩墨倒懸·害怕',body:[act(a('status',{side:'opp',status:'害怕',chance:100}))]}))],2),
 line('5回合內對手使用屬性技能則100%令對手全屬性-1','use',[act(a('timed',{turns:5,from:'now',trig:'opp_used_status',label:'繩墨倒懸·削弱',body:[act(a('stat',{side:'opp',stats:['全屬性'],v:-1}))]}))],3),
 line('將自身下次受到的技能傷害100%反饋給對手','use',[act(a('timed_uses',{uses:1,trig:'damaged_skill',label:'繩墨倒懸·反饋',body:[act(a('reflect_event_damage',{ratio:1}))]}))],4),
 line('技能無效時，100%令對手詛咒，未觸發則對手2回合內攻擊技能固有效果失效','on_invalid',[
  act(a('status',{side:'opp',status:'詛咒',chance:100})),
  {chain:'fail',acts:[a('effect_turns',{keys:{inherentInvalid:'攻擊'},turns:2,side:'opp'})]},
 ],5),
],{sure:true});
export const NB_KING=skill('王.負咎泯晝','暗影','物理',150,5,1,[
 property('先制+1','base_priority',1,0),
 line('攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）','before_skill',[act(a('minimum_matchup',{value:1}))],1),
 line('自身體力高於對手時額外先制+1','modify_priority',[{cond:[c('hp_cmp',{side:'self',op:'高於'})],acts:[a('prio_bonus',{v:1})]}],2),
  // 條件式必中（對手處於異常時）— 技能附加、命中前查詢
  {codeId:'skill_property',node:'before_skill',source:'skill',role:'attached',order:3,customText:'對手處於異常狀態時必定命中',params:{property:'conditional_sure_hit',value:true,conditions:[c('abnormal',{side:'opp'})]}},
  // 攜帶類常駐封印（非附加效果）：持有者在場時，每回合開始對對方在場精靈施加封印。
  // 2026-11-27：舊註解的「對手處於異常」不是封印條件，已移除；上方異常條件只影響必中。
  // 不要求施放本招；封印次數不因重複施加而重置。
  carriedFatalSeal('令對方在場精靈下次觸發致死保留體力效果與死亡體力不受體力限制效果時變為本場戰鬥唯一1次觸發且本場戰鬥無法再次觸發',0),
 line('技能無效時，2回合內屬性技能附加效果失效，恢復自身最大體力⅓，自身體力低於對手時效果翻倍','on_invalid',[act(
  a('add_invalid_turns',{kind:'屬性',turns:2}),
  a('heal',{side:'self',ratio:1/3,x2If:c('hp_cmp',{side:'self',op:'低於'})}),
 )],4),
 line('技能無效時，自身下2次攻擊將對手視為暗影系','on_invalid',[act(a('attack_type_view_uses',{uses:2,targetType:'暗影'}))],5),
 line('若當前技能屬性與自身相同則威力提升150，後出手則效果翻倍','use',[
  {cond:[c('same_type',{side:'self'}),c('first')],acts:[a('boost',{power:true,add:150,mult:1})]},
  {cond:[c('same_type',{side:'self'}),c('last')],acts:[a('boost',{power:true,add:300,mult:1})]},
 ],6),
],{accuracy:0});
export const NB_DARK=skill('暗.瞢闇无始','暗影','物理',160,5,0,[
 property('必中','sure_hit',true,0),
 line('攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）','before_skill',[act(a('minimum_matchup',{value:1}))],1),
 line('消除對手回合類效果，消除成功則對手2回合內所有技能固有效果失效且當回合戰鬥階段結束時受到150點真實傷害','use',[
  act(a('clear_turn',{side:'opp'})),
  {chain:'success',acts:[a('effect_turns',{keys:{inherentInvalid:true},turns:2,side:'opp'}),a('timed',{turns:1,from:'now',trig:'phase_end',once:true,label:'瞢闇无始·階段末',body:[act(a('dmg',{flat:150,type:'真實'}))]})]},
 ],2),
 line('雙方任一方處於異常狀態時1回合內對手受到非真實傷害額外提升150%','use',[
  {cond:[c('abnormal',{side:'any'})],acts:[a('dmg_mod_turns',{side:'opp',dir:'taken',kind:'非真實',boost:1.5,turns:1})]},
 ],3),
 line('3回合內對手體力恢復量降低100%','use',[act(a('heal_reduce_turns',{turns:3,ratio:1}))],4),
 line('附加自身最大體力60%的百分比傷害，自身體力低於最大體力½時效果翻倍，對手受到此傷害後體力未減少則額外附加自身最大體力60%的真實傷害','use',[
  act(a('dmg',{base:'最大體力',of:'self',ratio:.6,type:'百分比',x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})),
  {cond:[noLoss],acts:[a('dmg',{base:'最大體力',of:'self',ratio:.6,type:'真實'})]},
 ],5),
],{sure:true,fifth:true});
/** 備選技能（2026-11-22）：王.黎明前奏 混沌.暗影物攻 160 PP5，命中100%，先制+1。用語依原文；「空定/眩暈/平靜」皆有正式狀態定義。 */
export const NB_DAWN=skill('王.黎明前奏','混沌.暗影','物理',160,5,1,[
 property('先制+1','base_priority',1,0),
 property('必中','sure_hit',true,1),
  carriedFatalSeal(DARK_BLAKE_SOURCE.split(/\r?\n/).find(line=>line.startsWith('若攜帶此技能則布萊克'))!,0),
 line('命中後100%令對手害怕，未觸發則100%令雙方狂暴；此技能若當前技能屬性與自身相同改為附加自身平靜、附加對手眩暈','after_hit',[
  {cond:[c('same_type',{side:'self',neg:true})],acts:[a('status',{side:'opp',status:'害怕',chance:100})]},
  {chain:'fail',cond:[c('same_type',{side:'self',neg:true})],acts:[a('status',{side:'both',status:'狂暴',chance:100})]},
  {cond:[c('same_type',{side:'self'})],acts:[a('status',{side:'self',status:'平靜',chance:100}),a('status',{side:'opp',status:'眩暈',chance:100})]},
 ],3),
 line('3回合內對手屬性技能固有效果失效','use',[act(a('effect_turns',{keys:{inherentInvalid:'屬性'},turns:3,side:'opp',label:'屬性技能固有效果失效'}))],4),
 line('技能無效時，3回合內屬性技能附加效果失效，恢復自身最大體力⅓，自身體力低於對手時效果翻倍','on_invalid',[
  act(a('add_invalid_turns',{kind:'屬性',turns:3}),a('heal',{side:'self',ratio:1/3,x2If:c('hp_cmp',{side:'self',op:'低於'})})),
 ],5),
 line('若當前技能屬性與自身相同則威力提升150\n> 先出手則效果翻倍','use',[
  {cond:[c('same_type',{side:'self'}),c('first')],acts:[a('boost',{power:true,add:300,mult:1})]},
  {cond:[c('same_type',{side:'self'}),c('last')],acts:[a('boost',{power:true,add:150,mult:1})]},
 ],6),
],{sure:true,labelEffects:true});
export const DARK_BLAKE_SKILLS=[NB_XUANWEN,NB_NEWNIGHT,NB_INVERTED,NB_KING,NB_DARK,NB_DAWN];
