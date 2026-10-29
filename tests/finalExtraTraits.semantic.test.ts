import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {MIGRATED_FINAL_EXTRA_TRAIT_KITS:defs}=await h.server.ssrLoadModule('/src/data/migratedFinalExtraTraitKits.ts');
const {MIGRATED_FINAL_EXTRA_SOUL_KITS:souls}=await h.server.ssrLoadModule('/src/data/migratedFinalExtraTraitKits.ts');
const {getElfAdvancedMechanics:get,hasAuthoredAdvancedMechanic}=await h.server.ssrLoadModule('/src/data/traitsRegistry.ts');
const {validateKit}=await h.server.ssrLoadModule('/src/effects/kitValidation.ts');
const trait=(id:string)=>({...structuredClone(defs.find((x:any)=>x.elfIds.includes(id))),name:'改名的可編輯機制',effectMode:'kit'});
const equip=(id:string)=>({alienTraits:{gen2Trait:trait(id)}});
const test=async(label:string,f:()=>any)=>{await f();checks++;console.log('✓ '+label);};
try{
  await test('三特質資料逐項可編輯、Blockly保存重載、無名稱回退',()=>{
    defineCustomBlocks();
    for(const d of defs){
      validateKit(d.kit);const w=new Blockly.Workspace(),r=new Blockly.Workspace();
      try{for(const e of d.kit){
        const b=buildEntryBlock(w as any,e)!;assert.ok(b);
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
        assert.deepEqual(createKitBlockParser('mechanic')(r.getBlockById(b.id)!,e.node,e.order),e);
        w.clear();r.clear();
      }}finally{w.dispose();r.dispose();}
    }
    const e=h.unit('不相干的名稱',1000,[h.wait()],{extra:equip('5026')});
    assert.equal(get(e).forceSSSkillStonePower,240);
    e.alienTraits.gen2Trait.kit.find((x:any)=>x.params.clause.body[0].acts.some((a:any)=>a.p.key==='forceSSSkillStonePower')).params.clause.body[0].acts.find((a:any)=>a.p.key==='forceSSSkillStonePower').p.value=321;
    assert.equal(get(e).forceSSSkillStonePower,321);
    e.alienTraits.gen2Trait.kit=[];assert.deepEqual(get(e),{});
    assert.equal(hasAuthoredAdvancedMechanic(e,'forceSSSkillStonePower'),false);
  });
  for(const side of ['p1','p2'] as const){
    await test(side+' 無我把狂暴轉平靜且回合翻倍，改名後正式異常管線仍生效',async()=>{
      const sk=h.kitSkill('狂暴測試',[{op:'status',p:{side:'opp',status:'狂暴',turns:3,chance:100}}]);
      const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:equip('5022')}),opp:h.unit('E',10000,[sk])});
      assert.equal(h.statuses(r.self).includes('狂暴'),false);
      const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
      assert.equal(getStatuses(r.self)['平靜'],5);
      assert.equal(r.self.isConcealed,true);
    });
    await test(side+' 戰士換人傳承對實體設定隱匿與恢復PP',async()=>{
      const sk={...h.wait(),pp:1,maxPp:9};
      const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:equip('5022')}),selfBench:[h.unit('B',10000,[sk])],opp:h.unit('E',10000,[h.wait()]),turns:()=>[{switch:1},0]});
      assert.equal(r.self.id,'B');assert.equal(r.self.isConcealed,true);assert.equal(r.self.skills[0].pp,9);
    });
    await test(side+' 咒術師建立實體額外精靈、詛咒不減、使用技能施放一次額外行動',async()=>{
      const actor=h.unit('S',10000,[h.wait()],{extra:{...equip('5023'),battleStatuses:{詛咒:3},effects:[{id:'詛咒',name:'詛咒',duration:3}]}});
      const [r]=await h.play(side,{self:actor,opp:h.unit('E',100000,[h.wait()])});
      const companion=r.state[side+'Team'].filter((e:any)=>e.isExtra&&!e.isVanished&&e.summonerId==='S');
      assert.equal(companion.length,1);assert.equal(companion[0].mechanicRole,'curse_companion');
      assert.equal(companion[0].calculatedStats.spdef,r.self.calculatedStats.spdef);
      const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
      assert.equal(getStatuses(r.self)['詛咒'],3);
      assert.equal(r.self.skills[0].pp,98,'控制詛咒禁止本體行動：僅扣選招額外1PP，不扣未使用技能的正常PP');
      assert.ok(r.logs.some((s:string)=>s.includes('因異常狀態無法行動')));
      assert.ok(r.self.shield>0&&r.self.barrier>0);
    });
    await test(side+' 三種附屬詛咒正常出手扣普通及額外PP，並啟動魔咒',async()=>{
      for(const curse of ['烈焰詛咒','虛弱詛咒','致命詛咒']){
        const actor=h.unit('S',10000,[h.wait()],{extra:{...equip('5023'),battleStatuses:{[curse]:3},effects:[{id:curse,name:curse,duration:3}]}});
        const [r]=await h.play(side,{self:actor,opp:h.unit('E',100000,[h.wait()])});
        assert.equal(r.self.skills[0].pp,97,curse+'選招1PP加正常出手1PP');
        assert.ok(r.logs.some((s:string)=>s.includes('賽博怨靈·魔咒')));
        assert.ok(!r.logs.some((s:string)=>s.includes('因異常狀態無法行動')));
      }
    });
    await test(side+' 修復場下持有者立即衍化隊友異常並恢復真實PP與HP',async()=>{
      const sk=h.kitSkill('冰封測試',[{op:'status',p:{side:'opp',status:'冰封',turns:3,chance:100}}]);
      const owner=h.unit('B',1000,[{...h.wait(),pp:4,maxPp:9}],{maxHp:10000,extra:equip('5023')});
      const [r]=await h.play(side,{self:h.unit('S',5000,[{...h.wait(),pp:4,maxPp:9}],{maxHp:10000}),selfBench:[owner],opp:h.unit('E',10000,[sk])});
      const b=r.state[side+'Team'].find((e:any)=>e.id==='B');
      assert.equal(b.currentHp,1250);assert.equal(b.skills[0].pp,5);
      assert.equal(h.statuses(r.self).includes('冰封'),false);assert.ok(h.statuses(r.self).includes('凍傷'));
      assert.equal(r.self.skills[0].pp,4);
    });
    await test(side+' 咒術師換人使自己召喚的怨靈死亡消逝',async()=>{
      const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:equip('5023')}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[h.wait()]),turns:()=>[{switch:1},0]});
      const companion=r.state[side+'Team'].find((e:any)=>e.isExtra&&e.summonerId==='S');
      assert.ok(companion);assert.equal(companion.currentHp,0);assert.equal(companion.isVanished,true);
    });
    await test(side+' 蝕言改名魂印仍以可編輯除數錨定特防並正式替換特攻公式',async()=>{
      for(const [divisor,defense,damage] of [[10,30,210],[20,15,255]]){
        const soul={...structuredClone(souls[0]),name:'參數化面板公式',effectMode:'kit'};
        soul.kit=soul.kit.filter((e:any)=>e.node==='passive_always');
        soul.kit[0].params.clause.body[0].acts[0].p.divisor=divisor;
        const atk={...h.wait(),name:'特殊攻擊',category:'特殊',power:999,isSureHit:true};
        const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul}}),
          selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[atk])});
        assert.equal(r.self.calculatedStats.spdef,defense);
        assert.equal(r.state[side+'Team'].find((e:any)=>e.id==='B').calculatedStats.spdef,defense);
        assert.equal(r.self.currentHp,10000-damage);
      }
    });
  }
  console.log(`最後19份・進階特質定向 ${checks} 組通過（戰士減傷反算條款另待完整驗收）`);
}finally{await h.close();}
