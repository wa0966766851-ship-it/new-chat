import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { validateKit } from '../src/effects/kitValidation';
import { MIGRATED_GAP_SKILL_KITS } from '../src/data/migratedGapSkillKits';
import { createHarness } from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const source=h.find('5028','弱水三千'),def=MIGRATED_GAP_SKILL_KITS.find(d=>d.name==='弱水三千')!;
const sk={...source,power:0,category:'屬性',effectMode:'kit',kit:structuredClone(def.kit)};
try {
  await check('持有者、原文失配與明確自訂模式不被覆寫',async()=>{
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');
    for(const d of MIGRATED_GAP_SKILL_KITS){
      const original=h.find(d.elfIds[0],d.name);
      const base={...original,effectMode:'auto',kit:undefined};
      for(const s of [{...base,description:d.description+'（自訂）'},{...base,effectMode:'registry'},{...base,effectMode:'kit',kit:[{customText:'自訂'}]}]){
        assert.deepEqual(applyReviewedSkillKits({id:d.elfIds[0],skills:[s]}).skills[0],s);
      }
      assert.deepEqual(applyReviewedSkillKits({id:'錯誤持有者',skills:[base]}).skills[0],base);
    }
  });
  await check('完整原文匹配、合約及Blockly參數保存重載',()=>{
    assert.equal(source.description,def.description);assert.equal(source.effectMode,'kit');assert.deepEqual(source.kit,def.kit);validateKit(def.kit);defineCustomBlocks();
    const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
    try {
      for(const entry of def.kit){const b=buildEntryBlock(ws as any,entry);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
      const actual=reload.getTopBlocks(false).map(b=>{const e=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,e.node,e.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(actual,def.kit);
    }finally{ws.dispose();reload.dispose();}
  });
  for(const side of ['p1','p2'] as const) {
    await check(`${side} 正常：反轉加弱化、40%百分比吸取與等量恢復`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',6000,[sk,h.wait()],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:2,def:1}})});
      assert.equal(r.self.statStages.atk,2);assert.equal(r.self.statStages.def,1);
      assert.equal(r.opp.statStages.atk,-3);assert.equal(r.opp.statStages.def,-2);
      assert.equal(r.opp.currentHp,6000);assert.equal(r.self.currentHp,10000);
    });
    await check(`${side} 低血與恰好半血：80%／40%，回復不改變已判定倍率`,async()=>{
      for(const [hp,damage] of [[4999,8000],[5000,4000]] as const){
        const [r]=await h.play(side,{self:h.unit('S',hp,[sk,h.wait()],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()])});
        assert.equal(r.opp.currentHp,10000-damage);assert.equal(r.self.currentHp,Math.min(10000,hp+damage));
      }
    });
    await check(`${side} 弱化全部失敗才冰封；正常弱化不觸發冰封`,async()=>{
      const stages={atk:-6,def:-6,spatk:-6,spdef:-6,speed:-6,accuracy:-6};
      const [failed]=await h.play(side,{self:h.unit('S',10000,[sk]),opp:h.unit('E',10000,[h.wait()],{statStages:stages})});
      assert.ok(h.statuses(failed.opp).includes('冰封'));
      const [success]=await h.play(side,{self:h.unit('S',10000,[sk]),opp:h.unit('E',10000,[h.wait()])});
      assert.ok(!h.statuses(success.opp).includes('冰封'));
    });
    await check(`${side} 弱化部分成功仍屬成功；單項已達下限不觸發冰封`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',10000,[sk]),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:-6,def:0}})});
      assert.equal(r.opp.statStages.atk,-6);assert.equal(r.opp.statStages.def,-1);assert.ok(!h.statuses(r.opp).includes('冰封'));
    });
    await check(`${side} 附加封印：所有附加停止、固有先制必中保留`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',6000,[sk],{maxHp:10000,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:2}})});
      assert.equal(r.self.currentHp,6000);assert.equal(r.opp.currentHp,10000);assert.equal(r.opp.statStages.atk,2);assert.equal(r.self.statStages.atk??0,0);
    });
    await check(`${side} 3回合屬性失效含當回合，之後恢復；使用不能重複扣舊handler`,async()=>{
      const foe=h.kitSkill('自身攻擊+1',[{op:'stat',p:{side:'self',stats:['攻擊'],v:1}}]);
      const hist=await h.play(side,{self:h.unit('S',10000,[sk,h.wait()]),opp:h.unit('E',10000,[foe]),turns:(_e,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(hist.map(r=>r.opp.statStages.atk),[-1,-1,-1,0]);
    });
    await check(`${side} 百分比傷害由護罩吸收；吸取按既有結算量恢復`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',6000,[sk],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()],{extra:{shield:5000,barrier:5000}})});
      assert.equal(r.opp.currentHp,10000);assert.equal(r.opp.barrier,1000);assert.equal(r.opp.shield,5000);assert.equal(r.self.currentHp,10000);
    });
    await check(`${side} 正式弱水三千跳過舊handler；對手回合效果不被錯誤清除`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',30000,[source,h.wait()],{speed:200}),opp:h.unit('E',50000,[h.turnEffectSkill(),h.wait()]),turns:(_e,t)=>[t===2?0:1,t===1?0:1]},2);
      const r=hist[1],other=side==='p1'?'p2':'p1';
      const before=h.timers(hist[0].state,other).find((t:string)=>t.startsWith('免疫非附屬類異常:'));
      assert.ok(before);
      assert.ok(h.timers(r.state,other).includes(`免疫非附屬類異常:${Number(before.split(':').at(-1))-1}`),h.timers(r.state,other).join());
      assert.ok(!r.logs.some((s:string)=>s.includes('弱水環繞，封印屬性')));
    });
  }
  const frost=h.find('5012','霜凍之錮'),frostDef=MIGRATED_GAP_SKILL_KITS.find(d=>d.name==='霜凍之錮')!;
  await check('霜凍之錮正式來源路由與Blockly往返',()=>{
    assert.equal(frost.description,frostDef.description);assert.equal(frost.effectMode,'kit');assert.deepEqual(frost.kit,frostDef.kit);validateKit(frost.kit);
    const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
    try{
      for(const entry of frost.kit){const b=buildEntryBlock(ws as any,entry);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
      const actual=reload.getTopBlocks(false).map(b=>{const e=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,e.node,e.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(actual,frost.kit);
    }finally{ws.dispose();reload.dispose();}
  });
  await check('真實Blockly修改吸取參數、保存重載後執行新數值',async()=>{
    const entry=frost.kit[3],ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
    try{
      const block=buildEntryBlock(ws as any,entry)!;
      const timer=block.getInputTargetBlock('BODY')!.getInputTargetBlock('ACTS')!;
      const p=JSON.parse(timer.getFieldValue('PARAMS'));p.turns=1;p.body[0].elseActs[0].p.ratio=.25;
      timer.setFieldValue(JSON.stringify(p),'PARAMS');
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
      const parsed=createKitBlockParser('skill')(reload.getTopBlocks(false)[0],entry.node,entry.order)!;
      const changed={...frost,kit:frost.kit.map((e:any)=>e.order===entry.order?parsed:e)};validateKit(changed.kit);
      for(const side of ['p1','p2'] as const){
        const hist=await h.play(side,{self:h.unit('S',12000,[changed,h.wait()]),opp:h.unit('E',12000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},2);
        assert.deepEqual(hist.map(r=>r.opp.currentHp),[9000,9000]);
      }
    }finally{ws.dispose();reload.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    const sustain=h.kitSkill('免疫並補滿',[{op:'immune_status_turns',p:{turns:10,cls:'',reflect:false}},{op:'heal_flat',p:{amount:12000}}]);
    await check(`${side} 霜凍每回合重判低血、只吸取4次；異常失敗吸取強化而不反轉`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',5000,[frost,h.wait()],{maxHp:12000,speed:100}),opp:h.unit('E',12000,[sustain],{speed:200,statStages:{atk:2,def:1}}),turns:(_e,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[6000,8000,8000,8000,12000]);
      assert.deepEqual(hist.map(r=>r.self.currentHp),[11000,12000,12000,12000,12000]);
      assert.equal(hist[0].opp.statStages.atk,0);assert.equal(hist[0].self.statStages.atk,2);assert.equal(hist[0].self.statStages.def,1);
      assert.ok(!h.statuses(hist[0].opp).includes('冰封'));
    });
    await check(`${side} 霜凍恰好半血使用1/3；機率異常成功不吸取強化`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',6000,[frost],{maxHp:12000}),opp:h.unit('E',12000,[h.wait()],{statStages:{atk:2}})});
      assert.equal(r.opp.currentHp,8000);assert.equal(r.self.currentHp,10000);
      assert.ok(h.statuses(r.opp).includes('冰封'));assert.equal(r.opp.statStages.atk,2);assert.equal(r.self.statStages.atk??0,0);
    });
    await check(`${side} 霜凍附加封印不啟動異常、免疫或持續吸取`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',6000,[frost,h.wait()],{maxHp:12000,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',12000,[h.wait()],{statStages:{atk:2}}),turns:(_e,t)=>[t===1?0:1,0]},2);
      for(const r of hist){assert.equal(r.self.currentHp,6000);assert.equal(r.opp.currentHp,12000);assert.ok(!h.statuses(r.opp).includes('冰封'));}
      assert.equal(hist[0].state[`${side}RegistryState`].reflectStatusTurns??0,0);
    });
    await check(`${side} 霜凍反彈全類異常期限含當回合；第5回合恢復受異常`,async()=>{
      const shieldHeal=h.kitSkill('免疫並补滿',[{op:'immune_status_turns',p:{turns:10,cls:'',reflect:false}},{op:'heal_flat',p:{amount:50000}}]);
      const poison=h.kitSkill('補滿並中毒',[{op:'heal_flat',p:{amount:50000}},{op:'status',p:{side:'opp',status:'中毒',chance:100}}]);
      const hist=await h.play(side,{self:h.unit('S',50000,[frost,h.wait()]),opp:h.unit('E',50000,[shieldHeal,poison],{speed:200}),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},5);
      for(const r of hist.slice(0,4))assert.ok(!h.statuses(r.self).includes('中毒'));
      assert.ok(h.statuses(hist[4].self).includes('中毒'));
      assert.deepEqual(hist.map(r=>r.state[`${side}RegistryState`].reflectStatusTurns??0),[3,2,1,0,0]);
    });
  }
  console.log(`${checks} checks`);
}finally{await h.close();}
