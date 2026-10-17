import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_TRAIT_KITS} from '../src/data/migratedTraitKits';
import {OTHERWORLD_REY_TEXT} from '../src/data/otherworldReyDescriptions';
import {readIncomingPanelAttack} from '../src/battle/panelAttack';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const actual=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5029').alienTraits.gen2Trait;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {handleOtherworldReySoulMark}=await h.server.ssrLoadModule('/src/effects/elves/otherworld-rey/registry.ts');
const trait=()=>structuredClone(actual);
const part=(t:any,orders:number[])=>({...t,kit:t.kit.filter((e:any)=>orders.includes(e.order))});
const alien=(t:any)=>t?{alienTraits:{gen2Trait:t}}:{};
const attack=(category='物理',power=100)=>({...h.wait(),name:'測試攻擊',category,power});
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
let edited:any;
try{
 await check('完整原文、正式特質Kit與Blockly保存重載；70%威力→20%、面板70%→40%、麻痺3→2可編輯',()=>{
  const def=MIGRATED_TRAIT_KITS.find(x=>x.name==='電氣纏繞')!;assert.equal(actual.description,OTHERWORLD_REY_TEXT.gen2);assert.equal(actual.effectMode,'kit');assert.deepEqual(actual.kit,def.kit);validateKit(actual.kit);defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...actual,name:'自訂電氣',kit:actual.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('mechanic')(r.getBlockById(b.id)!,e.node,e.order),e);for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'){const op=x.getFieldValue('OP'),p=JSON.parse(x.getFieldValue('PARAMS'));if(op==='power_mod')p.boost=.2;if(op==='incoming_panel_attack')p.ratio=.4;if(op==='status')p.turns=2;x.setFieldValue(JSON.stringify(p),'PARAMS');}w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('mechanic')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;})};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
  const op=(p:any,trig='incoming_power')=>[{codeId:'effect_sequence',source:'mechanic',node:'modify_power',order:0,params:{clause:{raw:'面板',trig,parsed:true,body:[{acts:[{op:'incoming_panel_attack',p,label:'面板'}]}]}}}];for(const p of [{ratio:0},{ratio:-1},{ratio:Infinity},{ratio:101},{ratio:.7,code:'假鍵'}])assert.throws(()=>validateKit(op(p) as any));assert.throws(()=>validateKit(op({ratio:.7},'outgoing_power') as any));
  const state={incomingPanelAttack:{actionId:3,attackerId:'B',ratio:.7}};assert.equal(readIncomingPanelAttack(state,{id:'A',battleId:'B'},3),.7);assert.equal(readIncomingPanelAttack(state,{id:'A',battleId:'C'},3),0);assert.equal(readIncomingPanelAttack(state,{id:'A',battleId:'B'},4),0);assert.equal(readIncomingPanelAttack(state,{id:'A',battleId:'B'}),0);
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 物理與特殊威力×1.7，編輯改名後×1.2，非附加百分比傷害`,async()=>{
   for(const cat of ['物理','特殊']){const run=async(t:any,power:number)=>(await h.play(side,{self:h.unit('S',1000000,[attack(cat,power)],{speed:200,extra:alien(t)}),opp:h.unit('E',1000000,[h.wait()])}))[0];assert.equal((await run(part(trait(),[0]),100)).opp.currentHp,(await run(null,170)).opp.currentHp);assert.equal((await run(part(edited,[0]),100)).opp.currentHp,(await run(null,120)).opp.currentHp);}
  });
  await check(`${side} 對手物理/特殊最終面板210，能力-6/0/+6均相同，編輯後120`,async()=>{
   for(const cat of ['物理','特殊'])for(const stage of [-6,0,6]){const run=async(t:any,panel:number,s:number)=>{const enemy=h.unit('E',1000000,[attack(cat)],{statStages:{atk:s,spatk:s}});enemy.calculatedStats.atk=panel;enemy.calculatedStats.spatk=panel;return (await h.play(side,{self:h.unit('S',1000000,[h.wait()],{speed:200,extra:alien(t)}),opp:enemy}))[0];};const b=await run(null,210,0),r=await run(part(trait(),[2]),300,stage);assert.equal(r.self.currentHp,b.self.currentHp);const edit=await run(part(edited,[2]),300,stage),b2=await run(null,120,0);assert.equal(edit.self.currentHp,b2.self.currentHp);}
  });
  await check(`${side} 最終面板比例不再被視為能力提升重算`,async()=>{
   const run=async(t:any,boost:number,panel:number)=>{h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState('blkStageAsBoost',boost);};try{const opp=h.unit('E',1000000,[attack()]);opp.calculatedStats.atk=panel;return (await h.play(side,{self:h.unit('S',1000000,[h.wait()],{speed:200,extra:alien(t)}),opp}))[0];}finally{delete h.S.E;}};
   assert.equal((await run(part(trait(),[2]),6,300)).self.currentHp,(await run(null,0,210)).self.currentHp);
  });
  await check(`${side} 完整特質使用屬性技能後麻痺，免疫失敗不強行附加`,async()=>{
   for(const immune of [false,true]){h.S.E=(c:any,e:any)=>{if(immune&&e===T.ON_ENTRANCE)c.setPlayerState('immuneStatusTurns',99);};try{const [r]=await h.play(side,{self:h.unit('S',1000000,[h.wait()],{speed:200,extra:alien(trait())}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(h.statuses(r.opp).includes('麻痺'),!immune);}finally{delete h.S.E;}}
  });
  await check(`${side} 受方換下場不把面板比例借給替補，回場重新計算本次`,async()=>{
   const run=async(t:any,panel:number)=>{const opp=h.unit('E',1000000,[attack()]);opp.calculatedStats.atk=panel;return h.play(side,{self:h.unit('S',1000000,[h.wait()],{speed:200,extra:alien(t)}),selfBench:[h.unit('B',1000000,[h.wait()])],opp,turns:(_,t)=>[t===2?{switch:1}:t===3?{switch:0}:0,0]},3);};
   const r=await run(part(trait(),[2]),300),baseline=await run(null,210),normal=await run(null,300);
   assert.equal(r[0].self.currentHp,baseline[0].self.currentHp);
   assert.equal(r[2].self.currentHp,baseline[2].self.currentHp);
   assert.equal(r[1].self.currentHp,normal[1].self.currentHp);
  });
  await check(`${side} 舊雷伊魂印威力/面板/麻痺分支遇Kit不重播`,async()=>{
   let received=0;h.S.E=(_:any,e:any)=>{if(e===T.SELF_STATUS_APPLIED)received++;};h.S.S=(c:any,e:any,d:any)=>{if([T.BEFORE_ACTION,T.AFTER_ACTION,T.OPPONENT_ACTION].includes(e))handleOtherworldReySoulMark(c,e,d);};try{const [r]=await h.play(side,{self:h.unit('S',1000000,[attack()],{speed:200,extra:alien({...trait(),name:'renamed'})}),opp:h.unit('E',1000000,[h.wait()])});const damage=1000000-r.opp.currentHp;delete h.S.S;delete h.S.E;const [b]=await h.play(side,{self:h.unit('S',1000000,[attack('物理',170)],{speed:200}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(damage,1000000-b.opp.currentHp);assert.equal(received,1);assert.equal(r.state[side+'RegistryState'].opponentAtkPanelRatio||0,0);}finally{delete h.S.S;delete h.S.E;}
  });
 }
 console.log(`電氣纏繞 ${checks} 項通過，未授予所有雷伊定義全文驗收`);
}finally{await h.close();}
process.exit(0);
