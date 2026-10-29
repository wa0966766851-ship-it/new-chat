import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=[
  '■ 必中',
  '🎯 5回合免疫並反彈所有異常狀態',
  '🎯 3回合內，對手使用攻擊技能則令對手繳械',
  '🎯 3回合內，每回合開始時使對手3項能力值-1並附加給自身，執行後若對手不處於全屬性能力下降狀態則下2回合內無法主動切換精靈',
  '🎯 下2回合對手受到的傷害提升150%',
  '🎯 下2回合先制+2',
];
export const MIGRATED_RANDOM_STAGE_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5018'],name:'蟲群庇護',description:raw.join('\n'),kit:[
    property(raw[0],'sure_hit',true,0),
    sequence(raw[1],[{acts:[a('immune_status_turns',{turns:5,reflect:true})]}],1),
    sequence(raw[2],[{acts:[a('timed',{turns:3,from:'now',trig:'opp_attack',label:'對手攻擊繳械',body:[
      {acts:[a('status',{side:'opp',status:'繳械',chance:100})]},
    ]})]}],2),
    sequence(raw[3],[{acts:[a('timed',{turns:3,from:'now',trig:'round_start',label:'回合初隨機吸取能力',body:[
      {acts:[a('stat_steal_random',{count:3,v:1})]},
      {live:true,cond:[{c:'stage_all',p:{side:'opp',kind:'down',neg:true},label:'執行後並非全部六項下降'}],acts:[a('switch_lock',{side:'opp',turns:2,next:true})]},
    ]})]}],3),
    sequence(raw[4],[{acts:[a('dmg_mod_turns',{side:'opp',dir:'taken',kind:'',boost:1.5,turns:2,next:true})]}],4),
    sequence(raw[5],[{acts:[a('prio_turns',{turns:2,v:2})]}],5),
  ],
}];
