import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {TIANXIE_READY_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/tianxieSkills.ts');
 const {tianxieMark,TIANXIE_MARK_ID}=await h.server.ssrLoadModule('/src/data/tianxieMark.ts');
 const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 defineCustomBlocks();
 for(const skill of skills){h.assertKitOnly(skill);for(const entry of skill.kit){assert.equal(entry.codeId==='effect_sequence'?sequenceIssue(entry.params.clause,entry.node):skillPropertyIssue(entry),null,`${skill.name}/${entry.customText}`);const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}}}
 for(const side of ['p1','p2'] as const){
  const isolated=(index:number,order:number)=>{const s=structuredClone(skills[index]);s.power=0;s.isSureHit=true;s.kit=s.kit.filter((e:any)=>e.order===order);return s;};
  for(const [hp,enemy,amount] of [[1000,10000,350],[1000,500,250]]){
   const [r]=await h.play(side,{self:h.unit('S',hp,[isolated(0,2)],{maxHp:5000,speed:300}),opp:h.unit('E',enemy,[h.wait()])});
   assert.equal(r.self.currentHp,hp+amount);assert.equal(r.opp.currentHp,enemy-amount);
  }
  for(const [hp,maxHp,expectedDamage,mark] of [[1000,1000,150,true],[1000,10000,5000,false],[930,1000,220,true]]){
   const [r]=await h.play(side,{self:h.unit('S',hp,[isolated(2,4)],{maxHp,speed:300}),opp:h.unit('E',100000,[h.wait()])});
   assert.equal(100000-r.opp.currentHp,expectedDamage,'恢復量與實際損血合計不足150才補真傷');
   const enemy=side==='p1'?'p2':'p1';assert.equal(r.state[enemy+'Marks'].some((m:any)=>m.id===TIANXIE_MARK_ID),mark);
  }
  const [calm]=await h.play(side,{self:h.unit('S',10000,[isolated(3,2)],{speed:300,extra:{battleStatuses:{平靜:5}}}),opp:h.unit('E',100000,[h.wait()],{extra:{battleStatuses:{平靜:9}}})});
  const enemy=side==='p1'?'p2':'p1';
  assert.equal(calm.state[enemy+'RegistryState'].attackSkillInvalidTurns,2,'本次施放刷新平靜至3回合後讀目前期限，結束扣1；不合計對手9回合');
  const seal=isolated(3,2);seal.kit[0].params.clause.body[0].acts.shift();
  const [existing]=await h.play(side,{self:h.unit('S',10000,[seal],{speed:300,extra:{battleStatuses:{平靜:5}}}),opp:h.unit('E',100000,[h.wait()],{extra:{battleStatuses:{平靜:9}}})});
  assert.equal(existing.state[enemy+'RegistryState'].attackSkillInvalidTurns,4,'未刷新時讀當前5回合，不是固定3或雙方回合總和');
  const grant=h.kitSkill('加入四道',[tianxieMark(),tianxieMark(),tianxieMark(),tianxieMark()]);
  const attack={...h.wait(),name:'測試主攻擊',category:'物理',power:100};
  const rows=await h.play(side,{self:h.unit('S',1000,[grant,attack],{maxHp:10000,speed:300}),opp:h.unit('E',100000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.equal(rows[0].state[enemy+'Marks'].find((m:any)=>m.id===TIANXIE_MARK_ID).count,3,'最多三道');
  assert.equal(rows[1].self.currentHp,1900,'三層各吸取300並恢復對方在場者');
  assert.equal(rows[1].state[enemy+'RegistryState'].actionPriorityThisTurn,-3,'先制逐層-n');
  const survive=structuredClone(skills[1]);survive.kit=survive.kit.filter((e:any)=>[4,5,6].includes(e.order));
  const frozen=await h.play(side,{self:h.unit('S',10000,[survive,h.wait()],{speed:300}),opp:h.unit('E',100000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},6);
  assert.equal(frozen[0].opp.currentHp,99700,'施放當次使用後即追加300固定傷害');
  assert.equal(frozen[5].opp.currentHp,98200,'被凍結的五回合效果持續每次使用後觸發');
  const fifth=isolated(4,1);
  for(const immune of [false,true]){
   if(immune)h.S.E=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE)ctx.setPlayerState('immuneStatDownTurns',99);};
   try{const [transfer]=await h.play(side,{self:h.unit('S',10000,[fifth],{statStages:{atk:-2}}),opp:h.unit('E',100000,[h.wait()])});
    assert.equal(transfer.self.statStages.atk,0,'解除自身下降不受對手免疫影響');
    assert.equal(h.statuses(transfer.opp).includes('詛咒'),!immune,'真正反饋成功才詛咒');
   }finally{delete h.S.E;}
  }
 }
 console.log('tianxieFoundation passed: five skill contracts/Blockly, P1/P2 drain branches, actual heal+damage threshold, current serenity turns and three independent warrant drains/priority');
}finally{await h.close();}
