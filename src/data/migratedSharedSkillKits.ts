import type { KitEntry } from '../effects/effectSystem.schema';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a,property as prop,sequence as seq } from './reviewedSequenceSkillKits';
const c=(id:string,p:any)=>({c:id,p,label:id});
const hit=(raw:string,body:any[],order:number):KitEntry=>({...seq(raw,body,order),node:'on_hit',params:{clause:{raw,marker:'🎯',trig:'after_hit',parsed:true,body}}});
const timed=(turns:number,trig:string,body:any[],from='now',initial=false)=>a('timed',{turns,trig,body,from,...(initial?{initial:true}:{})});
export const MIGRATED_SHARED_SKILL_KITS:ReviewedSequenceSkill[]=[
  {elfIds:['5011'],name:'星光·光合作用',description:'■ 必中\n🎯 4回合內免疫並反彈所有受到的異常狀態\n🎯 4回合內每回合使用技能恢復自身最大體力的1/2並造成等量百分比傷害\n🎯 3回合內每回合使用技能則造成傷害前隨機吸取對手3項能力值-1\n🎯 3回合內對手使用技能消耗的PP值變為3倍',kit:[
    prop('■ 必中','sure_hit',true,0),seq('🎯 4回合內免疫並反彈所有受到的異常狀態',[{acts:[a('immune_status_turns',{turns:4,reflect:true,cls:''})]}],1),
    hit('🎯 4回合內每回合使用技能恢復自身最大體力的1/2並造成等量百分比傷害',[{acts:[timed(4,'self_skill',[{acts:[a('heal',{side:'self',ratio:.5}),a('dmg_equal',{type:'百分比'})]}],'now',true)]}],2),
    seq('🎯 3回合內每回合使用技能則造成傷害前隨機吸取對手3項能力值-1',[{acts:[timed(3,'self_skill',[{acts:[a('stat_steal_random',{count:3,v:1})]}],'now',true)]}],3),
    seq('🎯 3回合內對手使用技能消耗的PP值變為3倍',[{acts:[a('pp_cost_mult',{turns:3,mult:3,kind:''})]}],4),
  ]},
  {elfIds:['5004'],name:'千鳥俱寂',description:'■ 必中\n🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍\n🎯 消除對手回合類效果\n🎯 4回合內每回合恢復自身最大體力1/3並附加等量固定傷害\n🎯 下2回合自身攻擊技能必定令對手麻痺\n🎯 下2回合所有技能先制+2',kit:[
    prop('■ 必中','sure_hit',true,0),seq('🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('stage',{side:'self',kind:'up'})})]}],1),
    seq('🎯 消除對手回合類效果',[{acts:[a('clear_turn',{side:'opp'})]}],2),
    hit('🎯 4回合內每回合恢復自身最大體力1/3並附加等量固定傷害',[{acts:[timed(4,'round_end',[{acts:[a('heal',{side:'self',ratio:1/3}),a('dmg_equal',{type:'固定'})]}])]}],3),
    hit('🎯 下2回合自身攻擊技能必定令對手麻痺',[{acts:[timed(2,'self_attack',[{acts:[a('status',{side:'opp',status:'麻痺',turns:3,chance:100})]}],'next')]}],4),
    seq('🎯 下2回合所有技能先制+2',[{acts:[a('prio_turns',{turns:2,v:2})]}],5),
  ]},
  {elfIds:['5000'],name:'光榮之夢',description:'■ 必中\n🎯 全屬性+1，對手不為混沌系時強化效果翻倍\n🎯 3回合內每回合使用技能吸取對手能力提升狀態\n🎯 恢復自身最大體力的1/2，自身體力低於1/2時造成等量百分比傷害\n🎯 下2回合自身所有技能先制+2',kit:[
    prop('■ 必中','sure_hit',true,0),seq('🎯 全屬性+1，對手不為混沌系時強化效果翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('type_is',{side:'opp',type:'混沌',neg:true})})]}],1),
    hit('🎯 3回合內每回合使用技能吸取對手能力提升狀態',[{acts:[timed(3,'self_skill',[{acts:[a('stat_steal',{mode:'吸取',double:false})]}],'now',true)]}],2),
    seq('🎯 恢復自身最大體力的1/2，自身體力低於1/2時造成等量百分比傷害',[{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[a('heal',{side:'self',ratio:.5}),a('dmg_equal',{type:'百分比'})],elseActs:[a('heal',{side:'self',ratio:.5})]}],3),
    seq('🎯 下2回合自身所有技能先制+2',[{acts:[a('prio_turns',{turns:2,v:2})]}],4),
  ]},
  {elfIds:['5010'],name:'星光·怒濤狂湧',description:'必中；消除對手能力提升狀態，消除成功則對手2回合內無法使用屬性技能；造成的傷害50%恢復自身體力',kit:[
    prop('必中','sure_hit',true,0),seq('消除對手能力提升狀態，消除成功則對手2回合內無法使用屬性技能',[{acts:[a('stat_clear',{side:'opp',kind:'up'})]},{chain:'success',acts:[a('invalid_turns',{kind:'屬性',turns:2})]}],1),
    seq('造成的傷害50%恢復自身體力',[{acts:[a('vampire',{ratio:.5,kind:'攻擊'})]}],2),
  ]},
  {elfIds:['5001'],name:'黯·萬魂歸寂',description:'■ 必中\n■ 先制+1\n🎯 消除對手回合類效果\n  > 消除成功則對手2回合內屬性技能無效\n🎯 造成傷害100%恢復自身體力\n🎯 2回合內100%閃避對手攻擊技能\n🎯 3回合內自身死亡時強制存活並保留1點體力',kit:[
    prop('■ 必中','sure_hit',true,0),prop('■ 先制+1','base_priority',1,1),seq('🎯 消除對手回合類效果，消除成功則對手2回合內屬性技能無效',[{acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('invalid_turns',{turns:2,kind:'屬性'})]}],2),
    seq('🎯 造成傷害100%恢復自身體力',[{acts:[a('vampire',{ratio:1,kind:'攻擊'})]}],3),seq('🎯 2回合內100%閃避對手攻擊技能',[{acts:[a('evade_turns',{turns:2,chance:100,kind:'攻擊'})]}],4),
    seq('🎯 3回合內自身死亡時強制存活並保留1點體力',[{acts:[a('survive_turns',{turns:3})]}],5),
  ]},
  {elfIds:['5024'],name:'魔王天權震',description:'必中；將自身能力下降狀態雙倍回饋給對手；未擊敗對手則己方下2次攻擊必定致命一擊（己方代表會繼承給場下所有精靈，同類效果觸發時會重置次數至最高值後再消耗次數）',kit:[
    prop('必中','sure_hit',true,0),seq('將自身能力下降狀態雙倍回饋給對手',[{acts:[a('stat_mirror',{side:'opp',fromKind:'down',kind:'down',mult:2})]}],1),
    hit('未擊敗對手則己方下2次攻擊必定致命一擊（同類效果刷新到最高次數，不相加）',[{cond:[c('nokill',{})],acts:[a('crit_uses',{uses:2,scope:'team'})]}],2),
  ]},
  {elfIds:['300','5000'],name:'聖光氣',description:'■ 必中\n🎯 接下來2回合攻擊必定致命一擊',kit:[prop('■ 必中','sure_hit',true,0),seq('🎯 接下來2回合攻擊必定致命一擊',[{acts:[a('crit_turns',{turns:2,next:true})]}],1)]},
  {elfIds:['5000'],name:'神聖復甦',description:'■ 先制+2\n🎯 使雙方精靈所有技能PP值歸零\n🎯 消除雙方能力提升、下降狀態以及回合類效果\n🎯 恢復自身最大體力的1/1，並附加等同於恢復量的百分比傷害',kit:[
    prop('■ 先制+2','base_priority',2,0),seq('🎯 使雙方精靈所有技能PP值歸零',[{acts:[a('pp_op',{side:'self',mode:'zero'}),a('pp_op',{side:'opp',mode:'zero'})]}],1),
    seq('🎯 消除雙方能力提升、下降狀態以及回合類效果',[{acts:[a('stat_clear',{side:'both',kind:'all'}),a('clear_turn',{side:'both'})]}],2),
    seq('🎯 恢復自身最大體力的1/1，並附加等同於恢復量的百分比傷害',[{acts:[a('heal',{side:'self',ratio:1}),a('dmg_equal',{type:'百分比'})]}],3),
  ]},
  {elfIds:['5000'],name:'神聖啟示歌',description:'■ 先制+1\n🎯 先出手時使對手隨機2個技能PP值歸零\n🎯 後出手時下回合所有技能先制+3',kit:[
    prop('■ 先制+1','base_priority',1,0),seq('🎯 先出手時使對手隨機2個技能PP值歸零',[{cond:[c('first',{})],acts:[a('pp_zero_random',{count:2})]}],1),
    seq('🎯 後出手時下回合所有技能先制+3',[{cond:[c('last',{})],acts:[a('prio_turns',{turns:1,v:3})]}],2),
  ]},
  {elfIds:['5011'],name:'星光·花草能量',description:'■ 必中\n🎯 全屬性+1，自身當前體力高於對手時強化效果翻倍\n🎯 若自身體力高於對手則獲得400點護盾\n🎯 若自身體力低於對手則恢復自身最大體力的1/2\n🎯 抵擋下1次對手的攻擊\n🎯 3回合內使用技能附加200點固定傷害，若自身體力高於對手則效果翻倍',kit:[
    prop('■ 必中','sure_hit',true,0),seq('🎯 全屬性+1，自身當前體力高於對手時強化效果翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('hp_cmp',{side:'self',op:'高於'})})]}],1),
    seq('🎯 若自身體力高於對手則獲得400點護盾',[{cond:[c('hp_cmp',{side:'self',op:'高於'})],acts:[a('shield',{flat:400})]}],2),
    seq('🎯 若自身體力低於對手則恢復自身最大體力的1/2',[{cond:[c('hp_cmp',{side:'self',op:'低於'})],acts:[a('heal',{side:'self',ratio:.5})]}],3),
    seq('🎯 抵擋下1次對手的攻擊',[{acts:[a('block_attack',{count:1})]}],4),
    seq('🎯 3回合內使用技能附加200點固定傷害，若自身體力高於對手則效果翻倍',[{acts:[timed(3,'self_skill',[{acts:[a('dmg',{flat:200,type:'固定',x2If:c('hp_cmp',{side:'self',op:'高於'})})]}],'now',true)]}],5),
  ]},
  {elfIds:['5031'],name:'升臨恩澤',description:'■ 必中\n🎯 5回合內免疫並反彈異常狀態\n🎯 3回合內每回合附加200點固定傷害，若自身體力低於對手則固定傷害翻倍\n🎯 免疫下1次受到的攻擊\n🎯 下2回合自身所有技能先制+3',kit:[
    prop('■ 必中','sure_hit',true,0),seq('🎯 5回合內免疫並反彈異常狀態',[{acts:[a('immune_status_turns',{turns:5,reflect:true,cls:''})]}],1),
    hit('🎯 3回合內每回合附加200點固定傷害，若自身體力低於對手則固定傷害翻倍',[{acts:[timed(3,'round_end',[{acts:[a('dmg',{flat:200,type:'固定',x2If:c('hp_cmp',{side:'self',op:'低於'})})]}])]}],2),
    seq('🎯 免疫下1次受到的攻擊',[{acts:[a('immune_attack_count',{count:1})]}],3),seq('🎯 下2回合自身所有技能先制+3',[{acts:[a('prio_turns',{turns:2,v:3})]}],4),
  ]},
  {elfIds:['5031'],name:'超界審判',description:'■ 必中\n🎯 當回合處於能力下降狀態則先制+3\n🎯 反轉自身能力下降狀態\n🎯 使對手隨機2個技能PP歸零\n🎯 造成攻擊傷害提升50%，自身處於能力提升狀態時效果翻倍',kit:[
    prop('■ 必中','sure_hit',true,0),{codeId:'skill_property',source:'skill',role:'attached',node:'modify_priority',order:1,customText:'🎯 當回合處於能力下降狀態則先制+3',params:{property:'conditional_priority',value:3,conditions:[c('stage',{side:'self',kind:'down'})]}},
    seq('🎯 反轉自身能力下降狀態',[{acts:[a('stat_reverse',{side:'self',kind:'down'})]}],2),seq('🎯 使對手隨機2個技能PP歸零',[{acts:[a('pp_zero_random',{count:2})]}],3),
    seq('🎯 造成攻擊傷害提升50%，自身處於能力提升狀態時效果翻倍',[{live:true,acts:[a('boost',{mult:1.5,kind:'攻擊',x2If:c('stage',{side:'self',kind:'up'})})]}],4),
  ]},
  {elfIds:['5024'],name:'絕滅死亡',description:'全屬性+1，對手處於異常狀態時強化效果翻倍；4回合內，每回合吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍；4回合內免疫並反彈異常狀態',kit:[
    seq('全屬性+1，對手處於異常狀態時強化效果翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('abnormal',{side:'opp'})})]}],0),
    hit('4回合內，每回合吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍',[{acts:[timed(4,'round_end',[{acts:[a('drain',{ratio:1/3,true:false,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})]}])]}],1),
    seq('4回合內免疫並反彈異常狀態',[{acts:[a('immune_status_turns',{turns:4,cls:'',reflect:true})]}],2),
  ]},
  ...['吸取','強力吸取'].map(name=>({elfIds:['5011'],name,description:'給予對方損傷的一半會回復自己的體力。',kit:[seq('給予對方損傷的一半會回復自己的體力。',[{acts:[a('vampire',{ratio:.5,kind:'攻擊'})]}],0)]})),
];
