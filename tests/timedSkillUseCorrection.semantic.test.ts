import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {parseLine} from '../src/blocks/parse';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {MIGRATED_SEQUENCE_SKILL_KITS:defs}=await h.server.ssrLoadModule('/src/data/migratedSequenceSkillKits.ts');
const wanted=new Set(['蟄刃復歸','星核幻舞','心像重構','冰天花葬','千鳥俱寂','升臨恩澤','絕滅死亡','寄生種子','妖靈天性','霜凍之錮','星光·壓迫','天佑聖障','列星安辰','璨靈聖光','血稅迴轉','禁靈領域','孑然孤夢','殘軀鎖命']);
const check=async(n:string,f:()=>any)=>{await f();checks++;console.log('✓ '+n);};
const walk=(v:any,found:any[]=[])=>{if(!v||typeof v!=='object')return found;if(v.op==='timed'&&v.p?.trig==='self_skill')found.push(v);for(const x of Object.values(v))if(typeof x==='object')Array.isArray(x)?x.forEach(y=>walk(y,found)):walk(x,found);return found;};
try{
 await check('省略事件的每回合行為解析為使用級，明示回合結束保留',()=>{const p=parseLine('3回合內每回合恢復自身最大體力1/3');assert.equal(p.parsed,true);const a=p.body[0].acts[0];assert.equal(a.p.trig,'self_skill');assert.equal(a.p.initial,true);const q=parseLine('3回合內每回合結束時恢復自身最大體力1/3');assert.equal(q.parsed,true);assert.equal(q.body[0].acts[0].p.trig,'round_end');});
 await check('明示技能種類仍綁定該種類，當回合補首次、下回合起不提前觸發',()=>{for(const [text,trig] of [['使用技能','self_skill'],['自身使用攻擊技能','self_attack'],['自身使用屬性技能','self_status']])for(const next of [false,true]){const c=parseLine(`${next?'下':''}3回合內${text}時恢復自身最大體力1/3`);assert.equal(c.parsed,true);const a=c.body[0].acts[0];assert.equal(a.p.trig,trig);assert.equal(!!a.p.initial,!next);}});
 const selected=defs.filter((d:any)=>wanted.has(d.name));assert.equal(selected.length,18);
 defineCustomBlocks();
 for(const d of selected){
  const entries=d.kit.filter((e:any)=>walk(e.params).length&&(/恢復|吸取|附加200|攻擊-2/.test(e.params?.clause?.raw||'')||d.name==='血稅迴轉'));
  assert.equal(entries.length,1,d.name+'唯一持續條目');const entry=entries[0],timed=walk(entry.params)[0];
  await check(`${d.name} 描述存在／可編輯使用事件／Blockly保存往返`,()=>{validateKit(d.kit);assert.ok(d.description.length);assert.equal(timed.p.trig,'self_skill');if(d.name!=='血稅迴轉')assert.equal(timed.p.initial,true);const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{const b=buildEntryBlock(w as any,entry)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,entry.node,entry.order),entry);}finally{w.dispose();r.dispose();}});
  for(const side of ['p1','p2'] as const)await check(`${side} ${d.name} 初次成功→後續未命中仍觸發；無法用技及回合末不自動觸發`,async()=>{
   // 隔離此條目的原始timer及子流程，其他技能條款另由各自全文套件驗證。
   const e=structuredClone(entry);e.params.clause.body=[{acts:[structuredClone(timed)]}];
   const first={...h.wait(),name:d.name,category:'物理',power:1,effectMode:'kit',kit:[e]};
   const miss={...h.wait(),name:'後續未命中',category:'物理',power:1,isSureHit:false,accuracy:0};
   const observed:any[]=[];
   h.S.S=(c:any,event:any)=>{if(event===T.ROUND_START)c.updateElf(c.actor,{currentHp:100});};
   h.S.E=(c:any,event:any,data:any)=>{
    if(event===T.ROUND_START)c.updateElf(c.actor,{currentHp:1000000000,statStages:{}});
    if(event===T.BEFORE_DAMAGE&&data?.damageComp?.isIncoming&&data.damageComp.damageCategory==='skill_attack'){data.damageComp.floor=0;data.damageComp.outgoingLimit=0;}
    if(event===T.AFTER_ACTION){observed.push({self:c.target.currentHp,opp:c.self.currentHp,atk:c.self.statStages?.atk||0});if(c.roundNumber===2)c.applyStatusWithImmunityCheck(c.targetSide,'睡眠',2);}
   };
   try{if(d.name!=='血稅迴轉'){
     const [failed]=await h.play(side,{self:h.unit('S',100,[{...first,isSureHit:false,accuracy:0}],{maxHp:120000,speed:200}),opp:h.unit('E',1000000000,[h.wait()],{speed:100})});
     assert.equal(failed.self.currentHp,100,d.name+'首次未命中不取得效果');assert.equal(failed.opp.currentHp,1000000000);assert.equal(failed.opp.statStages?.atk||0,0);observed.length=0;
    }
    const r=await h.play(side,{self:h.unit('S',100,[first,miss],{maxHp:120000,speed:200}),opp:h.unit('E',1000000000,[h.wait()],{speed:100}),turns:(_,t)=>[t===1?0:1,0]},3);
    assert.equal(observed.length,3);for(let i=0;i<2;i++){assert.ok(observed[i].self>100||observed[i].opp<1000000000||observed[i].atk<0,d.name+'使用時已有真實結果');assert.equal(r[i].self.currentHp,observed[i].self,d.name+'回合末不額外恢復');assert.equal(r[i].opp.currentHp,observed[i].opp,d.name+'回合末不額外扣血');}
    assert.deepEqual(observed[2],{self:100,opp:1000000000,atk:0},d.name+'沒有使用不觸發');assert.equal(r[2].self.currentHp,100);assert.equal(r[2].opp.currentHp,1000000000);
   }finally{delete h.S.S;delete h.S.E;}
  });
 }
 console.log(`持續使用級修正 ${checks}項通過；僅驗此時點與編輯範圍，不替代全文驗收`);
}finally{await h.close();}
process.exit(0);
