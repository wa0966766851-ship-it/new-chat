import {NADOLE_SOURCE} from './nadoleSource';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
const raw=(prefix:string)=>{const s=NADOLE_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));if(!s)throw Error(prefix);return s;};
const line=(prefix:string,trig:string,body:any[],order:number,innate=false)=>e(raw(prefix),trig,body,order,'skill',innate);
const attackProps=(side:string,uses:number,sureHit=false,ignoreBlocking=false,type?:string)=>a('attack_properties_uses',{side,uses,sureHit,ignoreBlocking,...(type?{type}:{})});
const noHeal=[act(a('no_heal',{turns:2}))];
const checkedDrain=(ratio:number)=>a('drain_checked_then',{type:'百分比',ratio,measure:'lost',threshold:1,belowBody:noHeal});
export const NADOLE_CRAG=skill('磽確','地面','物理',105,10,3,[
 property('先制+3','base_priority',3,0),
 line('吸取並反轉','use',[act(a('stat_steal',{mode:'吸取',reverse:true}))],1),
 line('若對手當前屬性','outgoing_power',[{cond:[c('skill_matches_target')],acts:[a('power_mod',{flat:105})]}],2),
 line('1回合內若對手','use',[act(a('zero_pp_category_seal',{turns:1}))],3),
 line('吸取對手最大體力25%','use',[act(a('drain_growth',{key:'drainGrowth:crag',baseRatio:.25,increment:.1,maximum:.6}))],4),
]);
export const NADOLE_FAULT=skill('地脈倒錯','無屬性','屬性',0,5,1,[
 property('必中','sure_hit',true,0),
 line('5回合內自身免疫','use',[act(a('immune_status_turns',{turns:5,reflect:true}))],1),
 line('5回合內使用技能吸取','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
  {live:true,cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[checkedDrain(2/3)],elseActs:[checkedDrain(1/3)]},
 ]}))],2),
 line('5回合內，自身使用','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[act(a('damage_to_side',{side:'self',amount:10,type:'固定'}))]}))],3),
 line('令對手轉變為地面系','use',[{live:true,cond:[c('type_is',{side:'opp',type:'地面'})],acts:[a('status_transform_until_attack',{name:'屬性反轉'})],elseActs:[a('change_type',{side:'opp',type:'地面',untilSwitch:true})]}],4),
],{sure:true});
export const NADOLE_PACT=skill('石契','無屬性','屬性',0,5,0,[
 line('令自身100%石化','use',[act(a('status',{side:'self',status:'石化',chance:100,turns:1}),a('status_duration_link',{status:'石化'}))],0),
 line('使自身攻擊','use',[{live:true,cond:[c('abnormal',{side:'self'})],acts:[a('stat',{side:'self',stats:['攻擊','防禦','特防','命中'],v:4})],elseActs:[a('stat',{side:'self',stats:['攻擊','防禦','特防','命中'],v:2})]}],1),
 line('與雷納多進行連結','use',[act(a('change_type',{side:'opp',type:'機械',untilSwitch:true})),{chain:'success',acts:[a('crit_uses',{uses:2})]}],2),
 line('下2次攻擊無視','use',[act(attackProps('self',2,false,true))],3),
]);
export const NADOLE_MORPH=skill('厚土移形','地面','物理',150,5,0,[
 property('命中率0%','base_accuracy',0,0),
 line('無視對手能力提升','use',[{cond:[c('stage',{side:'opp',kind:'up'})],acts:[a('status',{side:'opp',status:'沉默',chance:100})]}],1),
 line('無視對手能力提升','use',[act(a('ignore',{what:'能力提升'}))],2,true),
 line('無視對手護盾效果','use',[act(a('ignore',{what:'護盾'}))],3,true),
 line('無視對手護盾效果','after_hit',[act(a('shield_bypass_followup'))],4),
 line('技能無效時','self_invalid',[act(attackProps('opp',2,false,false,'電'),attackProps('self',2,true))],5),
 line('附加對手等同於自身造成','after_hit',[act(a('attack_damage_percent',{ratio:1}))],6),
 line('技能威力提升50%','outgoing_power',[{cond:[c('types_equal')],acts:[a('power_mod',{boost:1})],elseActs:[a('power_mod',{boost:.5})]}],7),
],{accuracy:0});
export const NADOLE_REQUIEM=skill('萬壤歸墟決','地面','物理',160,5,0,[
 property('必中','sure_hit',true,0),
 {codeId:'skill_property',node:'before_skill',source:'skill',role:'innate',order:1,customText:raw('此技能以自身紀錄'),params:{property:'preferred_type_history',value:true,conditions:[]}},
 line('消除對手回合類效果','use',[
  act(a('clear_turn',{side:'opp'})),
  {chain:'success',acts:[a('status',{side:'opp',status:'石化',chance:100})]},
  {chain:'fail',acts:[a('dmg',{flat:300,type:'真實'})]},
 ],2),
 line('恢復自身最大體力','use',[act(a('heal',{side:'self',ratio:1/3})),act(a('dmg_equal',{type:'百分比'}))],3),
 line('下次擊敗對手時','use',[act(a('history_kill_entry_damage',{amount:200}))],4),
],{sure:true,fifth:true});
export const NADOLE_SKILLS=[NADOLE_CRAG,NADOLE_FAULT,NADOLE_PACT,NADOLE_MORPH,NADOLE_REQUIEM];
