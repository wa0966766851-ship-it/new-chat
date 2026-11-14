import {PEGASUS_SOURCE} from './pegasusSource';
import {PEGASUS_PHASE_KEY as key} from './pegasusSkills';
import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
const raw=(prefix:string)=>{const s=PEGASUS_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));if(!s)throw Error(prefix);return s;};
const soul=(prefix:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(raw(prefix),trig,body,order,'soulmark',true,cond);
const phase=(name:string)=>c('phase',{key,name});
const pending=(value=true)=>c('player_state',{key:'featherBlockPending',equals:value,fallback:false});
const setPending=(value:boolean)=>a('flag_set',{key:'featherBlockPending',value});
const immunity=(turns:number)=>act(a('immune_status_turns',{turns,reflect:false}),a('immune_statdown_turns',{turns}));
export const PEGASUS_SOUL_KIT=[
 soul('每次登場時','entrance',[act(a('phase_enter',{key,name:'normal'}),setPending(false),a('flag_set',{key:'blockCounter:featherAttack',value:false}))],0),
 soul('每次登場時','fatal',[act(a('phase_enter',{key,name:'potential',turns:4,statsMultiplier:1.6,restoreHp:true}))],1,[phase('normal')]),
 soul('每次登場時','phase_end',[
  act(a('phase_expire',{key,name:'spent',statsMultiplier:.4})),
  {chain:'success',acts:[setPending(false),a('clear_turn',{side:'both'}),a('stat_clear',{side:'both',kind:'up'}),a('clear_shield',{side:'both',kind:'both'}),a('status',{side:'self',status:'眩暈',turns:4,chance:100})]},
 ],2,[phase('potential')]),
 soul('每次登場時','switch_out',[act(a('phase_leave',{key}),setPending(false))],3),
 ...['normal','potential'].flatMap((name,i)=>{
  const cond=[phase(name)],enhanced=name==='potential',cap=enhanced?140:280;
  return [
   soul('金色羽毛:','before_skill',[act(a('type_best_of',{fromCarried:true,extend:0}),a('flag_set',{key:'grantStabThisAction',value:true}))],10+i*20,[...cond,c('skill_kind',{kind:'攻擊'})]),
   soul('金色羽毛:','outgoing_power',[act(a('power_mod',{boost:enhanced?9:1,final:true}))],11+i*20,cond),
   soul('金色羽毛:','self_attack',[act(a('recovery_reduce_turns',{side:'opp',ratio:1,turns:enhanced?4:1,includePotions:true,bound:true}))],12+i*20,cond),
   soul('藍色羽毛:','incoming_nontrue',[
    ...(enhanced?[act(a('damage_cap_now',{cap,types:['fixed','percent']}))]:[
     {cond:[pending()],acts:[a('damage_cap_now',{cap,types:['fixed','percent']})],elseActs:[a('damage_cap_now',{cap,types:['non_true']})]},
    ]),
   ],13+i*20,cond),
   soul('藍色羽毛:','incoming_attack',[act(a('block_damage',{kind:'攻擊',key:'featherAttack'}))],14+i*20,enhanced?cond:[...cond,pending()]),
   soul('藍色羽毛:','damaged_attack',[act(a('damage_from_counter',{key:'featherAttack',ratio:1,type:'真實',consume:true})),{chain:'success',acts:[setPending(false)]}],15+i*20,cond),
   soul('紫色羽毛:','round_start',[
    act(a('stat',{side:'self',stats:['全屬性'],v:enhanced?5:1,side2:'opp',stats2:['全屬性'],v2:-1,requireAll:true})),
    ...(enhanced?[act(a('status',{side:'opp',status:'眩暈',chance:100}))]:[{chain:'fail',acts:[a('clear_turn',{side:'opp'}),a('status',{side:'opp',status:'害怕',chance:100})]}]),
   ],16+i*20,cond),
   soul('白色羽毛:','battle_node',enhanced?[immunity(4)]:[
    {cond:[c('stage',{side:'self',kind:'up'})],acts:immunity(2).acts,elseActs:[]},
    {cond:[c('stage',{side:'opp',kind:'up'})],acts:immunity(2).acts},
   ],17+i*20,cond),
   soul('白色羽毛:','stat_boost_cleared',[act(a('status',{side:'opp',status:'眩暈',chance:100}))],18+i*20,cond),
  ];
 }),
 soul('藍色羽毛:','team_stat_changed',[act(setPending(true))],60,[c('owner_on_field'),phase('normal')]),
];
