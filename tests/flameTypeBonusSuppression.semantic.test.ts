import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {IMMORTAL_AINS_FLAME_LIFECYCLE_KIT,IMMORTAL_AINS_FLAME_ENEMY_KIT} from '../src/data/immortalAinsFlameKit';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
const soul=(kit:any[])=>({name:'神焰敵方燒傷',description:'已核對正式片段',effectMode:'kit',effectType:'custom',kit});
try{
 defineCustomBlocks();
 for(const e of IMMORTAL_AINS_FLAME_ENEMY_KIT){
  assert.equal(sequenceIssue(e.params.clause,e.node),null);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{buildEntryBlock(w as any,e);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('soulmark')(r.getTopBlocks(false)[0],e.node,e.order),e);}finally{w.dispose();r.dispose();}
 }
 const {calculateDamage}=await h.server.ssrLoadModule('/src/utils/damageCalculator.ts');
 const actor=h.unit('攻方',10000,[h.wait()],{type:'火'}),target=h.unit('受方',10000,[h.wait()],{type:'草'});
 const skill={...h.wait(),category:'物理',power:100,type:'火',resolvedForceStab:true};
 const mark={id:'test',name:'限制',displayChar:'封',description:'限制',source:'test',count:1,scope:'elf',ownerBattleId:'攻方',effects:{stabDisabled:1,typeAdvantageDisabled:1}};
 const calc=(marks:any[],type='草')=>calculateDamage(actor,{...target,type},skill,'p1',undefined,undefined,1,false,[],[],{},undefined,undefined,{}, {},marks,[]);
 const capped=calc([mark]),normal=calc([]);
 assert.equal(normal.typeMultiplier,2);assert.equal(capped.typeMultiplier,1);
 assert.equal(normal.damage,capped.damage*3,'同系1.5×克制2均移除，連強制本系也不能繞過');
 assert.equal(calc([mark],'水').typeMultiplier,0.5,'不能把微弱改成普通');
 assert.equal(calc([mark],'聖靈').typeMultiplier,calc([],'聖靈').typeMultiplier,'保留原始非克制倍率');
 assert.equal(calc([{...mark,ownerBattleId:'其他'}]).damage,normal.damage,'不影響錯誤持有者');
 for(const side of ['p1','p2'] as const){
  async function run(enabled:boolean,bench=false,status='燒傷',dead=false){
   const kit=enabled?[...IMMORTAL_AINS_FLAME_LIFECYCLE_KIT.filter(e=>e.node==='battle_start'),...IMMORTAL_AINS_FLAME_ENEMY_KIT]:[];
   if(dead)kit.push({codeId:'effect_sequence',source:'soulmark',role:'innate',node:'battle_start',order:1,customText:'測試擊殺神焰',params:{clause:{raw:'測試擊殺神焰',trig:'battle_start',parsed:true,body:[{acts:[{op:'kill_owned_extra',p:{id:'x_immortal_flame'},label:'擊殺'}]}]}}});
   const burn=h.kitSkill('正式異常附加',[{op:'status',p:{side:'opp',status,chance:100,turns:3}}]);
   const source=h.unit('來源',100000,[burn,h.wait()],{speed:200,type:'草',extra:{soulMark:soul(kit)}});
   const active=bench?h.unit('前排',100000,[burn,h.wait()],{speed:200,type:'草'}):source;
   const attack={...h.wait(),name:'火系攻擊',type:'火',category:'物理',power:100};
   const result=await h.play(side,{self:active,selfBench:bench?[source]:[],opp:h.unit('敵方',100000,[attack],{type:'火'}),turns:(_e,t)=>[t===1?0:1,0]},2);
   return result.map((r:any,i:number)=>((i?result[i-1].self.currentHp:100000)-r.self.currentHp));
  }
  const base=await run(false),live=await run(true),bench=await run(true,true);
  assert.ok(base[0]>=live[0]*2.9&&base[0]<=live[0]*3.1,`${side} 第一回合確實取消本系與克制：${base}/${live}`);
  assert.equal(live[1],base[1],'1回合限制正常到期，不多留一回合');
  assert.deepEqual(bench,live,'後排召喚者仍可監控敵方燒傷');
  assert.deepEqual(await run(true,false,'燒傷',true),base,'神焰已死不能施加限制');
  assert.deepEqual(await run(true,false,'中毒'),await run(false,false,'中毒'),'非燒傷不觸發');
  console.log(`✓ ${side} 敵方成功燒傷、後排監控、實際傷害、單回合到期、死亡及其他異常隔離`);
 }
}finally{await h.close();}
