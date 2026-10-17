import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_STARLIGHT_SKILL_KITS as waveDefs} from '../src/data/migratedStarlightSkillKits';
import {MIGRATED_SCARLETT_SKILL_KITS as kingDefs} from '../src/data/migratedScarlettSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const reg=getBattleSkillRegistry(),originals=new Map<string,any>();for(const d of [...waveDefs,...kingDefs]){originals.set(d.name,reg[d.name]);reg[d.name]=()=>{calls++;throw Error('禁止重播舊技能');};}
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const clone=(id:string,n:string)=>structuredClone(h.find(id,n));
const wave=()=>clone('5010','星光·浪打千擊'),king=()=>clone('5014','王·凰歌盡霄');
const strip=(s:any,order:number)=>({...s,name:s.name+'對照',kit:s.kit.filter((e:any)=>e.order!==order)});
try{
 defineCustomBlocks();let editedWave:any,editedKing:any;
 await check('兩份正式完整原文、圖紙與Blockly往返，改值保存後改名',()=>{
  for(const [d,s] of [[waveDefs[0],wave()],[kingDefs[0],king()]] as any){assert.equal(s.effectMode,'kit');assert.equal(s.description,d.description);assert.deepEqual(s.kit,d.kit);validateKit(s.kit);
   const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{
    const kit=s.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
     for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'){const p=JSON.parse(x.getFieldValue('PARAMS'));if(x.getFieldValue('OP')==='dmg'&&p.rampInc!==undefined){p.ratio=.1;p.rampInc=5;p.rampCap=20;}if(x.getFieldValue('OP')==='boost'&&p.perInc!==undefined)p.perInc=.1;x.setFieldValue(JSON.stringify(p),'PARAMS');}
     w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;r.clear();w.clear();return out;});
    const edited={...s,name:'自訂'+s.name,kit};validateKit(kit);if(s.name===waveDefs[0].name)editedWave=edited;else editedKing=edited;
   }finally{w.dispose();r.dispose();}
  }
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 浪打百分比傷害20/30/40/40及Blockly改10/15/20/20`,async()=>{
   const run=async(s:any)=>h.play(side,{self:h.unit('S',10000,[s],{speed:200}),opp:h.unit('E',1000000,[h.wait()])},4);
   const base=await run(strip(wave(),5)),r=await run(wave()),custom=await run(editedWave);
   let prior=0,priorEdit=0;for(let i=0;i<4;i++){const diff=base[i].opp.currentHp-r[i].opp.currentHp;const e=base[i].opp.currentHp-custom[i].opp.currentHp;assert.equal(diff-prior,[2000,3000,4000,4000][i]);assert.equal(e-priorEdit,[1000,1500,2000,2000][i]);prior=diff;priorEdit=e;}
  });
  await check(`${side} 王技只交換低於對方的等級；無可交換不授無效或增傷`,async()=>{
   const run=async(st:any,ot:any)=> (await h.play(side,{self:h.unit('S',10000,[king()],{maxHp:100000,speed:200,statStages:st}),opp:h.unit('E',1000000,[h.wait()],{statStages:ot})}))[0];
   const r=await run({atk:-2,def:3},{atk:2,def:1,spatk:2});assert.equal(r.self.statStages.atk,2);assert.equal(r.opp.statStages.atk,-2);assert.equal(r.self.statStages.def,3);assert.equal(r.opp.statStages.def,1);assert.equal(r.self.statStages.spatk,2,'缺省0的特攻也應交換');
   const no=await run({atk:3},{atk:1});assert.ok(!no.state[`${side}Timers`].some((t:any)=>t.payload?.block?.invalidNext||t.payload?.block?.dmgOut));
  });
  await check(`${side} 浪打每擊判定可編輯，3擊各升三項，附加封印不升`,async()=>{
   const run=async(pct:number,sealed=false)=>{const s=wave();s.name='自訂每擊'+pct;for(const e of s.kit){if(e.order===1)Object.assign(e.params.clause.body[0].acts[0].p,{min:3,max:3});if(e.order===2)e.params.clause.body[0].cond[0].p.pct=pct;}
    validateKit(s.kit);return (await h.play(side,{self:h.unit('S',10000,[s],{speed:200,extra:{isAdditionalInvalid:sealed}}),opp:h.unit('E',1000000,[h.wait()])}))[0];};
   const yes=await run(100),no=await run(100,true);for(const k of ['atk','speed','accuracy']){assert.equal(yes.self.statStages[k],3);assert.equal(no.self.statStages[k]||0,0);}assert.equal(yes.self.statStages.def||0,0);
  });
  await check(`${side} 正式浪打5至10擊逐擊事件各一次，三項強化同步`,async()=>{
   const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');const events:any[]=[];
   h.S.S=(_:any,ev:any,data:any)=>{if(ev===T.AFTER_ATTACK_HIT)events.push(data);};
   try{const [r]=await h.play(side,{self:h.unit('S',10000,[wave()],{speed:200}),opp:h.unit('E',1000000,[h.wait()])});assert.ok(events.length>=5&&events.length<=10);assert.deepEqual(events.map(x=>x.hitIndex),Array.from({length:events.length},(_,i)=>i));assert.ok(events.every(x=>x.hitCount===events.length));assert.equal(r.self.statStages.atk||0,r.self.statStages.speed||0);assert.equal(r.self.statStages.atk||0,r.self.statStages.accuracy||0);
   }finally{delete h.S.S;}
  });
  await check(`${side} 浪打星火條件75%增傷，低血只翻增量至150%`,async()=>{
   const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
   h.S.S=(ctx:any,ev:any)=>{if(ev===T.ON_ENTRANCE)ctx.setMark({id:'fixture-burn',name:'星火之灼',count:1,ownerBattleId:ctx.target.battleId,persistsOffField:true,clearable:false},ctx.targetSide);};
   try{for(const hp of [10000,900000]){
    const run=async(boost:boolean)=>{let s=strip(wave(),5);if(!boost)s=strip(s,4);return (await h.play(side,{self:h.unit('S',hp,[s],{maxHp:1000000,speed:200,extra:{soulMark:{name:'測試',description:''}}}),opp:h.unit('E',500000,[h.wait()])}))[0];};
    const base=await run(false),r=await run(true),d=500000-base.opp.currentHp,actual=500000-r.opp.currentHp;assert.ok(Math.abs(actual-d*(hp<500000?2.5:1.75))<=3,`${d}→${actual}`);
   }}finally{delete h.S.S;}
  });
  await check(`${side} 王技雙方PP0每槽加威力，Blockly改增量真生效`,async()=>{
   const run=async(s:any)=> (await h.play(side,{self:h.unit('S',1000,[{...s,pp:2}, {...h.wait(),name:'零甲',pp:0}],{maxHp:100000,speed:200}),opp:h.unit('E',1000000,[h.wait(),{...h.wait(),name:'零乙',pp:0}])}))[0];
   const b=await run(strip(king(),3)),r=await run(king()),edited=await run(editedKing);const d=1000000-b.opp.currentHp;
   assert.ok(Math.abs((1000000-r.opp.currentHp)-d*2.35)<4);assert.ok(Math.abs((1000000-edited.opp.currentHp)-d*1.95)<4);
   assert.equal(r.self.currentHp,1000+1000000-r.opp.currentHp,'攻擊傷害100%吸取真正恢復體力');
  });
  await check(`${side} 王技能力下降先制3是固有，附加封印仍先手、固有封印才停止`,async()=>{
   for(const sealed of ['none','attached','innate']){
    const [r]=await h.play(side,{self:h.unit('S',10000,[king()],{speed:10,statStages:{atk:-1},extra:{isAdditionalInvalid:sealed==='attached',isInherentInvalid:sealed==='innate'}}),opp:h.unit('E',1000000,[{...h.wait(),name:'敵方先制2',priority:2}],{speed:200})});
    const own=r.logs.findIndex((x:string)=>x.includes('【S】使用了')),enemy=r.logs.findIndex((x:string)=>x.includes('【E】使用了'));assert.ok(own>=0&&enemy>=0);assert.equal(own<enemy,sealed!=='innate');
   }
   const {handleScarlettSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/scarlett/registry.ts');h.S.S=handleScarlettSoulMark;
   try{const [r]=await h.play(side,{self:h.unit('S',10000,[king()],{maxHp:100000,speed:10,statStages:{atk:-1},extra:{soulMark:{name:'燦',description:''}}}),opp:h.unit('E',1000000,[{...h.wait(),name:'敵方先制4',priority:4}],{speed:200})});
    assert.ok(r.logs.findIndex((x:string)=>x.includes('【E】使用了'))<r.logs.findIndex((x:string)=>x.includes('【S】使用了')),'真實魂印不疊加舊先制，+3不能超過+4');
   }finally{delete h.S.S;}
  });
  await check(`${side} 王技交換成功無效下一次攻擊，屬性等待不耗增傷次數`,async()=>{
   const attack={...h.wait(),name:'實際攻擊',category:'物理',power:100};
   const r=await h.play(side,{self:h.unit('S',10000,[king(),h.wait(),attack],{maxHp:100000,speed:200,statStages:{atk:-2}}),opp:h.unit('E',1000000,[h.wait(),attack],{statStages:{atk:2}}),turns:(_,t)=>[t===1?0:t===2?1:2,t<3?0:1]},4);
   assert.ok(r[1].state[`${side}Timers`].some((t:any)=>t.remaining===1&&t.payload?.nextAttackDamageModifier?.multiplier===2.5),'等待後仍保留下次攻擊增傷');
   assert.equal(r[2].self.currentHp,r[1].self.currentHp,'對手第三回合攻擊無效');assert.ok(r[3].self.currentHp<r[2].self.currentHp,'無效只用一次');
   assert.ok(!r[2].state[`${side}Timers`].some((t:any)=>t.payload?.nextAttackDamageModifier));
   const control=king();control.name='交換增傷對照';control.kit.find((e:any)=>e.order===2).params.clause.body[1].acts=control.kit.find((e:any)=>e.order===2).params.clause.body[1].acts.filter((a:any)=>!['boost','dmg_mod_uses'].includes(a.op));
   const base=await h.play(side,{self:h.unit('S',10000,[control,h.wait(),attack],{maxHp:100000,speed:200,statStages:{atk:-2}}),opp:h.unit('E',1000000,[h.wait(),attack],{statStages:{atk:2}}),turns:(_,t)=>[t===1?0:t===2?1:2,t<3?0:1]},4);
   assert.ok(Math.abs((1000000-r[0].opp.currentHp)-(1000000-base[0].opp.currentHp)*2.5)<=2,'當回合攻擊增傷150%');
   assert.ok(Math.abs((r[1].opp.currentHp-r[2].opp.currentHp)-(base[1].opp.currentHp-base[2].opp.currentHp)*2.5)<=2,'等待後下次攻擊增傷150%');
  });
 }
 assert.equal(calls,0);console.log(`GLM新圖紙整合驗收 ${checks} 項通過`);
}finally{for(const [n,f]of originals)if(f)reg[n]=f;else delete reg[n];await h.close();}
