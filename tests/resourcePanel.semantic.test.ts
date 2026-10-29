import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import assert from'node:assert/strict';import{createHarness}from'./helpers/migrationHarness';
const h=await createHarness();try{
 const {MIGRATED_ARENA16_DRAGON_HEALING_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migratedArena16DragonHealingSoulKit.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');for(const e of source.kit)assert.equal(kitEntryIssue(e),null,'龍/'+e.order);
 defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{for(const e of source.kit)assert.ok(buildEntryBlock(w as any,e));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),source.kit);}finally{w.dispose();r.dispose();}
 for(const side of ['p1','p2'] as const){
  const own=h.unit('逐龍面板持有者',5000,Array.from({length:5},(_,i)=>({...h.wait(),name:'喚醒槽'+i,pp:10,maxPp:10})),{speed:300,extra:{soulMark:{...source,effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>[0,1,2,3,9,10,11,12].includes(e.order)))}}});
  const hist=await h.play(side,{self:own,selfBench:[h.unit('面板後備',5000,[h.wait()])],opp:h.unit('面板受方',20000,[h.wait()]),turns:(_e:any,t:number)=>t<=4?[t-1,0]:[{switch:1},0]},5);
  for(let i=0;i<4;i++){
   const e=hist[i].self;assert.equal(e.maxHp,5000+1250*(i+1));for(const key of ['atk','spatk','def','spdef'])assert.equal(e.calculatedStats[key],300+75*(i+1),'四龍各增加原始能力點數25%，不能每回合疊能力等級');assert.equal(e.calculatedStats.speed,300+75*(i+1));assert.deepEqual(e.statStages,{});
  }
  assert.equal(hist[0].self.currentHp,5625,'一龍回合末恢復625，臨時上限增加不冒充恢復');assert.equal(hist[1].self.currentHp,7125,'兩龍回合末恢復1500');
  assert.equal(hist[3].opp.skills[0].pp,85,'四回合原本消耗4PP，加逐龍1+2+3+4點隨機吸取');
  assert.equal(hist[3].self.skills.reduce((n:number,s:any)=>n+s.pp,0),50,'被實際吸取的PP逐點恢復自身未滿槽');
  const original=hist[4].state[side+'Team'][0];assert.equal(original.maxHp,5000);assert.equal(original.tempMaxHpBoost,0);assert.equal(original.calculatedStats.atk,300);assert.equal(original.calculatedStats.speed,300,'下場撤回臨時加成，沒有留給隊友或重複累積');
 }
 for(const side of ['p1','p2'] as const){
  const boosts:number[]=[];h.S['逐龍傷害受方']=(_c:any,event:string,data:any)=>{if(event==='BEFORE_DAMAGE'&&data?.damageComp?.isIncoming&&data.damageComp.damageCategory==='skill_attack')boosts.push(data.damageComp.increasePercent);};
  const attack=(name:string)=>({...h.wait(),name,category:'物理',power:100,pp:10,maxPp:10});
  const enemy=h.kitSkill('分類固定與真實',[{op:'dmg',p:{flat:100,type:'固定'}},{op:'dmg',p:{flat:100,type:'真實'}}]);
  const hist=await h.play(side,{self:h.unit('逐龍傷害持有者',3000,[attack('龍槽一'),attack('龍槽二')],{maxHp:5000,speed:300,extra:{soulMark:{...source,effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>[0,1,2,9,10,11].includes(e.order)))}}}),opp:h.unit('逐龍傷害受方',100000,[enemy],{speed:100}),turns:(_e:any,t:number)=>[t-1,0]},2);
  assert.deepEqual(boosts,[0.5,1],'每龍攻擊傷害加50%，當次甦醒立即讀取');
  assert.equal(hist[0].self.currentHp,2815,'一龍固定100降為85，真實100不變');assert.equal(hist[1].self.currentHp,2645,'兩龍固定100降為70，真實100不變');
 }
 console.log('逐資源面板：P1/P2四槽甦醒即時25%點數、臨時上限、能力等級不變、每龍PP吸取/實際恢復與下場撤回通過');
}finally{await h.close();}
