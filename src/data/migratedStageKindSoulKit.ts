import type {KitEntry,Node} from '../effects/effectSystem.schema';
import {action as a} from './reviewedSequenceSkillKits';
const e=(node:Node,trig:string,raw:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
const hp=(ratio:number)=>({c:'hp_ratio',p:{side:'self',op:'低於',ratio},label:`自身體力低於${ratio*100}%`});
/** 模式攔截由 destinyInterceptors 處理；完整描述保留，不在一般對戰重播模式效果。 */
export const MIGRATED_STAGE_KIND_SOUL_KIT={
  kind:'soul' as const,elfIds:['5003'],name:'淨',
  description:'自身受到攻擊時：\n> 消除對手能力提升狀態\n自身體力高於1/2時：\n> 受到攻擊傷害減少25%\n自身體力低於1/2時：\n> 受到攻擊傷害減少50%\n回合結束時自身體力低於1/4：\n> 恢復自身最大體力1/3\n> 令對手全屬性-1\n自身被擊敗時：\n> 令對手體力上限減少40%\n> 2回合內對手無法恢復體力\n> 對手每處於1種能力下降狀態則額外減少10%且回合數+1\n\n【命運之輪 C 級專屬攔截：時空枷鎖】\n登場首回合：\n> 清除對手所有技能2點PP值與其上限',
  kit:[
    e('before_damage','incoming_attack','自身受到攻擊時消除對手能力提升狀態',[{acts:[a('stat_clear',{side:'opp',kind:'up'})]}],0),
    e('before_damage','incoming_attack','自身體力高於1/2時受到攻擊傷害減少25%',[{cond:[{c:'hp_ratio',p:{side:'self',op:'高於',ratio:.5},label:'自身體力高於1/2'}],acts:[a('dmg_mod',{dir:'in',kind:'攻擊',reduce:.25})]}],1),
    e('before_damage','incoming_attack','自身體力低於1/2時受到攻擊傷害減少50%',[{cond:[hp(.5)],acts:[a('dmg_mod',{dir:'in',kind:'攻擊',reduce:.5})]}],2),
    e('round_end','round_end','回合結束時自身體力低於1/4，恢復最大體力1/3並令對手全屬性-1',[{cond:[{c:'hp_value',p:{side:'self',op:'高於',amount:0},label:'自身仍存活'},hp(.25)],acts:[a('heal',{side:'self',ratio:1/3}),a('stat',{side:'opp',stats:['全屬性'],v:-1})]}],3),
    e('cthyaat_death','defeated','被擊敗時減少對手體力上限40%、禁療2回合，每種能力下降額外減少10%且禁療+1回合',[{acts:[
      a('maxhp',{side:'opp',ratio:.4,direction:'decrease',perStageKinds:{side:'opp',kind:'down',amount:.1}}),
      a('no_heal',{turns:2,perStageKinds:{side:'opp',kind:'down',amount:1}}),
    ]}],4),
  ],
};
