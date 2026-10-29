import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a,property,sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const c=(name:string,p:any)=>({c:name,p,label:name});
const at=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number):KitEntry=>({...sequence(raw,body,order),node,params:{clause:{raw,trig,parsed:true,body}}});
const innate=(raw:string,op:string,p:any,order:number):KitEntry=>({...sequence(raw,[{acts:[a(op,p)]}],order),role:'innate'});
export const MIGRATED_FEEDBACK_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5010'],name:'星光·克制',description:'先制-6；必中；反彈 2 倍的傷害給對手並使自身恢復等量體力；造成的傷害低於 200 則自身下 1 次受到的傷害降低 300 點',kit:[
    property('先制-6','base_priority',-6,0),property('必中','sure_hit',true,1),
    sequence('反彈 2 倍的傷害給對手並使自身恢復等量體力；造成的傷害低於 200 則自身下 1 次受到的傷害降低 300 點',[
      {acts:[a('reflect_received_damage',{ratio:2,type:'技能'})]},
      {cond:[c('last_amount',{op:'低於',amount:200})],acts:[a('flat_reduction_uses',{uses:1,flat:300,kind:'非真實'})]},
      {acts:[a('heal_equal',{})]},
    ],2),
  ],
},{
  elfIds:['arena_14'],name:'極武稜殺',description:'■ 無視傷害限制效果\n🎯 未擊敗對手，則下回合造成的傷害提升 65%\n🎯 當回合擊敗對手，令對手下一隻登場精靈所有技能 PP 歸零',kit:[
    innate('■ 無視傷害限制效果','ignore',{what:'傷害限制'},0),
    at('on_hit','after_hit','🎯 未擊敗對手，則下回合造成的傷害提升 65%',[{cond:[c('nokill',{})],acts:[a('dmg_mod_turns',{side:'self',turns:1,next:true,dir:'out',kind:'',boost:.65})]}],1),
    at('on_kill','kill','🎯 當回合擊敗對手，令對手下一隻登場精靈所有技能 PP 歸零',[{acts:[a('next_entry_pp_zero',{})]}],2),
  ],
},{
  elfIds:['5030'],name:'八荒憫淚',description:'■ 必中\n🎯 5回合內免疫並反彈所有受到的異常狀態\n🎯 5回合內若對手使用攻擊技能則100%使對手疲憊\n🎯 對手下2次使用屬性技能，則附加對手300點真實傷害\n🎯 免疫下1次受到的攻擊',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 5回合內免疫並反彈所有受到的異常狀態',[{acts:[a('immune_status_turns',{turns:5,reflect:true,cls:''})]}],1),
    sequence('🎯 5回合內若對手使用攻擊技能則100%使對手疲憊',[{acts:[a('timed',{turns:5,from:'now',trig:'opp_attack',body:[{acts:[a('status',{side:'opp',status:'疲憊',chance:100})]}]})]}],2),
    sequence('🎯 對手下2次使用屬性技能，則附加對手300點真實傷害',[{acts:[a('timed_uses',{uses:2,trig:'opp_status',body:[{acts:[a('dmg',{flat:300,type:'真實'})]}]})]}],3),
    sequence('🎯 免疫下1次受到的攻擊',[{acts:[a('immune_attack_count',{count:1})]}],4),
  ],
},{
  elfIds:['5025'],name:'懼噬・恐源浸染',description:'■ 先制+3\n■ 對手處於能力提升狀態則先制+1且必定命中\n🎯 成功命中則恢復自身全部體力\n🎯 反轉對手能力上升狀態，反轉失敗則消除對手能力提升狀態\n🎯 3回合內對手無法恢復體力且屬性技能附加效果失效',kit:[
    property('■ 先制+3','base_priority',3,0),
    {...property('■ 對手處於能力提升狀態則先制+1','base_priority',1,1),params:{property:'base_priority',value:1,conditions:[c('stage',{side:'opp',kind:'up'})]}},
    {...property('■ 對手處於能力提升狀態則必定命中','sure_hit',true,2),params:{property:'sure_hit',value:true,conditions:[c('stage',{side:'opp',kind:'up'})]}},
    at('on_hit','after_hit','🎯 成功命中則恢復自身全部體力',[{acts:[a('heal',{side:'self',ratio:1})]}],3),
    sequence('🎯 反轉對手能力上升狀態，反轉失敗則消除對手能力提升狀態',[{acts:[a('stat_reverse',{side:'opp',kind:'up'})]},{chain:'fail',acts:[a('stat_clear',{side:'opp',kind:'up'})]}],4),
    sequence('🎯 3回合內對手無法恢復體力且屬性技能附加效果失效',[{acts:[a('no_heal',{turns:3}),a('add_invalid_turns',{turns:3,kind:'屬性'})]}],5),
  ],
},{
  elfIds:['5014'],name:'純白聖翎',description:'■ 先制+3\n🎯 消除對手能力提升狀態，消除成功則令對手所有攻擊技能PP值歸0\n🎯 3回合內對手屬性技能無效且使用後令該技能PP值歸0\n🎯 技能無效時恢復自身最大體力½且下次受到異常狀態時轉化為星贖',kit:[
    property('■ 先制+3','base_priority',3,0),
    sequence('🎯 消除對手能力提升狀態，消除成功則令對手所有攻擊技能PP值歸0',[{acts:[a('stat_clear',{side:'opp',kind:'up'})]},{chain:'success',acts:[a('pp_zero',{kind:'攻擊'})]}],1),
    sequence('🎯 3回合內對手屬性技能無效且使用後令該技能PP值歸0',[{acts:[a('invalid_turns',{turns:3,kind:'屬性'}),a('timed',{turns:3,from:'now',trig:'opp_after_status',body:[{acts:[a('pp_zero_selected',{})]}]})]}],2),
    at('on_invalid','on_invalid','🎯 技能無效時恢復自身最大體力½且下次受到異常狀態時轉化為星贖',[{acts:[a('heal',{side:'self',ratio:.5}),a('timed_uses',{uses:1,trig:'before_status',body:[{acts:[a('status_replace',{status:'星贖',durationMode:'keep'})]}]})]}],3),
  ],
},{
  elfIds:['5012'],name:'王·霜祲霞罰',description:'■ 必中\n■ 無視對手護盾效果\n■ 若自身處於能力下降狀態則先制+3\n■ 【精靈王特權】攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）\n🎯 反轉自身能力下降狀態，反轉成功則免疫下1次受到的異常狀態\n🎯 附加自身最大體力40%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/2則恢復效果和百分比傷害翻倍',kit:[
    property('■ 必中','sure_hit',true,0),innate('■ 無視對手護盾效果','ignore',{what:'護盾'},1),
    {...property('■ 若自身處於能力下降狀態則先制+3','base_priority',3,2),params:{property:'base_priority',value:3,conditions:[c('stage',{side:'self',kind:'down'})]}},
    innate('■ 【精靈王特權】攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）','no_resist',{},3),
    sequence('🎯 反轉自身能力下降狀態，反轉成功則免疫下1次受到的異常狀態',[{acts:[a('stat_reverse',{side:'self',kind:'down'})]},{chain:'success',acts:[a('immune_status_count',{count:1,reflect:false})]}],4),
    sequence('🎯 附加自身最大體力40%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/2則恢復效果和百分比傷害翻倍',[{acts:[a('dmg',{base:'最大體力',of:'self',ratio:.4,type:'百分比',x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})}),a('heal_equal',{})]}],5),
  ],
},{
  elfIds:['5014'],name:'王·聖璨天潔',description:'■ 必中\n■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）\n🎯 消除對手回合類效果，消除成功則對手麻痺，未觸發則自身免疫下1次受到的異常狀態\n🎯 附加自身最大體力30%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/3則恢復效果和百分比傷害翻倍\n🎯 附加對手最大體力1/3的百分比傷害，未擊敗對手則恢復自身等量體力值',kit:[
    property('■ 必中','sure_hit',true,0),innate('■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）','no_resist',{},1),
    sequence('🎯 消除對手回合類效果，消除成功則對手麻痺，未觸發則自身免疫下1次受到的異常狀態',[{acts:[a('clear_turn',{side:'opp'})]},{chain:'success',acts:[a('status',{side:'opp',status:'麻痺',chance:100})]},{chain:'fail',acts:[a('immune_status_count',{count:1,reflect:false})]}],2),
    sequence('🎯 附加自身最大體力30%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/3則恢復效果和百分比傷害翻倍',[{acts:[a('dmg',{base:'最大體力',of:'self',ratio:.3,type:'百分比',x2If:c('hp_ratio',{side:'self',op:'低於',ratio:1/3})}),a('heal_equal',{})]}],3),
    at('on_hit','after_hit','🎯 附加對手最大體力1/3的百分比傷害，未擊敗對手則恢復自身等量體力值',[{acts:[a('dmg',{base:'最大體力',of:'opp',ratio:1/3,type:'百分比'})]},{cond:[c('nokill',{})],acts:[a('heal_equal',{})]}],4),
  ],
}];
