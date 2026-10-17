import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {createHarness} from './helpers/migrationHarness';
import {checkedPercentDrain} from '../src/effects/checkedDrain';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const make=(ratio=.5,failTrue=210)=>h.kitSkill('結算吸取',[{op:'checked_percent_drain',p:{ratio,failTrue}}]);
const check=async(n:string,f:()=>any)=>{await f();checks++;console.log('✓ '+n);};
let edited:any;
try{
 await check('Blockly保存重載及改比例/追加量，未知鍵及非法數值拒絕',()=>{
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{const e=make().kit[0];validateKit([e]);const b=buildEntryBlock(w as any,e)!;Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,0),e);const act=r.getAllBlocks(false).find(x=>x.type==='sequence_action')!;act.setFieldValue(JSON.stringify({ratio:.25,failTrue:70}),'PARAMS');edited={...h.wait(),name:'編輯吸取',effectMode:'kit',kit:[createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,0)!]};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
  for(const q of [{ratio:0,failTrue:210},{ratio:Infinity,failTrue:210},{ratio:.5,failTrue:-1},{ratio:.5,failTrue:1.2},{ratio:.5,failTrue:210,script:'禁止'}]){const s=h.kitSkill('非法',[{op:'checked_percent_drain',p:q}]);assert.throws(()=>validateKit(s.kit));}
 });
 await check('結算實際分類已轉真傷時不套百分比分支；回呼身分不相符時不借用',()=>{
  for(const type of ['percent','true'])for(const mismatch of [false,true]){let fallback=0;const ctx:any={actor:'p1',targetSide:'p2',self:{id:'S'},target:{id:'E',maxHp:1000},applyTrueDamage:(_:any,n:number)=>fallback+=n,applyPinkDamage:(_s:any,_a:any,_l:any,_p1:any,_p2:any,_type:any,o:any)=>{o.onSettled({targetBattleId:mismatch?'B':'E',damageType:type,settledAmount:0,hpLost:0});return 0;}};checkedPercentDrain(ctx,{ratio:.5,failTrue:210});assert.equal(fallback,type==='percent'&&!mismatch?210:0);}
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 完整異境神霆Kit施放及回合末皆使用正式結算檢查`,async()=>{
   const {handleOtherworldReySoulMark}=await h.server.ssrLoadModule('/src/effects/elves/otherworld-rey/registry.ts');
   h.S.S=(c:any,e:any,d:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState('noHealTurns',99);if(e===T.BEFORE_DAMAGE&&!d?.damageComp?.isIncoming&&d.damageComp.damageCategory==='skill_attack')d.damageComp.base=1;};
   try{const [r]=await h.play(side,{self:h.unit('S',100,[structuredClone(h.find('5029','異境神霆'))],{maxHp:1000000,speed:200}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(r.self.currentHp,100);assert.equal(r.opp.currentHp,1000000-500000-333333-420-300);}finally{delete h.S.S;}
  });
  await check(`${side} 正常吸取按結算量回血，雙方HP有變動時不追加`,async()=>{const [r]=await h.play(side,{self:h.unit('S',100,[make()],{maxHp:2000,speed:200}),opp:h.unit('E',1000,[h.wait()])});assert.equal(r.self.currentHp,600);assert.equal(r.opp.currentHp,500);});
  await check(`${side} 百分比免疫或禁療、兩者同時失敗均只追加一次210真傷`,async()=>{
   for(const [immune,noHeal,expected] of [[true,false,790],[false,true,290],[true,true,790]] as const){h.S.S=(c:any,e:any)=>{if(noHeal&&e===T.ON_ENTRANCE)c.setPlayerState('noHealTurns',99);};h.S.E=(c:any,e:any,d:any)=>{if(immune&&e===T.BEFORE_DAMAGE&&d?.damageComp?.isIncoming&&d.damageComp.damageCategory==='percent')d.damageComp.multiplier=0;};try{const [r]=await h.play(side,{self:h.unit('S',100,[make()],{maxHp:2000,speed:200}),opp:h.unit('E',1000,[h.wait()])});assert.equal(r.self.currentHp,100);assert.equal(r.opp.currentHp,expected);}finally{delete h.S.S;delete h.S.E;}}
  });
  await check(`${side} 護罩吸收名義500仍回血500，但敵方未扣HP追加210`,async()=>{h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.updateElf(c.actor,{barrier:500});};try{const [r]=await h.play(side,{self:h.unit('S',100,[make()],{maxHp:2000,speed:200}),opp:h.unit('E',1000,[h.wait()])});assert.equal(r.self.currentHp,600);assert.equal(r.opp.currentHp,790);}finally{delete h.S.E;}});
  await check(`${side} 滿體力無實際增加追加；半額恢復確有增加不追加`,async()=>{
   const [full]=await h.play(side,{self:h.unit('S',2000,[make()],{maxHp:2000,speed:200}),opp:h.unit('E',1000,[h.wait()])});assert.equal(full.self.currentHp,2000);assert.equal(full.opp.currentHp,290);
   h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState('healReduction',.5);};try{const [r]=await h.play(side,{self:h.unit('S',100,[make()],{maxHp:2000,speed:200}),opp:h.unit('E',1000,[h.wait()])});assert.equal(r.self.currentHp,350);assert.equal(r.opp.currentHp,500);}finally{delete h.S.S;}
  });
  await check(`${side} Blockly改為25%及70真傷、改名後執行；附加封印完全不觸發`,async()=>{
   for(const blocked of [false,true]){h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE){c.setPlayerState('noHealTurns',99);if(blocked)c.setPlayerState('allHitEffectNullTurns',99);}};try{const [r]=await h.play(side,{self:h.unit('S',100,[structuredClone(edited)],{maxHp:2000,speed:200}),opp:h.unit('E',1000,[h.wait()])});assert.equal(r.self.currentHp,100);assert.equal(r.opp.currentHp,blocked?1000:680);}finally{delete h.S.S;}}
  });
 }
 console.log(`結算吸取 ${checks}項通過；不代表異境神霆持續窗口完成`);
}finally{await h.close();}
process.exit(0);
