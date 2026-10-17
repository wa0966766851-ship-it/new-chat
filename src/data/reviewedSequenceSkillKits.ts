import type { KitEntry } from '../effects/effectSystem.schema';
import type { Clause, Stmt } from '../blocks/model';

/** 第二批明確定義。原文完整相同才套入；不在載入時解析、借用原主handler或批量相信候選。 */
export interface ReviewedSequenceSkill {elfIds:string[];name:string;description:string;kit:KitEntry[]}
export const property=(text:string,property:'sure_hit'|'base_priority'|'base_accuracy'|'base_power'|'hit_requirement'|'forced_first',value:boolean|number,order:number):KitEntry=>({
  codeId:'skill_property',node:['base_priority','forced_first'].includes(property)?'modify_priority':'before_skill',source:'skill',role:'innate',order,customText:text,params:{property,value,conditions:[]},
});
export const action=(op:string,p:Record<string,any>)=>({op,p,label:op});
export const sequence=(raw:string,body:Stmt[],order:number):KitEntry=>({codeId:'effect_sequence',node:'on_skill_use',source:'skill',role:'attached',order,customText:raw,
  params:{clause:{raw,marker:'🎯',trig:'use',parsed:true,body} satisfies Clause}});

export const REVIEWED_SEQUENCE_SKILL_KITS:ReviewedSequenceSkill[]=[
  {elfIds:['5005'],name:'夜魔之球',description:'■ 先制+1\n🎯 附加對手當前體力15%的百分比傷害',kit:[
    property('■ 先制+1','base_priority',1,0),sequence('🎯 附加對手當前體力15%的百分比傷害',[{acts:[action('dmg',{base:'當前體力',of:'opp',ratio:0.15,type:'百分比'})]}],1),
  ]},
  {elfIds:['5005'],name:'幽冥頓悟',description:'■ 必中\n🎯 自身全屬性+1\n🎯 恢復自身1/3最大體力',kit:[
    property('■ 必中','sure_hit',true,0),sequence('🎯 自身全屬性+1',[{acts:[action('stat',{side:'self',stats:['全屬性'],v:1})]}],1),
    sequence('🎯 恢復自身1/3最大體力',[{acts:[action('heal',{side:'self',ratio:1/3})]}],2),
  ]},
  {elfIds:['5020'],name:'電光火石',description:'■ 先制+1',kit:[property('■ 先制+1','base_priority',1,0)]},
  {elfIds:['300','5000'],name:'生命',description:'■ 必中\n🎯 5回合內每回合使用技能後恢復100點固定體力值',kit:[
    property('■ 必中','sure_hit',true,0),{codeId:'effect_sequence',node:'on_hit',source:'skill',role:'attached',order:1,customText:'🎯 5回合內每回合使用技能後恢復100點固定體力值',
      params:{clause:{raw:'🎯 5回合內每回合使用技能後恢復100點固定體力值',marker:'🎯',trig:'after_hit',parsed:true,body:[{acts:[action('timed',{turns:5,from:'now',trig:'self_after_use',body:[{acts:[action('heal_flat',{amount:100})]}]})]}]}}},
  ]},
  {elfIds:['300','5000'],name:'輪迴',description:'■ 必中\n🎯 恢復自身最大體力的1/1',kit:[
    property('■ 必中','sure_hit',true,0),sequence('🎯 恢復自身最大體力的1/1',[{acts:[action('heal',{side:'self',ratio:1})]}],1),
  ]},
];
