import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { sequence, action as a } from './reviewedSequenceSkillKits';

const add=()=>a('resource_mark_add',{side:'self',id:'bahuang_mark',name:'八荒',displayChar:'荒',unit:'層',scope:'elf',persistsOffField:true,description:'最高9層，各層效果依魂印描述結算。',amount:2,maxCount:9});
const lutai=[
  '🎯 全屬性+1，若當前八荒大於3層則效果翻倍',
  '🎯 吸取對手等同於自身八荒層數×139點體力',
  '🎯 附加自身2層八荒',
  '🎯 下2回合自身先制+2',
  '🎯 為自身附加3回合狂暴狀態',
];
const xuanniao=[
  '■ 自身每有1層八荒則當回合額外先制+1',
  '🎯 附加自身2層八荒',
  '🎯 消除對手回合類效果，成功消除時令對手疲憊，未觸發則100%令對手害怕',
  '🎯 1回合內令對手體力恢復量降低100%',
];
/** 原文全文及持有者匹配；層數一律查詢正式個體印記，不借舊魂印計數。 */
export const MIGRATED_LAYER_SKILL_KITS:ReviewedSequenceSkill[]=[
  {elfIds:['5017'],name:'鹿台悲歌',description:lutai.join('\n'),kit:[
    sequence(lutai[0],[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:{c:'mark_count',p:{side:'self',id:'bahuang_mark',op:'高於',amount:3},label:'八荒大於3層'}})]}],0),
    sequence(lutai[1],[{acts:[a('drain',{flat:139,perMark:{side:'self',id:'bahuang_mark'}})]}],1),
    sequence(lutai[2],[{acts:[add()]}],2),
    sequence(lutai[3],[{acts:[a('prio_turns',{v:2,turns:2})]}],3),
    sequence(lutai[4],[{acts:[a('status',{side:'self',status:'狂暴',turns:3,chance:100})]}],4),
  ]},
  {elfIds:['5017'],name:'玄鳥天命',description:xuanniao.join('\n'),kit:[
    {codeId:'skill_property',node:'modify_priority',source:'skill',role:'innate',order:0,customText:xuanniao[0],params:{property:'mark_priority',value:1,conditions:[],perMark:{side:'self',id:'bahuang_mark'}}},
    sequence(xuanniao[1],[{acts:[add()]}],1),
    sequence(xuanniao[2],[{acts:[a('clear_turn',{side:'opp'})]},
      {chain:'success',acts:[a('status',{side:'opp',status:'疲憊',chance:100})]},
      {chain:'fail',acts:[a('status',{side:'opp',status:'害怕',chance:100})]}],2),
    sequence(xuanniao[3],[{acts:[a('recovery_reduce_turns',{side:'opp',ratio:1,turns:1,includePotions:true,next:false})]}],3),
  ]},
];
