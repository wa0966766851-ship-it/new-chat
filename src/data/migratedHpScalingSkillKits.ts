import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';

export const MIGRATED_HP_SCALING_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5009'],name:'負岳勢',
  description:'■ 必中\n■ 自身處於能力下降狀態時先制+3\n🎯 將能力下降狀態附加給對手，附加成功則對手下次使用的技能無效\n🎯 令自身全屬性+1，自身體力每高於對手1000000點效果額外全屬性+1\n🎯 下2回合自身攻擊技能造成傷害提升100%\n🎯 下2回合自身所有技能先制+2',
  kit:[
    property('■ 必中','sure_hit',true,0),
    {...property('■ 自身處於能力下降狀態時先制+3','base_priority',3,1),params:{property:'base_priority',value:3,conditions:[{c:'stage',p:{side:'self',kind:'down'},label:'自身能力下降'}]}},
    sequence('🎯 將能力下降狀態附加給對手，附加成功則對手下次使用的技能無效',[
      {acts:[a('stat_transfer',{})]},{chain:'success',acts:[a('invalid_next',{uses:1,kind:'all'})]},
    ],2),
    sequence('🎯 令自身全屬性+1，自身體力每高於對手1000000點效果額外全屬性+1',[
      {acts:[a('stat',{side:'self',stats:['全屬性'],v:1,hpGapUnit:1000000})]},
    ],3),
    sequence('🎯 下2回合自身攻擊技能造成傷害提升100%',[
      {acts:[a('dmg_mod_turns',{side:'self',dir:'out',kind:'攻擊',boost:1,turns:2,next:true})]},
    ],4),
    sequence('🎯 下2回合自身所有技能先制+2',[{acts:[a('prio_turns',{turns:2,v:2,attackOnly:false})]}],5),
  ],
}];
