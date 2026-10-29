import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {property,sequence,action} from './reviewedSequenceSkillKits';
import type {KitEntry} from '../effects/effectSystem.schema';
const raw=[
  '■ 必中',
  '■ 自身處於能力下降狀態時先制+3',
  '■ 對手處於能力提升狀態時先制+3',
  '■ 當八荒大於等於3層時，攻擊無視對手傷害降低、減少效果',
  '■ 將對手能力提升效果視為能力下降',
  '■ 將自身能力下降效果視為能力提升',
  '■ 對手每有1級能力提升此技能威力提升30點',
  '🎯 自身每有1級能力下降此技能附加對手60點固定傷害',
];
const conditional=(order:number,side:string,kind:string):KitEntry=>({...property(raw[order],'base_priority',3,order),params:{property:'base_priority',value:3,conditions:[{c:'stage',p:{side,kind},label:raw[order]}]}});
const view=(order:number,value:string):KitEntry=>({codeId:'skill_property',node:'before_damage',source:'skill',role:'innate',order,customText:raw[order],params:{property:'stage_view',value,conditions:[]}});
/** 威力／固傷數的是實際能力等級，不是公式視為後的等級。 */
export const MIGRATED_STAGE_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5017'],name:'帝怒傾天',description:raw.join('\n'),kit:[
    property(raw[0],'sure_hit',true,0),conditional(1,'self','down'),conditional(2,'opp','up'),
    {codeId:'skill_property',node:'before_damage',source:'skill',role:'innate',order:3,customText:raw[3],params:{property:'ignore_damage_reduction',value:true,conditions:[{c:'mark_count',p:{side:'self',id:'bahuang_mark',op:'不低於',amount:3},label:'八荒至少3層'}]}},
    view(4,'opp_up_as_down'),view(5,'self_down_as_up'),
    {codeId:'skill_property',node:'before_damage',source:'skill',role:'innate',order:6,customText:raw[6],params:{property:'stage_power',value:30,conditions:[],perStage:{side:'opp',kind:'up'}}},
    sequence(raw[7],[{acts:[action('dmg',{flat:60,type:'固定',perStage:{side:'self',kind:'down'}})]}],7),
  ],
}];
