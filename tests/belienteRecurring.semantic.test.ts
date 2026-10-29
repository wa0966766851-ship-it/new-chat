import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_BELIENTE_SKILL_KITS as defs} from '../src/data/migratedBelienteSkillKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const registry=getBattleSkillRegistry(),old=registry['星河入眸'];registry['星河入眸']=()=>{calls++;throw Error('舊技能不得重播');};
const sk=()=>structuredClone(h.find('5027','星河入眸'));
const only=(s:any,orders:number[])=>({...s,kit:s.kit.filter((e:any)=>orders.includes(e.order))});
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const reduction=(ratio:number)=>({name:'通用恢復限制',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,params:{clause:{raw:'限制恢復',trig:'entrance',parsed:true,body:[{acts:[{op:'recovery_reduce_turns',p:{side:'self',ratio,turns:99,includePotions:true,next:false},label:'恢復限制'}]}]}}}]});
let edited:any;
try{
 await check('完整原文與8條款Blockly保存重載；持續4→2、恢復1/2→1/4、汲取240→120可編輯',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,(source as any)['5027'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...s,name:'自訂星河',kit:s.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'){const op=x.getFieldValue('OP'),p=JSON.parse(x.getFieldValue('PARAMS'));if(op==='timed')p.turns=2;const edit=(v:any):void=>{if(!v||typeof v!=='object')return;if(v.op==='heal_then')v.p.ratio=.25;if(v.op==='drain')v.p.flat=120;for(const child of Object.values(v))edit(child);};edit({op,p});x.setFieldValue(JSON.stringify(p),'PARAMS');}w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;})};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 正式完整8條款同時執行，當次恢復6000加汲取240且無舊路徑重播`,async()=>{
   const [r]=await h.play(side,{self:h.unit('S',1000,[sk()],{maxHp:12000,speed:200}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(r.self.currentHp,7240);assert.equal(1000000-r.opp.currentHp,6240);assert.equal(r.self.statStages.atk,2);assert.equal(calls,0);
  });
  await check(`${side} 恢復結算後才造成實際等量百分比，含施放回合且僅4回合`,async()=>{
   const trait=reduction(.5);validateKit(trait.kit as any);const r=await h.play(side,{self:h.unit('S',1000,[only(sk(),[0,4]),h.wait()],{maxHp:10000,speed:200,extra:{trait}}),opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},5);
   assert.deepEqual(r.map(x=>x.self.currentHp),[3500,6000,8500,10000,10000]);assert.deepEqual(r.map(x=>1000000-x.opp.currentHp),[2500,5000,7500,9000,9000]);
  });
  await check(`${side} 滿血及禁療時等量為0，並非名義5000傷害`,async()=>{
   for(const full of [false,true]){const trait=reduction(1);validateKit(trait.kit as any);const r=await h.play(side,{self:h.unit('S',full?10000:1000,[only(sk(),[0,4]),h.wait()],{maxHp:10000,speed:200,extra:full?{}:{trait}}),opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},2);for(const row of r){assert.equal(row.opp.currentHp,1000000);assert.equal(row.self.currentHp,full?10000:1000);}}
  });
  await check(`${side} 汲取240是真實傷害，施放當回合起3次而非固定傷害`,async()=>{
   const events:string[]=[];h.S.E=(_:any,e:any,d:any)=>{if(e===T.ON_DAMAGED)events.push(String(d.damageType));};try{const r=await h.play(side,{self:h.unit('S',1000,[only(sk(),[0,5]),h.wait()],{maxHp:10000,speed:200}),opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},4);assert.deepEqual(r.map(x=>x.self.currentHp),[1240,1480,1720,1720]);assert.deepEqual(r.map(x=>1000000-x.opp.currentHp),[240,480,720,720]);assert.equal(events.length,3);assert.ok(events.every(x=>x.includes('true')));}finally{delete h.S.E;}
  });
  await check(`${side} 後續技能無效仍觸發已啟動窗口，首次無效不啟動`,async()=>{
   const invalid=h.kitSkill('技能無效',[{op:'invalid_next',p:{kind:'all',uses:1}}],{priority:100});
   for(const first of [false,true]){const r=await h.play(side,{self:h.unit('S',1000,[only(sk(),[0,4,5]),h.wait()],{maxHp:100000,speed:200}),opp:h.unit('E',1000000,[invalid,h.wait()]),turns:(_,t)=>[t===1?0:1,(first?t===1:t===2)?0:1]},2);assert.equal(1000000-r[1].opp.currentHp,first?0:99240);assert.equal(r[1].self.currentHp,first?1000:100000);}
  });
  await check(`${side} 編輯保存改名後恢復2500與汲取120，兩回合後均停止`,async()=>{
   const r=await h.play(side,{self:h.unit('S',1000,[only(edited,[0,4,5]),h.wait()],{maxHp:10000,speed:200}),opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},3);assert.deepEqual(r.map(x=>x.self.currentHp),[3620,6240,6240]);assert.deepEqual(r.map(x=>1000000-x.opp.currentHp),[2620,5240,5240]);
  });
  await check(`${side} 下場清除窗口、替補不借、回場不重建`,async()=>{
   const r=await h.play(side,{self:h.unit('S',1000,[only(sk(),[0,4,5]),h.wait()],{maxHp:100000,speed:200}),selfBench:[h.unit('B',1000,[h.wait()],{maxHp:100000})],opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:t===2?{switch:1}:t===3?{switch:0}:1,0]},4);assert.equal(r[1].self.name,'B');assert.equal(r[1].self.currentHp,1000);for(const row of r)assert.equal(row.opp.currentHp,r[0].opp.currentHp);assert.equal(r[3].self.currentHp,r[0].self.currentHp);
  });
  await check(`${side} 全屬性+2與3回合保強，第四回合可消除`,async()=>{
   const clear=h.kitSkill('消強',[{op:'stat_clear',p:{side:'opp',kind:'up'}}]);const r=await h.play(side,{self:h.unit('S',10000,[only(sk(),[0,1,2]),h.wait()],{speed:200}),opp:h.unit('E',1000000,[h.wait(),clear]),turns:(_,t)=>[t===1?0:1,t===1?0:1]},4);for(let i=0;i<3;i++)for(const k of ['atk','def','spatk','spdef','speed','accuracy'])assert.equal(r[i].self.statStages[k],2);assert.equal(r[3].self.statStages.atk||0,0);
  });
  await check(`${side} 五回合異常免疫反彈，第六回合可中毒`,async()=>{
   const poison=h.kitSkill('毒',[{op:'status',p:{side:'opp',status:'中毒',turns:3,chance:100}}]);const r=await h.play(side,{self:h.unit('S',100000,[only(sk(),[0,3]),h.wait()],{speed:200}),opp:h.unit('E',1000000,[poison,h.wait()]),turns:(_,t)=>[t===1?0:1,t===1||t>=5?0:1]},6);for(let i=0;i<5;i++)assert.ok(!h.statuses(r[i].self).includes('中毒'));assert.ok(h.statuses(r[0].opp).includes('中毒'));assert.ok(h.statuses(r[5].self).includes('中毒'));
  });
  await check(`${side} 五回合閃避到期才恢復PP與1/3體力，六回合恢復命中`,async()=>{
   const s=only(sk(),[0,6]);s.pp=5;s.maxPp=10;const attack={...h.wait(),name:'非必中攻擊',category:'物理',power:20,isSureHit:false};const r=await h.play(side,{self:h.unit('S',1000,[s,{...h.wait(),pp:10,maxPp:20}],{maxHp:12000,speed:200}),opp:h.unit('E',1000000,[attack]),turns:(_,t)=>[t===1?0:1,0]},6);for(let i=0;i<4;i++)assert.equal(r[i].self.currentHp,1000);assert.equal(r[4].self.currentHp,5000);assert.equal(r[4].self.skills[0].pp,7);assert.equal(r[4].self.skills[1].pp,9);assert.ok(r[5].self.currentHp<5000);assert.equal(r[5].self.skills[0].pp,7);
  });
  await check(`${side} 下兩回合先制+3只在次回合起影響排序，第四回合消失`,async()=>{
   const r=await h.play(side,{self:h.unit('S',10000,[only(sk(),[0,7]),h.wait()],{speed:100}),opp:h.unit('E',1000000,[{...h.wait(),priority:2}],{speed:200}),turns:(_,t)=>[t===1?0:1,0]},4);for(let i=0;i<4;i++){const logs=r[i].logs.slice(i?r[i-1].logs.length:0);const self=logs.findIndex((x:string)=>x.includes('【S】使用了')),opp=logs.findIndex((x:string)=>x.includes('【E】使用了'));assert.ok(self>=0&&opp>=0);assert.equal(self<opp,i===1||i===2);}
  });
 }
 assert.equal(calls,0);console.log(`星河持續效果 ${checks} 項通過，舊handler0次；其他條款交叉情境仍待驗`);
}finally{if(old)registry['星河入眸']=old;else delete registry['星河入眸'];await h.close();}
process.exit(0);
