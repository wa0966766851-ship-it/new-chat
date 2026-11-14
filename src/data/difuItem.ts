import type {BattleItem} from '../types';
import type {KitEntry} from '../effects/effectSystem.schema';
import {DIFU_SOURCE} from './difuSource';

export const DIFU_AMULET_ID='mountain_amulet';
// 只建立資料，不在共用道具目錄初始化時載入積木執行器。
const a=(op:string,p:any)=>({op,p,label:op});
const entry=(text:string,body:any[]):KitEntry=>({codeId:'effect_sequence',node:'on_skill_use',source:'skill',order:0,customText:text,params:{clause:{raw:text,trig:'use',parsed:true,body}}});
const useText=DIFU_SOURCE.slice(DIFU_SOURCE.indexOf('>使用時直接增加'),DIFU_SOURCE.indexOf('\r\n\r\n害怕:')).trim();
const heldEntryText=DIFU_SOURCE.slice(DIFU_SOURCE.indexOf('>>己方所有精靈登場'),DIFU_SOURCE.indexOf('>>己方山神守護回合數')).trim();
const drainEntry=(truth:boolean):KitEntry=>{
 const prefix=truth?'>>己方全體精靈每次受到真實傷害時':'>>己方在場精靈每次受到非真實傷害時';
 const end=truth?DIFU_SOURCE.indexOf('>使用時直接增加'):DIFU_SOURCE.indexOf('>>己方全體精靈每次受到真實傷害時');
 const text=DIFU_SOURCE.slice(DIFU_SOURCE.indexOf(prefix),end).trim();
 return {codeId:'effect_sequence',node:'on_damaged',source:'soulmark',role:'innate',order:truth?2:1,customText:text,params:{clause:{raw:text,trig:truth?'damaged_true':'damaged_nontrue',parsed:true,
  ...(!truth?{cond:[{c:'owner_on_field',p:{},label:'受擊者在場'}]}:{}),
  body:[{acts:[a('item_snapshot_drains',{itemId:DIFU_AMULET_ID,stat:'spatk',ratio:.01,type:truth?'true':'fixed',status:'山神守護',perTurn:truth?30:15})]}]}}};
};
export const DIFU_AMULET:BattleItem={
 id:DIFU_AMULET_ID,name:'山神護符',type:'special',grantOnly:true,holdLimit:1,ppValue:20,retainStatusDuration:['山神守護'],
 description:useText,
 heldKit:[{codeId:'effect_sequence',node:'on_entered',source:'soulmark',order:0,role:'innate',customText:heldEntryText,params:{clause:{raw:heldEntryText,trig:'entrance',parsed:true,body:[
  {acts:[a('status_or_extend',{side:'self',status:'山神守護',turns:3,extend:3})]},
  {chain:'fail',acts:[a('item_source_panel_scale',{side:'self',itemId:DIFU_AMULET_ID,stats:['hp','def','spatk','spdef','speed'],ratio:1.15})]},
 ]}}},drainEntry(false),drainEntry(true)],
 useKit:{
  normal:[entry(useText,[
   {acts:[a('hp_adjust',{side:'self',delta:500})]},
   {cond:[{c:'has_status',p:{side:'self',status:'山神守護'},label:'已處於山神守護'}],acts:[
    a('status_or_extend',{side:'self',status:'山神守護',turns:3,extend:3}),
    a('shield',{flat:150}),a('shield',{flat:150,kind:'barrier'}),
   ],elseActs:[a('status',{side:'self',status:'山神守護',turns:3,chance:100})]},
   {acts:[a('reset_field_rounds',{side:'self'})]},
  ])],
  backlash:[entry('藥劑反噬：體力效果反轉為反噬傷害，解除原本附加的守護；重設在場回合數。',[
   {acts:[a('potion_backlash_damage',{side:'self',amount:500}),a('cure_status',{side:'self',statuses:['山神守護']}),a('reset_field_rounds',{side:'self'})]},
  ])],
 },
};
