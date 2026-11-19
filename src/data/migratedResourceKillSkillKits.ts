import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action,property,sequence} from './reviewedSequenceSkillKits';
const innate='■ 出手時，當回合內使用技能不消耗PP值';
const main='🎯 廢除此技能，恢復對方精靈的全部體力，消耗自身所有技能的全部PP值並獲得等量的魔王咒怨，然後若魔王咒怨層數高於5則秒殺對手且本次造成的攻擊傷害不低於對方所有精靈體力上限之和';
const next='🎯 下次擊敗對手時，令對方下隻精靈出戰時100%進入詛咒狀態（自身下場後此待觸發效果消失）';
const enough={c:'mark_count',p:{side:'self',id:'demon_grudge',op:'高於',amount:5},label:'魔王咒怨高於5層'};
export const MIGRATED_RESOURCE_KILL_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5024'],name:'絕滅・萬物哀鳴',description:['■ 先制+1','■ 必中',innate,main,next].join('\n'),
  kit:[
    property('■ 先制+1','base_priority',1,0),property('■ 必中','sure_hit',true,1),
    {codeId:'effect_sequence',node:'before_skill',source:'skill',role:'innate',order:2,customText:innate,
      params:{clause:{raw:innate,marker:'■',trig:'before_skill',parsed:true,body:[{acts:[action('pp_no_cost',{thisRound:true})]}]}}},
    sequence(next,[{acts:[action('watch',{
      key:'curse-next-entrant-on-kill',trig:'kill',persistsOffField:false,text:'下次擊敗對手後令下隻精靈詛咒',
      body:[{acts:[action('next_entry_status',{status:'詛咒',turns:1})]}],
    })]}],3),
    sequence(main,[{acts:[action('abolish_selected',{side:'self'}),action('heal_then',{side:'opp',ratio:1,body:[
      {acts:[action('pp_op',{side:'self',mode:'zero',captureRemoved:true}),action('resource_mark_add',{id:'demon_grudge',name:'魔王咒怨',side:'self',scope:'elf',displayChar:'怨',unit:'層',persistsOffField:true,description:'魔王咒怨層數',ratio:1})]},
      {cond:[enough],acts:[action('damage_floor',{side:'opp',base:'全隊體力上限',ratio:1}),action('instant_kill',{chance:100})]},
    ]})]}],4),
  ],
}];
