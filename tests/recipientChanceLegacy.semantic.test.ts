import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';

const h=await createHarness();
const a=(op:string,p:any)=>({op,p,label:op});
try {
 const {runStmts,runClause}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
 const {executeTemplateEffect}=await h.server.ssrLoadModule('/src/effects/templateEngine.ts');
 const {executeGenericSkillText,applyEffectDetail}=await h.server.ssrLoadModule('/src/effects/genericSkillText.ts');
 const {runGenericSoulMark}=await h.server.ssrLoadModule('/src/effects/genericSoulMark.ts');
 const {EffectTiming}=await h.server.ssrLoadModule('/src/effects/types.ts');
 const {stoneAfterHit}=await h.server.ssrLoadModule('/src/effects/skillStoneEffects.ts');
 const {createSkillStone}=await h.server.ssrLoadModule('/src/data/skillStones.ts');
 const {afterSkillHit}=await h.server.ssrLoadModule('/src/effects/traitEffects.ts');
 const {SuitEffectRegistry}=await h.server.ssrLoadModule('/src/effects/suitEffectRegistry.ts');
 for(const side of ['p1','p2'] as const) {
  const opp=side==='p1'?'p2':'p1';
  const self=h.unit('E',1000,[h.wait()]),target=h.unit('H',1000,[h.wait()]);
  const mark={id:'guarantee',count:1,scope:'elf',ownerBattleId:'H',effects:{incomingEffectChanceGuaranteed:1}};
  const hits:any[]=[];let healed=0;
  const ctx:any={actor:side,targetSide:opp,self,target,activeP1:side==='p1'?self:target,activeP2:side==='p2'?self:target,skill:{...h.wait(),name:'測試'},roundNumber:1,
   getMarks:(s:string)=>s===opp?[mark]:[],getFullTeam:(s:string)=>[s===side?self:target],getPlayerState:()=>undefined,getOpponentState:()=>undefined,getStatuses:()=>({}),
   setPlayerState:()=>{},setOpponentState:()=>{},
   applyStatusWithImmunityCheck:(s:string,n:string)=>{hits.push([s,n]);return {success:true};},applyStatChange:(s:string,v:any)=>hits.push([s,v]),applyHeal:()=>{healed++;},addLog:()=>{},rng:()=>.999,
  };
  const chance:any={c:'chance',p:{pct:1},label:'1%'};
  const state=()=>({last:null,lastAmount:0,conditionSnapshots:new Map([['chance:{"pct":1}',false]])});
  const acts=[a('status',{side:'both',status:'燒傷',chance:100}),a('heal_flat',{amount:200})];
  runStmts(ctx,[{cond:[chance],acts,elseActs:[a('heal_flat',{amount:500})]}],state());
  assert.deepEqual(hits,[[opp,'燒傷']]);assert.equal(healed,0,'不保證同段自身回血，主效果通過也不執行失敗補償');hits.length=0;
  runClause(ctx,{raw:'整句機率',trig:'use',parsed:true,cond:[chance],body:[{acts:[a('status',{side:'opp',status:'凍傷',chance:100})]}]},state());
  assert.deepEqual(hits,[[opp,'凍傷']]);hits.length=0;
  runStmts(ctx,[{cond:[chance,{c:'hp_full',p:{side:'self'},label:'滿血'}],acts:[a('status',{side:'opp',status:'中毒',chance:100})]}],{...state(),conditionSnapshots:new Map([['chance:{"pct":1}',false],['hp_full:{"side":"self"}',false]])});
  assert.equal(hits.length,0,'保證機率不能繞過其他條件');
  executeTemplateEffect('0012',[0],ctx);assert.equal(hits.at(-1)?.[0],opp);hits.length=0;
  ctx.skill={...h.wait(),description:'0%令對手燒傷'};executeGenericSkillText(ctx);assert.deepEqual(hits,[[opp,'燒傷']]);hits.length=0;
  ctx.skill={...h.wait(),description:'0%令雙方燒傷'};executeGenericSkillText(ctx);assert.deepEqual(hits,[[opp,'燒傷']]);hits.length=0;
  ctx.skill={...h.wait(),effectDetail:'burn:0%'};applyEffectDetail(ctx);assert.deepEqual(hits,[[opp,'燒傷']]);hits.length=0;
  ctx.skill={...h.wait(),category:'物理'};self.soulMark={effectType:'burn_chance',effectValue:0};runGenericSoulMark(ctx,EffectTiming.AFTER_ACTION,{},self);assert.deepEqual(hits,[[opp,'燒傷']]);hits.length=0;
  ctx.skill=createSkillStone('電','S','物理',true,'attr_electric_para');let pct=0;stoneAfterHit(ctx,(_key:string,p:number)=>{pct=p;return p===100;});assert.equal(pct,100);assert.equal(hits[0]?.[0],opp);
  let fixed=0;ctx.applyFixedDamage=()=>{fixed++;};ctx.skill={...h.wait(),category:'物理'};
  self.alienTraits={generalTrait:{name:'絕命'}};
  const targetCtx={...ctx,actor:opp,targetSide:side,self:target,target:self,getMarks:(s:string)=>s===opp?[mark]:[]};
  afterSkillHit(self,target,ctx.skill,100,false,ctx,targetCtx,()=>.999);assert.equal(fixed,1,'舊通用特性固傷入口');
  hits.length=0;SuitEffectRegistry.void_traveler({...ctx,skill:h.wait()},EffectTiming.AFTER_ACTION,{});assert.equal(hits.length,1,'舊套裝異常入口');
  console.log(`✓ ${side} 舊文字、模板、魂印、技能石與整段機率；混合目標與其他條件隔離`);

  const grant=h.kitSkill('印記',[a('mark_program',{id:'chance',name:'受方保證',displayChar:'火',description:'受方機率保證',side:'self',mode:'set',count:1,maxCount:1,scope:'elf',persistsOffField:true,unit:'道',incomingEffectChanceGuaranteed:true,rules:[]})]);
  const strike=h.kitSkill('條件弱化',[]);strike.kit[0].params.clause.body=[{cond:[chance],acts:[a('stat',{side:'opp',stats:['防禦'],v:-1}),a('stat',{side:'self',stats:['攻擊'],v:1})]}];
  const history=await h.play(side,{self:h.unit('持有者',10000,[grant,h.wait()],{speed:200}),opp:h.unit('施加者',10000,[h.wait(),strike]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
  assert.equal(history[1].self.statStages.def,-1);assert.equal(history[1].opp.statStages.atk||0,0);
 }
}finally{await h.close();}

