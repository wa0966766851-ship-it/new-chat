import {DIFU_SOURCE} from './difuSource';
import {authoredEntry as e,authoredSkill as skill,operation as a,actions as act,condition as c} from './authoredKitTools';
import {property} from './reviewedSequenceSkillKits';

// 連同 > 子段保留正式階層，不把後續條件吞成一行摘要。
const lines=DIFU_SOURCE.split(/\r?\n/);
const raw=(prefix:string)=>{
 const i=lines.findIndex(s=>s.replace(/^>+/,'').startsWith(prefix));if(i<0)throw Error(prefix);
 let j=i+1;while(j<lines.length&&lines[j].startsWith('>'))j++;
 return lines.slice(i,j).join('\n');
};
const line=(prefix:string,trig:string,body:any[],order:number)=>e(raw(prefix),trig,body,order);
const regret=a('status',{side:'opp',status:'神悔',chance:100,turns:3});
const recoil=(type:string)=>a('self_stat_recoil',{stat:'atk',ratio:.01,type,floor:1});

export const DIFU_MOURN=skill('萬古山殤','無屬性','屬性',0,5,0,[
 property('必中','sure_hit',true,0),
 line('5回合內免疫','use',[act(a('immune_status_turns',{turns:5,reflect:true}))],1),
 line('5回合內每回合結束','use',[act(a('timed',{turns:5,from:'now',trig:'round_end',body:[act(a('stat_clear',{side:'self',kind:'down'}))]}))],2),
 line('5回合內每回合使用','use',[act(a('timed',{turns:5,from:'now',trig:'self_skill',initial:true,body:[
  act(a('flag_set',{key:'statChangeFailedThisAction',value:false})),
  act(a('stat',{side:'opp',stats:['全屬性'],v:-1})),
  {chain:'fail',acts:[a('flag_set',{key:'statChangeFailedThisAction',value:true})]},
  {live:true,cond:[c('player_state',{key:'statChangeFailedThisAction',equals:true})],acts:[regret],elseActs:[recoil('百分比')]},
 ]}))],3),
 line('自身免疫下次','use',[act(a('block_damage_uses',{uses:1,kind:'攻擊',key:'nextAttackBlocked'}))],4),
],{sure:true});

export const DIFU_GLOW=skill('山神遺輝','無屬性','屬性',0,5,0,[
 property('必中','sure_hit',true,0),
 line('附加自身3回合山神守護','use',[act(a('status_or_extend',{side:'self',status:'山神守護',turns:3,extend:1}))],1),
 line('全屬性+1','use',[{live:true,cond:[c('abnormal',{side:'self'})],acts:[a('stat',{side:'self',stats:['全屬性'],v:2})],elseActs:[a('stat',{side:'self',stats:['全屬性'],v:1})]}],2),
 line('5回合內每回合恢復','use',[act(a('timed',{turns:5,from:'now',trig:'round_end',body:[
  {live:true,cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[a('heal',{side:'self',ratio:2/3})],elseActs:[a('heal',{side:'self',ratio:1/3})]},
  act(a('dmg_equal',{type:'百分比'})),
 ]}))],3),
 line('4回合內對手使用攻擊','use',[act(a('timed',{turns:4,from:'now',trig:'opp_attack',body:[act(regret)]}))],4),
 line('下2回合對手先制','use',[act(a('prio_turns',{side:'opp',turns:2,next:true,v:-2}))],5),
],{sure:true});

export const DIFU_ROAR=skill('怒號!','普通','特殊',150,10,1,[
 property('必中','sure_hit',true,0),
 line('命中後100%使對手害怕','after_hit',[act(a('status',{side:'opp',status:'害怕',chance:100})),{chain:'fail',acts:[a('prio_turns',{side:'opp',turns:2,next:true,v:-2})]}],1),
 line('命中後100%使自身流血','after_hit',[act(a('status',{side:'self',status:'流血',chance:100})),{chain:'success',acts:[a('dmg_mod_uses',{uses:1,boost:1,kind:'技能',attackOnly:true})]}],2),
 line('造成技能傷害100%恢復','self_after_attack',[
  act(a('heal_main_settled',{ratio:1})),
  {live:true,cond:[c('abnormal',{side:'self'}),c('abnormal',{side:'opp'})],acts:[a('dmg_equal',{type:'百分比'})]},
 ],3),
 line('下2次受到技能傷害時','use',[act(a('timed_uses',{uses:2,trig:'damaged_skill',body:[act(recoil('真實'))]}))],4),
],{sure:true});

export const DIFU_SACRIFICE=skill('炫彩·山殞祭天','普通','特殊',0,5,0,[
 property('必中','sure_hit',true,0),
 line('吸取對手能力提升狀態','use',[act(a('stat_steal',{mode:'吸取'})),{chain:'success',acts:[a('add_invalid_turns',{kind:'攻擊',turns:2})]}],1),
 line('威力隨機','outgoing_power',[act(a('random_streak_power',{min:160,max:320,step:30,cap:320,stageMultiplier:1.5}))],2),
 line('未擊敗對手則自身下2次','not_killed',[act(a('crit_uses',{uses:2}))],3),
],{sure:true,fifth:true});

// SeerAPI效果35未公開數值公式；依2026-11-10裁定採備案：每級正能力等級+20威力。
const judgementText=DIFU_SOURCE.slice(DIFU_SOURCE.indexOf('山神裁決\r\n'),DIFU_SOURCE.indexOf('\r\n萬古山殤\r\n'));
const judgementClear=judgementText.slice(judgementText.indexOf('消除對手回合類效果'),judgementText.indexOf('\r\n懲罰')).trim();
export const DIFU_JUDGEMENT=skill('山神裁決','普通','特殊',90,15,3,[
 property('先制+3','base_priority',3,0),
 e(judgementClear,'use',[
  act(a('clear_turn',{side:'opp'})),
  {chain:'success',acts:[a('settlement_flow',{body:[
   act(regret),{chain:'fail',acts:[a('status_turn_drains',{ratio:.01,perTurn:15})]},
  ]})]},
 ],1),
 {codeId:'skill_property',node:'before_damage',source:'skill',role:'innate',order:2,customText:'懲罰\n>對方能力等級越高，此技能威力越大；',
  params:{property:'stage_power',value:20,perStage:{side:'opp',kind:'up'},conditions:[]}},
]);
export const DIFU_READY_SKILLS=[DIFU_JUDGEMENT,DIFU_MOURN,DIFU_GLOW,DIFU_ROAR,DIFU_SACRIFICE];
