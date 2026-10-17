import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';

export const MIGRATED_STEP_DAMAGE_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5022'],name:'狂刃無生',
  description:'■ 先制+6\n■ 必中\n🎯 消除敵我雙方回合類效果，消除成功則令雙方狂暴\n🎯 消除敵我雙方能力上升、下降狀態與護盾、護罩效果，消除成功則附加自身最大體力66%的百分比傷害\n🎯 自身每損失1點體力，則附加對手1點真實傷害，每損失6點，則額外附加6點真實傷害',
  kit:[
    property('■ 先制+6','base_priority',6,0),property('■ 必中','sure_hit',true,1),
    sequence('🎯 消除敵我雙方回合類效果，消除成功則令雙方狂暴',[
      {acts:[a('clear_turn',{side:'both'})]},
      {chain:'success',acts:[a('status',{side:'both',status:'狂暴',chance:100})]},
    ],2),
    sequence('🎯 消除敵我雙方能力上升、下降狀態與護盾、護罩效果，消除成功則附加自身最大體力66%的百分比傷害',[
      {acts:[a('stat_clear',{side:'both',kind:'all'}),a('clear_shield',{side:'both',kind:'both'})]},
      {chain:'success',acts:[a('dmg',{base:'最大體力',of:'self',ratio:.66,type:'百分比'})]},
    ],3),
    sequence('🎯 自身每損失1點體力，則附加對手1點真實傷害，每損失6點，則額外附加6點真實傷害',[
      {acts:[a('dmg',{base:'已損失體力',of:'self',ratio:1,type:'真實',stepUnit:6,stepBonus:6})]},
    ],4),
  ],
}];
