import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {OTHERWORLD_REY_TEXT} from '../src/data/otherworldReyDescriptions';
import {reyGodDescentRule} from '../src/battle/survivalRules';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {handleOtherworldReySoulMark}=await h.server.ssrLoadModule('/src/effects/elves/otherworld-rey/registry.ts');
const skill=structuredClone(h.find('5029','同塵祭'));
const part=(orders:number[])=>({...structuredClone(skill),category:'屬性',power:0,kit:structuredClone(skill.kit.filter((e:any)=>orders.includes(e.order)))});
const check=async(n:string,f:()=>any)=>{await f();checks++;console.log('✓ '+n);};
const mark=(side:string,c:any,count:number)=>c.setMark({id:'rey_alien_energy',name:'異能值',count,scope:'elf',ownerBattleId:c.self.battleId,visibleWhenZero:true,persistsOffField:true},side);
try{
 await check('原文/無舊handler/Blockly往返及契約',()=>{assert.equal(skill.description,OTHERWORLD_REY_TEXT.skills['同塵祭']);h.assertKitOnly(skill);validateKit(skill.kit);defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{for(const e of skill.kit){const b=buildEntryBlock(w as any,e)!;Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);w.clear();r.clear();}}finally{w.dispose();r.dispose();}const s=part([4]);s.kit[0].params.clause.body[0].acts[0].p.unit=0;assert.throws(()=>validateKit(s.kit));});
 for(const side of ['p1','p2'] as const){
  await check(`${side} 全文：體力歸1、等級逐項取高、上限與異能扣70、當次PP×7`,async()=>{
   h.S.S=(_:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&d?.damageComp&&!d.damageComp.isIncoming&&d.damageComp.damageCategory==='skill_attack'){d.damageComp.floor=100;d.damageComp.outgoingLimit=100;}};h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)mark(c.actor,c,100);};try{const [r]=await h.play(side,{self:h.unit('S',800,[structuredClone(skill)],{maxHp:1000,speed:200,statStages:{atk:3,def:-4,spatk:-2,speed:1}}),opp:h.unit('E',1000,[h.wait()],{statStages:{atk:1,def:-2,spatk:4,speed:-1,accuracy:2},extra:{weight:100}})});assert.equal(r.self.currentHp,1);assert.deepEqual(r.self.statStages,{atk:3,def:-2,spatk:4,speed:1,spdef:0,accuracy:2});assert.equal(r.opp.maxHp,930);assert.equal(r.opp.currentHp,830);assert.equal(r.opp.skills[0].pp,92);const opp=side==='p1'?'p2':'p1';assert.equal(r.state[opp+'Marks'].find((m:any)=>m.id==='rey_alien_energy').count,30);}finally{delete h.S.E;delete h.S.S;}
  });
  await check(`${side} 零血與負血直接歸1，禁療不改成神降恢復`,async()=>{
   for(const hp of [0,-700]){h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState('noHealTurns',99);};try{const [r]=await h.play(side,{self:h.unit('S',hp,[part([0,2])],{maxHp:1000,speed:200,extra:{survivalRule:reyGodDescentRule(1000)}}),opp:h.unit('E',1000,[h.wait()])});assert.equal(r.self.currentHp,1);}finally{delete h.S.S;}}
  });
  await check(`${side} 體重小數捨去、70上限、資源不足歸零、無資源不憑空生成`,async()=>{
   for(const [weight,count,loss] of [[0,5,0],[.9,5,0],[1.9,5,1],[69.9,5,69],[999,100,70]] as const){h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)mark(c.actor,c,count);};try{const [r]=await h.play(side,{self:h.unit('S',1000,[part([0,4])],{speed:200}),opp:h.unit('E',1000,[h.wait()],{extra:{weight}})});assert.equal(r.opp.maxHp,1000-loss);const opp=side==='p1'?'p2':'p1';assert.equal(r.state[opp+'Marks'].find((m:any)=>m.id==='rey_alien_energy').count,Math.max(0,count-loss));}finally{delete h.S.E;delete h.S.S;}}
   const [r]=await h.play(side,{self:h.unit('S',1000,[part([0,4])],{speed:200}),opp:h.unit('E',1000,[h.wait()],{extra:{weight:70}})});const opp=side==='p1'?'p2':'p1';assert.ok(!r.state[opp+'Marks'].some((m:any)=>m.id==='rey_alien_energy'));
  });
  await check(`${side} PP倍率當次起7回合、第8回合正常`,async()=>{
   const r=await h.play(side,{self:h.unit('S',1000,[part([0,3]),h.wait()],{speed:200}),opp:h.unit('E',1000,[{...h.wait(),pp:100,maxPp:100}]),turns:(_,t)=>[t===1?0:1,0]},8);for(let i=0;i<7;i++)assert.equal(r[i].opp.skills[0].pp,100-7*(i+1));assert.equal(r[7].opp.skills[0].pp,50);
  });
  await check(`${side} 後手不追扣已花PP、不多延長一回合；攻擊技能同樣七倍`,async()=>{
   const r=await h.play(side,{self:h.unit('S',1000000,[part([0,3]),h.wait()],{speed:50}),opp:h.unit('E',1000,[{...h.wait(),category:'物理',power:1,pp:100,maxPp:100}],{speed:200}),turns:(_,t)=>[t===1?0:1,0]},8);assert.equal(r[0].opp.skills[0].pp,99);assert.equal(r[6].opp.skills[0].pp,57);assert.equal(r[7].opp.skills[0].pp,56);
  });
  await check(`${side} 附加封印或技能無效不調整HP、等級、資源與PP窗口`,async()=>{
   for(const mode of ['attached','invalid']){h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState(mode==='attached'?'allHitEffectNullTurns':'attackSkillInvalidTurns',99);};h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)mark(c.actor,c,100);};try{const s=structuredClone(skill);if(mode==='attached'){s.category='屬性';s.power=0;}const [r]=await h.play(side,{self:h.unit('S',800,[s],{maxHp:1000,speed:200,statStages:{atk:-2}}),opp:h.unit('E',1000,[h.wait()],{extra:{weight:70}})});assert.equal(r.self.currentHp,800);assert.equal(r.self.statStages.atk,-2);assert.equal(r.opp.maxHp,1000);assert.equal(r.opp.skills[0].pp,98);const opp=side==='p1'?'p2':'p1';assert.equal(r.state[opp+'Marks'].find((m:any)=>m.id==='rey_alien_energy').count,100);}finally{delete h.S.S;delete h.S.E;}}
  });
  await check(`${side} Blockly改體力5、每2重量/最多10、另種資源及PP兩回合三倍可執行`,async()=>{
   const w=new Blockly.Workspace();let edited:any;try{edited={...h.wait(),name:'改寫同塵',effectMode:'kit',kit:skill.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;for(const act of w.getAllBlocks(false).filter(x=>x.type==='sequence_action')){const op=act.getFieldValue('OP'),p=JSON.parse(act.getFieldValue('PARAMS'));if(op==='hp_set')p.value=5;if(op==='body_maxhp_resource_loss'){p.unit=2;p.cap=10;p.resourceId='custom_resource';}if(op==='pp_cost_mult'){p.turns=2;p.mult=3;}act.setFieldValue(JSON.stringify(p),'PARAMS');}const out=createKitBlockParser('skill')(b,e.node,e.order)!;w.clear();return out;})};validateKit(edited.kit);}finally{w.dispose();}
   h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setMark({id:'custom_resource',name:'資源',count:100,scope:'elf',ownerBattleId:c.self.battleId,persistsOffField:true},c.actor);};
   try{const r=await h.play(side,{self:h.unit('S',800,[edited,h.wait()],{maxHp:1000,speed:200}),opp:h.unit('E',1000,[h.wait()],{extra:{weight:19.9}}),turns:(_,t)=>[t===1?0:1,0]},3);assert.equal(r[0].self.currentHp,5);assert.equal(r[0].opp.maxHp,991);assert.equal(r[2].opp.skills[0].pp,92);const opp=side==='p1'?'p2':'p1';assert.equal(r[0].state[opp+'Marks'].find((m:any)=>m.id==='custom_resource').count,91);}finally{delete h.S.E;}
  });
  await check(`${side} 異能值扣到0後下場回場不從舊初始欄位重設`,async()=>{
   let seeded=false;h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE){if(!seeded){seeded=true;c.setPlayerState('otherworldRey.alienEnergy',100);mark(c.actor,c,5);}handleOtherworldReySoulMark(c,e);}};
   try{const r=await h.play(side,{self:h.unit('S',1000,[part([0,4]),h.wait()],{speed:200}),opp:h.unit('E',1000,[h.wait()],{extra:{weight:70}}),oppBench:[h.unit('B',1000,[h.wait()])],turns:(_,t)=>[t===1?0:1,t===2?{switch:1}:t===3?{switch:0}:0]},3);const opp=side==='p1'?'p2':'p1';assert.equal(r[2].state[opp+'Marks'].find((m:any)=>m.id==='rey_alien_energy').count,0);}finally{delete h.S.E;}
  });
 }
 console.log(`同塵祭 ${checks}項正式測試通過`);
}finally{await h.close();}
process.exit(0);
