import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
import type {KitEntry} from '../effects/effectSystem.schema';
const raw=['■ 必中','■ 若先出手，必定造成致命一擊','🎯 對手每剩 1 回合【威怯】，便令其所有技能無效 1 回合','🎯 下 1 回合自身攻擊傷害翻倍','🎯 附加對手最大體力 1/3 的百分比傷害；未擊敗對手時恢復自身等量體力','🎯 擊敗對手後自身免疫下 2 次受到的異常狀態'];
const at=(node:KitEntry['node'],trig:string,text:string,body:any[],order:number):KitEntry=>({...sequence(text,body,order),node,params:{clause:{raw:text,marker:'🎯',trig,parsed:true,body}}});
export const MIGRATED_MARK_DURATION_SKILL_KITS:ReviewedSequenceSkill[]=[{elfIds:['arena_14'],name:'聖武·虛極拓世',description:raw.join('\n'),kit:[
  property(raw[0],'sure_hit',true,0),
  {...sequence(raw[1],[{cond:[{c:'first',p:{},label:'先出手'}],acts:[a('crit_now',{})]}],1),role:'innate',params:{clause:{raw:raw[1],marker:'■',trig:'use',parsed:true,body:[{cond:[{c:'first',p:{},label:'先出手'}],acts:[a('crit_now',{})]}]}}},
  sequence(raw[2],[{acts:[a('invalid_turns',{kind:'all',turns:1,perMarkTurns:{side:'opp',id:'arena.weiyue'}})]}],2),
  sequence(raw[3],[{acts:[a('dmg_mod_turns',{dir:'out',kind:'攻擊',boost:1,turns:1,next:true})]}],3),
  at('on_hit','after_hit',raw[4],[{acts:[a('dmg',{base:'最大體力',of:'opp',ratio:1/3,type:'百分比'})]},{cond:[{c:'nokill',p:{},label:'未擊敗對手'}],acts:[a('heal_equal',{})]}],4),
  at('on_kill','kill',raw[5],[{acts:[a('immune_status_count',{count:2,reflect:false})]}],5),
]}];
