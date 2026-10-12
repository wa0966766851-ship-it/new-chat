import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
const c=(name:string,p:any)=>({c:name,p,label:name});
const entry=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
const soulPain={id:'blk_魂殤',name:'魂殤',displayChar:'殤',description:'上限4道；回合結束每道令持有者體力調整減少最大體力25%；下場消失。',side:'opp',mode:'add',count:1,maxCount:4,scope:'elf',persistsOffField:false,unit:'道',rules:[{raw:'每道令持有者體力調整減少最大體力25%',trig:'round_end',parsed:true,body:[{acts:[a('hp_adjust',{side:'self',base:'最大體力',ratio:.25,direction:'subtract',perStack:true})]}]}]};
/** 完整原文；抵擋計數未寫消耗／重置，故明確保留。異常轉化沿用被施加的期限。 */
export const BAPHOMET_SOUL_KIT={kind:'soul' as const,elfIds:['5008'],name:'鎮',description:'若自身存活於出戰背包內或在場：\n> 每回合開始時為敵方在場精靈附加1道魂殤\n魂殤：\n> 持有者回合結束時，每有1道令自身體力調整減少最大體力25%\n> 上限4道，下場後消失\n雙方任一方受到混亂異常、窒息異常時：\n> 直到上述異常結束前自身抵擋受到的技能傷害\n> 自身受到異常時立即轉化為混亂\n登場時：\n> 為對手附加3回合窒息\n> 為自身附加3回合混亂\n> 任一項未觸發則對手3回合內造成固定傷害、百分比傷害減少40%\n使用攻擊技能時：\n> 若自身處於異常狀態，附加對手等同於自身通過專屬特性抵擋的傷害100%的真實傷害\n> 若自身不處於異常狀態，自身下回合所有技能先制+1',kit:[
  entry('round_start','team_round_start','存活於背包內或在場，每回合開始為敵方在場精靈附加1道魂殤',[{acts:[a('mark_program',soulPain)]}],0),
  ...['混亂','窒息'].map((status,i)=>entry('before_damage','incoming_skill',`雙方任一方處於${status}時抵擋受到的技能傷害`,[{cond:[c('has_status',{side:'both',status})],acts:[a('block_damage',{kind:'技能',key:'soul-guarded-damage'})]}],i+1)),
  ...['混亂','窒息'].map((status,i)=>entry('before_status_apply','before_status',`雙方任一方處於${status}時，自身受到異常立即轉化為混亂`,[{cond:[c('has_status',{side:'both',status})],acts:[a('status_replace',{status:'混亂',durationMode:'keep'})]}],i+3)),
  entry('before_status_apply','before_status','本次混亂／窒息附加自身時亦立即轉為混亂',[{cond:[c('event_status',{statuses:['混亂','窒息']})],acts:[a('status_replace',{status:'混亂',durationMode:'keep'})]}],5),
  entry('on_entered','entrance','登場時為對手附加3回合窒息，為自身附加3回合混亂；任一未觸發則對手3回合造成固定／百分比傷害減少40%',[
    {acts:[a('status',{side:'opp',status:'窒息',turns:3,chance:100})]}, {acts:[a('status',{side:'self',status:'混亂',turns:3,chance:100})]},
    {chain:'any_fail',acts:[a('dmg_mod_turns',{side:'opp',dir:'out_reduce',kind:'固定',reduce:.4,turns:3}),a('dmg_mod_turns',{side:'opp',dir:'out_reduce',kind:'百分比',reduce:.4,turns:3})]},
  ],6),
  entry('on_skill_use','self_attack','自身有異常時，附加通過專屬特性累計抵擋量100%的真實傷害',[{cond:[c('abnormal',{side:'self'})],acts:[a('damage_from_counter',{key:'soul-guarded-damage',ratio:1,type:'真實',consume:false})]}],7),
  entry('on_skill_use','self_attack','自身沒有異常時，下回合所有技能先制+1',[{cond:[c('abnormal',{side:'self',neg:true})],acts:[a('prio_turns',{turns:1,v:1})]}],8),
]};
