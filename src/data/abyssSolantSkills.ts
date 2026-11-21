import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';
/** 虯螭淵玄.索蘭特（5054）技能；每句一個條目，只用通用積木。屬性技能依專案慣例為無屬性。 */
const line=(text:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(text,trig,body,order,'skill',false,cond);
const noLoss=c('last_no_dmg');
const oppAbn=c('abnormal',{side:'opp'});

export const SL_CANDLE=skill('銜燭令','龍','特殊',85,20,3,[
 property('先制+3','base_priority',3,0),
 line('對手處於異常狀態時先制+1','modify_priority',[{cond:[oppAbn],acts:[a('prio_bonus',{v:1})]}],1),
 line('對手處於異常狀態時必定命中','before_skill',[{cond:[oppAbn],acts:[a('sure_hit',{})]}],2),
 line('消除對手回合類效果，消除成功則依序令對手束縛、害怕、疲憊','use',[
  act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('status_seq',{side:'opp',list:['束縛','害怕','疲憊'],chance:100,turns:3})]},
 ],3),
 line('解除雙方異常狀態，解除成功則對手5回合內無法附加雙方異常狀態、無法進入異常狀態，且2回合內攻擊技能無效','use',[
  act(a('cure_status',{side:'self'}),a('cure_status',{side:'opp'})),
  {chain:'success',acts:[a('status_inflict_guard_turns',{side:'opp',kind:'all',turns:5}),a('status_entry_block_turns',{side:'opp',turns:5}),a('invalid_turns',{kind:'攻擊',turns:2,next:false})]},
 ],4),
]);
export const SL_CHANT=skill('虯吟幽都','無屬性','屬性',0,5,0,[
 property('必中','sure_hit',true,0),
 line('5回合內免疫並反彈所有受到的異常狀態','use',[act(a('immune_status_turns',{turns:5,reflect:true,cls:''}))],1),
 line('5回合內每回合使用技能後吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，對手受到此百分比傷害後體力未減少則附加300點真實傷害','use',[act(a('timed',{turns:5,from:'now',trig:'self_after_skill',label:'虯吟幽都·吸取',body:[
  act(a('drain',{ratio:1/3,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:.5})})),
  {cond:[noLoss],acts:[a('dmg',{flat:300,type:'真實'})]},
 ]}))],2),
 line('3回合內每回合100%閃避對手攻擊，效果結束後恢復自身最大體力1/1與所有技能全部PP值','use',[
  act(a('evade_turns',{turns:3,chance:100,kind:'攻擊',onExpire:[act(a('heal',{side:'self',ratio:1}),a('pp_op',{side:'self',mode:'recover'}))]})),
 ],3),
 line('3回合內若受到攻擊則有100%機率令對手害怕，未觸發則使對手隨機1項技能PP值歸零','use',[act(a('timed',{turns:3,from:'now',trig:'damaged_attack',label:'虯吟幽都·害怕',body:[
  act(a('status',{side:'opp',status:'害怕',chance:100})),{chain:'fail',acts:[a('pp_zero_random',{count:1})]},
 ]}))],4),
],{sure:true});
export const SL_COIL=skill('螭影蟠淵','無屬性','屬性',0,5,0,[
 property('必中','sure_hit',true,0),
 line('全屬性+1，自身不處於能力強化狀態時強化效果翻倍','use',[{pre:true,cond:[c('stage',{side:'self',kind:'up',neg:true})],acts:[a('stat',{side:'self',stats:['全屬性'],v:2})],elseActs:[a('stat',{side:'self',stats:['全屬性'],v:1})]}],1),
 line('令自身免疫下2次受到的異常狀態（下場後消失），免疫成功則吸取對手300點體力','use',[act(
  a('immune_status_count',{count:2,reflect:false,persistsOffField:false}),
  a('timed_uses',{uses:2,trig:'status_immune',label:'螭影蟠淵·免疫吸取',body:[act(a('drain',{flat:300}))]}),
 )],2),
 line('為自身附加500點的護盾','use',[act(a('shield',{flat:500}))],3),
 line('命中後100%令對手進入魘昧，未觸發則下2回合對手正先制效果失效','use',[
  act(a('status',{side:'opp',status:'魘昧',chance:100})),{chain:'fail',acts:[a('no_pos_prio_turns',{turns:2,next:true})]},
 ],4),
 line('下2回合對手受到的技能傷害提高150%','use',[act(a('dmg_mod_turns',{side:'opp',dir:'taken',kind:'技能',boost:1.5,turns:2,next:true}))],5),
 line('下2回合自身所有技能先制+2','use',[act(a('prio_turns',{turns:2,v:2,next:true}))],6),
],{sure:true});
export const SL_SCALE=skill('玄鱗寂夜','龍','特殊',150,5,0,[
 property('必中','sure_hit',true,0),
 line('隨機吸取200～300固定體力，遇天敵時吸取效果翻倍','use',[
  {cond:[c('enemy')],acts:[a('drain_random',{min:400,max:600})],elseActs:[a('drain_random',{min:200,max:300})]},
 ],1),
 line('恢復自身所有技能5點PP值','use',[act(a('pp_op',{side:'self',mode:'add',amount:5}))],2),
 line('命中後令雙方當前所有能力等級隨機變化為+3至-1','use',[act(a('stage_randomize',{min:-1,max:3}))],3),
 line('5回合內對手每次執行恢復體力效果改為體力上限-50','use',[act(a('recovery_backlash_turns',{side:'opp',amount:50,turns:5}))],4),
 line('未擊敗對手則使自身下2次受到的技能傷害減少300點','not_killed',[act(a('flat_reduction_uses',{uses:2,flat:300,kind:'技能'}))],5),
],{sure:true});
export const SL_NETHER=skill('幽冥無日國','龍','特殊',160,5,0,[
 property('必中','sure_hit',true,0),
 line('擁有護盾時技能威力翻倍','use',[{cond:[c('shield',{side:'self'})],acts:[a('boost',{mult:2,power:true,kind:'攻擊'})]}],1),
 line('與對手交換自身低於對手的能力等級，交換成功則100%令對手害怕；觸發後對手處於能力下降則自身無效下次對手的攻擊技能；觸發後自身處於能力提升狀態則吸取對手最大體力⅓','use',[
  act(a('stage_swap_lower',{})),
  {chain:'success',acts:[a('status',{side:'opp',status:'害怕',chance:100})]},
  {chain:'success',live:true,cond:[c('stage',{side:'opp',kind:'down'})],acts:[a('invalid_next',{kind:'攻擊',uses:1})]},
  {chain:'success',live:true,cond:[c('stage',{side:'self',kind:'up'})],acts:[a('drain',{ratio:1/3})]},
 ],2),
 line('消除對手回合類效果，消除成功則對手下2回合無法主動切換精靈','use',[
  act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('no_switch',{turns:2,next:true})]},
 ],3),
 line('擊敗對手則對手下隻出場精靈在場前3回合內所有技能附加效果失效','kill',[act(a('add_invalid_turns',{kind:'all',turns:3,next:true}))],4),
],{sure:true,fifth:true});
export const ABYSS_SOLANT_SKILLS=[SL_CANDLE,SL_CHANT,SL_COIL,SL_SCALE,SL_NETHER];
