import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {IMMORTAL_AINS_FIRE_SEED as seed} from '../src/data/immortalAinsSkills';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
try{
 h.assertKitOnly(seed);defineCustomBlocks();
 for(const e of seed.kit!){
  if(e.codeId==='effect_sequence')assert.equal(sequenceIssue(e.params.clause,e.node),null);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{buildEntryBlock(w as any,e);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],e.node,e.order),e);}finally{w.dispose();r.dispose();}
 }
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 for(const side of ['p1','p2'] as const){
  const hits:number[]=[];
  h.S.S=(_ctx:any,event:any,data:any)=>{if(event===T.OPPONENT_DAMAGE&&data.damageType==='percent')hits.push(data.hpReduced);};
  const protection={name:'測試免疫',description:'正式初始化',effectMode:'kit',effectType:'custom',kit:[{codeId:'effect_sequence',node:'battle_start',source:'soulmark',role:'innate',order:0,customText:'免疫',params:{clause:{raw:'免疫',trig:'battle_start',parsed:true,body:[{acts:[{op:'immune_status_turns',p:{turns:10},label:'免疫'}]}]}}}]};
  const recovery=h.kitSkill('每次回滿',[{op:'heal',p:{side:'self',ratio:1}}]);
  const failure=await h.play(side,{self:h.unit('S',10000,[seed,h.wait()],{speed:200}),opp:h.unit('O',9000,[recovery],{extra:{soulMark:protection}}),turns:(_e,t)=>[t===1?0:1,0]},5);
  assert.deepEqual(hits,[3000,3000,3000,3000],'初次成功啟動及其後三回合，每次使用技能時焚燼失敗均造成3000百分比傷害；第五回合到期');
  assert.equal(failure[4].self.skills[0].pp,4,'持續效果不重複消耗原技能PP');
  hits.length=0;
  const success=await h.play(side,{self:h.unit('S',10000,[seed],{speed:200}),opp:h.unit('O',90000,[h.wait()])},1);
  assert.ok(h.statuses(success[0].opp).includes('焚燼'),'固定戰鬥種子重現70%成功分支');
  assert.deepEqual(hits,[],'成功附加焚燼時不能同時追加失敗補償');
  h.S.S=(_ctx:any,event:any,data:any)=>{const c=data?.damageComp||data;if(event===T.BEFORE_DAMAGE&&c.isIncoming&&c.damageCategory==='skill_attack')c.base=100;};
  const attack={...h.wait(),name:'攻擊',category:'物理',power:100};
  const blocked=await h.play(side,{self:h.unit('S',10000,[seed,h.wait()],{speed:200}),opp:h.unit('O',90000,[attack],{extra:{soulMark:protection}}),turns:(_e,t)=>[t===1?0:1,0]},2);
  assert.equal(blocked[0].self.currentHp,10000,'免疫第一次攻擊傷害');
  assert.equal(blocked[1].self.currentHp,9900,'只抵擋一次，第二次正常受到100');
  delete h.S.S;
  const poison=h.kitSkill('附加中毒',[{op:'status',p:{side:'opp',status:'中毒',chance:100,turns:3}},{op:'heal',p:{side:'self',ratio:1}}]);
  const selective=structuredClone(protection);
  selective.kit[0].params.clause.body[0].acts[0].p={turns:10,cls:'',exclude:['中毒']} as any;
  const reflected=await h.play(side,{self:h.unit('S',100000,[seed,h.wait()],{speed:200}),opp:h.unit('O',100000,[poison],{extra:{soulMark:selective}}),turns:(_e,t)=>[t===1?0:1,0]},6);
  for(let i=0;i<5;i++){
   assert.ok(!h.statuses(reflected[i].self).includes('中毒'),`第${i+1}回合免疫仍在`);
   assert.ok(h.statuses(reflected[i].opp).includes('中毒'),`第${i+1}回合確實反彈`);
  }
  assert.ok(h.statuses(reflected[5].self).includes('中毒'),`第六回合防護到期：${JSON.stringify(reflected.map(r=>({hp:r.opp.currentHp,reg:r.state[`${side}RegistryState`]?.reflectStatusTurns,status:h.statuses(r.self)})))}\n${reflected[5].logs.slice(-20).join('\n')}`);
  console.log(`✓ ${side} 火種永存：正式可編輯積木、四次失敗百分比補償、一次攻擊抵擋、五回合免疫反彈與到期`);
 }
}finally{delete h.S.S;await h.close();}
