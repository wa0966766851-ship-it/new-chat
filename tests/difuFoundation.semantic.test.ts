import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {DIFU_READY_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/difuSkills.ts');
 const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const {statusRepeatCombatOperations, statusRepeatCombatIssue}=await h.server.ssrLoadModule('/src/blocks/ops/statusRepeatCombat.ts');
 defineCustomBlocks();
 for(const s of skills){h.assertKitOnly(s);for(const entry of s.kit){
  assert.equal(entry.codeId==='effect_sequence'?sequenceIssue(entry.params.clause,entry.node):skillPropertyIssue(entry),null,JSON.stringify(entry));
  const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(ws as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{ws.dispose();reload.dispose();}
 }}
 assert.ok(statusRepeatCombatIssue('status_turn_drains',{ratio:1/100,perTurn:-1},'use'));
 assert.ok(statusRepeatCombatIssue('self_stat_recoil',{stat:'atk',ratio:.01,type:'技能',floor:1},'use'));
 const ops=statusRepeatCombatOperations({liveElf:(ctx:any,side:string)=>ctx[side]});
 for(const [turns,want] of [[0,1],[1,16],[3,46]]){
  const hits:number[]=[],heals:number[]=[];
  const ctx:any={actor:'p1',targetSide:'p2',p1:{battleStatuses:{平靜:turns}},p2:{maxHp:10000,battleStatuses:{}},getStatuses:(e:any)=>e.battleStatuses,
   applyPinkDamage:(_side:any,n:number,_label:any,_a:any,_b:any,type:string)=>{assert.equal(type,'percent');hits.push(n);return Math.min(n,20);},applyHeal:(_side:any,n:number)=>heals.push(n)};
  ops.status_turn_drains(ctx,{ratio:.01,perTurn:15});
  assert.equal(hits.length,want);assert.ok(hits.every(n=>n===100));assert.equal(heals.length,want);assert.ok(heals.every(n=>n===20),'每次獨立受20上限，恢復每次實際結算20');
 }
 const values=new Map(),self={statStages:{},battleStatuses:{}},powerCtx:any={actor:'p1',targetSide:'p2',p1:self,actionId:1,getPlayerState:(k:string)=>values.get(k),setPlayerState:(k:string,v:any)=>values.set(k,v),rng:()=>0};
 const power=(count:number,up=false,rng=0)=>{powerCtx.actionId++;self.statStages=up?{atk:1}:{};values.set('skillUseSequence',{count});powerCtx.rng=()=>rng;const comp={power:0};ops.random_streak_power(powerCtx,{min:160,max:320,step:30,cap:320,stageMultiplier:1.5},{event:{data:{powerComp:comp}}});return comp.power;};
 assert.equal(power(1),160);assert.equal(power(2),190);assert.equal(power(7),320);assert.equal(power(20),320);assert.equal(power(1,true),240);assert.equal(power(1,true,1-Number.EPSILON),480);
 for(const side of ['p1','p2'] as const){
  for(const type of ['百分比','真實']){
   const hurt=h.kitSkill('非致死反噬',[{op:'self_stat_recoil',p:{stat:'atk',ratio:1,type,floor:1}}]);
   const [r]=await h.play(side,{self:h.unit('S',100,[hurt],{extra:{calculatedStats:{hp:100,atk:5000,def:300,spatk:300,spdef:300,speed:200}}}),opp:h.unit('E',10000,[h.wait()])});
   assert.equal(r.self.currentHp,1,r.logs.join('\n'));
   assert.ok(!r.self.isVanished);
   const next=h.kitSkill('普通致死傷害',[{op:'dmg',p:{flat:10,type:'真實'}}],{priority:4});
   const [dead]=await h.play(side,{self:h.unit('S',1,[hurt]),opp:h.unit('E',10000,[next])});
   assert.equal(dead.self.currentHp,0,'只保護這筆反噬，不能變成一般免死');
  }
  const glow=skills.find((s:any)=>s.name==='山神遺輝');
  const [r]=await h.play(side,{self:h.unit('S',1000,[glow],{maxHp:6000}),opp:h.unit('E',20000,[h.wait()])});
  assert.equal(r.self.statStages.atk,2,'先取得守護，後續強化按異常翻倍');
  assert.equal(r.self.currentHp,5000,'回復時低於半血，1/3翻倍為2/3');assert.equal(r.opp.currentHp,16000,'等量百分比4000');
  const mourn=skills.find((s:any)=>s.name==='萬古山殤');
  const recoilLine=mourn.kit.find((k:any)=>k.params?.clause?.raw.startsWith('5回合內每回合使用'));
  const weakener={...mourn,kit:[recoilLine]};
  const down=await h.play(side,{self:h.unit('S',2,[weakener,h.wait()]),opp:h.unit('E',10000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.equal(down[1].self.currentHp,1);assert.equal(down[1].opp.statStages.atk,-2);
  assert.ok(!h.statuses(down[1].opp).includes('神悔'),'強化下降成功、反噬因1血而無扣血，不能錯走下降失敗分支');
  const roar=skills.find((s:any)=>s.name==='怒號!');
  const twice=roar.kit.find((k:any)=>k.params?.clause?.raw.startsWith('下2次受到技能'));
  const protection={...h.wait(),name:'兩次反噬設置',effectMode:'kit',kit:[twice]};
  const enemy={...h.wait(),name:'小攻擊',category:'物理',power:10,priority:3};
  const fixture=(first:any)=>({self:h.unit('S',100000,[first,h.wait()],{extra:{calculatedStats:{hp:100000,atk:1000,def:300,spatk:300,spdef:300,speed:200}}}),opp:h.unit('E',100000,[enemy]),turns:(_e:any,t:number):[number,number]=>[t===1?0:1,0]});
  const baseline=await h.play(side,fixture(h.wait()),3),reaction=await h.play(side,fixture(protection),3);
  // 對手先制3：首次受傷發生在取得計次效果之前，後兩回合才各觸發一次。
  assert.deepEqual(reaction.map((v:any,i:number)=>baseline[i].self.currentHp-v.self.currentHp),[0,10,20]);
  const fifth=skills.find((s:any)=>s.isFifthSkill);
  const [randomHit]=await h.play(side,{self:h.unit('S',10000,[fifth],{speed:200}),opp:h.unit('E',100000,[h.wait()])});
  assert.ok(randomHit.opp.currentHp<100000,randomHit.logs.join('\n'));
  assert.equal(randomHit.self.skills[0].power,0,'隨機威力僅屬本次公式，不改技能面板');
  assert.ok(randomHit.state[side+'Timers'].some((t:any)=>t.payload?.block?.crit&&t.remaining===2),'未擊敗後確實保留兩次致命一擊');
 }
 console.log('difuFoundation passed（五招契約、積木存讀、逐次吸取與反噬）');
}finally{await h.close();}
