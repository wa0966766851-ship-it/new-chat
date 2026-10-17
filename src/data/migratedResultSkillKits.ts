import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const c=(name:string,p:Record<string,any>={})=>({c:name,p,label:name});
const after=(raw:string,body:any[],order:number):KitEntry=>({...sequence(raw,body,order),node:'after_action',
  params:{clause:{raw,marker:'🎯',trig:'self_after_skill',parsed:true,body}}});
export const MIGRATED_RESULT_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['arena_15'],name:'恆·蒼穹斗轉',
  description:'■ 必中\n🎯 消除對手回合類效果；消除成功時，100% 令對手進入【沉默】\n🎯 造成的攻擊傷害高於 300 時，免疫下一次受到的異常狀態；低於 300 時，下 2 回合自身攻擊必定造成致命一擊\n🎯 附加自身最大體力 25% 的百分比傷害；若對手免疫百分比傷害，則轉為真實傷害',
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 消除對手回合類效果；消除成功時，100% 令對手進入【沉默】',[
      {acts:[a('clear_turn',{side:'opp'})]},
      {chain:'success',acts:[a('status',{side:'opp',status:'沉默',chance:100})]},
    ],1),
    after('🎯 造成的攻擊傷害高於 300 時，免疫下一次受到的異常狀態；低於 300 時，下 2 回合自身攻擊必定造成致命一擊',[
      {cond:[c('dmg_cmp',{op:'高於',v:300})],acts:[a('immune_status_count',{count:1,reflect:false})]},
      {cond:[c('dmg_cmp',{op:'低於',v:300})],acts:[a('crit_turns',{turns:2,next:true})]},
    ],2),
    after('🎯 附加自身最大體力 25% 的百分比傷害；若對手免疫百分比傷害，則轉為真實傷害',[
      {acts:[a('dmg',{base:'最大體力',of:'self',ratio:.25,type:'百分比'})]},
      // 使用同一次名目量快照；上限0、抵擋與造成者歸零不是受方免疫。
      {cond:[c('last_damage_immune')],acts:[a('dmg_from_last',{basis:'requested_damage',ratio:1,type:'真實'})]},
    ],3),
  ],
}];
