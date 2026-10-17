import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=['■ 必中','■ 英雄之耀達到 3 層時，本技能不受 PP 值限制；選擇使用時消除自身回合類效果','🎯 全屬性 +1；自身當前體力高於最大體力一半時，強化效果翻倍','🎯 4 回合內免疫並反彈所有受到的異常狀態','🎯 下 2 回合自身所有技能先制 +2'];
const conditions=[{c:'mark_count',p:{side:'self',id:'arena.heroGlory',op:'不低於',amount:3},label:'英雄之耀達到3層'}];
export const MIGRATED_SELECTION_SKILL_KITS:ReviewedSequenceSkill[]=[{elfIds:['arena_14'],name:'烈武天徵',description:raw.join('\n'),kit:[
  property(raw[0],'sure_hit',true,0),
  {codeId:'skill_property',node:'on_skill_selected',source:'skill',role:'innate',order:1,customText:raw[1],params:{property:'ignore_pp_limit',value:true,conditions}},
  {codeId:'effect_sequence',node:'on_skill_selected',source:'skill',role:'innate',order:2,customText:raw[1],params:{clause:{raw:raw[1],marker:'■',trig:'skill_selected',parsed:true,body:[{cond:conditions,acts:[a('clear_turn',{side:'self'})]}]}}},
  sequence(raw[2],[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:{c:'hp_ratio',p:{side:'self',op:'高於',ratio:.5},label:'當前體力高於一半'}})]}],3),
  sequence(raw[3],[{acts:[a('immune_status_turns',{turns:4,reflect:true})]}],4),
  sequence(raw[4],[{acts:[a('prio_turns',{turns:2,v:2})]}],5),
]}];
