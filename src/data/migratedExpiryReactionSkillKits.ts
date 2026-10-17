import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const reflection='🎯 5回合內自身免疫並反彈所有異常狀態';
const damage='🎯 4回合內，自身使用技能則附加對手等同於自身最大體力20%的真實傷害';
const immunity='🎯 2回合內自身免疫受到的攻擊，雙方每存在異常狀態1回合則額外延長1回合';
const reaction='🎯 3回合內，自身回合類效果被消除時令敵我雙方星贖，已存在星贖則改為回合數+2，未觸發則敵方下2回合無法主動切換精靈';
export const MIGRATED_EXPIRY_REACTION_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5014'],name:'晨曦昭世',
  description:['■ 先制+1','■ 必中',reflection,damage,immunity,reaction].join('\n'),
  kit:[
    property('■ 先制+1','base_priority',1,0),property('■ 必中','sure_hit',true,1),
    sequence(reflection,[{acts:[a('immune_status_turns',{turns:5,cls:'',reflect:true})]}],2),
    // 建立監控的本次使用不補觸發；當回合包含在四回合期限內。
    sequence(damage,[{acts:[a('timed',{turns:4,from:'now',trig:'self_skill',body:[{acts:[a('dmg',{base:'最大體力',of:'self',ratio:0.2,type:'真實'})]}]})]}],3),
    sequence(immunity,[{acts:[a('immune_attack_turns',{turns:2,extendByStatusTurns:'both'})]}],4),
    sequence(reaction,[{acts:[a('timed',{turns:3,from:'now',trig:'turn_effects_cleared',once:true,
      body:[{acts:[a('status_or_extend',{side:'both',status:'星贖',turns:3,extend:2})]}],
      onExpire:[{acts:[a('no_switch',{turns:2,next:true})]}],
    })]}],5),
  ],
}];
