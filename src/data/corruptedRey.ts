import type { Elf, Skill } from '../types';
import { CORRUPTED_REY_SOUL_TEXT,CORRUPTED_REY_SKILL_TEXT } from './corruptedReyDescriptions';
import type { KitEntry } from '../effects/effectSystem.schema';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property } from './reviewedSequenceSkillKits';

// 倉庫固定四招在前、明確指定的第五技在後；對戰列由共用 skillSlot 顯示第五技在最左。
const nodes:Record<string,string>={use:'on_skill_use',battle_start:'battle_start',entrance:'on_entered',round_start:'round_start',phase_end:'battle_phase_end',self_after_use:'after_action',self_attack:'on_skill_use',incoming_skill:'before_damage',status_end:'on_status_ended',outgoing_attack:'before_damage',outgoing_skill:'before_damage',after_hit:'on_hit',not_killed:'on_not_killed',modify_priority:'modify_priority',on_invalid:'on_invalid',outgoing_power:'modify_power'};
const c=(c:string,p:any)=>({c,p,label:c});
const act=(...acts:any[])=>({acts});
const entry=(raw:string,trig:string,body:any[],order:number,soul=false,innate=false):KitEntry=>({codeId:'effect_sequence',node:nodes[trig] as any,source:soul?'soulmark':'skill',role:soul||innate?'innate':'attached',order,customText:raw,params:{clause:{raw,marker:soul?'>':innate?'■':'🎯',trig,parsed:true,body}}});
const drain=(amount:number,failTrue:number,turns:number)=>[
  act(a('drain',{flat:amount})),
  {cond:[c('last_no_dmg',{})],acts:[a('dmg',{flat:failTrue,type:'真實'}),a('status',{side:'opp',status:'繳械',turns})]},
];
const healAndDamage=(ratio:number)=>[act(a('heal',{side:'self',ratio}),a('dmg',{base:'最大體力',of:'self',ratio,type:'百分比'}))];
const timed=(turns:number,trig:string,body:any[])=>a('timed',{turns,from:'now',trig,body});
const penalty=(turns:number)=>a('bound_penalty',{turns,ppMultiplier:20,ppKind:'攻擊',sealKind:'屬性'});
const clearWithFailure=[
  {cond:[c('has_turn_effect',{side:'opp'})],acts:[a('clear_turn',{side:'opp'})]},
  {chain:'fail',cond:[c('has_turn_effect',{side:'opp'})],acts:[a('no_heal',{turns:1}),a('stop_action',{side:'opp'})]},
];
const block=(key:string,seal=false)=>a('block_damage_uses',{uses:1,kind:'攻擊',key,sealOpponentAdded:seal,onBlock:[act(a('damage_from_counter',{key,ratio:1,type:'真實',consume:true}))]});

