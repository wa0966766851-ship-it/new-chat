import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
import type {Stmt} from '../blocks/model';
const hit=(raw:string,body:Stmt[],order:number)=>({...sequence(raw,body,order),node:'on_hit' as const,params:{clause:{raw,marker:'🎯' as const,trig:'after_hit' as const,parsed:true,body}}});
/** N回合內沿用使用級收尾，首個命中建立窗口後，當次也由正式收尾觸發。 */
export const MIGRATED_SIX_BLADE_SKILL_KITS:ReviewedSequenceSkill[]=[{
 elfIds:['5022'],name:'六刃碎界斷',description:'■ 必中\n■ 該技能每有1點PP值則先制+1且技能連擊次數+3\n🎯 6回合內對手體力恢復量下降100%\n🎯 附加自身雙攻值總和66%的百分比傷害\n🎯 3回合內令對手雙防-1，未觸發則2回合內對手攻擊技能無效且當回合結束時受到當前雙防值總和66%的百分比傷害',kit:[
  property('■ 必中','sure_hit',true,0),
  {codeId:'effect_sequence',node:'modify_priority',source:'skill',role:'innate',order:1,customText:'■ 該技能每有1點PP值則先制+1',params:{clause:{raw:'該技能每有1點PP值則先制+1',trig:'modify_priority',parsed:true,body:[{acts:[a('pp_priority',{perPp:1})]}]}}},
  {codeId:'effect_sequence',node:'before_skill',source:'skill',role:'innate',order:2,customText:'■ 該技能每有1點PP值則技能連擊次數+3',params:{clause:{raw:'該技能每有1點PP值則技能連擊次數+3',trig:'before_skill',parsed:true,body:[{acts:[a('pp_combo_hits',{perPp:3})]}]}}},
  hit('6回合內對手體力恢復量下降100%',[{acts:[a('recovery_reduce_turns',{side:'opp',ratio:1,turns:6,includePotions:true,next:false})]}],3),
  sequence('附加自身雙攻值總和66%的百分比傷害',[{acts:[a('dmg',{base:'stat:攻擊和特攻',of:'self',ratio:.66,type:'百分比'})]}],4),
  hit('3回合內令對手雙防-1，未觸發則2回合內對手攻擊技能無效且當回合結束時受到當前雙防值總和66%的百分比傷害',[
   {acts:[a('timed',{turns:3,from:'now',trig:'self_after_use',body:[
    {acts:[a('stat',{side:'opp',stats:['防禦','特防'],v:-1})]},
    {chain:'fail',acts:[a('invalid_turns',{kind:'攻擊',turns:2}),a('at_round_end',{originalTarget:true,body:[{acts:[a('dmg',{base:'stat:防禦和特防',of:'opp',ratio:.66,type:'百分比'})]}]})]},
   ]})]},
  ],5),
 ],
}];
