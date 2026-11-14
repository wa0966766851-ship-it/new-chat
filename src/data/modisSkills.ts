import type {Skill} from '../types';
import type {KitEntry} from '../effects/effectSystem.schema';
import {SEQUENCE_TRIGGERS} from '../effects/sequenceTriggers';
import {action as a,property} from './reviewedSequenceSkillKits';
import {MODIS_SOURCE,MODIS_CLARIFICATIONS} from './modisSource';

const c=(id:string,p:any)=>({c:id,p,label:id});
const act=(...acts:any[])=>({acts});
const up=c('stage',{side:'self',kind:'up'});
const line=(prefix:string)=>{
 const found=MODIS_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));
 if(!found)throw Error(`莫迪西斯缺少原文：${prefix}`);
 return found.replace('對手體力1/2時',MODIS_CLARIFICATIONS.abyssDoubleHp+'時');
};
const entry=(prefix:string,trig:string,body:any[],order:number,innate=false,conditions:any[]=[]):KitEntry=>({
 codeId:'effect_sequence',source:'skill',role:innate?'innate':'attached',node:SEQUENCE_TRIGGERS[trig] as KitEntry['node'],order,customText:line(prefix),
 params:{clause:{raw:line(prefix),trig,parsed:true,body,...(conditions.length?{cond:conditions}:{})}},
});
const base=(name:string,power:number,pp:number,priority:number):Skill=>({name,type:power?'神秘':'無屬性',category:power?'特殊':'屬性',power,pp,maxPp:pp,currentPp:pp,priority,accuracy:100,isSureHit:true,isFifthSkill:false,effectMode:'kit',effectType:'none',effectDetail:'',description:'',kit:[]});

export const MODIS_SHADOW:Skill={...base('幻魔終影',90,20,3),kit:[
 property('必中','sure_hit',true,0),property('先制+3','base_priority',3,1),
 entry('反轉自身能力下降狀態','use',[
  act(a('stat_reverse',{side:'self',kind:'down'})),{chain:'success',acts:[a('pp_zero',{kind:'屬性'})]},
 ],2),
 entry('吸取對手能力提升狀態','use',[
  act(a('stat_steal',{mode:'吸取'})),{chain:'success',acts:[a('prio_next',{v:3,uses:1,attackOnly:true})]},
 ],3),
 entry('技能威力提升30%','outgoing_power',[
  {cond:[up],acts:[a('power_mod',{boost:.6})],elseActs:[a('power_mod',{boost:.3})]},
 ],4,true),
]};

const fearFailure=act(a('select_elf',{all:true,side:'opp',scope:'bench',state:'alive',orderBy:'team_order',direction:'asc',body:[act(a('damage_selected',{type:'true',flat:300}))]}));
const fearBody=[act(a('status',{side:'opp',status:'害怕',chance:100})),{chain:'fail',acts:fearFailure.acts}];
const drain=(flat:number)=>a('drain_checked_then',{type:'固定',flat,threshold:270,measure:'either',belowBody:fearBody});
export const MODIS_ABYSS:Skill={...base('深淵結界',0,5,1),kit:[
 property('必中','sure_hit',true,0),property('先制+1','base_priority',1,1),
 entry('5回合內自身免疫','use',[act(a('immune_status_turns',{turns:5,cls:'非附屬類',reflect:true}))],2),
 entry('5回合內使用技能吸取','use',[
  act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
   {cond:[c('hp_ratio',{side:'opp',op:'不低於',ratio:.5})],acts:[drain(600)],elseActs:[drain(300)]},
  ]})),
 ],3),
 entry('令對手PP值最高','use',[act(a('pp_zero',{highestOnly:true}))],4),
 entry('3回合內對手無法解除','use',[act(a('stage_guard_turns',{side:'opp',kind:'down',turns:3}))],5),
]};

