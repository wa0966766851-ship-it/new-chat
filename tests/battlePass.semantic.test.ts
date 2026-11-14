import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
// 2026-11-14 空過：手動空過不算使用技能；全部行動被封鎖時自動空過，戰鬥不會卡在選擇階段。
const h=await createHarness();
try{
 const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
 const used=h.kitSkill('出手',[{op:'dmg',p:{flat:10,type:'真實'}}]);
 const soul={name:'計數',description:'語意測試',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'soulmark',role:'innate',node:'after_skill',order:0,customText:'使用技能後恢復',
   params:{clause:{raw:'使用技能後恢復',trig:'self_after_use',parsed:true,body:[{acts:[{op:'heal_flat',p:{amount:55},label:'恢復'}]}]}}}]};
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  const mk=(id:string,hp:number,skills:any[],extra:any={})=>h.unit(id,hp,skills,{maxHp:5000,extra});
  const self=mk('S',1000,[used],{soulMark:soul}),opp=mk('E',5000,[h.wait()]);
  const engine=createBattleEngine({initialP1Team:[side==='p1'?self:opp],initialP2Team:[side==='p2'?self:opp],p1StarterId:side==='p1'?'S':'E',p2StarterId:side==='p2'?'S':'E',battleMode:'PVP',preparedTeams:true,isFast:()=>true});
  engine.mount();engine.start();await engine.idle();
  const order=side==='p1'?[side,other]:[other,side];
  for(const s of order){ if(s===side)engine.onPass(s); else engine.onSkillSelect(s,engine.getState()[s].skills[0]); }
  await engine.idle();
  let st=engine.getState();
  assert.equal(st[side].currentHp,1000,`${side} 空過不觸發使用技能後效果`);
  assert.equal(st[other].currentHp,5000,`${side} 空過不出招`);
  assert.ok(st.logs.some((l:any)=>String(l.text).includes('空過')),'有空過紀錄');
  assert.equal(st.turnNumber,2,'空過後回合正常推進');
  // 全部封鎖：技能PP 0、無後援、繳械無法用藥 → 自動空過，回合照常推進。
  const stuck=mk('S',1000,[{...used,pp:0,currentPp:0,maxPp:5}],{battleStatus:'繳械',effects:[{id:'繳械',name:'繳械',duration:9,stacks:1}]});
  const e2=createBattleEngine({initialP1Team:[side==='p1'?stuck:mk('E',5000,[h.wait()])],initialP2Team:[side==='p2'?stuck:mk('E',5000,[h.wait()])],p1StarterId:side==='p1'?'S':'E',p2StarterId:side==='p2'?'S':'E',battleMode:'PVP',preparedTeams:true,isFast:()=>true});
  e2.mount();e2.start();await e2.idle();
  for(let i=0;i<20&&e2.getState().turnNumber<3;i++){
   const ph=e2.getState().phase;
   if(ph===`${other}_select`)e2.onSkillSelect(other,e2.getState()[other].skills[0]);
   await new Promise(r=>setTimeout(r,120));await e2.idle();
  }
  st=e2.getState();
  assert.ok(st.turnNumber>=3,`${side} 全封鎖時自動空過，回合推進到 ${st.turnNumber}`);
  assert.ok(st.logs.some((l:any)=>String(l.text).includes('自動空過')));
  engine.unmount();e2.unmount();
 }
 console.log('空過：手動不算使用技能、全封鎖自動空過 P1/P2 通過');
}finally{await h.close();}
