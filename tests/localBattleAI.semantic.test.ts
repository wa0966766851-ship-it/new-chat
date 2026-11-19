import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const load = (name: string) => server.ssrLoadModule('/src/' + name + '.ts');
const { createBattleEngine } = await load('engine/battleEngine');
const { getBattleSkillRegistry, getSoulMarkRegistry } = await load('effects/battleEventRegistry');
const { EffectTiming } = await load('effects/types');
const { legalActions, ppMissing } = await load('battle/ai/legalActions');
const { decisionKnowledge } = await load('battle/ai/knowledge');
const { evaluatePosition } = await load('battle/ai/evaluation');
const { heuristicRanking } = await load('battle/ai/heuristic');
const { planDecision } = await load('battle/ai/search');
const { simulateAction } = await load('battle/ai/simulation');
const { createLocalAIClient } = await load('battle/ai/client');
const { DEFAULT_AI_SETTINGS, normalizeAISettings } = await load('battle/ai/settings');
const { registerAIHook, strategyAdjustment, elfHint } = await load('battle/ai/hooks');
const prd = await load('utils/prd'), prng = await load('utils/rng');
const R = getBattleSkillRegistry(), S = getSoulMarkRegistry();
const skill = (name: string, power = 0, pp = 10): any => ({ name, category: power ? '物理' : '屬性', type: '普通', power, pp, maxPp: 10, isSureHit: true, description: '' });
const elf = (id: string, hp = 800, skills = [skill('攻擊', 60)], speed = 200): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
  currentHp: hp, maxHp: hp, baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  calculatedStats: { hp, atk: 300, def: 200, spatk: 300, spdef: 200, speed }, statStages: {}, skills });
