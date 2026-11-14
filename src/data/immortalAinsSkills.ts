import type {Skill} from '../types';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
import {IMMORTAL_AINS_SOURCE} from './immortalAinsSource';
import {SEQUENCE_TRIGGERS} from '../effects/sequenceTriggers';
import type {KitEntry} from '../effects/effectSystem.schema';

const lines=IMMORTAL_AINS_SOURCE.split(/\r?\n/);
export const ainsSkillLine=(start:string)=>{
 const found=lines.find(line=>line.startsWith(start));
 if(!found)throw Error(`缺少艾恩斯正式原文：${start}`);
 return found;
};
const immune=ainsSkillLine('5回合內免疫並反彈');
const burning=ainsSkillLine('4回合內使用技能70%');
const block=ainsSkillLine('自身免疫下次受到的攻擊');
/** 完整驗證的技能逐招加入；未完成的招式不放展示殼或近似效果。 */
export const IMMORTAL_AINS_FIRE_SEED:Skill={
 name:'火種永存',type:'無屬性',category:'屬性',power:0,pp:5,maxPp:5,currentPp:5,priority:0,accuracy:100,isSureHit:true,isFifthSkill:false,
 description:['必中',immune,burning,block].join('\n'),effectDetail:'',effectType:'none',effectMode:'kit',
 kit:[property('必中','sure_hit',true,0),
  sequence(immune,[{acts:[a('immune_status_turns',{turns:5,reflect:true})]}],1),
  sequence(burning,[{acts:[a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,body:[
   {acts:[a('status',{side:'opp',status:'焚燼',chance:70})]},
   {chain:'fail',acts:[a('dmg',{base:'最大體力',of:'opp',ratio:1/3,type:'百分比'})]},
  ]})]}],2),
  sequence(block,[{acts:[a('block_damage_uses',{uses:1,kind:'攻擊',key:'nextAttackBlocked'})]}],3),
 ],
};

const royalBoost=ainsSkillLine('自身攻擊、雙防');
const royalRecovery=ainsSkillLine('5回合內使用技能每回合');
const royalLock=ainsSkillLine('對手存在秩序之火時下');
const royalPriority=ainsSkillLine('下2回合對手所有技能先制');
const orderFire={c:'has_mark',p:{side:'opp',name:'秩序之火'},label:'對手持有秩序之火'};
const recoveryUsed={c:'player_state',p:{key:'skillPeriodicRecoveryUsed',equals:true,thisRound:true,neg:true},label:'本回合尚未觸發此持續恢復'};
const recoveryLow={c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'恢復前自身體力低於一半'};
const recovery=(ratio:number)=>a('heal_then',{side:'self',ratio,body:[{acts:[a('dmg_from_last',{ratio:1,type:'百分比'})]}]});
/** 「每回合使用技能」只觸發一次；額外行動不額外增加本回合的恢復次數。 */
export const IMMORTAL_AINS_ROYAL_FLAME:Skill={
 name:'不滅君焰',type:'無屬性',category:'屬性',power:0,pp:5,maxPp:5,currentPp:5,priority:0,accuracy:100,isSureHit:true,isFifthSkill:false,
 description:['必中',royalBoost,royalRecovery,royalLock,royalPriority].join('\n'),effectDetail:'',effectType:'none',effectMode:'kit',
 kit:[
  property('必中','sure_hit',true,4),
  sequence(royalBoost,[{cond:[orderFire],acts:[a('stat',{side:'self',stats:['攻擊','防禦','特防','速度','命中'],v:2})],elseActs:[a('stat',{side:'self',stats:['攻擊','防禦','特防','速度','命中'],v:1})]}],0),
  sequence(royalRecovery,[{acts:[a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,label:'每回合技能恢復與等量傷害',body:[
   {cond:[recoveryUsed,recoveryLow],acts:[recovery(2/3),a('flag_set',{key:'skillPeriodicRecoveryUsed',value:true,thisRound:true})]},
   {cond:[recoveryUsed,{...recoveryLow,p:{...recoveryLow.p,op:'不低於'}}],acts:[recovery(1/3),a('flag_set',{key:'skillPeriodicRecoveryUsed',value:true,thisRound:true})]},
  ]})]}],1),
  sequence(royalLock,[{cond:[orderFire],acts:[a('switch_lock_scoped',{side:'opp',turns:2,next:true,scope:'team'}),a('dmg_mod_turns',{side:'opp',dir:'taken',kind:'技能',boost:1.5,turns:2,next:true})]}],2),
  sequence(royalPriority,[{acts:[a('prio_turns',{side:'opp',turns:2,v:-2,next:true})]}],3),
 ],
};

