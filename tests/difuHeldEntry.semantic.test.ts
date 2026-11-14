import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {DIFU_AMULET:item,DIFU_AMULET_ID:id}=await h.server.ssrLoadModule('/src/data/difuItem.ts');
 const {DIFU_READY_SOUL_KIT:kit}=await h.server.ssrLoadModule('/src/data/difuSoulKit.ts');
 const {heldBattleItemProgramIssue,runHeldBattleItemPrograms}=await h.server.ssrLoadModule('/src/effects/battleItemProgram.ts');
 const {EffectTiming}=await h.server.ssrLoadModule('/src/effects/types.ts');
 const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 assert.equal(heldBattleItemProgramIssue(item),null);
 assert.ok(heldBattleItemProgramIssue({...item,heldKit:item.useKit.normal}));
 defineCustomBlocks();
 for(const entry of item.heldKit){
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}
 }
 for(const side of ['p1','p2'] as const){
  const source=(skills:any[]= [h.wait()])=>h.unit('source',2000,skills,{maxHp:5000,speed:200,extra:{soulMark:{name:'開戰護符',effectMode:'kit',kit:[kit[0]]}}});
  const [start]=await h.play(side,{self:source(),opp:h.unit('enemy',10000,[h.wait()])});
  assert.equal(start.self.battleStatuses.山神守護,3,'首發正常取得守護');
  for(const guarded of [false,true]){
   const bench=h.unit('ally',5000,[h.wait()],{extra:guarded?{battleStatuses:{山神守護:4},effects:[{id:'山神守護',name:'山神守護',duration:4,stacks:1}]}:{}});
   const [switched]=await h.play(side,{self:source(),selfBench:[bench],opp:h.unit('enemy',10000,[h.wait()]),turns:()=>[{switch:1},0]});
   assert.equal(switched.self.id,'ally');
   assert.equal(switched.self.battleStatuses.山神守護,guarded?7:3,'切換隊友取得／延長，僅執行一次');
  }
  const kill=h.kitSkill('雙方真傷',[{op:'dmg',p:{both:true,flat:10000,type:'真實'}}]);
  const rows=await h.play(side,{self:source([kill]),selfBench:[h.unit('ally',5000,[h.wait()])],opp:h.unit('enemy',100000,[h.wait()]),turns:(_e:any,t:number)=>t===2?[{switch:1},0]:[0,0]},2);
  assert.equal(rows[0].self.currentHp,0,'前提：來源陣亡');
  assert.equal(rows[1].self.id,'ally');assert.equal(getStatuses(rows[1].self).山神守護,3,'來源陣亡後庫存仍持有，隊友照常取得');
 }
 // 附加失敗分支：只調整實際道具紀錄來源的同種精靈，不改物攻、不更動加入時快照。
 for(const side of ['p1','p2'] as const){
  const source=h.unit('species',1000,[h.wait()],{extra:{battleId:'source-real'}}),copy={...structuredClone(source),battleId:'copy-real'},ally=h.unit('ally',1000,[h.wait()]);
  let team=[source,copy,ally],calls=0;
  const snapshot={sourceBattleId:'source-real',sourceElfId:'species',stats:{...source.calculatedStats,hp:source.maxHp}};
  const other=side==='p1'?'p2':'p1',enemy=h.unit('enemy',10000,[h.wait()]);
  const ctx:any={actor:side,targetSide:other,self:ally,target:enemy,activeP1:side==='p1'?ally:enemy,activeP2:side==='p2'?ally:enemy,roundNumber:1,
   getBattleItem:(_side:string,itemId:string)=>itemId===id?({left:1,max:1,snapshot}):undefined,getFullTeam:(s:string)=>s===side?team:[enemy],getStatuses:()=>({}),getPlayerState:()=>undefined,getOpponentState:()=>undefined,
   applyStatusWithImmunityCheck:()=>{calls++;return {success:false,immune:true};},updateAnyElf:(_s:string,bid:string,patch:any)=>{team=team.map(e=>(e.battleId||e.id)===bid?{...e,...patch}:e);},addLog:()=>{},
  };
  runHeldBattleItemPrograms(ctx,EffectTiming.ON_ENTRANCE);
  assert.equal(calls,1);
  for(const e of team.slice(0,2)){assert.equal(e.calculatedStats.atk,300);assert.equal(e.calculatedStats.spatk,345);assert.equal(e.maxHp,1150);assert.equal(e.currentHp,1000);}
  assert.equal(team[2].maxHp,1000);assert.equal(snapshot.stats.spatk,300,'加入時紀錄保持不變');
  team=team.filter(e=>e.battleId!=='source-real');runHeldBattleItemPrograms(ctx,EffectTiming.ON_ENTRANCE);
  assert.equal(team[0].calculatedStats.spatk,396,'來源個體移除後仍依紀錄的種族身分作用');
  calls=0;ctx.getBattleItem=()=>({left:0,max:1,snapshot});runHeldBattleItemPrograms(ctx,EffectTiming.ON_ENTRANCE);assert.equal(calls,0,'消耗完即停用');
 }
 console.log('difuHeldEntry passed');
}finally{await h.close();}
