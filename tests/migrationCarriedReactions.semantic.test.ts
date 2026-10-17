import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock,createKitBlockParser,defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { MIGRATED_CARRIED_REACTION_SKILL_KITS as definitions } from '../src/data/migratedCarriedReactionSkillKits';
import { createHarness } from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>Promise<void>|void)=>{await fn();checks++;console.log(`✓ ${name}`);};
const statusGuard={name:'拒絕異常',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'soulmark',order:0,
  params:{clause:{raw:'免疫',trig:'before_status',parsed:true,body:[{acts:[{op:'status_guard',p:{cls:''},label:'免疫'}]}]}}}]};
const asUtility=(name:string)=>({...h.find('5023',name),power:0,category:'屬性',isSureHit:true});
try{
  await check('2份完整來源與Kit路由；真正Blockly保存重載，保留攜帶角色與下回合設定',()=>{
    defineCustomBlocks();
    for(const definition of definitions){
      const skill=h.find('5023',definition.name);
      assert.equal(skill.description,definition.description);assert.equal(skill.effectMode,'kit');assert.deepEqual(skill.kit,definition.kit);
      assert.ok(skill.kit.every((entry:any)=>entry.role==='carried'&&entry.node==='pp_consumed'));
      const workspace=new Blockly.Workspace(),reload=new Blockly.Workspace();
      try{
        for(const entry of skill.kit){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),reload);
        const entries=reload.getTopBlocks(false).map(block=>{const entry=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,entry.node,entry.order);});
        assert.deepEqual(entries,skill.kit);
      }finally{workspace.dispose();reload.dispose();}
    }
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 只攜帶未消耗PP不執行；另一槽PP消耗不誤觸發`,async()=>{
      const [result]=await h.play(side,{
        self:h.unit('S',20000,[h.wait(),asUtility('血稅迴轉'),asUtility('啟蟄·冥土荒蕪')]),opp:h.unit('E',100000,[h.wait()]),
      });
      assert.equal(result.opp.currentHp,100000);assert.deepEqual(result.self.statStages,{});
      assert.equal(h.statuses(result.opp).length,0);
      assert.equal((result.state[`${side}Timers`]||[]).length,0);
    });
    await check(`${side} 啟蟄：對手屬性技能本次仍可附加傷害，下2回合攻擊主傷害和附加都失效`,async()=>{
      const utility=h.kitSkill('屬性傷害',[{op:'dmg',p:{flat:17,type:'固定'}}]);
      const attack=h.kitSkill('帶附加攻擊',[{op:'dmg',p:{flat:5,type:'固定'}}],{category:'物理',power:100});
      const history=await h.play(side,{
        self:h.unit('S',20000,[asUtility('啟蟄·冥土荒蕪'),h.wait()],{speed:200}),
        opp:h.unit('E',100000,[utility,attack],{extra:{soulMark:statusGuard}}),turns:(_,turn)=>[turn===1?0:1,turn===1?0:1],
      },4);
      assert.deepEqual(history.slice(0,3).map(result=>result.self.currentHp),[19983,19983,19983],history[3].logs.join('\n'));
      assert.ok(history[3].self.currentHp<19983,'第4回合到期，攻擊恢復');
    });
    await check(`${side} 血稅：低於半血吸取翻倍，固定附加和百分比吸取維持不同類型`,async()=>{
      for(const hp of [4999,5000]){
        const [result]=await h.play(side,{
          self:h.unit('S',hp,[asUtility('血稅迴轉')],{maxHp:10000}),opp:h.unit('E',100000,[h.wait()]),
        });
        assert.equal(result.opp.currentHp,hp===4999?33034:66367,result.logs.join('\n'));
        assert.equal(result.self.statStages.def,2);assert.equal(result.self.statStages.atk,-1);
        assert.equal(result.self.currentHp,10000);
      }
    });
    await check(`${side} 血稅：護罩吸收不掉血才為所有存活場下隊友回血，殘血封頂、不復活、不回血消逝者`,async()=>{
      const [result]=await h.play(side,{
        self:h.unit('S',6000,[asUtility('血稅迴轉')],{maxHp:10000}),
        opp:h.unit('E',100000,[h.wait()],{extra:{barrier:200000}}),
        selfBench:[h.unit('B1',100,[h.wait()],{maxHp:1000}),h.unit('B2',900,[h.wait()],{maxHp:1000}),
          h.unit('F',1000,[h.wait()]),h.unit('D',0,[h.wait()],{maxHp:1000}),h.unit('V',100,[h.wait()],{maxHp:1000,extra:{isVanished:true}})],
      });
      assert.equal(result.opp.currentHp,99700,'固定300被護罩吸收後附加真實300；百分比被護罩吸收');
      const team=result.state[`${side}Team`];
      assert.deepEqual(['B1','B2','F','D','V'].map(id=>team.find((elf:any)=>elf.id===id).currentHp),[300,1000,1000,0,100]);
      assert.equal(result.self.currentHp,10000,'在場者只收到吸取恢復，不當成場下目標');
    });
    await check(`${side} 原持有者魂印下血稅不重播舊PP效果；改名仍執行整份圖紙`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
      const owner=DEFAULT_ELVES.find((elf:any)=>String(elf.id)==='5023');
      const [result]=await h.play(side,{
        self:h.unit('S',20000,[asUtility('血稅迴轉')],{extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),
        opp:h.unit('E',100000,[h.wait()]),
      });
      assert.equal(result.self.statStages.def,2,result.logs.join('\n'));assert.equal(result.self.statStages.atk,-1);
      assert.ok(!(result.state[`${side}Timers`]||[]).some((timer:any)=>timer.payload?.roundDrainSpec||timer.payload?.afterUseDamage));
      const [renamed]=await h.play(side,{self:h.unit('S',20000,[{...asUtility('血稅迴轉'),name:'自訂攜帶圖紙',description:''}]),opp:h.unit('E',100000,[h.wait()])});
      assert.equal(renamed.self.statStages.def,2);assert.equal(renamed.opp.currentHp,66367);
    });
    await check(`${side} 場下回血各讀自己的減療和禁療，不借在場者75%減療`,async()=>{
      const percentGuard={name:'百分比免疫',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',role:'innate',order:0,
        params:{clause:{raw:'免疫百分比',trig:'incoming',parsed:true,body:[{acts:[{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce:1},label:'免疫百分比'}]}]}}}]};
      const timer=(ownerBattleId:string,payload:any)=>({id:`fixture:${ownerBattleId}`,name:'個體恢復限制',kind:'round_counter',source:'soulmark',
        scope:'elf',ownerBattleId,remaining:5,tickAt:'round_end',payload});
      const [result]=await h.play(side,{
        self:h.unit('S',6000,[asUtility('血稅迴轉')],{maxHp:10000}),
        opp:h.unit('E',100000,[h.wait()],{extra:{trait:percentGuard,barrier:10000}}),
        selfBench:['B1','B2','B3'].map(id=>h.unit(id,100,[h.wait()],{maxHp:1000})),
        turns:engine=>{
          // 正式新增動作建立個體銀行；SET_SCOPED_TIMERS只能更新既有快照。
          for(const [id,payload] of [['S',{recoveryReductionPercent:.75}],['B1',{recoveryReductionPercent:.5}],['B2',{block:{healGuard:'all'}}]] as const){
            const owner=engine.getState()[`${side}Team`].find((elf:any)=>elf.id===id);
            engine.dispatch({type:'ADD_SCOPED_TIMER',side,owner,timer:timer(id,payload)});
          }
          assert.equal(engine.getState()[`${side}ElfState`].B1.timers.length,1);
          return [0,0];
        },
      });
      const team=result.state[`${side}Team`];
      assert.deepEqual(['B1','B2','B3'].map(id=>team.find((elf:any)=>elf.id===id).currentHp),[200,100,300],result.logs.join('\n'));
    });
  }
  console.log(`攜帶反應遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
