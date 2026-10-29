import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
const a=(op:string,p:any)=>({op,p,label:op});
const source=(flat=50)=>({codeId:'effect_sequence',node:'after_action',source:'skill',role:'attached',order:0,
  params:{clause:{raw:'行動後選取鄰位執行獨立行動',trig:'self_after_skill',parsed:true,body:[{acts:[
    a('queue_extra_action',{label:'任意改名行動',body:[{acts:[a('astral_select',{side:'opp',scope:'team',state:'alive',relation:'adjacent',anchor:'active',body:[{acts:[a('damage_selected',{flat,type:'skill_extra_action',elem:'普通'})]}]})]}]}),
  ]}]}}});
try{
  defineCustomBlocks();const w=new Blockly.Workspace(),restored=new Blockly.Workspace();let edited:any;
  try{
    const slot=w.newBlock('custom_node_slot');slot.setFieldValue('after_action','TARGET_NODE');
    const b=buildEntryBlock(w as any,source() as any)!;assert.ok(b);slot.getInput('STACK')!.connection!.connect(b.previousConnection!);
    const action=w.getAllBlocks(false).find(b=>b.type==='sequence_action')!;
    const p=JSON.parse(action.getFieldValue('PARAMS'));p.label='保存重載後的改名行動';p.body[0].acts[0].p.body[0].acts[0].p.flat=125;
    action.setFieldValue(JSON.stringify(p),'PARAMS');Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),restored);
    edited=createKitBlockParser('skill')(restored.getTopBlocks(false)[0].getInputTargetBlock('STACK'),'after_action',0)!;
    assert.ok(edited);
  }finally{w.dispose();restored.dispose();}
  for(const side of ['p1','p2'] as const)for(const flat of [50,125]){
    const skill={...h.wait(),name:'改名測試技能',effectMode:'kit',kit:[flat===125?edited:source(flat)]};
    const [r]=await h.play(side,{self:h.unit('S',10000,[skill]),opp:h.unit('E',10000,[h.wait()]),
      oppBench:[h.unit('near',10000,[h.wait()]),h.unit('far',10000,[h.wait()])]});
    const other=side==='p1'?'p2':'p1';
    const team=r.state[`${other}Team`];assert.ok(team,'正式引擎隊伍快照');
    assert.equal(team.find((e:any)=>e.id==='near').currentHp,10000-flat,r.logs.join('\n'));
    assert.equal(team.find((e:any)=>e.id==='far').currentHp,10000);
    assert.equal(r.opp.currentHp,10000,'選定場下傷害不轉嫁在場');
    checks++;console.log(`✓ ${side} 獨立額外行動讀可編輯${flat}，只傷及鄰位存活隊員`);
  }
  console.log(`${checks} astral container engine checks passed; not full species acceptance`);
}finally{await h.close();}
