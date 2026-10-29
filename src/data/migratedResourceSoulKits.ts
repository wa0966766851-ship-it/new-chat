import type {KitEntry,Node} from '../effects/effectSystem.schema';
import {action as a} from './reviewedSequenceSkillKits';
const e=(node:Node,trig:string,raw:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
const c=(name:string,p:any)=>({c:name,p,label:name});
const resource={id:'demon_grudge',name:'魔王咒怨',side:'self',scope:'elf',displayChar:'怨',unit:'層',persistsOffField:true,
  description:'每層攻擊增傷／減傷5%，每層3%攻擊保底；5層免疫控制；秒殺擴展同體力目標',incomingDamageReduction:{kind:'攻擊',ratio:.05,perStack:true}};
const add=(amount:number)=>a('resource_mark_add',{...resource,amount});
const full=c('hp_full',{side:'self'});
const layers=(amount:number)=>c('mark_count',{side:'self',id:'demon_grudge',op:'不低於',amount});
/** 能力值以明確六項表達；不把35點換成等級，也不在提高體力上限時白送HP。 */
export const MIGRATED_RESOURCE_SOUL_KITS=[{
  kind:'soul' as const,elfIds:['5024'],name:'咤',
  description:'戰鬥開始時：\n> 獲得1層魔王咒怨\n> 敵我雙方出戰背包內每有1個擁有瞬殺特性的精靈自身額外獲得1層魔王咒怨\n自身位於出戰背包時：\n> 對方的秒殺效果失效改為使自身獲得1層魔王咒怨\n對手使用技能時：\n> 若自身為滿體力則消除對手回合類效果與能力提升狀態\n> 若自身不為滿體力則獲得等同於已損失體力值50%的護盾、護罩\n> 當回合戰鬥階段結束時自身恢復回合開始時自身所擁有護盾、護罩之和的體力\n自身擊敗對手時：\n> 自身所有能力值提升35點\n> 獲得2層魔王咒怨\n自身被擊敗時：\n> 令對手的體力上限減少35%\n魔王咒怨：\n> 自身觸發秒殺時，額外選擇對方所有體力與原本秒殺目標相等的精靈為目標\n> 達到5層時自身免疫控制類異常狀態\n> 每有1層受到的攻擊傷害減少5%\n> 每有1層造成的攻擊傷害提升5%\n> 每有1層自身攻擊有3%的機率造成的傷害不低於對手的最大體力值',
  kit:[
    e('battle_start','battle_start','戰鬥開始獲得1層，雙方背包每個瞬殺精靈額外1層',[{acts:[add(1),a('count_team_trait',{side:'both',name:'瞬殺',state:'any'}),a('resource_mark_add',{...resource,ratio:1})]}],0),
    e('round_start','round_start','記錄回合開始時自身護盾與護罩之和',[{acts:[a('snapshot_value',{side:'self',key:'defense_resources',fields:['shield','barrier']})]}],1),
    e('on_attacked','opp_skill','對手使用技能時滿體力消除回合類效果與能力提升；未滿獲得損失體力50%雙盾；當回合階段末恢復回合初雙盾和',[
      {cond:[full],acts:[a('clear_turn',{side:'opp'}),a('stat_clear',{side:'opp',kind:'up'})],elseActs:[a('shield',{base:'已損失體力',ratio:.5,kind:'shield'}),a('shield',{base:'已損失體力',ratio:.5,kind:'barrier'})]},
      {acts:[a('timed',{turns:1,from:'now',trig:'phase_end',once:true,label:'回合初雙盾恢復',body:[{acts:[a('heal_snapshot',{key:'defense_resources',ratio:1,consume:true})]}]})]},
    ],2),
    e('before_instant_kill','before_instant_kill','位於出戰背包時令對方秒殺失效，成功後自身獲得1層魔王咒怨',[
      {acts:[a('prevent_instant_kill',{dir:'in',scope:'team'})]},{chain:'success',acts:[add(1)]},
    ],3),
    e('before_instant_kill','before_instant_kill','自身觸發秒殺時額外選取對方所有與原目標體力相等的精靈',[
      {cond:[layers(1)],acts:[a('instant_kill_same_hp_targets',{})]},
    ],4),
    e('before_status_apply','before_status','魔王咒怨達到5層時免疫控制類異常狀態',[{cond:[layers(5)],acts:[a('status_guard',{cls:'控制類'})]}],5),
    e('before_damage','outgoing_attack','每層造成攻擊傷害提升5%，每層3%機率攻擊傷害不低於對手最大體力',[
      {acts:[a('dmg_mod',{dir:'out',kind:'攻擊',boost:.05,perMark:{side:'self',id:'demon_grudge'}})]},
      {cond:[c('mark_chance',{side:'self',id:'demon_grudge',pct:3})],acts:[a('damage_floor',{side:'opp',base:'最大體力',ratio:1})]},
    ],6),
    e('on_kill','kill','擊敗對手時自身所有能力值提升35點並獲得2層魔王咒怨',[{acts:[a('stat_value',{side:'self',stats:['hp','atk','def','spatk','spdef','speed'],amount:35,direction:'increase',floor:1}),add(2)]}],7),
    e('cthyaat_death','defeated','自身被擊敗時令對手體力上限減少35%',[{acts:[a('maxhp',{side:'opp',ratio:.35,direction:'decrease'})]}],8),
  ],
}];
