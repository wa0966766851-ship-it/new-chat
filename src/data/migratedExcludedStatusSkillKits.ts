import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const immunity='🎯 5回合內免疫並反彈除狂暴外所有受到的異常狀態';
const attack='🎯 3回合內，對手使用攻擊技能則自身全屬性+1且對手兩回合內屬性技能無效';
const utility='🎯 3回合內，對手使用屬性技能則對手全屬性-1且2回合內攻擊技能無法造成技能傷害且附加效果失效';
const cleared='🎯 3回合內若自身回合類效果被消除則吸取對手最大體力的1/3';
export const MIGRATED_EXCLUDED_STATUS_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5015'],name:'暗耀明滅',description:['■ 必中',immunity,attack,utility,cleared].join('\n'),
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence(immunity,[{acts:[a('immune_status_turns',{turns:5,reflect:true,exclude:['狂暴']})]}],1),
    sequence(attack,[{acts:[a('timed',{turns:3,from:'now',trig:'opp_attack',body:[{acts:[
      a('stat',{side:'self',stats:['全屬性'],v:1}),a('invalid_turns',{kind:'屬性',turns:2,next:false}),
    ]}]})]}],2),
    sequence(utility,[{acts:[a('timed',{turns:3,from:'now',trig:'opp_status',body:[{acts:[
      a('stat',{side:'opp',stats:['全屬性'],v:-1}),
      a('damage_cap_turns',{side:'opp',dir:'out',kind:'技能',cap:0,turns:2,next:false}),
      a('add_invalid_turns',{kind:'攻擊',turns:2,next:false}),
    ]}]})]}],3),
    sequence(cleared,[{acts:[a('timed',{turns:3,from:'now',trig:'turn_effects_cleared',body:[{acts:[a('drain',{ratio:1/3,true:false})]}]})]}],4),
  ],
}];
