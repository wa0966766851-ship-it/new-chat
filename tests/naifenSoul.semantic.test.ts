import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {NAIFEN_SOUL_KIT:kit}=await h.server.ssrLoadModule('/src/data/naifenSoulKit.ts');
 const {NAIFEN_GRASS_ID:normal,NAIFEN_FORM_IDS:ids,NAIFEN_FORMS:forms,NAIFEN_ELF_ID}=await h.server.ssrLoadModule('/src/data/naifenItems.ts');
 const {NAIFEN_FINALE:finale}=await h.server.ssrLoadModule('/src/data/naifenSkills.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const {authoredEntry:e,actions:act,operation:a}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 defineCustomBlocks();
 for(const entry of [...kit,...forms.flatMap((f:any)=>[...f.heldKit,...f.useKit.normal,...f.useKit.backlash])]){
  assert.equal(sequenceIssue(entry.params.clause,entry.node),null,entry.customText);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}
 }
 const own=(id:string,kit:any[],skills:any[]=[])=>h.unit(id,100000,skills.length?skills:[h.wait()],{speed:200,extra:{soulMark:{name:'奈尼芬多魂印',effectMode:'kit',kit}}});
 const immune=e('開戰控制免疫','battle_start',[act(a('immune_status_turns',{turns:10,cls:'控制類',reflect:false}))],0,'soulmark');
 for(const side of ['p1','p2'] as const){
  const rows=await h.play(side,{self:own('S',kit),selfBench:[own('T',kit)],opp:h.unit('E',100000,[h.wait()],{extra:{soulMark:{name:'控制免疫',effectMode:'kit',kit:[immune]}}}),turns:(_engine:any,t:number)=>t===2?[{switch:1},0]:[0,0]},2);
  const oppSide=side==='p1'?'p2':'p1';
  assert.equal(rows[0].state[oppSide+'ItemInventory'][normal].left,6);
  assert.equal(rows[0].state[oppSide+'ItemInventory'][ids[0]].left,1);
  assert.equal(rows[1].state[oppSide+'ItemInventory'][normal].left,5);
  assert.equal(rows[1].state[oppSide+'ItemInventory'][ids[1]].left,1,'每次登場一株並保留陣營轉化順序');
  assert.ok(rows[0].self.battleStatuses.星佑>0,'依序附加失敗的補償');
  const attack={...h.wait(),name:'小威力實際攻擊',category:'物理',power:10};
  const noControl=kit.filter((entry:any)=>entry.order!==3);
  const [low]=await h.play(side,{self:own('S',noControl,[attack]),opp:h.unit('E',100000,[attack])});
  assert.equal(ids.reduce((n:number,id:string)=>n+low.state[oppSide+'ItemInventory'][id].left,0),3,'登場一株加雙方低於300原始攻擊各一株');
  const grantAll=e('測試敵方實際持有七種形態','battle_start',ids.map((itemId:string)=>act(a('grant_item',{side:'opp',itemId,count:1}))),0,'soulmark');
  for(const star of [false,true]){
   const self=own(NAIFEN_ELF_ID,[grantAll],[finale]);
   if(star){self.battleStatuses={星佑:3};self.effects=[{id:'星佑',name:'星佑',duration:3,stacks:1}];}
   const [r]=await h.play(side,{self,opp:h.unit('E',10000,[h.wait()])});
   for(const id of ids)assert.equal(r.state[oppSide+'ItemInventory'][id].left,star?1:0,'依原文階層，普通物理轉化分支才依序代對方使用');
   if(!star){
    const uses=r.logs.filter((s:string)=>s.includes('使用了【極樂·'));
    assert.deepEqual(uses.map((s:string)=>forms.findIndex((f:any)=>s.includes(`【${f.name}】`))),[0,1,2,3,4,5,6]);
    assert.ok(r.opp.currentHp<=10000-7*575,'各株獨立套用15%藥劑代價');
   }
  }
 }
 console.log('naifenSoul passed: complete Kit/save-reload, entrance one-at-a-time, partial failure, both raw-damage conversions and actual ordered item consumption');
}finally{await h.close();}
