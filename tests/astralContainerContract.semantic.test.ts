import assert from 'node:assert/strict';
import {sequenceIssue} from '../src/effects/sequenceContract';
const a=(op:string,p:any)=>({op,p,label:op});
const clause=(acts:any[])=>({raw:'子流程合約',trig:'self_after_skill',parsed:true,body:[{acts}]});
const queue=(acts:any[])=>a('queue_extra_action',{label:'改名行動',body:[{acts}]});
const select=(acts:any[])=>a('astral_select',{side:'opp',scope:'team',state:'alive',relation:'adjacent',anchor:'active',body:[{acts}]});
assert.equal(sequenceIssue(clause([queue([select([a('damage_selected',{flat:50,type:'skill_extra_action'})])])]),'after_action'),null);
for(const action of [a('custom',{handler:'anything'}),a('heal_flat',{amount:1,callback:'code'}),a('damage_selected',{flat:50}),queue([a('unknown',{})])])
  assert.ok(sequenceIssue(clause([queue([action])]),'after_action'));
assert.ok(sequenceIssue(clause([select([queue([a('damage_selected',{flat:50})])])]),'after_action'),'新額外行動frame不能借排隊時的選定目標');
for(const op of ['pp_max_offset_selected','damage_selected','heal_selected_pp'])assert.ok(sequenceIssue(clause([a(op,op==='damage_selected'?{flat:50}:op==='heal_selected_pp'?{perLostPp:1}:{delta:1})]),'after_action'));
let nested=a('heal_flat',{amount:1});for(let i=0;i<10;i++)nested=queue([nested]);
assert.ok(sequenceIssue(clause([nested]),'after_action'),'新容器也必須套用既有遞迴深度上限');
console.log('額外行動／集合子流程：合法可編輯內容通過；未知動作、程式欄位、失去選定目標及超深巢狀拒絕。');
