import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=['■ 必中','■ 英雄之耀達到 3 層時，本技能不受 PP 值限制；選擇使用時解除自身異常狀態','🎯 消除對手回合類效果，成功時恢復自身全部體力','🎯 出手時若自身體力低於對手，抵擋下一次受到的攻擊傷害；自身體力高於對手時令對手受到 3 回合【威怯】','🎯 恢復自身全部 PP，每恢復 1 點吸取對手 40 點體力'];
const conditions=[{c:'mark_count',p:{side:'self',id:'arena.heroGlory',op:'不低於',amount:3},label:'英雄之耀達到3層'}];
const hp=(op:string)=>[{c:'hp_cmp',p:{side:'self',op},label:'出手時比較雙方體力'}];
const mark={id:'arena.weiyue',name:'威怯',side:'opp',mode:'set',count:1,maxCount:1,scope:'elf',persistsOffField:true,turns:3,displayChar:'怯',unit:'層',description:'3回合內持有者造成的非真實傷害額外減少60%',rules:[{raw:'造成的非真實傷害減少60%',trig:'outgoing',parsed:true,body:[{acts:[a('dmg_mod',{dir:'out_reduce',kind:'非真實',reduce:.6})]}]}]};
export const MIGRATED_RESTORED_PP_SKILL_KITS:ReviewedSequenceSkill[]=[{elfIds:['arena_14'],name:'亂武天傀',description:raw.join('\n'),kit:[
 property(raw[0],'sure_hit',true,0),
 {codeId:'skill_property',node:'on_skill_selected',source:'skill',role:'innate',order:1,customText:raw[1],params:{property:'ignore_pp_limit',value:true,conditions}},
 {codeId:'effect_sequence',node:'on_skill_selected',source:'skill',role:'innate',order:2,customText:raw[1],params:{clause:{raw:raw[1],trig:'skill_selected',parsed:true,body:[{cond:conditions,acts:[a('cure_status',{side:'self',cls:''})]}]}}},
 // 同一子流程在任何動作前快照「出手時」比較；清回合後的補滿血不改變已選分支。
 sequence(raw[2]+'\n'+raw[3],[
  {acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('heal',{side:'self',ratio:1})]},
  {pre:true,cond:hp('低於'),acts:[a('block_damage_uses',{uses:1,kind:'攻擊',key:'next_attack_guard'})]},
  {pre:true,cond:hp('高於'),acts:[a('mark_program',mark)]},
 ],3),
 sequence(raw[4],[{acts:[a('pp_op',{side:'self',mode:'recover',captureRestored:true}),a('drain_from_last',{ratio:40,type:'固定'})]}],4),
]}];
