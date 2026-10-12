import assert from 'node:assert/strict';
import {blocksOwnSkillRecovery} from '../src/battle/recoveryOrigin';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const a=(op:string,p:any)=>({op,p,label:op});
const check=async(name:string,fn:()=>Promise<void>|void)=>{await fn();checks++;console.log(`✓ ${name}`);};
try {
  await check('原子容器與連鎖均保留技能／魂印／特質三種來源，不把特質寫成魂印',async()=>{
    const {runNode}=await h.server.ssrLoadModule('/src/effects/effectRunner.ts');
    for(const [source,kind] of [['skill','skill'],['soulmark','soul'],['trait','trait']])for(const atom of [false,true]) {
      const calls:any[]=[],unit=h.unit('S',1000,[h.wait()],{maxHp:2000});
      const ctx:any={actor:'p1',targetSide:'p2',self:unit,target:unit,activeP1:unit,activeP2:unit,getFullTeam:()=>[unit],getPlayerState:()=>0,getOpponentState:()=>0,getMarks:()=>[],applyHeal:(...args:any[])=>calls.push(args),addLog(){}};
      const e:any={source,node:'round_end',order:0,codeId:atom?'heal':'effect_sequence',params:atom?{amount:17}:{clause:{raw:'17',trig:'round_end',parsed:true,body:[{acts:[a('heal_flat',{amount:17})]}]}}};
      runNode('round_end',[e],{},ctx);assert.equal(calls.length,1);assert.deepEqual(calls[0][2].recoveryOrigin,{kind,sourceSide:'p1',sourceBattleId:'S'});
    }
  });
  await check('回血分類須明確來源與持有者；不能從名字或目前選招推測',()=>{
    const origin:any={kind:'skill',sourceSide:'p1',sourceBattleId:'A'};
    assert.equal(blocksOwnSkillRecovery(origin,'p1','A',1),true);
    for(const [who,id,source] of [['p2','A',origin],['p1','B',origin],['p1','A',{...origin,kind:'soul'}],['p1','A',undefined]] as any[])assert.equal(blocksOwnSkillRecovery(source,who,id,1),false);
    assert.equal(blocksOwnSkillRecovery(origin,'p1','A',1,true),false);assert.equal(blocksOwnSkillRecovery(origin,'p1','A',0),false);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 下2回合技能／全域禁療不提前封住當回合，第三次收尾後解除`,async()=>{
      for(const scope of ['own_skill','all']) {
        const lock=h.kitSkill('下2回合禁療',[a('no_heal',{turns:2,next:true,scope})]);
        const hist=await h.play(side,{self:h.unit('S',1000,[h.healSkill(100)],{maxHp:2000}),opp:h.unit('E',100000,[lock,h.wait()],{speed:200}),turns:(_e,t)=>[0,t===1?0:1]},4);
        assert.deepEqual(hist.map(r=>r.self.currentHp),[1100,1100,1100,1200],scope);
      }
    });
    await check(`${side} 舊汲取API也保留來源；手寫技能封恢復而手寫魂印仍恢復`,async()=>{
      const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');const skills=getBattleSkillRegistry();
      const lock=h.kitSkill('禁止自身技能回血',[a('no_heal',{turns:2,scope:'own_skill'})]);
      skills['舊汲取來源驗證']=(ctx:any)=>ctx.applyAbsorb(ctx.targetSide,200);
      h.S['舊魂印汲取來源驗證']=(ctx:any,event:any)=>{if(event==='ROUND_END')ctx.applyAbsorb(ctx.targetSide,200);};
      try {
        const [r]=await h.play(side,{self:h.unit('S',1000,[{...h.wait(),name:'舊汲取來源驗證'}],{maxHp:2000}),opp:h.unit('E',100000,[lock],{speed:200})});assert.equal(r.self.currentHp,1000);assert.equal(r.opp.currentHp,99800);
        const [s]=await h.play(side,{self:h.unit('舊魂印汲取來源驗證',1000,[h.wait()],{maxHp:2000}),opp:h.unit('E',100000,[lock],{speed:200})});assert.equal(s.self.currentHp,1200);assert.equal(s.opp.currentHp,99800);
      }finally{delete skills['舊汲取來源驗證'];delete h.S['舊魂印汲取來源驗證'];}
    });
    await check(`${side} 吸血保留效果來源，技能吸血被封而魂印吸血不被錯封`,async()=>{
      const lock=h.kitSkill('禁止自身技能回血',[a('no_heal',{turns:2,scope:'own_skill'})]);
      const attack=h.kitSkill('攻擊吸血',[a('vampire',{ratio:1,kind:'攻擊'})],{category:'物理',power:100});
      const [r]=await h.play(side,{self:h.unit('S',1000,[attack],{maxHp:10000}),opp:h.unit('E',100000,[lock],{speed:200})});
      assert.equal(r.self.currentHp,1000);assert.ok(r.opp.currentHp<100000);
      const passive={name:'被動攻擊吸血',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_skill_use',source:'soulmark',order:0,params:{clause:{raw:'攻擊吸血',trig:'self_attack',parsed:true,body:[{acts:[a('vampire',{ratio:1,kind:'攻擊'})]}]}}}]};
      const [s]=await h.play(side,{self:h.unit('S',1000,[{...attack,kit:[]}],{maxHp:10000,extra:{soulMark:passive}}),opp:h.unit('E',100000,[lock],{speed:200})});assert.ok(s.self.currentHp>1000);
    });
    await check(`${side} 封自身技能回血含當回合2回合，魂印回血正常，第三回合解除`,async()=>{
      const lock=h.kitSkill('精確禁療',[a('no_heal',{turns:2,scope:'own_skill'})]);
      const soul={name:'魂印回血',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'round_end',source:'soulmark',order:0,params:{clause:{raw:'回合末17',trig:'round_end',parsed:true,body:[{acts:[a('heal_flat',{amount:17})]}]}}}]};
      const hist=await h.play(side,{self:h.unit('S',1000,[h.healSkill(100)],{maxHp:2000,speed:100,extra:{soulMark:soul}}),opp:h.unit('E',100000,[lock,h.wait()],{speed:200}),turns:(_e,t)=>[0,t===1?0:1]},3);
      assert.deepEqual(hist.map(r=>r.self.currentHp),[1017,1034,1151]);
    });
    await check(`${side} 實際藥劑不被技能禁療封住；不讀敵方個體的同名鍵`,async()=>{
      const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
      const {BATTLE_ITEMS}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
      const other=side==='p1'?'p2':'p1',self=h.unit('S',1000,[h.wait()],{maxHp:2000}),opp=h.unit('E',100000,[h.wait()]);
      const engine=createBattleEngine({initialP1Team:[side==='p1'?self:opp],initialP2Team:[side==='p2'?self:opp],p1StarterId:side==='p1'?'S':'E',p2StarterId:side==='p2'?'S':'E',battleMode:'PVP',preparedTeams:true,isFast:()=>true});
      try {engine.mount();engine.start();await engine.idle();engine.getState()[`${side}RegistryState`].skillHealBlockTurns=2;
        if(side==='p2')engine.onSkillSelect(other,engine.getState()[other].skills[0]);
        engine.onUseItem(side,BATTLE_ITEMS.find((i:any)=>i.id==='hp_150'));
        if(side==='p1')engine.onSkillSelect(other,engine.getState()[other].skills[0]);await engine.idle();
        assert.equal(engine.getState()[side].currentHp,1150);assert.equal(engine.getState()[`${side}ItemInventory`].hp_150.left,99);
      }finally{engine.unmount();}
    });
    await check(`${side} 固定吸取被封只擋恢復，傷害仍結算；跨方技能恢復不是自身技能`,async()=>{
      const lock=h.kitSkill('鎖',[a('no_heal',{turns:2,scope:'own_skill'})]);
      const drain=h.kitSkill('固定吸取',[a('drain',{flat:200,true:false})]);
      const [r]=await h.play(side,{self:h.unit('S',1000,[drain],{maxHp:2000}),opp:h.unit('E',100000,[lock],{speed:200})});
      assert.equal(r.self.currentHp,1000);assert.equal(r.opp.currentHp,99800);
      const healOther=h.kitSkill('敵側給回復',[a('no_heal',{turns:2,scope:'own_skill'}),a('heal',{side:'opp',ratio:.1})]);
      const [cross]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:2000}),opp:h.unit('E',100000,[healOther],{speed:200})});assert.equal(cross.self.currentHp,1200);
    });
    await check(`${side} 聖影整招150→250→350固定吸取，回合結束未擊敗才強化，不擅改成全域禁療`,async()=>{
      const skill={...h.find('300','聖影流光破'),category:'屬性',power:0};assert.equal(skill.effectMode,'kit');
      const hist=await h.play(side,{self:h.unit('S',1000,[skill],{maxHp:10000}),opp:h.unit('E',100000,[h.wait()])},4);
      assert.deepEqual(hist.map(r=>r.self.currentHp),[1150,1400,1750,2100]);assert.equal(hist[3].self.statStages.spatk,4);assert.equal(hist[3].self.statStages.speed,4);
      const kill={...skill,kit:[skill.kit[2],{codeId:'effect_sequence',node:'on_skill_use',source:'skill',role:'attached',order:9,params:{clause:{raw:'擊敗測試',trig:'use',parsed:true,body:[{acts:[a('dmg',{flat:100000,type:'真實'})]}]}}}]};
      const [dead]=await h.play(side,{self:h.unit('S',1000,[kill]),opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('N',10000,[h.wait()])]});assert.equal(dead.self.statStages.spatk||0,0);
    });
    await check(`${side} 神靈救世光未擊敗後追傷可由屬性技能觸發，僅下次一次`,async()=>{
      const skill={...h.find('5000','神靈救世光'),category:'屬性',power:0};
      const hist=await h.play(side,{self:h.unit('S',1000,[skill,h.wait()],{maxHp:3000}),opp:h.unit('E',100000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[99600,98600,98600]);assert.equal(hist[0].self.currentHp,1400,'初始低血吸取翻倍為400');
    });
    await check(`${side} 消回合成功才開技能禁療；清除鏡像解除限制`,async()=>{
      const skill={...h.find('300','聖影流光破'),category:'屬性',power:0};
      const hist=await h.play(side,{self:h.unit('S',1000,[skill,h.wait()],{maxHp:10000,speed:200}),opp:h.unit('E',1000,[h.turnEffectSkill(),h.healSkill(100)],{maxHp:10000}),turns:(_e,t)=>[t===2?0:1,t===1?0:1]},4);
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[1000,850,850,950]);
      const clean=h.kitSkill('清自身回合',[a('clear_turn',{side:'self'}),a('heal_flat',{amount:100})]);
      const [r]=await h.play(side,{self:h.unit('S',1000,[clean],{maxHp:2000}),opp:h.unit('E',100000,[h.kitSkill('禁療',[a('no_heal',{turns:2,scope:'own_skill'})])],{speed:200})});assert.equal(r.self.currentHp,1100);
    });
  }
  console.log(`${checks} 回復來源與完整技能積木後台情境通過；未聲稱所有舊直接改HP路徑已遷移`);
}finally{await h.close();}
