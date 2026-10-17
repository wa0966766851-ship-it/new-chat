import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=['■ 先制 +3','■ 英雄之耀達到 3 層時，本技能不受 PP 值限制且額外先制 +1','🎯 消除對手回合類效果，成功時令對手下 2 回合先制 −2','🎯 消除對手能力提升，每消除 1 級附加 40 點固定傷害','🎯 反轉自身能力下降，成功時令對手下一次使用的攻擊技能無效'];
const conditions=[{c:'mark_count',p:{side:'self',id:'arena.heroGlory',op:'不低於',amount:3},label:'英雄之耀達到3層'}];
export const MIGRATED_REMOVED_LEVEL_SKILL_KITS:ReviewedSequenceSkill[]=[{elfIds:['arena_14'],name:'鋭武銘戈',description:raw.join('\n'),kit:[
 property(raw[0],'base_priority',3,0),
 {codeId:'skill_property',node:'on_skill_selected',source:'skill',role:'innate',order:1,customText:raw[1],params:{property:'ignore_pp_limit',value:true,conditions}},
 {...property(raw[1],'base_priority',1,2),params:{property:'base_priority',value:1,conditions}},
 sequence(raw[2],[{acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('prio_turns',{side:'opp',turns:2,v:-2})]}],3),
 sequence(raw[3],[{acts:[a('stat_clear',{side:'opp',kind:'up',captureLevels:true}),a('dmg_from_last',{ratio:40,type:'固定'})]}],4),
 sequence(raw[4],[{acts:[a('stat_reverse',{side:'self',kind:'down'})]},{chain:'success',acts:[a('invalid_next',{kind:'攻擊',uses:1})]}],5),
]}];
