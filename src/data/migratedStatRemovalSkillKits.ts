import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const stats='🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍';
const healing='🎯 4回合內每回合恢復自身最大體力的1/3並造成等量固定傷害';
const double='  > 自身體力低於1/2時恢復效果和固定傷害翻倍';
const removal='🎯 3回合內自身能力強化狀態被消除、吸取時則對手2回合使用屬性技能附加效果失效';
export const MIGRATED_STAT_REMOVAL_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5031'],name:'禁靈領域',description:['■ 必中',stats,healing,double,removal].join('\n'),
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence(stats,[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:{c:'stage',p:{side:'self',kind:'up'},label:'使用前自身已有能力提升'}})]}],1),
    sequence(healing+'\n'+double,[{acts:[a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,body:[
      {acts:[a('heal',{side:'self',ratio:1/3,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'回復前自身體力低於一半'}}),a('dmg_equal',{type:'固定'})]},
    ]})]}],2),
    sequence(removal,[{acts:[a('timed',{turns:3,from:'now',trig:'stat_boost_cleared',body:[{acts:[a('add_invalid_turns',{turns:2,kind:'屬性',next:false})]}]})]}],3),
  ],
}];
