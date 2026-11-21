import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
import {SHADOW_MARK,BLAKE_NAMES,SOLANT_NAMES,symbiosisEntries,doubleShadowEntries,reapplyShadow} from './shadowPairKit';
/** 晻藹夜靈.布萊克（5053）專屬特性；只用通用積木，引擎不含本精靈名稱。 */
const soul=(text:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(text,trig,body,order,'soulmark',true,cond);
const abnormal=c('abnormal',{side:'self'});

export const DARK_BLAKE_SOUL_KIT=[
 ...symbiosisEntries(SOLANT_NAMES,0),
 soul('戰鬥開始時附加己方所有布萊克、索蘭特任意型態1道雙重暗影','battle_start',[act(a('resource_mark_team_named',{names:[...BLAKE_NAMES,...SOLANT_NAMES],amount:1,onlyIfMissing:true,...SHADOW_MARK}))],2),
 reapplyShadow(3),
 ...doubleShadowEntries(4),
 // 對手選擇技能時（本專案在選擇後、先後手判斷前的回合開始結算）
 soul('對手選擇技能時：2回合內對手所有技能命中率歸0、自身100%閃避對手的技能','round_start',[
  {cond:[c('opp_selected',{kind:'技能'})],acts:[a('evade_turns',{turns:2,chance:100,kind:'all'})]},
 ],6),
 soul('對手選擇技能時：對手使用技能後解除自身異常狀態並附加自身狂暴異常3回合','opp_after_skill',[act(a('cure_status',{side:'self'}),a('status',{side:'self',status:'狂暴',turns:3,chance:100}))],7),
 soul('若對手選擇使用必中技能：自身受到非真實傷害降低80%，下次自身使用攻擊技能時造成的非真實傷害提升160%；雙方每處於1種異常狀態則上述效果翻倍（至多10次）','round_start',[
  {cond:[c('opp_selected',{kind:'技能'}),c('opp_selected_sure')],acts:[a('status_doubling_mods',{reduce:.8,boost:1.6,cap:10})]},
 ],8),
 soul('若對手使用技能未命中或未選擇使用攻擊技能：自身下次攻擊汲取對手自身攻擊值80%的體力','opp_after_skill',[
  {cond:[c('fail_kind',{kind:'miss'})],acts:[a('timed_uses',{uses:1,trig:'self_attack',label:'夜靈·汲取',body:[act(a('drain',{base:'stat:攻擊',of:'self',ratio:.8}))]})]},
  {cond:[c('fail_kind',{kind:'evade'})],acts:[a('timed_uses',{uses:1,trig:'self_attack',label:'夜靈·汲取',body:[act(a('drain',{base:'stat:攻擊',of:'self',ratio:.8}))]})]},
 ],9),
 soul('若對手未選擇使用攻擊技能：自身下次攻擊汲取對手自身攻擊值80%的體力','round_start',[
  {cond:[c('opp_selected',{kind:'屬性'})],acts:[a('timed_uses',{uses:1,trig:'self_attack',label:'夜靈·汲取',body:[act(a('drain',{base:'stat:攻擊',of:'self',ratio:.8}))]})]},
  {cond:[c('opp_selected',{kind:'none'})],acts:[a('timed_uses',{uses:1,trig:'self_attack',label:'夜靈·汲取',body:[act(a('drain',{base:'stat:攻擊',of:'self',ratio:.8}))]})]},
 ],10),
 // 處於異常狀態時
 soul('處於異常狀態時：選擇使用技能不受PP值限制','round_end',[{cond:[abnormal],acts:[a('pp_unlimited_until_switch',{})]}],11),
 soul('處於異常狀態時：每次使用攻擊技能依序令對手束縛、詛咒、害怕，並令對手隨機2個PP值不為0的技能歸0','self_attack',[
  {cond:[abnormal],acts:[a('status_seq',{side:'opp',list:['束縛','詛咒','害怕'],chance:100,turns:3}),a('pp_zero_random',{count:2})]},
 ],12),
 soul('處於異常狀態時：每次使用屬性技能自身抵擋下2次攻擊傷害','self_status',[{cond:[abnormal],acts:[a('block_damage_uses',{uses:2,kind:'攻擊',key:'nightBlakeBlock'})]}],13),
 soul('處於異常狀態時：攻擊技能無視對手傷害限制、攻擊傷害減少降低與傷害抵擋效果','self_attack',[
  {cond:[abnormal],acts:[a('ignore',{what:'傷害限制'}),a('ignore',{what:'百分比減傷'}),a('ignore',{what:'抵擋傷害'})]},
 ],14),
 soul('若處於狂暴狀態時則取消所有非附屬類異常的附加效果','entrance',[act(a('status_rules',{whileStatus:'狂暴',cancelExceptCategory:'AUXILIARY'}))],15),
];
