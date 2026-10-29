import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=['■ 必中','🎯 4 回合內免疫並反彈所有受到的異常狀態','🎯 80% 令對手【沉默】','> 未觸發時，自身免疫下一次受到的攻擊傷害，並對攻擊者附加該次攻擊傷害 100% 的百分比傷害','🎯 3 回合內自身能力提升無法被消除或吸取','🎯 3 回合內自身能力下降無法被解除或反轉','> 【沉默】（戰鬥百科）：弱化類異常；處於該異常狀態則第五技能無效；處於該異常狀態則每回合結束時受到等同於自身最大體力 1/8 的百分比傷害'];
export const MIGRATED_STAGE_GUARD_SKILL_KITS:ReviewedSequenceSkill[]=[{elfIds:['arena_15'],name:'日月安屬',description:raw.join('\n'),kit:[
  property(raw[0],'sure_hit',true,0),
  sequence(raw[1],[{acts:[a('immune_status_turns',{turns:4,reflect:true})]}],1),
  sequence(raw[2]+'\n'+raw[3],[{acts:[a('status',{side:'opp',status:'沉默',chance:80,turns:3})]},
    {chain:'fail',acts:[a('block_damage_uses',{uses:1,kind:'攻擊',key:'status_failure_counter',onBlock:[{acts:[a('damage_from_counter',{key:'status_failure_counter',ratio:1,type:'百分比',consume:true})]}]})]}],2),
  sequence(raw[4],[{acts:[a('stage_guard_turns',{kind:'up',turns:3})]}],3),
  sequence(raw[5],[{acts:[a('stage_guard_turns',{kind:'down',turns:3})]}],4),
]}];
