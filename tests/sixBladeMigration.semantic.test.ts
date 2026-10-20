import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_SIX_BLADE_SKILL_KITS as defs} from '../src/data/migratedSixBladeSkillKit';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {handleWuxuSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/wuxu/registry.ts');
const reg=getBattleSkillRegistry(),old=reg['六刃碎界斷'];reg['六刃碎界斷']=()=>{calls++;throw Error('舊技能重播');};
const sk=()=>structuredClone(h.find('5022','六刃碎界斷'));
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const slice=(s:any,orders:number[])=>({...s,kit:s.kit.filter((e:any)=>orders.includes(e.order))});
let edited:any;
try{
 await check('完整原文與Blockly保存往返；每PP連擊3→2、雙攻66%→50%、窗口3→2保存改名',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,(source as any)['5022'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...s,name:'自訂六刃',kit:s.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
   for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'){const op=x.getFieldValue('OP'),p=JSON.parse(x.getFieldValue('PARAMS'));if(op==='pp_combo_hits')p.perPp=2;if(op==='dmg'&&p.of==='self')p.ratio=.5;if(op==='timed')p.turns=2;x.setFieldValue(JSON.stringify(p),'PARAMS');}
   w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;})};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 正式逐擊數PP2為7擊，改值5擊；附加封印不抹固有`,async()=>{
   for(const [s,extra,hits] of [[sk(),{},7],[edited,{},5],[sk(),{isAdditionalInvalid:true},7],[sk(),{isInherentInvalid:true},1]] as any){const events:any[]=[];h.S.S=(_:any,e:any,d:any)=>{if(e===T.AFTER_ATTACK_HIT)events.push(d);};
    try{await h.play(side,{self:h.unit('S',10000,[{...s,pp:2}],{speed:200,extra}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(events.length,hits);assert.deepEqual(events.map(d=>d.hitIndex),Array.from({length:hits},(_,i)=>i));assert.ok(events.every(d=>d.hitCount===hits));}finally{delete h.S.S;}
   }
  });
  await check(`${side} 雙攻600×66%實扣396百分比、編輯50%實扣300，不走真傷`,async()=>{
   const events:any[]=[];h.S.E=(_:any,e:any,d:any)=>{if(e===T.ON_DAMAGED)events.push(d);};
   try{for(const [s,n] of [[sk(),396],[edited,300]] as any){const run=async(skill:any)=>(await h.play(side,{self:h.unit('S',10000,[skill],{speed:200}),opp:h.unit('E',1000000,[h.wait()])}))[0];const b=await run(slice(s,[0,1,2])),r=await run(slice(s,[0,1,2,4]));assert.equal(b.opp.currentHp-r.opp.currentHp,n);assert.ok(events.some(d=>String(d.damageType).includes('percent')));assert.ok(!events.some(d=>String(d.damageType).includes('true')));events.length=0;}}finally{delete h.S.E;}
  });
  await check(`${side} 真實六刃魂印不再給Kit額外先制；技能PP2只先制2`,async()=>{
   h.S['無序·六刃']=(c:any,e:any,d:any)=>{if(e===T.MODIFY_PRIORITY)handleWuxuSoulMark(c,e,d);};
   try{const [r]=await h.play(side,{self:h.unit('S',10000,[{...sk(),pp:2}],{speed:200,extra:{name:'無序·六刃'}}),opp:h.unit('E',1000000,[{...h.wait(),priority:3}])});const used=(l:any)=>/^【.*】使用了【/.test(l.text||"");const own=r.state.logs.findIndex((l:any)=>l.type===side&&used(l)),opp=r.state.logs.findIndex((l:any)=>l.type!==side&&used(l));assert.ok(own>=0&&opp>=0&&opp<own,JSON.stringify({side,logs:r.logs}));assert.equal(r.state[`${side}RegistryState`]['wuxuComboPp:六刃碎界斷']??0,0);}finally{delete h.S['無序·六刃'];}
  });
  await check(`${side} 三回合使用級弱化含當次，到第四回合停止；改兩回合可編輯`,async()=>{
   for(const [s,n] of [[sk(),3],[edited,2]] as any){const r=await h.play(side,{self:h.unit('S',10000,[s,h.wait()],{speed:200}),opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},4);for(let i=0;i<4;i++)for(const k of ['def','spdef'])assert.equal(r[i].opp.statStages[k],-Math.min(i+1,n));}
  });
  await check(`${side} 六回合恢復下降100%真正禁止治療，到第七回合恢復`,async()=>{
   const r=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{speed:200}),opp:h.unit('E',500000,[h.healSkill(1000)],{maxHp:1000000}),turns:(_,t)=>[t===1?0:1,0]},7);for(let i=1;i<6;i++)assert.equal(r[i].opp.currentHp,r[0].opp.currentHp);assert.equal(r[6].opp.currentHp-r[5].opp.currentHp,1000);
  });
  await check(`${side} 弱化失敗補償只在回合末，讀當時雙防1500×66%=990`,async()=>{
   h.S.S=(c:any,e:any)=>{if(e===T.ROUND_END)c.updateElf(c.targetSide,{calculatedStats:{...c.target.calculatedStats,def:1000,spdef:500}});};
   h.S.E=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState('immuneStatDownTurns',99);};
   try{const run=async(s:any)=>(await h.play(side,{self:h.unit('S',10000,[s],{speed:200}),opp:h.unit('E',1000000,[h.wait()])}))[0];const b=await run(slice(sk(),[0,1,2])),r=await run(slice(sk(),[0,1,2,5]));assert.equal(b.opp.currentHp-r.opp.currentHp,990);assert.equal(r.opp.statStages.def||0,0);assert.equal(r.opp.statStages.spdef||0,0);assert.ok(r.state[`${side==='p1'?'p2':'p1'}RegistryState`].attackSkillInvalidTurns>0);
   }finally{delete h.S.S;delete h.S.E;}
  });
  await check(`${side} 一項能下降仍算成功，雙項下限才補償；兩回合攻擊失效會到期`,async()=>{
   for(const both of [false,true]){const s=slice(sk(),[0,1,2,5]);s.kit.find((e:any)=>e.order===5).params.clause.body[0].acts[0].p.turns=1;
    const atk={...h.wait(),name:'普通攻擊',category:'物理',power:30};const r=await h.play(side,{self:h.unit('S',10000,[s,h.wait()],{speed:200}),opp:h.unit('E',1000000,[atk],{statStages:{def:-6,spdef:both?-6:0}}),turns:(_,t)=>[t===1?0:1,0]},3);
    if(both){assert.equal(r[0].self.currentHp,10000);assert.equal(r[1].self.currentHp,10000);assert.ok(r[2].self.currentHp<10000);}else{assert.ok(r[0].self.currentHp<10000);assert.equal(r[0].opp.statStages.spdef,-1);}
   }
  });
  await check(`${side} 首次無效不開窗口，附加封印不啟動，持有者下場不借替補`,async()=>{
   const sealed=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{speed:200,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},2);assert.equal(sealed[1].opp.statStages.def||0,0);
   const enemy=h.kitSkill('先封攻擊',[{op:'invalid_next',p:{kind:'攻擊',uses:1}}],{priority:100});const no=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{speed:200}),opp:h.unit('E',1000000,[enemy,h.wait()]),turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);assert.equal(no[1].opp.statStages.def||0,0);
   const r=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{speed:200}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:t===2?{switch:1}:t===3?{switch:0}:1,0]},4);for(const row of r)assert.equal(row.opp.statStages.def,-1);
  });
  await check(`${side} 恢復限制屬受影響者，下場不借替補且回場不復活`,async()=>{
   const heal=h.healSkill(1000);const r=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{speed:200}),opp:h.unit('E',500000,[heal],{maxHp:1000000}),oppBench:[h.unit('B',500000,[heal],{maxHp:1000000})],turns:(_,t)=>[t===1?0:1,t===2?{switch:1}:t===4?{switch:0}:0]},5);
   assert.equal(r[1].opp.name,'B');assert.equal(r[2].opp.currentHp-r[1].opp.currentHp,1000);assert.equal(r[3].opp.name,'E');assert.equal(r[4].opp.currentHp-r[3].opp.currentHp,1000);
  });
 }
 assert.equal(calls,0);console.log(`六刃碎界斷遷移 ${checks} 項通過，舊技能handler0次`);
}finally{if(old)reg['六刃碎界斷']=old;else delete reg['六刃碎界斷'];await h.close();}
process.exit(0);
