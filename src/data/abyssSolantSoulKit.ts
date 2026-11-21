import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
import {BLAKE_NAMES,symbiosisEntries,doubleShadowEntries,reapplyShadow} from './shadowPairKit';
import {PURE_SHADOW_ITEM_ID} from './shadowPairItems';
/** 虯螭淵玄.索蘭特（5054）專屬特性「淵」；只用通用積木，引擎不含本精靈名稱。 */
const soul=(text:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(text,trig,body,order,'soulmark',true,cond);
const onField=c('owner_on_field',{});
const CALM='solantCalmRound';

export const ABYSS_SOLANT_SOUL_KIT=[
 ...symbiosisEntries(BLAKE_NAMES,0),
 reapplyShadow(2),
 ...doubleShadowEntries(3),
 soul('每次登場時剝離自身暗影系轉化為純粹暗影作為特殊道具加入己方道具欄位；剝離成功則令自身下次受到的技能傷害轉化為等量護盾、護罩','entrance',[
  {cond:[c('type_is',{side:'self',type:'暗影'})],acts:[a('change_type',{side:'self',type:'龍',untilSwitch:true})]},
  {chain:'success',acts:[a('grant_item',{side:'self',itemId:PURE_SHADOW_ITEM_ID,count:1}),a('timed_uses',{uses:1,trig:'incoming_skill',label:'淵·傷害轉護盾',body:[act(a('incoming_skill_to_shields',{}))]})]},
 ],5),
 soul('自身在場期間：自身無視對手能力提升狀態','self_skill',[act(a('ignore',{what:'能力提升'}))],6),
 soul('自身在場期間：自身每次造成技能傷害時吸取對手傷害量100%的體力','self_skill',[act(a('vampire',{ratio:1,kind:'技能'}))],7),
 soul('自身在場期間：每次受到技能傷害後則消除對手能力提升狀態，消除成功則100%令對手害怕','damaged_skill',[
  act(a('stat_clear',{side:'opp',kind:'up'})),{chain:'success',acts:[a('status',{side:'opp',status:'害怕',chance:100})]},
 ],8),
 soul('記錄本回合是否受到技能傷害','round_end',[
  {cond:[c('no_skill_dmg',{kind:'技能'})],acts:[a('flag_set',{key:CALM,value:true})],elseActs:[a('flag_set',{key:CALM,value:false})]},
 ],9),
 soul('回合開始時若上回合未受到技能傷害：當回合對手屬性技能附加效果失效','round_start',[
  {cond:[c('player_state',{key:CALM,equals:true})],acts:[a('add_invalid_turns',{kind:'屬性',turns:1})]},
 ],10),
 soul('回合開始時若上回合未受到技能傷害：當回合自身使用所有技能先制+1且無視對手同等級先制','modify_priority',[
  {cond:[c('player_state',{key:CALM,equals:true})],acts:[a('prio_bonus',{v:1}),a('priority_offset_round',{amount:1})]},
 ],11),
 soul('自身每回合結束時恢復自身擁有護盾、護罩總和100%的體力','round_end',[act(a('heal_shield_sum',{ratio:1}))],12),
 soul('自身不在場期間：若己方技能造成非真實傷害前對手存在護盾、護罩，將其變為200，自身受到與變化前差值的真實傷害（最高為自身當前體力-1）','team_before_damage',[
  {cond:[{...onField,p:{neg:true}},c('event_damage_type',{type:'非真實'})],acts:[a('opp_shield_cap_with_cost',{cap:200})]},
 ],13),
];
