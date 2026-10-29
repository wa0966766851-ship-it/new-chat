import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action,property,sequence} from './reviewedSequenceSkillKits';
const main='🎯 廢除此技能，恢復對方精靈的全部體力，消耗此技能的全部PP值並獲得等量的魔王咒怨，然後若魔王咒怨層數高於5則秒殺對手且本次造成的攻擊傷害不低於對方所有精靈體力上限之和';
const next='🎯 當回合出手流程結束後若擊敗對手則對方下隻精靈出戰時100%進入詛咒狀態';
const enough={c:'mark_count',p:{side:'self',id:'demon_grudge',op:'高於',amount:5},label:'魔王咒怨高於5層'};
export const MIGRATED_RESOURCE_KILL_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5024'],name:'絕滅・萬物哀鳴',description:['■ 先制+1','■ 必中',main,next].join('\n'),
  kit:[
    property('■ 先制+1','base_priority',1,0),property('■ 必中','sure_hit',true,1),
    sequence(main,[{acts:[action('abolish_selected',{side:'self'}),action('heal_then',{side:'opp',ratio:1,body:[
      {acts:[action('consume_selected_pp',{side:'self'}),action('resource_mark_add',{id:'demon_grudge',name:'魔王咒怨',side:'self',scope:'elf',displayChar:'怨',unit:'層',persistsOffField:true,description:'魔王咒怨層數',ratio:1})]},
      {cond:[enough],acts:[action('instant_kill',{chance:100})]},
    ]})]}],2),
    // 查詢本次主攻擊，不把攻擊保底替換成固定／真實傷害。
    {codeId:'effect_sequence',node:'before_damage',source:'skill',role:'attached',order:3,customText:main,
      params:{clause:{raw:main,trig:'outgoing_attack',parsed:true,body:[{cond:[enough],acts:[action('damage_floor',{side:'opp',base:'全隊體力上限',ratio:1})]}]}}},
    sequence(next,[{acts:[action('watch',{trig:'kill',actionOnly:true,body:[{cond:[{c:'death_node',p:{node:1},label:'本次出手流程結束的死亡節點'}],acts:[action('next_entry_status',{status:'詛咒',turns:1})]}]})]}],4),
  ],
}];
