import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const p={side:'self',stats:['hp','atk','def','spatk','spdef','speed'],amount:35,direction:'increase',floor:1};
const a=(p:any)=>({op:'stat_value',p,label:'固定能力點數'});
const entry=(node:string,trig:string,p:any)=>({codeId:'effect_sequence',node,source:'soulmark',role:'innate',order:0,
  params:{clause:{raw:'正式固定能力點數',trig,parsed:true,body:[{acts:[a(p)]}]}}});
const trait=(e:any)=>({name:'固定能力點數',description:'正式固定能力點數',effectMode:'kit',kit:[e]});
try{
  await check('六項能力逐項選取，拒絕全屬性等級／未知欄位／重複項／非整數與零點數',()=>{
    assert.equal(sequenceIssue(entry('on_kill','kill',p).params.clause),null);
    for(const bad of [{...p,stats:['全屬性']},{...p,stats:['atk','atk']},{...p,stats:[]},{...p,amount:0},{...p,amount:1.5},{...p,amount:-35},{...p,floor:0},{...p,direction:'reverse'},{...p,side:'both'}])assert.ok(sequenceIssue(entry('on_kill','kill',bad).params.clause));
  });
  let edited:any;
  await check('Blockly將35點改70點並排除HP，保存重載／改名後保留明確能力範圍',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{const slot=w.newBlock('custom_node_slot');slot.setFieldValue('on_kill','TARGET_NODE');const b=buildEntryBlock(w as any,entry('on_kill','kill',p) as any)!;slot.getInput('STACK')!.connection!.connect(b.previousConnection!);
      const act=w.getAllBlocks(false).find(b=>b.type==='sequence_action')!;act.setFieldValue(JSON.stringify({...p,amount:70,stats:p.stats.slice(1)}),'PARAMS');
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);const s=r.getTopBlocks(false)[0];edited=createKitBlockParser('soulmark')(s.getInputTargetBlock('STACK'),s.getFieldValue('TARGET_NODE'),0)!;assert.equal(sequenceIssue(edited.params.clause,edited.node),null);
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 正式擊敗後六项各提升35點，上限同步而HP不白送、不改能力等級`,async()=>{
      const kill=h.kitSkill('正式附加擊敗',[{op:'dmg',p:{flat:20000,type:'真實'}}]);
      const [r]=await h.play(side,{self:h.unit('S',8000,[kill],{maxHp:10000,speed:200,statStages:{atk:2,def:-1},extra:{trait:trait(entry('on_kill','kill',p))}}),opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('B',10000,[h.wait()])]});
      assert.equal(r.self.maxHp,10035,r.logs.join('\n'));assert.equal(r.self.currentHp,8000);assert.deepEqual(r.self.calculatedStats,{hp:10035,atk:335,def:335,spatk:335,spdef:335,speed:235});assert.deepEqual(r.self.statStages,{atk:2,def:-1});
    });
    await check(`${side} 未擊敗不增加，重載改名的五項+70不改HP上限`,async()=>{
      const [idle]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{trait:trait(entry('on_kill','kill',p))}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(idle.self.calculatedStats.atk,300);
      const kill=h.kitSkill('重新命名技能',[{op:'dmg',p:{flat:20000,type:'真實'}}]);const [r]=await h.play(side,{self:h.unit('S',10000,[kill],{speed:200,extra:{trait:{...trait(edited),name:'修改後五項'}}}),opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('B',10000,[h.wait()])]});assert.equal(r.self.calculatedStats.atk,370,r.logs.join('\n'));assert.equal(r.self.calculatedStats.speed,270);assert.equal(r.self.maxHp,10000);assert.equal(r.self.currentHp,10000);
    });
    await check(`${side} 攻防數值減少有下限，不借能力等級；HP減點同步夾住當前HP`,async()=>{
      const reduce=h.kitSkill('減少固定點數',[a({...p,side:'opp',amount:400,direction:'decrease'})]);const [r]=await h.play(side,{self:h.unit('S',10000,[reduce],{speed:200}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:3}})});assert.equal(r.opp.maxHp,9600);assert.equal(r.opp.currentHp,9600);assert.equal(r.opp.calculatedStats.hp,9600);assert.equal(r.opp.calculatedStats.atk,1);assert.deepEqual(r.opp.statStages,{atk:3});
    });
    await check(`${side} 修改的速度由正式先制／速度讀取端使用，下一回合確實反超`,async()=>{
      const speed=h.kitSkill('速度固定點數',[a({...p,stats:['speed']})]);const other=side==='p1'?'p2':'p1',self=h.unit('S',10000,[speed],{speed:100}),opp=h.unit('E',10000,[h.wait()],{speed:120}),units:any={[side]:self,[other]:opp},order:string[]=[];
      const engine=createBattleEngine({initialP1Team:[units.p1],initialP2Team:[units.p2],p1StarterId:units.p1.id,p2StarterId:units.p2.id,battleMode:'PVP',preparedTeams:true,isFast:()=>true,onNode:(n:string,d:any)=>{if(n==='3.1')order.push(d.side);}});
      try{engine.mount();engine.start();for(let i=0;i<2;i++){await engine.idle();for(const s of ['p1','p2'] as const)engine.onSkillSelect(s,engine.getState()[s].skills[0]);await engine.idle();}assert.deepEqual(order,[other,side,side,other]);assert.equal(engine.getState()[side].calculatedStats.speed,170);}finally{engine.unmount();}
    });
  }
  console.log(`${checks} checks: fixed stat points and formal speed reader`);
}finally{await h.close();}
process.exit(0);
