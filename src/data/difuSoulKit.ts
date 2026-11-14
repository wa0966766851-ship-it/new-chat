import {DIFU_SOURCE} from './difuSource';
import {DIFU_AMULET_ID} from './difuItem';
import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';

const lines=DIFU_SOURCE.split(/\r?\n/);
const raw=(prefix:string)=>{
 const i=lines.findIndex(s=>s.replace(/^>+/,'').startsWith(prefix));if(i<0)throw Error(prefix);
 let j=i+1;while(j<lines.length&&lines[j].startsWith('>'))j++;
 return lines.slice(i,j).join('\n');
};
const grant=()=>a('grant_item',{side:'self',itemId:DIFU_AMULET_ID,count:1,snapshotStats:true});
const historyKey='opponentNontrueDamageExtrema';
const afterSkill=[
 {cond:[c('damage_history_cmp',{key:historyKey,op:'高於',ratio:.5})],acts:[a('drain',{ratio:2/3})],elseActs:[a('drain',{ratio:1/3})]},
 {cond:[c('damage_history_cmp',{key:historyKey,op:'不高於',ratio:1})],acts:[a('status',{side:'opp',status:'神悔',turns:3,chance:100})]},
];
/** 原文條款使用通用積木，與正式精靈入口共用。 */
export const DIFU_READY_SOUL_KIT=[
 e(raw('山神護符作為特殊藥劑加入'),'battle_start',[act(grant())],0,'soulmark',true),
 e(raw('若回合開始時自身在場回合數'),'round_start',[
  act(a('clear_turn',{side:'opp'})),
  {chain:'success',acts:[a('status',{side:'opp',status:'神悔',turns:3,chance:100})]},
  // 加入護符不以消除成功或神悔成功為前提。
  act(grant()),
 ],1,'soulmark',true,[c('owner_on_field'),c('field_rounds',{op:'低於',amount:2}),c('held_item',{side:'self',itemId:DIFU_AMULET_ID,neg:true})]),
 e(raw('每次選擇使用攻擊技能時'),'before_round_start',[
  act(a('status_seq',{side:'opp',list:['流血','害怕'],chance:100,turns:3,countFailures:true})),
  {cond:[c('last_amount',{op:'高於',amount:0})],acts:[a('cure_status',{side:'self'}),a('prio_turns',{side:'opp',v:-3,turns:1,next:false})]},
 ],2,'soulmark',true,[c('owner_on_field'),c('selected_attack')]),
 e('紀錄對手於本節點前各次正式非真實傷害的最大、最小值，不將真實傷害混入。','team_opponent_damage_settled',[
  act(a('damage_extrema_record',{key:historyKey})),
 ],3,'soulmark',true,[c('owner_on_field')]),
 e(raw('吸取對手最大體力'),'self_after_use',afterSkill,4,'soulmark',true,[c('owner_on_field')]),
 e(raw('吸取對手最大體力'),'opp_after_skill',afterSkill,5,'soulmark',true,[c('owner_on_field')]),
];
export const DIFU_SOUL_KIT=DIFU_READY_SOUL_KIT;
