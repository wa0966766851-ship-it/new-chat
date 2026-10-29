import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();try{
 const {MIGRATED_ARENA16_MONSTER_SKILL_KIT:[def]}=await h.server.ssrLoadModule('/src/data/migratedArena16MonsterKit.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 const {createDamageComp}=await h.server.ssrLoadModule('/src/battle/damagePipeline.ts');
 const {damageReductionReceipt}=await h.server.ssrLoadModule('/src/battle/damageReductionReceipt.ts');
 const {addDamageReduction,multiplyDamageReduction}=await h.server.ssrLoadModule('/src/battle/damageReduction.ts');
 const comp=()=>createDamageComp({base:100,increasePercent:0,decreasePercent:0,multiplier:1,damageCategory:'skill_attack'});
 const c=comp();c.increasePercent+=1;multiplyDamageReduction(c,.5);c.multiplier*=3;
 assert.deepEqual(damageReductionReceipt(c),{beforeReduction:600,afterReduction:300,reduced:300});
 const full=comp();multiplyDamageReduction(full,0);full.multiplier*=3;full.increasePercent+=1;
 assert.deepEqual(damageReductionReceipt(full),{beforeReduction:600,afterReduction:0,reduced:600},'完全減免仍保留其後增傷乘區，不靠除以0還原');
 const floor=comp();addDamageReduction(floor,.5);floor.floor=90;assert.equal(damageReductionReceipt(floor).reduced,10,'保底實際抵銷的減免不得給獎勵');
 const cancel=comp();addDamageReduction(cancel,.5);cancel.multiplier=0;assert.equal(damageReductionReceipt(cancel).reduced,0,'抵擋/轉化與減傷分離');
 const reward=def.kit.find((e:any)=>e.order===5);assert.equal(kitEntryIssue(reward),null);
 defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{
  const b=buildEntryBlock(w as any,reward)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
  assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],reward.node,reward.order),reward);
 }finally{w.dispose();r.dispose();}
 const skill=()=>({...h.wait(),name:'通用減傷獎勵',category:'特殊',power:100,effectMode:'kit',kit:[structuredClone(reward)]});
 for(const side of ['p1','p2'] as const){
  for(const reduction of [0,9,10,20]){
   h.S['正式減傷受方']=(_ctx:any,event:string,data:any)=>{if(event==='BEFORE_DAMAGE'&&data?.damageComp?.isIncoming)data.damageComp.flatReduction=reduction;};
   const [out]=await h.play(side,{self:h.unit('獎勵持有者',10000,[skill()],{speed:400}),opp:h.unit('正式減傷受方',10000,[h.wait()])});
   const n=Math.floor(reduction/10),stacks=out.state[side+'Marks'].find((m:any)=>m.id==='arena.dragonSoulMark')?.count||0;
   assert.equal(stacks,n,'每實際減少10點才一層，零與9點不得取得');
   for(const key of ['atk','def','spatk','spdef'])assert.equal(out.self.calculatedStats[key],Math.floor(300*(1+n*.1)),key+'增加點數而非能力等級');
   assert.equal(out.self.calculatedStats.speed,Math.floor(400*(1+n*.1)));assert.deepEqual(out.self.statStages,{});
   assert.ok(!out.logs.some((l:string)=>l.includes('效果待接通')));
  }
  delete h.S['正式減傷受方'];
  for(const extra of [{shield:10000},{barrier:10000},{currentHp:1},{}]){
   h.S['限制受方']=(_ctx:any,event:string,data:any)=>{if(event==='BEFORE_DAMAGE'&&data?.damageComp?.isIncoming)data.damageComp.limit=1;};
   const [out]=await h.play(side,{self:h.unit('獎勵持有者',10000,[skill()],{speed:400}),opp:h.unit(extra.shield||extra.barrier||extra.currentHp?'承傷受方':'限制受方',extra.currentHp||10000,[h.wait()],{extra})});
   assert.equal(out.state[side+'Marks'].find((m:any)=>m.id==='arena.dragonSoulMark')?.count||0,0,'盾罩、殘血截斷、傷害限制都不能當減傷量');
   assert.equal(out.self.calculatedStats.atk,300);
  }
  delete h.S['限制受方'];
  const [control]=await h.play(side,{self:h.unit('獎勵持有者',10000,[skill()],{speed:400}),opp:h.unit('參考受方',10000,[h.wait()])});
  const nominal=10000-control.opp.currentHp;
  h.S['完全減免受方']=(_ctx:any,event:string,data:any)=>{if(event==='BEFORE_DAMAGE'&&data?.damageComp?.isIncoming)multiplyDamageReduction(data.damageComp,0);};
  const [immune]=await h.play(side,{self:h.unit('獎勵持有者',10000,[skill()],{speed:400}),opp:h.unit('完全減免受方',10000,[h.wait()])});
  assert.equal(immune.opp.currentHp,10000);assert.equal(immune.state[side+'Marks'].find((m:any)=>m.id==='arena.dragonSoulMark')?.count||0,Math.floor(nominal/10));
  delete h.S['完全減免受方'];
 }
 console.log('減傷回執：增傷及完全減免還原、保底/抵擋分離；P1/P2零/9/10/20步數、點數、盾罩/上限/殘血、完全減免及Blockly通過');
}finally{await h.close();}
