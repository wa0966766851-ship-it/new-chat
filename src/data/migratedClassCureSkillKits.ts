import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
import type {KitEntry} from '../effects/effectSystem.schema';
const raw='🎯 命中時令對手100%漸凍1回合，未觸發或對手已處於漸凍則回合結束時消除對手回合類效果並令對手100%冰封，同時解除自身所有非附屬類異常狀態';
const pending=()=>a('at_round_end',{originalTarget:true,body:[{acts:[a('clear_turn',{side:'opp'}),a('status',{side:'opp',status:'冰封',chance:100})]}]});
const hit:KitEntry={...sequence(raw,[
  // 句子開始時的快照；本次新增漸凍不能當作原本已有漸凍。
  {cond:[{c:'has_status',p:{side:'opp',status:'漸凍'},label:'對手原本已處於漸凍'}],
    acts:[a('status',{side:'opp',status:'漸凍',turns:1,chance:100}),pending()],
    elseActs:[a('status',{side:'opp',status:'漸凍',turns:1,chance:100})]},
  {chain:'fail',acts:[pending()]},
  {acts:[a('cure_status',{side:'self',cls:'非附屬類'})]},
],4),node:'on_hit'};
hit.params!.clause.trig='after_hit';
export const MIGRATED_CLASS_CURE_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5007'],name:'深海働哭',
  description:'■ 必中\n🎯 自身攻擊、雙防、速度、命中+2\n🎯 汲取對手當前體力¼\n🎯 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，吸取後對手體力未減少則額外附加對手300點真實傷害\n'+raw,
  kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 自身攻擊、雙防、速度、命中+2',[{acts:[a('stat',{side:'self',stats:['攻擊','雙防','速度','命中'],v:2})]}],1),
    sequence('🎯 汲取對手當前體力¼',[{acts:[a('drain',{cur:true,ratioCur:.25,true:true})]}],2),
    sequence('🎯 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，吸取後對手體力未減少則額外附加對手300點真實傷害',[{acts:[a('timed',{turns:5,from:'now',trig:'self_after_skill',body:[
      {acts:[a('drain',{ratio:1/3,true:false,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'自身低於半血'}})]},
      {cond:[{c:'last_no_dmg',p:{},label:'吸取後對手體力未減少'}],acts:[a('dmg',{flat:300,type:'真實'})]},
    ]})]}],3),
    hit,
  ],
}];
