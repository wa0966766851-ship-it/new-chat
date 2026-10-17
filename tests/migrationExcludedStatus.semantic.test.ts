import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_EXCLUDED_STATUS_SKILL_KITS as definitions} from '../src/data/migratedExcludedStatusSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>structuredClone(h.find('5015','暗耀明滅'));
const clear=()=>h.kitSkill('清除回合',[{op:'clear_turn',p:{side:'opp'}}]);
const status=(id:string)=>h.kitSkill('施加異常',[{op:'status',p:{side:'opp',status:id,turns:3,chance:100}}]);
const hit=()=>h.kitSkill('攻擊帶恢復',[{op:'heal_flat',p:{amount:100}}],{category:'物理',power:10});
function roundtrip(active:any,edit?:(b:any)=>void){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of active.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))edit?.(b);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...active,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
try{
  await check('完整原文／持有者／單一Kit入口，Blockly保存重載；自訂原文不被覆寫',async()=>{
    const active=skill();h.assertKitOnly(active);assert.equal(active.description,definitions[0].description);assert.deepEqual(active.kit,definitions[0].kit);assert.deepEqual(roundtrip(active).kit,active.kit);
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const source={...active,effectMode:undefined,kit:undefined};
    for(const [id,s] of [['wrong',source],['5015',{...source,description:source.description+'自訂'}],['5015',{...source,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[s]}).skills[0].kit,undefined);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 狂暴排除且正常施加，其他異常反彈；五回合到期後停止`,async()=>{
      for(const id of ['狂暴','麻痺']){
        const [r]=await h.play(side,{self:h.unit('S',50000,[skill()],{speed:200}),opp:h.unit('E',100000,[status(id)])});
        assert.equal(h.statuses(r.self).includes(id),id==='狂暴',r.logs.join('\n'));assert.equal(h.statuses(r.opp).includes(id),id!=='狂暴');
      }
      // 屬性監控會封後續攻擊，使用仍可出手的屬性異常驗證完整五回合期限。
      const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',100000,[status('星哲')]),turns:(_,t)=>[t===1?0:1,0]},6);
      assert.deepEqual(history.map(r=>h.statuses(r.self).includes('星哲')),[false,false,false,false,false,true]);
    });
    await check(`${side} 對手攻擊前三回合各強化1級，第四回合停止；自身攻擊不反向觸發`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(history.map(r=>r.self.statStages.atk),[1,2,3,3],history[3].logs.join('\n'));
      const ownHit={...h.wait(),category:'物理',power:1,name:'自身攻擊'};
      const selfOnly=await h.play(side,{self:h.unit('S',50000,[skill(),ownHit],{speed:200}),opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.equal(selfOnly[1].self.statStages.atk||0,0);assert.equal(selfOnly[1].opp.statStages.atk,-2);
    });
    await check(`${side} 攻擊反應封對手兩回合屬性；第五回合恢复附加`,async()=>{
      const heal=h.healSkill(1000);
      const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',90000,[hit(),heal],{maxHp:100000}),turns:(_,t)=>[t===1?0:1,t<=3?0:1]},5);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[90100,90200,90300,90300,91300],history[4].logs.join('\n'));
    });
    await check(`${side} 對手屬性立即弱化，兩回合攻擊傷害與附加歸零；第三回合恢复`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',90000,[h.wait(),hit()],{maxHp:100000}),turns:(_,t)=>[t===1?0:1,t===1?0:1]},3);
      assert.equal(history[0].opp.statStages.atk,-1);assert.equal(history[1].self.currentHp,50000,history[1].logs.join('\n'));assert.equal(history[1].opp.currentHp,90000);
      assert.ok(history[2].self.currentHp<50000,history[2].logs.join('\n'));assert.equal(history[2].opp.currentHp,90100);
      // 使用事件成立即執行弱化；不是等對手行動結束才開始。
      assert.equal(history[1].self.statStages.atk,1);
    });
    await check(`${side} 清除回合成功才比例吸取；三回合監控到期、自然到期與換人不誤觸發`,async()=>{
      for(const at of [1,3,4]){
        const history=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:50000,speed:200}),opp:h.unit('E',90000,[hit(),clear()]),turns:(_,t)=>[t===1?0:1,t===at?1:0]},at);
        assert.equal(history[at-1].opp.currentHp,at<=3?60000:90000,history[at-1].logs.join('\n'));
      }
      const natural=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',90000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},6);
      assert.ok(natural.every(r=>r.opp.currentHp===90000));
      const switched=await h.play(side,{self:h.unit('S',50000,[skill()],{speed:200}),selfBench:[h.unit('B',50000,[h.wait()])],opp:h.unit('E',90000,[hit(),clear()]),turns:(_,t)=>[t===1?0:{switch:1},t===1?0:1]},2);
      assert.equal(switched[1].self.id,'B');assert.equal(switched[1].opp.currentHp,90000);
    });
    await check(`${side} 原魂印不重播專屬監控；附加封印不建立效果`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5015');
      const [r]=await h.play(side,{self:h.unit('S',50000,[skill()],{speed:200,extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',90000,[hit()])});
      assert.equal(r.self.statStages.atk,1,r.logs.join('\n'));
      for(const key of ['ChaosBlakeAnyaoyTurns','ChaosBlakeAnyaoyImmuneReflectTurns'])assert.equal(r.state[`${side}RegistryState`][key]||0,0,key);
      const seal=h.kitSkill('封附加',[{op:'add_invalid_turns',p:{turns:2,kind:'屬性',next:false}}],{priority:4});
      const [s]=await h.play(side,{self:h.unit('S',50000,[skill()]),opp:h.unit('E',90000,[seal])});assert.equal(s.state[`${side}Timers`].filter((t:any)=>t.payload?.block?.src==='暗耀明滅').length,0,s.logs.join('\n'));
    });
    await check(`${side} Blockly改排除異常與監控期限，重載後改名圖紙生效`,async()=>{
      let edits=0;const edited=roundtrip(skill(),b=>{if(b.type!=='sequence_action')return;const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));
        if(op==='immune_status_turns')p.exclude=['星哲'];else if(op==='timed'&&p.trig==='opp_attack')p.turns=1;else return;
        b.setFieldValue(JSON.stringify(p),'PARAMS');edits++;
      });assert.equal(edits,2);
      const own={...edited,name:'改名暗耀',description:''};
      const [r]=await h.play(side,{self:h.unit('S',50000,[own],{speed:200}),opp:h.unit('E',90000,[status('星哲')])});assert.ok(h.statuses(r.self).includes('星哲'));assert.ok(!h.statuses(r.opp).includes('星哲'));
      const history=await h.play(side,{self:h.unit('S',50000,[own,h.wait()],{speed:200}),opp:h.unit('E',90000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},2);assert.deepEqual(history.map(r=>r.self.statStages.atk),[1,1]);
    });
  }
  console.log(`暗耀明滅完整遷移：${checks}項通過，未授予全部定義全文語意驗收`);
}finally{await h.close();}
