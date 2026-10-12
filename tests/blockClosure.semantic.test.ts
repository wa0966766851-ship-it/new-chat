import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { createHarness } from './helpers/migrationHarness';
import { REMAINING_SIMPLE_SKILL_KITS } from '../src/data/remainingSimpleSkillKits';
import { MIGRATED_CLOSURE_SKILL_KITS } from '../src/data/migratedClosureSkillKits';
import { validateKit } from '../src/effects/kitValidation';
import { REVIEWED_SOUL_KITS } from '../src/data/reviewedSoulKits';
import { MIGRATED_SHARED_SKILL_KITS } from '../src/data/migratedSharedSkillKits';
const h=await createHarness();let count=0;
const check=async(name:string,fn:()=>Promise<void>)=>{await fn();console.log(`✓ ${name}`);count++;};
try {
  defineCustomBlocks();
  const definitions=[...REMAINING_SIMPLE_SKILL_KITS,...MIGRATED_CLOSURE_SKILL_KITS,...MIGRATED_SHARED_SKILL_KITS];
  await check('全部新增定義確實接到正式卡牌，畫布讀寫與存檔不丟參數',async()=>{
    for(const def of definitions) {
      const source=h.find(def.elfIds[0],def.name);h.assertKitOnly(source);validateKit(source.kit);
      assert.deepEqual(JSON.parse(JSON.stringify(source.kit)),def.kit);
      const ws=new Blockly.Workspace(),restored=new Blockly.Workspace();
      try {
        for(const entry of def.kit) {
          const block=buildEntryBlock(ws as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');
          assert.deepEqual(createKitBlockParser('skill')(block,entry.node,entry.order),entry);
        }
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),restored);
        const back=restored.getTopBlocks(false).map(b=>{const e=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,e.node,e.order);}).sort((a,b)=>a!.order-b!.order);
        assert.deepEqual(back,def.kit);
      } finally {ws.dispose();restored.dispose();}
    }
  });
  await check('封裝入口與原始入口等價、不覆蓋自訂原文與既有手工積木',async()=>{
    const old=await h.server.ssrLoadModule('/src/data/reviewedSkillKits.ts'),packed=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');
    for(const def of definitions) {
      const skill={...h.find(def.elfIds[0],def.name),kit:undefined,effectMode:undefined};
      const elf:any={id:def.elfIds[0],skills:[skill],skillPool:[skill]};
      const a=old.applyReviewedSkillKits(elf),b=packed.applyReviewedSkillKits(elf);
      assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
      b.skills[0].kit[0].customText='edited';assert.notEqual(b.skillPool[0].kit[0].customText,'edited');
      assert.equal(packed.applyReviewedSkillKits({...elf,skills:[{...skill,description:skill.description+'自訂'}]}).skills[0].kit,undefined);
      assert.equal(packed.applyReviewedSkillKits({...elf,skills:[{...skill,effectMode:'registry'}]}).skills[0].effectMode,'registry');
    }
  });
  await check('布萊克魂印整份Kit已套用，真實魂印Blockly序列化往返',async()=>{
    const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
    const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5005');
    assert.equal(elf.soulMark.effectMode,'kit');assert.deepEqual(JSON.parse(JSON.stringify(elf.soulMark.kit)),REVIEWED_SOUL_KITS.find(e=>e.elfIds.includes('5005'))!.kit);
    const ws=new Blockly.Workspace(),restored=new Blockly.Workspace();
    try {
      for(const entry of elf.soulMark.kit) {
        const block=buildEntryBlock(ws as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');
        assert.deepEqual(createKitBlockParser('soulmark')(block,entry.node,entry.order),entry);
      }
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),restored);
      assert.equal(restored.getTopBlocks(false).length,3);
    } finally {ws.dispose();restored.dispose();}
  });
  await check('皮特薩拉羅整份魂印及場下節點有可編輯Blockly，無專屬handler包裝',async()=>{
    const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
    const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5004');assert.equal(elf.soulMark.effectMode,'kit');
    assert.deepEqual(JSON.parse(JSON.stringify(elf.soulMark.kit)),REVIEWED_SOUL_KITS.find(e=>e.elfIds.includes('5004'))!.kit);
    const ws=new Blockly.Workspace();
    try {for(const entry of elf.soulMark.kit){const b=buildEntryBlock(ws as any,entry);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');assert.deepEqual(createKitBlockParser('soulmark')(b,entry.node,entry.order),entry);}}finally{ws.dispose();}
  });
  await check('同一次失效重算只記一次使用；下一次獨立行動另計',async()=>{
    const {recordConsecutiveUse}=await h.server.ssrLoadModule('/src/effects/sequenceClosureOperations.ts');
    let state:any;const skill={name:'同名',battleSlot:2};
    const ctx:any={self:{skills:[skill]},skill,actionId:1,getPlayerState:()=>state,setPlayerState:(_k:string,v:any)=>state=v};
    recordConsecutiveUse(ctx);recordConsecutiveUse(ctx);assert.equal(state.count,1);
    ctx.actionId=2;recordConsecutiveUse(ctx);assert.equal(state.count,2);
    ctx.actionId=3;ctx.skill={name:'同名',battleSlot:3};recordConsecutiveUse(ctx);assert.equal(state.count,1,'不同槽即使同名也不連續');
  });
  await check('吸血未指明類型只攻擊，明寫技能保留技能；圖紙不把傷害範圍磨掉',async()=>{
    const {parseSkill}=await h.server.ssrLoadModule('/src/blocks/parse.ts');
    for(const [text,kind] of [['造成傷害的50%恢復自身體力','攻擊'],['造成攻擊傷害的50%恢復自身體力','攻擊'],['造成技能傷害的50%恢復自身體力','技能']]) {
      const act=parseSkill('測試',text).clauses[0].body[0].acts[0];assert.equal(act.op,'vampire');assert.equal(act.p.kind,kind);
    }
    for(const [id,name] of [['5003','萬鈞鎮魂'],['5002','聖盾裁決']])assert.equal(h.find(id,name).kit[1].params.clause.body[0].acts[0].p.kind,'攻擊');
  });
  await check('隨機三項能力用無放回，固定亂數也不掛死；被免疫的下降不能空生強化',async()=>{
    const {runAct}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');let own:any,target:any;
    const ctx:any={actor:'p1',targetSide:'p2',rng:()=>0,applyStatChange:(side:string,values:any)=>{if(side==='p2'){target=values;return {success:true,applied:{atk:-1,def:-1,spatk:0}};}own=values;return {success:true,applied:values};}};
    assert.equal(runAct(ctx,{op:'stat_steal_random',p:{count:3,v:1},label:''},{last:null,lastAmount:0}),true);
    assert.deepEqual(target,{atk:-1,def:-1,spatk:-1});assert.deepEqual(own,{atk:1,def:1});
    own=undefined;ctx.applyStatChange=()=>({success:false,applied:{}});
    assert.equal(runAct(ctx,{op:'stat_steal_random',p:{count:3,v:1},label:''},{last:null,lastAmount:0}),false);assert.equal(own,undefined);
  });
  await check('計時器銀行不重啟活動者舊快照；清除及消耗只改指定持有者與陣營',async()=>{
    const {scopedTimers,clearScopedTurnEffects,consumeScopedTimer}=await h.server.ssrLoadModule('/src/battle/stateScopes.ts');
    const timer=(id:string,owner?:string,kind='turn_effect')=>({id,ownerBattleId:owner,scope:owner?'elf':'team',kind,remaining:2,clearable:true,payload:{mirrorRegistryKeys:['privateFlag']}});
    const A=h.unit('A',1000,[]),B=h.unit('B',1000,[]);
    const state:any={p1:A,p2:h.unit('E',1000,[]),p1Timers:[timer('active','A'),timer('team')],p2Timers:[],p1RegistryState:{privateFlag:9},p2RegistryState:{},p1ElfState:{A:{registry:{},timers:[timer('stale','A')]},B:{registry:{privateFlag:7},timers:[timer('bench','B'),timer('soul','B','round_counter')]}},p2ElfState:{}};
    assert.deepEqual(scopedTimers(state,'p1',A).map((t:any)=>t.id),['active','team']);assert.deepEqual(scopedTimers(state,'p1',B).map((t:any)=>t.id),['team','bench','soul']);
    const cleared=clearScopedTurnEffects(state,'p1',B);assert.deepEqual(cleared.removed.map((t:any)=>t.id),['team','bench']);
    assert.deepEqual(cleared.state.p1Timers.map((t:any)=>t.id),['active']);assert.equal(cleared.state.p1RegistryState.privateFlag,9);assert.equal(cleared.state.p1ElfState.B.registry.privateFlag,0);
    assert.deepEqual(cleared.state.p1ElfState.B.timers.map((t:any)=>t.id),['soul']);
    const consumed=consumeScopedTimer(state,'p1',B,'bench');assert.equal(consumed.p1ElfState.B.timers[0].remaining,1);assert.equal(consumed.p1Timers[0].remaining,2);
  });
  const attack={...h.wait(),name:'攻擊',category:'物理',power:50};
  for(const side of ['p1','p2'] as const) {
    await check(`${side} 光合作用首次即恢復／吸取三項，持續3及4回合各自到期，PP倍率3`,async()=>{
      const synthesis=h.find('5011','星光·光合作用'),hurt=h.kitSkill('每回合損失',[{op:'hp_adjust',p:{side:'opp',delta:-1000}}]);
      const hist=await h.play(side,{self:h.unit('S',1000,[synthesis,h.wait()],{maxHp:6000,speed:200}),opp:h.unit('E',20000,[hurt],{speed:100}),turns:(_e,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(hist.map(r=>r.self.currentHp),[3000,5000,5000,5000,4000]);
      // 第2回合3000→6000，實際恢復3000；第3、4回合5000→6000各恢復1000。
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[17000,14000,13000,12000,12000]);
      assert.deepEqual(hist.map(r=>r.opp.skills[0].pp),[96,93,90,89,88]);
      assert.deepEqual(hist.map(r=>Object.values(r.self.statStages).reduce((sum:number,x:any)=>sum+Number(x),0)),[3,6,9,9,9]);
    });
    await check(`${side} 場下来源被反彈時異常回到來源本人，不是同側在場者`,async()=>{
      const make=(node:string,trig:string,acts:any[])=>({name:'指定持有者',effectMode:'kit',description:'测试',kit:[{codeId:'effect_sequence',source:'soulmark',node,order:0,params:{clause:{raw:'测试',trig,parsed:true,body:[{acts:acts.map(a=>({...a,label:a.op}))}]}}}]});
      const caster=make('round_start','team_round_start',[{op:'status',p:{side:'opp',status:'凍傷',chance:100,turns:3}}]);
      const reflector=make('on_entered','entrance',[{op:'immune_status_turns',p:{turns:3,reflect:true,cls:''}}]);
      const [r]=await h.play(side,{self:h.unit('A',10000,[h.wait()]),selfBench:[h.unit('B',10000,[h.wait()],{extra:{soulMark:caster}})],opp:h.unit('E',10000,[h.wait()],{extra:{soulMark:reflector}})});
      assert.ok(h.statuses(r.state[`${side}Team`].find((e:any)=>e.id==='B')).includes('凍傷'));assert.ok(!h.statuses(r.self).includes('凍傷'));assert.ok(!h.statuses(r.opp).includes('凍傷'));
    });
    await check(`${side} 場下能力變化、護盾與異常只寫持有者，自身免疫用自己的個體狀態`,async()=>{
      const soul={name:'場下自身完整寫入',effectMode:'kit',description:'每回合開始自身能力+1、護盾200、凍傷',kit:[{codeId:'effect_sequence',source:'soulmark',node:'round_start',order:0,params:{clause:{raw:'存活於背包內或在場',trig:'team_round_start',parsed:true,body:[{acts:[
        {op:'stat',p:{side:'self',stats:['攻擊'],v:1},label:''},{op:'shield',p:{flat:200},label:''},{op:'status',p:{side:'self',status:'凍傷',chance:100,turns:3},label:''},
      ]}]}}}]};
      const [r]=await h.play(side,{self:h.unit('A',500,[h.wait()],{maxHp:2000}),selfBench:[h.unit('B',1000,[h.wait()],{maxHp:2000,extra:{soulMark:soul}})],opp:h.unit('E',10000,[h.wait()])});
      const owner=r.state[`${side}Team`].find((e:any)=>e.id==='B');assert.equal(owner.statStages.atk,1);assert.equal(owner.shield,200);assert.ok(h.statuses(owner).includes('凍傷'));
      assert.equal(r.self.statStages.atk||0,0);assert.equal(r.self.shield||0,0);assert.ok(!h.statuses(r.self).includes('凍傷'));
      const guarded=structuredClone(soul);guarded.kit[0].params.clause.body[0].acts.unshift({op:'immune_status_count',p:{count:1},label:''} as any);
      const [g]=await h.play(side,{self:h.unit('A',500,[h.wait()],{maxHp:2000}),selfBench:[h.unit('B',1000,[h.wait()],{maxHp:2000,extra:{soulMark:guarded}})],opp:h.unit('E',10000,[h.wait()])});
      assert.ok(!h.statuses(g.state[`${side}Team`].find((e:any)=>e.id==='B')).includes('凍傷'));assert.equal(g.state[`${side}RegistryState`].blkImmuneStatusCount||0,0);
      assert.equal(g.state[`${side}ElfState`].B.registry.blkImmuneStatusCount,0);
    });
    await check(`${side} 千鳥俱寂回合末恢復／等量固定共4回合，麻痺只下2回合攻擊`,async()=>{
      const bird=h.find('5004','千鳥俱寂'),zero={...attack,power:0,isSureHit:true};
      const hist=await h.play(side,{self:h.unit('S',3000,[bird,zero],{maxHp:12000}),opp:h.unit('E',50000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(hist.map(r=>r.self.currentHp),[7000,11000,12000,12000,12000]);
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[46000,42000,41000,41000,41000]);
      assert.ok(!h.statuses(hist[0].opp).includes('麻痺'));assert.ok(h.statuses(hist[1].opp).includes('麻痺'));
      assert.ok(!h.timers(hist[3].state,side).some(t=>t.includes('持續效果')));
    });
    await check(`${side} 光榮之夢以出招前低血判斷等量百分比；混沌不翻倍並保留對手下降`,async()=>{
      const dream=h.find('5000','光榮之夢');
      for(const type of ['普通','混沌','水.混沌']) {
        const [r]=await h.play(side,{self:h.unit('S',1000,[dream],{maxHp:6000}),opp:h.unit('E',10000,[h.wait()],{type,statStages:{atk:1,def:-1}})});
        assert.equal(r.self.currentHp,4000);assert.equal(r.opp.currentHp,7000);assert.equal(r.opp.statStages.atk,0);assert.equal(r.opp.statStages.def,-1);
        assert.equal(r.self.statStages.atk,type==='普通'?3:2);assert.equal(r.self.statStages.def,type==='普通'?2:1);
        assert.ok(!r.logs.some((s:string)=>s.includes('待接通')));
      }
    });
    await check(`${side} 怒濤狂湧只消提升不消下降；消除成功才封屬性且吸血仍為攻擊`,async()=>{
      const wave=h.find('5010','星光·怒濤狂湧'),source={...wave,power:100};
      const [r]=await h.play(side,{self:h.unit('S',1000,[source],{maxHp:5000}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:1,def:-2}})});
      assert.equal(r.opp.statStages.atk,0);assert.equal(r.opp.statStages.def,-2);
      const dealt=10000-r.opp.currentHp;assert.ok(dealt>0);assert.equal(r.self.currentHp,1000+Math.floor(dealt*.5));
      assert.ok(h.timers(r.state,side==='p1'?'p2':'p1').some(t=>t.includes('技能無效')));
      const [none]=await h.play(side,{self:h.unit('S',1000,[source],{maxHp:5000}),opp:h.unit('E',10000,[h.wait()],{statStages:{def:-2}})});
      assert.ok(!h.timers(none.state,side==='p1'?'p2':'p1').some(t=>t.includes('技能無效')));
    });
    await check(`${side} 存活背包回合開始的回血／體力調整／PP都寫持有者，不污染在場者`,async()=>{
      const benchSkill={...h.wait(),pp:10,maxPp:20};
      const soul={name:'場下自身測試',effectMode:'kit',description:'存活於背包內或在場：每回合開始回血、調體力與補PP',kit:[{codeId:'effect_sequence',source:'soulmark',node:'round_start',order:0,params:{clause:{raw:'存活於背包內或在場',trig:'team_round_start',parsed:true,body:[{acts:[
        {op:'heal_flat',p:{amount:50},label:'回血'}, {op:'hp_adjust',p:{side:'self',delta:-10},label:'體力調整'}, {op:'pp_op',p:{side:'self',mode:'add',amount:2},label:'補PP'},
      ]}]}}}]};
      const [r]=await h.play(side,{self:h.unit('A',500,[h.wait()],{maxHp:2000}),selfBench:[h.unit('B',1000,[benchSkill],{maxHp:2000,extra:{soulMark:soul}})],opp:h.unit('E',10000,[h.wait()])});
      const owner=r.state[`${side}Team`].find((e:any)=>e.id==='B');
      assert.equal(r.self.currentHp,500);assert.equal(owner.currentHp,1040);assert.equal(owner.skills[0].pp,12);
      assert.equal(r.self.skills[0].pp,98);
    });
    await check(`${side} 翎魂印攻擊才麻痺與1/3百分比，屬性技能不觸發`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const source=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5004');
      const run=(skill:any)=>h.play(side,{self:h.unit('S',90000,[skill],{extra:{name:source.name,soulMark:structuredClone(source.soulMark)}}),opp:h.unit('E',90000,[h.wait()],{statStages:{atk:-1}})});
      const [r]=await run({...attack,power:0});assert.equal(r.opp.currentHp,60000);assert.ok(h.statuses(r.opp).includes('麻痺'));
      const [none]=await run(h.wait());assert.equal(none.opp.currentHp,90000);assert.ok(!h.statuses(none.opp).includes('麻痺'));
    });
    await check(`${side} 翎魂印首次致死留1血，第二次死亡依序三異常各消耗一次免疫`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const source=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5004');
      const first=h.kitSkill('三次免疫並致死',[{op:'immune_status_count',p:{count:3,reflect:false}},{op:'dmg',p:{flat:20000,type:'固定'}}]);
      const second=h.kitSkill('再致死',[{op:'dmg',p:{flat:20000,type:'固定'}}]);
      const hist=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{name:source.name,soulMark:structuredClone(source.soulMark)}}),opp:h.unit('E',1e6,[first,second]),turns:(_e,t)=>[0,t===1?0:1]},2);
      assert.equal(hist[0].self.currentHp,1);assert.equal(hist[1].self.currentHp,0);
      assert.ok(!h.statuses(hist[1].opp).includes('麻痺'));assert.ok(!h.statuses(hist[1].opp).includes('害怕'));
      assert.ok(h.statuses(hist[1].opp).includes('癱瘓'),'第一次存活消耗一次，死亡麻痺／害怕再消耗兩次，癱瘓不再被免疫');
    });
    await check(`${side} 場下翎僅對手切換登場觸發；陣亡場下持有者不觸發`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const source=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5004');
      const run=(alive:boolean)=>h.play(side,{self:h.unit('A',10000,[h.wait()]),selfBench:[h.unit('B',alive?10000:0,[h.wait()],{maxHp:10000,extra:{name:source.name,soulMark:structuredClone(source.soulMark)}})],
        opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('N',10000,[h.wait()])],turns:()=>[0,{switch:1}]});
      const [r]=await run(true);assert.equal(r.opp.id,'N');assert.ok(h.statuses(r.opp).includes('麻痺'));assert.ok(!h.statuses(r.self).includes('麻痺'));
      assert.ok(!h.statuses((await run(false))[0].opp).includes('麻痺'));
    });
    await check(`${side} 魔焰裂空初次即弱化，總共3回合，不傳給下一隻但己方2次致命可繼承`,async()=>{
      const source=h.find('5006','星光·魔焰裂空'),only={...source,kit:[source.kit[0],source.kit[3],source.kit[4]]};
      const hist=await h.play(side,{self:h.unit('S',1e6,[only,attack]),selfBench:[h.unit('B',1e6,[attack])],opp:h.unit('E',1e6,[h.wait()]),turns:(_e,t)=>[t===1?0:t===2?{switch:1}:0,0]},4);
      assert.equal(hist[0].opp.statStages.def,-1);assert.equal(hist[0].opp.statStages.spdef,-1);
      assert.equal(hist[2].opp.statStages.def,-1,'普通回合類弱化監控不傳給新精靈');
      const timer=(r:any)=>r.state[`${side}Timers`].find((t:any)=>t.payload?.block?.crit);
      assert.equal(timer(hist[1])?.remaining,2,'切換不消耗團隊2次致命');
      assert.equal(timer(hist[2])?.remaining,1);assert.ok(!timer(hist[3]));
    });
    await check(`${side} 花草能量本次即附加，3回合到期；快照低血恢復、固定傷害数值`,async()=>{
      const skill=h.find('5011','星光·花草能量');
      const hist=await h.play(side,{self:h.unit('S',10000,[skill,h.wait()],{maxHp:10000}),opp:h.unit('E',5000,[h.wait()],{maxHp:10000}),turns:(_e,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(hist.map((r,i)=>(i?hist[i-1].opp.currentHp:5000)-r.opp.currentHp),[400,400,400,0]);
      assert.equal(hist[0].self.shield,400);assert.equal(hist[0].self.statStages.atk,2);
      const [low]=await h.play(side,{self:h.unit('S',1000,[skill],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()])});
      assert.equal(low.self.currentHp,6000);assert.equal(low.opp.currentHp,9800);assert.equal(low.self.shield||0,0);
    });
    await check(`${side} 不同来源團隊必定致命刷新到最高次數，不相加；能力下降雙倍回饋不清自己`,async()=>{
      const five=h.kitSkill('五次致命',[{op:'crit_uses',p:{uses:5,scope:'team'}}]),two=h.kitSkill('兩次致命',[{op:'crit_uses',p:{uses:2,scope:'team'}}]);
      const hist=await h.play(side,{self:h.unit('S',1e6,[five,two,attack]),opp:h.unit('E',1e6,[h.wait()]),turns:(_e,t)=>[t-1,0]},3);
      const charges=hist[1].state[`${side}Timers`].filter((t:any)=>t.scope==='team'&&t.payload?.block?.crit);
      assert.equal(charges.length,1);assert.equal(charges[0].remaining,5);
      assert.equal(hist[2].state[`${side}Timers`].find((t:any)=>t.payload?.block?.crit).remaining,4);
      const skill=h.find('5024','魔王天權震');
      const [r]=await h.play(side,{self:h.unit('S',1e6,[skill],{statStages:{atk:-2,def:2}}),opp:h.unit('E',1e6,[h.wait()])});
      assert.equal(r.self.statStages.atk,-2);assert.equal(r.opp.statStages.atk,-4);assert.equal(r.opp.statStages.def||0,0);
    });
    await check(`${side} 黯·萬魂歸寂吸血、兩回合閃避與三回合致死存活都有期限`,async()=>{
      const skill=h.find('5001','黯·萬魂歸寂'),hit={...attack,isSureHit:true,power:0};
      const hist=await h.play(side,{self:h.unit('S',1000,[skill,h.wait()],{maxHp:10000}),opp:h.unit('E',1e6,[hit]),turns:(_e,t)=>[t===1?0:1,0]},4);
      assert.ok(hist[0].self.currentHp>1000,'主攻擊吸血確實執行');
      const snapshots=hist.map(r=>r.state[`${side}Timers`]);
      assert.ok(snapshots[0].some((t:any)=>t.payload?.block?.evade));assert.ok(!snapshots[1].some((t:any)=>t.payload?.block?.evade));
      assert.ok(snapshots[1].some((t:any)=>t.payload?.block?.survive));assert.ok(!snapshots[2].some((t:any)=>t.payload?.block?.survive));
      const after=h.kitSkill('固定致死',[{op:'dmg',p:{flat:20000,type:'固定'}}]);
      const run=(late:boolean)=>h.play(side,{self:h.unit('S',10000,[skill,h.wait()],{speed:late?50:200}),opp:h.unit('E',1e6,[h.wait(),after],{speed:late?200:50}),turns:(_e,t)=>[t===1?0:1,t===3?1:0]},3);
      assert.equal((await run(false))[2].self.currentHp,1);assert.equal((await run(true))[2].self.currentHp,1);
    });
    await check(`${side} 神聖復甦走PP保護管道，恢復與等量百分比傷害不重複`,async()=>{
      const skill=h.find('5000','神聖復甦');
      const [r]=await h.play(side,{self:h.unit('S',2000,[skill,h.wait()],{maxHp:10000,statStages:{atk:3,def:-2}}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:-2,def:1}})});
      assert.equal(r.self.currentHp,10000);assert.equal(r.opp.currentHp,2000);
      assert.ok(r.self.skills.every((s:any)=>s.pp===0));assert.ok(r.opp.skills.every((s:any)=>s.pp===0));
      assert.ok(Object.values(r.self.statStages).every(n=>n===0));assert.ok(Object.values(r.opp.statStages).every(n=>n===0));
      const [sealed]=await h.play(side,{self:h.unit('S',2000,[skill],{maxHp:10000,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',10000,[h.wait()])});
      assert.equal(sealed.self.currentHp,2000);assert.equal(sealed.opp.currentHp,10000);
    });
    await check(`${side} 聖光氣僅下2回合攻擊致命，到第4回合失效`,async()=>{
      const skill=h.find('300','聖光氣');
      const hist=await h.play(side,{self:h.unit('S',1e6,[skill,attack]),opp:h.unit('E',1e6,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},4);
      const timers=(r:any)=>r.state[`${side}Timers`].filter((t:any)=>t.payload?.block?.crit);
      assert.ok(timers(hist[0]).length);assert.equal(timers(hist[1])[0].remaining,1);assert.equal(timers(hist[2]).length,0);
      assert.ok(hist[1].logs.some((s:string)=>s.includes('致命一擊')));
    });
    await check(`${side} 魂印致死存活同步回傳，只能觸發一次；自身魂印仍獨立生效`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
      const source=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5005');
      const fatal=h.kitSkill('固定致死',[{op:'dmg',p:{flat:20000,type:'固定'}}]);
      const hist=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{name:source.name,soulMark:structuredClone(source.soulMark)}}),opp:h.unit('E',1e6,[fatal])},5);
      // 首次抵抗附加害怕，對手的後續出招因此被合法中斷；待異常到期再驗第二次致死。
      assert.equal(hist[0].self.currentHp,1);assert.equal(hist[4].self.currentHp,0);
      assert.ok(h.statuses(hist[0].opp).includes('害怕'));
    });
    await check(`${side} 常駐100%閃避由正式命中入口讀取，必中依然可命中`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
      const source=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5005');
      const run=(sure:boolean)=>h.play(side,{self:h.unit('S',1e6,[h.wait()],{extra:{name:source.name,soulMark:structuredClone(source.soulMark)}}),opp:h.unit('E',1e6,[{...attack,isSureHit:sure,accuracy:100}])});
      assert.equal((await run(false))[0].self.currentHp,1e6);
      assert.ok((await run(true))[0].self.currentHp<1e6);
    });
    await check(`${side} 自訂魂印異常防護直接攔截附加；非matching分類不誤擋`,async()=>{
      const soul=(cls:string)=>({name:'自訂常駐免疫',effectMode:'kit',description:'',kit:[{codeId:'effect_sequence',source:'soulmark',node:'before_status_apply',order:0,params:{clause:{raw:'異常前防護',trig:'before_status',parsed:true,body:[{acts:[{op:'status_guard',p:{cls},label:'防護'}]}]}}}]});
      const status=h.kitSkill('施加中毒',[{op:'status',p:{side:'opp',status:'中毒',turns:3,chance:100}}]);
      const run=(cls:string)=>h.play(side,{self:h.unit('S',1e6,[h.wait()],{extra:{soulMark:soul(cls)}}),opp:h.unit('E',1e6,[status])});
      assert.ok(!h.statuses((await run(''))[0].self).includes('中毒'));
      assert.ok(h.statuses((await run('控制類'))[0].self).includes('中毒'));
    });
    await check(`${side} 連續使用威力40/60/80及上限150，換技能重新起算`,async()=>{
      const ash=h.find('5006','灰燼');
      const results=await h.play(side,{self:h.unit('S',1e6,[ash,h.wait()]),opp:h.unit('E',1e6,[h.wait()]),turns:(_e,t)=>[t===9?1:0,0]},10);
      const adds=results.map((r,i)=>r.logs.slice(i?results[i-1].logs.length:0).filter((s:string)=>s.includes('本次攻擊威力 +')));
      assert.ok(adds[1].some((s:string)=>s.includes('+20')));assert.ok(adds[2].some((s:string)=>s.includes('+40')));
      assert.ok(adds[7].some((s:string)=>s.includes('+110')));assert.ok(adds[9].some((s:string)=>s.includes('+0')));
    });
    await check(`${side} 基本強化技能各自按原文成功執行`,async()=>{
      for(const [id,name,expect] of [['5010','虛張聲勢',{def:2}],['5010','劍舞',{atk:2}],['5010','星光·劍舞',{atk:2,speed:2,accuracy:2}],['5011','詛咒',{atk:1,def:1,speed:-1}] ] as const) {
        const [r]=await h.play(side,{self:h.unit('S',1e5,[h.find(id,name)]),opp:h.unit('E',1e5,[h.wait()])});
        for(const [stat,n] of Object.entries(expect))assert.equal(r.self.statStages[stat],n);
      }
    });
    await check(`${side} 鎖魂曲同時清雙方護盾護罩與能力升降，百分比附加採自身速度`,async()=>{
      const skill=h.find('5008','鎖魂曲'),only={...skill,kit:skill.kit.slice(0,3)};
      const [r]=await h.play(side,{self:h.unit('S',1e5,[only],{statStages:{atk:2,def:-1},extra:{shield:100,barrier:100}}),opp:h.unit('E',1e5,[h.wait()],{statStages:{atk:-2,def:1},extra:{shield:100,barrier:100}})});
      for(const elf of [r.self,r.opp]) {assert.equal(elf.shield||0,0);assert.equal(elf.barrier||0,0);assert.ok(Object.values(elf.statStages).every(n=>n===0));}
      assert.equal(r.opp.currentHp,1e5-50);
    });
    await check(`${side} 鎖魂PP倍率20、回合損失PP固定傷害及到期停止`,async()=>{
      const song=h.find('5008','鎖魂曲'),only={...song,kit:[song.kit[0],song.kit[4]]};
      const oppSkill={...h.wait(),pp:100,maxPp:100};
      const hist=await h.play(side,{self:h.unit('S',1e6,[only,h.wait()]),opp:h.unit('E',1e6,[oppSkill]),turns:(_e,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(hist.map(r=>r.opp.skills[0].pp),[80,60,40,39]);
      assert.deepEqual(hist.map((r,i)=>(i?hist[i-1].opp.currentHp:1e6)-r.opp.currentHp),[200,400,600,0]);
    });
    await check(`${side} 下次死亡重生只一次，禁療不會把它改成普通回血`,async()=>{
      const song=h.find('5008','鎖魂曲'),only={...song,kit:[song.kit[0],song.kit[5]]};
      const fatal=h.kitSkill('致死固定',[{op:'dmg',p:{flat:20000,type:'固定'}}]);
      const hist=await h.play(side,{self:h.unit('S',10000,[only,h.wait()]),opp:h.unit('E',1e6,[h.wait(),fatal]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},3);
      assert.equal(hist[1].self.currentHp,10000);assert.equal(hist[2].self.currentHp,0);
    });
    await check(`${side} 隨機歸零兩個不同技能槽；體力調整不是傷害`,async()=>{
      const clear=h.kitSkill('清兩槽',[{op:'pp_zero_random',p:{count:2}}]);
      const [r]=await h.play(side,{self:h.unit('S',10000,[clear]),opp:h.unit('E',10000,[h.wait(),{...h.wait(),name:'二'},{...h.wait(),name:'三'}])});
      assert.equal(r.opp.skills.filter((s:any)=>s.pp===0).length,2);
      const adjust=h.kitSkill('體力調整',[{op:'hp_adjust',p:{side:'opp',delta:-200}}]);
      const [n]=await h.play(side,{self:h.unit('S',10000,[adjust]),opp:h.unit('E',10000,[h.wait()],{extra:{shield:1000,barrier:1000}})});
      assert.equal(n.opp.currentHp,9800);assert.equal(n.opp.shield,1000);assert.equal(n.opp.barrier,1000);
    });
  }
  console.log(`全表閉合機制驗證 ${count} 項通過（後台）`);
} finally {await h.close();}
