import type {KitEntry} from '../effects/effectSystem.schema';
import {action as a} from './reviewedSequenceSkillKits';
import {IMMORTAL_AINS_SOURCE} from './immortalAinsSource';
import {SEQUENCE_TRIGGERS} from '../effects/sequenceTriggers';

const defeated='defeatedOpponentThisRound';
const line=(prefix:string)=>{
 const found=IMMORTAL_AINS_SOURCE.split(/\r?\n/).find(l=>l.startsWith(prefix));
 if(!found)throw Error(`缺少艾恩斯回合末原文：${prefix}`);
 return found;
};
const entry=(raw:string,trig:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node:SEQUENCE_TRIGGERS[trig] as KitEntry['node'],order,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
const cond=(value:boolean)=>({c:'player_state',p:{key:defeated,equals:value,thisRound:true},label:'本回合擊敗紀錄'});
export const IMMORTAL_AINS_ROUND_END_KIT:KitEntry[]=[
 entry('回合結束時判定所需的本回合擊敗紀錄：回合開始清空','round_start',[{acts:[a('flag_set',{key:defeated,value:false,thisRound:true})]}],20),
 entry('回合結束時判定所需的本回合擊敗紀錄：擊敗對手後記錄','kill',[{acts:[a('flag_set',{key:defeated,value:true,thisRound:true})]}],21),
 entry(line('>未擊敗對手則'),'round_end',[
  {cond:[cond(false)],acts:[a('drain',{base:'已損失體力',of:'self',ratio:.6}),a('pp_op',{side:'self',mode:'add',amount:3})]},
 ],22),
 entry(line('>擊敗對手則'),'round_end',[
  {cond:[cond(true)],acts:[a('hp_set',{side:'self',ratio:1}),a('next_entry_status',{status:'焚燼',turns:3})]},
 ],23),
];
