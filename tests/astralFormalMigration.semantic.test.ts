import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {validateKit} from '../src/effects/kitValidation';
import {kitEntryIssue} from '../src/effects/effectConnection';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
const names=['星核幻舞','星核脈衝','星霧迷境'];
try{
  const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const registry=getBattleSkillRegistry(),saved=new Map(names.map(n=>[n,registry[n]]));let oldCalls=0;
  for(const n of names)registry[n]=()=>{oldCalls++;throw new Error(`舊技能不得重播：${n}`);};
  try{
    defineCustomBlocks();
    for(const n of names){
      const skill=h.find('5032',n);assert.equal(skill.effectMode,'kit');validateKit(skill.kit);
      for(const entry of skill.kit){
        assert.equal(kitEntryIssue(entry),null);
        const w=new Blockly.Workspace(),copy=new Blockly.Workspace();
        try{
          const block=buildEntryBlock(w as any,entry)!;assert.ok(block);
          Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),copy);
          assert.deepEqual(createKitBlockParser('skill')(copy.getBlockById(block.id)!,entry.node,entry.order),entry);
        }finally{w.dispose();copy.dispose();}
      }
    }
    for(const side of ['p1','p2'] as const){
      const other=side==='p1'?'p2':'p1';
      // 正式來源完整技能；基準只移除最後一條記憶，其他傷害、PP與原文相同。
      const pulse=structuredClone(h.find('5032','星核脈衝'));
      const comparePulse=async(memory:boolean)=>{
        const sk=structuredClone(pulse);if(!memory)sk.kit.pop();
        const [,...later]=await h.play(side,{self:h.unit('S',100000,[h.wait(),sk],{speed:200}),
          opp:h.unit('first',100000,[h.wait()]),oppBench:[h.unit('active',100000,[h.wait()])],
          turns:(_e:any,t:number)=>t===1?[0,{switch:1}]:[1,0]},2);
        return later[0];
      };
      const base=await comparePulse(false),full=await comparePulse(true);
      assert.equal(base.opp.currentHp-full.opp.currentHp,100,full.logs.join('\n'));
      assert.equal(full.opp.skills[0].pp,96,'命中削2點與對手使用1點，不重播舊命中處理');
      const first=(r:any)=>r.state[`${other}Team`].find((e:any)=>e.id==='first').currentHp;
      assert.equal(first(full),first(base),'切換後記憶傷害只打在場，不打背包首位');
      checks++;console.log(`✓ ${side} 正式星核脈衝切換後在場傷害100、背包首位不受傷、舊記憶不重播`);

      const dance=structuredClone(h.find('5032','星核幻舞'));
      const compareDance=async(memory:boolean)=>{
        const sk=structuredClone(dance);if(!memory)sk.kit.pop();
        return (await h.play(side,{self:h.unit('S',1500,[h.wait(),sk],{maxHp:9000,speed:200}),
          opp:h.unit('E',100000,[h.turnEffectSkill(),h.wait()]),oppBench:[h.unit('near',10000,[h.wait()]),h.unit('far',10000,[h.wait()])],
          turns:(_e:any,t:number)=>t===1?[0,0]:[1,1]},2))[1];
      };
      const b=await compareDance(false),r=await compareDance(true);
      const hp=(v:any,id:string)=>v.state[`${other}Team`].find((e:any)=>e.id===id).currentHp;
      assert.equal(hp(b,'near')-hp(r,'near'),150,r.logs.join('\n'));
      assert.equal(hp(b,'far'),hp(r,'far'));
      assert.equal(r.self.currentHp,7500,'低於一半時恢復最大體力2/3');
      assert.equal(r.self.statStages.atk,2);
      checks++;console.log(`✓ ${side} 正式星核幻舞鄰位150一次，屬性技能的記憶不偷用攻擊增傷`);

      const flatAttack=h.kitSkill('改名攻擊',[
        {op:'dmg',p:{flat:100,type:'技能',elem:'普通'}},
        {op:'dmg',p:{flat:100,type:'技能',elem:'普通'}},
        {op:'dmg',p:{flat:100,type:'固定'}},
      ],{category:'物理'});
      const boosted=await h.play(side,{self:h.unit('S',9000,[dance,h.wait(),flatAttack]),opp:h.unit('E',100000,[h.wait()]),
        turns:(_e:any,t:number)=>[t===1?0:t===2?1:2,0]},5);
      const losses=boosted.slice(2).map((r:any,i:number)=>boosted[i+1].opp.currentHp-r.opp.currentHp);
      assert.deepEqual(losses,[600,600,300],boosted[4].logs.join('\n'));
      checks++;console.log(`✓ ${side} 下兩次攻擊多段技能增傷、固定傷害不變，屬性等待不耗次數`);

      const mist=structuredClone(h.find('5032','星霧迷境'));
      const [m]=await h.play(side,{self:h.unit('S',10000,[mist]),opp:h.unit('E',10000,[h.wait()])});
      assert.ok(h.statuses(m.opp).includes('疲憊'));
      assert.equal(m.opp.currentHp,9700,'使用後吸取300只執行一次');
      checks++;console.log(`✓ ${side} 正式星霧迷境疲憊、使用後吸取300一次`);

      const history=await h.play(side,{self:h.unit('S',10000,[mist,h.wait()]),opp:h.unit('E',10000,[h.wait()]),
        turns:(_e:any,t:number)=>[t===1?0:1,0]},4);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[9700,9400,9100,9100],'3回合使用後吸取，到期停止');
      checks++;console.log(`✓ ${side} 星霧迷境三回合到期後不再吸取`);

      const prevent=h.kitSkill('固定傷害免疫',[{op:'dmg_mod_turns',p:{side:'self',dir:'in',kind:'固定',reduce:1,turns:5}}]);
      const [blocked]=await h.play(side,{self:h.unit('S',10000,[mist],{speed:100,statStages:{atk:-1}}),
        opp:h.unit('E',10000,[prevent],{speed:500})});
      assert.equal(blocked.self.statStages.atk,0,'出手時有下降，只清下降');
      assert.ok(!h.statuses(blocked.opp).includes('疲憊'));
      assert.equal(blocked.opp.currentHp,9700,'固定吸取未造成減血時才附加300真傷');
      assert.equal(blocked.state[`${other}RegistryState`]?.battleDamageCounts?.true,1,'實際受傷事件為真實傷害');
      checks++;console.log(`✓ ${side} 星霧迷境清下降不誤疲憊，固定吸取失敗轉300真傷`);
    }
    assert.equal(oldCalls,0);
    console.log(`${checks} 正式封裝載入／P1P2行為檢查通過；未驗收其他技能與魂印`);
  }finally{for(const [n,handler] of saved)registry[n]=handler;}
}finally{await h.close();}
