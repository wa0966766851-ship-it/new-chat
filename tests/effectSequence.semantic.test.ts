import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { validateKit } from '../src/effects/kitValidation';
import { kitEntryIssue } from '../src/effects/effectConnection';
import { distillEffect } from '../src/effects/distillEffect';
import type { Clause, Stmt } from '../src/blocks/model';
import type { KitEntry, Node } from '../src/effects/effectSystem.schema';
import { addTimer, tickTimers } from '../src/battle/timers';
let count=0;
const check=(name:string,run:()=>void)=>{run();count++;console.log(`✓ ${name}`);};
const act=(op:string,p:any)=>({op,p,label:op});
const entry=(body:Stmt[],node:Node='on_skill_use',cond:any[]=[],trig:Clause['trig']='use'):KitEntry=>({
  codeId:'effect_sequence',source:'skill',role:'attached',node,order:0,customText:'測試原句',
  params:{clause:{raw:'測試原句',trig,parsed:true,cond,body}}});
defineCustomBlocks();
const sequence=entry([{acts:[act('stat_clear',{side:'opp',kind:'up'})]},
  {chain:'success',acts:[act('stat',{side:'opp',stats:['全屬性'],v:-1})]},
  {chain:'fail',acts:[act('heal_flat',{amount:17})]}]);
