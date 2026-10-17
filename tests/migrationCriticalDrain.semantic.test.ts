import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_CRITICAL_DRAIN_SKILL_KITS as definitions} from '../src/data/migratedCriticalDrainSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>structuredClone(h.find('5015','孑然孤夢'));
function roundtrip(active:any,edit?:(b:any)=>void){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of active.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))edit?.(b);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...active,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
const defense=(op:string,p:any)=>{const setup=op==='damage_cap_turns'||op==='absorb_now';return {name:'傷害設定',effectMode:'kit',kit:[{codeId:'effect_sequence',node:setup?'on_entered':'before_damage',source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'傷害設定',trig:setup?'entrance':'incoming',parsed:true,body:[{acts:[{op,p,label:op}]}]}}}]};};
const cap=()=>defense('damage_cap_turns',{side:'self',dir:'in',kind:'百分比',cap:0,turns:6});
try{
  await check('完整原文、持有者與單一路徑；Blockly保存重載不借用舊處理器',async()=>{
    const active=skill();h.assertKitOnly(active);assert.equal(active.description,definitions[0].description);assert.deepEqual(active.kit,definitions[0].kit);assert.deepEqual(roundtrip(active).kit,active.kit);
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const source={...active,effectMode:undefined,kit:undefined};
    for(const [id,s] of [['wrong',source],['5015',{...source,description:source.description+'自訂'}],['5015',{...source,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[s]}).skills[0].kit,undefined);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 異常條件強化翻倍，正常對手只提升1級`,async()=>{
      for(const abnormal of [false,true]){
        const [r]=await h.play(side,{self:h.unit('S',9000,[skill()]),opp:h.unit('E',90000,[h.wait()],{extra:abnormal?{battleStatuses:{狂暴:{duration:3}},effects:[{id:'狂暴',name:'狂暴',duration:3}]}:{}})});
        for(const stat of ['atk','def','spatk','spdef','speed','accuracy'])assert.equal(r.self.statStages[stat],abnormal?2:1,`${stat}\n${r.logs.join('\n')}`);
      }
    });
    await check(`${side} 吸取按對手最大體力；低半血嚴格翻倍，滿血仍扣對手`,async()=>{
      for(const [hp,loss,healed] of [[1000,6000,7000],[4500,3000,7500],[9000,3000,9000]]){
        const [r]=await h.play(side,{self:h.unit('S',hp,[skill()],{maxHp:9000}),opp:h.unit('E',9000,[h.wait()])});
        assert.equal(r.opp.currentHp,9000-loss,r.logs.join('\n'));assert.equal(r.self.currentHp,healed);
      }
    });
    await check(`${side} 四回合包含施放當回合，第五回合停止`,async()=>{
      const history=await h.play(side,{self:h.unit('S',7000,[skill(),h.wait()],{maxHp:9000}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:defense('damage_cap_turns',{side:'self',dir:'in',kind:'百分比',cap:1000,turns:6})}}),turns:(_,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[99000,98000,97000,96000,96000]);assert.deepEqual(history.map(r=>r.self.currentHp),[8000,9000,9000,9000,9000]);
    });
    await check(`${side} 比例免疫逐次250真傷；上限0與轉恢復不誤判，不憑空回血`,async()=>{
      for(const mode of ['immune','cap','converted']){
        const trait=mode==='immune'?defense('dmg_mod',{dir:'in',kind:'百分比',reduce:1}):mode==='cap'?cap():defense('absorb_now',{});
        const history=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:20000}),opp:h.unit('E',50000,[h.wait()],{maxHp:60000,extra:{trait}}),turns:(_,t)=>[t===1?0:1,0]},2);
        assert.deepEqual(history.map(r=>r.opp.currentHp),mode==='immune'?[49750,49500]:mode==='cap'?[50000,50000]:[60000,40000],mode);
        assert.deepEqual(history.map(r=>r.self.currentHp),mode==='converted'?[10000,20000]:[10000,10000],mode);
      }
    });
    await check(`${side} 下兩回合致命吸取350為固定；先制+2及必致命到期`,async()=>{
      const hit={...h.wait(),name:'普通攻擊',category:'物理',power:1};const enemy={...h.wait(),name:'對手先制1',priority:1};
      const history=await h.play(side,{self:h.unit('S',10000,[skill(),hit],{maxHp:20000,speed:200}),opp:h.unit('E',100000,[enemy],{extra:{trait:cap()}}),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(history.map(r=>r.self.currentHp),[10000,10350,10700,10700]);
      const firstNames=history.map((r,i)=>r.logs.slice(i?history[i-1].logs.length:0).find((s:string)=>s.includes('使用了')));
      assert.ok(firstNames[0].includes('對手先制1'));assert.ok(firstNames[1].includes('普通攻擊'));assert.ok(firstNames[2].includes('普通攻擊'));assert.ok(firstNames[3].includes('對手先制1'));
      assert.equal(history[3].logs.filter((s:string)=>s.includes('必中致命一擊')).length,2);
      const reduced=cap();reduced.kit.push({...defense('dmg_mod',{dir:'in',kind:'固定',reduce:.5}).kit[0],order:1});
      const second=await h.play(side,{self:h.unit('S',10000,[skill(),hit],{maxHp:20000}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:reduced}}),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.equal(second[1].self.currentHp,10175,second[1].logs.join('\n'));
    });
    await check(`${side} 屬性、未命中與對手致命不觸發自身致命吸取`,async()=>{
      for(const mode of ['status','miss','opponentCrit']){
        const own=mode==='status'||mode==='opponentCrit'?h.wait():{...h.wait(),name:'未命中攻擊',category:'物理',power:1,accuracy:0,isSureHit:false};
        const opp=mode==='opponentCrit'?h.kitSkill('對手致命',[{op:'crit_now',p:{}}],{category:'物理',power:1}):h.wait();
        const history=await h.play(side,{self:h.unit('S',10000,[skill(),own],{maxHp:20000}),opp:h.unit('E',100000,[h.wait(),opp],{extra:{trait:cap()}}),turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);
        assert.equal(history[1].opp.currentHp,100000,mode+'\n'+history[1].logs.join('\n'));assert.ok(history[1].self.currentHp<=10000,mode);
      }
    });
    await check(`${side} 原魂印不重播舊技能狀態；附加封印不建立技能計時器`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5015');
      const [r]=await h.play(side,{self:h.unit('S',20000,[skill()],{extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',90000,[h.wait()])});
      for(const key of ['ChaosBlakeJieranTurns','ChaosBlakeJieranCritHealTurns','ChaosBlakeJieranPriorityCritTurns'])assert.equal(r.state[`${side}RegistryState`][key]||0,0,key);
      const seal=h.kitSkill('封印屬性附加',[{op:'add_invalid_turns',p:{turns:2,kind:'屬性',next:false}}],{priority:4});
      const [s]=await h.play(side,{self:h.unit('S',20000,[skill()]),opp:h.unit('E',90000,[seal])});
      assert.equal(s.opp.currentHp,90000,s.logs.join('\n'));assert.equal(s.self.statStages.atk||0,0);assert.equal(s.state[`${side}Timers`].filter((t:any)=>t.payload?.block?.trig==='self_skill'||t.payload?.block?.crit).length,0);
    });
    await check(`${side} Blockly改比例、期限與固定吸取量，重載後正式執行`,async()=>{
      let edits=0;
      const edited=roundtrip(skill(),b=>{if(b.type==='sequence_action'&&b.getFieldValue('OP')==='timed'){
        const p=JSON.parse(b.getFieldValue('PARAMS'));
        if(p.trig==='self_skill'){p.turns=1;p.body[0].acts[0].p.ratio=1/6;}
        else if(p.trig==='self_after_attack'){p.turns=1;p.body[0].acts[0].p.flat=100;}
        else return;b.setFieldValue(JSON.stringify(p),'PARAMS');edits++;
      }});assert.equal(edits,2);
      const history=await h.play(side,{self:h.unit('S',10000,[{...edited,name:'改名孤夢',description:''},h.wait()],{maxHp:20000}),opp:h.unit('E',60000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[50000,50000]);
      const attack={...h.wait(),name:'攻擊',category:'物理',power:1};
      const critical=await h.play(side,{self:h.unit('S',10000,[edited,attack],{maxHp:20000}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:cap()}}),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(critical.map(r=>r.self.currentHp),[10000,10100,10100]);
    });
  }
  console.log(`孑然孤夢完整遷移：${checks}項通過，未授予全部定義全文語意驗收`);
}finally{await h.close();}
