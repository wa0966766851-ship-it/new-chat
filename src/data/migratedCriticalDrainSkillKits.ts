import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';

const stats='🎯 全屬性+1，對手處於異常狀態時強化狀態翻倍';
const drain='🎯 4回合內吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍';
const immune='🎯 若對手免疫百分比傷害，則附加250點真實傷害';
const critical='🎯 下2回合打出致命一擊則吸取對手350點體力';
const priority='🎯 下2回合自身所有技能先制+2且攻擊必定致命';
export const MIGRATED_CRITICAL_DRAIN_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5015'],name:'孑然孤夢',description:['■ 必中',stats,drain,immune,critical,priority].join('\n'),
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence(stats,[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:{c:'abnormal',p:{side:'opp'},label:'對手處於異常狀態'}})]}],1),
    // 免疫分支和每次比例吸取同次結算，不能在施放時拿傷害0代替免疫。
    sequence(`${drain}\n${immune}`,[{acts:[a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,body:[
      {acts:[a('drain',{ratio:1/3,true:false,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'自身低於半血'}})]},
      {cond:[{c:'last_damage_immune',p:{},label:'本次百分比吸取被免疫'}],acts:[a('dmg',{flat:250,type:'真實'})]},
    ]})]}],2),
    sequence(critical,[{acts:[a('timed',{turns:2,from:'next',trig:'self_after_attack',body:[
      {cond:[{c:'crit',p:{},label:'本次自身攻擊致命'}],acts:[a('drain',{flat:350,true:false})]},
    ]})]}],3),
    sequence(priority,[{acts:[a('prio_turns',{turns:2,v:2,attackOnly:false}),a('crit_turns',{turns:2,next:true})]}],4),
  ],
}];
