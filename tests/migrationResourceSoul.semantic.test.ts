import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_RESOURCE_SOUL_KITS as defs} from '../src/data/migratedResourceSoulKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,legacyCalls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const originalElf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5024'),soul=originalElf.soulMark,old=h.S[originalElf.name];
h.S[originalElf.name]=(c:any,e:any,d:any)=>{legacyCalls++;return old?.(c,e,d);};
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const unit=(hp=10000,extra:any={},skills=[h.wait()],maxHp=10000)=>h.unit('S',hp,skills,{maxHp,speed:200,extra:{name:originalElf.name,soulMark:structuredClone(soul),...extra}});
const own=(r:any,side:string,id='S')=>r.state[`${side}Marks`].find((m:any)=>m.id==='demon_grudge'&&m.ownerBattleId===id);
const hit=()=>({...h.wait(),name:'普通攻擊',category:'物理',power:100});
const base=(c:any,e:any,d:any)=>{const comp=d?.damageComp||d;if(e===T.BEFORE_DAMAGE&&!comp.isIncoming&&comp.damageCategory==='skill_attack')comp.base=1000;};
let edited:any;
try{
  await check('整份原文精確匹配，正式默认來源是可編輯Kit且無專屬動作／空動作',()=>{
    assert.equal(defs[0].description,(source as any)['5024'].soulMark);assert.equal(soul.description,defs[0].description);assert.equal(soul.effectMode,'kit');assert.deepEqual(soul.kit,defs[0].kit);
    for(const e of soul.kit){assert.equal(sequenceIssue(e.params.clause,e.node),null);assert.equal(e.codeId,'effect_sequence');assert.ok(!JSON.stringify(e).includes('"noop"'));}
  });
  await check('Blockly所有節點保存重載，35改70及每層5%改10%後仍可改名實行',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{for(const e of soul.kit){const slot=w.newBlock('custom_node_slot');slot.setFieldValue(e.node,'TARGET_NODE');const b=buildEntryBlock(w as any,e)!;slot.getInput('STACK')!.connection!.connect(b.previousConnection!);}
      for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));if(op==='stat_value')p.amount=70;if(op==='dmg_mod')p.boost=.1;if(op==='resource_mark_add')p.incomingDamageReduction.ratio=.1;b.setFieldValue(JSON.stringify(p),'PARAMS');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);edited={...soul,name:'自訂資源魂印',kit:r.getTopBlocks(false).map((s:any,i:number)=>createKitBlockParser('soulmark')(s.getInputTargetBlock('STACK'),s.getFieldValue('TARGET_NODE'),i)!)};for(const e of edited.kit)assert.equal(sequenceIssue(e.params.clause,e.node),null);
    }finally{w.dispose();r.dispose();}
  });
  await check('護盾／護罩的體力基數與比例互斥且有讀取端，拒絕未知資源種類',()=>{
    const clause=(p:any)=>h.kitSkill('雙盾',[{op:'shield',p}]).kit[0].params.clause;
    for(const p of [{ratio:.5,base:'最大體力',kind:'barrier'},{flat:50,kind:'shield'},{ratio:.5,base:'已損失體力'}])assert.equal(sequenceIssue(clause(p)),null);
    for(const p of [{ratio:.5,base:'護盾值'},{flat:1,ratio:.5},{flat:1,base:'最大體力'},{ratio:.5,kind:'armor'},{}])assert.ok(sequenceIssue(clause(p)));
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 開局首發與同id場下各自1層，加雙方瞬殺2個各為3層，不共享或重播`,async()=>{
      const bench=unit(10000,{battleId:'B',trait:{name:'瞬殺',description:''}});const hist=await h.play(side,{self:unit(),selfBench:[bench],opp:h.unit('E',10000,[h.wait()],{extra:{alienTraits:{generalTrait:{name:'瞬殺',description:''}}}}),turns:(_,t)=>[t===2?{switch:1}:0,0]},2);
      assert.equal(own(hist[0],side).count,3);assert.equal(own(hist[0],side,'B').count,3);assert.equal(own(hist[1],side).count,3);assert.equal(own(hist[1],side,'B').count,3);
    });
    await check(`${side} 真正對手使用時滿血清回合與正強化；己方自己出招不提早清除`,async()=>{
      let atOwnDamage:any;h.S.E=(c:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&(d?.damageComp||d).isIncoming)atOwnDamage={...c.self.statStages};};
      try{const [r]=await h.play(side,{self:unit(10000,{},[hit()]),opp:h.unit('E',10000,[h.wait()],{extra:{statStages:{atk:2,def:-1},shield:10000}})});assert.equal(atOwnDamage.atk,2);assert.equal(r.opp.statStages.atk,0,r.logs.join('\n'));assert.equal(r.opp.statStages.def,-1);assert.equal(r.self.shield||0,0);
        const shield=h.turnEffectSkill();const hist=await h.play(side,{self:unit(),opp:h.unit('E',10000,[shield,h.wait()]),turns:(_,t)=>[0,t===1?0:1]},2);assert.ok(hist[0].state[`${other}Timers`].some((t:any)=>t.kind==='turn_effect'));assert.ok(!hist[1].state[`${other}Timers`].some((t:any)=>t.kind==='turn_effect'));
      }finally{delete h.S.E;}
    });
    await check(`${side} 未滿血按已損失體力取50%雙盾，階段末只恢复回合初雙盾150`,async()=>{
      let hpAtRoundEnd=0;h.S.E=(c:any,e:any)=>{if(e===T.ROUND_END)hpAtRoundEnd=c.target.currentHp;};
      try{const [r]=await h.play(side,{self:unit(6000,{shield:100,barrier:50}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.shield,2100,r.logs.join('\n'));assert.equal(r.self.barrier,2050);assert.equal(r.self.currentHp,6150);assert.equal(hpAtRoundEnd,6150);assert.equal(r.state[`${side}RegistryState`].blockSnapshot_defense_resources,undefined);}finally{delete h.S.E;}
    });
    await check(`${side} 對手換人沒使用技能不造雙盾／不恢復；禁療仍消耗快照`,async()=>{
      const [r]=await h.play(side,{self:unit(6000,{shield:100,barrier:50}),opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('EB',10000,[h.wait()])],turns:()=>[0,{switch:1}]});assert.equal(r.self.currentHp,6000);assert.equal(r.self.shield,100);assert.equal(r.self.barrier,50);
      const ban=h.kitSkill('禁止恢復',[{op:'no_heal',p:{turns:2,next:false}}]);const [b]=await h.play(side,{self:unit(6000,{shield:100,barrier:50}),opp:h.unit('E',10000,[ban])});assert.equal(b.self.currentHp,6000);assert.equal(b.state[`${side}RegistryState`].blockSnapshot_defense_resources,undefined);
    });
    await check(`${side} 場下活著持有者阻止對方秒殺並僅自己的資源+1；陣亡持有者不阻止`,async()=>{
      const kill=h.kitSkill('正式秒殺',[{op:'instant_kill',p:{chance:100}}]);
      const [r]=await h.play(side,{self:h.unit('A',10000,[h.wait()]),selfBench:[unit(10000,{battleId:'B'})],opp:h.unit('E',10000,[kill])});assert.equal(r.self.currentHp,10000);assert.equal(own(r,side,'B').count,2);assert.equal(own(r,side,'A'),undefined);
      const [d]=await h.play(side,{self:h.unit('A',10000,[h.wait()]),selfBench:[unit(0,{battleId:'B'})],opp:h.unit('E',10000,[kill])});assert.equal(d.self.currentHp,0);assert.equal(own(d,side,'B'),undefined);
    });
    await check(`${side} 自身秒殺依真正HP快照擴展目標，擊敗後六项35點與層數+2各一次`,async()=>{
      const kill=h.kitSkill('正式秒殺',[{op:'instant_kill',p:{chance:100}}]);const [r]=await h.play(side,{self:unit(8000,{},[kill]),opp:h.unit('E',10000,[h.wait()],{extra:{shield:20000}}),oppBench:[h.unit('B',10000,[h.wait()]),h.unit('C',9000,[h.wait()])]});assert.equal(r.opp.currentHp,0);assert.equal(r.opp.shield,20000);assert.equal(r.state[`${other}Team`][1].currentHp,0);assert.equal(r.state[`${other}Team`][2].currentHp,9000);assert.equal(own(r,side).count,3);assert.equal(r.self.maxHp,10035);assert.equal(r.self.currentHp,8000);assert.equal(r.self.calculatedStats.atk,335);assert.equal(r.self.calculatedStats.speed,235);
    });
    await check(`${side} 4層可受控制／5層免疫且仍可受中毒；每層減傷不與預設雙算`,async()=>{
      for(const n of [4,5]){const trait=()=>({name:'瞬殺',description:''});const bench=Array.from({length:n-1},(_,i)=>h.unit(`B${i}`,10000,[h.wait()],{extra:{trait:trait()}}));const fear=h.kitSkill('控制與毒',[{op:'status',p:{side:'opp',status:'害怕',turns:3,chance:100}},{op:'status',p:{side:'opp',status:'中毒',turns:3,chance:100}}]);const [r]=await h.play(side,{self:unit(),selfBench:bench,opp:h.unit('E',10000,[fear])});assert.equal(h.statuses(r.self).includes('害怕'),n===4);assert.ok(h.statuses(r.self).includes('中毒'));}
      h.S.E=base;try{const [r]=await h.play(side,{self:unit(),opp:h.unit('E',10000,[hit()])});assert.equal(r.self.currentHp,9050,r.logs.join('\n'));}finally{delete h.S.E;}
    });
    await check(`${side} 原資源技能PP轉層只加自身，不給同id場下副本；整份魂印不回查旧handler`,async()=>{
      const skill={...structuredClone(h.find('5024','絕滅・萬物哀鳴')),power:0,pp:5,maxPp:5};const [r]=await h.play(side,{self:unit(10000,{},[skill]),selfBench:[unit(10000,{battleId:'B'})],opp:h.unit('E',10000,[h.wait()])});assert.equal(own(r,side)?.count,5,JSON.stringify(r.state[`${side}Marks`]));assert.equal(own(r,side,'B')?.count,1,JSON.stringify(r.state[`${side}Marks`]));assert.equal(legacyCalls,0,r.logs.join('\n'));
    });
    await check(`${side} 保存重載改名後真正擊敗，70點生效；被擊敗仍在正式死亡末點減35%`,async()=>{
      const kill=h.kitSkill('正式傷害',[{op:'dmg',p:{flat:20000,type:'真實'}}]);const [r]=await h.play(side,{self:unit(10000,{soulMark:structuredClone(edited)},[kill]),opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('B',10000,[h.wait()])]});assert.equal(r.self.calculatedStats.atk,370);assert.equal(r.self.maxHp,10070);
      h.S.E=(c:any,e:any)=>{if(e===T.ROUND_END)c.applyTrueDamage(c.targetSide,20000,'正式末節點');};try{const [d]=await h.play(side,{self:unit(),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[h.wait()])});assert.equal(d.opp.maxHp,6500,d.logs.join('\n'));}finally{delete h.S.E;}
    });
    await check(`${side} 重載改成每層10%後雙向正式攻擊各一次，增傷10%／減傷10%`,async()=>{
      h.S.E=(c:any,e:any,d:any)=>{const comp=d?.damageComp||d;if(e===T.BEFORE_DAMAGE&&comp.damageCategory==='skill_attack')comp.base=1000;};
      try{const [r]=await h.play(side,{self:unit(10000,{soulMark:structuredClone(edited)},[hit()]),opp:h.unit('E',10000,[hit()])});assert.equal(r.opp.currentHp,8900,r.logs.join('\n'));assert.equal(r.self.currentHp,9100);}finally{delete h.S.E;}
    });
  }
  assert.equal(legacyCalls,0);console.log(`${checks} checks: full resource soul, no native handler`);
}finally{h.S[originalElf.name]=old;delete h.S.E;await h.close();}
process.exit(0);
