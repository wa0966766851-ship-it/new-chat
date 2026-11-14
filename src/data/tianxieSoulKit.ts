import {TIANXIE_SOURCE} from './tianxieSource';
import {TIANXIE_MARK_ID,tianxieMark} from './tianxieMark';
import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
const raw=(prefix:string)=>{const s=TIANXIE_SOURCE.split(/\r?\n/).find(s=>s.startsWith(prefix));if(!s)throw Error(prefix);return s;};
const soul=(prefix:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(raw(prefix),trig,body,order,'soulmark',true,cond);
const dragon=(side='opp')=>c('type_is',{side,type:'龍'});
const off=c('owner_on_field',{neg:true});
const flag=(key:string,value=true)=>a('flag_set',{key,value,thisRound:true});
const recorded=(key:string,value=true)=>c('player_state',{key,equals:value,fallback:false,thisRound:true});
const curse=()=>a('status',{side:'opp',status:'詛咒',chance:100});
const aid=()=>[a('clear_turn',{side:'opp'}),curse(),a('damage_to_side',{side:'self',holder:true,amount:100,type:'真實'}),tianxieMark()];
const conversion=()=>a('damage_to_heal_turns',{kind:'技能',instant:true,body:[act(flag('convertedSkillThisRound'),a('dmg_from_last',{ratio:1.5,type:'真實'}),tianxieMark())]});
const fallback=()=>a('incoming_reduction_branch',{ratio:.5,threshold:0,bodyHigh:[act(a('drain_from_last',{ratio:1.5,type:'固定'}))]});
const guaranteed=(n:number)=>c('player_state',{key:'conversionGuaranteedTurns',equals:n,fallback:0});
const bless=()=>[a('status_seq',{side:'opp',list:['詛咒','害怕'],chance:100}),a('status',{side:'self',status:'平靜',chance:100}),a('heal',{side:'self',ratio:1}),a('pp_op',{side:'self',mode:'recover'})];
const entranceGate=()=>[
 {cond:[c('field_rounds',{side:'self',op:'不高於',amount:1})],acts:bless(),elseActs:[]},
 {cond:[c('field_rounds',{side:'self',op:'高於',amount:1}),c('field_rounds',{side:'opp',op:'不高於',amount:1})],acts:bless()},
];
export const TIANXIE_SOUL_KIT=[
 soul('>>若回合開始時自身體力不低於','round_start',[{cond:[c('hp_cmp',{side:'self',op:'不低於'})],acts:[flag('roundHpAtLeastOpponent')],elseActs:[flag('roundHpAtLeastOpponent',false)]}],0),
 soul('>>若雙方均識別','round_start',[act(a('reset_field_rounds',{side:'self'}),a('reset_field_rounds',{side:'opp'}),a('clear_turn',{side:'both'}))],1,[dragon('self'),dragon()]),
 soul('>若場上同時存在','round_start',entranceGate(),2,[dragon('self')]),
 soul('>若場上同時存在','round_start',entranceGate(),3,[c('type_is',{side:'self',type:'龍',neg:true}),dragon()]),
 soul('>若己方在場精靈受到','team_before_damage',[act(a('incoming_reduction_branch',{ratio:.5,threshold:151,compareBase:'raw_damage',bodyHigh:[act(...aid())]}))],4,[off,c('event_damage_type',{type:'技能'})]),
 soul('>若己方在場精靈受到','team_action_failed',[act(...aid())],5,[off,c('fail_kind',{kind:'invalid'})]),
 soul('>若己方在場精靈受到','team_round_start',[act(...aid())],6,[off,dragon()]),
 soul('>受到技能傷害有50%','incoming_skill',[act(conversion())],7,[guaranteed(2)]),
 soul('>受到技能傷害有50%','incoming_skill',[act(conversion())],7,[guaranteed(1)]),
 soul('>受到技能傷害有50%','incoming_skill',[
  {cond:[c('chance',{pct:50})],acts:[conversion()],elseActs:[fallback()]},
 ],7,[c('player_state',{...guaranteed(1).p,neg:true}),c('player_state',{...guaranteed(2).p,neg:true})]),
 soul('>回合結束時若自身不因','round_end',[act(a('add_invalid_turns',{kind:'all',turns:2,next:true}),a('turn_key_set',{key:'conversionGuaranteedTurns',turns:2,side:'self'}))],8,[c('player_state',{...recorded('convertedSkillThisRound').p,neg:true})]),
 soul('>無視對手百分比','before_skill',[act(a('ignore',{what:'百分比減傷'}))],9),
 soul('>自身造成技能傷害提升','outgoing_skill',[act(a('dmg_mod',{dir:'out',kind:'技能',boost:1}))],10),
 soul('>>若回合開始時自身體力不低於','modify_priority',[act(a('prio_bonus',{v:2}))],11,[recorded('roundHpAtLeastOpponent')]),
 soul('>>若回合開始時自身體力不低於','outgoing_skill',[act(a('dmg_mod',{dir:'out',kind:'技能',boost:.5}))],12,[recorded('roundHpAtLeastOpponent')]),
 soul('>>若回合開始時自身體力低於','self_after_skill',[act(tianxieMark())],13,[recorded('roundHpAtLeastOpponent',false),c('dmg_cmp',{op:'不高於',v:0,basis:'action_skill'})]),
 soul('>使用技能後100%','self_after_use',[act(curse()),{chain:'fail',acts:[a('status',{side:'both',status:'平靜',chance:100}),a('maxhp',{side:'self',ratio:.2,direction:'increase',temporary:true})]}],14),
 soul('邪龍緝令:','self_skill',[
  act(a('resource_mark_subtract',{side:'opp',id:TIANXIE_MARK_ID,amount:1,scope:'elf'})),
  {cond:[dragon()],acts:[a('invalid_next',{kind:'all',uses:1})],elseActs:[a('change_type',{side:'opp',type:'龍',untilSwitch:true})]},
 ],15,[c('mark_count',{side:'opp',id:TIANXIE_MARK_ID,op:'高於',amount:0})]),
];
