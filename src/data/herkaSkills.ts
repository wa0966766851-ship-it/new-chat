import type {KitEntry} from '../effects/effectSystem.schema';
import {HERKA_SOURCE} from './herkaSource';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
const raw=(prefix:string)=>{const s=HERKA_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));if(!s)throw Error(prefix);return s;};
const line=(prefix:string,trig:string,body:any[],order:number,innate=false)=>e(raw(prefix),trig,body,order,'skill',innate);
const ppText=raw('若自身PP值不為滿');
const ppConditions=[c('pp_not_full',{side:'self'})];
const ppKit=():KitEntry[]=>[
 {codeId:'skill_property',node:'modify_priority',source:'skill',role:'attached',order:1,customText:ppText,params:{property:'conditional_priority',value:1,conditions:ppConditions}},
 {codeId:'skill_property',node:'on_skill_selected',source:'skill',role:'innate',order:2,customText:ppText,params:{property:'ignore_pp_limit',value:true,conditions:ppConditions}},
];
export const HERKA_THUNDER=skill('雷罰','電.次元','特殊',90,20,3,[
 property('先制+3','base_priority',3,0),...ppKit(),
 {codeId:'skill_property',node:'before_damage',source:'skill',role:'innate',order:3,customText:raw('將對手能力上升'),params:{property:'stage_view',value:'opp_up_as_down',conditions:[]}},
 line('消除對手回合類效果','use',[act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('status',{side:'opp',status:'麻痺',chance:100})]}],4),
 line('附加對手自身最大體力40%','use',[{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[a('drain',{ratio:.8})],elseActs:[a('drain',{ratio:.4})]}],5),
 line('令對手隨機1個技能','use',[act(a('pp_zero_random',{count:1}))],6),
]);
export const HERKA_FEAST=skill('魂.電磁饗宴','無屬性','屬性',0,5,3,[
 property('必中','sure_hit',true,0),...ppKit(),
 line('消除敵我雙方回合類效果','use',[act(a('clear_turn',{side:'both'}),a('block_damage_uses',{uses:1,kind:'全部',key:'blockedDamageReflection',onBlock:[act(a('dmg_from_last',{ratio:1.5,type:'真實'}))]}))],3),
 line('消除雙方能力上升','use',[
  act(a('flag_set',{key:'anyClearSucceeded',value:false})),
  act(a('stat_clear',{side:'both',kind:'all'})),{chain:'success',acts:[a('flag_set',{key:'anyClearSucceeded',value:true})]},
  act(a('clear_shield',{side:'both',kind:'both'})),{chain:'success',acts:[a('flag_set',{key:'anyClearSucceeded',value:true})]},
  act(a('dmg',{of:'opp',base:'最大體力',ratio:.5,type:'百分比'})),
  {live:true,cond:[c('player_state',{key:'anyClearSucceeded',equals:true})],acts:[a('status',{side:'opp',status:'繳械',chance:100})]},
 ],4),
 line('恢復自身最大體力1/1','use',[act(a('heal',{side:'self',ratio:1})),act(a('dmg_equal',{type:'百分比'}))],5),
 line('先出手則自身下次死亡','use',[{cond:[c('first',{})],acts:[a('rebirth_once',{restorePp:true})]}],6),
],{sure:true});
export const HERKA_BODY=skill('天雷霸體','無屬性','屬性',0,5,0,[
 property('必中','sure_hit',true,0),...ppKit(),
 line('使自身特攻','use',[act(a('stat',{side:'self',stats:['特攻','速度','命中'],v:1}))],3),
 line('5回合內自身免疫','use',[act(a('immune_status_turns',{turns:5,cls:'控制類'}))],4),
 line('5回合內自身使用技能','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[act(a('drain_checked_then',{type:'百分比',ratio:1/3,threshold:1,measure:'lost',belowBody:[act(a('dmg',{flat:300,type:'真實'}))],afterBody:[]}))]}))],5),
 line('下2回合自身攻擊','use',[act(a('sure_hit_turns',{turns:2,next:true}),a('crit_turns',{turns:2,next:true}))],6),
 line('下2回合自身所有技能','use',[act(a('prio_turns',{v:2,turns:2,next:true}))],7),
],{sure:true});
const invalidText=raw('技能無效時令恢復');
export const HERKA_CLEAVE=skill('亙古雷辰斷','電.次元','特殊',160,3,0,[
 ...ppKit(), // 命中率0%已是技能本身欄位（accuracy:0），不另列固有效果
 {codeId:'skill_property',node:'modify_priority',source:'skill',role:'attached',order:3,customText:invalidText,params:{property:'conditional_priority',value:2,conditions:[c('hp_ratio',{side:'self',op:'高於',ratio:.5})]}},
 line('技能無效時令恢復','self_invalid',[
  {cond:[c('hp_ratio',{side:'self',op:'不高於',ratio:.5})],acts:[a('heal',{side:'self',ratio:1/2})]},
  act(a('heal',{side:'self',ratio:1/3}),a('add_invalid_turns',{kind:'屬性',turns:3})),
 ],4),
 line('若技能屬性與自身屬性','outgoing_power',[{cond:[c('same_type',{side:'self'})],acts:[a('power_mod',{flat:160})]}],5),
],{accuracy:0});
export const HERKA_WATCH=skill('魂.無盡守望','電.次元','特殊',0,5,0,[
 property('必中','sure_hit',true,0),...ppKit(),
 line('雙倍吸取對手能力提升','use',[act(a('stat_steal',{mode:'吸取',double:true})),{chain:'success',acts:[a('prio_turns',{side:'opp',turns:2,next:true,v:-3})]}],3),
 line('附加給對手等同於自身','use',[act(a('stat_mirror',{side:'opp',kind:'down'})),{chain:'fail',acts:[a('pp_zero_random',{count:2})]}],4),
 line('自身天賦值越高','outgoing_power',[act(a('power_by_iv',{iv:'hp',maximum:180}))],5,true),
 line('附加對手最大體力⅓','use',[act(a('percent_survivor_heal',{ratio:1/3}))],6),
],{sure:true,fifth:true});
export const HERKA_SKILLS=[HERKA_THUNDER,HERKA_FEAST,HERKA_BODY,HERKA_CLEAVE,HERKA_WATCH];
