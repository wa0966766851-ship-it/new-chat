import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';

const hit=(raw:string,body:any[],order:number):KitEntry=>({...sequence(raw,body,order),node:'on_hit',
  params:{clause:{raw,marker:'🎯',trig:'after_hit',parsed:true,body}}});

/** 攻擊吸血先設定，命中結算後讀攻擊實際傷害；固定吸取不混入等量來源。 */
export const MIGRATED_LIFESTEAL_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5011'],name:'星光·究極吸取',
  description:'■ 先制+3\n🎯 吸取對手能力提升狀態，吸取成功則為自身附加300點護盾\n🎯 造成傷害的100%恢復自身體力，若對手處於異常狀態則附加等量百分比傷害\n🎯 吸取對手240點體力',
  kit:[
    property('■ 先制+3','base_priority',3,0),
    sequence('🎯 吸取對手能力提升狀態，吸取成功則為自身附加300點護盾',[
      {acts:[a('stat_steal',{mode:'吸取'})]},
      {chain:'success',acts:[a('shield',{flat:300})]},
    ],1),
    sequence('🎯 造成傷害的100%恢復自身體力',[{acts:[a('vampire',{ratio:1,kind:'攻擊'})]}],2),
    hit('🎯 若對手處於異常狀態則附加等量百分比傷害',[
      {cond:[{c:'abnormal',p:{side:'opp'},label:'對手處於異常狀態'}],acts:[a('vampire',{ratio:1,kind:'攻擊'}),a('dmg_equal',{type:'百分比'})]},
    ],3),
    sequence('🎯 吸取對手240點體力',[{acts:[a('drain',{flat:240,true:false})]}],4),
  ],
},{
  elfIds:['5024'],name:'崩解・萬念劫灰',
  description:'■ 必中\n🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍\n🎯 4回合內每回合使用技能吸取對手最大體力的1/3，吸取體力時若自身體力低於最大體力的1/2則吸取效果翻倍，對手免疫百分比傷害時額外附加250點真實傷害\n🎯 2回合內令自身無效對手的攻擊技能\n🎯 下2回合攻擊忽略對手34%的雙防值\n🎯 下2回合令自身所有技能先制+3',
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍',[
      {acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:{c:'stage',p:{side:'self',kind:'up'},label:'自身能力提升'}})]},
    ],1),
    sequence('🎯 4回合內每回合使用技能吸取對手最大體力的1/3，吸取體力時若自身體力低於最大體力的1/2則吸取效果翻倍，對手免疫百分比傷害時額外附加250點真實傷害',[
      {acts:[a('timed',{turns:4,from:'now',trig:'self_after_skill',body:[
        {acts:[a('drain',{ratio:1/3,true:false,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'自身低於半血'}})]},
        {cond:[{c:'last_damage_immune',p:{},label:'百分比傷害被免疫'}],acts:[a('dmg',{flat:250,type:'真實'})]},
      ]})]},
    ],2),
    sequence('🎯 2回合內令自身無效對手的攻擊技能',[{acts:[a('invalid_turns',{turns:2,kind:'攻擊'})]}],3),
    sequence('🎯 下2回合攻擊忽略對手34%的雙防值',[{acts:[a('ignore_def_turns',{turns:2,ratio:.34,stat:'雙防',next:true})]}],4),
    sequence('🎯 下2回合令自身所有技能先制+3',[{acts:[a('prio_turns',{turns:2,v:3,attackOnly:false})]}],5),
  ],
}];
