import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
const c=(id:string,p:any)=>({c:id,p,label:id});
const at=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number,role:KitEntry['role']='attached'):KitEntry=>({
  codeId:'effect_sequence',node,source:'skill',role,order,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
const hit=(raw:string,body:any[],order:number)=>at('on_hit','after_hit',raw,body,order);
const timed=(turns:number,trig:string,body:any[],from='now')=>a('timed',{turns,trig,body,from,...(from==='now'&&['self_skill','self_attack','self_status'].includes(trig)?{initial:true}:{})});
const query=(raw:string,property:string,value:any,order:number,conditions:any[]=[]):KitEntry=>({
  codeId:'skill_property',node:property==='stage_view'?'before_damage':property==='base_priority'?'modify_priority':'before_skill',
  source:'skill',role:'innate',order,customText:raw,params:{property,value,conditions}});

/** 完整原文精確匹配；攜帶條件、成敗與查詢都是可編輯資料，不引用原精靈handler。 */
export const MIGRATED_EVENT_SKILL_KITS:ReviewedSequenceSkill[]=[
  {elfIds:['300','5000'],name:'聖影流光破',description:'■ 必中\n🎯 消除對手回合類效果\n> 消除成功2回合內對手無法通過自身技能恢復體力\n🎯 附加當回合未擊敗對手則自身特攻、速度+1\n🎯 附加吸取對手150點固定體力\n> 每次使用額外附加100點，最高350點',kit:[
    prop('■ 必中','sure_hit',true,0),seq('消回合成功才禁止對手自身技能回血2回合',[{acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('no_heal',{turns:2,scope:'own_skill'})]}],1),
    seq('當回合未擊敗才特攻速度+1',[{acts:[a('watch',{trig:'phase_end',body:[{cond:[c('nokill',{})],acts:[a('stat',{side:'self',stats:['特攻','速度'],v:1})]}]})]}],2),
    seq('固定體力吸取150，每次額外100最高350',[{acts:[a('drain',{flat:150,true:false,rampInc:100,rampCap:350})]}],3),
  ]},
  {elfIds:['5000'],name:'神靈救世光',description:'■ 必中\n🎯 消除對手回合類效果，消除成功3回合內對手無法通過自身技能恢復體力\n🎯 當回合未擊敗對手則下1次自身技能附加自身最大體力1/3的百分比傷害\n🎯 吸取對手200點固定體力，自身體力低於1/2時吸取效果翻倍',kit:[
    prop('■ 必中','sure_hit',true,0),seq('消回合成功才禁止對手自身技能回血3回合',[{acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('no_heal',{turns:3,scope:'own_skill'})]}],1),
    seq('當回合未擊敗才給下次自身技能追傷',[{acts:[a('watch',{trig:'phase_end',body:[{cond:[c('nokill',{})],acts:[a('watch',{trig:'self_skill',body:[{acts:[a('dmg',{base:'最大體力',of:'self',ratio:1/3,type:'百分比'})]}]})]}]})]}],2),
    seq('固定體力吸取200，使用前低血翻倍',[{acts:[a('drain',{flat:200,true:false,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})]}],3),
  ]},
  {elfIds:['5023'],name:'安息契',description:'■ 先制-1\n■ 將自身能力下降狀態視為對手處於同等級能力下降狀態\n◇ 攜帶此技能則該技能每次PP值被消耗時：\n> 令對手所有攻擊技能PP值歸0\n> 2回合內對手屬性技能無效且無法附加自身異常狀態\n> 額外消耗自身所有技能1點PP值\n> 附加自身最大體力40%的百分比傷害並恢復自身等量體力，對手體力高於最大體力½時效果翻倍\n> 下次擊敗對手時100%令對手下隻出戰精靈詛咒',kit:[
    prop('■ 先制-1','base_priority',-1,0),query('■ 自身下降視為對手下降','stage_view','self_down_as_opp_down',1),
    at('pp_consumed','pp_consumed','◇ 本槽PP被消耗時',[{acts:[a('pp_zero',{kind:'攻擊'}),a('invalid_turns',{turns:2,kind:'屬性'}),a('immune_status_turns',{turns:2,cls:'',reflect:false}),a('pp_op',{side:'self',mode:'reduce',amount:1})]},
      {live:true,cond:[c('hp_ratio',{side:'opp',op:'高於',ratio:.5})],acts:[a('dmg',{base:'最大體力',of:'self',ratio:.8,type:'百分比'}),a('heal_equal',{})],elseActs:[a('dmg',{base:'最大體力',of:'self',ratio:.4,type:'百分比'}),a('heal_equal',{})]},
      {acts:[a('watch',{trig:'kill',body:[{acts:[a('next_entry_status',{status:'詛咒',turns:3})]}]})]}],2,'carried'),
  ]},
  {elfIds:['300','5000'],name:'虛無',description:'■ 必中\n🎯 2回合內若自身先出手，則對手技能失效',kit:[
    prop('■ 必中','sure_hit',true,0),hit('2回合內先出手則對手技能失效',[{acts:[a('timed',{turns:2,from:'now',trig:'self_skill',initial:true,body:[{cond:[c('first',{})],acts:[a('invalid_next',{uses:1,kind:''})]}]})]}],1),
  ]},
  {elfIds:['5000'],name:'聖光吟誦',description:'■ 必中\n🎯 命中後100%令對手疲憊，未觸發則對手2回合內屬性技能無效\n🎯 4回合內，受到攻擊則減少對手最大體力的1/3\n🎯 下2回合對手受到的傷害提高150%',kit:[
    prop('■ 必中','sure_hit',true,0),hit('命中後疲憊，失敗則屬性技能無效',[{acts:[a('status',{side:'opp',status:'疲憊',turns:3,chance:100})]},{chain:'fail',acts:[a('invalid_turns',{turns:2,kind:'屬性'})]}],1),
    hit('4回合內受到攻擊則附加對手最大體力1/3',[{acts:[timed(4,'damaged_attack',[{acts:[a('dmg',{base:'最大體力',of:'opp',ratio:1/3,type:'百分比'})]}])]}],2),
    seq('下2回合對手受到攻擊傷害+150%',[{acts:[a('dmg_mod_turns',{side:'opp',dir:'taken',boost:1.5,turns:2,next:true,kind:'攻擊'})]}],3),
  ]},
  {elfIds:['5023'],name:'影契·噬滅',description:'■ 對手處於能力提升狀態時先制+1\n■ 將對手能力提升狀態視為能力下降狀態\n◇ 攜帶此技能則該技能每次PP值被消耗時：\n> 消除雙方回合類效果、能力提升、下降狀態\n> 100%令雙方同時進入害怕、詛咒異常狀態\n> 令對手全屬性-1\n> 吸取對手最大體力¼，自身體力低於最大體力½時效果翻倍',kit:[
    query('■ 對手處於能力提升狀態時先制+1','base_priority',1,0,[c('stage',{side:'opp',kind:'up'})]),
    query('■ 將對手能力提升狀態視為能力下降狀態','stage_view','opp_up_as_down',1),
    at('pp_consumed','pp_consumed','◇ 本技能PP被消耗時',[{acts:[a('clear_turn',{side:'both'}),a('stat_clear',{side:'both',kind:'all'}),
      a('status',{side:'both',status:'害怕',turns:3,chance:100}),a('status',{side:'both',status:'詛咒',turns:3,chance:100}),
      a('stat',{side:'opp',stats:['全屬性'],v:-1}),a('drain',{ratio:1/4,true:false,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})]}],2,'carried'),
  ]},
  {elfIds:['5002'],name:'帝永壁令',description:'■ 必中\n🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍\n🎯 4回合內每回合使用技能後恢復自身最大體力1/3，並將恢復量的50%轉化為護盾\n🎯 自身免疫下2次異常狀態\n🎯 下2回合所有技能先制+2',kit:[
    prop('■ 必中','sure_hit',true,0),seq('全屬性+1，提升時翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('stage',{side:'self',kind:'up'})})]}],1),
    hit('4回合內每回合使用技能後回血並轉護盾',[{acts:[timed(4,'self_after_use',[{acts:[a('heal',{side:'self',ratio:1/3}),a('shield_from_last',{ratio:.5})]}])]}],2),
    seq('免疫下2次異常',[{acts:[a('immune_status_count',{count:2,reflect:false})]}],3),seq('下2回合先制+2',[{acts:[a('prio_turns',{turns:2,v:2})]}],4),
  ]},
  {elfIds:['5001'],name:'陰世遊靈',description:'■ 必中\n🎯 全屬性+1\n🎯 4回合內每回合使用技能後恢復自身最大體力1/2\n🎯 下3回合自身攻擊技能附加250點真實傷害\n🎯 下2回合所有技能先制+2',kit:[
    prop('■ 必中','sure_hit',true,0),seq('全屬性+1',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1})]}],1),
    hit('4回合內每回合使用後恢復1/2',[{acts:[timed(4,'self_after_use',[{acts:[a('heal',{side:'self',ratio:.5})]}])]}],2),
    hit('下3回合攻擊附加250真實傷害',[{acts:[timed(3,'self_attack',[{acts:[a('dmg',{flat:250,type:'真實'})]}],'next')]}],3),
    seq('下2回合先制+2',[{acts:[a('prio_turns',{turns:2,v:2})]}],4),
  ]},
  {elfIds:['300','5000'],name:'靈魂干涉',description:'■ 命中率70%\n🎯 命中時100%令對手疲憊2回合',kit:[
    query('■ 命中率70%','base_accuracy',70,0),hit('命中時100%疲憊2回合',[{acts:[a('status',{side:'opp',status:'疲憊',turns:2,chance:100})]}],1),
  ]},
  {elfIds:['5011'],name:'星光·粉末擊打',description:'命中後100%使對手寄生，未觸發則附加自身最大體力值1/4的百分比傷害；命中則100%使對手中毒，未觸發則附加200點固定傷害。',kit:[
    hit('命中後寄生，未觸發附加自身1/4百分比傷害',[{acts:[a('status',{side:'opp',status:'寄生',turns:3,chance:100})]},{chain:'fail',acts:[a('dmg',{base:'最大體力',of:'self',ratio:.25,type:'百分比'})]}],0),
    hit('命中後中毒，未觸發附加200固定傷害',[{acts:[a('status',{side:'opp',status:'中毒',turns:3,chance:100})]},{chain:'fail',acts:[a('dmg',{flat:200,type:'固定'})]}],1),
  ]},
  {elfIds:['5011'],name:'寄生種子',description:'5回合吸取對方最大體力的1/8（對草系無效）。',kit:[
    hit('非草系對手5回合每回合吸取1/8',[{cond:[c('type_is',{side:'opp',type:'草',neg:true})],acts:[timed(5,'self_skill',[{acts:[a('drain',{ratio:1/8,true:false})]}])]}],0),
  ]},
  {elfIds:['5034'],name:'妖靈天性',description:'■ 必中\r\n🎯 全屬性+1，對手處於異常狀態時強化狀態翻倍\r\n🎯 4回合內吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍\r\n🎯 下2回合自身所有技能先制+2',kit:[
    prop('■ 必中','sure_hit',true,0),seq('全屬性+1，對手異常時翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('abnormal',{side:'opp'})})]}],1),
    // 妖靈天性為屬性技能（威力0），不會「命中」；原本誤用 hit(on_hit) 使該句永不觸發，改為正式使用時點。
    seq('4回合吸取1/3，低於半血即時翻倍',[{acts:[timed(4,'self_skill',[{acts:[a('drain',{ratio:1/3,true:false,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})]}])]}],2),
    seq('下2回合先制+2',[{acts:[a('prio_turns',{turns:2,v:2})]}],3),
  ]},
  {elfIds:['5031'],name:'界・裁決之劍',description:'■ 先制+3\n■ 命中率99%\n🎯 若自身處於能力下降狀態則先制+1且必定命中\n🎯 消除對手回合類效果，消除成功則令對手疲憊\n🎯 消除對手能力提升狀態，消除成功則對手失明\n🎯 反轉自身能力下降狀態，反轉成功則恢復自身最大體力1/3',kit:[
    prop('■ 先制+3','base_priority',3,0),query('■ 命中率99%','base_accuracy',99,1),
    {codeId:'skill_property',node:'modify_priority',source:'skill',role:'attached',order:2,customText:'下降時額外先制+1',params:{property:'conditional_priority',value:1,conditions:[c('stage',{side:'self',kind:'down'})]}},
    // 同一句的必中也是附加條件；不可提升為免附加封印的固有必中。
    {codeId:'skill_property',node:'before_skill',source:'skill',role:'attached',order:3,customText:'下降時必定命中',params:{property:'conditional_sure_hit',value:true,conditions:[c('stage',{side:'self',kind:'down'})]}},
    seq('消回合成功則疲憊',[{acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('status',{side:'opp',status:'疲憊',turns:3,chance:100})]}],4),
    seq('消提升成功則失明',[{acts:[a('stat_clear',{side:'opp',kind:'up'})]},{chain:'success',acts:[a('status',{side:'opp',status:'失明',turns:3,chance:100})]}],5),
    seq('反轉下降成功則恢復1/3',[{acts:[a('stat_reverse',{side:'self',kind:'down'})]},{chain:'success',acts:[a('heal',{side:'self',ratio:1/3})]}],6),
  ]},
];
