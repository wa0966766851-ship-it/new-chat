import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const c=(name:string,p:any)=>({c:name,p,label:name});
export const MIGRATED_NIGHT_SKILL_KITS:ReviewedSequenceSkill[]=[{
 elfIds:['5015'],name:'夜·冥昭瞢闇',description:'■ 必中\n■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）\n🎯 消除對手回合類效果，消除成功則自身無效對方下1次攻擊技能\n🎯 造成的傷害低於300則附加自身攻擊力與最大體力總和25%的百分比傷害，自身處於狂暴狀態則改為附加真實傷害\n🎯 造成的傷害高於300則對手100%詛咒\n🎯 擊敗對手則下回合開始使自身進入3回合狂暴狀態',kit:[
  property('■ 必中','sure_hit',true,0),
  {...sequence('■ 攻擊傷害不出現微弱',[{acts:[a('no_resist',{})]}],1),role:'innate'},
  sequence('消除對手回合類效果，消除成功則無效對方下1次攻擊技能',[
   {acts:[a('clear_turn',{side:'opp'})]},
   {chain:'success',acts:[a('invalid_next',{uses:1,kind:'攻擊'})]},
  ],2),
  {codeId:'effect_sequence',node:'on_hit',source:'skill',role:'attached',order:3,customText:'造成的傷害低於300則附加自身攻擊力與最大體力總和25%的傷害，高於300則詛咒',params:{clause:{raw:'造成的傷害低於300則附加自身攻擊力與最大體力總和25%的傷害，高於300則詛咒',trig:'after_hit',parsed:true,body:[
   {cond:[c('dmg_cmp',{op:'低於',v:300}),c('has_status',{side:'self',status:'狂暴',neg:true})],acts:[a('dmg_sum',{terms:[{base:'stat:攻擊',of:'self',ratio:.25},{base:'最大體力',of:'self',ratio:.25}],type:'百分比'})]},
   {cond:[c('dmg_cmp',{op:'低於',v:300}),c('has_status',{side:'self',status:'狂暴'})],acts:[a('dmg_sum',{terms:[{base:'stat:攻擊',of:'self',ratio:.25},{base:'最大體力',of:'self',ratio:.25}],type:'真實'})]},
   {cond:[c('dmg_cmp',{op:'高於',v:300})],acts:[a('status',{side:'opp',status:'詛咒',turns:3,chance:100})]},
  ]}}},
  {codeId:'effect_sequence',node:'on_kill',source:'skill',role:'attached',order:4,customText:'擊敗對手則下回合開始進入3回合狂暴',params:{clause:{raw:'擊敗對手則下回合開始進入3回合狂暴',trig:'kill',parsed:true,body:[{acts:[a('timed',{turns:1,from:'next',trig:'round_start',once:true,body:[{acts:[a('status',{side:'self',status:'狂暴',turns:3,chance:100})]}]})]}]}}},
 ],
}];
