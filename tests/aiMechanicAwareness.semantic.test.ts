import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent',cacheDir:'node_modules/.vite-ai-mechanics'});
const load=(path:string)=>server.ssrLoadModule('/src/'+path+'.ts');
try {
  const {DEFAULT_ELVES}=await load('data/defaultElvesLoaded');
  const {createBattleEngine}=await load('engine/battleEngine');
  const {legalActions}=await load('battle/ai/legalActions');
  const {heuristicRanking}=await load('battle/ai/heuristic');
  const {planDecision}=await load('battle/ai/search');
  const {simulateAction}=await load('battle/ai/simulation');
  const {materializeAiAction}=await load('utils/ai');
  const {actionKey}=await load('battle/ai/types');
  const {survivalMargin,itemRecoveryGain,abnormalSideEffectsSuppressed}=await load('battle/ai/mechanicAwareness');
  const {illusionOverrideValue,pendingIllusionValue}=await load('battle/ai/illusionPlanning');
  const {DEFAULT_AI_SETTINGS}=await load('battle/ai/settings');
  const {bindBag}=await load('battle/bagTargets');
  const {getStatuses,isElfActionDisabled}=await load('utils/battleHelpers');
  const {applySavedSkillCorrections}=await load('data/savedSkillCorrections');
  const {syncOtherworldReyDescriptions}=await load('data/otherworldReyDescriptions');
  const {reyGodDescentRule}=await load('battle/survivalRules');
  const guard=(id:string,hp=1e8):any=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:hp,maxHp:hp,
    baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},
    calculatedStats:{hp,atk:100,def:500,spatk:100,spdef:500,speed:10},statStages:{atk:2,def:3},
    skills:[{name:'待機',type:'普通',category:'屬性',power:0,pp:99,maxPp:99,isSureHit:true,description:''}]});
  for(const side of ['p1','p2'] as const){
    const foe=side==='p1'?'p2':'p1';
    const old=structuredClone(DEFAULT_ELVES.find((e:any)=>e.id==='5029'));
    for(const d of [old.soulMark,old.alienTraits.gen2Trait,...old.alienTraits.exclusiveTraits]){delete d.kit;delete d.effectMode;}
    const rey=syncOtherworldReyDescriptions(applySavedSkillCorrections(old,DEFAULT_ELVES));rey.battleId='rey';
    const other=guard('enemy');
    // 對照靶也要能在雷伊施加的麻痺下行動，否則測不到真正的反覆強控。
    other.suppressAbnormalSideEffectsWhenParalyzed=true;
    other.skills[0]={...other.skills[0],name:'持續強控',priority:20,effectMode:'kit',kit:[{
      codeId:'effect_sequence',node:'on_skill_use',source:'skill',role:'attached',order:0,
      params:{clause:{raw:'令對手害怕4回合',marker:'🎯',trig:'use',parsed:true,body:[{acts:[{
        op:'status',p:{side:'opp',status:'害怕',turns:4,chance:100},label:'持續強控',
      }]}]}},
    }]};
    const teams={p1:side==='p1'?[rey]:[other],p2:side==='p2'?[rey]:[other]};
    const engine=createBattleEngine({initialP1Team:teams.p1,initialP2Team:teams.p2,p1StarterId:teams.p1[0].battleId,p2StarterId:teams.p2[0].battleId,preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    try{
      engine.mount();engine.start();await engine.idle();
      for(let turn=1;turn<=5;turn++){
        const before=engine.getState();
        assert.equal(before[side].suppressAbnormalSideEffectsWhenParalyzed,true,`${side}/${turn}魂印旗標`);
        assert.ok(getStatuses(before[side])['麻痺']>0,`${side}/${turn}保留麻痺`);
        assert.equal(isElfActionDisabled(before[side]),false,`${side}/${turn}麻痺不阻止出招`);
        engine.onSkillSelect('p1',before.p1.skills[0]);
        engine.onSkillSelect('p2',before.p2.skills[0]);await engine.idle();
        const after=engine.getState();assert.equal(after.turnNumber,turn+1);
        assert.ok(getStatuses(after[side])['害怕']>0,`${side}/${turn}真正附加控制仍保留`);
        assert.ok(after.logs.filter((l:any)=>String(l.text).includes('使用了【空墟赫星】')).length>=turn,`${side}/${turn}正式技能確實使用`);
      }
      const state=structuredClone(engine.getState());
      state[side].currentHp=-state[side].maxHp;
      state[side].survivalRule=reyGodDescentRule(state[side].maxHp);
      state[side].skills=state[side].skills.map((s:any)=>({...s,pp:0}));
      state[side].battleStatuses={'麻痺':9,'害怕':4};state[side].effects=[];
      state[`${side}Team`][0]=state[side];state[`${side}ItemInventory`]={hp_330:{left:5,max:5},pp_5:{left:5,max:5},special_170_clear:{left:5,max:5}};
      const req={state,side,seed:7,settings:{...DEFAULT_AI_SETTINGS,mode:'heuristic'}};
      const ranked=heuristicRanking(req);
      assert.equal(ranked[0].action.kind,'skill','神降＋麻痺可免PP時不誤用回復／解控／PP藥');
      assert.ok(survivalMargin(state[side])>.9);
      assert.equal(itemRecoveryGain(state[side],200),Math.floor(state[side].maxHp*.7));
      assert.equal(abnormalSideEffectsSuppressed(state[side]),true);
      console.log(`✓ ${side} 舊存檔連續5回合仍麻痺且正常出招；神降與免PP評分`);
    }finally{engine.unmount();}

    const benchOwn=[guard('starter'),structuredClone(rey)],benchEnemy=[structuredClone(other)];
    const switched=createBattleEngine({initialP1Team:side==='p1'?benchOwn:benchEnemy,initialP2Team:side==='p2'?benchOwn:benchEnemy,
      p1StarterId:side==='p1'?'starter':'enemy',p2StarterId:side==='p2'?'starter':'enemy',preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    try{
      switched.mount();switched.start();await switched.idle();
      assert.equal(switched.getState()[`${side}Team`][1].suppressAbnormalSideEffectsWhenParalyzed,true,'初始場下持有者也執行戰鬥開始積木');
      if(side==='p2')switched.onSkillSelect(foe,switched.getState()[foe].skills[0]);
      switched.onSwitchElf(side,1);
      if(side==='p1')switched.onSkillSelect(foe,switched.getState()[foe].skills[0]);
      await switched.idle();
      const entered=switched.getState();assert.equal(entered[side].battleId,'rey');
      assert.equal(entered[side].suppressAbnormalSideEffectsWhenParalyzed,true,'換上後魂印旗標仍存在');
      switched.onSkillSelect('p1',entered.p1.skills[0]);switched.onSkillSelect('p2',entered.p2.skills[0]);await switched.idle();
      assert.equal(switched.getState()[side].statStages.def,3,'換上後下一次2.1回合開始節點照常複製強化');
      assert.equal(isElfActionDisabled(switched.getState()[side]),false,'複製後麻痺與害怕不封住行動');
      assert.ok(switched.getState().logs.some((l:any)=>String(l.text).includes('使用了【空墟赫星】')),'從場下上來仍真正出招');
      console.log(`✓ ${side} 初始場下旗標、換上後回合初複製及強控下實際出招`);
    }finally{switched.unmount();}

    const caster=structuredClone(DEFAULT_ELVES.find((e:any)=>e.id==='5033'));caster.battleId='caster';
    const low=guard('low',1000),high=guard('high',1000);high.calculatedStats={hp:1000,atk:2000,def:2000,spatk:2000,spdef:2000,speed:2000};
    const own=bindBag([caster,low],1),enemy=bindBag([guard('enemy-active',1000),high],1);
    const e=createBattleEngine({initialP1Team:side==='p1'?[own[0]]:[enemy[0]],initialP2Team:side==='p2'?[own[0]]:[enemy[0]],
      p1StarterId:side==='p1'?'caster':'enemy-active',p2StarterId:side==='p2'?'caster':'enemy-active',preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    try{
      e.mount();e.start();await e.idle();const state=structuredClone(e.getState());
      state[`${side}ItemInventory`]={illusion_command:{left:1,max:99}};state[`${foe}ItemInventory`]={};
      const choices=legalActions(state,side).filter((a:any)=>a.kind==='item'&&a.id==='illusion_command');
      assert.ok(choices.some((a:any)=>a.picked.side===foe&&a.picked.battleId==='high'));
      assert.equal(new Set(choices.map(actionKey)).size,choices.length,'不同目標不合併');
      const action=choices.find((a:any)=>a.picked.battleId==='high');
      const item=materializeAiAction(state,side,action).item;assert.deepEqual(item.picked,action.picked);
      assert.ok(illusionOverrideValue(state,side,action.picked)>0,'高能力待命對象可提升下次幻化潛力');
      const staleRoot=structuredClone(state);
      for(const elf of staleRoot[`${side}Team`]){
        elf.kit=structuredClone(elf.soulMark?.kit||[]);
        if(elf.soulMark)elf.soulMark.kit=[];
        elf.skills=[];elf.trait=undefined;elf.alienTraits=undefined;
      }
      staleRoot[side]=staleRoot[`${side}Team`][staleRoot[`${side}ActiveIndex`]];
      assert.equal(illusionOverrideValue(staleRoot,side,action.picked),0,'明確移除魂印後，AI不得讀取殘留根積木而誤用幻化藥');
      const hidden=structuredClone(state),hiddenOther=structuredClone(state);
      for(const [st,amount] of [[hidden,1],[hiddenOther,999999]] as const){
        const target=st[foe].initialBench.find((elf:any)=>elf.battleId==='high');
        target.isConcealed=true;target.calculatedStats={hp:amount,atk:amount,def:amount,spatk:amount,spdef:amount,speed:amount};target.skills[0].power=amount;
      }
      assert.equal(illusionOverrideValue(hidden,side,action.picked),illusionOverrideValue(hiddenOther,side,action.picked),'隱匿快照的真實能力與技能不改變幻化估值');
      const req={state,side,seed:7,settings:{...DEFAULT_AI_SETTINGS,difficulty:'hard',budgetMs:2000}};
      const after=await simulateAction(req,action,{kind:'skill',slot:0},7,performance.now()+10000);
      assert.equal(after[`${side}ItemInventory`].illusion_command.left,0,'真正消耗道具');
      assert.deepEqual(after[`${side}RegistryState`].teamIllusionTargetOverride,action.picked,'保留指定至下次幻化');
      assert.ok(pendingIllusionValue(after,side)>0);
      const plannedState=structuredClone(state);
      // 無輸出、沒有補血／PP需求的機會回合，才應為明顯較強的下次幻化花道具。
      plannedState[side].skills=[{name:'等待幻化',type:'普通',category:'屬性',power:0,pp:99,maxPp:99,isSureHit:true,description:''}];
      plannedState[`${side}Team`][plannedState[`${side}ActiveIndex`]]=plannedState[side];
      const planned=await planDecision({...req,state:plannedState,settings:{...req.settings,difficulty:'easy',risk:'conservative'}},simulateAction);
      assert.equal(planned.mode,'planner',planned.fallbackReason);
      assert.equal(planned.action.kind,'item','真實推演會利用機會回合指定較強幻化對象');
      assert.equal(planned.action.picked?.battleId,'high');
      assert.equal(after[side].illusion?.target.battleId,e.getState()[side].illusion?.target.battleId,'藥劑不立即改寫既有幻化');
      assert.ok(!legalActions({...state,[`${side}ItemInventory`]:{}},side).some((a:any)=>a.id==='illusion_command'),'沒有庫存不可憑空使用');
      console.log(`✓ ${side} AI幻化目標列舉／傳輸／真正引擎道具消耗與延後指定`);
    }finally{e.unmount();}
  }
}finally{await server.close();}
