import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
const {instantKillChance}=await h.server.ssrLoadModule('/src/battle/instantKillChance.ts');
const {SuitEffectRegistry}=await h.server.ssrLoadModule('/src/effects/suitEffectRegistry.ts');
const {battleResistances}=await h.server.ssrLoadModule('/src/battle/resistances.ts');
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const mock=(side='p1')=>{const state:any={},calls:any[]=[];const c:any={actor:side,targetSide:side==='p1'?'p2':'p1',self:h.unit(side,1000,[h.wait()]),target:h.unit('target',1000,[h.wait()]),rng:()=>.999999999,getMarks:()=>[],getPlayerState:(k:string)=>state[k],setPlayerState:(k:string,v:any)=>state[k]=v,addLog:()=>{},updateElf:(_:any,p:any)=>Object.assign(c.self,p),applyHeal:(_:any,n:any)=>calls.push(['heal',n]),applyInstantKill:(...v:any[])=>{calls.push(v);return true;},skill:{name:'攻擊',category:'物理'},isHit:true};c.p1FullTeam=c.p2FullTeam=[c.self,h.unit('dead',0,[h.wait()])];return {c,state,calls};};
let checks=0;const check=async(name:string,fn:any)=>{await fn();console.log('✓ '+name);checks++;};
try{
await check('小機率秒殺最遲100次，成功歸零；0機率不累積；來源、個體各自隔離',()=>{
 const a=mock(),b=mock();for(let i=1;i<=99;i++)assert.equal(instantKillChance(a.c,'first',.01),false);
 assert.equal(instantKillChance(a.c,'second',.01),false);assert.equal(instantKillChance(b.c,'first',.01),false);
 assert.equal(instantKillChance(a.c,'zero',0),false);assert.equal(a.state.instantKillPity.zero,undefined);
 assert.equal(instantKillChance(a.c,'first',.01),true);assert.equal(a.state.instantKillPity.first,0);assert.equal(a.state.instantKillPity.second,1);assert.equal(b.state.instantKillPity.first,1);
 assert.ok(a.state.clearOnSwitch.includes('instantKillPity'));assert.equal(instantKillChance(a.c,'first',.01),false);
});
for(const side of ['p1','p2'] as const){
 await check(side+' 未來戰甲須命中；狂暴者由正式秒殺API結算，不直接扣血',()=>{
  const m=mock(side);m.state.instantKillPity={'suit:future_armor':99};m.c.isHit=false;SuitEffectRegistry.future_armor(m.c,T.AFTER_ACTION,{hit:m.c.isHit});assert.equal(m.calls.length,0);assert.equal(m.state.instantKillPity['suit:future_armor'],99);
  m.c.isHit=true;SuitEffectRegistry.future_armor(m.c,T.AFTER_ACTION,{hit:m.c.isHit});assert.equal(m.calls.length,1);assert.equal(m.calls[0][0],m.c.targetSide);
  m.state.instantKillPity['suit:berserker']=99;SuitEffectRegistry.berserker(m.c,T.BEFORE_DAMAGE,{damageComp:{damageCategory:'skill_attack',isIncoming:false}});SuitEffectRegistry.berserker(m.c,T.AFTER_ACTION,{});assert.equal(m.calls.length,2);
 });
 await check(side+' 保底命中仍受正式秒殺免疫攔截',async()=>{
  const name='保底入口_'+side;h.S[name]=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE){ctx.setPlayerState('instantKillPity',{'block:skill:保底秒殺:instant_kill':99});}};
  const trait={name:'秒殺免疫',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_instant_kill',source:'mechanic',role:'innate',order:0,params:{clause:{raw:'免疫秒殺',trig:'before_instant_kill',parsed:true,body:[{acts:[{op:'prevent_instant_kill',p:{dir:'in',scope:'self'},label:'免疫秒殺'}]}]}}}]};
  try{for(const immune of [false,true]){const [r]=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('保底秒殺',[{op:'instant_kill',p:{chance:.01}}])],{extra:{name}}),opp:h.unit('E',30000,[h.wait()],{extra:immune?{trait}:{}})});assert.equal(r.opp.currentHp,immune?30000:0,r.logs.join('\n')+' '+JSON.stringify(r.state[`${side}RegistryState`].instantKillPity));}}finally{delete h.S[name];}
 });
 await check(side+' 下場後重置；重新登場從首次計數，不影響另一來源',async()=>{
  const skill=h.kitSkill('計數用秒殺',[{op:'instant_kill',p:{chance:.01}}]);
  const r=await h.play(side,{self:h.unit('S',10000,[skill]),opp:h.unit('E',10000,[h.wait()]),selfBench:[h.unit('B',10000,[h.wait()])],turns:(_:any,t:number)=>t===2?[{switch:1},0]:t===3?[{switch:0},0]:[0,0]},4);
  const key='block:skill:計數用秒殺:instant_kill';
  assert.equal(r[0].state[`${side}RegistryState`].instantKillPity[key],1);assert.equal(r[1].state[`${side}ElfState`].S.registry.instantKillPity,undefined);assert.equal(r[3].state[`${side}RegistryState`].instantKillPity[key],1);
 });
}
for(const side of ['p1','p2'] as const){
 await check(side+' 未來套裝實戰：命中保底、秒殺免疫、未命中與對手出手隔離',async()=>{
  const name='未來套裝測試_'+side;h.S[name]=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE)ctx.setPlayerState('instantKillPity',{'suit:future_armor':99});};
  try{for(const mode of ['kill','guard','miss']){
   const attack={...h.wait(),name:'實際攻擊',category:'物理',power:1,isSureHit:mode!=='miss',accuracy:mode==='miss'?0:100};
   const guard={name:'免疫瞬殺',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_instant_kill',source:'mechanic',role:'innate',order:0,params:{clause:{raw:'免疫瞬殺',trig:'before_instant_kill',parsed:true,body:[{acts:[{op:'prevent_instant_kill',p:{dir:'in',scope:'self'},label:'免疫瞬殺'}]}]}}}]};
   const [r]=await h.play(side,{self:h.unit('S',10000,[attack],{extra:{name}}),opp:h.unit('E',10000,[h.wait()],{extra:mode==='guard'?{trait:guard}:{}}),selfBench:[h.unit('D',0,[h.wait()])],selfSuit:'future_armor'});
   assert.equal(r.opp.currentHp===0,mode==='kill',mode+' '+r.logs.join('\n'));assert.equal(r.state[`${side}RegistryState`].instantKillPity['suit:future_armor'],mode==='miss'?99:0,mode);
  }}finally{delete h.S[name];}
 });
 await check(side+' 聖界實戰：抗性成功回血，其他免疫不回血；保留原配置',async()=>{
  const resistances={damageResist:{crit:10,fixed:20,percent:15},statusResist:{allImmune:false,selectedStatuses:['害怕'],slots:[{status:'害怕',rate:30}]}};
  const [r]=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('附加害怕',[{op:'status',p:{side:'opp',status:'害怕',turns:3,chance:100}}])]),opp:h.unit('E',5000,[h.wait()],{maxHp:10000,extra:{resistances:structuredClone(resistances)}}),oppSuit:'holy_sanctuary'});
  assert.equal(r.opp.currentHp,8000,r.logs.join('\n'));assert.deepEqual(r.opp.resistances,resistances);
 });
}
await check('聖界依各抗性項比較，並列不改；不覆寫原配置，只真正異常抗性觸發才回血',()=>{
 const m=mock();m.c.self.resistances={damageResist:{crit:10,fixed:20,percent:15},statusResist:{allImmune:true,selectedStatuses:['害怕','燒傷'],slots:[{status:'害怕',rate:30},{status:'燒傷',rate:20}]}};const before=structuredClone(m.c.self.resistances);
 SuitEffectRegistry.holy_sanctuary(m.c,T.ON_ENTRANCE,{});assert.deepEqual(m.c.self.resistances,before);
 const res=battleResistances(m.c.self);assert.deepEqual(res.damageResist,{crit:0,fixed:0,percent:0});assert.equal(res.statusResist.slots[0].rate,100);assert.equal(res.statusResist.slots[1].rate,0);assert.equal(res.statusResist.allImmune,false);
 SuitEffectRegistry.holy_sanctuary(m.c,T.ON_STATUS_IMMUNIZED,{reason:'trait'});assert.equal(m.calls.length,0);SuitEffectRegistry.holy_sanctuary(m.c,T.ON_STATUS_IMMUNIZED,{reason:'resistance'});assert.deepEqual(m.calls,[['heal',300]]);
 m.c.self.resistances.statusResist.slots[1].rate=30;assert.deepEqual(battleResistances(m.c.self),m.c.self.resistances);
});
console.log(`秒殺保底／套裝抗性：${checks}項通過`);
}finally{await h.close();}
