import {PEGASUS_SOURCE} from './pegasusSource';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
const lines=PEGASUS_SOURCE.split(/\r?\n/);
const raw=(name:string,prefix:string)=>{const start=lines.indexOf(name),i=lines.findIndex((s,n)=>n>start&&s.startsWith(prefix));if(start<0||i<0)throw Error(`${name}/${prefix}`);return lines[i];};
const line=(name:string,prefix:string,trig:string,body:any[],order:number,innate=false)=>e(raw(name,prefix),trig,body,order,'skill',innate);
export const PEGASUS_PHASE_KEY='featherCycle';
export const potential=()=>c('phase',{key:PEGASUS_PHASE_KEY,name:'potential'});
const force=(name:string)=>[
 property('爆擊率0/16','base_crit_chance',0,0), // 順序需為 ≥0 整數；與必中同為 0
 {codeId:'skill_property' as const,node:'on_skill_selected' as const,source:'skill' as const,role:'innate' as const,order:1,customText:raw(name,'激活潛能時'),params:{property:'ignore_pp_limit',value:true,conditions:[potential()]}},
 e(raw(name,'激活潛能時'),'before_skill',[act(a('sure_hit_force',{}))],2,'skill',true,[potential()]),
];
const allBenchTrue=(flat:number)=>['self','opp'].map(side=>a('select_elf',{side,scope:'bench',state:'alive',orderBy:'team_order',direction:'asc',all:true,body:[act(a('damage_selected',{flat,type:'true'}))]}));
const blue='藍羽.冰暴';
export const PEGASUS_BLUE=skill(blue,'冰','特殊',100,5,3,[
 property('必中','sure_hit',true,0),...force(blue),
 line(blue,'5回合內免疫','use',[act(a('immune_status_turns',{turns:5,reflect:true}))],3),
 line(blue,'命中後100%','after_hit',[
  act(a('status',{side:'opp',status:'凍傷',chance:100})),
  {chain:'success',acts:allBenchTrue(150)},
  {chain:'fail',acts:[a('clear_turn',{side:'opp'}),a('status',{side:'opp',status:'冰封',chance:100})]},
 ],4),
 line(blue,'將對手所處','use',[act(a('convert_status',{side:'opp',status:'冰封',turns:3}))],5),
 line(blue,'4回合內','use',[act(a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,body:[act(a('drain_checked_then',{type:'固定',flat:300,measure:'lost',threshold:1,belowBody:[act(a('drain',{flat:300,true:true}))]}))]}))],6),
],{sure:true});
const violet='紫羽.幻滅';
export const PEGASUS_VIOLET=skill(violet,'超能','特殊',100,5,3,[
 property('必中','sure_hit',true,0),...force(violet),
 line(violet,'令自身全屬性','use',[
  act(a('stat',{side:'self',stats:['全屬性'],v:1}),a('stat',{side:'opp',stats:['全屬性'],v:-1})),
  act(a('stage_gap_gate',{threshold:12})),{chain:'success',acts:[a('add_invalid_turns',{kind:'all',turns:2})]},
 ],3),
 line(violet,'5回合內自身吸取','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
  // 額外吸取條件取吸取前快照，各份獨立結算；整次未回血才催眠。
  act(a('drain_checked_then',{type:'百分比',ratio:.25,extraRatio:.5,extraBelowHpRatio:.5,measure:'healed',threshold:1,belowBody:[act(a('status',{side:'opp',status:'睡眠',chance:100}))]})),
 ]}))],4),
 line(violet,'造成攻擊傷害提升150%','use',[act(a('boost',{mult:2.5,kind:'攻擊'}),a('dmg_mod_uses',{uses:1,boost:1.5,kind:'攻擊',attackOnly:true}))],5),
 line(violet,'下2次自身','use',[act(a('prio_next',{v:2,uses:2,attackOnly:true}))],6),
],{sure:true});
const white='白羽.閃耀';
export const PEGASUS_WHITE=skill(white,'普通','特殊',0,5,3,[
 ...force(white),
 line(white,'威力隨機','outgoing_power',[act(a('random_streak_power',{min:180,max:360,step:0,cap:360,stageMultiplier:1}))],3,true),
 line(white,'附加自身最大體力','use',[
  {cond:[c('hp_ratio',{side:'opp',op:'高於',ratio:.5})],acts:[a('dmg',{of:'self',base:'最大體力',ratio:.8,type:'百分比'})],elseActs:[a('dmg',{of:'self',base:'最大體力',ratio:.4,type:'百分比'})]},act(a('heal_equal')),
 ],4),
 line(white,'下次擊敗對手','use',[act(a('watch',{key:'nextKillEntryStun',trig:'kill',body:[act(a('next_entry_status',{status:'眩暈',turns:3}))],text:raw(white,'下次擊敗對手')}))],5),
 line(white,'恢復自身所有','use',[act(a('pp_op',{side:'self',mode:'add',amount:2}))],6),
]);
const gold='金羽.烈影';
export const PEGASUS_GOLD=skill(gold,'光','特殊',100,20,3,[
 property('必中','sure_hit',true,0),...force(gold),
 line(gold,'無視對手免疫','before_skill',[act(a('ignore',{what:'攻擊免疫'}))],3,true),
 line(gold,'消除對手回合','use',[act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('first_turns',{turns:2}),a('dmg_mod_turns',{side:'self',dir:'out',kind:'攻擊',boost:1,turns:2,next:true})]}],4),
 line(gold,'命中後100%','after_hit',[act(a('status',{side:'opp',status:'麻痺',chance:100})),{chain:'fail',acts:[a('add_invalid_turns',{kind:'屬性',turns:3})]}],5),
],{sure:true});
const fifth='駒.璀璨星茫';
export const PEGASUS_FIFTH=skill(fifth,'飛行.光','特殊',160,5,3,[
 property('必中','sure_hit',true,0),...force(fifth),
 line(fifth,'將對手能力上升','before_skill',[act(a('ignore',{what:'對手提升視為下降'}))],3,true),
 line(fifth,'技能威力額外','outgoing_power',[act(a('random_streak_power',{min:320,max:480,step:0,cap:480,stageMultiplier:1}))],4,true),
 line(fifth,'消除雙方能力','use',[
  act(a('stat_clear',{side:'both',kind:'all'}),a('clear_turn',{side:'both'}),a('clear_shield',{side:'both',kind:'both'})),
  act(a('dmg_sum',{terms:[{base:'stat:特攻',of:'self',ratio:.4},{base:'stat:速度',of:'self',ratio:.4}],type:'百分比'})),
 ],5),
 line(fifth,'吸取對手最大','use',[act(a('drain_checked_then',{type:'百分比',ratio:1/3,measure:'lost',threshold:1,belowBody:[act(a('status',{side:'opp',status:'眩暈',chance:100}))]}))],6),
],{sure:true,fifth:true});
export const PEGASUS_READY_SKILLS=[PEGASUS_BLUE,PEGASUS_VIOLET,PEGASUS_WHITE,PEGASUS_GOLD,PEGASUS_FIFTH];
