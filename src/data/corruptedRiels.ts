import type {Elf,Skill} from '../types';
import type {KitEntry} from '../effects/effectSystem.schema';
import {SEQUENCE_TRIGGERS} from '../effects/sequenceTriggers';
import {action as a,property} from './reviewedSequenceSkillKits';
import {CORRUPTED_RIELS_SOURCE as source} from './corruptedRielsSource';

const act=(...acts:any[])=>({acts});
const c=(name:string,p:any)=>({c:name,p,label:name});
const stage=(side:string,kind:string)=>c('stage',{side,kind});
const entry=(raw:string,trig:string,body:any[],order:number,soul=false,innate=false):KitEntry=>({
 codeId:'effect_sequence',node:SEQUENCE_TRIGGERS[trig as keyof typeof SEQUENCE_TRIGGERS] as KitEntry['node'],source:soul?'soulmark':'skill',role:soul||innate?'innate':'attached',order,customText:raw,
 params:{clause:{raw,marker:soul?'>':innate?'■':'🎯',trig,parsed:true,body}},
});
const timed=(turns:number,trig:string,body:any[],next=false)=>a('timed',{turns,from:next?'next':'now',trig,body});
const lines=source.split('\n');
const raw=(start:string)=>{const line=lines.find(l=>l.replace(/^>+/,'').startsWith(start));if(!line)throw Error(`缺少瑞爾斯正式原文：${start}`);return line;};
const soulText=source.split('魂印：\n')[1].split('\n技能組:')[0].trim();
const soulKit=[
 entry(raw('每造成對手最大體力')+'\n'+raw('吸取後自身體力')+'\n'+raw('自身造成技能傷害不足')+'\n'+raw('自身全屬性')+'\n'+raw('100%狂暴'),'opp_damaged_skill',[
  act(a('damage_steps_drain',{step:.01,ratio:.01,thresholdSide:'opp',belowRatio:1/6,
   belowBody:[act(a('status',{side:'opp',status:'害怕'}),a('stat',{side:'opp',stats:['全屬性'],v:-1}))],
   smallBody:[act(a('stat',{side:'self',stats:['全屬性'],v:1}),a('status',{side:'self',status:'狂暴',turns:3}))]})),
 ],0,true),
 entry(raw('若所選擇的技能類型為攻擊'),'opp_attack',[act(a('heal_defer_damage',{ratio:1/3}))],1,true),
 entry(raw('若所選擇的技能類型為屬性'),'opp_status',[act(a('invalid_next',{kind:'攻擊',uses:1}))],2,true),
 entry(raw('當回合戰鬥階段結束時吸取'),'opp_skill',[act(a('timed_uses',{uses:1,trig:'phase_end',body:[act(a('pp_drain_slots',{amount:2}))]}))],3,true),
];