const engines: any[] = [];
function state(a = [elf('A')], b = [elf('B',800,[skill('攻擊',60)],100)]) {
  const engine = createBattleEngine({ initialP1Team: a, initialP2Team: b, p1StarterId: a[0].id, p2StarterId: b[0].id, preparedTeams: true,
    battleMode: 'PVP', randomSeed: 7, isFast: () => true });
  engines.push(engine);
  const st = structuredClone(engine.getState());
  st.p1ItemInventory = {}; st.p2ItemInventory = {};
  return st;
}
const request = (st: any, patch: any = {}): any => ({ state: st, side: 'p1', seed: 7, settings: { ...DEFAULT_AI_SETTINGS, difficulty: 'hard', budgetMs: 2000 }, ...patch });
let count = 0;
async function check(label: string, run: () => any) { await run(); count++; console.log('✓ ' + label); }
try {
  await check('設定校驗與安全預設', () => {
    assert.equal(normalizeAISettings({ budgetMs: Infinity, difficulty: 'wat' }).budgetMs,600);
    assert.equal(normalizeAISettings({ budgetMs: 999999 }).budgetMs,2000);
    assert.equal(normalizeAISettings(null).mode,'planner');
    assert.equal(normalizeAISettings({risk:'bad',ownRisk:'bad',ownStyle:'bad'}).risk,'balanced');
    assert.equal(normalizeAISettings({risk:'bad',ownRisk:'bad',ownStyle:'bad'}).ownRisk,'follow');
  });
  await check('只選合法PP／負數透支／零PP豁免，沒有可用行動則等待', () => {
    const st = state([elf('A',800,[skill('無PP',60,0)])]);
    assert.deepEqual(legalActions(st,'p1'),[{kind:'wait'}]);
    st.p1.skills[0].ppMinOffset=-5; st.p1.skills[0].pp=-1;
    assert.deepEqual(legalActions(st,'p1'),[{kind:'skill',slot:0}]);
    st.p1.skills[0].pp=-5;
    assert.deepEqual(legalActions(st,'p1'),[{kind:'wait'}]);
    st.p1.skills[0].ignorePpLimit=true;
    assert.deepEqual(legalActions(st,'p1'),[{kind:'skill',slot:0}]);
  });
  await check('正常禁切與死亡強制切換分流；0血免死替補合法', () => {
    const st=state([elf('A'),elf('L',0)]);
    st.p1Team[1].survivalRule={mode:'freeze_at_zero',active:true,preserveOffField:true,minHp:0};
    // 2026-11-13 起 0 體力存活只在免死窗口內有效（六刃／damage_survival_guard 皆同時給免死回合）。
    st.p1Team[1].deathImmunity={guardTurns:2,deathImmuneTurns:3,preserveOffField:true};
    st.p1Timers=[{remaining:2,payload:{lockSwitch:true}}];
    assert.ok(!legalActions(st,'p1').some((a:any)=>a.kind==='switch'));
    assert.deepEqual(legalActions(st,'p1',true),[{kind:'switch',index:1}]);
  });
  await check('攻擊限制不阻擋屬性技能；充能缺額不被當作缺PP', () => {
    const st=state([elf('A',800,[skill('攻擊',60),skill('輔助')])]);
    st.p1Timers=[{remaining:2,payload:{blockAttack:true}}];
    assert.deepEqual(legalActions(st,'p1'),[{kind:'skill',slot:1}]);
    st.p1.skills[0].charge=0;
    assert.equal(ppMissing(st.p1,st.p1.skills[0]),0);
  });
  await check('藥劑實際庫存與肉鴿剩餘次數都被納入', () => {
    const st=state();st.p1ItemInventory={hp_330:{left:1,max:100},special_170_clear:{left:1,max:5}};
    const actions=legalActions(st,'p1',false,0);
    assert.ok(!actions.some((a:any)=>a.id==='hp_330'));
    assert.ok(actions.some((a:any)=>a.id==='special_170_clear'));
    st.p1ItemInventory.special_170_clear.left=0;
    assert.ok(!legalActions(st,'p1').some((a:any)=>a.kind==='item'&&a.id==='special_170_clear'));
  });
  await check('負血／六刃不算死亡，評分有限且沒有0傷擊殺獎勵', () => {
    const st=state([elf('A',800,[skill('等')])],[elf('L',0,[skill('等')])]);
    st.p2.maxHp=800;st.p2.survivalRule={mode:'freeze_at_zero',active:true,preserveOffField:true,minHp:0};
    st.p2.deathImmunity={guardTurns:2,deathImmuneTurns:3,preserveOffField:true}; // 0 體力存活只在免死窗口內有效
    st.p2Team[0]=st.p2;
    const value=evaluatePosition(st,'p1',DEFAULT_AI_SETTINGS);
    assert.ok(Number.isFinite(value.total));
    assert.ok(!value.parts.some((p:any)=>p.key==='death'&&p.value!==0));
    const ranked=heuristicRanking(request(st));
    assert.ok(!ranked[0].reason.includes('擊殺')&&!ranked[0].reason.includes('斬殺'));
  });
  await check('不讀取對手未公開選招；隱匿不留下原始技能／魂印／私人狀態', () => {
    const st=state();st.p2.isConcealed=true;st.p2.soulMark={name:'秘密'};st.p2RegistryState={secret:true};
    st.p1SelectedSkill=skill('已選');st.p2SelectedSkill=skill('秘密');
    const before=structuredClone(st), knowledge=decisionKnowledge(st,'p1');
    assert.equal(knowledge.state.p2.name,'未知精靈');assert.equal(knowledge.state.p2.soulMark,undefined);
    assert.deepEqual(knowledge.state.p2RegistryState,{});
    assert.equal(knowledge.state.p1SelectedSkill,null);assert.equal(knowledge.state.p2SelectedSkill,null);
    assert.deepEqual(st,before);assert.ok(knowledge.assumptions.length);
  });
  await check('幻化敵人只能看到複製形態，不帶原形旗標；己方保持原槽', () => {
    const st=state();st.p2.illusion={target:elf('複製對象',900,[skill('複製技能',90)])};
    st.p2.secretOriginalFlag=123;st.p2Team[0]=st.p2;
    const view=decisionKnowledge(st,'p1').state;
    assert.equal(view.p2.name,'複製對象');assert.equal(view.p2.skills[0].name,'複製技能');
    assert.equal(view.p2.secretOriginalFlag,undefined);assert.equal(view.p1.skills[0].name,'攻擊');
  });
  await check('長期策略掛鉤不能修改戰局，登場加分不重複灌入推演', () => {
    const st=state();const before=structuredClone(st);
    registerAIHook('A',{strategy:(s:any)=>{s.p1.currentHp=0;return {bonus:999,reason:'測試長期策略'};}});
    assert.equal(strategyAdjustment(st,'p1',{kind:'skill',slot:0}).bonus,100);
    assert.deepEqual(st,before);registerAIHook('A',{});
    assert.ok(elfHint({...st.p1,id:'5016',name:'別名'}));
  });
  await check('真引擎推演跑到回合結束；PP／庫存／全域PRD與亂數均不污染原局', async () => {
    const st=state();const before=structuredClone(st);
    prd.resetPrd(()=>0.999);prd.prdChance('live',0.3);prng.checkPRNG('live',0.3,()=>0.999);
    const counters=prd.snapshotPrd(), counters2=prng.snapshotPRNG(), random=Math.random;
    const req=request(st,{prdCounters:counters,prngCounters:counters2});
    const after=await simulateAction(req,{kind:'skill',slot:0},{kind:'skill',slot:0},8,performance.now()+2000);
    assert.equal(after.turnNumber,st.turnNumber+1);assert.ok(after.p2.currentHp<st.p2.currentHp);
    assert.equal(after.p1.skills[0].pp,st.p1.skills[0].pp-1);assert.deepEqual(st,before);
    assert.deepEqual(prd.snapshotPrd(),counters);assert.deepEqual(prng.snapshotPRNG(),counters2);assert.equal(Math.random,random);
    const again=await simulateAction(req,{kind:'skill',slot:0},{kind:'skill',slot:0},8,performance.now()+2000);
    assert.deepEqual([after.p1.currentHp,after.p2.currentHp],[again.p1.currentHp,again.p2.currentHp]);
  });
  await check('真引擎護盾／能力提升组合優於空打；P1與P2都能推演而不是只比威力', async () => {
    R['AI組合守護']=(c:any)=>{c.updateElf(c.actor,{shield:1200,statStages:{...c.self.statStages,atk:2}});};
    for(const side of ['p1','p2']){
      const st=side==='p1'?state([elf('A',800,[skill('空打',20),skill('AI組合守護')])],[elf('B',800,[skill('敵攻',180)],100)])
        :state([elf('B',800,[skill('敵攻',180)],100)],[elf('A',800,[skill('空打',20),skill('AI組合守護')])]);
      const report=await planDecision(request(decisionKnowledge(st,side).state,{side}),simulateAction);
      assert.equal(report.mode,'planner');assert.equal(report.action.kind,'skill');assert.equal(report.action.slot,1);
      assert.ok(report.completedSweeps>=1);assert.ok(report.candidates.every((c:any)=>c.samples===report.completedSweeps));
    }
    delete R['AI組合守護'];
  });
  await check('同一種子推演可重現；首發登場不被反覆觸發', async () => {
    let entrance=0;S['A']=(c:any,event:any)=>{if(event===EffectTiming.ON_ENTRANCE)entrance++;};
    const st=state();const req=request(st);
    const a=await planDecision(req,simulateAction),b=await planDecision(req,simulateAction);
    assert.equal(entrance,0);assert.deepEqual(a.action,b.action);
    assert.deepEqual(a.candidates.map((c:any)=>c.score),b.candidates.map((c:any)=>c.score));delete S['A'];
  });
  await check('強制換人推演真的執行替補登場，不把原先死亡者留在場上', async () => {
    const st=state([elf('A'),elf('C')]);st.p1.currentHp=0;st.p1Team[0]=st.p1;st.phase='forced_switch_p1';
    S['C']=(c:any,event:any)=>{if(event===EffectTiming.ON_ENTRANCE)c.updateElf(c.actor,{shield:500});};
    const after=await simulateAction(request(st,{forced:true}),{kind:'switch',index:1},{kind:'skill',slot:0},7,performance.now()+2000);
    assert.equal(after.p1.name,'C');assert.equal(after.p1.shield,500);delete S['C'];
  });
  await check('計算失敗或未完成一輪不能拿半份結果宣稱推演成功', async () => {
    const st=state([elf('A',800,[skill('甲',60),skill('乙',60)])]);let n=0;
    const report=await planDecision(request(st),async()=>{if(++n===2)throw new Error('故意中斷');return st;});
    assert.equal(report.completedSweeps,0);assert.equal(report.mode,'heuristic');
    assert.ok(report.candidates.every((c:any)=>c.samples===0));assert.ok(report.fallbackReason.includes('故意中斷'));
  });
  await check('真引擎分支例外立即停止，不反覆重跑或污染原局',async()=>{
    const st=state([elf('A',800,[skill('AI故意故障')])]);const before=structuredClone(st);let calls=0;
    R['AI故意故障']=()=>{calls++;throw new Error('AI隔離故障');};
    const log=console.error;console.error=(...a:any[])=>{if(!a.some(v=>String(v).includes('AI隔離故障')))log(...a);};
    try{await assert.rejects(()=>simulateAction(request(st),{kind:'skill',slot:0},{kind:'skill',slot:0},7,performance.now()+1500),/AI隔離故障/);
      assert.equal(calls,1,'錯誤分支不得自動再次結算');assert.deepEqual(st,before);
    }finally{console.error=log;delete R['AI故意故障'];}
  });
  await check('PVE異步選招仍經正式回合流程；卸載後舊結果不寫回', async () => {
    let resolve:any;
    const st=state();
    const engine=createBattleEngine({initialP1Team:st.p1Team,initialP2Team:st.p2Team,p1StarterId:'A',p2StarterId:'B',initialState:st,
      battleMode:'PVE',isFast:()=>true,selectAi:(r:any)=>new Promise(ok=>{resolve=()=>ok({side:r.side,turn:1,action:{kind:'skill',slot:0},candidates:[],assumptions:[]});})});
    engines.push(engine);engine.mount();engine.onSkillSelect('p1',engine.getState().p1.skills[0]);
    assert.equal(engine.getState().phase,'p2_select');resolve();await engine.idle();assert.equal(engine.getState().turnNumber,2);
    engine.onSkillSelect('p1',engine.getState().p1.skills[0]);engine.unmount();const before=structuredClone(engine.getState());resolve();
    await new Promise(r=>setTimeout(r,5));assert.deepEqual(engine.getState(),before);
  });
  await check('戰報回合13：三成反噬確實擊敗低血目標，依目標上限算傷害',async()=>{
    const ai=elf('邁爾斯',1000,[skill('常規攻擊',20)],200);
    const target=elf('恐懼化身',4313,[skill('攻擊',20)],100);
    target.currentHp=1173;
    const st=state([ai],[target]);
    st.p1ItemInventory={atk_pct_30:{left:1,max:1}};
    const req=request(st,{shortlistSearch:true});
    const chosen=heuristicRanking(req)[0].action;
    assert.deepEqual(chosen,{kind:'item',id:'atk_pct_30'});
    const after=await simulateAction(req,chosen,{kind:'skill',slot:0},7,performance.now()+1500);
    assert.equal(after.p2.currentHp,0);
  });
  await check('戰報回合29–31：投石者不被標成技能斬殺，瀕死優先推演致命藥劑',async()=>{
    const {DEFAULT_ELVES}=await load('data/defaultElvesLoaded');
    const stone=structuredClone(DEFAULT_ELVES.find(e=>String(e.id)==='5026'));
    for (const side of ['p1','p2'] as const) {
      const enemy=side==='p1'?'p2':'p1';
      const self=elf('雷伊測試',55324,[skill('怨雷',130),skill('備用攻擊',150),skill('預備')],500);
      self.calculatedStats.atk=50000;
      self.currentHp=1;
      const target={...stone,battleId:'stone',currentHp:250,maxHp:1000,calculatedStats:{...stone.calculatedStats,speed:200}};
      const filler=Array.from({length:5},(_,i)=>elf('替補'+i,700));
      const st=side==='p1'?state([self],[target,...filler]):state([target,...filler],[self]);
      st.turnNumber=31;
      st[`${side}ItemInventory`]={hp_330:{left:1,max:1}};
      st[`${enemy}ItemInventory`]={atk_backlash_dmg:{left:1,max:1}};
      const req=request(st,{side,battleFormat:'peak_6v6',specialMode:'destiny',shortlistSearch:true,repeatedAttack:'怨雷',
        settings:{...DEFAULT_AI_SETTINGS,budgetMs:1200}});
      const ranked=heuristicRanking(req);
      assert.ok(ranked.filter(c=>c.action.kind==='skill'&&c.action.slot<2).every(c=>c.reason.includes('保留1體力')&&c.reason.includes('藥劑')));
      assert.deepEqual(ranked[0].action,{kind:'item',id:'hp_330'});
      const chosen=await planDecision(req,simulateAction);
      assert.ok(chosen.completedSweeps>0,chosen.fallbackReason);
      assert.ok(chosen.candidates.length<=4);
      assert.ok(chosen.firstSweepMs>0);
      console.log(`  ${side} 四候選首組 ${Math.round(chosen.firstSweepMs)}ms，完成 ${chosen.completedSweeps} 組`);
      const after=await simulateAction(req,{kind:'skill',slot:0},{kind:'item',id:'atk_backlash_dmg'},7,performance.now()+1500);
      assert.equal(after[side].currentHp,0);
      st[`${side}RegistryState`]={noHealTurns:1};
      assert.ok(heuristicRanking(req).find(c=>c.action.kind==='item'&&c.action.id==='hp_330').score<0);
    }
  });
  await check('陷入反覆攻擊時，預算內為兩個接近候選各比較下一回合',async()=>{
    const st=state([elf('A',800,[skill('重複攻擊',40),skill('換節奏',45)])]);
    const req=request(st,{repeatedAttack:'重複攻擊',shortlistSearch:true});
    let deeper=0;
    const report=await planDecision(req,async (branch,action)=>{
      const after=structuredClone(branch.state);
      after.turnNumber++;
      if(branch.state.turnNumber>st.turnNumber) {
        deeper++;
        after.p2.currentHp-=branch.state.p1.statStages.atk * 50;
      } else after.p1.statStages.atk=action.slot;
      return after;
    });
    assert.equal(deeper,2);
    assert.equal(report.lookahead,true);
    assert.equal(report.candidates.filter(c=>c.reason.includes('已比較下一回合')).length,2);
    assert.deepEqual(report.action,{kind:'skill',slot:1});
  });
  await check('Worker不可用與不可序列化戰局均合法回退，不在主執行緒推演', async () => {
    const client=createLocalAIClient();const req=request(state());
    const report=await client.decide(req);assert.equal(report.mode,'heuristic');assert.equal(report.simulations,0);
    req.state.p1RegistryState.dynamic=()=>{};
    const failed=await client.decide(req);assert.ok(failed.fallbackReason.includes('不可序列化'));client.dispose();
  });
  await check('背景逾時會終止Worker，保留最後完成的比較；過期ID不採用', async () => {
    const old=(globalThis as any).Worker;(globalThis as any).Worker=class{};
    const workers:any[]=[];
    class Fake {onmessage:any;onerror:any;terminated=false;constructor(){workers.push(this);}terminate(){this.terminated=true;}postMessage(data:any){
      this.onmessage({data:{id:data.id+1,type:'done',report:{action:{kind:'switch',index:99}}}});
      this.onmessage({data:{id:data.id,type:'progress',report:{side:'p1',turn:1,forced:false,action:{kind:'skill',slot:0},mode:'planner',candidates:[],assumptions:[],simulations:1,completedSweeps:1,elapsedMs:0,timedOut:false}}});
    }}
    const client=createLocalAIClient(()=>new Fake());
    try {
      client.start();workers[0].onmessage({data:{type:'ready'}});
      const report=await client.decide(request(state(),{settings:{...DEFAULT_AI_SETTINGS,budgetMs:10}}));
      assert.equal(report.completedSweeps,1);assert.equal(report.timedOut,true);assert.equal(report.action.slot,0);assert.equal(workers[0].terminated,true);
    }finally{client.dispose();(globalThis as any).Worker=old;}
  });
  await check('Worker主動完成時保留其預算截止標記，不被傳輸層清掉', async () => {
    const old=(globalThis as any).Worker;(globalThis as any).Worker=class{};
    let worker:any;
    class Fake {onmessage:any;onerror:any;terminate(){};postMessage(data:any){
      this.onmessage({data:{id:data.id,type:'done',report:{side:'p1',turn:1,forced:false,action:{kind:'skill',slot:0},mode:'planner',candidates:[],assumptions:[],simulations:1,completedSweeps:1,elapsedMs:0,timedOut:true}}});
    }}
    const client=createLocalAIClient(()=>worker=new Fake());
    try {
      client.start();worker.onmessage({data:{type:'ready'}});
      const report=await client.decide(request(state()));
      assert.equal(report.timedOut,true);assert.equal(report.completedSweeps,1);
    } finally {client.dispose();(globalThis as any).Worker=old;}
  });
  console.log(count+' local AI checks');
} finally { engines.forEach(e=>e.unmount()); await server.close(); }
