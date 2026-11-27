import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {timedInnateDisabled} from '../src/battle/timedConstraints';
import {finalOdbOperations} from '../src/blocks/ops/finalOdinDeluBeliente';
import {weightEffectOperations} from '../src/blocks/ops/weightEffects';
const h=await createHarness();let checks=0;
const {multiplyDamageReduction}=await h.server.ssrLoadModule('/src/battle/damageReduction.ts');
const tiny:any={damageCategory:'fixed',multiplier:1,decreasePercent:0};multiplyDamageReduction(tiny,1e-25);assert.equal(tiny.multiplier,1e-25);assert.ok(!tiny.incomingDamageImmunity);
try{
 const {DARK_BLAKE_SOUL_KIT:soul}=await h.server.ssrLoadModule('/src/data/darkBlakeSoulKit.ts');
 const {DARK_BLAKE_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/darkBlakeSkills.ts');
 const {isZeroPpExempt}=await h.server.ssrLoadModule('/src/battle/ppExemptions.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 for(const e of [...soul,...skills.flatMap((s:any)=>s.kit)])assert.equal(kitEntryIssue(e),null,e.customText);
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  const probe=h.kitSkill('倍率',[{op:'status',p:{side:'self',status:'狂暴',turns:3,chance:100}},{op:'status_doubling_mods',p:{reduce:.8,boost:1.6,perStatus:10}}],{priority:10});
  const damage=h.kitSkill('固定一億',[{op:'dmg',p:{base:'最大體力',of:'self',ratio:.1,type:'固定'}}]);
  const [scaled]=await h.play(side,{self:h.unit('承受者',1e9,[probe]),opp:h.unit('傷害者',1e9,[damage])});
  assert.ok(Math.abs((1e9-scaled.self.currentHp)-2)<=1,'80%減傷共11次：'+JSON.stringify({hp:scaled.self.currentHp,logs:scaled.logs}));
  assert.ok(scaled.logs.some((l:string)=>l.includes('翻倍 10 次')&&l.includes('163840%')));checks++;
  const entry=(await h.server.ssrLoadModule('/src/data/authoredKitTools.ts')).authoredEntry;
  const immuneSoul={name:'非真實免疫',effectMode:'kit',kit:[entry('非真實免疫','entrance',[{acts:[{op:'damage_multiplier_turns',p:{dir:'in',kind:'非真實',mult:0,turns:3},label:'非真實免疫'}]}],0,'soulmark')]};
  const drainSoul={name:'汲取',effectMode:'kit',kit:soul.filter((e:any)=>e.order===10)};
  const [drained]=await h.play(side,{self:h.unit('汲取者',1000,[{...h.wait(),category:'物理',power:0}],{extra:{soulMark:drainSoul}}),opp:h.unit('非真實免疫',1000,[h.wait()],{extra:{soulMark:immuneSoul}}),turns:()=>[0,'pass']});
  assert.equal(drained.opp.currentHp,760,'攻擊300的80%汲取為240真實傷害，非真實免疫不擋');checks++;
  const zero={...h.kitSkill('解除自己異常',[{op:'cure_status',p:{side:'self'}}]),pp:0,currentPp:0,maxPp:5};
  const ppSoul={name:'條件PP',effectMode:'kit',kit:soul.filter((e:any)=>e.order===11)};
  let decisions=0;
  await h.play(side,{self:h.unit('條件PP',1000,[zero],{extra:{soulMark:ppSoul,battleStatuses:{狂暴:3}}}),opp:h.unit('旁觀',1000,[h.wait()]),turns:(engine,t)=>{
   const state=engine.getState();assert.equal(isZeroPpExempt(state[side],state[side].skills[0],state[other]),t===1,'異常當下查詢，解除後立即撤銷');decisions++;return t===1?[0,'pass']:['pass','pass'];
  }},2);assert.equal(decisions,2);checks++;
  const night=structuredClone(skills.find((s:any)=>s.name==='新生之夜'));night.kit=night.kit.filter((e:any)=>e.order===3);
  const [failedHeal]=await h.play(side,{self:h.unit('滿血',1000,[night],{speed:300}),opp:h.unit('失血',9000,[h.wait()]),turns:()=>[0,'pass']});
  assert.ok(failedHeal.opp.currentHp<9000);assert.equal(failedHeal.self.currentHp,1000);
  assert.ok(timedInnateDisabled(failedHeal.state[`${other}Timers`],failedHeal.opp,h.wait()),'吸取造成傷害但未恢復，也封固有');
  assert.ok(!failedHeal.state[`${other}Timers`].some((t:any)=>t.payload?.block?.addInvalid));checks++;
  const inverted=structuredClone(skills.find((s:any)=>s.name==='繩墨倒懸'));inverted.kit=inverted.kit.filter((e:any)=>e.order===1);
  const [transferred]=await h.play(side,{self:h.unit('轉交',10000,[inverted],{speed:300,extra:{battleStatuses:{腐朽:3,雷解:3,平靜:3}}}),opp:h.unit('接收',10000,[h.wait()]),turns:()=>[0,'pass']});
  for(const status of ['腐朽','雷解','平靜'])assert.ok(h.statuses(transferred.opp).includes(status),status+' 不得因固定清單漏接');checks++;
  for(const [shield,barrier,nextShield,nextBarrier,cost] of [[100,300,200,200,200],[0,100,0,200,100],[200,0,200,0,0],[0,0,0,0,0]]){
   const cap=h.kitSkill('護盾調整',[{op:'opp_shield_cap_with_cost',p:{cap:200}}]);
   const [r]=await h.play(side,{self:h.unit('調整者',1000,[cap]),opp:h.unit('護盾者',1000,[h.wait()],{extra:{shield,barrier}}),turns:()=>[0,'pass']});
   assert.equal(r.opp.shield||0,nextShield);assert.equal(r.opp.barrier||0,nextBarrier);assert.equal(r.self.currentHp,1000-cost);checks++;
  }
  const freeze=h.kitSkill('歲月凍結',[{op:'status',p:{side:'self',status:'狂暴',turns:3,chance:100}},{op:'age_mark_add',p:{side:'self'}}]);
  const frozen=await h.play(side,{self:h.unit('歲月持有者',1000,[freeze]),opp:h.unit('等待者',1000,[h.wait()]),turns:(_e,t)=>t===1?[0,'pass']:['pass','pass']},2);
  assert.deepEqual(frozen.map(r=>r.self.battleStatuses.狂暴),[3,3],'歲月之痕阻止自然倒數，與技能主動延長分開');checks++;
  // Invoke the actual energy operations with a persisted state store: every spend uses initial energy,
  // even after energy loss or a +300 ally-death reward. Both player sides share the same contract.
  const store=new Map<string,any>();const damages:number[]=[];const heals:number[]=[];
  const ctx:any={actor:side,targetSide:other,self:h.unit('能源',2000,[]),activeP1:h.unit('a',1000,[]),activeP2:h.unit('b',1000,[]),
   getPlayerState:(k:string)=>store.get(k),setPlayerState:(k:string,v:any)=>store.set(k,v),updateElf:()=>{},setMark:()=>{},clearMark:()=>{},applyTrueDamage:(_s:any,n:number)=>damages.push(n),applyHeal:(_s:any,n:number)=>heals.push(n)};
  const ops=finalOdbOperations(()=>{});ops.energy_form_enter(ctx,{key:'test',snapshotKey:'entry',name:'星執者',displayChar:'執'});
  const spend={key:'test',ratio:.15,basis:'initial',minimum:150,mode:'damage',conversionReward:150};
  ops.energy_form_spend(ctx,spend);ops.energy_form_ally_defeat(ctx,{key:'test',amount:300},{last:null,lastAmount:0} as any);ops.energy_form_spend(ctx,spend);
  assert.deepEqual(damages,[300,300]);assert.equal(store.get('portableTeamEnergy:test').initialEnergy,2000);assert.equal(store.get('portableTeamEnergy:test').energy,1700);
  ops.energy_form_spend(ctx,{...spend,mode:'heal'});assert.deepEqual(heals,[300]);checks++;
  // Two same-type timer instances count as two; the 50-weight multiplier uses pre-extension turns.
  const a=h.unit('甲',1000,[],{extra:{battleStatuses:{狂暴:2}}}),b=h.unit('乙',1000,[],{extra:{battleStatuses:{雷解:3}}});const units:any={[side]:a,[other]:b};let amount=0;
  const timer={kind:'turn_effect',remaining:2};const w:any={actor:side,targetSide:other,p1Timers:side==='p1'?[timer,{...timer},{...timer,pendingActivation:true},{...timer,ownerBattleId:'場下者'}]:[],p2Timers:side==='p2'?[timer,{...timer},{...timer,pendingActivation:true},{...timer,ownerBattleId:'場下者'}]:[],getStatuses:(e:any)=>e.battleStatuses,updateElf:(s:string,v:any)=>Object.assign(units[s],v)};
  weightEffectOperations({liveElf:(_c,s)=>units[s],addBlockTimer:(()=>{}) as any,runAct:(_c,act)=>{amount=act.p.amount;return true;}}).status_turn_exchange(w,{amount:50},{last:null,lastAmount:0});
  assert.equal(units[side].battleStatuses.狂暴,4);assert.equal(units[other].battleStatuses.雷解,5);assert.equal(amount,250);checks++;
 }
 console.log(`本輪修正：${checks}項雙方數值、選招、分類、轉交、護盾、初始能量與延長前計數通過`);
}finally{await h.close();}

