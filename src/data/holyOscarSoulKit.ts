import {HOLY_OSCAR_SOURCE} from './holyOscarSource';
import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
/** 聖靈奧斯卡（5048）魂印；只用通用積木，引擎不含本精靈名稱。 */
const raw=(prefix:string)=>{const s=HOLY_OSCAR_SOURCE.split(/\r?\n/).find(s=>s.replace(/^>+/,'').startsWith(prefix));if(!s)throw Error(prefix);return s;};
const soul=(prefix:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(raw(prefix),trig,body,order,'soulmark',true,cond);
const FIVE=['麻痺','疲憊','害怕','燒傷','凍傷','中毒'];
const restrict=(p:any)=>a('round_opp_restrict',{priority:-3,...p});

export const HOLY_OSCAR_SOUL_KIT=[
 // 五行之光的祝福：存活於出戰背包（在場或場下）時，己方在場精靈回合開始處於六種異常之一 → 轉給對方在場精靈、解除自身異常、3回合星護。
 soul('五行之光的祝福','team_round_start',[act(a('with_active_elf',{body:[
  act(a('status_hand_over',{statuses:FIVE})),
  {chain:'success',acts:[a('cure_status',{side:'self'}),a('status',{side:'self',status:'星護',turns:3,chance:100})]},
 ]}))],0),
 // 星護存在期間在場精靈先制額外+3（己方在場精靈的先制結算）。
 soul('五行之光的祝福','team_modify_priority',[act(a('with_active_elf',{body:[{cond:[c('has_status',{side:'self',status:'星護'})],acts:[a('prio_bonus',{v:3})]}]}))],1),
 // 選擇技能階段：所有技能不受PP值限制、必定命中。
 soul('令自身所有技能不受PP值限制必定命中','entrance',[act(a('pp_unlimited_until_switch',{}))],2),
 soul('令自身所有技能不受PP值限制必定命中','before_skill',[act(a('sure_hit',{}))],3),
 // 使用技能後吸取本次技能傷害50%（最低300）；觸發最低或對手體力未減少 → 300真實＋下回合吸取與技能傷害翻倍。
 e(raw('自身使用技能後吸取對手受到技能傷害值50%')+'\n'+raw('最低吸取300點')+'\n'+raw('若觸發最低吸取效果'),'self_after_use',[act(a('drain_checked_then',{
  basis:'skill_damage',ratio:.5,floor:300,belowOnFloor:true,type:'固定',threshold:1,measure:'lost',belowBody:[act(
   a('dmg',{flat:300,type:'真實'}),
   a('drain_mult_turns',{mult:2,turns:1,next:true}),
   a('dmg_mod_turns',{dir:'out',kind:'技能',boost:1,turns:1,next:true}),
  )],
 }))],4,'soulmark',true),
 // 回合開始時（本專案在選擇後、先後手判斷前結算）：對手選擇技能 → 當回合先制調整為-3；攻擊且克制自身 → 失去本系與屬性克制；屬性 → 附加效果失效。
 e(raw('若對手選擇技能則令對手當回合先制等級調整為先制-3')+'\n'+raw('若該技能為攻擊技能')+'\n'+raw('若該技能為屬性技能'),'modify_priority',[
  {cond:[c('opp_selected',{kind:'攻擊',advantage:true})],acts:[restrict({stabDisabled:true,typeAdvantageDisabled:true})]},
  {cond:[c('opp_selected',{kind:'攻擊',advantage:false})],acts:[restrict({})]},
  {cond:[c('opp_selected',{kind:'屬性'})],acts:[restrict({addInvalid:'all'})]},
 ],5,'soulmark',true),
 soul('若對手當回合未選擇技能則下回合無法主動切換精靈','phase_end',[{cond:[c('opp_selected',{kind:'none'})],acts:[a('no_switch',{turns:1,next:true})]}],6),
 soul('若對手當回合選擇技能則所有技能PP值-2','phase_end',[{cond:[c('opp_selected',{kind:'技能'})],acts:[a('pp_op',{side:'opp',mode:'reduce',amount:2})]}],7),
];