type Clause={start:string;trig?:string;body:any[];innate?:boolean};
function skill(name:string,power:number,pp:number,priority:number,sure:boolean,clauses:Clause[],fifth=false):Skill{
 const description=clauses.map(v=>raw(v.start)).join('\n');
 const props:KitEntry[]=[];
 if(sure)props.push(property('必中','sure_hit',true,props.length));
 if(priority)props.push(property(`先制+${priority}`,'base_priority',priority,props.length));
 return {name,type:power?'戰鬥·暗影':'無屬性',category:power?'物理':'屬性',power,pp,maxPp:pp,currentPp:pp,priority,accuracy:100,isSureHit:sure,isFifthSkill:fifth,
 description,effectDetail:'',effectType:'none',effectMode:'kit',kit:[...props,...clauses.map((v,i)=>entry(raw(v.start),v.trig||'use',v.body,i+props.length,false,v.innate))]};
}
const skills:Skill[]=[
 skill('偏執噬咬',90,20,3,false,[
  {start:'消除對手能力提升狀態',body:[act(a('stat_clear',{side:'opp',kind:'up'})),{chain:'success',acts:[a('no_heal',{turns:3,scope:'own_skill'})]}]},
  {start:'吸取對手150點固定體力',body:[{cond:[c('first',{})],acts:[a('drain',{flat:300})],elseActs:[a('drain',{flat:150})]}]},
 ]),
 skill('不滅惡念',0,5,0,true,[
  {start:'4回合免疫能力下降',body:[act(a('immune_statdown_turns',{turns:4}))]},
  {start:'下3回合使用攻擊技能後',body:[act(timed(3,'self_after_attack',[act(a('drain',{ratio:1/3}))],true))]},
  {start:'下2回合造成技能傷害',body:[act(timed(2,'outgoing_skill',[act(a('boost',{kind:'技能',mult:2}))],true))]},
  {start:'下2回合自身選擇',body:[act(a('prio_turns',{v:2,turns:2,next:true}))]},
 ]),
 skill('墮武極意',0,5,1,true,[
  {start:'全屬性+1',body:[act(a('stat',{side:'self',stats:['全屬性'],v:1}))]},
  {start:'5回合內每回合恢復',body:[act(timed(5,'round_end',[act(a('heal_then',{side:'self',ratio:.5,body:[act(a('dmg_from_last',{ratio:1,type:'百分比'}))]}))]))]},
  {start:'5回合內免疫並反彈',body:[act(a('immune_status_turns',{turns:5,reflect:true}),timed(5,'status_reflected',[act(a('convert_status',{side:'opp',status:'害怕',turns:3}))]))]},
  {start:'直接造成250點',body:[{cond:[c('has_skill_invalid',{side:'both'})],acts:[a('dmg',{flat:500,type:'技能',elem:'戰鬥·暗影'})],elseActs:[a('dmg',{flat:250,type:'技能',elem:'戰鬥·暗影'})]}]},
 ]),
 skill('黑霧崩墮擊',160,5,0,true,[
  {start:'當回合處於能力下降',trig:'modify_priority',innate:true,body:[{cond:[stage('self','down')],acts:[a('prio_bonus',{v:3})]}]},
  {start:'解除自身能力下降',body:[act(a('stat_clear',{side:'self',kind:'down'})),{chain:'success',acts:[a('pp_op',{side:'opp',mode:'zero',kind:'屬性'})]}]},
  {start:'自身下次受到技能傷害',body:[act(a('timed_uses',{uses:1,trig:'damaged_skill',body:[act(a('damage_steps_drain',{step:.01,ratio:.01,thresholdSide:'self'}))]}))]},
 ]),
 skill('何逢萬古·噬',190,5,0,true,[
  {start:'對手處於能力下降狀態時先制',trig:'modify_priority',innate:true,body:[{cond:[stage('opp','down')],acts:[a('prio_bonus',{v:1})]}]},
  {start:'消除對手回合類效果',body:[act(a('clear_turn',{side:'opp'}))]},
  {start:'若自身處於能力提升狀態',trig:'outgoing_power',innate:true,body:[{cond:[stage('self','up')],acts:[a('power_mod',{boost:1})]}]},
  {start:'若自身不處於能力提升狀態',body:[{cond:[c('stage',{side:'self',kind:'up',neg:true})],acts:[a('invalid_turns',{kind:'屬性',turns:3})]}]},
 ],true),
];
/** 只使用通用積木；不建立同名舊式技能 handler。立繪另行處理。 */
export const CORRUPTED_RIELS_SEED={id:'5037',seerId:3094,name:'魔化.瑞爾斯',type:'戰鬥·暗影',level:100,gender:'雄性',
 baseStats:{hp:171,atk:145,def:115,spatk:70,spdef:115,speed:134},skills,skillPool:skills.map(s=>structuredClone(s)),
 soulMark:{name:'專屬特性',description:soulText,effectType:'none',effectValue:0,effectMode:'kit',kit:soulKit},
 description:'依正式來源實裝。',
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