const recoveryPenalty=[act(a('recovery_reduce_turns',{side:'opp',ratio:1,turns:2,includePotions:true}))];
const percentDrain=(ratio:number)=>a('drain_checked_then',{type:'百分比',ratio,threshold:270,measure:'lost',belowBody:recoveryPenalty});
export const MODIS_INSCRIPTION:Skill={...base('毀滅銘刻',0,5,0),kit:[
 property('必中','sure_hit',true,0),
 entry('使自身全屬性+1','use',[
  {cond:[c('hp_cmp',{side:'self',op:'高於',ratio:.5})],acts:[a('stat',{side:'self',stats:['全屬性'],v:2})],elseActs:[a('stat',{side:'self',stats:['全屬性'],v:1})]},
 ],1),
 entry('5回合內自身使用技能吸取','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
  {cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[percentDrain(2/3)],elseActs:[percentDrain(1/3)]},
 ]}))],2),
 entry('直接附加對方300點','use',[
  {live:true,cond:[c('first',{}),up],acts:[a('dmg',{flat:600,type:'技能',elem:'神秘'})],elseActs:[a('dmg',{flat:300,type:'技能',elem:'神秘'})]},
 ],3),
 entry('3回合內對方無法消除','use',[act(a('stage_guard_turns',{side:'self',kind:'up',turns:3}))],4),
 entry('下2回合對手所有技能先制','use',[act(a('prio_turns',{side:'opp',turns:2,v:-2,next:true}))],5),
]};
export const MODIS_REVERSE_SLASH:Skill={...base('墜星逆勢斬',150,7,-1),isSureHit:false,accuracy:97,kit:[
 property('基礎致命率0/16','base_crit_chance',0,0),property('命中率97%','base_accuracy',97,1),
 entry('先出手時造成攻擊傷害','outgoing_attack',[{cond:[c('first',{})],acts:[a('damage_scale',{kind:'攻擊',mult:2})]}],2,true),
 entry('後出手則令對手100%','use',[{cond:[c('last',{})],acts:[a('status',{side:'opp',status:'臣服',chance:100}),a('status',{side:'opp',status:'疲憊',chance:100})]}],3),
 entry('後出手時必定打出','use',[{cond:[c('last',{})],acts:[a('crit_now',{})]}],4,true),
 entry('技能無效時令對手','self_invalid',[{cond:[c('skill_invalid',{})],acts:[a('status',{side:'opp',status:'沉默',chance:100}),a('status',{side:'opp',status:'害怕',chance:100})]}],5),
]};
export const MODIS_STAR_BIND:Skill={...base('神縛·星隕碎空',160,7,0),isFifthSkill:true,kit:[
 property('必中','sure_hit',true,0),property('基礎致命率0/16','base_crit_chance',0,1),
 entry('對手處於回合類效果則','use',[
  act(a('heal',{side:'self',ratio:1})),act(a('clear_turn',{side:'opp'})),
  {cond:[c('success',{})],acts:[a('status',{side:'opp',status:'沉默',chance:100})],elseActs:[a('status',{side:'opp',status:'束縛',chance:100})]},
 ],2,false,[c('has_turn_effect',{side:'opp'})]),
 entry('對手不處於回合類效果則','use',[{cond:[c('has_turn_effect',{side:'opp',neg:true})],acts:[a('status',{side:'opp',status:'害怕',chance:100})]}],3),
 entry('自身處於能力提升狀態則造成攻擊','outgoing_attack',[
  {cond:[up,c('first',{})],acts:[a('boost',{kind:'攻擊',mult:2.54})]},
  {cond:[up,c('last',{})],acts:[a('boost',{kind:'攻擊',mult:1.77})]},
 ],4),
 entry('對手不處於異常狀態則汲取','use',[{cond:[c('abnormal',{side:'opp',neg:true})],acts:[a('drain',{flat:200,true:true})]}],5),
]};
export const MODIS_SKILLS=[MODIS_SHADOW,MODIS_ABYSS,MODIS_INSCRIPTION,MODIS_REVERSE_SLASH,MODIS_STAR_BIND];
// 描述逐行取來源，不以執行摘要替換原文。
for(const s of MODIS_SKILLS)s.description=[...(s.isSureHit?['必中']:[]),...s.kit!.filter(e=>e.codeId==='effect_sequence').map(e=>e.customText)].join('\n');
