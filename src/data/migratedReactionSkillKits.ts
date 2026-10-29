import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const c=(name:string,p:Record<string,any>={})=>({c:name,p,label:name});
const hit=(raw:string,body:any[],order:number):KitEntry=>({...sequence(raw,body,order),node:'on_hit',
  params:{clause:{raw,marker:'🎯',trig:'after_hit',parsed:true,body}}});

/** 狀態、反應與回合期限全部在圖紙中，持有者與全文精確匹配。 */
export const MIGRATED_REACTION_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5009'],name:'目瘴淵禁',
  description:'■ 先制+1\n■ 必中\n🎯 4回合內自身免疫並反彈所有異常狀態\n🎯 100%令對手中毒，未觸發或對手處於中毒則2回合內對手攻擊技能無效\n🎯 將對手所處的中毒狀態轉化為感染\n🎯 下3回合自身使用技能吸取對手最大體力⅓，吸取後對手體力未減少則附加雙方300點真實傷害且100%令對手冰封',
  kit:[
    property('■ 先制+1','base_priority',1,0),property('■ 必中','sure_hit',true,1),
    sequence('🎯 4回合內自身免疫並反彈所有異常狀態',[{acts:[a('immune_status_turns',{turns:4,reflect:true,cls:''})]}],2),
    sequence('🎯 100%令對手中毒，未觸發或對手處於中毒則2回合內對手攻擊技能無效',[
      {acts:[a('status',{side:'opp',status:'中毒',chance:100})]},
      {chain:'fail',acts:[a('invalid_turns',{turns:2,kind:'攻擊'})]},
      // 條件使用本次使用事件的快照，不把本句剛附加的中毒當成「原本處於中毒」。
      {cond:[c('has_status',{side:'opp',status:'中毒'})],acts:[a('invalid_turns',{turns:2,kind:'攻擊'})]},
    ],3),
    sequence('🎯 將對手所處的中毒狀態轉化為感染',[{acts:[a('convert_status',{side:'opp',from:'中毒',status:'感染',turns:3})]}],4),
    sequence('🎯 下3回合自身使用技能吸取對手最大體力⅓，吸取後對手體力未減少則附加雙方300點真實傷害且100%令對手冰封',[{acts:[
      a('timed',{turns:3,from:'next',trig:'self_skill',body:[
        {acts:[a('drain',{ratio:1/3,true:false})]},
        {cond:[c('last_no_dmg')],acts:[a('dmg',{flat:300,type:'真實',both:true}),a('status',{side:'opp',status:'冰封',chance:100})]},
      ]}),
    ]}],5),
  ],
},{
  elfIds:['5013'],name:'寒夜未央',
  description:'■ 必中\n🎯 全屬性+1，若對手處於能力下降狀態時強化效果翻倍\n🎯 5回合內每回合自身使用技能吸取對手最大體力的1/3，若自身體力低於1/2則吸取效果翻倍，吸取後對手體力未減少則附加對手300點真實傷害\n🎯 命中後100%令對手衰弱，未觸發則3回合內自身使用技能附加對手250點真實傷害且使用後令對手當回合屬性技能附加效果失效\n🎯 下2回合自身所有技能先制+2',
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 全屬性+1，若對手處於能力下降狀態時強化效果翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('stage',{side:'opp',kind:'down'})})]}],1),
    sequence('🎯 5回合內每回合自身使用技能吸取對手最大體力的1/3，若自身體力低於1/2則吸取效果翻倍，吸取後對手體力未減少則附加對手300點真實傷害',[{acts:[
      a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
        {acts:[a('drain',{ratio:1/3,true:false,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})]},
        {cond:[c('last_no_dmg')],acts:[a('dmg',{flat:300,type:'真實'})]},
      ]}),
    ]}],2),
    hit('🎯 命中後100%令對手衰弱，未觸發則3回合內自身使用技能附加對手250點真實傷害且使用後令對手當回合屬性技能附加效果失效',[
      {acts:[a('status',{side:'opp',status:'衰弱',chance:100})]},
      {chain:'fail',acts:[a('timed',{turns:3,from:'now',trig:'self_after_skill',body:[{acts:[a('dmg',{flat:250,type:'真實'}),a('add_invalid_turns',{turns:1,kind:'屬性'})]}]})]},
    ],3),
    sequence('🎯 下2回合自身所有技能先制+2',[{acts:[a('prio_turns',{turns:2,v:2,attackOnly:false})]}],4),
  ],
},{
  elfIds:['5034'],name:'背隳誓盟',
  description:'🎯 5回合內自身免疫並反彈所有非附屬類異常狀態\r\n🎯 5回合內自身受到非真實傷害100%令對手害怕，受到真實傷害100%令對手詛咒，未觸發則消除對手回合類效果\r\n🎯 下2回合自身造成攻擊傷害提升150%\r\n🎯 4回合內，自身使用技能附加自身特攻與速度總和40%的百分比傷害（傷害值為自身特攻與速度總和×40%），對手體力未減少則令對手受到300點真實傷害',
  kit:[
    sequence('🎯 5回合內自身免疫並反彈所有非附屬類異常狀態',[{acts:[a('immune_status_turns',{turns:5,reflect:true,cls:'非附屬類'})]}],0),
    sequence('🎯 5回合內自身受到非真實傷害100%令對手害怕，受到真實傷害100%令對手詛咒，未觸發則消除對手回合類效果',[{acts:[
      a('timed',{turns:5,from:'now',trig:'damaged_nontrue',body:[
        {acts:[a('status',{side:'opp',status:'害怕',chance:100})]},
        {chain:'fail',acts:[a('clear_turn',{side:'opp'})]},
      ]}),
      a('timed',{turns:5,from:'now',trig:'damaged_true',body:[
        {acts:[a('status',{side:'opp',status:'詛咒',chance:100})]},
        {chain:'fail',acts:[a('clear_turn',{side:'opp'})]},
      ]}),
    ]}],1),
    sequence('🎯 下2回合自身造成攻擊傷害提升150%',[{acts:[a('dmg_mod_turns',{side:'self',dir:'out',kind:'攻擊',boost:1.5,turns:2,next:true})]}],2),
    sequence('🎯 4回合內，自身使用技能附加自身特攻與速度總和40%的百分比傷害（傷害值為自身特攻與速度總和×40%），對手體力未減少則令對手受到300點真實傷害',[{acts:[
      a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,body:[
        {acts:[a('dmg',{base:'stat:特攻和速度',of:'self',ratio:.4,type:'百分比'})]},
        {cond:[c('last_no_dmg')],acts:[a('dmg',{flat:300,type:'真實'})]},
      ]}),
    ]}],3),
  ],
}];
