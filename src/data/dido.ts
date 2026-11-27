import type {Elf} from '../types';
import source from './didoSource.json';
import type {SideField} from '../battle/sideFieldModel';
import {authoredEntry as entry,authoredSkill as skill,operation as op,actions as act,condition as cond} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';

const originalSoulParagraphs=source.soul.split('\n').filter(Boolean);
export const DIDO_FIELDS={
 pool:{id:'seer-field-1',name:'靈籟泳館',description:originalSoulParagraphs[3].split('：')[1],remaining:13,sureHit:true,teamHeal:1300},
 stage:{id:'seer-field-2',name:'星璨舞台',description:originalSoulParagraphs[4].split('：')[1],remaining:13,attackIncrease:13,teamPp:5},
} satisfies Record<string,SideField>;
const sure=()=>property('必中','sure_hit',true,0);
const hit=(order:number,text:string,...body:any[])=>entry(text,'use',body,order);
const timed=(turns:number,trig:string,body:any[])=>op('timed',{turns,from:'now',trig,body});
const then=(...acts:any[])=>({cond:[cond('success')],acts});
const high=(side:string,ratio:number)=>cond('hp_ratio',{side,op:'高於',ratio});
const deliver=(body:any[])=>op('on_next_switch_in',{side:'self',after:'now',resource:'none',ratio:1,body});
const fieldEntry=originalSoulParagraphs[0];
const fatalText=originalSoulParagraphs[1];
const departureText=originalSoulParagraphs[2];
const departure=()=>act(op('side_field_refresh',{turns:13,excludeForced:true,body:[act(deliver([act(op('skill_properties_uses',{uses:3,sureHit:true,first:true}))]))]}));
const soulKit=[
 entry(fieldEntry,'entrance',[act(op('side_field_set',{field:DIDO_FIELDS.pool,evenField:DIDO_FIELDS.stage,onlyEmpty:true}),op('survive_per_stay',{key:'entrance',hp:13,reset:true}))],0,'soulmark'),
 entry(fatalText,'fatal',[act(op('survive_per_stay',{key:'entrance',hp:13}))],1,'soulmark'),
 entry(departureText,'switch_out',[departure()],2,'soulmark'),
 entry(departureText,'defeated',[departure()],3,'soulmark'),
];
const all=[
 skill('幻夢芳逝','光.次元','物理',140,5,3,[sure(),property('先制+3','base_priority',3,1),
  hit(2,source.skills[0].clauses[2],
   act(deliver([act(op('shield',{flat:1300}),op('shield',{flat:1300,kind:'barrier'}),op('hp_set',{side:'self',value:13}))]),op('consume_hp_all')))],{sure:true,accuracy:95,labelEffects:true}),
 skill('時空牽絆','光.次元','特殊',90,20,3,[sure(),property('先制+3','base_priority',3,1),
  hit(2,source.skills[1].clauses[2],act(op('stat_clear',{side:'opp',kind:'up'})),then(op('damage_cap_turns',{side:'opp',dir:'out',kind:'技能',turns:3,cap:250}))),
  hit(3,source.skills[1].clauses[3],act(op('dmg',{type:'百分比',base:'已損失體力',of:'opp',ratio:.4})),{cond:[high('opp',.6)],acts:[op('status',{side:'opp',status:'空定',turns:13,chance:100})]})],{sure:true,accuracy:98,labelEffects:true}),
 skill('靈籟之願','屬性','屬性',0,5,0,[sure(),
  hit(1,source.skills[2].clauses[1],act(op('immune_status_turns',{turns:5,reflect:true,cls:''}))),
  hit(2,source.skills[2].clauses[2],act(timed(4,'round_end',[{cond:[cond('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[op('heal',{side:'self',ratio:2/3})],elseActs:[op('heal',{side:'self',ratio:1/3})]},act(op('dmg_equal',{type:'百分比'}))]))),
  hit(3,source.skills[2].clauses[3],act(op('status',{side:'opp',status:'冰封',turns:3,chance:100})),{cond:[cond('fail')],acts:[op('cure_status',{side:'self'}),op('immune_status_count',{count:1})]}),
  hit(4,source.skills[2].clauses[4],act(op('damage_cap_turns',{side:'self',dir:'in',kind:'技能',turns:3,cap:250})))],{sure:true,accuracy:95,labelEffects:true}),
 skill('星璨之望','屬性','屬性',0,5,0,[sure(),
  hit(1,source.skills[3].clauses[1],{cond:[high('self',.5)],acts:[op('stat',{side:'self',stats:['全屬性'],v:2})],elseActs:[op('stat',{side:'self',stats:['全屬性'],v:1})]}),
  hit(2,source.skills[3].clauses[2],act(timed(3,'self_after_skill',[act(op('dmg',{type:'真實',flat:300}))]))),
  hit(3,source.skills[3].clauses[3],act(op('dmg_mod_turns',{side:'opp',dir:'taken',kind:'技能',boost:1.3,turns:2,next:true}))),
  hit(4,source.skills[3].clauses[4],act(op('prio_turns',{v:2,turns:2,next:true})))],{sure:true,accuracy:95,labelEffects:true}),
 skill('琴·萬律歸一','光.次元','特殊',150,5,0,[sure(),
  hit(1,source.skills[4].clauses[1],act(op('stat_reverse',{side:'self',kind:'down'}))),
  hit(2,source.skills[4].clauses[2],act(op('invalid_turns',{kind:'屬性',turns:2}))),
  hit(3,source.skills[4].clauses.slice(3,5).join(''),act(op('stat',{side:'self',stats:['防禦','特防'],v:1}))),
  hit(4,source.skills[4].clauses[5],act(op('damage_to_heal_turns',{turns:3,kind:'技能'})))],{sure:true,accuracy:95,labelEffects:true}),
 skill('朵·盛夏詠嘆','光.次元','特殊',160,5,0,[sure(),
  hit(1,source.skills[5].clauses[1],act(op('clear_turn',{side:'opp'})),then(op('dmg_mod_turns',{side:'opp',dir:'taken',kind:'非真實',boost:13,turns:1,next:true}))),
  hit(2,source.skills[5].clauses[2],act(op('side_field_branch',{id:DIDO_FIELDS.stage.id,
   body:[act(op('shield',{flat:1300}),op('shield',{flat:2600,kind:'barrier'}),op('vampire',{ratio:1.3,kind:'技能'}),op('side_field_set',{field:DIDO_FIELDS.pool,next:true}))],
   elseBody:[act(op('shield',{flat:2600}),op('shield',{flat:1300,kind:'barrier'}),op('drain',{flat:130}),op('side_field_set',{field:DIDO_FIELDS.stage,next:true}))]})))],{sure:true,accuracy:95,fifth:true,labelEffects:true}),
];
// Text is a verbatim snapshot of the user's source; markup only describes its hierarchy.
const sourceClauseIndices=[[1,0,2],[1,0,2,3],[0,1,2,3,4],[0,1,2,3,4],[0,1,2,[3,4],5],[0,1,2]];
all.forEach((value,index)=>{
 const original=source.skills[index];
 value.name=original.name;
 value.description=original.description;
 value.kit?.forEach((item,i)=>{
  const indices=sourceClauseIndices[index][i];
  const text=(Array.isArray(indices)?indices:[indices]).map(n=>original.clauses[n]).join('');
  item.customText=text;
  if(item.params.clause)item.params.clause.raw=text;
 });
});
export const DIDO_SEED={id:'5055',seerId:4377,name:'蒂朵',level:100,type:'光.次元',height:168,weight:49,gender:'雌性',
 // Default appearance is the requested detective skin; canonical metadata remains pet 4377.
 path:'/seer/body/1400473.png',skinId:'dido-detective',groupIds:['artisan-elf','pool-manager','summer-chime','detective'],
 baseStats:{hp:170,atk:70,def:115,spatk:140,spdef:115,speed:135},skills:all.slice(1),skillPool:structuredClone(all),
 soulMark:{name:'朵',badgeChar:'朵',effectMode:'kit',effectType:'none',effectValue:0,kit:soulKit,
 description:source.soulDescription},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;




