import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import type {KitEntry} from '../effects/effectSystem.schema';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const first='🎯 先出手時對手當回合屬性技能無效';
const pp='🎯 命中後使對手隨機的1個技能的PP值歸零';
const fear='🎯 命中後100%使對手害怕，未觸發則使自身進入狂暴狀態';
const damage='🎯 附加自身攻擊值30%的百分比傷害並恢復等量體力，若對手免疫百分比傷害，則附加等量真實傷害';
const hit=(raw:string,body:any[],order:number):KitEntry=>({...sequence(raw,body,order),node:'on_hit',params:{clause:{raw,marker:'🎯',trig:'after_hit',parsed:true,body}}});
export const MIGRATED_IMMUNITY_FALLBACK_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5015'],name:'蒼茫幽魂舞',description:['■ 先制+1',first,pp,fear,damage].join('\n'),
  kit:[
    property('■ 先制+1','base_priority',1,0),
    sequence(first,[{cond:[{c:'first',p:{},label:'本次先出手'}],acts:[a('invalid_turns',{kind:'屬性',turns:1,next:false})]}],1),
    hit(pp,[{acts:[a('pp_zero_random',{count:1})]}],2),
    hit(fear,[{acts:[a('status',{side:'opp',status:'害怕',chance:100})]},{chain:'fail',acts:[a('status',{side:'self',status:'狂暴',chance:100})]}],3),
    sequence(damage,[
      {acts:[a('dmg',{base:'stat:攻擊',of:'self',ratio:.3,type:'百分比'})]},
      {cond:[{c:'last_damage_immune',p:{},label:'前次百分比傷害被受方免疫'}],
        acts:[a('dmg_from_last',{basis:'requested_damage',ratio:1,type:'真實'})],elseActs:[a('heal_equal',{})]},
    ],4),
  ],
}];
