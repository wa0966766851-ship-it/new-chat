import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let count=0;
try{
 const {INSCRIPTION_GEMS,gemHas,gemFlatPower}=await h.server.ssrLoadModule('/src/training/gems.ts');
 const {computeHitChance}=await h.server.ssrLoadModule('/src/effects/genericSkillText.ts');
 const {readBasePriority}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
 const {calculateDamage}=await h.server.ssrLoadModule('/src/utils/damageCalculator.ts');
 const gem=(id:string,name:string)=>[{name:'測試刻印',stats:{hp:0,atk:0,def:0,spatk:0,spdef:0,speed:0},gem:{id,skillName:name}}];
 for(const g of INSCRIPTION_GEMS){assert.equal(g.level,g.generation===1?10:5);assert.equal(g.triggerChance,100);assert.equal(g.inlayChance,100);}count++;
 for(const side of ['p1','p2'] as const){
  const hit={...h.wait(),name:'綁定攻擊',category:'物理',power:80,type:'普通',pp:10,maxPp:10,accuracy:100,isSureHit:true};
  const bind=(id:string,extra:any={})=>h.unit('寶石持有者',10000,[hit],{extra:{inscriptions:gem(id,hit.name),...extra}});
  const target=()=>h.unit('受擊者',10000,[h.wait()]);
  const [normal]=await h.play(side,{self:bind('none'),opp:target(),turns:()=>[0,'pass']});
  const [fixed]=await h.play(side,{self:bind('1800090'),opp:target(),turns:()=>[0,'pass']});assert.equal(normal.opp.currentHp-fixed.opp.currentHp,30,`${side}固定寶石30`);count++;
  const [truth]=await h.play(side,{self:bind('1800265'),opp:target(),turns:()=>[0,'pass']});assert.equal(normal.opp.currentHp-truth.opp.currentHp,50,`${side}真實傷害50`);count++;
  const [noCost]=await h.play(side,{self:bind('1800205'),opp:target(),turns:()=>[0,'pass']});assert.equal(noCost.self.skills[0].pp,10,`${side}不耗PP`);count++;
  const [boost]=await h.play(side,{self:bind('1800050'),opp:target(),turns:()=>[0,'pass']});assert.equal(boost.self.statStages.atk,1,`${side}攻擊+1`);count++;
  const [ppDown]=await h.play(side,{self:bind('1800210'),opp:target(),turns:()=>[0,'pass']});assert.equal(ppDown.opp.skills[0].pp,ppDown.opp.skills[0].maxPp-1,`${side}降低PP`);count++;
  const [unbound]=await h.play(side,{self:bind('1800090',{inscriptions:gem('1800090','另一技能')}),opp:target(),turns:()=>[0,'pass']});assert.equal(unbound.opp.currentHp,normal.opp.currentHp,`${side}不得套用未綁定技能`);count++;
  const unit=bind('1800270',{statStages:{accuracy:-5}}),op=target();
  assert.equal(computeHitChance(unit,op,{...hit,isSureHit:false},()=>({})),1);assert.equal(unit.statStages.accuracy,-5);count++;
  const low=bind('1800255',{currentHp:100});assert.equal(readBasePriority(hit,{self:low,target:op}),1);count++;
  assert.equal(gemFlatPower(bind('1800130'),hit),30);assert.equal(gemHas(bind('1800100'),hit,543),true);count++;
  for(const [id,status] of [['1800010','凍傷'],['1800020','燒傷'],['1800030','中毒'],['1800110','疲憊'],['1800120','麻痺'],['1800235','失明'],['1800240','失神'],['1800245','冰封'],['1800250','焚燼'],['1800280','感染']]){
   const [result]=await h.play(side,{self:bind(id),opp:target(),turns:()=>[0,'pass']});
   assert.ok(h.statuses(result.opp).includes(status),`${side} ${id}應附加${status}`);count++;
  }
  const attribute={...h.wait(),name:'綁定屬性',pp:5,maxPp:5};
  const [utility]=await h.play(side,{self:h.unit('屬性寶石持有者',10000,[attribute],{extra:{inscriptions:gem('1800265',attribute.name)}}),opp:target(),turns:()=>[0,'pass']});
  assert.equal(utility.opp.currentHp,9950,`${side}屬性技能也可觸發使用技能寶石`);count++;
  const [crit]=await h.play(side,{self:bind('1800100'),opp:{...target(),statStages:{def:1}},turns:()=>[0,'pass']});
  assert.equal(crit.opp.statStages.def,0,`${side}致命寶石實際暴擊並清除物防強化`);count++;
  for(const [id,resource] of [['1800310','shield'],['1800315','barrier']]){
   const history=await h.play(side,{self:bind(id,{[resource]:500}),opp:{...target(),skills:[hit],inscriptions:gem('1800090',hit.name)},turns:(_e:any,t:number)=>t===1?['pass',0]:[0,'pass']},2);
   const loss=500-history[0].self[resource];assert.ok(loss>0,`${side} ${resource} ${JSON.stringify({hp:history[0].self.currentHp,shield:history[0].self.shield,barrier:history[0].self.barrier,logs:history[0].logs})}`);
   assert.equal(history[1].self[resource]-history[0].self[resource],Math.min(120,Math.floor(loss*.25)),`${side} ${resource}上回合失去量回溯，不重複記傷害`);count++;
  }
 }
 const {runInscriptionGems}=await h.server.ssrLoadModule('/src/effects/inscriptionGems.ts');
 const {EffectTiming:E}=await h.server.ssrLoadModule('/src/effects/types.ts');
 const {takeGemStatusBoost}=await h.server.ssrLoadModule('/src/training/gemStatusChance.ts');
 const state=new Map();const skill={...h.wait(),name:'保留PP',pp:0,maxPp:5};
 const owner=h.unit('gem-owner',1000,[skill,{...h.wait(),name:'另一技能',pp:0}],{extra:{inscriptions:gem('1800305',skill.name)}});
 const context:any={self:owner,target:h.unit('target',1000,[h.wait()]),actor:'p1',targetSide:'p2',roundNumber:1,getPlayerState:(k:string)=>state.get(k),setPlayerState:(k:string,v:any)=>state.set(k,v),updateElf:(_s:string,p:any)=>Object.assign(owner,p),getFullTeam:()=>[owner],emitElfEvent:()=>{},getOpponentState:()=>{},addLog:()=>{}};
 runInscriptionGems(context,E.ON_ENTRANCE);
 runInscriptionGems(context,E.PP_CHANGED,{reason:'clear',emptied:[1]});assert.equal(owner.skills[0].pp,0,'不得恢復未被本次清除的技能');count++;
 runInscriptionGems(context,E.PP_CHANGED,{reason:'clear',emptied:[0]});assert.equal(owner.skills[0].pp,2,'被清除槽恢復2PP');count++;
 owner.skills[0].pp=0;context.roundNumber=3;runInscriptionGems(context,E.PP_CHANGED,{reason:'clear',emptied:[0]});assert.equal(owner.skills[0].pp,0,'登場第3回合不保留');count++;
 owner.inscriptions=gem('1800295',skill.name);runInscriptionGems(context,E.BEFORE_SKILL,{skill});
 assert.equal(takeGemStatusBoost(context,50).percent,50);const secret=takeGemStatusBoost(context,60);assert.equal(secret.percent,85);assert.deepEqual(secret.bypass,{maxBase:25,amount:25});assert.equal(takeGemStatusBoost(context,60).percent,60);count++;
 owner.inscriptions=gem('1800310',skill.name);context.roundNumber=4;
 runInscriptionGems(context,E.RESOURCE_CHANGED,{id:'shield',before:500,after:0});context.roundNumber=5;
 let recovered=0;context.applyShield=(_s:string,amount:number)=>{recovered+=amount;};runInscriptionGems(context,E.AFTER_ACTION,{skill,hit:true});
 assert.equal(recovered,120,'直接消除護盾亦計入回溯且封頂120');count++;
 const {TraitsEngine}=await h.server.ssrLoadModule('/src/utils/traitsEngine.ts');
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  const defended=h.unit('resist-owner',1000,[h.wait()]);
  const ledger=new Map();
  const ctx:any={...context,actor:side,targetSide:other,self:owner,target:defended,activeP1:side==='p1'?owner:defended,activeP2:side==='p2'?owner:defended,
   getMarks:()=>[],getStatuses:()=>({}),rng:()=>0,getPlayerState:(k:string)=>ledger.get(k),setPlayerState:(k:string,v:any)=>ledger.set(k,v),getOpponentState:()=>undefined,
   statusResistanceReduction:{maxBase:25,amount:25}};
  const resistance=(rate:number)=>({damageResist:{crit:0,fixed:0,percent:0},statusResist:{allImmune:false,slots:[{id:'c1',category:'control',status:'麻痺',rate}]}});
  defended.resistances=resistance(25);assert.equal(TraitsEngine.filterStatusInflict(ctx,other,'麻痺',3).handled,false,'25%抗性可忽略');count++;
  defended.resistances=resistance(26);assert.equal(TraitsEngine.filterStatusInflict(ctx,other,'麻痺',3).resistanceTriggered,true,'26%抗性不忽略');count++;
  defended.resistances=resistance(25);ledger.set(`${other}_immuneStatusCount`,1);assert.equal(TraitsEngine.filterStatusInflict(ctx,other,'麻痺',3).handled,true,'忽略抗性不能穿透免疫次數');assert.equal(ledger.get(`${other}_immuneStatusCount`),0);count++;
 }
 console.log(`刻印寶石${count}組來源策略、雙方正式傷害／PP／能力、綁定、命中與先制檢查通過`);
}finally{await h.close();}
