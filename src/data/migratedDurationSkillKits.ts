import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
const c=(name:string,p:any)=>({c:name,p,label:name});
const query=(text:string,value:number,order:number,conditions:any[])=>({
  ...property(text,'base_priority',value,order),params:{property:'base_priority',value,conditions},
});
/** 持續行為、前置條件與成敗連鎖保留在資料；不從技能名稱重新推測。 */
export const MIGRATED_DURATION_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5030'],name:'天佑聖障',
  description:'■ 必中\n🎯 全屬性+1，自身體力高於1/2時強化效果倍增\n🎯 5回合內吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍\n🎯 使自身在接下來的2回合直接攻擊必定致命一擊\n🎯 下2回合自身所有技能先制+3',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 全屬性+1，自身體力高於1/2時強化效果倍增',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('hp_ratio',{side:'self',op:'高於',ratio:.5})})]}],1),
    sequence('🎯 5回合內吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍',[{acts:[a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
      {acts:[a('drain',{ratio:1/3,true:false,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})]},
    ]})]}],2),
    sequence('🎯 使自身在接下來的2回合直接攻擊必定致命一擊',[{acts:[a('crit_turns',{turns:2,next:true})]}],3),
    sequence('🎯 下2回合自身所有技能先制+3',[{acts:[a('prio_turns',{turns:2,v:3})]}],4),
  ],
},{
  elfIds:['arena_15'],name:'列星安辰',
  description:'■ 必中\n🎯 全屬性 +1；自身體力高於最大體力的 1/2 時強化效果翻倍\n🎯 4 回合內每回合吸取對手最大體力的 1/3\n🎯 下 2 回合自身所有攻擊無視對手能力提升狀態\n🎯 下 2 回合自身所有技能先制 +2',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 全屬性 +1；自身體力高於最大體力的 1/2 時強化效果翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('hp_ratio',{side:'self',op:'高於',ratio:.5})})]}],1),
    sequence('🎯 4 回合內每回合吸取對手最大體力的 1/3',[{acts:[a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,body:[{acts:[a('drain',{ratio:1/3,true:false})]}]})]}],2),
    sequence('🎯 下 2 回合自身所有攻擊無視對手能力提升狀態',[{acts:[a('timed',{turns:2,from:'next',trig:'self_attack',body:[{acts:[a('ignore',{what:'能力提升'})]}]})]}],3),
    sequence('🎯 下 2 回合自身所有技能先制 +2',[{acts:[a('prio_turns',{turns:2,v:2})]}],4),
  ],
},{
  elfIds:['300','5000'],name:'聖靈悲魂曲',
  description:'■ 先制+1\n🎯 3回合內50%機率使對手的屬性技能失效\n🎯 先出手時降低對手所有PP 2點',kit:[
    property('■ 先制+1','base_priority',1,0),
    sequence('🎯 3回合內50%機率使對手的屬性技能失效',[{acts:[a('timed',{turns:3,from:'now',trig:'opp_status',body:[
      {cond:[c('chance',{pct:50})],acts:[a('invalid_next',{uses:1,kind:'屬性'})]},
    ]})]}],1),
    sequence('🎯 先出手時降低對手所有PP 2點',[{cond:[c('first',{})],acts:[a('pp_op',{side:'opp',mode:'reduce',amount:2})]}],2),
  ],
},{
  elfIds:['5010'],name:'星光·水天一色',
  description:'必中；4 回合內免疫並反彈所有受到的異常狀態；解除自身能力下降效果，解除成功則下 2 回合先制+2；恢復自身最大體力的 1/1，自身體力低於 1/2 時造成等量固定傷害；3 回合內受到攻擊則對手下回合受到的傷害翻倍',kit:[
    property('必中','sure_hit',true,0),
    sequence('4 回合內免疫並反彈所有受到的異常狀態',[{acts:[a('immune_status_turns',{turns:4,reflect:true,cls:''})]}],1),
    sequence('解除自身能力下降效果，解除成功則下 2 回合先制+2',[
      {acts:[a('stat_clear',{side:'self',kind:'down'})]},{chain:'success',acts:[a('prio_turns',{turns:2,v:2})]},
    ],2),
    sequence('恢復自身最大體力的 1/1，自身體力低於 1/2 時造成等量固定傷害',[
      {acts:[a('heal',{side:'self',ratio:1})]},
      {cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[a('dmg_equal',{type:'固定'})]},
    ],3),
    sequence('3 回合內受到攻擊則對手下回合受到的傷害翻倍',[{acts:[a('timed',{turns:3,from:'now',trig:'damaged_attack',body:[
      {acts:[a('dmg_mod_turns',{side:'opp',turns:1,next:true,dir:'taken',kind:'',boost:1})]},
    ]})]}],4),
  ],
},{
  elfIds:['300','5000'],name:'璨靈聖光',
  description:'■ 必中\n■ 遇到天敵時先制+1\n🎯 2回合內有100%機率免疫對手的攻擊傷害\n🎯 5回合內每回合恢復自身體力1/3\n🎯 下2回合攻擊必定先出手\n🎯 使自身下2回合的攻擊威力翻倍',kit:[
    property('■ 必中','sure_hit',true,0),query('■ 遇到天敵時先制+1',1,1,[c('enemy',{})]),
    sequence('🎯 2回合內有100%機率免疫對手的攻擊傷害',[{acts:[a('immune_attack_turns',{turns:2})]}],2),
    sequence('🎯 5回合內每回合恢復自身體力1/3',[{acts:[a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[{acts:[a('heal',{side:'self',ratio:1/3})]}]})]}],3),
    sequence('🎯 下2回合攻擊必定先出手',[{acts:[a('first_turns',{turns:2,attackOnly:true,next:true})]}],4),
    sequence('🎯 使自身下2回合的攻擊威力翻倍',[{acts:[a('timed',{turns:2,from:'next',trig:'self_attack',body:[{acts:[a('boost',{mult:2,power:true})]}]})]}],5),
  ],
}];
