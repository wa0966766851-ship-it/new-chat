import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a } from './reviewedSequenceSkillKits';
export const MIGRATED_CARRIED_REACTION_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5023'],name:'啟蟄·冥土荒蕪',
  description:'◇ 攜帶此技能則該技能每次PP值被消耗時：\n> 令對手100%腐朽，未觸發則100%癱瘓\n> 3回合內對手使用攻擊技能則隨機進入2種異常狀態\n> 3回合內對手使用屬性技能則下2回合攻擊技能無法造成傷害且附加效果失效\n> 3回合內自身免疫能力下降狀態',
  kit:[{
    codeId:'effect_sequence',node:'pp_consumed',source:'skill',role:'carried',order:0,
    customText:'本技能PP消耗時附加異常及3回合監控，不依命中或原持有者',
    params:{clause:{raw:'◇ 攜帶此技能則該技能每次PP值被消耗時：',trig:'pp_consumed',parsed:true,body:[
      {acts:[a('status',{side:'opp',status:'腐朽',chance:100})]},
      {chain:'fail',acts:[a('status',{side:'opp',status:'癱瘓',chance:100})]},
      {acts:[
        a('timed',{turns:3,from:'now',trig:'opp_attack',body:[{acts:[a('status_random',{count:2,cls:''})]}]}),
        a('timed',{turns:3,from:'now',trig:'opp_status',body:[{acts:[
          a('damage_cap_turns',{side:'opp',dir:'out',kind:'攻擊',cap:0,turns:2,next:true}),
          a('add_invalid_turns',{turns:2,kind:'攻擊',next:true}),
        ]}]}),
        a('immune_statdown_turns',{turns:3}),
      ]},
    ]}},
  }],
},{
  elfIds:['5023'],name:'血稅迴轉',
  description:'◇ 攜帶此技能則該技能每次PP值被消耗時：\n> 令自身雙防、速度、命中+2，雙攻-1\n> 4回合內每回合吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，對手體力未減少則恢復己方所有不在場精靈200點體力\n> 3回合內使用技能附加300點固定傷害，對手體力未減少則附加300點真實傷害\n> 下2回合自身所有技能先制+2',
  kit:[{
    codeId:'effect_sequence',node:'pp_consumed',source:'skill',role:'carried',order:0,
    customText:'本技能PP消耗時雙防強化、雙攻下降及恢復／傷害期限監控',
    params:{clause:{raw:'◇ 攜帶此技能則該技能每次PP值被消耗時：',trig:'pp_consumed',parsed:true,body:[
      {acts:[a('stat',{side:'self',stats:['防禦','特防','速度','命中'],v:2}),a('stat',{side:'self',stats:['攻擊','特攻'],v:-1})]},
      {acts:[a('timed',{turns:4,from:'now',trig:'self_skill',body:[
        {acts:[a('drain',{ratio:1/3,true:false,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'自身低於半血'}})]},
        {cond:[{c:'last_no_dmg',p:{},label:'對手體力未減少'}],acts:[a('heal_collection',{side:'self',scope:'bench',amount:200})]},
      ]}),a('timed',{turns:3,from:'now',trig:'self_after_skill',body:[
        {acts:[a('dmg',{flat:300,type:'固定'})]},
        {cond:[{c:'last_no_dmg',p:{},label:'對手體力未減少'}],acts:[a('dmg',{flat:300,type:'真實'})]},
      ]}),a('prio_turns',{turns:2,v:2,attackOnly:false})]},
    ]}},
  }],
}];
