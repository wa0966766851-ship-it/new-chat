import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {DIFU_AMULET:item,DIFU_AMULET_ID:id}=await h.server.ssrLoadModule('/src/data/difuItem.ts');
 const {battleItemProgramIssue}=await h.server.ssrLoadModule('/src/effects/battleItemProgram.ts');
 const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
 const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 const {extraElfLifecycleOperations}=await h.server.ssrLoadModule('/src/blocks/ops/extraElfLifecycle.ts');
 const {advanceStatusEffect}=await h.server.ssrLoadModule('/src/battle/statusLifecycle.ts');
 const {itemRetainsStatusDuration,createBattleItemInventory,grantBattleItem,consumeBattleItem}=await h.server.ssrLoadModule('/src/battle/itemInventory.ts');
 assert.equal(battleItemProgramIssue(item),null);
 assert.ok(battleItemProgramIssue({...item,useKit:{normal:item.useKit.normal,backlash:[]}}));
 const inventory=grantBattleItem(createBattleItemInventory(),id,1);
 assert.equal(itemRetainsStatusDuration(inventory,'山神守護'),true);
 assert.equal(itemRetainsStatusDuration(consumeBattleItem(inventory,id),'山神守護'),false);
 assert.equal(itemRetainsStatusDuration(inventory,'害怕'),false);
 assert.equal(advanceStatusEffect({id:'山神守護',name:'山神守護',duration:3},{},()=>0,false,true).next.duration,3);
 assert.equal(advanceStatusEffect({id:'山神守護',name:'山神守護',duration:3},{星贖:2},()=>0,false,true).next.duration,4,'保留期限不妨礙其他正式延長效果');
 defineCustomBlocks();
 for(const entry of [...item.useKit.normal,...item.useKit.backlash]){
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}
 }
 const grant={codeId:'effect_sequence',node:'battle_start',source:'soulmark',order:0,params:{clause:{raw:'取得護符',trig:'battle_start',parsed:true,body:[{acts:[{op:'grant_item',label:'grant_item',p:{side:'self',itemId:id,count:1,snapshotStats:true}}]}]}}};
 for(const side of ['p1','p2'] as const)for(const guarded of [false,true]){
  // 無守護分支在首次登場之後才取得護符，避免持有道具的入場效果提前給守護。
  const lateGrant:any=structuredClone(grant);lateGrant.node='round_end';lateGrant.params.clause.trig='round_end';lateGrant.params.clause.cond=[{c:'player_state',p:{key:'fixtureGranted',equals:true,neg:true},label:'只加入一次'}];lateGrant.params.clause.body.push({acts:[{op:'flag_set',p:{key:'fixtureGranted',value:true},label:'紀錄'}]});
  const source=h.unit('S',1000,[{...h.wait(),pp:guarded?1:2,maxPp:30}],{maxHp:5000,speed:200,extra:{soulMark:{name:'取得護符',effectMode:'kit',kit:[guarded?grant:lateGrant]},...(guarded?{battleStatuses:{山神守護:3}}:{})}});
  const opp=h.unit('E',10000,[h.wait()],{speed:100});
  const p1=side==='p1'?source:opp,p2=side==='p2'?source:opp;
  const engine=createBattleEngine({initialP1Team:[p1],initialP2Team:[p2],p1StarterId:p1.id,p2StarterId:p2.id,battleMode:'PVP',preparedTeams:true,isFast:()=>true});
  try{
   engine.mount();engine.start();await engine.idle();
   if(!guarded){const st=engine.getState();engine.onSkillSelect('p1',st.p1.skills[0]);engine.onSkillSelect('p2',st.p2.skills[0]);await engine.idle();}
   assert.equal(engine.getState()[`${side}ItemInventory`][id].left,1);
   // 真正的道具選擇入口；另一方正常出技能。
   if(side==='p1')engine.onUseItem('p1',item);else engine.onSkillSelect('p1',engine.getState().p1.skills[0]);
   if(side==='p2')engine.onUseItem('p2',item);else engine.onSkillSelect('p2',engine.getState().p2.skills[0]);
   await engine.idle();const st=engine.getState(),self=st[side];
   assert.equal(st[`${side}ItemInventory`][id].left,0,'實際消耗護符');
   assert.equal(self.currentHp,1500,'直接增加500當前體力');assert.equal(self.skills[0].pp,21,'每個技能補20PP，未消耗技能PP');
   assert.equal(self.shield||0,guarded?150:0);assert.equal(self.barrier||0,guarded?150:0,'僅原本已持有守護時給盾罩');
   assert.ok(getStatuses(self)['山神守護']>=(guarded?5:2));
   assert.equal(st[`${side}RegistryState`].fieldEntryTurn,guarded?2:3,'起算回合讀取端同步重設');
  }finally{engine.unmount();}
 }
 // 通用重設要同步兩個正式讀取端，且精確指定我方／敵方。
 const writes:any[]=[];
 const ctx:any={actor:'p1',targetSide:'p2',roundNumber:8,setPlayerState:(k:string,v:any)=>writes.push(['p1',k,v]),setOpponentState:(k:string,v:any)=>writes.push(['p2',k,v])};
 const ops=extraElfLifecycleOperations({runAct:()=>{},killExtraElf:()=>false});ops.reset_field_rounds(ctx,{side:'opp'});
 assert.deepEqual(writes,[['p2','p2_turnsInBattle',0],['p2','fieldEntryTurn',9]]);
 for(const side of ['p1','p2'] as const){
  const holder=(extra:any={})=>h.unit('S',1000,[{...h.wait(),pp:25,maxPp:30}],{maxHp:5000,speed:200,extra:{soulMark:{name:'護符持有',effectMode:'kit',kit:[grant]},battleStatuses:{山神守護:3},effects:[{id:'山神守護',name:'山神守護',duration:3,stacks:1}],...extra}});
  // 原有3回合守護在登場延長成6，持有三回合都保持6，不改成BOSS類。
  const still=await h.play(side,{self:holder(),opp:h.unit('E',10000,[h.wait()])},3);
  assert.deepEqual(still.map((r:any)=>getStatuses(r.self)['山神守護']),[6,6,6],JSON.stringify(still.map((r:any)=>({logs:r.logs,statuses:r.self.battleStatuses,effects:r.self.effects,inv:r.state[`${side}ItemInventory`][id]}))));
  // 持有不妨礙累計兩次技能傷害解除；使用普通物理技能，確實走技能命中結算。
  const hit={...h.wait(),name:'物理受擊',category:'物理',power:10,priority:3};
  const hits=await h.play(side,{self:holder(),opp:h.unit('E',10000,[hit])},2);
  assert.equal(getStatuses(hits[0].self)['山神守護'],6);
  assert.equal(getStatuses(hits[1].self)['山神守護']||0,0,'兩次技能受擊仍解除守護');
  // 藥劑反噬走同一庫存與道具入口：傷害500、PP扣20、只解除指定守護。
  const source=holder({potionBacklashTurns:3,battleStatuses:{山神守護:3,星佑:3},effects:[{id:'山神守護',name:'山神守護',duration:3,stacks:1},{id:'星佑',name:'星佑',duration:3,stacks:1}]}),opp=h.unit('E',10000,[h.wait()]);
  const p1=side==='p1'?source:opp,p2=side==='p2'?source:opp;
  const engine=createBattleEngine({initialP1Team:[p1],initialP2Team:[p2],p1StarterId:p1.id,p2StarterId:p2.id,battleMode:'PVP',preparedTeams:true,isFast:()=>true});
  try{
   engine.mount();engine.start();await engine.idle();
   if(side==='p1')engine.onUseItem('p1',item);else engine.onSkillSelect('p1',engine.getState().p1.skills[0]);
   if(side==='p2')engine.onUseItem('p2',item);else engine.onSkillSelect('p2',engine.getState().p2.skills[0]);
   await engine.idle();const st=engine.getState();
   assert.equal(st[side].currentHp,500);assert.equal(st[side].skills[0].pp,5);
   assert.equal(getStatuses(st[side])['山神守護']||0,0);assert.ok(getStatuses(st[side])['星佑']>0,'不解除無關異常');
   assert.equal(st[`${side}ItemInventory`][id].left,0);
  }finally{engine.unmount();}
 }
 console.log('difuItem passed');
}finally{await h.close();}
