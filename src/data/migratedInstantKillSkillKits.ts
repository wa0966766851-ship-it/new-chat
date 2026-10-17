import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action,property,sequence} from './reviewedSequenceSkillKits';
const statusCount='🎯 免疫下2次自身受到的異常狀態';
const curse='🎯 命中後100%令對手詛咒，未觸發則恢復自身最大體力的1/1體力且3回合內自身受到的傷害不超過200';
const attackBoost='🎯 下2回合造成的攻擊傷害額外提升150%';
const killMonitor='🎯 3回合內自身使用所有攻擊技能都附有15%的秒殺機率';
const clearFear='🎯 消除對手回合類效果，消除成功則100%令對手害怕，未觸發則當回合造成攻擊傷害提升150%';
const drainFear='🎯 吸取對手最大體力⅓，未觸發則100%令對手害怕';
const hitFear='🎯 命中後100%令對手害怕，未觸發或對手已處於害怕狀態則30%秒殺對手';
const blockFear='🎯 令自身抵擋下次受到攻擊傷害，觸發成功則下次攻擊自身附加等同於抵擋攻擊傷害量真實傷害';

export const MIGRATED_INSTANT_KILL_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5024'],name:'超重力壓迫',description:'先制+3；命中後15%秒殺對手；2回合內對手屬性技能無效',
  kit:[
    property('先制+3','base_priority',3,0),
    {codeId:'effect_sequence',node:'on_hit',source:'skill',role:'attached',order:1,customText:'命中後15%秒殺對手',
      params:{clause:{raw:'命中後15%秒殺對手',trig:'after_hit',parsed:true,body:[{acts:[action('instant_kill',{chance:15})]}]}}},
    sequence('2回合內對手屬性技能無效',[{acts:[action('invalid_turns',{kind:'屬性',turns:2,next:false})]}],2),
  ],
},{
  elfIds:['5024'],name:'沉寂・永夜悼亡',description:['■ 必中',statusCount,curse,attackBoost,killMonitor].join('\n'),
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence(statusCount,[{acts:[action('immune_status_count',{count:2,reflect:false})]}],1),
    {codeId:'effect_sequence',node:'on_hit',source:'skill',role:'attached',order:2,customText:curse,
      params:{clause:{raw:curse,trig:'after_hit',parsed:true,body:[
        {acts:[action('status',{side:'opp',status:'詛咒',chance:100})]},
        {chain:'fail',acts:[action('heal',{side:'self',ratio:1}),action('damage_cap_turns',{side:'self',dir:'in',kind:'非真實',cap:200,turns:3,next:false})]},
      ]}}},
    sequence(attackBoost,[{acts:[action('dmg_mod_turns',{dir:'out',kind:'攻擊',boost:1.5,turns:2,next:true})]}],3),
    // 附有秒殺的攻擊要讀同次正式命中／附加有效結果；未命中和封附加不能借既存監控繞過。
    sequence(killMonitor,[{acts:[action('timed',{turns:3,from:'now',trig:'self_after_attack',body:[
      {cond:[{c:'event_hit',p:{requireAdditional:true},label:'本次攻擊命中且附加有效'}],acts:[action('instant_kill',{chance:15})]},
    ]})]}],4),
  ],
},{
  elfIds:['5025'],name:'劫數.萬念歸墟',description:['■ 必中',clearFear,drainFear,hitFear,blockFear].join('\n'),
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence(clearFear,[
      {acts:[action('clear_turn',{side:'opp'})]},
      {chain:'success',acts:[action('status',{side:'opp',status:'害怕',chance:100})]},
      {chain:'fail',acts:[action('dmg_mod_turns',{side:'self',dir:'out',kind:'攻擊',boost:1.5,turns:1,next:false})]},
    ],1),
    sequence(drainFear,[{acts:[action('drain',{ratio:1/3})]},{chain:'fail',acts:[action('status',{side:'opp',status:'害怕',chance:100})]}],2),
    {codeId:'effect_sequence',node:'on_hit',source:'skill',role:'attached',order:3,customText:hitFear,
      params:{clause:{raw:hitFear,trig:'after_hit',parsed:true,body:[
        {acts:[action('status',{side:'opp',status:'害怕',chance:100})]},
        // 讀命中句開始前的害怕快照；既存害怕與新附加失敗只能二擇一，不重抽。
        {chain:'fail',cond:[{c:'has_status',p:{side:'opp',status:'害怕',neg:true},label:'原先無害怕'}],acts:[action('instant_kill',{chance:30})]},
        {cond:[{c:'has_status',p:{side:'opp',status:'害怕'},label:'原先已有害怕'}],acts:[action('instant_kill',{chance:30})]},
      ]}}},
    sequence(blockFear,[{acts:[action('block_damage_uses',{uses:1,kind:'攻擊',key:'next-blocked-attack',onBlock:[{acts:[
      action('timed_uses',{uses:1,kind:'攻擊',trig:'self_after_attack',body:[
        {cond:[{c:'event_hit',p:{requireAdditional:true},label:'本次攻擊命中且附加有效'}],acts:[action('damage_from_counter',{key:'next-blocked-attack',ratio:1,type:'真實',consume:true})]},
      ]}),
    ]}]})]}],4),
  ],
}];
