import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
import {wushuang} from './zhaoyunSoulKit';
/** 趙雲（5052）技能；每句一個條目，只用通用積木。屬性技能依專案慣例為無屬性。 */
const line=(text:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(text,trig,body,order,'skill',false,cond);
const W=()=>wushuang(),notW=()=>wushuang(true);
const ppLow=(neg=false)=>c('pp_below_either',{amount:2,...(neg?{neg:true}:{})});
const stageUp=(neg=false)=>c('stage',{side:'self',kind:'up',...(neg?{neg:true}:{})});

export const ZY_LIDAN=skill('瀝膽候甘來','光.次元','物理',150,5,0,[
 property('必中','sure_hit',true,0),
 line('處於龍膽世無雙時令對手害怕，附加失敗則該次傷害提升7倍','use',[{cond:[W()],acts:[a('status',{side:'opp',status:'害怕',chance:100})]},{chain:'fail',cond:[W()],acts:[a('boost',{mult:7,kind:'攻擊'})]}],1),
 line('未擊敗對手則恢復自身所有PP值','not_killed',[act(a('pp_op',{side:'self',mode:'recover'}))],2),
 line('擊敗對手則將對手能力提升效果轉移到自身身上，能力下降效果反轉並附加到自身身上','kill',[act(a('stage_absorb_all',{}))],3),
 line('擊敗對手則對手下隻出場精靈3回合內先制-3','kill',[act(a('prio_turns',{side:'opp',turns:3,v:-3}))],4),
 line('擊敗對手時自身處於能力提升狀態則能力提升等級翻倍','kill',[{cond:[stageUp()],acts:[a('stage_scale_up',{mult:2})]}],5),
],{sure:true});
export const ZY_BAIZHAN=skill('百戰無傷','無屬性','屬性',0,5,0,[
 property('必中','sure_hit',true,0),
 line('全屬性+1，自身處於能力提升時強化效果翻倍','use',[{pre:true,cond:[stageUp()],acts:[a('stat',{side:'self',stats:['全屬性'],v:2})],elseActs:[a('stat',{side:'self',stats:['全屬性'],v:1})]}],1),
 line('5回合內免疫並反彈所有受到的異常狀態','use',[act(a('immune_status_turns',{turns:5,reflect:true,cls:''}))],2),
 line('5回合內自身不受能力下降技能影響','use',[act(a('immune_statdown_turns',{turns:5}))],3),
 line('下2回合所有技能先制+2','use',[act(a('prio_turns',{turns:2,v:2,next:true}))],4),
 line('處於龍膽世無雙時3回合內自身回合類效果無法被消除','use',[{cond:[W()],acts:[a('turn_key_set',{key:'turnEffectsUnclearableTurns',turns:3,side:'self',label:'回合類效果無法被消除'})]}],5),
],{sure:true});
export const ZY_GUDAN=skill('孤膽映青釭','光.次元','物理',90,20,3,[
 property('先制+3','base_priority',3,0),
 property('必中','sure_hit',true,1),
 line('無視對手免疫傷害效果','self_attack',[act(a('ignore',{what:'免疫'}))],2),
 line('無視對手能力提升效果','self_attack',[act(a('ignore',{what:'能力提升'}))],3),
 // 「雙方任意一方技能PP小於2」→翻倍；龍膽世無雙時取消觸發條件（直接翻倍）。
 line('吸取對手250點體力，雙方任意一方技能PP小於2則吸取效果翻倍','use',[
  {cond:[W()],acts:[a('drain',{flat:500})]},
  {cond:[notW(),ppLow()],acts:[a('drain',{flat:500})]},
  {cond:[notW(),ppLow(true)],acts:[a('drain',{flat:250})]},
 ],4),
 line('技能威力提升77%，雙方任意一方技能PP小於2則提升效果翻倍','use',[
  {cond:[W()],acts:[a('boost',{mult:2.54,power:true,kind:'攻擊'})]},
  {cond:[notW(),ppLow()],acts:[a('boost',{mult:2.54,power:true,kind:'攻擊'})]},
  {cond:[notW(),ppLow(true)],acts:[a('boost',{mult:1.77,power:true,kind:'攻擊'})]},
 ],5),
],{sure:true});
export const ZY_CHANGYING=skill('長纓破陣','無屬性','屬性',0,5,0,[
 property('必中','sure_hit',true,0),
 line('5回合內每回合吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍','use',[act(a('timed',{turns:5,from:'now',trig:'round_end',label:'長纓破陣·吸取',body:[
  act(a('drain',{ratio:1/3,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})),
 ]}))],1),
 line('自身下3回合攻擊威力翻倍','use',[act(a('power_ratio_turns',{side:'self',ratio:2,turns:3,bound:true}))],2),
 line('5回合內自身每處於1項能力提升附加77點固定傷害（每有1枚龍膽視為1項）；龍膽世無雙時改為真實傷害','use',[act(a('timed',{turns:5,from:'now',trig:'self_after_skill',label:'長纓破陣·附加',body:[
  {cond:[W()],acts:[a('dmg_per_stage_items',{flat:77,type:'真實',perMarkId:'zyGall'})]},
  {cond:[notW()],acts:[a('dmg_per_stage_items',{flat:77,type:'固定',perMarkId:'zyGall'})]},
 ]}))],3),
 line('處於龍膽世無雙時3回合內自身附加的所有固定傷害及百分比傷害轉化為真實傷害','use',[{cond:[W()],acts:[a('incoming_true_turns',{turns:3})]}],4),
],{sure:true});
export const ZY_CHIDAN_SPEAR=skill('赤膽綴銀槍','光.次元','物理',160,5,0,[
 property('必中','sure_hit',true,0),
 line('處於龍膽世無雙時對敵方場下精靈造成77點固定傷害，每有1個精靈免疫此次攻擊傷害提升7倍','use',[{cond:[W()],acts:[a('bench_probe_boost',{flat:77,type:'fixed',mult:7})]}],1),
 line('消除對手回合效果，消除成功附加250點真實傷害','use',[act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('dmg',{flat:250,type:'真實'})]}],2),
 line('3回合內使用技能時100%令對手害怕且能力提升效果無法被消除和吸取','use',[
  act(a('timed',{turns:3,from:'now',trig:'self_skill',initial:true,label:'赤膽綴銀槍·害怕',body:[act(a('status',{side:'opp',status:'害怕',chance:100}))]})),
  act(a('turn_key_set',{key:'statBoostUnclearableTurns',turns:3,side:'self',label:'能力提升無法被消除和吸取'})),
 ],3),
 line('先出手時吸取對手最大體力的1/4且對手無法造成攻擊傷害','use',[{cond:[c('first')],acts:[a('drain',{ratio:1/4}),a('attack_damage_lock',{turns:1,kind:'all'})]}],4),
],{sure:true,fifth:true});
/** 備選技能（2026-11-22）：豪膽鎮沙場 光次元物攻 85 PP20。用語依原文：先制+3、必中、解除下降→對手隨機3技能PP歸零、吸取提升→下1回合先制+3、龍膽世無雙時令對手空定、附加失敗則傷害提升7倍。 */
export const ZY_HAODAN=skill('豪膽鎮沙場','光.次元','物理',85,20,3,[
 property('先制+3','base_priority',3,0),
 property('必中','sure_hit',true,1),
 line('解除自身能力下降狀態，解除成功則使對手隨機3個技能PP值歸零','use',[
  act(a('stat_clear',{side:'self',kind:'down'})),
  {chain:'success',acts:[a('pp_zero_random',{count:3})]},
 ],2),
 line('吸取對手能力提升狀態，吸取成功則自身下1回合先制+3','use',[
  act(a('stat_steal',{mode:'吸取'})),
  {chain:'success',acts:[a('prio_turns',{turns:1,v:3,next:true})]},
 ],3),
 line('處於龍膽世無雙時令對手空定，附加失敗則該次傷害提升7倍','use',[
  {cond:[W()],acts:[a('status',{side:'opp',status:'空定',chance:100})]},
  {chain:'fail',cond:[W()],acts:[a('boost',{mult:7,kind:'攻擊'})]},
 ],4),
],{sure:true,labelEffects:true});
export const ZHAOYUN_SKILLS=[ZY_LIDAN,ZY_BAIZHAN,ZY_GUDAN,ZY_CHANGYING,ZY_CHIDAN_SPEAR,ZY_HAODAN];
