import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { Stmt } from '../blocks/model';
import type { KitEntry } from '../effects/effectSystem.schema';
const hit=(raw:string,body:Stmt[],order:number):KitEntry=>({codeId:'effect_sequence',node:'on_hit',source:'skill',role:'attached',order,customText:raw,
  params:{clause:{raw,marker:'🎯',trig:'after_hit',parsed:true,body}}});

/** 原文與持有者精確匹配；成敗、低血快照與百分比吸取全部保留在可編輯資料中。 */
export const MIGRATED_GAP_SKILL_KITS: ReviewedSequenceSkill[] = [
  {elfIds:['5012'],name:'霜凍之錮',description:'必中；4回合內免疫並反彈所有受到的異常狀態；命中則80%使對手冰封，未觸發則吸取對手能力提升狀態；4回合內每回合吸取對手最大體力的1/3，自身體力低於最大體力的1/2時轉變為吸取對手最大體力的1/2',kit:[
    property('必中','sure_hit',true,0),
    sequence('4回合內免疫並反彈所有受到的異常狀態',[{acts:[a('immune_status_turns',{turns:4,reflect:true,cls:''})]}],1),
    hit('命中則80%使對手冰封，未觸發則吸取對手能力提升狀態',[
      {acts:[a('status',{side:'opp',status:'冰封',chance:80})]},
      {chain:'fail',acts:[a('stat_steal',{mode:'吸取',double:false,reverse:false})]},
    ],2),
    // 原句只有異常分支限定命中；每回合吸取獨立從使用當回合開始。
    sequence('4回合內每回合吸取對手最大體力的1/3，自身體力低於最大體力的1/2時轉變為吸取對手最大體力的1/2',[
      {acts:[a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,body:[{
        cond:[{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'本回合吸取前自身體力低於一半'}],
        acts:[a('drain',{ratio:.5,true:false})],elseActs:[a('drain',{ratio:1/3,true:false})],
      }]})]},
    ],3),
  ]},
  {elfIds:['5028'],name:'弱水三千',description:'■ 先制+3\n■ 必中\n🎯 吸取並反轉對手能力提升狀態\n🎯 令對手全屬性-1，未觸發則令對手冰封\n🎯 附加等同於對方最大體力值40%百分比傷害並恢復自身體力，自身體力低於最大體力1/2時效果翻倍\n🎯 3回合內對手屬性技能無效',kit:[
    property('■ 先制+3','base_priority',3,0),property('■ 必中','sure_hit',true,1),
    sequence('🎯 吸取並反轉對手能力提升狀態',[{acts:[a('stat_steal',{mode:'吸取',double:false,reverse:true})]}],2),
    sequence('🎯 令對手全屬性-1，未觸發則令對手冰封',[
      {acts:[a('stat',{side:'opp',stats:['全屬性'],v:-1})]},
      {chain:'fail',acts:[a('status',{side:'opp',status:'冰封',chance:100})]},
    ],3),
    sequence('🎯 附加等同於對方最大體力值40%百分比傷害並恢復自身體力，自身體力低於最大體力1/2時效果翻倍',[
      {acts:[a('drain',{ratio:.4,true:false,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'使用前自身體力低於1/2'}})]},
    ],4),
    sequence('🎯 3回合內對手屬性技能無效',[{acts:[a('invalid_turns',{turns:3,kind:'屬性'})]}],5),
  ]},
];
