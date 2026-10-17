import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {matchAct}=await h.server.ssrLoadModule('/src/blocks/parse.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const a=(p:any)=>({op:'maxhp',p,label:'體力上限變化'});
const entry=(p:any)=>({codeId:'effect_sequence',node:'cthyaat_death',source:'soulmark',role:'innate',order:0,
  params:{clause:{raw:'自身被擊敗時令對手體力上限減少35%',trig:'defeated',parsed:true,body:[{acts:[a(p)]}]}}});
const p={side:'opp',ratio:.35,direction:'decrease'};
const trait=(e:any)=>({name:'可編輯上限',description:'正式被擊敗時',effectMode:'kit',kit:[e]});
try{
  await check('減少文本解析為明確方向與正比例，合約拒絕未知方向／超100%／缺失比例',()=>{
    assert.deepEqual(matchAct('令對手的體力上限減少35%').p,p);
    assert.equal(sequenceIssue(entry(p).params.clause,'cthyaat_death'),null);
    for(const bad of [{...p,direction:'subtract'},{...p,ratio:1.01},{side:'opp',direction:'decrease'},{...p,side:'both'},{...p,ratio:-.35}])assert.ok(sequenceIssue(entry(bad).params.clause));
  });
  let edited:any;
  await check('Blockly將35%改成50%，保存重載仍是減少方向',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{const slot=w.newBlock('custom_node_slot');slot.setFieldValue('cthyaat_death','TARGET_NODE');const b=buildEntryBlock(w as any,entry(p) as any)!;slot.getInput('STACK')!.connection!.connect(b.previousConnection!);
      const act=w.getAllBlocks(false).find(b=>b.type==='sequence_action')!;const next=JSON.parse(act.getFieldValue('PARAMS'));next.ratio=.5;act.setFieldValue(JSON.stringify(next),'PARAMS');
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);const s=r.getTopBlocks(false)[0];edited=createKitBlockParser('soulmark')(s.getInputTargetBlock('STACK'),s.getFieldValue('TARGET_NODE'),0)!;
      assert.equal(edited.params.clause.body[0].acts[0].p.direction,'decrease');assert.equal(sequenceIssue(edited.params.clause,edited.node),null);
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    for(const [node,event] of [[1,T.AFTER_ACTION],[2,T.BATTLE_PHASE_END],[3,T.ROUND_END]] as const){
      await check(`${side} 正式死亡節點${node}只執行一次，減上限35%且同步能力體力／夾住HP，不影響場下`,async()=>{
        const seen:number[]=[];h.S.E=(c:any,e:any)=>{if(e===event)c.applyTrueDamage(c.targetSide,20000,'測試致死時點');};h.S.S=(_:any,e:any,d:any)=>{if(e===T.DEATH_NODE_1)seen.push(d.node);};
        try{const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{speed:50,extra:{trait:trait(entry(p))}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[h.wait()],{speed:200}),oppBench:[h.unit('EB',10000,[h.wait()])]});
          assert.deepEqual(seen,[node]);assert.equal(r.opp.maxHp,6500,r.logs.join('\n'));assert.equal(r.opp.currentHp,6500);assert.equal(r.opp.calculatedStats.hp,6500);assert.equal(r.opp.calculatedStats.atk,300);
          const other=side==='p1'?'p2':'p1';assert.equal(r.state[`${other}Team`][1].maxHp,10000);assert.equal(r.self.currentHp,0);
        }finally{delete h.S.E;delete h.S.S;}
      });
    }
    await check(`${side} 改名後重載Kit在正式死亡節點三減50%，不依精靈或技能名稱`,async()=>{
      h.S.E=(c:any,e:any)=>{if(e===T.ROUND_END)c.applyTrueDamage(c.targetSide,20000,'測試末尾致死');};
      try{const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{trait:{...trait(edited),name:'改名後的上限積木'}}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[h.wait()])});assert.equal(r.opp.maxHp,5000,r.logs.join('\n'));}finally{delete h.S.E;}
    });
    await check(`${side} 未被擊敗不預減；增加上限保留既有HP，100%減少最低1且不復活`,async()=>{
      const [idle]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{trait:trait(entry(p))}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(idle.opp.maxHp,10000);
      const grow=h.kitSkill('提升上限',[a({side:'self',ratio:.35})]);const [inc]=await h.play(side,{self:h.unit('S',8000,[grow],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()])});assert.equal(inc.self.maxHp,13500);assert.equal(inc.self.calculatedStats.hp,13500);assert.equal(inc.self.currentHp,8000);
      const min=h.kitSkill('降低上限',[a({...p,ratio:1})]);const [dec]=await h.play(side,{self:h.unit('S',10000,[min],{speed:200}),opp:h.unit('E',10000,[h.wait()])});assert.equal(dec.opp.maxHp,1);assert.equal(dec.opp.currentHp,1);
    });
  }
  console.log(`${checks} checks: maxHp changes + all three formal death nodes`);
}finally{delete h.S.E;delete h.S.S;await h.close();}
process.exit(0);
