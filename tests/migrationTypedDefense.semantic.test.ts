import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_TYPED_DEFENSE_SKILL_KITS as definitions} from '../src/data/migratedTypedDefenseSkillKits';
import {sequenceIssue} from '../src/effects/sequenceContract';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const ghost=()=>structuredClone(h.find('5025','幽幕折返'));
const percentReduction=(reduce:number)=>({name:'百分比減傷',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'百分比減傷',trig:'incoming',parsed:true,body:[{acts:[{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce},label:'百分比減傷'}]}]}}}]});
const remaining=(state:any,side:string,field:string)=>(state[`${side}Timers`]||[]).filter((t:any)=>t.payload?.block?.[field]!=null).map((t:any)=>t.remaining);
try{
  await check('幽幕全文精確來源、Kit路由、真正Blockly保存重載；拒絕未支援的分類／比例／時點',()=>{
    const def=definitions[0],loaded=ghost();assert.equal(loaded.description,def.description);assert.equal(loaded.effectMode,'kit');assert.deepEqual(loaded.kit,def.kit);
    defineCustomBlocks();const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
    try{
      for(const entry of loaded.kit){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
      const entries=restored.getTopBlocks(false).map(block=>{const entry=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,entry.node,entry.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(entries,loaded.kit);
    }finally{workspace.dispose();restored.dispose();}
    const clause:any=structuredClone(def.kit[6].params.clause);assert.equal(sequenceIssue(clause,'on_skill_use'),null);
    clause.body[0].acts[0].p.kind='未知';assert.ok(sequenceIssue(clause,'on_skill_use'));
    clause.body[0].acts[0].p.kind='特殊';clause.body[0].acts[0].p.trig='damaged_skill';assert.ok(sequenceIssue(clause,'on_skill_use'));
    clause.body[0].acts[0].p.trig='self_skill';clause.body[0].acts[0].p.body[0].acts[0].p.ratio=1.1;assert.ok(sequenceIssue(clause,'on_skill_use'));
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 特殊忽略只消耗3次特殊技能；物理、屬性不耗次數，第四次恢復正常防禦`,async()=>{
      const histories=[];
      for(const enabled of [false,true]){
        const activation=ghost();if(!enabled)activation.kit=activation.kit.filter((e:any)=>e.order!==6);
        histories.push(await h.play(side,{
          self:h.unit('S',100000,[activation,{...h.wait(),name:'物理攻擊',category:'物理',power:100},{...h.wait(),name:'特殊攻擊',category:'特殊',power:100},h.wait()],{speed:200}),
          opp:h.unit('E',100000,[h.wait()],{extra:{trait:percentReduction(1)}}),
          turns:(_,turn)=>[([0,1,2,3,2,2,2] as number[])[turn-1],0],
        },7));
      }
      const damage=(history:any[],turn:number)=>history[turn-2].opp.currentHp-history[turn-1].opp.currentHp;
      for(const turn of [3,5,6])assert.ok(damage(histories[1],turn)>damage(histories[0],turn),`第${turn}回合应忽略特防`);
      for(const turn of [2,7])assert.equal(damage(histories[1],turn),damage(histories[0],turn),`第${turn}回合不忽略特防`);
      assert.deepEqual(histories[1].map((result:any)=>remaining(result.state,side,'skillKind')),[ [3],[3],[2],[2],[1],[],[] ]);
      assert.deepEqual(histories[1].slice(0,5).map((result:any)=>remaining(result.state,side,'prio')),[ [3],[2],[1],[],[] ],'附加先制當次不計入下3次');
    });
    await check(`${side} 對手類型強化分支；低於半血吸取翻倍和5回合期限`,async()=>{
      for(const type of ['普通','神靈']){
        const [result]=await h.play(side,{self:h.unit('S',10000,[ghost()]),opp:h.unit('E',100000,[h.wait()],{type,extra:{trait:percentReduction(1)}})});
        assert.equal(result.self.statStages.def,type==='神靈'?1:2);
      }
      for(const hp of [4999,5000]){
        const [result]=await h.play(side,{self:h.unit('S',hp,[ghost()],{maxHp:10000}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:percentReduction(.8)}})});
        assert.equal(result.opp.currentHp,hp===4999?86667:93334,result.logs.join('\n'));
      }
      const history=await h.play(side,{self:h.unit('S',10000,[ghost(),h.wait()]),opp:h.unit('E',100000,[h.wait()],{extra:{trait:percentReduction(.8)}}),turns:(_,turn)=>[turn===1?0:1,0]},6);
      assert.deepEqual(history.map((r:any)=>r.opp.currentHp),[93334,86668,80002,73336,66670,66670]);
    });
    await check(`${side} 免疫並反彈兩次異常，第三次正常附加`,async()=>{
      const history=await h.play(side,{
        self:h.unit('S',100000,[ghost(),h.wait()],{speed:200}),
        opp:h.unit('E',100000,[h.kitSkill('附加中毒',[{op:'status',p:{side:'opp',status:'中毒',turns:3,chance:100}}])],{extra:{trait:percentReduction(1)}}),
        turns:(_,turn)=>[turn===1?0:1,0],
      },3);
      assert.ok(h.statuses(history[0].opp).includes('中毒'),history[0].logs.join('\n'));
      for(const result of history.slice(0,2))assert.ok(!h.statuses(result.self).includes('中毒'),result.logs.join('\n'));
      assert.ok(h.statuses(history[2].self).includes('中毒'),history[2].logs.join('\n'));
      assert.deepEqual(history.map((result:any)=>result.state[`${side}RegistryState`].blkReflectStatusCount||0),[1,0,0]);
    });
    await check(`${side} 原持有者不重播舊吸取、先制和特防次數`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5025');
      const [result]=await h.play(side,{
        self:h.unit('S',100000,[ghost()],{speed:200,extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),
        opp:h.unit('E',100000,[h.wait()],{extra:{trait:percentReduction(1)}}),
      });
      assert.equal(result.self.statStages.def,2,result.logs.join('\n'));
      const state=result.state[`${side}RegistryState`];assert.equal(state.blkReflectStatusCount,2);
      for(const key of ['drainHpTurns','nextPriorityCount','ignoreSpDefCount'])assert.equal(state[key]||0,0,key);
    });
  }
  console.log(`分類防禦遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
