import type {KitEntry} from '../effects/effectSystem.schema';
import {action as a} from './reviewedSequenceSkillKits';
import {IMMORTAL_AINS_SOURCE} from './immortalAinsSource';

/** 已核對的神焰生命週期片段；完整魂印尚未上架，不含舊魂印。 */
export const IMMORTAL_FLAME_KIND='x_immortal_flame';
export const IMMORTAL_FLAME_SAVED='summonGuardPending';
export const IMMORTAL_FLAME_SACRIFICED='summonGuardSacrificed';
export const IMMORTAL_FLAME_DESCRIPTION=IMMORTAL_AINS_SOURCE.split(/\r?\n/).find(line=>line.startsWith('不滅神焰:'))!.slice('不滅神焰:'.length);
const c=(id:string,p:any)=>({c:id,p,label:id});
const e=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number):KitEntry=>({
 codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,
 params:{clause:{raw,trig,parsed:true,body}},
});
const clearBoth=[a('stat_clear',{side:'both',kind:'up'}),a('clear_turn',{side:'both'})];
export const IMMORTAL_AINS_FLAME_LIFECYCLE_KIT:KitEntry[]=[
 e('battle_start','battle_start','戰鬥開始時不滅神焰作為額外精靈加入己方',[
  {acts:[a('summon_extra_elf',{name:'不滅神焰',id:IMMORTAL_FLAME_KIND,type:'火',side:'self',statSource:'holder',statFromTeamRatio:1})]},
 ],0),
 e('self_fatal','fatal','艾恩斯死亡時會令其保留1點體力',[
  {cond:[c('summoned_extra_alive',{name:'不滅神焰'})],acts:[a('survive',{}),a('flag_set',{key:IMMORTAL_FLAME_SAVED,value:true,thisRound:true})]},
 ],1),
 e('battle_phase_end','team_phase_end','觸發成功則當回合戰鬥階段結束時若艾恩斯不處於焚燼、燒傷、易燃狀態則不滅神焰死亡並消除雙方能力提升狀態和回合類效果',[
  {cond:[c('player_state',{key:IMMORTAL_FLAME_SAVED,equals:true,thisRound:true}),c('summoned_extra_alive',{name:'不滅神焰'}),
   ...['焚燼','燒傷','易燃'].map(status=>c('has_status',{side:'self',status,neg:true}))],
   acts:[a('kill_owned_extra',{id:IMMORTAL_FLAME_KIND})]},
  {chain:'success',acts:[a('flag_set',{key:IMMORTAL_FLAME_SACRIFICED,value:true}),a('flag_set',{key:IMMORTAL_FLAME_SAVED,value:false}),...clearBoth]},
 ],2),
 e('cthyaat_death','defeated','艾恩斯死亡時消除雙方能力提升狀態和回合類效果',[
  {cond:[c('player_state',{key:IMMORTAL_FLAME_SACRIFICED,equals:true,fallback:false})],acts:[a('once',{key:'summonGuardFinalClear',body:[{acts:clearBoth}]})]},
 ],3),
];
/** 燒傷的原扣血與威力降低均替換；汲取出手效果由另一正式事件條款負責。 */
const replaceBurn=[{acts:[a('status_mechanic_override',{statuses:['燒傷'],skipDamage:true,powerMultiplier:1.5})]}];
export const IMMORTAL_AINS_FLAME_STATUS_KIT:KitEntry[]=[
 e('modify_status_mechanic','team_status_mechanic','己方燒傷效果改為技能威力提升50%',[
  {...replaceBurn[0],cond:[c('summoned_extra_alive',{name:'不滅神焰'})]},
 ],4),
 e('modify_status_mechanic','team_status_mechanic','前述己方效果改為僅對己方艾恩斯生效',[
  {...replaceBurn[0],cond:[c('player_state',{key:IMMORTAL_FLAME_SACRIFICED,equals:true,fallback:false}),c('event_is_holder',{})]},
 ],5),
];
/** 出手階段即結算；控制不會取消這個時點。來源與在場受益精靈分開。 */
const drainAtPhase=[a('with_event_elf',{body:[{
 cond:[c('has_status',{side:'self',status:'燒傷'})],
 acts:[a('drain',{ratio:1/5,true:true})],
}]})];
export const IMMORTAL_AINS_FLAME_ACTION_KIT:KitEntry[]=[
 e('action_phase_enter','team_action_phase_enter','出手時(自身不需出手)汲取對手最大體力的1/5',[
  {cond:[c('summoned_extra_alive',{name:'不滅神焰'})],acts:drainAtPhase},
 ],6),
 e('action_phase_enter','team_action_phase_enter','前述己方效果改為僅對己方艾恩斯生效',[
  {cond:[c('player_state',{key:IMMORTAL_FLAME_SACRIFICED,equals:true,fallback:false}),c('event_is_holder',{})],acts:drainAtPhase},
 ],7),
];
export const IMMORTAL_AINS_FLAME_ENEMY_KIT:KitEntry[]=[
 e('on_status_received','team_opponent_status_received','對手受到燒傷時額外令其1回合內失去本系加成及高於1倍的屬性克制',[
  {cond:[c('summoned_extra_alive',{name:'不滅神焰'}),c('event_status',{statuses:['燒傷']})],acts:[a('with_event_elf',{body:[{acts:[a('mark_program',{
   id:'attackTypeBonusSuppressed',name:'本系與克制加成失效',description:'1回合內失去本系加成及高於1倍的屬性克制',displayChar:'封',unit:'回合',
   side:'self',scope:'elf',mode:'set',count:1,maxCount:1,turns:1,persistsOffField:false,rules:[],stabDisabled:true,typeAdvantageDisabled:true,
  })]}]})]},
 ],8),
];
