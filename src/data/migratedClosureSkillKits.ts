import type { KitEntry } from '../effects/effectSystem.schema';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
const hit=(raw:string,body:any[],order:number):KitEntry=>({...sequence(raw,body,order),node:'on_hit',params:{clause:{raw,marker:'🎯',trig:'after_hit',parsed:true,body}}});
export const MIGRATED_CLOSURE_SKILL_KITS:ReviewedSequenceSkill[]=[
  {elfIds:['5006'],name:'星光·魔焰裂空',description:'■ 必中\n🎯 消除對手能力提升狀態，消除成功後恢復400點體力\n🎯 對手處於星火之灼時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍\n🎯 3回合內每次直接攻擊都會使對手防禦和特防-1\n🎯 未擊敗對手則己方下2次攻擊技能必定打出致命一擊\n🎯 2回合對方屬性技能無效',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 消除對手能力提升狀態，消除成功後恢復400點體力',[{acts:[a('stat_clear',{side:'opp',kind:'up'})]},{chain:'success',acts:[a('heal_flat',{amount:400})]}],1),
    sequence('🎯 對手處於星火之灼時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍',[
      {cond:[{c:'has_mark',p:{side:'opp',name:'星火之灼'},label:'對手持有星火之灼'}],acts:[a('boost',{mult:1.75,kind:'攻擊',x2If:{c:'hp_cmp',p:{side:'self',op:'低於'},label:'自身體力低於對手'}})]},
    ],2),
    sequence('🎯 3回合內每次直接攻擊都會使對手防禦和特防-1',[{acts:[a('timed',{turns:3,from:'now',trig:'self_attack',initial:true,body:[{acts:[a('stat',{side:'opp',stats:['防禦','特防'],v:-1})]}]})]}],3),
    hit('🎯 未擊敗對手則己方下2次攻擊技能必定打出致命一擊',[{cond:[{c:'nokill',p:{}}],acts:[a('crit_uses',{uses:2,scope:'team'})]}],4),
    hit('🎯 2回合對方屬性技能無效',[{acts:[a('invalid_turns',{kind:'屬性',turns:2})]}],5),
  ]},
  {elfIds:['5008'],name:'鎖魂曲',description:'■ 必中\n🎯 對手存在護盾、護罩時先制+2\n🎯 消除雙方回合類效果、能力上升、下降狀態、護盾與護罩並附加對手等同於自身速度值50%的百分比傷害\n🎯 4回合內自身免疫所有控制類異常狀態\n🎯 3回合內對手PP值消耗量提升20倍且戰鬥階段結束時受到已損失PP值*10點固定傷害\n🎯 先出手則自身下次死亡時100%重生',kit:[
    property('■ 必中','sure_hit',true,0),
    {codeId:'skill_property',node:'modify_priority',source:'skill',role:'attached',order:1,customText:'🎯 對手存在護盾、護罩時先制+2',params:{property:'conditional_priority',value:2,conditions:[{c:'shield',p:{side:'opp'}}]}},
    sequence('🎯 消除雙方回合類效果、能力上升、下降狀態、護盾與護罩並附加對手等同於自身速度值50%的百分比傷害',[{acts:[
      a('clear_turn',{side:'both'}),a('stat_clear',{side:'both',kind:'all'}),a('clear_shield',{side:'both',kind:'both'}),a('dmg',{base:'stat:速度',of:'self',ratio:.5,type:'百分比'}),
    ]}],2),
    hit('🎯 4回合內自身免疫所有控制類異常狀態',[{acts:[a('immune_status_turns',{turns:4,cls:'控制類',reflect:false})]}],3),
    hit('🎯 3回合內對手PP值消耗量提升20倍且戰鬥階段結束時受到已損失PP值*10點固定傷害',[{acts:[
      a('pp_cost_mult',{turns:3,mult:20,kind:''}),a('timed',{turns:3,from:'now',trig:'phase_end',body:[{acts:[a('pp_lost_damage',{mult:10,type:'固定'})]}]}),
    ]}],4),
    hit('🎯 先出手則自身下次死亡時100%重生',[{cond:[{c:'first',p:{}}],acts:[a('rebirth_once',{})]}],5),
  ]},
];
