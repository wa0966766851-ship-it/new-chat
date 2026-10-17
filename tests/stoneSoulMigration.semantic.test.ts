import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_STONE_SOUL_KIT as def} from '../src/data/migratedStoneSoulKit';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const actual=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5026').soulMark;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const check=async(n:string,f:()=>any)=>{await f();checks++;console.log('✓ '+n);};
const soul=(orders?:number[])=>({...structuredClone(actual),name:'自訂墜星魂印',kit:structuredClone(actual.kit.filter((e:any)=>!orders||orders.includes(e.order)))});
const attack=()=>({...h.wait(),name:'攻擊',category:'物理',power:100,pp:10,maxPp:20,currentPp:10});
const own=(s:any)=>({soulMark:s});
const fixed=(_:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&d?.damageComp?.isIncoming&&d.damageComp.damageCategory==='skill_attack')d.damageComp.base=100;};
let edited:any;
try{
 await check('正式完整來源、Kit路由與所有Blockly往返；改威力計數範圍可保存',()=>{
  assert.equal(actual.description,def.description);assert.equal(actual.effectMode,'kit');assert.deepEqual(actual.kit,def.kit);validateKit(actual.kit);defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of actual.kit){const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('soulmark')(r.getBlockById(b.id)!,e.node,e.order),e);if(e.order===5){const act=r.getAllBlocks(false).find(x=>x.type==='sequence_action')!;act.setFieldValue(JSON.stringify({perElf:.1,scope:'bench',aliveOnly:true}),'PARAMS');edited={...soul([5]),kit:[createKitBlockParser('soulmark')(r.getBlockById(b.id)!,e.node,e.order)!]};validateKit(edited.kit);}w.clear();r.clear();}}finally{w.dispose();r.dispose();}
  for(const p of [{perElf:0,scope:'team',aliveOnly:false},{perElf:.25,scope:'any',aliveOnly:false},{perElf:.25,scope:'team',aliveOnly:1}]){const k=soul([5]);k.kit[0].params.clause.body[0].acts[0].p=p;assert.throws(()=>validateKit(k.kit));}
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 全魂印主傷害100、恢復100、附加失血50%、所有技能PP+2`,async()=>{
   h.S.E=fixed;try{const [r]=await h.play(side,{self:h.unit('S',1000,[attack(),{...h.wait(),pp:5,maxPp:20,currentPp:5}],{maxHp:5000,speed:200,extra:own(soul())}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.currentHp,1100);assert.equal(r.opp.currentHp,9850);assert.equal(r.self.skills[0].pp,11);assert.equal(r.self.skills[1].pp,7);assert.ok(r.logs.every((l:string)=>!l.includes('效果待接通')));}finally{delete h.S.E;}
  });
  await check(`${side} 護盾吸收70後仍以主技能結算100恢復，失血30再附加15`,async()=>{
   h.S.E=(c:any,e:any,d:any)=>{fixed(c,e,d);if(e===T.ON_ENTRANCE)c.applyShield(c.actor,70);};try{const [r]=await h.play(side,{self:h.unit('S',1000,[attack()],{maxHp:5000,speed:200,extra:own(soul([1,3]))}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.currentHp,1100);assert.equal(r.opp.currentHp,9955);}finally{delete h.S.E;}
  });
  await check(`${side} 背包含自身/場下/死亡非滿血快照，屬性不消耗，下次攻擊只用一次`,async()=>{
   const powers:number[]=[];h.S.E=(_:any,e:any,d:any)=>{if(e===T.MODIFY_POWER&&d?.isIncoming)powers.push(d.powerComp.power);if(e===T.BEFORE_DAMAGE&&d?.damageComp?.isIncoming&&d.damageComp.damageCategory==='skill_attack'&&d.damageComp){if(_.roundNumber===3)d.damageComp.multiplier=0;}};
   try{const r=await h.play(side,{self:h.unit('S',1000,[attack(),h.wait()],{maxHp:5000,speed:200,extra:own(soul([5]))}),selfBench:[h.unit('B',200,[h.wait()],{maxHp:1000}),h.unit('D',0,[h.wait()],{maxHp:1000}),h.unit('F',1000,[h.wait()])],opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===2?1:0,0]},4);assert.deepEqual(powers,[100,0,175,100]);assert.ok(!r[2].state[side+'Timers'].some((t:any)=>t.payload?.block?.nextPowerRatio));assert.ok(r[1].state[side+'Timers'].some((t:any)=>t.payload?.block?.nextPowerRatio===1.75));}finally{delete h.S.E;}
  });
  await check(`${side} 編輯改名只算存活場下，每隻10%→下次威力110`,async()=>{
   const powers:number[]=[];h.S.E=(_:any,e:any,d:any)=>{if(e===T.MODIFY_POWER&&d?.isIncoming)powers.push(d.powerComp.power);};try{await h.play(side,{self:h.unit('S',1000,[attack()],{maxHp:5000,speed:200,extra:own(structuredClone(edited))}),selfBench:[h.unit('B',200,[h.wait()],{maxHp:1000}),h.unit('D',0,[h.wait()],{maxHp:1000})],opp:h.unit('E',100000,[h.wait()])},2);assert.deepEqual(powers,[100,110.00000000000001]);}finally{delete h.S.E;}
  });
  await check(`${side} 固定/百分比/真傷不誤觸對手技能受傷觀察，自己受擊不誤觸`,async()=>{
   const r=await h.play(side,{self:h.unit('S',1000,[h.kitSkill('附加三類',[{op:'dmg',p:{flat:10,type:'固定'}},{op:'dmg',p:{flat:10,type:'百分比'}},{op:'dmg',p:{flat:10,type:'真實'}}])],{maxHp:5000,speed:200,extra:own(soul([5]))}),opp:h.unit('E',100000,[attack()])});assert.ok(!r[0].state[side+'Timers'].some((t:any)=>t.payload?.block?.nextPowerRatio));
  });
  await check(`${side} 免控及屬性無效當次起兩回合，第3回合恢復`,async()=>{
   const successful:number[]=[];h.S.E=(c:any,e:any)=>{if(e===T.BEFORE_ACTION)c.applyStatusWithImmunityCheck(c.targetSide,'害怕',3);if(e===T.AFTER_ACTION)successful.push(c.roundNumber);};
   try{const r=await h.play(side,{self:h.unit('S',10000,[attack(),h.wait()],{speed:200,extra:own(soul([2]))}),opp:h.unit('E',100000,[attack()]),turns:(_,t)=>[t===1?0:1,0]},3);assert.equal(h.statuses(r[0].self).includes('害怕'),false);assert.equal(h.statuses(r[1].self).includes('害怕'),false);assert.equal(h.statuses(r[2].self).includes('害怕'),true);}finally{delete h.S.E;}
   h.S.E=(c:any,e:any)=>{if(e===T.AFTER_ACTION)successful.push(c.roundNumber);};successful.length=0;
   try{await h.play(side,{self:h.unit('S',10000,[attack(),h.wait()],{speed:200,extra:own(soul([0]))}),opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},3);assert.deepEqual(successful,[3]);}finally{delete h.S.E;}
  });
  await check(`${side} 未命中/技能無效不跑攻擊後效果；禁療不妨礙失血傷害及PP恢復`,async()=>{
   for(const mode of ['miss','invalid','noheal']){h.S.E=(c:any,e:any,d:any)=>{fixed(c,e,d);if(e===T.ON_ENTRANCE&&mode!=='miss')c.setOpponentState(mode==='invalid'?'attackSkillInvalidTurns':'noHealTurns',99);};
    try{const s=attack();if(mode==='miss'){s.isSureHit=false;(s as any).accuracy=0;}const [r]=await h.play(side,{self:h.unit('S',1000,[s],{maxHp:5000,speed:200,extra:own(soul())}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.currentHp,1000);assert.equal(r.opp.currentHp,mode==='noheal'?9850:10000);assert.equal(r.self.skills[0].pp,mode==='noheal'?11:9);}finally{delete h.S.E;}
   }
  });
  await check(`${side} 真實內建名稱Kit不重播舊handler，換人不傳下一次威力`,async()=>{
   let legacy=0;const old=h.S['無序·墜星'];h.S['無序·墜星']=()=>{legacy++;};h.S.E=fixed;
   try{const s=h.unit('S',1000,[attack()],{maxHp:5000,speed:200,extra:own(soul())});s.name='無序·墜星';const r=await h.play(side,{self:s,selfBench:[h.unit('B',5000,[attack()])],opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===2?{switch:1}:0,0]},2);assert.equal(legacy,0);assert.equal(r[0].self.currentHp,1100);assert.ok(!r[1].state[side+'Timers'].some((t:any)=>t.payload?.block?.nextPowerRatio));}finally{h.S['無序·墜星']=old;delete h.S.E;}
  });
 }
 console.log(`墜星魂印 ${checks}項測試通過`);
}finally{await h.close();}
process.exit(0);
