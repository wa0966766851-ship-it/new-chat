import assert from 'node:assert/strict';
import { prepareBattle, settleBattle } from '../src/modes/interstellar/runState';
const elf=(id:string,hp:number)=>({battleId:id,currentHp:hp,maxHp:100,skills:[{pp:5}]});
const base: any = { runId:'r', revision:0, currentLayer:1, fuel:5, maxFuel:10, saerBeans:1000, earnedExp:0, selectedModifiers:[], collectibles:[], vouchers:{A:0,B:0,C:1,S:0}, layers:[{id:1,nodes:[{id:'boss',type:'boss',status:'current',connections:[]}]}], runElves:[elf('a',10),elf('b',0)] };
let passed=0; const t=(n:string,f:()=>void)=>{f();passed++;console.log(`pass ${n}`);};
t('滅團＝整局結算，全滅即 runOver/wiped', ()=>{
  const p=prepareBattle({...base,runElves:[elf('a',10)]},'w',[0,0,0,0]);
  const dead=[{battleId:'a',currentHp:0,maxHp:100,skills:[{pp:5}]}];
  const r=settleBattle(p,'w','p2',dead);
  assert.equal(r.runOver,true); assert.equal(r.runResult,'wiped');
  assert.equal(settleBattle(r,'w','p1',dead),r,'已結算不再重複');
});
t('第6層Boss贏＝victory', ()=>{
  const b={...base,currentLayer:6,layers:[{id:6,nodes:[{id:'boss',type:'boss',status:'current',connections:[]}]}]};
  const p=prepareBattle(b,'v',[0,0,0,0]);
  const r=settleBattle(p,'v','p1',[{battleId:'a',currentHp:50,maxHp:100,skills:[{pp:5}]},{battleId:'b',currentHp:0,maxHp:100,skills:[{pp:5}]}]);
  assert.equal(r.runOver,true); assert.equal(r.runResult,'victory'); assert.equal(r.currentLayer,6);
});
t('1-5層Boss贏照舊跨層不結束', ()=>{
  const p=prepareBattle(base,'m',[0,0,0,0]);
  const r=settleBattle(p,'m','p1',[{battleId:'a',currentHp:50,maxHp:100,skills:[{pp:5}]}]);
  assert.equal(r.runOver,undefined); assert.equal(r.currentLayer,2);
});
t('Boss輸加收10%撤退費', ()=>{
  const p=prepareBattle(base,'f',[0,0,0,0]);
  const r=settleBattle(p,'f','p2',[{battleId:'a',currentHp:0,maxHp:100,skills:[{pp:5}]}]);
  assert.equal(r.lastBattleResult.retreatFee,100); assert.equal(r.saerBeans,900);
});
console.log(`interstellar runOver: ${passed} passed`);
