import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
const h=await createHarness();
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
try{
 const actual=structuredClone(h.find('5021','閱世'));
 const entry=actual.kit.find((e:any)=>e.params.property==='ignore_positive_priority');
 assert.ok(entry);validateKit(actual.kit);defineCustomBlocks();
 const w=new Blockly.Workspace(),r=new Blockly.Workspace();
 try{const b=buildEntryBlock(w as any,entry)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,entry.node,entry.order),entry);}
 finally{w.dispose();r.dispose();}
 for(const patch of [{value:false},{value:1},{extra:'script'}])assert.throws(()=>validateKit([{...entry,params:{...entry.params,...patch}}]));
 assert.throws(()=>validateKit([{...entry,node:'before_action'}]));
 console.log('✓ 固有先制合約、Blockly保存重載及非法參數拒絕');
 for(const side of ['p1','p2'] as const){
  const run=async(awake:boolean,priority:number,options:{sealed?:boolean;two?:boolean;edited?:boolean}={})=>{
   const skill=structuredClone(actual),seen:string[]=[];
   if(options.edited){skill.name='自訂排序';skill.kit=[{...structuredClone(entry),params:{...entry.params,conditions:[]}}];}
   h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE){c.setPlayerState('dimensionalDragonSoul',awake);if(options.sealed)c.updateElf(c.actor,{isInherentInvalid:true});}if(e===T.BEFORE_ACTION)seen.push('S');};
   h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)seen.push('E');};
   const result=await h.play(side,{self:h.unit('S',100000,[skill,h.wait()],{speed:90}),opp:h.unit('E',100000,[{...h.wait(),priority}],{speed:200}),turns:(_,t)=>[t===2?1:0,0]},options.two?2:1);
   return {seen,result};
  };
  assert.equal((await run(true,5)).seen[0],'S',`${side} 龍魂閱世必須在排序時無視正先制`);
  assert.equal((await run(false,5)).seen[0],'E');
  assert.equal((await run(true,5,{sealed:true})).seen[0],'E');
  assert.equal((await run(false,5,{edited:true})).seen[0],'S');
  assert.deepEqual((await run(true,5,{two:true})).seen,['S','E','E','S']);
  for(const prio of [0,-2]){
   const {result}=await run(true,prio),opp=side==='p1'?'p2':'p1';
   assert.equal(result[0].state[opp+'RegistryState'].actionPriorityThisTurn,prio);
  }
  console.log(`✓ ${side} 龍魂/未覺醒/固有封印/改名改條件/下回合不借用/零及負先制保留`);
 }
}finally{delete h.S.S;delete h.S.E;await h.close();}
process.exit(0);
