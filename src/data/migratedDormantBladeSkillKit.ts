import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
import type {Stmt} from '../blocks/model';
const hit=(raw:string,body:Stmt[],order:number)=>({...sequence(raw,body,order),node:'on_hit' as const,params:{clause:{raw,marker:'🎯' as const,trig:'after_hit' as const,parsed:true,body}}});
const low={c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'自身體力低於最大體力一半'};
export const MIGRATED_DORMANT_BLADE_SKILL_KITS:ReviewedSequenceSkill[]=[{
 elfIds:['5022'],name:'蟄刃復歸',description:'■ 必中\n■ 該技能每有1點PP值則先制+1且技能連擊次數+1\n🎯 令自身平靜，自身處於平靜狀態則攻擊、雙防、速度、命中+1\n🎯 5回合內自身恢復最大體力⅓並造成等量百分比傷害，自身體力低於最大體力½時恢復效果與造成百分比傷害翻倍\n🎯 下2回合自身使用技能先制+6\n🎯 下次死亡時，若下隻出戰己方精靈在場超過6回合則自身重生',kit:[
  property('■ 必中','sure_hit',true,0),
  {codeId:'effect_sequence',node:'modify_priority',source:'skill',role:'innate',order:1,customText:'■ 該技能每有1點PP值則先制+1',params:{clause:{raw:'該技能每有1點PP值則先制+1',trig:'modify_priority',parsed:true,body:[{acts:[a('pp_priority',{perPp:1})]}]}}},
  {codeId:'effect_sequence',node:'before_skill',source:'skill',role:'innate',order:2,customText:'■ 該技能每有1點PP值則技能連擊次數+1',params:{clause:{raw:'該技能每有1點PP值則技能連擊次數+1',trig:'before_skill',parsed:true,body:[{acts:[a('pp_combo_hits',{perPp:1})]}]}}},
  sequence('令自身平靜，自身處於平靜狀態則攻擊、雙防、速度、命中+1',[
   {acts:[a('status',{side:'self',status:'平靜',turns:3,chance:100})]},
   {live:true,cond:[{c:'has_status',p:{side:'self',status:'平靜'},label:'自身處於平靜'}],acts:[a('stat',{side:'self',stats:['攻擊','防禦','特防','速度','命中'],v:1})]},
  ],3),
  hit('5回合內自身恢復最大體力⅓並造成等量百分比傷害，自身體力低於最大體力½時恢復效果與造成百分比傷害翻倍',[
   {acts:[a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[{cond:[low],acts:[a('heal_then',{side:'self',ratio:2/3,body:[{acts:[a('dmg_from_last',{ratio:1,type:'百分比'})]}]})]},{cond:[{...low,p:{...low.p,op:'不低於'}}],acts:[a('heal_then',{side:'self',ratio:1/3,body:[{acts:[a('dmg_from_last',{ratio:1,type:'百分比'})]}]})]}]})]},
  ],4),
  sequence('下2回合自身使用技能先制+6',[{acts:[a('prio_turns',{turns:2,v:6})]}],5),
  hit('下次死亡時，若下隻出戰己方精靈在場超過6回合則自身重生',[{acts:[a('rebirth_after_ally_turns',{afterRounds:6,ratio:1})]}],6),
 ],
}];
