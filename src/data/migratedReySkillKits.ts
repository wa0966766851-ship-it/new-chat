import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
import {OTHERWORLD_REY_TEXT} from './otherworldReyDescriptions';
const up=(side:'self'|'opp')=>({c:'stage',p:{side,kind:'up'},label:`${side}能力提升`});
const drain=(ratio:number)=>a('drain',{basis:'attack_damage',ratio,true:false});
const noUp=(side:'self'|'opp')=>({c:'stage',p:{side,kind:'up',neg:true},label:`${side}沒有能力提升`});
const first={c:'first',p:{},label:'先出手'};
const stormDrainText='5回合內吸取對手最大體力½，吸取後未擊敗對手則回合結束時吸取對手最大體力⅓，前述效果造成百分比傷害時對手體力未減少/自身體力未增加則額外附加對手210點真實傷害';
const absorbText='吸取對手等同於自身本次造成技能傷害提升70%的體力值，先出手時效果翻倍，任一方處於能力提升狀態時變為3倍';
const absorbBody=[{cond:[up('self')],acts:[drain(2.1)]},{cond:[noUp('self'),up('opp')],acts:[drain(2.1)]},{cond:[noUp('self'),noUp('opp'),first],acts:[drain(1.4)]},{cond:[noUp('self'),noUp('opp'),{c:'last',p:{},label:'後出手'}],acts:[drain(.7)]}];
export const MIGRATED_REY_SKILL_KITS:ReviewedSequenceSkill[]=[{
 elfIds:['5029'],name:'空墟赫星',description:OTHERWORLD_REY_TEXT.skills['空墟赫星'],kit:[
  property('■ 先制+4','base_priority',4,0),property('■ 必中','sure_hit',true,1),
  sequence('令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1',[{acts:[a('stat',{side:'opp',stats:['全屬性'],v:1,x2If:up('opp')})]}],2),
  {...sequence(absorbText,absorbBody,3),node:'on_hit',params:{clause:{raw:absorbText,trig:'after_hit',parsed:true,body:absorbBody}}},
  sequence('令對手7回合內攻擊技能威力為1/70（綁定對手）',[{acts:[a('power_ratio_turns',{side:'opp',ratio:1/70,turns:7,bound:true})]}],4),
  sequence('2回合內對手攻擊技能無效',[{acts:[a('invalid_turns',{kind:'攻擊',turns:2})]}],5),
 ],
}];
MIGRATED_REY_SKILL_KITS.push({elfIds:['5029'],name:'同塵祭',description:OTHERWORLD_REY_TEXT.skills['同塵祭'],kit:[
 property('■ 必中','sure_hit',true,0),
 sequence('調整自身能力等級，令自身能力等級不會小於對手',[{acts:[a('stat_floor_opponent',{})]}],1),
 sequence('令自身體力歸1',[{acts:[a('hp_set',{side:'self',value:1})]}],2),
 sequence('7回合內對手PP值消耗量為7倍',[{acts:[a('pp_cost_mult',{turns:7,mult:7,kind:''})]}],3),
 sequence('對手每有1點重量，則失去1點體力上限與1點相應異能值，最多70',[{acts:[a('body_maxhp_resource_loss',{side:'opp',unit:1,cap:70,resourceId:'rey_alien_energy'})]}],4),
]});
MIGRATED_REY_SKILL_KITS.push({elfIds:['5029'],name:'異境神霆',description:OTHERWORLD_REY_TEXT.skills['異境神霆'],kit:[
 property('■ 必中','sure_hit',true,0),
 sequence('令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1',[{acts:[a('stat',{side:'opp',stats:['全屬性'],v:1,x2If:up('opp')})]}],1),
 sequence('1回合內對手受到技能傷害不小於300×電系/神秘系/電神秘系中克制倍數最高的值',[{acts:[a('type_damage_floor_turns',{side:'opp',base:300,list:['電','神秘','神秘.電'],turns:1})]}],2),
 sequence(stormDrainText,[{acts:[
  a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[{acts:[a('checked_percent_drain',{ratio:.5,failTrue:210})]}]}),
  a('timed',{turns:5,from:'now',trig:'round_end',body:[{cond:[{c:'alive',p:{side:'opp'},label:'對手仍存活'}],acts:[a('checked_percent_drain',{ratio:1/3,failTrue:210})]}]}),
 ]}],3),
 sequence('令自身下2回合造成非真實傷害提升210%',[{acts:[a('dmg_mod_turns',{dir:'out',kind:'非真實',boost:2.1,turns:2,next:true})]}],4),
 sequence('下2回合自身所有技能先制+3',[{acts:[a('prio_turns',{turns:2,v:3,next:true})]}],5),
]});
const reyParalyzed={c:'has_status',p:{side:'self',status:'麻痺'},label:'自身處於麻痺狀態'};
const forbiddenText=OTHERWORLD_REY_TEXT.skills['霆·禁雷敕令'];
// 子句文字一律取自規格原文，不另外手打：手打曾把「神秘電系」寫成「電神秘系」，
// 造成報告的 TXT 對照永遠對不上，也讓顯示文字與規格不一致。
const forbiddenLines=forbiddenText.split('\n').map(line=>line.trim()).filter(Boolean);
const forbiddenClause=(needle:string)=>forbiddenLines.find(line=>line.includes(needle)) ?? needle;
MIGRATED_REY_SKILL_KITS.push({elfIds:['5029'],name:'霆·禁雷敕令',description:forbiddenText,kit:[
 {...property(forbiddenClause('體力低於210'),'forced_first',true,0),params:{property:'forced_first',value:true,conditions:[{c:'hp_value',p:{side:'self',op:'低於',amount:210},label:'自身體力低於210點'}]}},
 {...property(forbiddenClause('轉化為威力210'),'forced_first',true,1),
  params:{property:'skill_transform',value:{power:210,perWeight:70,perPower:70,types:['電','神秘','神秘.電'],names:{物理:'霆·禁雷敕令·神罰',特殊:'霆·禁雷敕令·神譴'},ignoreAttackImmunity:true},conditions:[reyParalyzed]},node:'before_skill'},
 sequence('🎯 附加對手自身已損失體力70%的真實傷害，附加時若體力低於0則改為附加自身體力上限70%的真實傷害',[
  {cond:[{c:'hp_value',p:{side:'self',op:'低於',amount:0},label:'自身體力低於0'}],acts:[a('dmg',{base:'最大體力',of:'self',ratio:.7,type:'真實'})],elseActs:[a('dmg',{base:'已損失體力',of:'self',ratio:.7,type:'真實'})]},
 ],2),
 sequence('🎯 消除對手回合類效果，消除成功則下2回合受到傷害翻倍',[
  {acts:[a('clear_turn',{side:'opp'})]},
  {chain:'success',acts:[a('damage_multiplier_turns',{side:'opp',dir:'in',kind:'攻擊',mult:2,turns:2,next:true})]},
 ],3),
 sequence('🎯 自身體力低於最大體力⅓時則造成技能傷害提升3倍',[{cond:[{c:'hp_ratio',p:{side:'self',op:'低於',ratio:1/3},label:'自身體力低於最大體力⅓'}],acts:[a('dmg_mod',{dir:'out',kind:'技能',boost:2})]}],4),
 (()=>{const raw='🎯 未擊敗對手則下2回合自身所有技能先制+2',body=[{cond:[{c:'nokill',p:{},label:'未擊敗對手'}],acts:[a('prio_turns',{turns:2,v:2,next:true})]}];return {...sequence(raw,body,5),node:'on_hit' as const,params:{clause:{raw,trig:'after_hit',parsed:true,body}}};})(),
]});
