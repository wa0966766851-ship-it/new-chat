import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {NAIFEN_GRASS:item,NAIFEN_GRASS_ID:id,NAIFEN_ELF_ID}=await h.server.ssrLoadModule('/src/data/naifenItems.ts');
 const {battleItemProgramIssue,heldBattleItemProgramIssue}=await h.server.ssrLoadModule('/src/effects/battleItemProgram.ts');
 const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
 const {BATTLE_ITEMS,getMaxPp}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 const {authoredEntry:e,actions:act,operation:a}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 assert.equal(battleItemProgramIssue(item),null);assert.equal(heldBattleItemProgramIssue(item),null);
 const grant=e('測試發放實際藥草','battle_start',[act(a('grant_item',{side:'self',itemId:id,count:7}))],0,'soulmark');
 const holder=(skills:any[])=>h.unit('holder',10000,skills,{speed:200,extra:{soulMark:{name:'取得藥草',effectMode:'kit',kit:[grant]}}});
 for(const side of ['p1','p2'] as const){
  for(const amount of [100,3]){
   const hit=h.kitSkill('固定傷害',[a('dmg',{type:'固定',flat:amount})]);
   const enemy=h.kitSkill('敵方固定傷害',[a('dmg',{type:'固定',flat:100})]);
   const rows=await h.play(side,{self:holder([hit]),opp:h.unit('enemy',10000,[enemy])},2);
   assert.equal(rows[0].self.currentHp,9900);
   assert.equal(rows[1].self.currentHp,amount%2===0?9600:9800,JSON.stringify({side,amount,rows:rows.map((r:any)=>({logs:r.logs,hp:r.self.currentHp,timers:r.state[side+'Timers']}))}));
   assert.equal(rows[1].opp.currentHp,amount%2===0?9800:9996,'奇數造成對應固定傷害降至三分之一');
  }
  for(const foeId of ['enemy',NAIFEN_ELF_ID]){
   const own=holder([{...h.wait(),pp:20,maxPp:30}]),foe=h.unit(foeId,5000,[{...h.wait(),pp:10,maxPp:30}],{maxHp:10000});
   const p1=side==='p1'?own:foe,p2=side==='p2'?own:foe;
   const engine=createBattleEngine({initialP1Team:[p1],initialP2Team:[p2],p1StarterId:p1.id,p2StarterId:p2.id,battleMode:'PVP',preparedTeams:true,isFast:()=>true});
   try{
    engine.mount();engine.start();await engine.idle();
    for(const who of ['p1','p2'] as const)if(who===side)engine.onUseItem(who,item);else engine.onSkillSelect(who,engine.getState()[who].skills[0]);
    await engine.idle();const st=engine.getState(),mult=foeId===NAIFEN_ELF_ID?1.15:1;
    assert.equal(st[side].currentHp,10000-Math.floor(500*mult));assert.equal(st[side].skills[0].pp,20-2*mult);
    assert.equal(getMaxPp(st[side].skills[0],st[side]),30-2*mult);assert.equal(st[side+'ItemInventory'][id].left,6);
    const other=side==='p1'?'p2':'p1',isNaifen=foeId===NAIFEN_ELF_ID;
    assert.equal(st[other].currentHp,isNaifen?5000+Math.floor(500*mult)*2:5000,'對方在場為奈尼芬多：恢復代價體力200%');
    assert.equal(st[other].skills[0].pp,(isNaifen?10+Math.floor(2*mult*2):10)-1,'對方在場為奈尼芬多：恢復代價PP 200%（另扣自身出招1點）');
   }finally{engine.unmount();}
  }
  const health=BATTLE_ITEMS.find((i:any)=>i.value>0&&!i.pickTarget&&!i.grantOnly&&!i.regen);assert.ok(health);
  const own=holder([h.wait()]),foe=h.unit('enemy',10000,[h.wait()]),p1=side==='p1'?own:foe,p2=side==='p2'?own:foe;
  const engine=createBattleEngine({initialP1Team:[p1],initialP2Team:[p2],p1StarterId:p1.id,p2StarterId:p2.id,battleMode:'PVP',preparedTeams:true,isFast:()=>true});
  try{engine.mount();engine.start();await engine.idle();for(const who of ['p1','p2'] as const)if(who===side)engine.onUseItem(who,health);else engine.onSkillSelect(who,engine.getState()[who].skills[0]);await engine.idle();assert.equal(engine.getState()[side].currentHp,10000-health.value,'真正持有藥草時，普通回血藥劑也反噬');}finally{engine.unmount();}
  // 每次使用藥劑：反噬並令對方存活的奈尼芬多（場下也可）恢復反噬體力200%
  {const own=holder([h.wait()]),foe=h.unit('enemy',10000,[h.wait()]),nai=h.unit(NAIFEN_ELF_ID,1000,[h.wait()],{maxHp:100000});nai.battleId='nai';
   const p1=side==='p1'?own:foe,p2=side==='p2'?own:foe,b1=side==='p1'?[]:[nai],b2=side==='p2'?[]:[nai];
   const engine=createBattleEngine({initialP1Team:[p1,...b1],initialP2Team:[p2,...b2],p1StarterId:p1.id,p2StarterId:p2.id,battleMode:'PVP',preparedTeams:true,isFast:()=>true});
   try{engine.mount();engine.start();await engine.idle();for(const who of ['p1','p2'] as const)if(who===side)engine.onUseItem(who,health);else engine.onSkillSelect(who,engine.getState()[who].skills[0]);await engine.idle();
    const team=engine.getState()[(side==='p1'?'p2':'p1')+'Team'];assert.equal(team.find((e:any)=>e.battleId==='nai').currentHp,1000+health.value*2,'場下奈尼芬多恢復反噬量200%');}finally{engine.unmount();}}
 }
 console.log('naifenInventory passed: actual held inventory, parity by damage type, normal potion backlash and PP/max-PP costs on P1/P2');
}finally{await h.close();}
