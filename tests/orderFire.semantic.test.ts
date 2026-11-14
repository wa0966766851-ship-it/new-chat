import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {grantOrderFire,ORDER_FIRE_ID} from '../src/data/immortalAinsOrderFire';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
try{
 const grant=h.kitSkill('正式秩序之火',[grantOrderFire(),grantOrderFire(),grantOrderFire(),grantOrderFire()]);
 assert.equal(sequenceIssue(grant.kit[0].params.clause,grant.kit[0].node),null);
 defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
 try{buildEntryBlock(w as any,grant.kit[0]);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],grant.kit[0].node,0),grant.kit[0]);}finally{w.dispose();r.dispose();}
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 h.S.S=(_ctx:any,event:any,data:any)=>{const c=data?.damageComp||data;if(event===T.BEFORE_DAMAGE&&!c.isIncoming&&c.damageCategory==='skill_attack')c.base=100;};
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  const fixed=h.kitSkill('固定100',[{op:'dmg',p:{flat:100,type:'固定'}}]);
  const trueHit=h.kitSkill('真實100',[{op:'dmg',p:{flat:100,type:'真實'}}]);
  const attack={...h.wait(),name:'攻擊100',category:'物理',power:100};
  const cap=h.kitSkill('傷害上限30',[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'非真實',cap:30,turns:6}}]);
  const result=await h.play(side,{self:h.unit('S',1000,[grant,attack,fixed,trueHit,h.wait()],{maxHp:10000,speed:200}),opp:h.unit('H',10000,[cap,h.wait()]),turns:(_e,t)=>[t===1?0:t===2?1:t===3?2:3,t===1?0:1]},4);
  const mark=result[0].state[`${other}Marks`].find((m:any)=>m.id===ORDER_FIRE_ID);
  assert.equal(mark.count,3,'四次附加仍最多三道');
  assert.deepEqual(mark.effects.blockSource,{side,battleId:'S'});
  assert.equal(mark.effects.incomingDamageLimitDisabled,1);assert.equal(mark.effects.incomingEffectChanceGuaranteed,1);
  const attackLoss=10000-result[1].opp.currentHp;
  assert.ok(attackLoss>=700&&attackLoss<=1300,`100攻擊+三次各200～400固定：${attackLoss}`);
  assert.equal(result[1].self.currentHp,1000+attackLoss,'實際技能及各道固定傷害全部回復給在場來源');
  assert.equal(result[2].opp.currentHp,result[1].opp.currentHp-100,'固定傷害不受上限30限制且不誤觸三道追傷');
  assert.equal(result[2].self.currentHp,result[1].self.currentHp+100);
  assert.equal(result[3].self.currentHp,result[2].self.currentHp,'真實傷害不能讓來源回血');
  console.log(`✓ ${side} 正式秩序之火三道上限、逐道傷害、非真實上限失效、來源回血與真傷隔離`);
 }
}finally{delete h.S.S;await h.close();}
