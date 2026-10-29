import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=[
  '■ 必中',
  '■ 當八荒大於等於3層時，此技能先制+3',
  '🎯 令對手附加3回合臣服，若未觸發則為自身附加3回合星賜狀態並使對下2回合攻擊技能無效',
  '🎯 4回合內對手使用屬性技能時令對下手回合攻擊技能命中效果失效且無法造成技能傷害',
  '🎯 4回合內每回合結束時吸取對手1/3最大體力，若對方未受到百分比傷害則附加300點真實傷害且附加自身1層伏魔印記',
];
/** 「下手回合」依上下文讀作「對手下回合」，回合數與附加／技能傷害分別接正式讀取端。 */
export const MIGRATED_UTILITY_MONITOR_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5017'],name:'人皇御宇',description:raw.join('\n'),kit:[
    property(raw[0],'sure_hit',true,0),
    {codeId:'skill_property',node:'modify_priority',source:'skill',role:'innate',order:1,customText:raw[1],params:{property:'base_priority',value:3,conditions:[{c:'mark_count',p:{side:'self',id:'bahuang_mark',op:'不低於',amount:3},label:'八荒至少3層'}]}},
    sequence(raw[2],[{acts:[a('status',{side:'opp',status:'臣服',chance:100,turns:3})]},
      {chain:'fail',acts:[a('status',{side:'self',status:'星賜',chance:100,turns:3}),a('invalid_turns',{kind:'攻擊',turns:2,next:true})]}],2),
    sequence(raw[3],[{acts:[a('timed',{turns:4,from:'now',trig:'opp_status',body:[{acts:[
      a('add_invalid_turns',{kind:'攻擊',turns:1,next:true}),
      a('damage_cap_turns',{side:'opp',dir:'out',kind:'技能',cap:0,turns:1,next:true}),
    ]}]})]}],3),
    sequence(raw[4],[{acts:[a('timed',{turns:4,from:'now',trig:'round_end',body:[
      {acts:[a('drain',{ratio:1/3,true:false})]},
      {cond:[{c:'last_no_dmg',p:{},label:'本次百分比傷害未減少對手體力'}],acts:[
        a('dmg',{flat:300,type:'真實'}),
        a('resource_mark_add',{side:'self',id:'fumo_mark',name:'伏魔印記',displayChar:'伏',unit:'層',scope:'elf',persistsOffField:true,description:'個體伏魔層數。',amount:1}),
      ]},
    ]})]}],4),
  ],
}];
