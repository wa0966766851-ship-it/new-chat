import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_STATUS_RESTRICTION_SKILL_KITS as definitions} from '../src/data/migratedStatusRestrictionSkillKits';
import {createHarness} from './helpers/migrationHarness';
import {EffectTiming} from '../src/effects/types';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const song=()=>({...h.find('5013','王·凜冬葬歌'),power:0,category:'屬性'});
const percentReduction=(reduce:number)=>({name:'百分比減傷',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'百分比減傷',trig:'incoming',parsed:true,body:[{acts:[{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce},label:'百分比減傷'}]}]}}}]});
try{
  await check('凜冬完整來源、單一Kit與實際Blockly保存重載',()=>{
    const def=definitions[0],loaded=h.find('5013',def.name);assert.equal(loaded.description,def.description);h.assertKitOnly(loaded);assert.deepEqual(loaded.kit,def.kit);
    defineCustomBlocks();const workspace=new Blockly.Workspace(),reload=new Blockly.Workspace();
    try{
      for(const entry of def.kit){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),reload);
      const entries=reload.getTopBlocks(false).map(block=>{const entry=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,entry.node,entry.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(entries,def.kit);
    }finally{workspace.dispose();reload.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 複製成功才封攻擊傷害和技能異常；固定附加仍存在，3回合到期`,async()=>{
      const attack=h.kitSkill('攻擊帶異常和固定傷害',[{op:'status',p:{side:'opp',status:'狂暴',turns:3,chance:100}},{op:'dmg',p:{flat:17,type:'固定'}}],{category:'物理',power:100});
      for(const boosted of [false,true]){
        const history=await h.play(side,{
          self:h.unit('S',50000,[song(),h.wait()],{speed:200}),
          opp:h.unit('E',100000,[attack],{statStages:boosted?{spdef:1}:{},extra:{trait:percentReduction(1)}}),turns:(_,turn)=>[turn===1?0:1,0],
        },4);
        assert.equal(history[0].self.statStages.spdef||0,boosted?1:0);
        assert.equal(history[0].opp.statStages.spdef||0,boosted?1:0,'複製不清除對手提升');
        if(boosted){
          assert.deepEqual(history.slice(0,3).map((r:any)=>r.self.currentHp),[49983,49966,49949]);
          for(const r of history.slice(0,3))assert.ok(!h.statuses(r.self).includes('狂暴'),r.logs.join('\n'));
          assert.ok(history[3].self.currentHp<49932);assert.ok(h.statuses(history[3].self).includes('狂暴'));
        }else{
          assert.ok(history[0].self.currentHp<49983);assert.ok(h.statuses(history[0].self).includes('狂暴'));
        }
      }
    });
    await check(`${side} 攻擊技能異常受限，但屬性技能、原生魂印與Kit特質異常仍可施加`,async()=>{
      const nativeName=`原生異常來源-${side}`;
      h.S[nativeName]=(ctx:any,event:any)=>{if(event===EffectTiming.BEFORE_SKILL)ctx.applyStatusWithImmunityCheck(ctx.targetSide,'凍傷',3);};
      try{
        const trait={name:'特質異常',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_skill_use',source:'mechanic',role:'innate',order:0,
          params:{clause:{raw:'特質燒傷',trig:'self_skill',parsed:true,body:[{acts:[{op:'status',p:{side:'opp',status:'燒傷',turns:3,chance:100},label:'特質燒傷'}]}]}}}]};
        const [result]=await h.play(side,{
          self:h.unit('S',50000,[song()],{speed:200}),
          opp:h.unit('E',100000,[h.kitSkill('攻擊中毒',[{op:'status',p:{side:'opp',status:'中毒',turns:3,chance:100}}],{category:'物理',power:1})],{statStages:{spdef:1},extra:{name:nativeName,trait,soulMark:{name:'原生魂印',description:''}}}),
        });
        const statuses=h.statuses(result.self);assert.ok(statuses.includes('凍傷'),result.logs.join('\n'));assert.ok(statuses.includes('燒傷'));assert.ok(!statuses.includes('中毒'));
      }finally{delete h.S[nativeName];}
      const [utility]=await h.play(side,{self:h.unit('S',50000,[song()],{speed:200}),opp:h.unit('E',100000,[h.kitSkill('屬性中毒',[{op:'status',p:{side:'opp',status:'中毒',turns:3,chance:100}}])],{statStages:{spdef:1},extra:{trait:percentReduction(1)}})});
      assert.ok(h.statuses(utility.self).includes('中毒'),utility.logs.join('\n'));
    });
    await check(`${side} 2回合減療到期；百分比吸取40→50→60→60不混用點數`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[song(),h.wait()],{speed:200}),opp:h.unit('E',10000,[h.healSkill(1000)],{maxHp:20000,extra:{trait:percentReduction(1)}}),turns:(_,turn)=>[turn===1?0:1,0]},3);
      assert.deepEqual(history.map((r:any)=>r.opp.currentHp),[10000,10000,11000]);
      const ramp=await h.play(side,{self:h.unit('S',100000,[song()],{speed:200}),opp:h.unit('E',200000,[h.wait()],{extra:{trait:percentReduction(.8)}})},4);
      assert.deepEqual(ramp.map((r:any)=>r.opp.currentHp),[184000,164000,140000,116000],ramp[3].logs.join('\n'));
    });
  }
  console.log(`異常施加限制遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
