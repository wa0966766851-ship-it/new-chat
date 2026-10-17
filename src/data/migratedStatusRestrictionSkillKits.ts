import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';

export const MIGRATED_STATUS_RESTRICTION_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5013'],name:'王·凜冬葬歌',
  description:'■ 必中\n■ 對手處於能力下降狀態時先制+3\n■ 攻擊時造成的傷害不會出現微弱（若微弱則轉為普通）\n🎯 複製對手能力提升，複製成功則對手3回合內攻擊技能無法造成攻擊傷害與附加異常狀態\n🎯 2回合內對手體力恢復量下降100%\n🎯 吸取對手最大體力40%，每次使用增加10%，最高60%\n🎯 對手處於能力下降狀態時傷害提升150%',
  kit:[
    property('■ 必中','sure_hit',true,0),
    {...property('■ 對手處於能力下降狀態時先制+3','base_priority',3,1),params:{property:'base_priority',value:3,conditions:[{c:'stage',p:{side:'opp',kind:'down'},label:'對手能力下降'}]}},
    {...sequence('■ 攻擊時造成的傷害不會出現微弱（若微弱則轉為普通）',[{acts:[a('no_resist',{})]}],2),role:'innate'},
    sequence('🎯 複製對手能力提升，複製成功則對手3回合內攻擊技能無法造成攻擊傷害與附加異常狀態',[
      {acts:[a('stat_steal',{mode:'複製'})]},
      {chain:'success',acts:[a('damage_cap_turns',{side:'opp',dir:'out',kind:'攻擊',cap:0,turns:3}),a('status_inflict_guard_turns',{side:'opp',kind:'攻擊',turns:3})]},
    ],3),
    sequence('🎯 2回合內對手體力恢復量下降100%',[{acts:[a('recovery_reduce_turns',{side:'opp',ratio:1,turns:2,includePotions:false})]}],4),
    sequence('🎯 吸取對手最大體力40%，每次使用增加10%，最高60%',[{acts:[a('drain',{ratio:.4,true:false,rampInc:10,rampCap:60,rampStreak:false})]}],5),
    sequence('🎯 對手處於能力下降狀態時傷害提升150%',[
      {cond:[{c:'stage',p:{side:'opp',kind:'down'},label:'對手能力下降'}],acts:[a('boost',{mult:2.5,kind:'攻擊'})]},
    ],6),
  ],
}];
