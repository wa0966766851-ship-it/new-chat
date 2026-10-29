import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
import {scaleActionByMarks,actionMarkScaleIssue} from '../src/effects/actionMarkScale';
import {sequenceActionLabel} from '../src/effects/sequencePresentation';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const rules=[{when:[{side:'self',id:'amplifier',min:1}],factor:2},{when:[{side:'self',id:'raw',min:8},{side:'opp',id:'recipient',min:1}],factor:2}];
const scaled=(op:string,p:any)=>({op,p:{...p,scaleByMarks:structuredClone(rules)},label:op});
const skill=(op='dmg',p:any={flat:100,type:'固定'})=>h.kitSkill('資源倍率',[scaled(op,p)]);
const issue=(act:any)=>sequenceIssue(h.kitSkill('合約',[act]).kit[0].params.clause);
function seed(raw:number,amp:number,recipient:number,protectedBoost=false,decoy=false){
  h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE){c.setMark({id:'raw',name:'原始',count:raw,ownerBattleId:'S'},c.actor);c.setMark({id:'amplifier',name:'倍率',count:amp,ownerBattleId:decoy?'bench':'S'},c.actor);}};
  h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE){c.setMark({id:'recipient',name:'對手倍率',count:recipient,ownerBattleId:decoy?'bench':'E'},c.actor);if(protectedBoost)c.setPlayerState('statBoostUnclearableTurns',2);}};
}
let edited:any;
try{
  await check('嚴格數量合約：共同門檻／相乘；拒絕腳本、無界倍率、期限縮放與定量反轉',()=>{
    assert.equal(issue(scaled('dmg',{flat:100,type:'固定'})),null);
    assert.equal(issue(scaled('stat_steal',{mode:'吸取',v:1,perMark:{side:'opp',id:'recipient'}})),null);
    for(const scaleByMarks of [[],[{when:[],factor:2}],[{when:rules[0].when,factor:0}],[{when:rules[0].when,factor:Infinity}],[{when:[{side:'both',id:'x',min:1}],factor:2}],[{when:[{side:'self',id:'x',min:0}],factor:2}],[{when:rules[0].when,factor:2,handler:'x'}]])assert.ok(issue({op:'dmg',p:{flat:100,type:'固定',scaleByMarks}}));
    assert.ok(issue(scaled('invalid_turns',{turns:1,kind:'攻擊',next:true})));
    assert.ok(issue({op:'stat_steal',p:{mode:'吸取',v:1,reverse:true}}));
    assert.ok(issue({op:'stat_steal',p:{mode:'吸取',perMark:{side:'opp',id:'x'}}}));
    assert.ok(actionMarkScaleIssue('dmg',{flat:1e6,scaleByMarks:rules}));
  });
  await check('當下持有者與原始層數分離，讀取不改圖紙／印記，預覽揭示倍率',()=>{
    let raw=8;const ctx:any={actor:'p1',targetSide:'p2',self:{id:'same',battleId:'A'},target:{id:'same',battleId:'B'},getMarks:(s:string)=>s==='p1'?[{id:'raw',count:raw,ownerBattleId:'A'},{id:'amplifier',count:1,ownerBattleId:'A'},{id:'raw',count:999,ownerBattleId:'C'}]:[{id:'recipient',count:1,ownerBattleId:'B'}]};
    const p={flat:100,type:'固定',scaleByMarks:structuredClone(rules)},before=structuredClone(p);
    assert.equal(scaleActionByMarks(ctx,'dmg',p).flat,400);raw=7;assert.equal(scaleActionByMarks(ctx,'dmg',p).flat,200);assert.deepEqual(p,before);
    assert.ok(sequenceActionLabel({op:'dmg',p,label:'傷害'}).includes('數量×2'));
  });
  await check('真實Blockly保存／重載修改倍率，改名後參數與執行一致',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();const s=skill();
    try{const slot=w.newBlock('custom_node_slot');slot.setFieldValue('on_skill_use','TARGET_NODE');const b=buildEntryBlock(w as any,s.kit[0])!;slot.getInput('STACK')!.connection!.connect(b.previousConnection!);
      for(const action of w.getAllBlocks(false))if(action.type==='sequence_action'){const p=JSON.parse(action.getFieldValue('PARAMS'));p.scaleByMarks[0].factor=3;action.setFieldValue(JSON.stringify(p),'PARAMS');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);edited={...s,name:'改名資源倍率',kit:r.getTopBlocks(false).map((slot:any,i:number)=>createKitBlockParser('skill')(slot.getInputTargetBlock('STACK'),slot.getFieldValue('TARGET_NODE'),i)!)};
      assert.equal(sequenceIssue(edited.kit[0].params.clause,'on_skill_use'),null);assert.equal(edited.kit[0].params.clause.body[0].acts[0].p.scaleByMarks[0].factor,3);
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 原始7／8層、雙持有者有無倍率：100／200／400，沒有提前解鎖或修改原始層數`,async()=>{
      for(const [raw,amp,rec,mult] of [[7,0,1,1],[7,1,1,2],[8,0,1,2],[8,1,1,4],[8,1,0,2]]){
        seed(raw,amp,rec);const [r]=await h.play(side,{self:h.unit('S',10000,[skill()],{speed:200}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.opp.currentHp,10000-100*mult);assert.equal(r.state[`${side}Marks`].find((m:any)=>m.id==='raw').count,raw);
      }
    });
    await check(`${side} 定量吸取每項最多層數，保留餘下提升與原下降`,async()=>{
      seed(7,0,2);const [r]=await h.play(side,{self:h.unit('S',10000,[skill('stat_steal',{mode:'吸取',v:1,perMark:{side:'opp',id:'recipient'}})],{speed:200}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:6,def:1,speed:-2}})});
      assert.equal(r.self.statStages.atk,2);assert.equal(r.self.statStages.def,1);assert.equal(r.opp.statStages.atk,4);assert.equal(r.opp.statStages.def,0);assert.equal(r.opp.statStages.speed,-2);
    });
    await check(`${side} 兩條倍率相乘後才定量吸取；沒有印記或強化保護時不吸取`,async()=>{
      for(const [amp,rec,protect,expected] of [[1,1,false,4],[1,0,false,0],[1,1,true,0]] as const){seed(8,amp,rec,protect);const [r]=await h.play(side,{self:h.unit('S',10000,[skill('stat_steal',{mode:'吸取',v:1,perMark:{side:'opp',id:'recipient'}})],{speed:200}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:6}})});assert.equal(r.self.statStages.atk||0,expected);assert.equal(r.opp.statStages.atk,6-expected);}
    });
    await check(`${side} 正式PP吸取數量2×4＝8，不倍增使用次數`,async()=>{
      seed(8,1,1);const [r]=await h.play(side,{self:h.unit('S',10000,[skill('pp_drain',{v:2,steal:true})],{speed:200}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.opp.skills[0].pp,90);assert.equal(r.self.skills[0].pp,99);
    });
    await check(`${side} 最大／已損失體力恢復及護罩量讀取倍率，保留正式恢復管道`,async()=>{
      for(const [op,expected,missingRatio] of [['heal',5000,undefined],['heal_missing',4600,undefined],['heal',8600,.1]] as const){seed(8,1,1);const [r]=await h.play(side,{self:h.unit('S',1000,[skill(op,{side:'self',ratio:.1,...(missingRatio?{missingRatio}:{})})],{maxHp:10000,speed:200}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.currentHp,expected);}
      seed(8,2,1);const [r]=await h.play(side,{self:h.unit('S',10000,[skill('shield',{flat:5,kind:'barrier',perMark:{side:'self',id:'amplifier'}})],{speed:200}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.barrier,40);
    });
    await check(`${side} 同側其他持有者不借倍率；圖紙改名改3倍後造成600固定傷害`,async()=>{
      seed(8,1,1,false,true);const [d]=await h.play(side,{self:h.unit('S',10000,[skill()],{speed:200}),opp:h.unit('E',10000,[h.wait()])});assert.equal(d.opp.currentHp,9900);
      seed(8,1,1);const [r]=await h.play(side,{self:h.unit('S',10000,[structuredClone(edited)],{speed:200}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.opp.currentHp,9400);
    });
    await check(`${side} 附加無效不執行倍率動作，原全吸取與反轉仍維持原義`,async()=>{
      seed(8,1,1);const [sealed]=await h.play(side,{self:h.unit('S',10000,[skill()],{extra:{isAdditionalInvalid:true}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(sealed.opp.currentHp,10000);
      for(const reverse of [false,true]){const [r]=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('原吸取',[{op:'stat_steal',p:{mode:'吸取',reverse}}])],{speed:200}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:4}})});assert.equal(r.self.statStages.atk,4);assert.equal(r.opp.statStages.atk,reverse?-4:0);}
    });
  }
  console.log(`${checks} action mark scale checks passed`);
}finally{delete h.S.S;delete h.S.E;await h.close();}
