import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_STEP_DAMAGE_SKILL_KITS as definitions} from '../src/data/migratedStepDamageSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>({...h.find('5022','狂刃無生'),power:0,category:'屬性'});
const restore=(entries:any[],edit?:{unit:number;bonus:number})=>{
  defineCustomBlocks();const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
  try{
    for(const entry of entries){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
    if(edit){const block=workspace.getAllBlocks(false).find(b=>b.type==='sequence_action'&&JSON.parse(b.getFieldValue('PARAMS')||'{}').stepUnit!==undefined);assert.ok(block);
      const p=JSON.parse(block.getFieldValue('PARAMS'));block.setFieldValue(JSON.stringify({...p,stepUnit:edit.unit,stepBonus:edit.bonus}),'PARAMS');}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
    return restored.getTopBlocks(false).map(block=>{const old=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,old.node,old.order);}).sort((a,b)=>a!.order-b!.order);
  }finally{workspace.dispose();restored.dispose();}
};
try{
  await check('狂刃完整原文與Kit路由，Blockly保存重載保留成敗聚合及階梯公式',()=>{
    const loaded=skill();assert.equal(loaded.description,definitions[0].description);assert.equal(loaded.effectMode,'kit');assert.deepEqual(loaded.kit,definitions[0].kit);
    assert.deepEqual(restore(loaded.kit),loaded.kit);
  });
  await check('原句直接解析為階梯參數，0單位與不完整階梯仍拒絕',async()=>{
    const {distillEffect}=await h.server.ssrLoadModule('/src/effects/distillEffect.ts');
    const text=definitions[0].description.split('\n').at(-1)!;
    const result=distillEffect({name:'階梯',description:text},'skill');assert.equal(result.complete,true);
    assert.deepEqual(result.kit[0].params.clause.body[0].acts[0].p,definitions[0].kit[4].params.clause.body[0].acts[0].p);
    const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
    for(const params of [{stepUnit:0,stepBonus:6},{stepUnit:6},{stepUnit:6,stepBonus:-1},{stepUnit:6.5,stepBonus:6}]){
      const entry=structuredClone(definitions[0].kit[4]);entry.params.clause.body[0].acts[0].p={base:'已損失體力',of:'self',ratio:1,type:'真實',...params};assert.ok(kitEntryIssue(entry));
    }
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 損失0／1／5／6／7／11／12／13點的階梯傷害，不向上取整`,async()=>{
      for(const lost of [0,1,5,6,7,11,12,13]){
        const [r]=await h.play(side,{self:h.unit('S',10000-lost,[skill()],{maxHp:10000}),opp:h.unit('E',100000,[h.wait()])});
        assert.equal(r.opp.currentHp,100000-lost-Math.floor(lost/6)*6,r.logs.join('\n'));
      }
    });
    await check(`${side} 能力或盾罩任一實際清除才附加自身上限66%，空效果不觸發`,async()=>{
      for(const which of ['empty','self-stage','opp-stage','shield','barrier']){
        const [r]=await h.play(side,{self:h.unit('S',10000,[skill()],{statStages:which==='self-stage'?{atk:2,def:-1}:{},extra:which==='shield'?{shield:99}:{}}),
          opp:h.unit('E',100000,[h.wait()],{statStages:which==='opp-stage'?{spatk:-2,spdef:1}:{},extra:which==='barrier'?{barrier:99}:{}})});
        assert.equal(r.opp.currentHp,which==='empty'?100000:93400,which+'\n'+r.logs.join('\n'));
        assert.ok(Object.values(r.self.statStages).every(v=>v===0));assert.ok(Object.values(r.opp.statStages).every(v=>v===0));
        assert.equal(r.self.shield||0,0);assert.equal(r.opp.barrier||0,0);
      }
    });
    await check(`${side} 清回合成功才雙方狂暴；能力提升受保護不算清除成功`,async()=>{
      const [empty]=await h.play(side,{self:h.unit('S',10000,[skill()]),opp:h.unit('E',100000,[h.wait()])});
      assert.equal(h.statuses(empty.self).includes('狂暴'),false);assert.equal(h.statuses(empty.opp).includes('狂暴'),false);
      const history=await h.play(side,{self:h.unit('S',10000,[h.wait(),skill()]),opp:h.unit('E',100000,[h.turnEffectSkill(),h.wait()]),turns:(_,turn)=>[turn===1?0:1,turn===1?0:1]},2);
      assert.ok(h.statuses(history[1].self).includes('狂暴'));assert.ok(h.statuses(history[1].opp).includes('狂暴'));
      // 技能的回合保護會先被第一句清掉；魂印來源才可驗證不可清回合的保護分支。
      const protect={name:'保護提升魂印',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_entered',source:'soulmark',order:0,
        params:{clause:{raw:'登場保強',trig:'entrance',parsed:true,body:[{acts:[
          {op:'stat',p:{side:'self',stats:['攻擊'],v:1},label:'強化'},
          {op:'stat_protect_turns',p:{turns:3},label:'保護'},
        ]}]}}}]};
      const [protectedResult]=await h.play(side,{self:h.unit('S',10000,[skill()]),opp:h.unit('E',100000,[h.wait()],{extra:{soulMark:protect}})});
      assert.equal(protectedResult.opp.statStages.atk,1,protectedResult.logs.join('\n'));
      assert.equal(protectedResult.opp.currentHp,100000,protectedResult.logs.join('\n'));
    });
    await check(`${side} Blockly修改階梯為每4點加3點，重載後引擎真正改為22真傷`,async()=>{
      const active=skill();active.kit=restore(active.kit,{unit:4,bonus:3});
      const [r]=await h.play(side,{self:h.unit('S',9987,[active],{maxHp:10000}),opp:h.unit('E',100000,[h.wait()])});
      assert.equal(r.opp.currentHp,99978,r.logs.join('\n'));
    });
    await check(`${side} 原持有者魂印下同名及改名的Kit結果一致，不重播舊狂刃處理器`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5022');const values=[];
      for(const name of ['狂刃無生','編輯後狂刃']){
        const [r]=await h.play(side,{self:h.unit('S',9987,[{...skill(),name}],{maxHp:10000,extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',100000,[h.wait()])});
        assert.ok(!r.logs.some((line:string)=>line.includes('洗滌萬物，唯餘狂氣')));values.push(r.opp.currentHp);
      }
      assert.equal(values[0],values[1]);
    });
  }
  console.log(`階梯傷害遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
