import {NAIFEN_SOURCE} from './naifenSource';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
import {NAIFEN_FORM_IDS} from './naifenItems';
import type {KitEntry} from '../effects/effectSystem.schema';

const sections=NAIFEN_SOURCE.split('技能:')[1];
const raw=(name:string,prefix:string)=>{
 const start=sections.indexOf(name+'\r\n');if(start<0)throw Error(name);
 const lines=sections.slice(start).split(/\r?\n/),i=lines.findIndex(s=>s.startsWith(prefix));
 if(i<0)throw Error(`${name}: ${prefix}`);
 let j=i+1;while(j<lines.length&&lines[j].startsWith('>'))j++;
 return lines.slice(i,j).join('\n');
};
const line=(name:string,prefix:string,trig:string,body:any[],order:number,innate=false)=>e(raw(name,prefix),trig,body,order,'skill',innate);
const reversal=[act(a('stat_reverse',{side:'self',kind:'down'})),{chain:'success',acts:[a('invalid_next',{kind:'屬性',uses:1})]}];

export const NAIFEN_ECHO=skill('殘響','超能','特殊',90,20,3,[
 property('先制+3','base_priority',3,0),property('必中','sure_hit',true,1),
 line('殘響','反轉自身能力下降','use',reversal,2),
 line('殘響','吸取並反轉對手能力提升','use',[act(a('stat_steal',{mode:'吸取',reverse:true}))],3),
 line('殘響','自身體力高於','outgoing_power',[
  {cond:[c('hp_ratio',{side:'self',op:'高於',ratio:.5})],acts:[a('settlement_flow',{body:[
   {cond:[c('abnormal',{side:'self'})],acts:[a('power_mod',{boost:1.5})]},
   {cond:[c('abnormal',{side:'self',neg:true}),c('abnormal',{side:'opp'})],acts:[a('power_mod',{boost:1.5})]},
   {cond:[c('abnormal',{side:'self',neg:true}),c('abnormal',{side:'opp',neg:true})],acts:[a('power_mod',{boost:.75})]},
  ]})]},
 ],4),
 line('殘響','吸取對手250','use',[{cond:[c('hp_cmp',{side:'self',op:'低於'})],acts:[a('drain',{flat:500})],elseActs:[a('drain',{flat:250})]}],5),
],{sure:true});

export const NAIFEN_LULLABY=skill('安眠調','普通','物理',90,20,3,[
 property('先制+3','base_priority',3,0),
 line('安眠調','消除對手回合類效果','use',[
  {cond:[c('has_turn_effect',{side:'opp',neg:true})],acts:[a('status',{side:'opp',status:'睡眠',chance:100})]},
  act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('pp_zero',{kind:'攻擊'})]},
 ],1),
 line('安眠調','吸取對手所有技能1','use',[
  act(a('pp_op',{side:'opp',mode:'drain',amount:1})),
  {live:true,cond:[c('selected_pp',{side:'opp',op:'不高於',amount:0})],acts:[a('stop_action',{side:'opp'})]},
 ],2),
 line('安眠調','吸取對手250','use',[{live:true,cond:[c('skill_pp_any',{side:'opp',op:'低於',amount:2})],acts:[a('drain',{flat:500})],elseActs:[a('drain',{flat:250})]}],3),
 line('安眠調','技能無效時','self_invalid',[
  act(a('clear_turn',{side:'opp'}),a('status_random',{count:1,cls:'控制類'})),
 ],4),
]);

