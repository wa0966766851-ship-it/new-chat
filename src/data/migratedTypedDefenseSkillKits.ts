import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';

export const MIGRATED_TYPED_DEFENSE_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5025'],name:'幽幕折返',
  description:'■ 必中\n🎯 令自身免疫並反彈下2次異常狀態\n🎯 使自身全屬性+1，對手不為神靈系時強化效果翻倍\n🎯 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍\n🎯 對手下2次攻擊技能無效\n🎯 下3次自身使用所有技能先制+2\n🎯 下3次自身使用特殊攻擊技能忽略對手特防值60%',
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 令自身免疫並反彈下2次異常狀態',[{acts:[a('immune_status_count',{count:2,reflect:true})]}],1),
    sequence('🎯 使自身全屬性+1，對手不為神靈系時強化效果翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:{c:'type_is',p:{side:'opp',type:'神靈',neg:true},label:'對手不為神靈系'}})]}],2),
    sequence('🎯 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍',[{acts:[a('timed',{turns:5,from:'now',trig:'self_after_skill',body:[
      {acts:[a('drain',{ratio:1/3,true:false,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'自身低於半血'}})]},
    ]})]}],3),
    sequence('🎯 對手下2次攻擊技能無效',[{acts:[a('invalid_next',{uses:2,kind:'攻擊'})]}],4),
    sequence('🎯 下3次自身使用所有技能先制+2',[{acts:[a('prio_next',{uses:3,v:2,attackOnly:false})]}],5),
    sequence('🎯 下3次自身使用特殊攻擊技能忽略對手特防值60%',[{acts:[a('timed_uses',{uses:3,trig:'self_skill',kind:'特殊',body:[
      {acts:[a('ignore_def_action',{stat:'特防',ratio:.6})]},
    ]})]}],6),
  ],
}];
