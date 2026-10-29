import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action,property,sequence} from './reviewedSequenceSkillKits';
const reverse='🎯 反轉自身能力下降狀態，反轉成功則附加給對手等同的能力下降狀態';
const collection='🎯 令對方背包內（場上場下）體力上限最低的精靈體力上限提升至與自身相等並恢復等量體力，然後此精靈所有非體力上限的能力值減少提升的數值，最多減少100點且最多減少至1';
const notKilled='🎯 未擊敗對手則令對方場下陣亡的首位精靈消逝';
const killed='🎯 擊敗對手則對方下隻出戰時精靈首回合先制效果失效';
const priority='■ 若自身處於能力下降狀態則先制+3';
const base=property(priority,'base_priority',3,1);
base.params.conditions=[{c:'stage',p:{side:'self',kind:'down'},label:'自身能力下降'}];
export const MIGRATED_COLLECTION_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5024'],name:'劫數・限界歸無',description:['■ 必中',priority,reverse,collection,notKilled,killed].join('\n'),
  kit:[property('■ 必中','sure_hit',true,0),base,
    sequence(reverse,[{acts:[action('stat_reverse',{side:'self',kind:'down'})]},{chain:'success',acts:[action('stat_apply_last',{side:'opp',direction:'opposite'})]}],2),
    sequence(collection,[{acts:[action('select_elf',{side:'opp',scope:'team',state:'any',orderBy:'max_hp',direction:'asc',body:[
      {acts:[action('raise_max_hp',{source:'self',ratio:1}),action('heal_selected_then',{ratio:1,body:[{acts:[action('stat_points',{stats:['atk','def','spatk','spdef','speed'],direction:'decrease',ratio:1,cap:100,floor:1})]}]})]},
    ]})]}],3),
    sequence(notKilled,[{acts:[action('watch',{trig:'not_killed',actionOnly:true,body:[{cond:[{c:'death_node',p:{node:1},label:'出手末正式未擊敗'}],acts:[action('select_elf',{side:'opp',scope:'bench',state:'dead',orderBy:'team_order',direction:'asc',body:[{acts:[action('vanish_selected',{})]}]})]}]})]}],4),
    sequence(killed,[{acts:[action('watch',{trig:'kill',actionOnly:true,body:[{cond:[{c:'death_node',p:{node:1},label:'出手末正式擊敗'}],acts:[action('next_entry_priority',{turns:1})]}]})]}],5),
  ],
}];
