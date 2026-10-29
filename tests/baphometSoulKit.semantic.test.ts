import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock,createKitBlockParser,defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { BAPHOMET_SOUL_KIT } from '../src/data/baphometSoulKit';
import { validateKit } from '../src/effects/kitValidation';
import { createHarness } from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const soul=(pick?:(e:any)=>boolean)=>({name:'鎮',description:BAPHOMET_SOUL_KIT.description,effectMode:'kit',kit:structuredClone(pick?BAPHOMET_SOUL_KIT.kit.filter(pick):BAPHOMET_SOUL_KIT.kit)});
try {
  defineCustomBlocks();
  await check('完整9入口真正套用，魂殤嵌套程式與所有參數可在Blockly編輯、保存及重載',async()=>{
    const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const source=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5008');
    assert.equal(source.soulMark.effectMode,'kit');assert.deepEqual(JSON.parse(JSON.stringify(source.soulMark.kit)),BAPHOMET_SOUL_KIT.kit);validateKit(source.soulMark.kit);
    const ws=new Blockly.Workspace(),restored=new Blockly.Workspace();
    try {for(const e of source.soulMark.kit){const b=buildEntryBlock(ws as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');assert.deepEqual(createKitBlockParser('soulmark')(b,e.node,e.order),e);}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),restored);assert.equal(restored.getTopBlocks(false).length,9);
    }finally{ws.dispose();restored.dispose();}
  });
  await check('抵擋量取完整增減傷與上限後值；無視抵擋／0傷害不增加計數，同來源不重複',async()=>{
    const {resolveDamageBlocking}=await h.server.ssrLoadModule('/src/battle/damageBlocking.ts');let sum=0;
    const comp:any={damageCategory:'skill_attack',damageBlocks:new Map([['one',(n:number)=>sum+=n]])};
    assert.equal(resolveDamageBlocking(comp,250),0);assert.equal(sum,250);assert.equal(resolveDamageBlocking(comp,250),250);
    comp.damageBlocks.set('one',(n:number)=>sum+=n);comp.attackDefenseBypass={block:true};assert.equal(resolveDamageBlocking(comp,400),400);assert.equal(sum,250);
    delete comp.attackDefenseBypass;assert.equal(resolveDamageBlocking(comp,0),0);assert.equal(sum,250);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 窒息只轉換攻擊為35威力普通系撞擊，不執行原技能Kit，仍扣原技能槽PP`,async()=>{
      const original=h.kitSkill('原技能',[{op:'dmg',p:{flat:10000,type:'固定'}}],{category:'物理',power:200});
      const [r]=await h.play(side,{self:h.unit('S',90000,[original],{extra:{effects:[{id:'窒息',name:'窒息',duration:10}]}}),opp:h.unit('E',90000,[h.wait()])});
      assert.ok(90000-r.opp.currentHp>0&&90000-r.opp.currentHp<200);assert.equal(r.self.skills[0].pp,98);
      assert.equal(r.self.skills[0].name,'原技能');assert.ok(r.logs.some((s:string)=>s.includes('使用了【撞擊】')));
      const attribute=h.kitSkill('屬性仍生效',[{op:'dmg',p:{flat:1000,type:'固定'}}]);
      const [a]=await h.play(side,{self:h.unit('S',90000,[attribute],{extra:{effects:[{id:'窒息',name:'窒息',duration:10}]}}),opp:h.unit('E',90000,[h.wait()])});
      assert.equal(a.opp.currentHp,89000);assert.ok(!a.logs.some((s:string)=>s.includes('(撞擊)')));
    });
    await check(`${side} 存活場下魂印也附加魂殤，陣亡則不附加；體力調整穿盾罩且下場消失`,async()=>{
      for(const alive of [true,false]) {
        const [r]=await h.play(side,{self:h.unit('A',10000,[h.wait()]),selfBench:[h.unit('B',alive?10000:0,[h.wait()],{extra:{soulMark:soul()}})],opp:h.unit('E',8000,[h.wait()],{extra:{shield:1000,barrier:1000}})});
        assert.equal(r.opp.currentHp,alive?6000:8000);assert.equal(r.opp.shield,1000);assert.equal(r.opp.barrier,1000);
        assert.equal(r.state[`${side==='p1'?'p2':'p1'}Marks`].length,alive?1:0);
      }
      const hist=await h.play(side,{self:h.unit('A',10000,[h.wait()]),selfBench:[h.unit('B',10000,[h.wait()],{extra:{soulMark:soul()}})],opp:h.unit('E',8000,[h.wait()]),oppBench:[h.unit('N',8000,[h.wait()])],turns:(_e,t)=>[0,t===1?0:{switch:1}]},2);
      assert.equal(hist[1].opp.id,'N');assert.equal(hist[1].opp.currentHp,6000);assert.equal(hist[1].state[`${side==='p1'?'p2':'p1'}Marks`][0].count,1);
    });
    await check(`${side} 技能傷害抵擋、固定／百分比／真實不抵擋；累積真傷反饋不擅自清計數`,async()=>{
      const selected=soul(e=>e.node==='before_damage'||(e.node==='on_skill_use'&&e.order===7));
      const mixed=h.kitSkill('混合分類',[{op:'dmg',p:{flat:1000,type:'技能',elem:'水'}},{op:'dmg',p:{flat:200,type:'固定'}},{op:'dmg',p:{flat:300,type:'百分比'}},{op:'dmg',p:{flat:400,type:'真實'}}]);
      const attack={...h.wait(),name:'攻擊',category:'物理',power:0,isSureHit:true};
      const hist=await h.play(side,{self:h.unit('S',90000,[h.wait(),attack],{speed:200,extra:{soulMark:selected,effects:[{id:'混亂',name:'混亂',duration:10}],shield:1000,barrier:1000}}),opp:h.unit('E',90000,[mixed],{speed:100}),turns:(_e,t)=>[t===1?0:1,0]},3);
      // 額外400真傷＋原有混亂每次對手出手50真傷；兩者都不是可抵擋的技能傷害。
      assert.equal(hist[0].self.currentHp,89550,hist[0].logs.join('\n'));assert.equal(hist[0].self.shield,1000);assert.equal(hist[0].self.barrier,500);
      assert.equal(hist[0].state[`${side}RegistryState`]['blockCounter:soul-guarded-damage'],1000);
      assert.equal(hist[1].opp.currentHp,89000);assert.equal(hist[2].opp.currentHp,87000);
      assert.equal(hist[2].state[`${side}RegistryState`]['blockCounter:soul-guarded-damage'],3000);
    });
    await check(`${side} 異常轉化保留附加期限；雙方條件消失後不轉化也不抵擋`,async()=>{
      const selected=soul(e=>e.node==='before_status_apply'||e.node==='before_damage');
      const status=h.kitSkill('中毒',[{op:'status',p:{side:'opp',status:'中毒',turns:5,chance:100}}]);
      const run=(confused:boolean)=>h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:selected}}),opp:h.unit('E',10000,[status],{extra:confused?{effects:[{id:'混亂',name:'混亂',duration:10}]}:{}})});
      const [normal]=await run(false);assert.ok(h.statuses(normal.self).includes('中毒'));assert.ok(!h.statuses(normal.self).includes('混亂'));
      const [converted]=await run(true);assert.ok(h.statuses(converted.self).includes('混亂'));assert.ok(!h.statuses(converted.self).includes('中毒'));assert.equal(converted.self.effects.find((e:any)=>e.id==='混亂').duration,4);
    });
    await check(`${side} 登場任一失敗才降低兩種輸出40%，兩條效果共存；不是技能或真實減傷`,async()=>{
      const entry=soul(e=>e.node==='on_entered');
      const immuneSoul={name:'免疫次數',effectMode:'kit',description:'登場免疫一次',kit:[{codeId:'effect_sequence',source:'soulmark',node:'battle_start',order:0,params:{clause:{raw:'免疫一次',trig:'battle_start',parsed:true,body:[{acts:[{op:'immune_status_count',p:{count:1},label:''}]}]}}}]};
      // 自身先免疫登場混亂，對手窒息仍附加；避免出招被混亂隨機打斷。
      const mixed=h.kitSkill('輸出四類',[{op:'dmg',p:{flat:1000,type:'固定'}},{op:'dmg',p:{flat:1000,type:'百分比'}},{op:'dmg',p:{flat:1000,type:'真實'}},{op:'dmg',p:{flat:1000,type:'技能',elem:'水'}}]);
      const [r]=await h.play(side,{self:h.unit('S',20000,[h.wait()],{extra:{soulMark:entry,trait:immuneSoul}}),opp:h.unit('E',20000,[mixed])});
      assert.equal(r.self.currentHp,16800,JSON.stringify({logs:r.logs,stats:r.state[`${side}TurnStats`],self:r.self.effects,opp:r.opp.effects}));const other=side==='p1'?'p2':'p1';
      assert.equal(r.state[`${other}Timers`].filter((t:any)=>t.payload.block?.dmgOutReduce===.4).length,2);
    });
  }
  console.log(`巴弗洛完整Kit與共同抵擋 ${checks} 項後台情境通過；不代表全表語意驗收`);
}finally{await h.close();}
