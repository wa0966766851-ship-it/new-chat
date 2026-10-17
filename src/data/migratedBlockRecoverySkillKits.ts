import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=[
  '■ 此技能PP值為滿時當回合先制+3',
  '🎯 3回合內自身使用技能對手每回合速度-2、命中-2，未觸發則2回合內對手無法主動切換精靈',
  '🎯 4回合內對手每次使用攻擊技能時吸取對手最大體力1/3',
  '🎯 4回合內對手使用攻擊技能時100%使對手癱瘓',
  '🎯 抵擋下1次攻擊，抵擋成功則附加對手等量真實傷害並恢復自身等量體力',
];
export const MIGRATED_BLOCK_RECOVERY_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5016'],name:'源生壁壘',description:raw.join('\n'),kit:[
    // 明確列出通常先制0；條件加3，編輯／匯入時不借用其他欄位的先制。
    property(raw[0],'base_priority',0,0),
    {...property(raw[0],'base_priority',3,1),params:{property:'base_priority',value:3,conditions:[{c:'pp_full',p:{},label:'選用前PP為滿'}]}},
    sequence(raw[1],[{acts:[a('timed',{turns:3,from:'now',trig:'self_skill',initial:true,label:'使用技能弱化',body:[
      {acts:[a('once_per_round',{key:'skillUseDebuff',body:[
        {acts:[a('stat',{side:'opp',stats:['速度','命中'],v:-2})]},
        {chain:'fail',acts:[a('no_switch',{turns:2})]},
      ]})]},
    ]})]}],2),
    sequence(raw[2],[{acts:[a('timed',{turns:4,from:'now',trig:'opp_attack',label:'對手攻擊吸取',body:[
      {acts:[a('drain',{ratio:1/3,true:false})]},
    ]})]}],3),
    sequence(raw[3],[{acts:[a('timed',{turns:4,from:'now',trig:'opp_attack',label:'對手攻擊異常',body:[
      {acts:[a('status',{side:'opp',status:'癱瘓',chance:100,turns:3})]},
    ]})]}],4),
    sequence(raw[4],[{acts:[a('block_damage_uses',{uses:1,kind:'攻擊',key:'blockedRecovery',onBlock:[
      {acts:[a('damage_from_counter',{key:'blockedRecovery',ratio:1,type:'真實',consume:false}),
        a('heal_from_counter',{key:'blockedRecovery',ratio:1,consume:true})]},
    ]})]}],5),
  ],
}];
