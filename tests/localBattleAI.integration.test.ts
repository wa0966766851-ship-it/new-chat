import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
const load=(p:string)=>server.ssrLoadModule('/src/'+p+'.ts');
const {createBattleEngine}=await load('engine/battleEngine');
const {getBattleSkillRegistry}=await load('effects/battleEventRegistry');
const {planDecision}=await load('battle/ai/search');
const {simulateAction}=await load('battle/ai/simulation');
const {decisionKnowledge}=await load('battle/ai/knowledge');
const {DEFAULT_AI_SETTINGS,settingsForSide}=await load('battle/ai/settings');
const {fallbackDecision}=await load('battle/ai/decision');
const {DEFAULT_ELVES}=await load('data/defaultElvesLoaded');
const {legalActions}=await load('battle/ai/legalActions');
const {heuristicRanking}=await load('battle/ai/heuristic');
const {actionKey}=await load('battle/ai/types');
const R=getBattleSkillRegistry(),engines:any[]=[];
const skill=(name:string,power=0):any=>({name,power,category:power?'物理':'屬性',type:'普通',pp:10,maxPp:10,isSureHit:true,description:''});
const elf=(id:string,skills:any[]):any=>({id,name:id,battleId:id,type:'普通',level:100,maxHp:1000,currentHp:1000,
  calculatedStats:{hp:1000,atk:350,spatk:350,def:220,spdef:220,speed:200},baseStats:{hp:100,atk:100,spatk:100,def:100,spdef:100,speed:100},skills,statStages:{}});
