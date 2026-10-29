import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=['■ 先制 +3','🎯 吸取對手的能力提升；吸取成功時令對手下回合先制 −2','🎯 若對手不處於能力提升狀態，令對手全屬性 −1','■ 一回合攻擊 5～10 次','🎯 每次攻擊有 20% 機率附加 100 點固定傷害'];
export const MIGRATED_COUNTED_ATTACK_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['arena_15'],name:'陰陽三合',description:raw.join('\n'),kit:[
    property(raw[0],'base_priority',3,0),
    sequence(raw[1],[{acts:[a('stat_steal',{mode:'吸取'})]},{chain:'success',acts:[a('prio_turns',{side:'opp',v:-2,turns:1})]}],1),
    sequence(raw[2],[{cond:[{c:'stage',p:{side:'opp',kind:'up',neg:true},label:'使用前沒有能力提升'}],acts:[a('stat',{side:'opp',stats:['全屬性'],v:-1})]}],2),
    {codeId:'skill_property',node:'before_skill',source:'skill',role:'innate',order:3,customText:raw[3],params:{property:'attack_hits',value:{min:5,max:10},conditions:[]}},
    {codeId:'effect_sequence',node:'after_attack_hit',source:'skill',role:'attached',order:4,customText:raw[4],params:{clause:{raw:raw[4],marker:'🎯',trig:'attack_hit',parsed:true,
      body:[{cond:[{c:'chance',p:{pct:20},label:'每次命中獨立判定20%'}],acts:[a('dmg',{flat:100,type:'固定'})]}]}}},
  ],
}];
