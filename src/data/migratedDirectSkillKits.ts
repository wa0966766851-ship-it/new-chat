import type { KitEntry } from '../effects/effectSystem.schema';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
const event=(node:KitEntry['node'],trig:string,raw:string,body:any[],order=0):KitEntry=>({
  codeId:'effect_sequence',node,source:'skill',role:'attached',order,customText:raw,
  params:{clause:{raw,trig,parsed:true,body}},
});
/** 原文全句保留；以通用數值及事件資料遷移，不使用專屬handler。 */
export const MIGRATED_DIRECT_SKILL_KITS:ReviewedSequenceSkill[]=[
  ...[['捨身撞擊',1/4,'對方所受傷害的1/4會反彈給自己。'],['星光·捨身撞擊',1/2,'對方所受傷害的1/2會反彈給自己。']].map(([name,ratio,text])=>({
    elfIds:['5011'],name:String(name),description:String(text),kit:[event('after_action','self_after_attack',String(text),[{acts:[a('recoil',{ratio})]}])],
  })),
  {elfIds:['300','5000'],name:'聖潔',description:'■ 必中\n🎯 5回合內屬性技能對自身必定MISS',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 5回合內屬性技能對自身必定MISS',[{acts:[a('incoming_utility_invalid_turns',{turns:5})]}],1),
  ]},
  {elfIds:['5020'],name:'手下留情',description:'🎯 自身造成技能傷害大於對方體力時，對方會餘下1體力',kit:[
    sequence('🎯 自身造成技能傷害大於對方體力時，對方會餘下1體力',[{acts:[a('mercy',{})]}],0),
  ]},
  {elfIds:['arena_13'],name:'法咒共鳴斬',description:'■ 無視傷害限制效果\n■ 無視攻擊技能免疫效果，但不能無視攻擊技能無效',kit:[
    {...sequence('■ 無視傷害限制效果',[{acts:[a('ignore',{what:'傷害限制'})]}],0),role:'innate'},
    {...sequence('■ 無視攻擊技能免疫效果，但不能無視攻擊技能無效',[{acts:[a('ignore',{what:'攻擊免疫'})]}],1),role:'innate'},
  ]},
  {elfIds:['5006'],name:'星光·壓迫',description:'命中後3回合內每回合使對手攻擊-2、特攻-2、速度-2、命中-2，若未觸發則減少對手最大體力的1/3。',kit:[
    event('on_hit','after_hit','命中後3回合內每回合使對手攻擊-2、特攻-2、速度-2、命中-2，若未觸發則減少對手最大體力的1/3。',[
      {acts:[a('timed',{turns:3,from:'now',trig:'self_skill',initial:true,body:[
        {acts:[a('stat',{side:'opp',stats:['攻擊','特攻','速度','命中'],v:-2})]},
        {chain:'fail',acts:[a('dmg',{base:'最大體力',of:'opp',ratio:1/3,type:'百分比'})]},
      ]})]},
    ]),
  ]},
];