const c=(id:string,p:any)=>({c:id,p,label:id});
const act=(...acts:any[])=>({acts});
const line=ainsSkillLine;
const event=(prefix:string,trig:string,body:any[],order:number,innate=false):KitEntry=>({codeId:'effect_sequence',node:SEQUENCE_TRIGGERS[trig] as KitEntry['node'],source:'skill',role:innate?'innate':'attached',order,customText:line(prefix),params:{clause:{raw:line(prefix),trig,parsed:true,body}}});
const skillBase=(name:string,power:number,pp:number,priority=0,sure=false,fifth=false):Skill=>({name,type:'火',category:'物理',power,pp,maxPp:pp,currentPp:pp,priority,accuracy:100,isSureHit:sure,isFifthSkill:fifth,description:'',effectDetail:'',effectType:'none',effectMode:'kit',kit:[]});
export const IMMORTAL_AINS_PURGE:Skill={...skillBase('諸邪皆焚',90,20,3),kit:[
 property('先制+3','base_priority',3,0),
 event('消除對手回合類效果，消除成功則對手下2次','use',[
  act(a('clear_turn',{side:'opp'})),{chain:'success',acts:[a('invalid_next',{kind:'屬性',uses:2})]},
 ],1),
 event('3回合內對手體力恢復量下降','use',[act(a('recovery_reduce_turns',{side:'opp',ratio:1,turns:3,includePotions:true}),a('recovery_backlash_turns',{side:'opp',amount:200,turns:3}))],2),
 event('技能無效時，消除對手回合類效果','self_invalid',[
  {cond:[c('skill_invalid',{})],acts:[a('clear_turn',{side:'opp'}),a('stat_clear',{side:'opp',kind:'all'}),a('status',{side:'opp',status:'焚燼',chance:100})]},
 ],3),
]};
export const IMMORTAL_AINS_ROYAL_AUTHORITY:Skill={...skillBase('王.傲視王權',150,5,0,true),kit:[
 property('必中','sure_hit',true,0),
 event('當回合自身處於能力下降狀態時先制','modify_priority',[{cond:[c('stage',{side:'self',kind:'down'})],acts:[a('prio_bonus',{v:3})]}],1,true),
 event('反轉自身能力下降狀態','use',[
  act(a('stat_reverse',{side:'self',kind:'down'})),{chain:'success',acts:[a('status_convert_uses',{count:1,status:'易燃'})]},
 ],2),
 event('消除敵我雙方回合類效果並令敵我雙方','use',[
  act(a('clear_turn',{side:'both'})),
  act(a('status',{side:'self',status:'燒傷',chance:100})),
  act(a('status',{side:'opp',status:'燒傷',chance:100})),
  {chain:'any_fail',acts:[a('damage_boost_current_or_next_attack',{boost:1})]},
 ],3),
]};
export const IMMORTAL_AINS_WORLD_FLAME:Skill={...skillBase('王.焚燼世焰',160,5,0,true,true),kit:[
 property('必中','sure_hit',true,0),
 event('攻擊時造成的傷害不會出現微弱','use',[act(a('no_resist',{}))],1,true),
 event('消除對手能力上升狀態，消除成功則自身','use',[
  act(a('stat_clear',{side:'opp',kind:'up'})),{chain:'success',acts:[a('first_turns',{turns:2,next:true}),a('dmg_mod_turns',{side:'self',dir:'out',kind:'攻擊',boost:1,turns:2,next:true})]},
 ],2),
 event('吸取對手最大體力的⅓','use',[
  act(a('drain',{ratio:1/3})),{cond:[c('last_no_dmg',{})],acts:[a('status',{side:'opp',status:'焚燼',chance:100})]},
 ],3),
 event('敵我雙方處於異常狀態時自身','outgoing_skill',[
  {cond:[orderFire],acts:[a('boost',{kind:'技能',mult:2.5})],elseActs:[]},
  {cond:[{...orderFire,p:{...orderFire.p,neg:true}},c('abnormal',{side:'self'}),c('abnormal',{side:'opp'})],acts:[a('boost',{kind:'技能',mult:1.75})]},
 ],4,true),
]};
for(const s of [IMMORTAL_AINS_PURGE,IMMORTAL_AINS_ROYAL_AUTHORITY,IMMORTAL_AINS_WORLD_FLAME])s.description=s.kit!.map(e=>e.customText).join('\n');
/** 倉庫四招在前、第五最後；戰鬥介面依明確第五技能旗標自行排首位。 */
export const IMMORTAL_AINS_SKILLS=[IMMORTAL_AINS_PURGE,IMMORTAL_AINS_FIRE_SEED,IMMORTAL_AINS_ROYAL_FLAME,IMMORTAL_AINS_ROYAL_AUTHORITY,IMMORTAL_AINS_WORLD_FLAME];
/** SeerAPI skill/31271：獨立原廠招式，僅加入預備庫；命中後附加固定傷害。 */
export const IMMORTAL_AINS_SUBDUE:Skill={...skillBase('諸邪皆伏',140,5),category:'特殊',accuracy:95,
 description:'隨機附加200~400點固定傷害',
 kit:[{codeId:'effect_sequence',node:SEQUENCE_TRIGGERS.after_hit as KitEntry['node'],source:'skill',role:'attached',order:0,
  customText:'隨機附加200~400點固定傷害',params:{clause:{raw:'隨機附加200~400點固定傷害',trig:'after_hit',parsed:true,
   body:[{acts:[a('random_damage',{side:'opp',source:'self',min:200,max:400,type:'固定',perStack:false})]}]}}}],
};