check('成敗連鎖有正式合約；死鍵、unknown、custom和非正式觸發都被拒絕',()=>{
  validateKit([sequence]);assert.equal(kitEntryIssue(sequence),null);
  for(const bad of [entry([{acts:[act('custom',{key:'舊handler'})]}]),entry([{acts:[act('ignore',{what:'正先制'})]}]),
    entry([{acts:[act('stat',{side:'opp',stats:['宇宙'],v:1})]}]),entry([{acts:[act('dmg',{flat:70,type:'技能'})]}]),
    entry([{acts:[act('boost',{mult:1.7,kind:'攻擊'})]}],'on_hit',[],'after_hit'),
    entry([{acts:[act('heal_flat',{amount:1})]}],'on_skill_use',[],'custom'),
    entry([{acts:[act('heal_flat',{amount:1})],cond:[{c:'hp_full',p:{side:'both'},label:''}]}])])assert.ok(kitEntryIssue(bad));
});
check('巢狀連鎖／前置及即時條件公開存檔可重載，修改第二個數值不改第一個',()=>{
  const source=entry([{pre:true,cond:[{c:'stage',p:{side:'self',kind:'up'},label:'原有提升'}],acts:[act('stat',{side:'self',stats:['攻擊'],v:1})]},
    {chain:'success',live:true,acts:[act('heal_flat',{amount:37})],elseActs:[act('heal_flat',{amount:11})]}]);
  const ws=new Blockly.Workspace();const block=buildEntryBlock(ws as any,source)!;assert.equal(block.type,'effect_sequence');
  const copy=new Blockly.Workspace();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),copy);
  const restored=copy.getBlockById(block.id)!;assert.deepEqual(createKitBlockParser('skill')(restored,source.node),source);
  restored.getInputTargetBlock('BODY')!.getNextBlock()!.getInputTargetBlock('ACTS')!.setFieldValue('{"amount":70}','PARAMS');
  const edited=createKitBlockParser('skill')(restored,source.node)!;validateKit([edited]);
  assert.equal(edited.params.clause.body[1].acts[0].p.amount,70);assert.equal(edited.params.clause.body[0].acts[0].p.v,1);
  restored.getInputTargetBlock('BODY')!.getNextBlock()!.getInputTargetBlock('ACTS')!.setFieldValue('{broken','PARAMS');
  assert.throws(()=>createKitBlockParser('skill')(restored,source.node));
  ws.dispose();copy.dispose();
});
check('技能固有必中為boolean、負先制為signed，不能偷偷降成附加',()=>{
  for(const [property,value,node] of [['sure_hit',true,'before_skill'],['base_priority',-3,'modify_priority']] as const) {
    const source:KitEntry={codeId:'skill_property',source:'skill',role:'innate',order:0,node,params:{property,value,conditions:[]}};
    validateKit([source]);assert.equal(kitEntryIssue(source),null);
    const ws=new Blockly.Workspace();const b=buildEntryBlock(ws as any,source)!;assert.equal(b.type,'skill_property');
    assert.deepEqual(createKitBlockParser('skill')(b,node),source);ws.dispose();
    assert.ok(kitEntryIssue({...source,role:'attached'}));assert.ok(kitEntryIssue({...source,node:'on_hit'}));
  }
});
check('內建原文生成連鎖，不用對應精靈handler；未知句阻止整份套用',()=>{
  const description='■ 先制+3\n■ 必中\n🎯 消除對手能力提升狀態，消除成功則對手全屬性-1';
  const result=distillEffect({name:'改名自訂',description},'skill');assert.equal(result.complete,true,JSON.stringify(result.issues));
  assert.deepEqual(result.kit.map(e=>e.codeId),['skill_property','skill_property','effect_sequence']);
  const partial=distillEffect({name:'改名自訂',description:description+'\n宇宙折疊沒有定義'},'skill');
  assert.equal(partial.complete,false);assert.equal(partial.kit.length,3);assert.ok(partial.issues.some(i=>i.text.includes('宇宙')));
});
check('持續連鎖校驗巢狀動作與期限，不接受只有名稱的假效果',()=>{
  validateKit([entry([{acts:[act('timed',{turns:2,from:'next',trig:'round_start',body:[{acts:[act('heal_flat',{amount:70})]}]})]}])]);
  for(const p of [{turns:2,from:'now',trig:'use',body:[{acts:[act('heal_flat',{amount:1})]}]},
    {turns:2,from:'next',trig:'round_start',body:[{acts:[act('custom',{key:'不存在'})]}]},
    {turns:0,from:'next',trig:'round_start',body:[{acts:[act('heal_flat',{amount:1})]}]}])assert.ok(kitEntryIssue(entry([{acts:[act('timed',p)]}])));
});
check('簡單原子不能丟掉條件翻倍；必須保留完整動作參數',()=>{
  const result=distillEffect({name:'條件式降級防護',description:'🎯 恢復自身100點體力，先出手時效果翻倍'},'skill');
  assert.equal(result.complete,true,JSON.stringify(result.issues));
  assert.equal(result.kit[0].codeId,'effect_sequence');
  assert.equal(result.kit[0].params.clause.body[0].acts[0].p.x2If.c,'first');
});
check('巢狀異常與条件也逐層校驗；損壞連鎖預覽保留問題，不拋錯',()=>{
  for(const body of [[{acts:[act('timed',{turns:2,from:'now',trig:'round_start',body:[{acts:[act('status',{side:'opp',status:'尚未命名的異常'})]}]})]}],
    [{cond:[{c:'has_status',p:{side:'opp',status:'不存在'},label:''}],acts:[act('heal_flat',{amount:7})]}]])assert.ok(kitEntryIssue(entry(body)));
  const invalid:KitEntry={codeId:'skill_property',source:'skill',role:'innate',order:0,node:'before_skill',params:{property:'sure_hit',value:true,conditions:[{c:'first',p:{},label:''}]}};
  assert.ok(kitEntryIssue(invalid));
});
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try {
  const {runConnectedKit}=await server.ssrLoadModule('/src/effects/connectedEffects.ts');
  const {runSideTimers}=await server.ssrLoadModule('/src/blocks/runtime.ts');
  const {skillBasePriority}=await server.ssrLoadModule('/src/battle/conditionalPriority.ts');
  const {computeHitChance}=await server.ssrLoadModule('/src/effects/genericSkillText.ts');
  const {compileEffectPlan}=await server.ssrLoadModule('/src/effects/effectConnection.ts');
  const {applyKitPpOperation}=await server.ssrLoadModule('/src/effects/ppOperations.ts');
  for(const side of ['p1','p2'] as const)check(`${side}連鎖PP逐槽操作遵守恢復限制、星護、即時讀值與消耗事件`,()=>{
    const {ctx,teams,other}=context(side),events:any[]=[];
    const skill=(name:string,pp:number,maxPp=20)=>({name,pp,currentPp:pp,maxPp,category:'屬性',type:'普通',power:0});
    teams[side][0].skills=[skill('第一槽',2),skill('第二槽',4)];teams[other][0].skills=[skill('對手1',1),skill('對手2',3)];
    ctx.updateAnyElf=(s:string,_id:string,patch:any)=>ctx.updateElf(s,patch);
    ctx.emitElfEvent=(s:string,_elf:any,event:string,d:any)=>events.push([s,event,d]);
    ctx[`${side}Timers`]=[{id:'pp限制',remaining:2,ownerBattleId:'self',payload:{ppRecoveryReductionPercent:0.5}}];
    const e=entry([{acts:[act('pp_op',{side:'opp',mode:'drain',amount:2})]},
      {acts:[act('pp_op',{side:'self',mode:'add',amount:2})]}]);
    validateKit([e]);runConnectedKit(e.node,{name:'逐槽PP連鎖',kit:[e]},ctx);
    assert.deepEqual(teams[side][0].skills.map((s:any)=>s.pp),[4,6]);assert.deepEqual(teams[other][0].skills.map((s:any)=>s.pp),[0,1]);
    assert.equal(events[0][0],other);assert.equal(events[0][1],'PP_CHANGED');assert.deepEqual(events[0][2].consumedSlots,[0,1]);
    assert.equal(events[0][2].removed,3);assert.equal(events.length,3);
    assert.equal(teams[side][0].skills[0].currentPp,4);
    teams[other][0].battleStatuses={'星護':3};teams[other][0].skills=[skill('歸零星護',1)];
    assert.equal(applyKitPpOperation(ctx,other,'zero'),true);assert.equal(teams[other][0].skills[0].pp,20);
    assert.equal(events.at(-1)[2].reason,'clear');
  });
  check('損壞連鎖預覽保留原文及錯誤，仍有可顯示body',()=>{
    const plan=compileEffectPlan({name:'損壞圖紙',effectMode:'kit',kit:[{...sequence,params:{clause:null}}]},'skill');
    assert.equal(plan.issues.length,1);assert.equal(plan.program.clauses[0].parsed,false);assert.ok(plan.program.clauses[0].body.length);
  });
  for(const [description,type,value] of [['吸取對手70點體力','fixed',70],['吸取對手最大體力1/3','percent',333],['吸取對手當前體力50%','percent',500],['汲取對手70點體力','true',70],['汲取對手當前體力50%','true',500]] as const)check(`${description}序列化前後數值／傷害分類一致`,()=>{
    const result=distillEffect({name:'無handler吸取',description},'skill');assert.equal(result.complete,true,JSON.stringify(result.issues));
    assert.deepEqual(JSON.parse(JSON.stringify(result.kit)),result.kit);
    const {ctx,heals}=context('p1');const damage:any[]=[];
    ctx.applyPinkDamage=(_side:string,n:number,_label:any,_elem:any,_node:any,kind:string)=>{damage.push([kind,n]);return n;};
    ctx.applyTrueDamage=(_side:string,n:number)=>{damage.push(['true',n]);return n;};
    runConnectedKit('on_skill_use',{name:'無handler吸取',kit:result.kit},ctx);assert.deepEqual(damage,[[type,value]]);assert.deepEqual(heals,[['p1',value]]);
  });
  function context(side:'p1'|'p2',boosted=false) {
    const other=side==='p1'?'p2':'p1';const initial:any={id:'self',battleId:'self',currentHp:300,maxHp:1000,statStages:{},skills:[]};
    const enemy:any={id:'enemy',battleId:'enemy',currentHp:1000,maxHp:1000,statStages:{atk:boosted?2:0,def:0}};
    const teams:any={[side]:[initial],[other]:[enemy]},state:any={},heals:any[]=[];
    const ctx:any={actor:side,targetSide:other,self:initial,target:enemy,activeP1:side==='p1'?initial:enemy,activeP2:side==='p2'?initial:enemy,
      getFullTeam:(s:string)=>teams[s],getStatuses:(e:any)=>e.battleStatuses || {},getMarks:()=>[],addLog:()=>{},
      getPlayerState:(k:string)=>state[k],getOpponentState:(k:string)=>state[`opp:${k}`],
      setPlayerState:(k:string,v:any)=>state[k]=v,setOpponentState:(k:string,v:any)=>state[`opp:${k}`]=v,
      updateElf:(s:string,p:any)=>teams[s][0]={...teams[s][0],...p},
      applyHeal:(s:string,n:number)=>{heals.push([s,n]);const e=teams[s][0];teams[s][0]={...e,currentHp:Math.min(e.maxHp,e.currentHp+n)};return n;},
      applyStatChange:(s:string,ch:any)=>{const e=teams[s][0],statStages={...e.statStages};for(const [k,v] of Object.entries(ch))statStages[k]=Math.max(-6,Math.min(6,(statStages[k]||0)+Number(v)));teams[s][0]={...e,statStages};},
      p1Timers:[],p2Timers:[],moveIndex:0,roundNumber:1,clearTurnEffectsOf:()=>false,
      addTimerTo:(s:string,t:any)=>{ctx[`${s}Timers`]=addTimer(ctx[`${s}Timers`],{...t,ownerBattleId:teams[s][0].battleId},{isLateMover:false});}};
    return {ctx,teams,state,heals,other};
  }
  for(const side of ['p1','p2'] as const) for(const boosted of [false,true])check(`${side}消強成敗接後句，連鎖不因下一次執行保留結果`,()=>{
    const {ctx,teams,other,heals}=context(side,boosted);
    runConnectedKit('on_skill_use',{name:'改名不借handler',kit:[sequence]},ctx);
    assert.equal(teams[other][0].statStages.atk,boosted?-1:0);assert.equal(teams[other][0].statStages.def,boosted?-1:0);
    assert.deepEqual(heals,boosted?[]:[[side,17]]);
    const continuation=entry([{chain:'success',acts:[act('heal_flat',{amount:999})]}]);
    runConnectedKit('on_skill_use',{name:'新事件不串位',kit:[continuation]},ctx);assert.equal(heals.length,boosted?0:1);
  });
  for(const live of [false,true])check(`同一句低血條件${live?'即時':'開始快照'}；回血後是否繼續降防有明確區別`,()=>{
    const {ctx,teams,other}=context('p1');const cond=[{c:'hp_ratio',p:{side:'self',op:'低於',ratio:0.5},label:'低於半血'}];
    const e=entry([{cond,acts:[act('heal_flat',{amount:300})]},{cond,live,acts:[act('stat',{side:'opp',stats:['防禦'],v:-1})]}]);
    runConnectedKit(e.node,{name:'快照測試',kit:[e]},ctx);assert.equal(teams.p1[0].currentHp,600);assert.equal(teams[other][0].statStages.def,live?0:-1);
  });
  for(const boosted of [false,true])check(`條件式翻倍取事件開始快照，清強後仍保持原先${boosted?'有':'無'}提升的倍數`,()=>{
    const {ctx,teams,other,heals}=context('p1',boosted),x2If={c:'stage',p:{side:'opp',kind:'up'},label:'對手原有提升'};
    const definition={name:'跨子句翻倍快照',kit:[entry([{acts:[act('stat_clear',{side:'opp',kind:'up'})]}]),
      {...entry([{acts:[act('heal_flat',{amount:70,x2If})]}]),order:1}]};
    runConnectedKit('on_skill_use',definition,ctx);assert.deepEqual(heals,[['p1',boosted?140:70]]);assert.equal(teams[other][0].statStages.atk,0);
    const noFull=[{c:'hp_full',p:{side:'self'},label:''}];
    runConnectedKit('on_skill_use',{name:'否則翻倍',kit:[entry([{cond:noFull,acts:[act('heal_flat',{amount:1})],elseActs:[act('heal_flat',{amount:7,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:0.9},label:''}})]}])]},ctx);
    assert.deepEqual(heals.at(-1),['p1',14]);
  });
  check('否則分支的成功結果能接下句；前置條件也記錄成敗，不吞成功後回血',()=>{
    const {ctx,teams,heals}=context('p1');
    const e=entry([{cond:[{c:'hp_full',p:{side:'self'},label:''}],acts:[act('heal_flat',{amount:1})],elseActs:[act('heal_flat',{amount:37})]},
      {chain:'success',pre:true,cond:[{c:'hp_ratio',p:{side:'self',op:'低於',ratio:0.5},label:''}],acts:[act('heal_flat',{amount:70})]},
      {chain:'success',acts:[act('heal_flat',{amount:11})]}]);
    runConnectedKit(e.node,{name:'否則與前置',kit:[e]},ctx);assert.deepEqual(heals,[['p1',37],['p1',70],['p1',11]]);assert.equal(teams.p1[0].currentHp,418);
  });
  check('Kit的必中及基礎先制由正式命中／先制入口讀取，不靠原句且不重複加算',()=>{
    const {ctx}=context('p1');const skill:any={name:'自訂必中',effectMode:'kit',accuracy:0,priority:3,category:'物理',kit:[
      {codeId:'skill_property',source:'skill',role:'innate',node:'before_skill',order:0,params:{property:'sure_hit',value:true}},
      {codeId:'skill_property',source:'skill',role:'innate',node:'modify_priority',order:1,params:{property:'base_priority',value:3}}]};
    assert.equal(computeHitChance(ctx.self,ctx.target,skill,()=>({})),1);assert.equal(skillBasePriority(skill,ctx.self,ctx.target,()=>({})),3);
    assert.equal(computeHitChance({...ctx.self,isInherentInvalid:true},ctx.target,skill,()=>({})),0);
    assert.equal(skillBasePriority(skill,ctx.self,ctx.target,()=>({}),true),0);
  });
  for(const source of ['skill','soulmark'] as const)check(`${source}下2回合連鎖當回合不生效，兩次後到期，來源分類不混淆`,()=>{
    const {ctx,heals}=context('p1');const e={...entry([{acts:[act('timed',{turns:2,from:'next',trig:'round_start',body:[{acts:[act('heal_flat',{amount:70})]}]})]}]),source};
    runConnectedKit(e.node,{name:'持續來源',kit:[e]},ctx);assert.equal(ctx.p1Timers[0].kind,source==='skill'?'turn_effect':'round_counter');
    assert.equal(ctx.p1Timers[0].remaining,2);assert.equal(ctx.p1Timers[0].pendingActivation,true);
    runSideTimers(ctx,['round_start'],{});assert.equal(heals.length,0);
    ctx.p1Timers=tickTimers(ctx.p1Timers,'round_end');
    for(let i=0;i<2;i++){runSideTimers(ctx,['round_start'],{});ctx.p1Timers=tickTimers(ctx.p1Timers,'round_end');}
    runSideTimers(ctx,['round_start'],{});assert.deepEqual(heals,[['p1',70],['p1',70]]);assert.equal(ctx.p1Timers.length,0);
  });
  for(const damageType of ['skill_attack','skill_attribute','fixed','percent','true'])check(`受攻擊／技能連鎖不套到${damageType}以外分類`,()=>{
    const {ctx,heals}=context('p1');ctx.damageType=damageType;ctx.typedSkill=damageType==='skill_attribute';
    const attack=entry([{acts:[act('heal_flat',{amount:7})]}],'on_damaged',[],'damaged_attack');
    const skill=entry([{acts:[act('heal_flat',{amount:11})]}],'on_damaged',[],'damaged_skill');
    runConnectedKit('on_damaged',{name:'受擊分類',kit:[attack,{...skill,order:1}]},ctx);
    assert.deepEqual(heals,damageType==='skill_attack'?[['p1',7],['p1',11]]:damageType==='skill_attribute'?[['p1',11]]:[]);
  });
} finally {await server.close();}
console.log(`效果連鎖／固有查詢／完整畫布儲存 ${count} 項通過。`);
