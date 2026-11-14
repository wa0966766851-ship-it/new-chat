import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {IMMORTAL_AINS_ROUND_END_KIT as kit} from '../src/data/immortalAinsRoundEndKit';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
const soul={name:'回合末正式片段',description:'正式回合末原文',effectMode:'kit',effectType:'custom',kit};
try{
 defineCustomBlocks();
 for(const e of kit){
  assert.equal(sequenceIssue(e.params.clause,e.node),null);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{buildEntryBlock(w as any,e);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('soulmark')(r.getTopBlocks(false)[0],e.node,e.order),e);}finally{w.dispose();r.dispose();}
 }
 for(const side of ['p1','p2'] as const){
  const ppSetup={codeId:'effect_sequence',node:'battle_start',source:'soulmark',role:'innate',order:0,customText:'測試先耗盡攻擊技能PP',params:{clause:{raw:'測試先耗盡攻擊技能PP',trig:'battle_start',parsed:true,body:[{acts:[{op:'pp_op',p:{side:'self',mode:'zero',kind:'攻擊'},label:'耗盡'}]}]}}};
  const self=h.unit('S',3000,[h.wait(),{...h.wait(),name:'待恢復PP',category:'物理',power:30,pp:1,maxPp:10}],{speed:200,maxHp:10000,extra:{soulMark:{...soul,kit:[...kit,ppSetup]}}});
  const result=await h.play(side,{self,opp:h.unit('O',50000,[h.wait()],{maxHp:100000})},2);
  assert.equal(result[0].opp.currentHp,45800,'吸取基數為自身已損失7000的60%，不是敵方損失體力');
  assert.equal(result[0].self.currentHp,7200);assert.equal(result[1].self.currentHp,8880,'次回合重新取自身已損失2800的60%');
  assert.equal(result[1].opp.currentHp,44120);assert.equal(result[0].self.skills[1].pp,3);assert.equal(result[1].self.skills[1].pp,6,'每回合所有技能PP恢復3');
  const cap=h.kitSkill('百分比上限30',[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'百分比',cap:30,turns:3}}]);
  const limited=await h.play(side,{self:structuredClone(self),opp:h.unit('O',50000,[cap],{maxHp:100000})},1);
  assert.equal(limited[0].opp.currentHp,49970,'保留百分比傷害類型與既有上限');assert.equal(limited[0].self.currentHp,3030,'回復按實際結算值30');
  const kill=h.kitSkill('擊敗對手',[{op:'dmg',p:{flat:2000,type:'真實'}}]);
  const killed=await h.play(side,{self:h.unit('S',3000,[kill,h.wait()],{speed:200,maxHp:10000,extra:{soulMark:soul}}),opp:h.unit('O',1000,[h.wait()]),oppBench:[h.unit('B',20000,[h.wait()])],turns:(_e,t)=>[t===1?0:1,t===1?0:{switch:1}]},2);
  assert.equal(killed[0].self.currentHp,10000,`${side} 擊敗後回合末重置體力；${killed[0].logs.join('\n')}`);
  assert.equal(killed[0].state[`${side==='p1'?'p2':'p1'}RegistryState`].nextElfStatus.status,'焚燼');
  assert.equal(killed[1].opp.id,'B');assert.ok(h.statuses(killed[1].opp).includes('焚燼'),'下一隻實際登場後附加焚燼，不僅寫旗標');
  console.log(`✓ ${side} 回合末自身損失體力百分比吸取、PP、上限、擊敗後重置與待登場異常`);
 }
}finally{await h.close();}
