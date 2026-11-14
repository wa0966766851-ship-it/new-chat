import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {calculateDamage}=await h.server.ssrLoadModule('/src/utils/damageCalculator.ts');
 const {formulaViewOperations}=await h.server.ssrLoadModule('/src/blocks/ops/formulaViews.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const {authoredEntry:e,actions:act,operation:a}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 const setup=e('雙攻總和與雙防加值','entrance',[act(a('formula_stats',{stats:['atk','spatk'],stats2:['atk','spatk']}))],0,'soulmark');
 const low=[act(a('flag_set',{key:'belowRawDamageThreshold',value:true}))];
 const drain=(trig:string)=>e('原始攻擊傷害吸取',trig,[act(a('base_damage_drain',{type:'fixed',threshold:300,body:low}))],1,'soulmark');
 for(const entry of [setup,drain('outgoing_attack'),drain('incoming_attack')])assert.equal(sequenceIssue(entry.params.clause,entry.node),null);
 const attack={...h.wait(),name:'測試物理',category:'物理',power:60};
 const source=h.unit('S',10000,[attack]),target=h.unit('E',10000,[attack]);
 source.calculatedStats.atk=200;source.calculatedStats.spatk=400;
 const original=structuredClone([source,target]);
 const calc=(actor:any,defender:any,regA={},regD={})=>calculateDamage(actor,defender,attack,'p1',undefined,undefined,1,false,undefined,undefined,{},undefined,undefined,regA,regD).damage;
 const view={formulaStatView:{attackStats:['atk','spatk'],defenseAddStats:['atk','spatk']}};
 assert.equal(calc(source,target,view),calc({...source,calculatedStats:{...source.calculatedStats,atk:600}},target));
 assert.equal(calc(target,source,{},view),calc(target,{...source,calculatedStats:{...source.calculatedStats,def:900}}));
 assert.deepEqual([source,target],original,'僅改公式讀取，不改固定／百分比等其他傷害引用面板');
 for(const side of ['p1','p2'] as const){
  const boost=e('實際技能增傷200%','outgoing_attack',[act(a('dmg_mod',{dir:'out',boost:2,kind:'攻擊'}))],0,'soulmark');
  const fixture=(kit:any[],enemyKit:any[]=[])=>({self:h.unit('S',50000,[attack],{speed:200,extra:{soulMark:{name:'公式測試',effectMode:'kit',kit}}}),opp:h.unit('E',100000,[h.wait()],{extra:{soulMark:{name:'對手公式',effectMode:'kit',kit:enemyKit}}})});
  const [base]=await h.play(side,fixture([]));const raw=100000-base.opp.currentHp;assert.ok(raw>0);
  const [r]=await h.play(side,fixture([boost,drain('outgoing_attack')]));
  assert.equal(100000-r.opp.currentHp,4*raw,JSON.stringify({side,raw,hp:r.opp.currentHp,logs:r.logs}));
  assert.equal(r.state[side+'RegistryState'].belowRawDamageThreshold,true,'門檻使用增傷前原始值');
 }
 const writes:any[]=[];const ops=formulaViewOperations({liveElf:(ctx:any,side:string)=>ctx[side],runStmts:()=>{}});
 const ctx:any={actor:'p1',targetSide:'p2',p1:{currentHp:100},p2:{currentHp:3000},updateElf:(side:string,patch:any)=>writes.push([side,patch])};
 ops.exchange_current_hp(ctx);assert.deepEqual(writes,[['p1',{currentHp:3000}],['p2',{currentHp:100}]]);
 console.log('formulaViews passed: formula-only dual-stat views, raw-before-modifier drain on both sides, and direct HP exchange');
}finally{await h.close();}
