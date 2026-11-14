import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
const {BATTLE_ITEMS}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
const item={id:'test_snapshot_amulet',name:'測試護符',description:'僅測試加入時紀錄',type:'special',grantOnly:true,holdLimit:1};
BATTLE_ITEMS.push(item);
try{
 const {createBattleItemInventory,grantBattleItem,consumeBattleItem,readBattleItem}=await h.server.ssrLoadModule('/src/battle/itemInventory.ts');
 const {itemUseOperations,itemUseActionIssue,itemUseConditionIssue}=await h.server.ssrLoadModule('/src/blocks/ops/itemUse.ts');
 const {evalCond}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const snapshot={sourceBattleId:'source',stats:{hp:5000,atk:100,def:200,spatk:300,spdef:400,speed:500}};
 const initial=createBattleItemInventory();
 assert.deepEqual(initial[item.id],{left:0,max:1});
 const first=grantBattleItem(initial,item.id,1,snapshot);
 assert.equal(first[item.id].left,1);assert.equal(first[item.id].snapshot.stats.spatk,300);
 snapshot.stats.spatk=999;
 assert.equal(first[item.id].snapshot.stats.spatk,300,'來源後續改值不得改動紀錄');
 assert.equal(grantBattleItem(first,item.id,1,snapshot),undefined,'已滿時不能假成功或改寫紀錄');
 const copy=readBattleItem(first,item.id);copy.left=0;copy.snapshot.stats.spatk=1;
 assert.equal(first[item.id].left,1);assert.equal(first[item.id].snapshot.stats.spatk,300,'讀取副本不可寫穿庫存');
 const used=consumeBattleItem(first,item.id);
 const renewed=grantBattleItem(used,item.id,1,snapshot);
 assert.equal(renewed[item.id].snapshot.stats.spatk,999,'用完重發才採新的加入時紀錄');
 assert.equal(grantBattleItem(used,item.id,1)[item.id].snapshot,undefined,'沒有要求紀錄的新道具不得繼承上一次紀錄');
 assert.equal(createBattleItemInventory()[item.id].snapshot,undefined,'新戰鬥不保留上次紀錄');
 const heldCond={c:'held_item',p:{side:'self',itemId:item.id,neg:false},label:'持有護符'};
 const absentCond={...heldCond,p:{...heldCond.p,neg:true}};
 let liveInventory=first;
 const queryCtx:any={actor:'p1',targetSide:'p2',getBattleItem:(side:string,id:string)=>readBattleItem(side==='p1'?liveInventory:initial,id)};
 assert.equal(itemUseConditionIssue(heldCond),null);
 assert.ok(itemUseConditionIssue({...heldCond,p:{...heldCond.p,neg:'yes'}}));
 assert.equal(evalCond(queryCtx,heldCond,{}),true);assert.equal(evalCond(queryCtx,absentCond,{}),false);
 liveInventory=used;
 assert.equal(evalCond(queryCtx,heldCond,{}),false);assert.equal(evalCond(queryCtx,absentCond,{}),true,'消耗後即時讀實際庫存');
 assert.equal(evalCond({actor:'p1',targetSide:'p2'} as any,absentCond,{}),false,'缺少讀取管道不能冒充未持有');
 for(const count of [0,-1,Infinity,NaN,1.5])assert.equal(grantBattleItem(initial,item.id,count),undefined);
 const ordinary=BATTLE_ITEMS.find((i:any)=>!i.grantOnly&&i.type==='hp');
 const plain={...initial,[ordinary.id]:{left:98,max:100}};
 assert.equal(grantBattleItem(plain,ordinary.id,3)[ordinary.id].left,100,'普通藥劑既有100上限保留');
 assert.equal(grantBattleItem(undefined,item.id,500,snapshot)[item.id].left,1,'未建庫存的模式也遵守單項上限');
 const op={op:'grant_item',label:'',p:{side:'self',itemId:item.id,count:1,snapshotStats:true}};
 assert.equal(itemUseActionIssue(op.op,op.p),null);
 assert.ok(itemUseActionIssue(op.op,{...op.p,count:.5}));
 assert.ok(itemUseActionIssue(op.op,{...op.p,snapshotStats:'true'}));
 // 離場來源使用自己最新面板，不是當前在場隊友的面板。
 let captured:any;
 const source={id:'bench',battleId:'bench-real',maxHp:4321,calculatedStats:{hp:4321,atk:11,def:22,spatk:333,spdef:44,speed:55}};
 assert.equal(itemUseOperations().grant_item({actor:'p1',targetSide:'p2',self:{...source,calculatedStats:{...source.calculatedStats,spatk:1}},getFullTeam:()=>[source],grantBattleItem:(...args:any[])=>{captured=args;return true;}} as any,op.p),true);
 assert.equal(captured[3].stats.spatk,333);assert.equal(captured[3].sourceBattleId,'bench-real');
 defineCustomBlocks();
 for(const sourceSide of ['p1','p2'] as const)for(const ownGrant of ['self','opp']){
  const side=ownGrant==='self'?sourceSide:sourceSide==='p1'?'p2':'p1';
  const entry={codeId:'effect_sequence',source:'soulmark',node:'battle_start',order:0,params:{clause:{raw:'未持有時加入測試護符並紀錄能力',trig:'battle_start',parsed:true,cond:[{...absentCond,p:{...absentCond.p,side:ownGrant}}],body:[{acts:[{...op,p:{...op.p,side:ownGrant}}]}]}}};
  assert.equal(sequenceIssue(entry.params.clause,entry.node),null);
  const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(ws as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{ws.dispose();reload.dispose();}
  const [round]=await h.play(sourceSide,{self:h.unit('source',5000,[h.wait()],{maxHp:6000,extra:{calculatedStats:{...snapshot.stats,hp:6000,spatk:777},soulMark:{name:'紀錄',effectMode:'kit',kit:[entry]}}}),opp:h.unit('other',10000,[h.wait()])});
  const inventory=round.state[`${side}ItemInventory`];
  assert.equal(inventory[item.id].left,1,`${side}正式開戰事件須寫進實際道具欄`);
  assert.equal(inventory[item.id].snapshot.stats.spatk,777);
  assert.equal(inventory[item.id].snapshot.stats.hp,6000);
  assert.equal(inventory[item.id].snapshot.sourceBattleId,'source');
  const other=side==='p1'?'p2':'p1';assert.equal(round.state[`${other}ItemInventory`][item.id].left,0,'不能加到另一方');
 }
 for(const side of ['p1','p2'] as const){
  const entry={codeId:'effect_sequence',source:'soulmark',node:'battle_start',order:0,params:{clause:{raw:'板凳加入護符並紀錄自身能力',trig:'battle_start',parsed:true,body:[{acts:[op]}]}}};
  const bench=h.unit('benchSource',2500,[h.wait()],{maxHp:7000,extra:{calculatedStats:{...snapshot.stats,hp:7000,spatk:888},soulMark:{name:'板凳紀錄',effectMode:'kit',kit:[entry]}}});
  const [round]=await h.play(side,{self:h.unit('active',5000,[h.wait()]),selfBench:[bench],opp:h.unit('enemy',10000,[h.wait()])});
  const held=round.state[`${side}ItemInventory`][item.id];
  assert.equal(held.left,1);assert.equal(held.snapshot.sourceBattleId,'benchSource');assert.equal(held.snapshot.stats.spatk,888,'正式板凳開戰事件使用板凳來源面板');
 }
 console.log('itemGrantSnapshot passed');
}finally{BATTLE_ITEMS.splice(BATTLE_ITEMS.indexOf(item),1);await h.close();}