type Spec={id:string;name:string;type:string;weight:number;stats:Elf['baseStats'];soulName:string;upgraded:boolean};
const specs:Spec[]=[
 {id:'7070',name:'魔化.雷伊',type:'電·暗影',weight:74,stats:{hp:165,atk:142,def:110,spatk:70,spdef:110,speed:138},soulName:'專屬特性',upgraded:false},
 {id:'707070',name:'墜霆.雷伊',type:'混沌·電',weight:87,stats:{hp:187,atk:161,def:121,spatk:70,spdef:121,speed:140},soulName:'墜',upgraded:true},
];
const defs:ReviewedSequenceSkill[]=[];
/** 僅用於辨認接手期舊存檔，不能當展示文案或執行來源。 */
export const CORRUPTED_REY_LEGACY_SOUL_SUMMARIES:Record<string,string[]>={};
function buildSkills(s:Spec):Skill[]{
 const u=s.upgraded,t=u?7:2;
 const make=(name:string,power:number,pp:number,priority:number,sure:boolean,clauses:{raw:string;trig?:string;body:any[];innate?:boolean}[],fifth=false):Skill=>{
  const props:KitEntry[]=[];if(sure)props.push(property('■ 必中','sure_hit',true,props.length));if(priority)props.push(property(`■ 先制+${priority}`,'base_priority',priority,props.length));
  const kit=[...props,...clauses.map((v,i)=>entry(v.raw,v.trig||'use',v.body,i+props.length,false,!!v.innate))];
  const description=CORRUPTED_REY_SKILL_TEXT[name];
  defs.push({elfIds:[s.id],name,description,kit});
  return {name,type:power?s.type:'無屬性',category:power?'物理':'屬性',power,pp,maxPp:pp,currentPp:pp,accuracy:100,priority,isSureHit:sure,isFifthSkill:fifth,description,effectDetail:'',effectType:'none',effectMode:'kit',kit};
 };
 const first=u?[
  {raw:'🎯 消除雙方能力上升、下降狀態並附加等同於消除前雙方能力等級總和×70點真實傷害',body:[act(a('stat_clear',{side:'both',kind:'all',captureLevels:true}),a('dmg_from_last',{ratio:70,type:'真實'}))]},
  {raw:'🎯 抵擋下次受到的攻擊傷害，抵擋成功則附加對手等量真實傷害；直到抵擋觸發前或自身下場，對手所有技能附加效果失效',body:[act(block('counterAttack',true))]},
  {raw:'🎯 下次死亡時令自身強制存活並保留1點體力',body:[act(a('survive_uses',{uses:1}))]},
 ]:[
  {raw:'🎯 吸取對手能力提升狀態，吸取成功則對手下次屬性技能無效',body:[act(a('stat_steal',{mode:'吸取'})),{chain:'success',acts:[a('invalid_next',{kind:'屬性',uses:1})]}]},
  {raw:'🎯 吸取對手270點固定體力',body:[act(a('drain',{flat:270}))]},
  {raw:'🎯 2回合內對手攻擊技能無效',body:[act(a('invalid_turns',{kind:'攻擊',turns:2}))]},
 ];
 const buff=[
  {raw:u?'🎯 全屬性+1，自身每有1回合入魔狀態時強化效果翻倍':'🎯 全屬性+1',body:[act(u?a('stat_by_status_duration',{status:'入魔',base:1,factor:2}):a('stat',{side:'self',stats:['全屬性'],v:1}))]},
  {raw:`🎯 ${t}回合內使用技能後恢復自身最大體力的1/1並造成等量百分比傷害`,body:[act(timed(t,'self_after_use',healAndDamage(1)))]},
  {raw:u?'🎯 7回合內，自身回合類效果結束或被消除時，使自身下兩次受到異常狀態時轉化為入魔':'🎯 2回合內，自身回合類效果結束或被消除時，使自身免疫下兩次異常狀態',body:[act(a('effect_end_watch',{turns:t,mode:u?'convert':'immune',count:2,...(u?{status:'入魔'}:{})}))]},
  ...(u?[{raw:'🎯 7回合內免疫並反彈異常狀態',body:[act(a('immune_status_turns',{turns:7,reflect:true}))]}]:[]),
  {raw:'🎯 下2回合對手所有技能先制-2',body:[act(a('prio_turns',{side:'opp',v:-2,turns:2,next:true}))]},
 ];
 const defense=[
  {raw:u?'■ 自身處於異常狀態時先制+3':'■ 自身處於能力下降狀態時先制+3',trig:'modify_priority',innate:true,body:[{cond:[u?c('abnormal',{side:'self'}):c('stage',{side:'self',kind:'down'})],acts:[a('prio_bonus',{v:3})]}]},
  ...(!u?[{raw:'🎯 2回合內自身免疫並反彈所有異常狀態',body:[act(a('immune_status_turns',{turns:2,reflect:true}))]}]:[]),
  {raw:`🎯 解除自身所有異常狀態，解除成功則${t}回合內對手技能附加效果失效`,body:[act(a('cure_status',{side:'self'})),{chain:'success',acts:[a('add_invalid_turns',{turns:t,kind:'all'})]}]},
  ...(u?[
   {raw:'🎯 直接造成對手自身最大體力50%的混沌·電系傷害',body:[act(a('dmg',{base:'最大體力',of:'opp',ratio:.5,type:'技能',elem:s.type}))]},
   {raw:'🎯 技能無效時，上述傷害提升150%',trig:'on_invalid',body:[act(a('dmg',{base:'最大體力',of:'opp',ratio:1.25,type:'技能',elem:s.type}))]},
   {raw:'🎯 7回合內，對手若使用屬性技能則下7回合造成非真實傷害不超過70',body:[act(timed(7,'opp_used_status',[act(a('damage_cap_turns',{side:'opp',dir:'out',kind:'非真實',cap:70,turns:7,next:true}))]))]},
   {raw:'🎯 下7回合對手受到的非真實傷害提升170%',body:[act(a('damage_multiplier_turns',{side:'opp',dir:'in',kind:'非真實',mult:2.7,turns:7,next:true}))]},
  ]:[
   {raw:'🎯 消除雙方能力上升、下降狀態與護盾、護罩效果，並附加自身最大體力50%的電·暗影系傷害',body:[act(a('stat_clear',{side:'both',kind:'all'}),a('clear_shield',{side:'both',kind:'both'}),a('dmg',{base:'最大體力',of:'self',ratio:.5,type:'技能',elem:s.type}))]},
   {raw:'🎯 抵擋下次受到的攻擊，抵擋成功則附加對手等同抵擋傷害100%的真實傷害',body:[act(block('counterAttack'))]},
  ]),
 ];
 const attack=[
  {raw:'🎯 免疫下次受到的攻擊',body:[act(a('immune_attack_count',{count:1}))]},
  ...(!u?[{raw:'🎯 命中後100%令對手繳械，未觸發則2回合內PP值消耗量提升20倍',trig:'after_hit',body:[act(a('status',{side:'opp',status:'繳械'})),{chain:'fail',acts:[a('pp_cost_mult',{mult:20,turns:2})]}]}]:[]),
  {raw:`🎯 3回合內自身使用技能吸取對手${u?370:270}點固定體力，對手體力未減少則附加${u?270:170}點真實傷害與${u?7:2}回合繳械`,body:[act(a('timed',{turns:3,from:'now',trig:'self_skill',initial:true,body:drain(u?370:270,u?270:170,u?7:2)}))]},
  ...(u?[
   {raw:'🎯 吸取對手所有技能1點PP值並恢復給自身',body:[act(a('pp_op',{side:'opp',mode:'drain',amount:1}))]},
   {raw:'🎯 每有一個自身技能PP值為滿，則技能威力提升160',trig:'outgoing_power',body:[act(a('power_per_full_pp',{amount:160}))]},
  ]:[]),
 ];
 const fifth=[
  ...(u?[{raw:'🎯 對手存在回合類效果時造成傷害提升170%',body:[{cond:[c('has_turn_effect',{side:'opp'})],acts:[a('boost',{kind:'技能',mult:2.7})]}]}]:[]),
  {raw:'🎯 消除對手回合類效果；對手回合類效果無法被消除時，當回合無法恢復體力與行動',body:clearWithFailure},
  {raw:`🎯 造成技能傷害提升${u?70:50}%，對手每處於1回合異常則提升7%`,trig:'outgoing_skill',body:[act(a('damage_scale_by_status',{side:'opp',base:u?1.7:1.5,perTurn:.07,kind:'技能'}))]},
  {raw:`🎯 附加自身最大體力${u?70:40}%的百分比傷害，對手體力高於最大體力${u?'1/7':'1/3'}時效果翻倍`,body:[{cond:[c('hp_ratio',{side:'opp',op:'高於',ratio:u?1/7:1/3})],acts:[a('dmg',{base:'最大體力',of:'self',ratio:u?1.4:.8,type:'百分比'})],elseActs:[a('dmg',{base:'最大體力',of:'self',ratio:u?.7:.4,type:'百分比'})]}]},
  {raw:`🎯 未擊敗對手則對手下2回合先制-${u?7:2}`,trig:'not_killed',body:[act(a('prio_turns',{side:'opp',v:u?-7:-2,turns:2,next:true}))]},
 ];
 return [make(u?'怨雷':'蝕雷',90,20,3,u,first),make(u?'失控霆魔':'墮魔雷翼',0,5,0,true,buff),make(u?'魔化雷驅':'暗蝕雷驅',0,5,0,true,defense),make(u?'混沌墜霆閃':'暗影墮霆閃',160,5,u?1:0,true,attack),make(u?'沉淪混沌決':'墮影噬雷決',170,5,1,true,fifth,true)];
}
function buildSoul(s:Spec){
 const u=s.upgraded;
 const clauses=[
  {raw:u?'> 每次登場展開混沌雷翼：自身入魔3回合，直到本次入魔結束前抵擋所有技能傷害；降低敵方背包所有精靈實戰六項面板7%，每實際降低7點，自身六項各提升70點':'> 戰鬥開始展開魔化.雷光之翼：降低敵方背包所有精靈實戰六項面板20%，每實際降低70點，自身六項各提升70點',trig:u?'entrance':'battle_start',body:[act(...(u?[a('status',{side:'self',status:'入魔',turns:3}),a('status_guard_instance',{status:'入魔',kind:'技能'})]:[]),a('panel_pool_transfer',{ratio:u?.07:.2,unit:u?7:70,gain:70}))]},
  {raw:'> 回合開始時，若對手處於能力提升狀態則100%令對手麻痺並反轉對手能力提升狀態'+(u?'；反轉失敗則消除提升':''),trig:'round_start',body:[{cond:[c('stage',{side:'opp',kind:'up'})],acts:[a('status',{side:'opp',status:'麻痺'}),a('stat_reverse',{side:'opp',kind:'up',...(u?{failClear:true}:{})})],elseActs:[a('prio_turns',{turns:1,v:u?2:1,current:true}),a('timed',{turns:1,from:'now',trig:'self_after_use',body:[act(a('status',{side:'opp',status:'繳械'})),...(u?[{chain:'fail',acts:[penalty(7)]}]:[])]})]}]},
  {raw:`> 戰鬥階段結束時，若雙方在場精靈任一存在回合類效果，恢復自身最大體力${u?'1/1':'1/3'}並造成等量百分比傷害`+(u?'，且恢復自身所有技能全部PP':''),trig:'phase_end',body:[{cond:[c('either_turn_effect',{})],acts:[a('heal',{side:'self',ratio:u?1:1/3}),a('dmg',{base:'最大體力',of:'self',ratio:u?1:1/3,type:'百分比'}),...(u?[a('pp_op',{side:'self',mode:'recover',amount:1})]:[])]}]},
  {raw:'> 戰鬥階段結束時，令雙方回合類效果變為1回合'+(u?'；合計縮短n回合則入魔增加n回合，下次攻擊額外附加自身最大體力70%×n百分比傷害（僅保留最近一次）':''),trig:'phase_end',body:[act(a('compress_turn_effects',{side:'both',remaining:1})),...(u?[{chain:'success',acts:[a('pending_damage_write',{key:'durationCompression',ratio:.7}),a('status_extend_by_last',{status:'入魔'})]}]:[])]},
  ...(u?[{raw:'> 自身下次使用攻擊技能時消費最近一次期限壓縮的追加傷害',trig:'self_attack',body:[act(a('pending_damage_use',{key:'durationCompression',type:'百分比'}))]}]:[]),
 ];
 const description=CORRUPTED_REY_SOUL_TEXT[s.id];
 CORRUPTED_REY_LEGACY_SOUL_SUMMARIES[s.id]=clauses.map(v=>v.raw);
 const sections=description.split(/\n{2,}/);
 clauses[0].raw=sections[0];
 clauses[1].raw=sections[1];
 const phase=sections[2].split('\n');
 const cut=phase.findIndex(line=>line.includes('令雙方回合類效果變為1回合'));
 clauses[2].raw=phase.slice(0,cut).join('\n');
 clauses[3].raw=['戰鬥階段結束時:',...phase.slice(cut)].join('\n');
 if(u)clauses[4].raw='> 自身下次使用攻擊技能時額外附加自身最大體力70%*n的百分比傷害';
 const kit=clauses.map((v,i)=>entry(v.raw,v.trig,v.body,i,true));
 defs.push({elfIds:[s.id],name:s.soulName,description,kit,kind:'soul'} as any);
 return {name:s.soulName,description,effectType:'none' as const,effectValue:0,effectMode:'kit' as const,kit};
}
export const CORRUPTED_REY_SEEDS=specs.map(s=>{
 const skills=buildSkills(s),soulMark=buildSoul(s);
  return {id:s.id,name:s.name,type:s.type,weight:s.weight,gender:'雄性',seerId:70,level:100,...(!s.upgraded?{destinyRank:'B' as const}:{}),baseStats:s.stats,skills,skillPool:skills.map(k=>({...k})),soulMark,description:'自訂精靈；立繪暫用普通雷伊。'} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
});
export const CORRUPTED_REY_KITS=defs;
