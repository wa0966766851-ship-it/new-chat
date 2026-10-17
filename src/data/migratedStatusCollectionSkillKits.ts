import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a,property,sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const c=(name:string,p:any)=>({c:name,p,label:name});
const onHit=(raw:string,body:any[],order:number):KitEntry=>({...sequence(raw,body,order),node:'on_hit',params:{clause:{raw,trig:'after_hit',parsed:true,body}}});

export const MIGRATED_STATUS_COLLECTION_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5020'],name:'同生共死',description:'■ 對方體力高於自己時才能命中\n🎯 將對方體力減到和自己相同',kit:[
    {...property('■ 對方體力高於自己時才能命中','hit_requirement',true,0),params:{property:'hit_requirement',value:true,conditions:[c('hp_cmp',{side:'opp',op:'高於'})]}},
    onHit('🎯 將對方體力減到和自己相同',[{acts:[a('hp_match',{side:'opp'})]}],1),
  ],
},{
  elfIds:['5020'],name:'測試異常用2',description:'先制+3；附加自身目前所有異常狀態',kit:[
    property('先制+3','base_priority',3,0),
    sequence('附加自身目前所有異常狀態',[{acts:[a('status_collection',{side:'self',scope:'active',mode:'current',cls:'',turns:3})]}],1),
  ],
},...['控制類','弱化類','限制類','衍化類','附屬類'].map((cls):ReviewedSequenceSkill=>({
  elfIds:['5020'],name:`測試·${cls}`,description:`先制+3；必中；威力0；附加雙方全體${cls}異常狀態`,kit:[
    property('先制+3','base_priority',3,0),property('必中','sure_hit',true,1),property('威力0','base_power',0,2),
    sequence(`附加雙方全體${cls}異常狀態`,[{acts:[a('status_collection',{side:'both',scope:'team',mode:'class',cls,turns:3})]}],3),
  ],
})),{
  elfIds:['5020'],name:'異常測試',description:'先制+3；必中；威力0；附加雙方所有精靈全部異常狀態',kit:[
    property('先制+3','base_priority',3,0),property('必中','sure_hit',true,1),property('威力0','base_power',0,2),
    sequence('附加雙方所有精靈全部異常狀態',[{acts:[a('status_collection',{side:'both',scope:'team',mode:'class',cls:'',turns:3})]}],3),
  ],
},{
  elfIds:['5015'],name:'狂影逆命沖',description:'🎯 使對手隨機的1個技能的PP值歸零\n🎯 60%令對手害怕，每次使用概率增加10%，最高概率100%',kit:[
    sequence('🎯 使對手隨機的1個技能的PP值歸零',[{acts:[a('pp_zero_random',{count:1})]}],0),
    sequence('🎯 60%令對手害怕，每次使用概率增加10%，最高概率100%',[{acts:[a('status',{side:'opp',status:'害怕',chance:60,chanceIncrement:10,chanceCap:100})]}],1),
  ],
},{
  elfIds:['5015'],name:'夜洛烏澤',description:'先制+3；必中；吸取對手能力提升狀態，吸取成功則自身下1回合必定先出手；將自身能力下降狀態反饋給對手，反饋成功則對手詛咒；出手時體力低於1/3時威力3倍',kit:[
    property('先制+3','base_priority',3,0),property('必中','sure_hit',true,1),
    sequence('吸取對手能力提升狀態，吸取成功則自身下1回合必定先出手',[{acts:[a('stat_steal',{mode:'吸取'})]},{chain:'success',acts:[a('first_turns',{turns:1,next:true})]}],2),
    sequence('將自身能力下降狀態反饋給對手，反饋成功則對手詛咒',[{acts:[a('stat_transfer',{})]},{chain:'success',acts:[a('status',{side:'opp',status:'詛咒',chance:100})]}],3),
    sequence('出手時體力低於1/3時威力3倍',[{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:1/3})],acts:[a('boost',{mult:3,power:true})]}],4),
  ],
}];
