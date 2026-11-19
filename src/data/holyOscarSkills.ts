import {HOLY_OSCAR_SOURCE} from './holyOscarSource';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
/** 聖靈奧斯卡（5048）技能；每句一個條目，只用通用積木。 */
const raw=(prefix:string)=>{const s=HOLY_OSCAR_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));if(!s)throw Error(prefix);return s;};
const line=(prefix:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(raw(prefix),trig,body,order,'skill',false,cond);
// 「先出手令對手當回合攻擊技能無效」五招共用。
const firstInvalid=(order:number)=>line('先出手令對手當回合攻擊技能無效','use',[{cond:[c('first')],acts:[a('invalid_turns',{kind:'攻擊',turns:1,next:false})]}],order);
const noHpLoss=c('last_no_dmg');

export const OSCAR_VERDICT=skill('終審','聖靈','物理',90,20,4,[
 property('先制+4','base_priority',4,0),
 line('無視對手免疫受到的攻擊效果','self_attack',[act(a('ignore',{what:'攻擊免疫'}))],1),
 line('消除對手回合類效果，消除成功則令對手麻痺','use',[
  act(a('clear_turn',{side:'opp'})),
  // 「未觸發麻痺」只看麻痺結果；消除失敗時整段不執行。
  {chain:'success',acts:[a('settlement_flow',{body:[act(a('status',{side:'opp',status:'麻痺',chance:100})),{chain:'fail',acts:[a('drain',{ratio:1/3})]}]})]},
 ],2),
 firstInvalid(3),
 line('2回合內對手體力恢復量下降100%','use',[act(a('heal_reduce_turns',{turns:2,ratio:1}))],4),
 line('附加對手當前已損失體力值50%的百分比傷害','use',[
  act(a('dmg',{base:'已損失體力',of:'opp',ratio:.5,type:'百分比'})),
  {cond:[noHpLoss],acts:[a('dmg_from_last',{basis:'requested_damage',ratio:1,type:'真實'})]},
 ],5),
]);
export const OSCAR_FORBIDDEN=skill('禁忌之光','無屬性','屬性',0,5,1,[
 property('先制+1','base_priority',1,0),
 firstInvalid(1),
 line('5回合內免疫並反彈所有異常狀態','use',[act(a('immune_status_turns',{turns:5,reflect:true,cls:''}))],2),
 line('4回合內自身使用技能隨機令自身3種屬性+1','use',[act(a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,body:[act(a('stat_random',{side:'self',count:3,v:1,mirror:'opp'}))]}))],3),
 line('3回合內自身使用技能後附加對手300點固定傷害','use',[act(a('timed',{turns:3,from:'now',trig:'self_after_skill',body:[
  act(a('dmg',{flat:300,type:'固定'})),{cond:[noHpLoss],acts:[a('dmg',{flat:300,type:'真實'})]},
 ]}))],4),
],{sure:false});
export const OSCAR_GLORY=skill('榮耀聖光','無屬性','屬性',0,5,1,[
 property('先制+1','base_priority',1,0),
 firstInvalid(1),
 line('將自身能力下降狀態反饋給對手','use',[act(a('stat_transfer',{})),{chain:'success',acts:[a('maxhp_flat_reduce',{amount:80})]}],2),
 line('使自身攻擊、防禦、特防、速度、命中+1','use',[act(a('stat',{side:'self',stats:['攻擊','防禦','特防','速度','命中'],v:1,x2If:c('first')}))],3),
 line('5回合內吸取對手最大體力⅓','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
  act(a('drain',{ratio:1/3,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})),
  {chain:'success',live:true,cond:[c('hp_ratio',{side:'self',op:'高於',ratio:.5})],acts:[a('heal_collection',{side:'self',scope:'bench',amount:100})]},
 ]}))],4),
 line('下2回合自身造成攻擊傷害提升150%','use',[act(a('dmg_mod_turns',{dir:'out',kind:'攻擊',boost:1.5,turns:2,next:true}))],5),
]);
export const OSCAR_PARDON=skill('聖元.神靈恕令','聖靈','物理',150,5,1,[
 property('先制+1','base_priority',1,0),
 firstInvalid(1),
 line('後出手則下2回合先制+3','use',[{cond:[c('last')],acts:[a('prio_turns',{turns:2,v:3,next:true})]}],2),
 // 己方任一在場精靈免疫成功（共 2 次）→ 該在場精靈汲取對手200：全隊作用域的事件次數監控。
 line('令己方免疫下2次異常狀態','use',[act(
  a('immune_status_count',{count:2,reflect:false,scope:'team'}),
  a('timed_uses',{uses:2,trig:'status_immune',scope:'team',label:'神靈恕令·免疫汲取',body:[act(a('drain',{flat:200}))]}),
 )],3),
 line('未擊敗對手則本回合戰鬥階段結束時吸取','not_killed',[act(a('timed',{turns:1,from:'now',trig:'phase_end',once:true,label:'神靈恕令·階段末吸取',body:[act(a('drain',{ratio:1/3,leaveHp:1}))]}))],5),
]);
export const OSCAR_EXORCISM=skill('聖元.破魔','聖靈','物理',160,5,1,[
 property('先制+1','base_priority',1,0),
 firstInvalid(1),
 line('反轉對手能力上升狀態','use',[act(a('stat_reverse',{side:'opp',kind:'up',transfer:true,failClear:true}))],2),
 line('吸取對手300點體力','use',[act(a('drain',{flat:300})),{cond:[noHpLoss],acts:[a('dmg',{flat:300,type:'真實'})]}],3),
 line('技能威力提升50%','use',[act(a('boost',{mult:1.5,power:true,kind:'攻擊',x2If:c('skill_pp_any',{side:'opp',op:'不大於',amount:2})}))],4),
],{fifth:true});
export const HOLY_OSCAR_SKILLS=[OSCAR_VERDICT,OSCAR_FORBIDDEN,OSCAR_GLORY,OSCAR_PARDON,OSCAR_EXORCISM];
