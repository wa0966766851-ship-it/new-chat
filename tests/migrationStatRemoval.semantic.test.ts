import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_STAT_REMOVAL_SKILL_KITS as definitions} from '../src/data/migratedStatRemovalSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>structuredClone(h.find('5031','禁靈領域'));
function roundtrip(active:any,edit?:(b:any)=>void){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of active.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))edit?.(b);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...active,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
try{
  await check('完整原文／持有者／單一Kit路徑與Blockly保存重載一致',async()=>{
    const active=skill();h.assertKitOnly(active);assert.equal(active.description,definitions[0].description);assert.deepEqual(active.kit,definitions[0].kit);assert.deepEqual(roundtrip(active).kit,active.kit);
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const source={...active,effectMode:undefined,kit:undefined};
    for(const [id,s] of [['wrong',source],['5031',{...source,description:source.description+'自訂'}],['5031',{...source,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[s]}).skills[0].kit,undefined);
    const {readSkillProperty}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');assert.equal(readSkillProperty(active,'sure_hit',{actor:'p1',targetSide:'p2',self:{},target:{},getPlayerState:()=>0,getOpponentState:()=>0}),true);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 強化翻倍看使用前提升，不因本句新增+1而翻倍`,async()=>{
      for(const up of [false,true]){
        const [r]=await h.play(side,{self:h.unit('S',9000,[skill()],{statStages:up?{atk:1}:{}}),opp:h.unit('E',100000,[h.wait()])});
        assert.equal(r.self.statStages.atk,up?3:1);assert.equal(r.self.statStages.def,up?2:1);
      }
    });
    await check(`${side} 低半血嚴格翻倍；滿血、封頂及禁療按實際恢復量造成固定傷害`,async()=>{
      for(const [hp,loss] of [[1000,6000],[4500,3000],[7000,2000],[9000,0]]){
        const [r]=await h.play(side,{self:h.unit('S',hp,[skill()],{maxHp:9000}),opp:h.unit('E',100000,[h.wait()])});
        assert.equal(r.self.currentHp,hp+loss,r.logs.join('\n'));assert.equal(r.opp.currentHp,100000-loss);
      }
      const sealed=h.kitSkill('禁療',[{op:'no_heal',p:{turns:2,next:false}}],{priority:2});
      const [r]=await h.play(side,{self:h.unit('S',1000,[skill()],{maxHp:9000}),opp:h.unit('E',100000,[sealed])});assert.equal(r.self.currentHp,1000);assert.equal(r.opp.currentHp,100000);
    });
    await check(`${side} 四回合使用時先恢復、之後才受敵方3000；第五回合停止，固定傷害依實際恢復`,async()=>{
      const hit=h.kitSkill('固定3000',[{op:'dmg',p:{flat:3000,type:'固定'}}]);
      const history=await h.play(side,{self:h.unit('S',7000,[skill(),h.wait()],{maxHp:9000,speed:200}),opp:h.unit('E',100000,[h.wait(),hit]),turns:(_,t)=>[t===1?0:1,t===1?0:1]},5);
      assert.deepEqual(history.map(r=>r.self.currentHp),[9000,6000,6000,6000,3000]);assert.deepEqual(history.map(r=>r.opp.currentHp),[98000,98000,95000,92000,92000]);
    });
    await check(`${side} 消除／吸取成功封屬性附加兩回合並到期；攻擊附加保留`,async()=>{
      for(const mode of ['clear','steal']){
        const remove=h.kitSkill('移除提升',[mode==='clear'?{op:'stat_clear',p:{side:'opp',kind:'up'}}:{op:'stat_steal',p:{mode:'吸取'}}]);
        const history=await h.play(side,{self:h.unit('S',9000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',90000,[remove,h.healSkill(100)],{maxHp:100000}),turns:(_,t)=>[t===1?0:1,t===1?0:1]},3);
        assert.deepEqual(history.map(r=>r.opp.currentHp),[90000,90000,90100],history.flatMap(r=>r.logs).join('\n'));
      }
      const remove=h.kitSkill('移除提升',[{op:'stat_clear',p:{side:'opp',kind:'up'}}]);const attack=h.kitSkill('攻擊帶回血',[{op:'heal_flat',p:{amount:100}}],{category:'物理',power:1});
      const r=await h.play(side,{self:h.unit('S',9000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',90000,[remove,attack],{maxHp:100000}),turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);
      assert.ok(r[1].opp.currentHp>r[0].opp.currentHp,r[1].logs.join('\n'));
    });
    await check(`${side} 監控三回合到期不再封；換人不移交回復與監控`,async()=>{
      const remove=h.kitSkill('消強',[{op:'stat_clear',p:{side:'opp',kind:'up'}}]);
      const r=await h.play(side,{self:h.unit('S',9000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',90000,[h.wait(),remove,h.healSkill(100)],{maxHp:100000}),turns:(_,t)=>[t===1?0:1,t===4?1:t===5?2:0]},5);
      assert.equal(r[4].opp.currentHp,90100);
      const switched=await h.play(side,{self:h.unit('S',9000,[skill()],{speed:200}),selfBench:[h.unit('B',1000,[h.wait()],{maxHp:9000,statStages:{atk:2}})],opp:h.unit('E',100000,[h.wait(),remove]),turns:(_,t)=>[t===1?0:{switch:1},t===1?0:1]},2);
      assert.equal(switched[1].self.id,'B');assert.equal(switched[1].self.currentHp,1000);assert.ok(!h.timers(switched[1].state,side).some(x=>x.includes('附加失效')));
    });
    await check(`${side} 圖紙改為兩回合／每回合1/6，保存重載後真實執行`,async()=>{
      let edits=0;const edited=roundtrip(skill(),b=>{if(b.type==='sequence_action'&&b.getFieldValue('OP')==='timed'){const p=JSON.parse(b.getFieldValue('PARAMS'));if(p.trig==='self_skill'){p.turns=2;p.body[0].acts[0].p.ratio=1/6;b.setFieldValue(JSON.stringify(p),'PARAMS');edits++;}}});assert.equal(edits,1);
      const r=await h.play(side,{self:h.unit('S',1000,[edited,h.wait()],{maxHp:9000}),opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(r.map(r=>r.self.currentHp),[4000,7000,7000]);assert.equal(r[2].opp.currentHp,94000);
    });
  }
  console.log(`能力移除監控整份遷移：${checks}項通過，未授予全部定義全文驗收`);
}finally{await h.close();}
