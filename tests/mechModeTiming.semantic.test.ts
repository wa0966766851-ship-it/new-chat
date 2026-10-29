import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {MIGRATED_5016_MECH_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migrated5016MechSoulKit.ts');
  const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const kit=structuredClone(source.kit.filter((e:any)=>[1,2,3,100,101].includes(e.order)));
  defineCustomBlocks();const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{
    for(const e of kit){assert.equal(kitEntryIssue(e),null);assert.ok(buildEntryBlock(ws as any,e));}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
    assert.deepEqual(reload.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),kit);
  }finally{ws.dispose();reload.dispose();}
  const soul={...source,name:'任意組合魂印',effectMode:'kit',kit};
  for(const side of ['p1','p2'] as const){
    const before:string[]=[];
    h.S['組合受方']=(c:any,event:string)=>{if(event==='BEFORE_ACTION')before.push(c.getOpponentState('mechCombo'));};
    const fifth={...h.wait(),name:'改名第五',isFifthSkill:true};
    const mk=()=>h.unit('組合施放者',1000,[fifth,{...h.wait(),name:'普通技能'}],{maxHp:10000,extra:{soulMark:structuredClone(soul)}});
    const history=await h.play(side,{self:mk(),opp:h.unit('組合受方',100000,[{...h.wait(),priority:10}]),turns:(_e:any,t:number)=>[t===3?1:0,0]},3);
    assert.deepEqual(before,['極速','毀滅','極速'],'第五結算前保留原模式');
    assert.deepEqual(history.map(r=>r.state[side+'RegistryState'].mechCombo),['毀滅','極速','極速'],'每次成功第五僅切換一次，普通技能不切換');
    assert.deepEqual(history.map(r=>r.state[side+'RegistryState'].marsEndTurnChargeStrike),[false,false,true],'成功第五不得無條件準備超頻');
    assert.equal(history[0].opp.currentHp,66667,'選擇第五只吸取一次最大體力三分之一');
    assert.equal(history[2].opp.currentHp,33334,'普通技能不能吸取');
    h.S['無效組合受方']=(c:any,event:string)=>{if(event==='ON_ENTRANCE')c.addTimerTo(c.targetSide,{id:'第五無效',name:'第五無效',kind:'use_counter',source:'skill',remaining:1,tickAt:'never',payload:{block:{invalid:'all'}}},false);};
    const [failed]=await h.play(side,{self:mk(),opp:h.unit('無效組合受方',100000,[h.wait()])});
    assert.equal(failed.state[side+'RegistryState'].mechCombo,'毀滅','原文使用後切換沒有要求命中，無效第五也僅切換一次');
    assert.equal(failed.state[side+'RegistryState'].marsEndTurnChargeStrike,true,'第五實際無效才準備超頻');
  }
  console.log('機甲時點：P1/P2第五選擇汲取、成功/無效用後單次切換、階段末條件與Blockly通過');
}finally{await h.close();}
