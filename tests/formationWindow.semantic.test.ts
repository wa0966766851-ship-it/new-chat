import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
const {MIGRATED_DIXIN_SOUL_KIT:def}=await h.server.ssrLoadModule('/src/data/migratedDixinSoulKit.ts');
const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const sourceElf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5017');assert.ok(sourceElf);
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const a=(op:string,p:any)=>({op,p,label:op});
const entry=(node:string,trig:string,acts:any[])=>({codeId:'effect_sequence',node,source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'設定陣形情境',trig,parsed:true,body:[{acts}]}}});
const add=(id:string,amount:number)=>a('resource_mark_add',{id,amount,side:'self',scope:'elf',name:id,displayChar:'層',unit:'層',description:'測試資源',persistsOffField:true});
const soul={name:'改名陣形魂印',description:def.description,effectMode:'kit',kit:structuredClone(def.kit.filter((e:any)=>e.order===4))};
const trait={name:'層數初始化',effectMode:'kit',kit:[entry('on_entered','entrance',[add('bahuang_mark',9)]),entry('round_start','round_start',[add('unrelated',1)])]};
const check=async(name:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${name}`);};
try {
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();let edited:any;
  try {
    const slot=w.newBlock('custom_node_slot');slot.setFieldValue('on_resource_changed','TARGET_NODE');
    const block=buildEntryBlock(w as any,soul.kit[0])!;assert.ok(block);slot.getInput('STACK')!.connection!.connect(block.previousConnection!);
    const action=w.getAllBlocks(false).find(b=>b.type==='sequence_action')!;
    const p=JSON.parse(action.getFieldValue('PARAMS'));p.formationId='renamed_window';p.turns=2;p.onClose[0].acts[0].p.value=123;
    action.setFieldValue(JSON.stringify(p),'PARAMS');Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    edited=createKitBlockParser('soulmark')(r.getTopBlocks(false)[0].getInputTargetBlock('STACK'),'on_resource_changed',4)!;
    assert.ok(edited);assert.equal(sequenceIssue(edited.params.clause,edited.node),null);
  } finally {w.dispose();r.dispose();}
  await check('產品陣形嚴格合約接受可編輯關閉body，拒絕隱藏腳本／未知動作／錯誤門檻',()=>{
    const clause=structuredClone(soul.kit[0].params.clause);assert.equal(sequenceIssue(clause,'on_resource_changed'),null);
    for(const mutate of [(c:any)=>c.body[0].acts[0].p.onClose[0].acts.push(a('unknown',{})),
      (c:any)=>c.body[0].acts[0].p.hpCeiling='yes',(c:any)=>c.body[0].cond[0].p.threshold=0,
      (c:any)=>c.trig='round_end']){const c=structuredClone(clause);mutate(c);assert.ok(sequenceIssue(c));}
  });
  for(const side of ['p1','p2'] as const) {
    await check(`${side} 真實5017名稱與ID使用Kit陣形，舊專屬魂印不重播`,async()=>{
      const old=h.S[sourceElf.name];let calls=0;h.S[sourceElf.name]=()=>{calls++;};
      try {
        const [r]=await h.play(side,{self:h.unit('5017',9000,[h.wait()],{extra:{name:sourceElf.name,soulMark:soul,trait}}),opp:h.unit('E',9000,[h.wait()])});
        assert.equal(calls,0);assert.equal(r.state[`${side}Timers`].find((t:any)=>t.id==='dixin_formation')?.remaining,8);
        assert.equal(r.state[`${side}RegistryState`]?.dixinFormationRounds,undefined,'不借舊專屬生命周期狀態');
      } finally {if(old)h.S[sourceElf.name]=old;else delete h.S[sourceElf.name];}
    });
    await check(`${side} Blockly保存重載修改ID／2回合／關閉體力123，真實引擎讀新值`,async()=>{
      const rows=await h.play(side,{self:h.unit('S',9000,[h.wait()],{extra:{soulMark:{...soul,kit:[edited]},trait}}),opp:h.unit('E',9000,[h.wait()])},2);
      assert.equal(rows[0].state[`${side}Timers`].find((t:any)=>t.id==='renamed_window')?.remaining,1);
      assert.equal(rows[0].self.currentHp,9000);assert.equal(rows[1].self.currentHp,123);
      assert.equal(rows[1].self.skills[0].pp,0);assert.ok(!rows[1].state[`${side}Timers`].some((t:any)=>t.id==='renamed_window'));
    });
    await check(`${side} 真實產品9回合到期才收關閉代價，不因其他資源更新重開`,async()=>{
      const rows=await h.play(side,{self:h.unit('S',9000,[h.wait(),h.wait()],{extra:{soulMark:soul,trait}}),opp:h.unit('E',9000,[h.wait()])},9);
      assert.deepEqual(rows.map(r=>r.state[`${side}Timers`].find((t:any)=>t.id==='dixin_formation')?.remaining||0),[8,7,6,5,4,3,2,1,0]);
      for(const r of rows.slice(0,8)){assert.equal(r.self.currentHp,9000);assert.ok(r.self.skills[0].pp>0);}
      const end=rows[8];assert.equal(end.self.currentHp,1);assert.equal(end.self.skills[0].pp,0);assert.equal(end.self.skills[1].pp,0);
      assert.equal(end.logs.filter((s:string)=>s.includes('【誅魔天陣】開啟')).length,1);
      assert.ok(end.state[`${side}Timers`].some((t:any)=>t.payload?.block?.lockSwitch&&t.remaining===1));
    });
    await check(`${side} 非真傷按對手已損失體力扣固定點數可到0，真傷不降低`,async()=>{
      for(const type of ['固定','百分比','真實']) {
        const attack=h.kitSkill('改名傷害',[a('dmg',{flat:3000,type})]);
        const [r]=await h.play(side,{self:h.unit('S',9000,[h.wait()],{extra:{soulMark:soul,trait}}),opp:h.unit('E',5000,[attack],{maxHp:9000})});
        assert.equal(r.self.currentHp,type==='真實'?6000:9000,r.logs.join('\n'));
      }
    });
    await check(`${side} 對手傷前體力上限真正限制恢復；主動關閉後即解除，代價只收一次`,async()=>{
      const hit=h.kitSkill('留下傷前上限',[a('dmg',{flat:1000,type:'真實'})]);
      const close=h.kitSkill('提前關閉',[a('close_formation',{formationId:'dixin_formation'})]);
      const heal=h.healSkill(4000);
      const rows=await h.play(side,{self:h.unit('S',9000,[hit,close],{speed:200,extra:{soulMark:soul,trait}}),opp:h.unit('E',5000,[heal],{maxHp:9000}),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.equal(rows[0].opp.currentHp,5000,rows[0].logs.join('\n'));
      assert.equal(rows[1].opp.currentHp,9000,rows[1].logs.join('\n'));
      assert.equal(rows[1].self.currentHp,1);assert.ok(!rows[1].state[`${side}Timers`].some((t:any)=>t.id==='dixin_formation'));
    });
    await check(`${side} 雙方同ID陣形各自計時，關閉自身不消耗對方`,async()=>{
      const close=h.kitSkill('關閉自身陣形',[a('close_formation',{formationId:'dixin_formation'})]);
      const [r]=await h.play(side,{self:h.unit('S',9000,[close],{extra:{soulMark:soul,trait}}),opp:h.unit('E',9000,[h.wait()],{extra:{soulMark:soul,trait}})});
      const other=side==='p1'?'p2':'p1';
      assert.equal(r.self.currentHp,1);assert.equal(r.opp.currentHp,9000);
      assert.ok(!r.state[`${side}Timers`].some((t:any)=>t.id==='dixin_formation'));
      assert.equal(r.state[`${other}Timers`].find((t:any)=>t.id==='dixin_formation')?.remaining,8);
    });
  }
  console.log(`${checks} formation window checks passed (real P1/P2 engine; partial soul)`);
} finally {await h.close();}
