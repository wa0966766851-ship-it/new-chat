import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw=[
  '■ 必中',
  '🎯 令自身特攻、雙防、速度+2、命中+1',
  '🎯 5回合內自身使用技能恢復自身最大體力1/3並造成等量百分比傷害，自身體力低於最大體力½時效果翻倍',
  '🎯 將對手屬性變為暗影系，若對手識別屬性為暗影系則令對手下次技能無效',
  '🎯 下2回合自身所有技能先制+2',
  '🎯 技能無效時，下2次攻擊將對手視為暗影系，自身攻擊視為光系',
];
export const MIGRATED_TYPE_VIEW_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5014'],name:'暮光舞動',description:raw.join('\n'),kit:[
    property(raw[0],'sure_hit',true,0),
    sequence(raw[1],[{acts:[a('stat',{side:'self',stats:['特攻','防禦','特防','速度'],v:2}),a('stat',{side:'self',stats:['命中'],v:1})]}],1),
    sequence(raw[2],[{acts:[a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,label:'使用技能恢復並附加傷害',body:[
      {cond:[{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'使用前低於半血'}],acts:[a('heal_then',{side:'self',ratio:2/3,body:[
        {acts:[a('dmg_from_last',{ratio:1,type:'百分比'})]},
      ]})],elseActs:[a('heal_then',{side:'self',ratio:1/3,body:[
        {acts:[a('dmg_from_last',{ratio:1,type:'百分比'})]},
      ]})]},
    ]})]}],2),
    sequence(raw[3],[{cond:[{c:'type_is',p:{side:'opp',type:'暗影'},label:'對手識別為暗影'}],acts:[a('invalid_next',{kind:'all',uses:1})],elseActs:[a('change_type',{side:'opp',type:'暗影',untilSwitch:true})]}],3),
    sequence(raw[4],[{acts:[a('prio_turns',{turns:2,v:2})]}],4),
    {codeId:'effect_sequence',node:'on_invalid',source:'skill',role:'attached',order:5,customText:raw[5],params:{clause:{raw:raw[5],marker:'🎯',trig:'on_invalid',parsed:true,body:[
      {acts:[a('attack_type_view_uses',{uses:2,attackType:'光',targetType:'暗影'})]},
    ]}}},
  ],
}];
