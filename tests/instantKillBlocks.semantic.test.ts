import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {kitEntryIssue} from '../src/effects/effectConnection';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const kill=(chance=100)=>h.kitSkill('秒殺工具',[{op:'instant_kill',p:{chance}}]);
const trait=(node:string,trig:string,acts:any[])=>({name:'正式秒殺規則',effectMode:'kit',kit:[{codeId:'effect_sequence',node,source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'正式秒殺規則',trig,parsed:true,body:[{acts:acts.map(a=>({label:a.op,...a}))}]}}}]});
const guard=(dir='in',scope='self')=>trait('before_instant_kill','before_instant_kill',[{op:'prevent_instant_kill',p:{dir,scope}}]);
const chain=()=>trait('before_instant_kill','before_instant_kill',[{op:'instant_kill_same_hp_targets',p:{}}]);
const fatalName='正式致命抵抗測試',sourceName='秒殺來源觀測',targetName='秒殺受方觀測';
let sourceKills=0,damageEvents=0;
h.S[fatalName]=(ctx:any,event:any)=>{if(event===T.FATAL_RESIST){ctx.updateElf(ctx.actor,{currentHp:1});return true;}};
h.S[sourceName]=(_:any,event:any)=>{if(event===T.ON_KILL)sourceKills++;};
h.S[targetName]=(_:any,event:any)=>{if(event===T.ON_DAMAGED)damageEvents++;};
try{
  await check('嚴格秒殺／前置攔截／同體力快照合約，未知參數或錯時點拒絕',async()=>{
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
    assert.equal(sequenceIssue(kill().kit[0].params.clause),null);assert.equal(sequenceIssue(guard().kit[0].params.clause),null);
    for(const chance of [-1,101,NaN,'100'])assert.ok(sequenceIssue(kill(chance as any).kit[0].params.clause));
    const bad=structuredClone(guard().kit[0].params.clause);bad.trig='entrance';assert.ok(sequenceIssue(bad));
    const badScope=structuredClone(guard().kit[0].params.clause);badScope.body[0].acts[0].p.scope='any';assert.ok(sequenceIssue(badScope));
    const missing=structuredClone(kill().kit[0].params.clause);missing.body[0].acts[0].p={};assert.ok(sequenceIssue(missing));
    const unknown=structuredClone(kill().kit[0].params.clause);unknown.body[0].acts[0].p.handler='native';assert.ok(sequenceIssue(unknown));
    const wrongChain=structuredClone(chain().kit[0].params.clause);wrongChain.trig='kill';assert.ok(sequenceIssue(wrongChain));
  });
  await check('秒殺前防護／同體力選目標節點可保存重載為可執行圖紙，不借原生節點',async()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{
      for(const definition of [guard(),guard('out','team'),chain()]){
        w.clear();r.clear();const entry=definition.kit[0];assert.equal(kitEntryIssue(entry as any),null,JSON.stringify(entry));
        const b=buildEntryBlock(w as any,entry);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
        assert.deepEqual(createKitBlockParser('mechanic')(r.getTopBlocks(false)[0],entry.node as any,entry.order),entry);
      }
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 秒殺繞過盾罩／傷害免疫及上限，無受傷吸血事件，保留擊敗來源`,async()=>{
      sourceKills=0;damageEvents=0;
      const healOnKill=trait('on_kill','kill',[{op:'heal_flat',p:{amount:123}}]);
      const immune=trait('before_damage','incoming',[{op:'dmg_mod',p:{dir:'in',kind:'',reduce:1}}]);
      const [r]=await h.play(side,{self:h.unit('S',10000,[kill()],{maxHp:20000,extra:{name:sourceName,trait:healOnKill}}),
        opp:h.unit('E',30000,[h.wait()],{extra:{name:targetName,trait:immune,shield:90000,barrier:80000,resistances:{damageResist:{fixed:100,percent:100}}}})});
      assert.equal(r.opp.currentHp,0,r.logs.join('\n'));assert.equal(r.opp.shield,90000);assert.equal(r.opp.barrier,80000);
      assert.equal(r.self.currentHp,10123,r.logs.join('\n'));assert.equal(sourceKills,1);assert.equal(damageEvents,0);
      assert.equal(r.state[`${other}TurnStats`].trueDamage||0,0);
    });
    await check(`${side} 正式致命抵抗保留1，特殊非正存活及免疫死亡不被強行判死`,async()=>{
      const {liurenSurvivalRule,reyGodDescentRule}=await h.server.ssrLoadModule('/src/battle/survivalRules.ts');
      for(const mode of ['fatal','freeze','descent','immortal','negative']){
        const extra=mode==='fatal'?{name:fatalName}:mode==='freeze'?{survivalRule:liurenSurvivalRule()}:mode==='descent'||mode==='negative'?{survivalRule:reyGodDescentRule(30000)}:{deathImmunity:{guardTurns:0,deathImmuneTurns:4}};
        const [r]=await h.play(side,{self:h.unit('S',10000,[kill()]),opp:h.unit('E',mode==='negative'?-3000:30000,[h.wait()],{maxHp:30000,extra})});
        assert.equal(r.opp.currentHp,mode==='fatal'?1:mode==='negative'?-3000:0,mode+'\n'+r.logs.join('\n'));
        assert.notEqual(r.state.phase,'ended',mode);
      }
    });
    await check(`${side} 自身／陣營／場下秒殺防護範圍，不借其他精靈的自身防護`,async()=>{
      for(const mode of ['active','benchSelf','benchTeam','dead','vanished']){
        const bench=h.unit('B',mode==='dead'?0:30000,[h.wait()],{extra:{trait:guard('in',mode==='benchSelf'?'self':'team'),isVanished:mode==='vanished'}});
        const [r]=await h.play(side,{self:h.unit('S',10000,[kill()]),opp:h.unit('E',30000,[h.wait()],{extra:mode==='active'?{trait:guard()}:{} }),oppBench:mode==='active'?[]:[bench]});
        assert.equal(r.opp.currentHp,mode==='active'||mode==='benchTeam'?30000:0,mode+'\n'+r.logs.join('\n'));
      }
      const [r]=await h.play(side,{self:h.unit('S',10000,[kill()],{extra:{trait:guard('out')}}),opp:h.unit('E',30000,[h.wait()])});assert.equal(r.opp.currentHp,30000);
    });
    await check(`${side} 同體力鏈在修正前快照，場下逐隻結算護盾與免死，不重複攻擊在場`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',10000,[kill()],{extra:{trait:chain()}}),opp:h.unit('E',30000,[h.wait()]),
        oppBench:[h.unit('B',30000,[h.wait()],{extra:{shield:90000}}),h.unit('C',30000,[h.wait()],{extra:{name:fatalName}}),h.unit('D',29000,[h.wait()])]});
      const team=r.state[`${other}Team`];assert.deepEqual(team.map((e:any)=>e.currentHp),[0,0,1,29000],r.logs.join('\n'));
      assert.equal(team[1].shield,90000);assert.equal(r.logs.filter((s:string)=>s.includes('【E】被秒殺')).length,1);
    });
    await check(`${side} 恐懼之種／花經持有者正式禁秒殺旗標，其他印記不禁`,async()=>{
      for(const id of ['fear_seed','fear_flower','unrelated']){
        const name=`禁秒殺_${id}`;h.S[name]=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE)ctx.setMark({id,name:id,count:1,displayChar:'禁',description:'測試正式印記'},ctx.actor);};
        try{const [r]=await h.play(side,{self:h.unit('S',10000,[kill()],{extra:{name}}),opp:h.unit('E',30000,[h.wait()])});assert.equal(r.opp.currentHp,id==='unrelated'?0:30000,id+'\n'+r.logs.join('\n'));}
        finally{delete h.S[name];}
      }
    });
    await check(`${side} 機率0不秒殺；原生湮滅背包攔截只凝聚一次，同體力鏈保留目標身分`,async()=>{
      const [none]=await h.play(side,{self:h.unit('S',10000,[kill(0)]),opp:h.unit('E',30000,[h.wait()])});assert.equal(none.opp.currentHp,30000);
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5024');
      const [r]=await h.play(side,{self:h.unit('S',10000,[kill()]),opp:h.unit('E',30000,[h.wait()]),oppBench:[h.unit('L',30000,[h.wait()],{extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}})]});
      assert.equal(r.opp.currentHp,30000,r.logs.join('\n'));assert.equal(r.state[`${other}Marks`].find((m:any)=>m.id==='demon_grudge').count,2);
      assert.equal(r.logs.filter((s:string)=>s.includes('令對方秒殺失效')).length,1,'初始1層之外只凝聚1層');
      const [linked]=await h.play(side,{self:h.unit('S',10000,[kill()],{maxHp:20000,extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',30000,[h.wait()]),oppBench:[h.unit('B',30000,[h.wait()]),h.unit('C',29000,[h.wait()])]});
      assert.deepEqual(linked.state[`${other}Team`].map((e:any)=>e.currentHp),[0,0,29000],linked.logs.join('\n'));
    });
  }
  console.log(`正式秒殺積木：${checks}項通過`);
}finally{delete h.S[fatalName];delete h.S[sourceName];delete h.S[targetName];await h.close();}
