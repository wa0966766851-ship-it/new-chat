import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
const {BATTLE_ITEMS}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
const group={id:'test_conversion',limit:7};
const normal={id:'test_conversion_normal',name:'測試普通道具',description:'測試',type:'special',grantOnly:true,holdLimit:7,inventoryGroup:group};
const forms=Array.from({length:7},(_,i)=>({...normal,id:`test_conversion_${i}`,holdLimit:1}));
BATTLE_ITEMS.push(normal,...forms);
try {
 const {createBattleItemInventory,grantBattleItem,convertBattleItem,consumeBattleItem}=await h.server.ssrLoadModule('/src/battle/itemInventory.ts');
 const {authoredEntry:e,actions:act,operation:a}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const ids=forms.map(f=>f.id);
 const count=(inv:any)=>[normal,...forms].reduce((n,f)=>n+(inv[f.id]?.left||0),0);
 let inv=grantBattleItem(createBattleItemInventory(),normal.id,7);
 const original=structuredClone(inv);
 assert.equal(grantBattleItem(inv,ids[0],1),undefined,'不同形態共用七個上限');
 for(let i=0;i<7;i++) {
  inv=convertBattleItem(inv,normal.id,ids);
  assert.equal(inv[normal.id].left,6-i);
  assert.equal(inv[ids[i]].left,1,'每次只轉化一個且按既定順序');
  assert.equal(count(inv),7);
 }
 assert.deepEqual(original[normal.id],{left:7,max:7,snapshot:undefined},'轉化不寫穿輸入');
 assert.equal(convertBattleItem(inv,normal.id,ids),undefined,'來源耗盡不能憑空轉化');
 assert.equal(grantBattleItem(inv,normal.id,1),undefined,'七個特殊形態已滿時不能補成第八個');
 inv=consumeBattleItem(inv,ids[2]);inv=grantBattleItem(inv,normal.id,1);
 inv=convertBattleItem(inv,normal.id,ids);
 assert.equal(inv[ids[2]].left,1,'跳過不能轉化的形態，繞回補上可用形態');
 assert.equal(count(inv),7);
 let blocked=grantBattleItem(createBattleItemInventory(),normal.id,1);
 for(const f of forms)blocked=grantBattleItem(blocked,f.id,1)||blocked;
 const before=structuredClone(blocked);
 // 所有候選滿額時，來源不能被先扣除。
 assert.equal(convertBattleItem(blocked,normal.id,ids.slice(0,6)),undefined);
 assert.deepEqual(blocked,before);
 assert.equal(convertBattleItem(blocked,normal.id,['unknown']),undefined);
 assert.equal(convertBattleItem(blocked,normal.id,[ids[0],ids[0]]),undefined);
 defineCustomBlocks();
 const grant=e('開戰放入七個道具','battle_start',[act(a('grant_item',{side:'opp',itemId:normal.id,count:7}))],0,'soulmark');
 const convert=e('每次登場轉化一個','entrance',[act(a('convert_item',{side:'opp',fromId:normal.id,ids:ids}))],1,'soulmark');
 assert.equal(sequenceIssue(convert.params.clause,convert.node),null);
 assert.ok(sequenceIssue({...convert.params.clause,body:[act(a('convert_item',{side:'opp',fromId:normal.id,ids:[normal.id]}))]},convert.node));
 const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
 try {
  assert.ok(buildEntryBlock(ws as any,convert));
  Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
  assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(convert.source)(b,convert.node,convert.order)),[convert]);
 } finally {ws.dispose();reload.dispose();}
 for(const side of ['p1','p2'] as const) {
  const mark={name:'測試加入與轉化',effectMode:'kit',kit:[grant,convert]};
  const mk=(id:string)=>h.unit(id,10000,[h.wait()],{extra:{soulMark:mark}});
  const rows=await h.play(side,{self:mk('source'),selfBench:[mk('second')],opp:h.unit('enemy',10000,[h.wait()]),turns:(_e:any,t:number)=>t===2?[{switch:1},0]:[0,0]},2);
  const other=side==='p1'?'p2':'p1';
  const first=rows[0].state[other+'ItemInventory'],second=rows[1].state[other+'ItemInventory'];
  assert.equal(first[normal.id].left,6);assert.equal(first[ids[0]].left,1);
  assert.equal(second[normal.id].left,5);assert.equal(second[ids[1]].left,1,'換人後從正式陣營庫存繼續次序');
  assert.equal(count(second),7);assert.equal(rows[1].state[side+'ItemInventory'][normal.id].left,0,'不加到錯方');
 }
 console.log('itemConversion passed: group limit, atomic conversion, ordered skip, P1/P2 and Blockly');
} finally {
 BATTLE_ITEMS.splice(BATTLE_ITEMS.indexOf(normal),8);
 await h.close();
}
