import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {effectRoute}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
const {evalCond}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
try{
 defineCustomBlocks();
 for(const name of ['閱世','敕界歸元','告命詩途','神懺福音之章','遺典.妄世律裁']){
  const sk=h.find('5021',name);assert.equal(sk.effectMode,"kit");assert.equal(effectRoute(sk,true),"kit");validateKit(sk.kit);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{
   for(const e of sk.kit)assert.ok(buildEntryBlock(w as any,e));
   Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
   const entries=r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a:any,b:any)=>a.order-b.order);
   assert.deepEqual(entries,[...sk.kit].sort((a:any,b:any)=>a.order-b.order));checks++;
  }finally{w.dispose();r.dispose();}
 }
 const cond={c:'action_priority',p:{side:'self',op:'高於',amount:0}};
 for(const v of [-3,0,2])assert.equal(evalCond({self:{},target:{},getPlayerState:()=>v,getOpponentState:()=>0},cond,{}),v>0);checks++;
 for(const side of ['p1','p2'] as const){
  const drainSkill=structuredClone(h.find('5021','告命詩途'));
  drainSkill.kit=drainSkill.kit.filter((e:any)=>e.order===2);
  const other=side==='p1'?'p2':'p1';
  const drainRounds=await h.play(side,{
   self:h.unit('S',1000,[drainSkill,h.wait()],{maxHp:100000,speed:200}),
   opp:h.unit('E',30000,[h.wait()]),
   turns:(engine:any,t:number)=>{
    engine.dispatch({type:'UPDATE_ELF',side:other,elf:{currentHp:30000}});
    engine.dispatch({type:'UPDATE_ELF',side,elf:{currentHp:1000}});
    if(t===3){
     const marks=[{id:'poem_chapter',name:'詩章',count:4,scope:'elf',ownerBattleId:'S',persistsOffField:true}];
     engine.dispatch({type:'UPDATE_ELF',side,elf:{marks}});
     engine.dispatch({type:'SET_MARKS',side,marks});
    }
    return [t===1?0:1,0];
   },
  },6);
  assert.deepEqual(drainRounds.map((r:any)=>30000-r.opp.currentHp),[10000,10000,20000,20000,20000,0],
   '告命詩途施放當次及後續使用技能持續五回合；每次依當下詩章判斷翻倍，第六回合停止');
  assert.deepEqual(drainRounds.map((r:any)=>r.self.currentHp),[11000,11000,21000,21000,21000,1000],
   '每次吸取仍走百分比傷害與等量恢復，不能只扣血或只恢復');
  assert.ok(drainRounds[0].state[`${side}Timers`].some((timer:any)=>
   timer.kind==='turn_effect'&&timer.clearable!==false&&timer.payload?.block?.trig==='self_skill'),
   '五回合吸取登記為可消除的正式回合類效果');
  checks++;
  const missedSetup={...structuredClone(drainSkill),isSureHit:false,accuracy:0};
  const noGrant=await h.play(side,{
   self:h.unit('S',1000,[missedSetup,h.wait()],{maxHp:100000,speed:200}),
   opp:h.unit('E',30000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0],
  },2);
  assert.deepEqual(noGrant.map((r:any)=>r.opp.currentHp),[30000,30000],
   '首次未命中不取得五回合吸取效果，後續使用技能也不能憑空觸發');checks++;
  const missedFollowup={...h.wait(),name:'未命中的後續攻擊',category:'物理',power:10,isSureHit:false,accuracy:0};
  const useAfterGrant=await h.play(side,{
   self:h.unit('S',1000,[structuredClone(drainSkill),missedFollowup],{maxHp:100000,speed:200}),
   opp:h.unit('E',30000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0],
  },2);
  assert.deepEqual(useAfterGrant.map((r:any)=>r.opp.currentHp),[20000,10000],
   '首次命中取得效果後，後續每次使用技能即吸取，不必再次命中');checks++;
  const clear=h.kitSkill('清除回合類效果',[{op:'clear_turn',p:{side:'opp'}}],{priority:4});
  const cleared=await h.play(side,{
   self:h.unit('S',1000,[structuredClone(drainSkill),h.wait()],{maxHp:100000,speed:200}),
   opp:h.unit('E',30000,[h.wait(),clear]),turns:(_e:any,t:number)=>[t===1?0:1,t===2?1:0],
  },3);
  assert.deepEqual(cleared.map((r:any)=>r.opp.currentHp),[20000,20000,20000],
   '五回合吸取可以被既有消除回合類效果積木解除，解除後不再吸取');checks++;
  // 固定主公式10；追加100經2倍增傷、50%減傷仍100，應合計110且只一次落地。
  
  h.S.S=(_c:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&!d.damageComp?.isIncoming&&d.damageComp?.damageCategory==='skill_attack'){d.damageComp.base=10;d.damageComp.increasePercent=0;d.damageComp.decreasePercent=0;d.damageComp.multiplier=1;}else if(e===T.BEFORE_DAMAGE&&!d.damageComp?.isIncoming&&d.damageComp?.damageCategory==='skill_attribute')d.damageComp.increasePercent+=1;};
  h.S.E=(_c:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&d.damageComp?.isIncoming&&d.damageComp?.damageCategory==='skill_attribute')d.damageComp.decreasePercent+=0.5;};
  const attack=h.kitSkill('合併測試',[{op:'dmg',p:{flat:100,type:'技能',elem:'普通',appendToAttack:true}}],{category:'物理',power:10});
  const [out,next]=await h.play(side,{self:h.unit('S',100000,[attack,{...h.wait(),category:'物理',power:10}],{speed:200}),opp:h.unit('E',100000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},2);
  assert.equal(100000-out.opp.currentHp,110);assert.equal(out.opp.currentHp-next.opp.currentHp,10,'追加量不殘留至下一擊');checks++;
  delete h.S.S;delete h.S.E;
  // 正式告命詩途龍魂條款，支付PP後自身4點＋對手2點，其中1個滿PP技能：100×2=200。
  const s=structuredClone(h.find('5021','告命詩途'));s.kit=s.kit.filter((e:any)=>e.order===5);s.pp=5;s.maxPp=5;
  h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState('dimensionalDragonSoul',true);};
  const [poem]=await h.play(side,{self:h.unit('S',100000,[s],{speed:200}),opp:h.unit('E',100000,[{...h.wait(),pp:2,maxPp:2}])});
  assert.equal(100000-poem.opp.currentHp,200);checks++;
  // 技能直接增加詩章也保存取得時的獨立體力快照。
  const add=h.kitSkill('快照',[{op:'resource_mark_add',p:{id:'poem_chapter',name:'詩章',displayChar:'詩',unit:'篇',side:'self',scope:'elf',persistsOffField:true,amount:4,snapshotKey:'poemHpSnapshots',description:'快照'}}]);
  const [snap]=await h.play(side,{self:h.unit('S',12345,[add]),opp:h.unit('E',100000,[h.wait()])});
  assert.deepEqual(snap.self.marks.find((m:any)=>m.id==='poem_chapter').effects.poemHpSnapshots,[12345,12345,12345,12345]);checks++;
  delete h.S.S;
  const {MIGRATED_FINAL_DRAGON_SOUL_KIT:dragon}=await h.server.ssrLoadModule('/src/data/migratedFinalMarsLanDragonKits.ts');
  h.S.E=(c:any,e:any,d:any)=>{if(e===T.ON_ENTRANCE)c.setMark({id:'poem_chapter',name:'詩章',count:10,scope:'elf',ownerBattleId:'S',persistsOffField:true},c.targetSide);if(e===T.BEFORE_DAMAGE&&d.damageComp?.isIncoming&&d.damageComp?.damageCategory==='skill_attack'){d.damageComp.base=10;d.damageComp.increasePercent=0;d.damageComp.decreasePercent=0;d.damageComp.multiplier=1;}};
  const [ten]=await h.play(side,{self:h.unit('S',10000,[{...h.wait(),category:'物理',power:10}],{speed:200,extra:{soulMark:{name:'龍',effectMode:'kit',kit:dragon.kit.filter((e:any)=>e.order===14)}}}),opp:h.unit('E',1000,[h.wait()],{extra:{shield:5000}})});
  assert.equal(ten.opp.shield,3990,'10篇追加最大HP技能傷害合併主擊並經護盾');assert.equal(ten.opp.currentHp,1000);checks++;delete h.S.E;
  const fifth=structuredClone(h.find('5021','遺典.妄世律裁'));
  const mark={id:'poem_chapter',name:'詩章',count:4,scope:'elf',ownerBattleId:'S',persistsOffField:true,effects:{poemHpSnapshots:[10000,10000,10000,10000]}};
  const only=(order:number)=>({...fifth,kit:fifth.kit.filter((e:any)=>e.order===order),category:'屬性',power:0});
  h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setMark(mark,c.actor);};
  const [trueDmg]=await h.play(side,{self:h.unit('S',10000,[only(3)],{extra:{marks:[mark]}}),opp:h.unit('E',10000,[h.wait()])});
  assert.equal(10000-trueDmg.opp.currentHp,400);checks++;delete h.S.S;
  const [percent]=await h.play(side,{self:h.unit('S',10000,[only(2)],{speed:200}),opp:h.unit('E',10000,[h.wait(),h.wait()])});
  assert.equal(10000-percent.opp.currentHp,4000);checks++;
  h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState('dimensionalDragonSoul',true);};
  const low=only(5);low.pp=5;low.maxPp=5;
  const [difference]=await h.play(side,{self:h.unit('S',1000,[low],{speed:200}),opp:h.unit('E',2000,[{...h.wait(),pp:2,maxPp:2}])});
  // 一個滿PP技能，差值1000×70%×2^7=89600，應擊敗2000HP對手。
  assert.equal(difference.opp.currentHp,0);checks++;
  delete h.S.S;
 }
 console.log(`次元龍修正 ${checks} 組通過`);
}finally{delete h.S.S;delete h.S.E;await h.close();}
process.exit(0);

