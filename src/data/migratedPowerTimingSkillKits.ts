import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const c = (name:string,p:any) => ({ c:name,p,label:name });
const innate = (raw:string,acts:any[],order:number):KitEntry => ({...sequence(raw,[{acts}],order),role:'innate'});
/** 全文精確匹配；跨技能監控使用通用事件，沒有借用原專屬處理函式。 */
export const MIGRATED_POWER_TIMING_SKILL_KITS:ReviewedSequenceSkill[] = [{
  elfIds:['5009'],name:'狻猊噬',description:'■ 先制+3\n■ 必中\n🎯 消除對手回合類效果，消除成功則恢復對手全部體力\n🎯 對手體力每有1%，則自身攻擊技能威力提升2%\n🎯 自身體力未滿則吸取對手最大體力⅓\n🎯 自身體力未滿則令對手感染',kit:[
    property('■ 先制+3','base_priority',3,0),property('■ 必中','sure_hit',true,1),
    sequence('🎯 消除對手回合類效果，消除成功則恢復對手全部體力',[{acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('heal',{side:'opp',ratio:1})]}],2),
    sequence('🎯 對手體力每有1%，則自身攻擊技能威力提升2%',[{acts:[a('power_per_hp',{side:'opp',unit:.01,boost:.02})]}],3),
    sequence('🎯 自身體力未滿則吸取對手最大體力⅓',[{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:1})],acts:[a('drain',{ratio:1/3,true:false})]}],4),
    sequence('🎯 自身體力未滿則令對手感染',[{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:1})],acts:[a('status',{side:'opp',status:'感染',chance:100})]}],5),
  ],
},{
  elfIds:['5001'],name:'幽冥噬魂',description:'■ 必中\n🎯 5回合內免疫並反彈所有異常狀態\n🎯 3回合內自身使用技能則100%令對手害怕\n🎯 3回合內對手使用攻擊技能時100%令對手束縛\n🎯 3回合內自身使用攻擊技能時若攻擊技能無效則消除對手回合類效果',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 5回合內免疫並反彈所有異常狀態',[{acts:[a('immune_status_turns',{turns:5,reflect:true})]}],1),
    sequence('🎯 3回合內自身使用技能則100%令對手害怕',[{acts:[a('timed',{turns:3,from:'now',trig:'self_skill',initial:true,body:[{acts:[a('status',{side:'opp',status:'害怕',chance:100})]}]})]}],2),
    sequence('🎯 3回合內對手使用攻擊技能時100%令對手束縛',[{acts:[a('timed',{turns:3,from:'now',trig:'opp_attack',body:[{acts:[a('status',{side:'opp',status:'束縛',chance:100})]}]})]}],3),
    sequence('🎯 3回合內自身使用攻擊技能時若攻擊技能無效則消除對手回合類效果',[{acts:[a('timed',{turns:3,from:'now',trig:'self_invalid',body:[{cond:[c('skill_kind',{kind:'攻擊'}),c('skill_invalid',{})],acts:[a('clear_turn',{side:'opp'})]}]})]}],4),
  ],
},{
  elfIds:['arena_13'],name:'敕赦千銘',description:'■ 先制 +3\n■ 無視攻擊技能免疫效果，但不能無視攻擊技能無效\n🎯 消除對手回合類效果，消除成功時 100% 令對手【臣服】\n> 未觸發時，本次攻擊傷害翻倍\n🎯 2 回合內，每回合結束降低對手所有技能 1 點 PP，並恢復自身所有技能 1 點 PP\n🎯 2 回合內自身造成的固定傷害、百分比傷害提升 30%',kit:[
    property('■ 先制 +3','base_priority',3,0),innate('■ 無視攻擊技能免疫效果，但不能無視攻擊技能無效',[a('ignore',{what:'攻擊免疫'})],1),
    sequence('🎯 消除對手回合類效果，消除成功時 100% 令對手【臣服】\n> 未觸發時，本次攻擊傷害翻倍',[{acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('status',{side:'opp',status:'臣服',chance:100})]},{chain:'any_fail',acts:[a('boost',{mult:2,kind:'攻擊',power:false})]}],2),
    sequence('🎯 2 回合內，每回合結束降低對手所有技能 1 點 PP，並恢復自身所有技能 1 點 PP',[{acts:[a('timed',{turns:2,from:'now',trig:'round_end',body:[{acts:[a('pp_op',{side:'opp',mode:'reduce',amount:1}),a('pp_op',{side:'self',mode:'add',amount:1})]}]})]}],3),
    sequence('🎯 2 回合內自身造成的固定傷害、百分比傷害提升 30%',[{acts:[a('dmg_mod_turns',{side:'self',dir:'out',kind:'固定',boost:.3,turns:2}),a('dmg_mod_turns',{side:'self',dir:'out',kind:'百分比',boost:.3,turns:2})]}],4),
  ],
}];
