import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const entry=(node:string,trig:string,acts:any[])=>({codeId:'effect_sequence',node,source:'soulmark',role:'innate',order:0,customText:'資源快照',params:{clause:{raw:'資源快照',trig,parsed:true,body:[{acts:acts.map(a=>({...a,label:a.op}))}]}}});
const capture={op:'snapshot_value',p:{side:'self',key:'defense',fields:['shield','barrier']}};
const restore={op:'heal_snapshot',p:{key:'defense',ratio:1,consume:true}};
const kit=[entry('round_start','round_start',[capture]),entry('battle_phase_end','phase_end',[restore,restore])];
try{
  await check('快照嚴格節點、欄位、鍵名、比例與消耗規則，不允許任意狀態讀取',()=>{
    assert.equal(sequenceIssue(kit[0].params.clause),null);assert.equal(sequenceIssue(kit[1].params.clause),null);
    for(const [trig,act] of [['use',capture],['round_start',{op:'snapshot_value',p:{...capture.p,fields:['password']}}],['round_start',{op:'snapshot_value',p:{...capture.p,key:'../../key'}}],['use',restore],['phase_end',{op:'heal_snapshot',p:{...restore.p,consume:undefined}}]] as any)assert.ok(sequenceIssue(entry('round_start',trig,[act]).params.clause));
  });
  let edited:any[]=[];
  await check('Blockly快照欄位、鍵名及恢復比例真正保存重載',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{
      for(const e of kit){
        const slot=w.newBlock('custom_node_slot');slot.setFieldValue(e.node,'TARGET_NODE');
        const child=buildEntryBlock(w as any,e as any);assert.ok(child);
        slot.getInput('STACK')!.connection!.connect(child.previousConnection!);
      }
      for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){
        const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));
        if(op==='snapshot_value'){p.key='edited';p.fields=['shield'];}
        if(op==='heal_snapshot'){p.key='edited';p.ratio=2;}
        b.setFieldValue(JSON.stringify(p),'PARAMS');
      }
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
      edited=r.getTopBlocks(false).map((b:any,i:number)=>createKitBlockParser('soulmark')(b.getInputTargetBlock('STACK'),b.getFieldValue('TARGET_NODE'),i)!);
      assert.equal(edited.length,2);for(const e of edited)assert.equal(sequenceIssue(e.params.clause,e.node),null);
      assert.deepEqual(edited.find(e=>e.params.clause.trig==='round_start').params.clause.body[0].acts[0].p.fields,['shield']);
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 保存重載的快照改欄位及比例後改名仍實行，只恢復護盾100的兩倍`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{shield:100,barrier:50,trait:{name:'自訂快照',description:'自訂快照',effectMode:'kit',kit:structuredClone(edited)}}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.currentHp,1200);assert.equal(r.state[`${side}RegistryState`].blockSnapshot_edited,undefined);
    });
    await check(`${side} 回合初双盾和150，出手時改為800仍於階段末只回150，消耗後不重播`,async()=>{
      h.S.S=(ctx:any,e:any)=>{if(e===T.BEFORE_ACTION)ctx.updateElf(ctx.actor,{shield:400,barrier:400});};
      // 原生觀察者與可編輯特質並存；魂印不被測試handler包裝。
      try{const [r]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{shield:100,barrier:50,trait:{name:'快照',description:'資源快照',effectMode:'kit',kit:structuredClone(kit)}}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.currentHp,1150);assert.equal(r.self.shield,400);assert.equal(r.self.barrier,400);assert.equal(r.state[`${side}RegistryState`].blockSnapshot_defense,undefined);}finally{delete h.S.S;}
    });
    await check(`${side} 禁療攔正式恢復仍消耗快照，下一回合只用新快照、不串前回合`,async()=>{
      const ban=h.kitSkill('禁療',[{op:'no_heal',p:{turns:1,next:false}}],{priority:5});
      const hist=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{shield:100,barrier:50,trait:{name:'快照',description:'資源快照',effectMode:'kit',kit:structuredClone(kit)}}}),opp:h.unit('E',10000,[ban,h.wait()]),turns:(engine,t)=>{if(t===2)engine.dispatch({type:'UPDATE_ELF',side,elf:{...engine.getState()[side],shield:10,barrier:20}});return [0,t===1?0:1];}},2);assert.equal(hist[0].self.currentHp,1000);assert.equal(hist[1].self.currentHp,1030);
    });
    await check(`${side} 缺快照或來源已下場不借舊資源恢復下一隻`,async()=>{
      const [none]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{trait:{name:'快照',description:'資源快照',effectMode:'kit',kit:[kit[1]]}}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(none.self.currentHp,1000);
      const hist=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{shield:100,barrier:50,trait:{name:'快照',description:'資源快照',effectMode:'kit',kit:[kit[0]]}}}),selfBench:[h.unit('B',500,[h.wait()],{maxHp:10000,extra:{trait:{name:'快照',description:'資源快照',effectMode:'kit',kit:[kit[1]]}}})],opp:h.unit('E',10000,[h.wait()]),turns:(_,t)=>[t===2?{switch:1}:0,0]},2);assert.equal(hist[1].self.currentHp,500);
    });
  }
  console.log(`回合初資源快照與正式恢復：${checks}項通過`);
}finally{delete h.S.S;await h.close();}
