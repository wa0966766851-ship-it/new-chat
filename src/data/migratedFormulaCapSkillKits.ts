import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a,property,sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const c=(name:string,p:any)=>({c:name,p,label:name});
const innate=(raw:string,acts:any[],order:number):KitEntry=>({...sequence(raw,[{acts}],order),role:'innate'});
const stage=(side:string,neg=false)=>c('stage',{side,kind:'up',neg});
export const MIGRATED_FORMULA_CAP_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5007'],name:'溺咒之握',description:'■ 先制+3\n🎯 吸取並反轉對手能力提升狀態\n■ 技能威力額外提升對手最大體力*1/3+個體值\n🎯 將對手所處的凍傷狀態轉化為冰封，轉化成功則附加等同於對手最大體力⅛的真實傷害',kit:[
    property('■ 先制+3','base_priority',3,0),
    sequence('🎯 吸取並反轉對手能力提升狀態',[{acts:[a('stat_steal',{mode:'吸取',reverse:true})]}],1),
    innate('■ 技能威力額外提升對手最大體力*1/3+個體值',[a('power_add_hp_iv',{side:'opp',ratio:1/3,iv:'hp'})],2),
    sequence('🎯 將對手所處的凍傷狀態轉化為冰封，轉化成功則附加等同於對手最大體力⅛的真實傷害',[{cond:[c('has_status',{side:'opp',status:'凍傷'})],acts:[a('convert_status',{side:'opp',from:'凍傷',status:'冰封',turns:3})]},{chain:'success',acts:[a('dmg',{base:'最大體力',of:'opp',ratio:1/8,type:'真實'})]}],3),
  ],
},{
  elfIds:['5010'],name:'星光·閃擊',description:'■ 先制+3\n🎯 消除對手能力提升狀態，消除成功則2回合內對手造成的攻擊傷害不超過200點，若對手不處於能力提升狀態則2回合內對手所有體力恢復效果減少50%\n🎯 2回合內免疫所有受到的異常狀態\n🎯 2回合內免疫能力下降狀態',kit:[
    property('■ 先制+3','base_priority',3,0),
    sequence('🎯 消除對手能力提升狀態，消除成功則2回合內對手造成的攻擊傷害不超過200點，若對手不處於能力提升狀態則2回合內對手所有體力恢復效果減少50%',[{acts:[a('stat_clear',{side:'opp',kind:'up'})]},{chain:'success',acts:[a('damage_cap_turns',{side:'opp',dir:'out',kind:'攻擊',cap:200,turns:2})]},{cond:[stage('opp',true)],acts:[a('recovery_reduce_turns',{side:'opp',ratio:.5,turns:2,includePotions:true})]}],1),
    sequence('🎯 2回合內免疫所有受到的異常狀態',[{acts:[a('immune_status_turns',{turns:2})]}],2),
    sequence('🎯 2回合內免疫能力下降狀態',[{acts:[a('immune_statdown_turns',{turns:2})]}],3),
  ],
},{
  elfIds:['5029'],name:'天雷誅殺',description:'■ 先制+4\n■ 必中\n🎯 令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1\n🎯 出手時令對手本次受到非真實傷害提升70%，先出手時效果翻倍，處於能力提升狀態時變為3倍\n🎯 吸取對手70點體力\n🎯 2回合對手屬性技能無效',kit:[
    property('■ 先制+4','base_priority',4,0),property('■ 必中','sure_hit',true,1),
    sequence('🎯 令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1',[{acts:[a('stat',{side:'opp',stats:['全屬性'],v:1,x2If:stage('opp')})]}],2),
    sequence('🎯 出手時令對手本次受到非真實傷害提升70%，先出手時效果翻倍，處於能力提升狀態時變為3倍',[
      {cond:[stage('self')],acts:[a('boost',{mult:3.1,kind:'非真實',power:false})]},
      {cond:[stage('self',true),stage('opp')],acts:[a('boost',{mult:3.1,kind:'非真實',power:false})]},
      {cond:[stage('self',true),stage('opp',true),c('first',{})],acts:[a('boost',{mult:2.4,kind:'非真實',power:false})]},
      {cond:[stage('self',true),stage('opp',true),c('last',{})],acts:[a('boost',{mult:1.7,kind:'非真實',power:false})]},
    ],3),
    sequence('🎯 吸取對手70點體力',[{acts:[a('drain',{flat:70,true:false})]}],4),
    sequence('🎯 2回合對手屬性技能無效',[{acts:[a('invalid_turns',{turns:2,kind:'屬性'})]}],5),
  ],
}];
