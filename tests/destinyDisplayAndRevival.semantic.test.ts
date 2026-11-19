import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h=await createHarness();
try {
  const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
  const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {normalizeElfStats}=await h.server.ssrLoadModule('/src/utils/elfStats.ts');
  const {holyMilesOperations}=await h.server.ssrLoadModule('/src/blocks/ops/holyMiles.ts');
  const {effectDefinitionEntries}=await h.server.ssrLoadModule('/src/battle/effectSources.ts');
  const {maskElfIdentity}=await h.server.ssrLoadModule('/src/battle/viewerPerspective.ts');
  const {INTERCEPTOR_EFFECTS}=await h.server.ssrLoadModule('/src/utils/destinyGacha.ts');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const React=await import('react');
  const {ElfTraitCards}=await h.server.ssrLoadModule('/src/components/ElfTraitCards.tsx');
  const real=(id:string,battleId:string)=>({...normalizeElfStats(structuredClone(DEFAULT_ELVES.find((e:any)=>String(e.id)===id))),battleId,skills:[h.wait()]});
  const damage=(flat:number)=>h.kitSkill('測試真傷'+flat,[{op:'dmg',p:{flat,type:'真實'}}],{priority:100});
  for(const side of ['p1','p2'] as const){
    const opp=side==='p1'?'p2':'p1';
    const start=async(team:any[])=>{
      (globalThis as any).__BATTLE_SEED__=11;
      const enemy=h.unit('enemy',1_000_000_000,[damage(100000),damage(600),h.wait()],{speed:999});
      const e=createBattleEngine({initialP1Team:side==='p1'?team:[enemy],initialP2Team:side==='p2'?team:[enemy],p1StarterId:side==='p1'?team[0].battleId:enemy.battleId,p2StarterId:side==='p2'?team[0].battleId:enemy.battleId,battleMode:'PVP',preparedTeams:true,isFast:()=>true});
      e.mount();e.start();await e.idle();return e;
    };
    const turn=async(e:any,enemySkill:number)=>{const s=e.getState();for(const actor of ['p1','p2'])e.onSkillSelect(actor,s[actor].skills[actor===side?0:enemySkill]);await e.idle();};
    const liu=()=>({...real('5031','liu'),currentHp:20000,maxHp:20000});
    // 未持有斯嘉麗也會走相同的死亡換人路徑，不得被登場快照復活。
    let e=await start([liu(),h.unit('bench',100000,[h.wait()])]);
    try{
      await turn(e,0);assert.equal(e.getState()[`${side}Team`][0].currentHp,0);
      assert.equal(e.getState().phase,`forced_switch_${side}`);
      e.onSwitchElf(side,1);await e.idle();
      assert.equal(e.getState()[`${side}Team`][0].currentHp,0,'六界陣亡換下不得還原體力');
    }finally{e.unmount();}
    // 存活換下仍還原原登場體力與 PP。
    e=await start([liu(),h.unit('bench',100000,[h.wait()])]);
    try{
      await turn(e,1);assert.ok(e.getState()[side].currentHp<20000);
      const s=e.getState();for(const actor of ['p1','p2']){if(actor===side)e.onSwitchElf(side,1);else e.onSkillSelect(actor,s[actor].skills[2]);}await e.idle();
      const restored=e.getState()[`${side}Team`][0];assert.equal(restored.currentHp,20000,JSON.stringify({side,phase:e.getState().phase,logs:e.getState().logs.slice(-12)}));assert.equal(restored.skills[0].pp,99);
    }finally{e.unmount();}
    // 斯嘉麗先死亡並啟動倒數，再讓六界死亡；珀妮仍在，只有斯嘉麗能於場下復活。
    e=await start([real('5014','scarlett'),liu(),h.unit('bench',100000,[h.wait()])]);
    try{
      await turn(e,0);assert.equal(e.getState()[`${side}Team`][0].currentHp,0);
      e.onSwitchElf(side,1);await e.idle();
      await turn(e,0);assert.equal(e.getState()[`${side}Team`][1].currentHp,0);
      e.onSwitchElf(side,2);await e.idle();
      for(let n=0;n<10 && e.getState()[`${side}Team`][0].currentHp<=0;n++)await turn(e,2);
      const team=e.getState()[`${side}Team`];
      assert.ok(team[0].currentHp>0,'斯嘉麗持有者正常於場下復活');
      assert.equal(team[1].currentHp,0,'六界不得響應斯嘉麗的倒數復活');
      assert.equal(e.getState()[side].battleId,'bench','復活不替換目前出戰精靈');
      console.log(side,'六界存活還原／死亡換人／斯嘉麗同隊復活隔離通過');
    }finally{e.unmount();}
  }
  // 共用操作也須尊重負體力存活規則及已消失狀態。
  const ops=holyMilesOperations({runStmts:()=>{}});let self:any=h.unit('snapshot',100,[h.wait()]);const state:any={};
  const ctx:any={get self(){return self},actor:'p1',setPlayerState:(k:string,v:any)=>state[k]=v,getPlayerState:(k:string)=>state[k],updateElf:(_:any,patch:any)=>Object.assign(self,patch),addLog:()=>{}};
  ops.entry_state_snapshot(ctx);self.currentHp=0;assert.equal(ops.entry_state_restore(ctx),false);assert.equal(self.currentHp,0);
  self.currentHp=10;self.isVanished=true;assert.equal(ops.entry_state_restore(ctx),false);
  self.isVanished=false;self.currentHp=-10;self.survivalRule={active:true,mode:'god_descent',floorMult:1};assert.equal(ops.entry_state_restore(ctx),true);assert.equal(self.currentHp,100);
  // C級攔截顯示：所有種類、正文、非C、六界、幻化、隱匿。
  for(const effect of Object.values(INTERCEPTOR_EFFECTS) as any[]){
    const elf={...h.unit('C',100,[h.wait()]),destinyRank:'C',interceptorEffect:effect};
    const entries=effectDefinitionEntries(elf).filter((x:any)=>x.displayOnly);assert.equal(entries.length,1);assert.equal(entries[0].description,effect.description);
    const html=renderToStaticMarkup(React.createElement(ElfTraitCards,{elf}));assert.ok(html.includes(effect.name));assert.ok(html.includes(effect.description));assert.ok(!html.includes('積木／實裝核對'));
    assert.equal(effectDefinitionEntries({...elf,destinyRank:'B'}).filter((x:any)=>x.displayOnly).length,0);
    assert.equal(effectDefinitionEntries({...elf,name:'六界神王'}).filter((x:any)=>x.displayOnly).length,1);
    const hidden=maskElfIdentity({...elf,isConcealed:true},'p2','PVE');assert.equal(effectDefinitionEntries(hidden).filter((x:any)=>x.displayOnly).length,0);
    const transformed={...h.unit('copy',100,[]),illusion:{target:elf,original:{}}};assert.equal(effectDefinitionEntries(transformed).filter((x:any)=>x.displayOnly).length,0);
  }
  console.log('五種C級攔截正文／六界顯示／幻化與隱匿隔離通過');
}finally{await h.close();}