export const NAIFEN_OVERTURE=skill('極樂序曲','超能','物理',0,5,0,[
 property('必中','sure_hit',true,0),
 line('極樂序曲','5回合內免疫','use',[act(a('immune_status_turns',{turns:5,cls:'控制類',reflect:true}))],1),
 line('極樂序曲','解除自身所有異常','use',[act(a('cure_status',{side:'self'})),{chain:'success',acts:[a('heal',{side:'self',ratio:1})]}],2),
 line('極樂序曲','5回合內使用技能','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
  act(a('stat',{side:'opp',stats:['全屬性'],v:-1})),
  {chain:'success',acts:[a('dmg',{of:'self',base:'stat:攻擊和特攻',ratio:.15,type:'百分比'})]},
  {chain:'fail',acts:[a('dmg',{of:'self',base:'stat:攻擊和特攻',ratio:.15,type:'真實'})]},
 ]}))],3),
],{sure:true});

export const NAIFEN_STOMP=skill('踩踏音','普通','特殊',0,5,0,[
 property('必中','sure_hit',true,0),
 line('踩踏音','100%令自身','use',[
  {cond:[c('has_status',{side:'self',status:'星佑'})],acts:[a('stat_value',{side:'self',stats:['hp'],amount:25,direction:'increase',floor:1})]},
  act(a('status',{side:'self',status:'星佑',chance:100})),
 ],1),
 line('踩踏音','自身全屬性','use',[{live:true,cond:[c('abnormal',{side:'self'})],acts:[a('stat',{side:'self',stats:['全屬性'],v:2})],elseActs:[a('stat',{side:'self',stats:['全屬性'],v:1})]}],2),
 line('踩踏音','下2回合造成','use',[act(a('dmg_mod_turns',{side:'self',dir:'out',kind:'攻擊',boost:1.5,turns:2,next:true}))],3),
 line('踩踏音','下2回合自身','use',[act(a('prio_turns',{v:2,turns:2,next:true}))],4),
],{sure:true});

const finaleName='塞壬·極樂終章';
const transform=(star:boolean):KitEntry=>({codeId:'skill_property',node:'before_skill',source:'skill',role:'innate',order:star?1:2,
 customText:raw(finaleName,star?'自身處於星佑狀態':'自身不處於星佑狀態'),
 params:{property:'skill_transform',conditions:[c('has_status',{side:'self',status:'星佑',neg:!star})],
 value:{category:star?'特殊':'物理',types:[star?'超能':'普通'],power:180,perWeight:1,perPower:0,names:{物理:finaleName,特殊:finaleName},ignoreAttackImmunity:true}}});
export const NAIFEN_FINALE=skill(finaleName,'無屬性','屬性',0,5,0,[
 property('必中','sure_hit',true,0),transform(true),transform(false),
 line(finaleName,'自身不處於星佑狀態','use',[
  {cond:[c('has_status',{side:'self',status:'星佑',neg:true}),c('skill_kind',{kind:'物理'})],acts:[a('use_items_in_order',{side:'opp',ids:NAIFEN_FORM_IDS})]},
 ],3),
 line(finaleName,'無視對手免疫效果','before_skill',[act(a('ignore',{what:'攻擊免疫'}))],4,true),
 line(finaleName,'無視對手傷害限制效果','before_skill',[act(a('ignore',{what:'傷害限制'}))],5,true),
 {codeId:'skill_property',node:'before_skill',source:'skill',role:'innate',order:6,customText:raw(finaleName,'若克制倍數為普通'),params:{property:'force_stab',value:'neutral',conditions:[]}},
 line(finaleName,'消除對手回合類效果','use',[act(a('clear_turn',{side:'opp'}))],7),
 line(finaleName,'消除對手能力提升狀態','use',[act(a('stat_clear',{side:'opp',kind:'up'}))],8),
 line(finaleName,'解除自身能力下降狀態','use',[act(a('stat_clear',{side:'self',kind:'down'}))],9),
 line(finaleName,'出手前自身體力低於','before_skill',[{cond:[c('hp_cmp',{side:'self',op:'低於'})],acts:[a('exchange_current_hp')]}],10),
],{sure:true,fifth:true});
export const NAIFEN_READY_SKILLS=[NAIFEN_ECHO,NAIFEN_LULLABY,NAIFEN_OVERTURE,NAIFEN_STOMP,NAIFEN_FINALE];
