import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';

export const MIGRATED_SELECTED_PP_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5030'],name:'聖靈乾坤斷',
  description:'■ 必中\n■ 先制+1\n🎯 消除對手回合類效果，消除成功則攻擊+2、速度+2、命中+2\n🎯 2回合內對手使用的屬性技能無效\n🎯 吸取對手200點固定體力，每次使用額外附加100點，最高500點\n🎯 吸取對手所有技能1點PP值，若吸取後對手所選擇的技能PP值為0，則當回合對手無法行動且受到300點真實傷害',
  kit:[
    property('■ 必中','sure_hit',true,0),property('■ 先制+1','base_priority',1,1),
    sequence('🎯 消除對手回合類效果，消除成功則攻擊+2、速度+2、命中+2',[
      {acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('stat',{side:'self',stats:['攻擊','速度','命中'],v:2})]},
    ],2),
    sequence('🎯 2回合內對手使用的屬性技能無效',[{acts:[a('invalid_turns',{kind:'屬性',turns:2})]}],3),
    sequence('🎯 吸取對手200點固定體力，每次使用額外附加100點，最高500點',[{acts:[a('drain',{flat:200,true:false,rampInc:100,rampCap:500,rampStreak:false})]}],4),
    sequence('🎯 吸取對手所有技能1點PP值，若吸取後對手所選擇的技能PP值為0，則當回合對手無法行動且受到300點真實傷害',[
      {acts:[a('pp_op',{side:'opp',mode:'drain',amount:1,stopIfEmpty:true})]},
      {cond:[{c:'selected_pp',p:{side:'opp',op:'不大於',amount:0},label:'吸取後所選技能PP為0'}],acts:[a('dmg',{flat:300,type:'真實'})]},
    ],5),
  ],
}];
