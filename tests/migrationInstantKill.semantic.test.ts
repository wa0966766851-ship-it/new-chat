import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_INSTANT_KILL_SKILL_KITS as definitions} from '../src/data/migratedInstantKillSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>structuredClone(h.find('5024','超重力壓迫'));
function reload(active:any,chance?:number,turns?:number){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();let edits=0;
  try{for(const entry of active.kit){const b=buildEntryBlock(w as any,entry);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){
      const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));
      if(op==='instant_kill'&&chance!==undefined)p.chance=chance;else if(op==='invalid_turns'&&turns!==undefined)p.turns=turns;else continue;
      b.setFieldValue(JSON.stringify(p),'PARAMS');edits++;
    }
    assert.equal(edits,Number(chance!==undefined)+Number(turns!==undefined));
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...active,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
try{
  await check('全文／持有者／單一Kit路由，Blockly保存重載；原文不符與自訂圖紙不覆寫',async()=>{
    const s=skill();h.assertKitOnly(s);assert.equal(s.description,definitions[0].description);assert.deepEqual(s.kit,definitions[0].kit);assert.deepEqual(reload(s).kit,s.kit);
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const raw={...s,effectMode:undefined,kit:undefined};
    for(const [id,v] of [['wrong',raw],['5024',{...raw,description:raw.description+'自訂'}],['5024',{...raw,effectMode:'registry'}]] as any)
      assert.equal(applyReviewedSkillKits({id,skills:[v]}).skills[0].kit,undefined);
    const edited=reload(s,0);assert.deepEqual(applyReviewedSkillKits({id:'5024',skills:[edited]}).skills[0].kit,edited.kit);
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 原15%機率有成功與失敗，命中秒殺保留擊敗來源`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[skill()]),opp:h.unit('E',1000000,[h.wait()])},15);
      assert.ok(history.some(r=>r.opp.currentHp>0));assert.ok(history.some(r=>r.opp.currentHp===0),history[14].logs.join('\n'));
      assert.equal(history[14].logs.filter((s:string)=>s.includes('【E】被秒殺')).length,1);
    });
    await check(`${side} 先制+3先於對手+2，零機率仍封當回合及下回合屬性，第三回合恢復`,async()=>{
      const own={...reload(skill(),0),power:0};const heal={...h.healSkill(100),priority:2};
      const history=await h.play(side,{self:h.unit('S',50000,[own,h.wait()],{speed:10}),opp:h.unit('E',30000,[heal],{maxHp:40000,speed:300}),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[30000,30000,30100],history[2].logs.join('\n'));
    });
    await check(`${side} Blockly改名100%命中秒殺；必定未命中與附加封印不觸發秒殺`,async()=>{
      const edited={...reload(skill(),100),name:'改名超重力',description:'',power:0};
      const [hit]=await h.play(side,{self:h.unit('S',50000,[edited]),opp:h.unit('E',30000,[h.wait()],{extra:{shield:90000}})});
      assert.equal(hit.opp.currentHp,0,hit.logs.join('\n'));assert.equal(hit.opp.shield,90000);
      const [miss]=await h.play(side,{self:h.unit('S',50000,[{...edited,accuracy:0,isSureHit:false}]),opp:h.unit('E',30000,[h.wait()])});assert.equal(miss.opp.currentHp,30000,miss.logs.join('\n'));
      const seal=h.kitSkill('封附加',[{op:'add_invalid_turns',p:{turns:2,kind:'攻擊',next:false}}],{priority:4});
      const [sealed]=await h.play(side,{self:h.unit('S',50000,[edited]),opp:h.unit('E',30000,[seal])});assert.equal(sealed.opp.currentHp,30000,sealed.logs.join('\n'));
    });
    await check(`${side} Blockly縮為1回合封屬性，下一回合立刻恢復`,async()=>{
      const own={...reload(skill(),0,1),name:'改名一回合',description:'',power:0};
      const history=await h.play(side,{self:h.unit('S',50000,[own,h.wait()]),opp:h.unit('E',30000,[h.healSkill(100)],{maxHp:40000}),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[30000,30100],history[1].logs.join('\n'));
    });
    await check(`${side} 原魂印同體力連鎖讀實際秒殺前快照，原生背包防護也攔截圖紙`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5024');
      const own={...reload(skill(),100),power:0};const original={name:owner.name,soulMark:structuredClone(owner.soulMark)};
      const [chain]=await h.play(side,{self:h.unit('S',10000,[own],{maxHp:20000,extra:original}),opp:h.unit('E',30000,[h.wait()]),oppBench:[h.unit('B',30000,[h.wait()]),h.unit('C',29000,[h.wait()])]});
      assert.deepEqual(chain.state[`${other}Team`].map((e:any)=>e.currentHp),[0,0,29000],chain.logs.join('\n'));
      const [guarded]=await h.play(side,{self:h.unit('S',50000,[own]),opp:h.unit('E',30000,[h.wait()]),oppBench:[h.unit('L',30000,[h.wait()],{extra:original})]});
      assert.equal(guarded.opp.currentHp,30000,guarded.logs.join('\n'));
    });
  }
  console.log(`超重力壓迫完整遷移：${checks}項通過，未授予全部定義全文語意驗收`);
}finally{await h.close();}