const handlers:Record<string,(c:any)=>void>={
  'AI整合護盾':c=>c.updateElf(c.actor,{shield:500}),
  'AI新精靈恢復':c=>c.applyHeal(c.actor,500),
};
Object.assign(R,handlers);
const waitFor=async(fn:()=>boolean,label:string)=>{for(let i=0;i<500&&!fn();i++)await new Promise(r=>setTimeout(r,10));assert.ok(fn(),label);};
let checks=0;
const check=async(name:string,run:()=>any)=>{await run();checks++;console.log('✓ '+name);};
try{
  await check('P1託管與P2敵方使用同一真引擎推演，風格／風險各自套用',async()=>{
    const requests:any[]=[],reports:any[]=[];
    const a=elf('A',[skill('AI整合攻擊',90),skill('AI整合護盾')]);
    const b=elf('B',[skill('AI整合攻擊',90),skill('AI整合護盾')]);
    let engine:any;
    engine=createBattleEngine({initialP1Team:[a],initialP2Team:[b],p1StarterId:'A',p2StarterId:'B',preparedTeams:true,battleMode:'PVE',isFast:()=>true,
      aiSettings:()=>({...DEFAULT_AI_SETTINGS,difficulty:'hard',budgetMs:2000,style:'aggressive',ownStyle:'defensive',risk:'reckless',ownRisk:'conservative'}),
      selectAi:async(req:any)=>{
        requests.push(req);
        const known=decisionKnowledge(req.state,req.side);
        return planDecision({...req,state:known.state},simulateAction);
      },onAIDecision:(report:any)=>reports.push(report),
      onStateCommit:(st:any)=>{if(st.turnNumber>=2&&st.isAutoBattle)engine.dispatch({type:'SET_AUTO_BATTLE',isAuto:false});}});
    engines.push(engine);engine.mount();engine.start();await engine.idle();
    engine.dispatch({type:'SET_ITEM_INVENTORY',side:'p1',inventory:{}});
    engine.dispatch({type:'SET_ITEM_INVENTORY',side:'p2',inventory:{}});
    engine.dispatch({type:'SET_AUTO_BATTLE',isAuto:true});
    await waitFor(()=>engine.getState().turnNumber>=2,'託管完成正式回合');await engine.idle();
    assert.deepEqual(requests.map(r=>r.side),['p1','p2']);
    assert.equal(requests[0].settings.style,'defensive');assert.equal(requests[0].settings.risk,'conservative');
    assert.equal(requests[0].opponentSettings.style,'aggressive');
    assert.equal(requests[1].settings.style,'aggressive');assert.equal(requests[1].settings.risk,'reckless');
    assert.equal(requests[1].opponentSettings.style,'defensive');
    assert.ok(reports.every(r=>r.mode==='planner'&&r.simulations>0));
    assert.equal(reports[0].action.slot,1,'我方穩守實際用盾');assert.equal(reports[1].action.slot,0,'敵方強攻實際攻擊');
    assert.ok(engine.getState().p1.shield>0);assert.ok(engine.getState().p2.skills[0].pp<10);
  });
  await check('託管等待結果時關閉，不把舊結果寫成手動選招',async()=>{
    let req:any,finish:any;
    const a=elf('A',[skill('AI整合攻擊',90)]),b=elf('B',[skill('AI整合等待')]);
    const engine=createBattleEngine({initialP1Team:[a],initialP2Team:[b],p1StarterId:'A',p2StarterId:'B',preparedTeams:true,battleMode:'PVP',isFast:()=>true,
      selectAi:(r:any)=>{req=r;return new Promise(ok=>finish=ok);}});
    engines.push(engine);engine.mount();engine.start();await engine.idle();
    engine.dispatch({type:'SET_AUTO_BATTLE',isAuto:true});
    await waitFor(()=>!!finish,'託管已呼叫共同決策入口');
    engine.dispatch({type:'SET_AUTO_BATTLE',isAuto:false});
    finish(fallbackDecision(req));await engine.idle();
    assert.equal(engine.getState().phase,'p1_select');assert.equal(engine.getState().p1SelectedSkill,null);
    assert.equal(engine.getState().p1.skills[0].pp,10);
  });
  await check('新註冊技能不需另寫AI白名單，即可經相同引擎選出有效恢復',async()=>{
    const a=elf('新精靈',[skill('AI新精靈恢復'),skill('AI整合等待')]);a.currentHp=200;
    const b=elf('B',[skill('AI整合敵攻',30)]);b.calculatedStats.speed=100;
    const engine=createBattleEngine({initialP1Team:[a],initialP2Team:[b],p1StarterId:a.id,p2StarterId:'B',preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    engines.push(engine);const st=structuredClone(engine.getState());st.p1ItemInventory={};st.p2ItemInventory={};
    const report=await planDecision({state:st,side:'p1',seed:17,settings:{...DEFAULT_AI_SETTINGS,difficulty:'hard',budgetMs:2000}},simulateAction);
    assert.equal(report.mode,'planner');assert.equal(report.action.slot,0);assert.ok(report.candidates[0].parts.some((p:any)=>p.key==='hp'&&p.value>0));
  });
  await check('動態掃描全部既有精靈：P1／P2合法槽位與評分快照接入契約',()=>{
    let count=0;
    for(const source of DEFAULT_ELVES)for(const side of ['p1','p2'] as const){
      const own=structuredClone(source);own.battleId='roster-'+own.id;const foe=elf('AI契約對手',[skill('AI整合攻擊',90)]);
      const engine=createBattleEngine({initialP1Team:side==='p1'?[own]:[foe],initialP2Team:side==='p2'?[own]:[foe],p1StarterId:side==='p1'?own.id:foe.id,p2StarterId:side==='p2'?own.id:foe.id,preparedTeams:true,battleMode:'PVP',isFast:()=>true});
      const state=structuredClone(engine.getState());engine.unmount();state.p1ItemInventory={};state.p2ItemInventory={};
      const request={state:decisionKnowledge(state,side).state,side,seed:17,settings:settingsForSide(DEFAULT_AI_SETTINGS,side)};
      const actions=legalActions(request.state,side),ranking=heuristicRanking(request);
      assert.equal(ranking.length,actions.length,`${source.name}不能漏候選`);
      assert.deepEqual(new Set(ranking.map((c:any)=>actionKey(c.action))),new Set(actions.map(actionKey)));
      assert.ok(ranking.every((c:any)=>Number.isFinite(c.score)),`${source.name}有限評分`);count++;
    }
    console.log(`  ${DEFAULT_ELVES.length}隻／${count}側別契約；不是逐句效果正確率或勝率`);
  });
  console.log(`${checks} AI接入整合測試通過`);
}finally{engines.forEach(e=>e.unmount());for(const key of Object.keys(handlers))delete R[key];await server.close();}
