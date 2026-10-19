import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {MIGRATED_5014_CAN_SOUL_KIT:can}=await h.server.ssrLoadModule('/src/data/migrated5014CanSoulKit.ts');
 const {MIGRATED_ARENA14_WUJI_SOUL_KIT:wuji}=await h.server.ssrLoadModule('/src/data/migratedArena14WujiSoulKit.ts');
 const {MIGRATED_ARENA16_DRAGON_HEALING_SOUL_KIT:dragon}=await h.server.ssrLoadModule('/src/data/migratedArena16DragonHealingSoulKit.ts');
 const {MIGRATED_ARENA12_SKILL_KITS:skills}=await h.server.ssrLoadModule('/src/data/migratedArena12SkillKits.ts');
 const {MIGRATED_ARENA16_YOUMO_SKILL_KIT:youmos}=await h.server.ssrLoadModule('/src/data/migratedArena16YoumoKit.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 const source=[can,wuji,dragon,...skills,...youmos];defineCustomBlocks();
 for(const def of source){assert.ok(def);const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{for(const e of def.kit){assert.equal(kitEntryIssue(e),null,`${def.name}/${e.order}`);assert.ok(buildEntryBlock(w as any,e));}Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser(def.kind==='soul'?'soulmark':'skill')(b,old.node,old.order);}),def.kit);}finally{w.dispose();r.dispose();}}
 const soul=(src:any,orders:number[])=>({...src,effectMode:'kit',kit:structuredClone(src.kit.filter((e:any)=>orders.includes(e.order)))});
 const sk=(src:any,orders?:number[])=>({...h.wait(),...src,effectMode:'kit',kit:structuredClone(orders?src.kit.filter((e:any)=>orders.includes(e.order)):src.kit)});
 for(const side of ['p1','p2'] as const){
  const [buff]=await h.play(side,{self:h.unit('燦測試持有者',5000,[h.wait()],{extra:{soulMark:soul(can,[2])}}),opp:h.unit('燦測試受方',5000,[h.wait()])});
  assert.equal(buff.self.statStages.spatk,2);assert.equal(buff.self.statStages.speed,2);assert.equal(buff.self.statStages.accuracy,1);assert.equal(buff.opp.statStages.spdef,-2);assert.equal(buff.opp.statStages.speed,-2);assert.equal(buff.opp.statStages.accuracy,-1);
  for(const enabled of [false,true]){
   h.S['攻擊免疫受方']=(c:any,event:string)=>{if(event==='ON_ENTRANCE')c.setPlayerState('blockAttackCount',1);};
   const [v]=await h.play(side,{self:h.unit('無視測試持有者',5000,[{...h.wait(),name:'正式物攻',category:'物理',power:100}],{speed:300,extra:enabled?{soulMark:soul(wuji,[2])}:{}}),opp:h.unit('攻擊免疫受方',5000,[h.wait()])});
   assert.equal(v.opp.currentHp<5000,enabled,'無極的正式使用節點必須早於攻擊免疫判定');
  }
  for(const invalid of [false,true]){
   h.S['無效測試受方']=(c:any,event:string)=>{if(event==='ON_ENTRANCE'&&invalid)c.addTimerTo(c.targetSide,{id:'無效測試',remaining:1,kind:'use_counter',source:'skill',tickAt:'never',payload:{block:{invalid:'all'}}},false);};
   const [v]=await h.play(side,{self:h.unit('無效補償持有者',5000,[sk(youmos[0],[2])]),opp:h.unit('無效測試受方',5000,[h.wait()])});
   assert.equal((v.state[side+'Marks']||[]).find((m:any)=>m.id==='arena.dragonSoulMark')?.count||0,invalid?1:0,'只有正式技能無效才能取得龍魂印記');
  }
  const inherit=sk(skills.find((s:any)=>s.name==='千秋虔'),[4]);inherit.kit.unshift(...h.kitSkill('斬臣服',[{op:'dmg',p:{flat:99999,type:'真實'}}]).kit);
  const inherited=await h.play(side,{self:h.unit('臣服繼承持有者',5000,[inherit,h.wait()],{speed:300}),opp:h.unit('臣服倒下者',5000,[h.wait()],{extra:{battleStatuses:{'臣服':3}}}),oppBench:[h.unit('繼任者',5000,[h.wait()])],turns:(_e:any,t:number)=>t===1?[0,0]:[1,{switch:1}]},2);
  assert.ok(h.statuses(inherited[1].opp).includes('臣服'),'正式擊敗後待登場狀態必須由下一隻對手承接');
  const power:any[]=[];h.S['威力觀察者']=(_c:any,event:string,data:any)=>{if(event==='MODIFY_POWER'&&data?.isIncoming)power.push(data.powerComp);};
  const raw=skills.find((s:any)=>s.name==='無相諦');
  await h.play(side,{self:h.unit('威力持有者',5000,[h.kitSkill('加兩層',[{op:'resource_mark_add',p:{id:'wuweiCancelled',name:'離',displayChar:'離',unit:'層',description:'測試兩層',persistsOffField:false,side:'self',scope:'elf',amount:2,maxCount:6}}]),{...sk(raw,[5]),category:'物理',power:0}],{speed:300}),opp:h.unit('威力觀察者',50000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.equal(power.at(-1)?.power,100,'基礎威力0，兩層應加100點，不能乘以101');
  const kill=sk(raw,[6]);kill.kit.unshift(...h.kitSkill('斬',[{op:'dmg',p:{flat:99999,type:'真實'}}]).kit);
  const dead=h.unit('已倒下甲',0,[h.wait()]),dead2=h.unit('已倒下乙',0,[h.wait()]),alive=h.unit('存活後備',5000,[h.wait()]);
  const [vanish]=await h.play(side,{self:h.unit('消逝持有者',5000,[kill],{speed:300}),opp:h.unit('本次倒下',5000,[h.wait()]),oppBench:[dead,dead2,alive]});
  const other=side==='p1'?'p2':'p1',team=vanish.state[other+'Team'];
  assert.ok(team.filter((e:any)=>e.currentHp<=0).every((e:any)=>e.isVanished),'包含本次擊敗者的全部陣亡精靈消逝');assert.ok(!team.find((e:any)=>e.id==='存活後備').isVanished);
  const yo=sk(youmos[0]);
  const [normal]=await h.play(side,{self:h.unit('幽魔持有者',5000,[yo]),opp:h.unit('幽魔受方',10000,[h.wait()])});
  assert.ok(!(normal.state[side+'Marks']||[]).some((m:any)=>m.id==='arena.dragonSoulMark'),'成功使用不能憑空增加無效補償印記');
  for(const hp of [2000,3000,5000]){
   // 在正式第二次出手前附加可消除的回合效果，再使用幽魔。
   const hist=await h.play(side,{self:h.unit('連鎖持有者',hp,[h.turnEffectSkill(),yo],{maxHp:5000,speed:300}),opp:h.unit('連鎖受方',20000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
   assert.equal(hist[1].self.currentHp,5000);assert.equal(hist[1].opp.currentHp,20000-(5000-hp)*(hp<2500?2:1),'按出手前HP判定翻倍，僅以實際回復量造成百分比傷害');
  }
 }
 console.log('合約修正與佔位替換：P1/P2真實能力變化、固定威力增量、全隊陣亡消逝、幽魔成功分支及實際回復連鎖、Blockly保存重載通過');
}finally{await h.close();}
