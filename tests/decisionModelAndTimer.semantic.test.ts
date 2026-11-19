import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
const load=(path:string)=>server.ssrLoadModule('/src/'+path+'.ts');
const {createBattleEngine}=await load('engine/battleEngine');
const {normalizeAISettings,DEFAULT_AI_SETTINGS}=await load('battle/ai/settings');
const {policyAllows,aiLegalActions}=await load('battle/ai/actionPolicy');
const {fallbackDecision}=await load('battle/ai/decision');
const {createAssistedAIClient}=await load('battle/ai/assistedClient');
const {buildDecisionContext,decisionStillCurrent}=await load('battle/ai/decisionContext');
const {normalizeTurnTimer,timerTurn,timeoutAction}=await load('battle/turnTimer');
const skill=(name:string,extra={})=>({name,type:'普通',category:'物理',power:30,pp:10,maxPp:10,description:'',...extra});
const elf=(id:string,skills=[skill('一')])=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:1000,maxHp:1000,
  skills,statStages:{},baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},calculatedStats:{hp:1000,atk:200,def:200,spatk:200,spdef:200,speed:200}});
const engines:any[]=[];
const engine=(a=[elf('A')],b=[elf('B')],extra={})=>{const e=createBattleEngine({initialP1Team:a,initialP2Team:b,p1StarterId:a[0].id,p2StarterId:b[0].id,preparedTeams:true,battleMode:'PVP',isFast:()=>true,...extra});engines.push(e);return e;};
let checks=0;
const check=async(name:string,run:()=>any)=>{await run();console.log('✓ '+name);checks++;};
try {
  await check('舊設定預設模型關閉、藥劑全開；模型時間獨立支援 120 秒',()=>{
    const s=normalizeAISettings(null);assert.equal(s.modelEnabled,false);assert.equal(s.allowDamagePotions,true);assert.equal(s.allowStatusPotions,true);assert.equal(s.allowOffensivePotions,true);
    assert.equal(normalizeAISettings({modelTimeoutMs:999999}).modelTimeoutMs,120000);assert.equal(normalizeAISettings({modelTimeoutMs:NaN}).modelTimeoutMs,15000);
    assert.deepEqual(normalizeTurnTimer(),{mode:'off',seconds:30});assert.equal(normalizeTurnTimer({seconds:1}).seconds,5);assert.equal(normalizeTurnTimer({seconds:80}).seconds,60);
  });
  await check('混合藥劑依實際效果封鎖；特殊／解除／指定幻化保留',()=>{
    const s={...DEFAULT_AI_SETTINGS,allowDamagePotions:false,allowOffensivePotions:false,allowStatusPotions:false};
    for(const id of ['inflict_dmg','atk_backlash_dmg','inflict_paralysis'])assert.equal(policyAllows({kind:'item',id},s),false,id);
    for(const id of ['special_170_clear','special_5_debuff','illusion_command','mountain_amulet','naifen_bell_grass'])assert.equal(policyAllows({kind:'item',id},s),true,id);
    const st=structuredClone(engine().getState());st.p1.skills.forEach((s:any)=>s.pp=0);st.p1ItemInventory={inflict_dmg:{left:1,max:1}};
    const req={state:st,side:'p1',settings:s,seed:1};assert.deepEqual(aiLegalActions(req),[{kind:'wait'}]);assert.deepEqual(fallbackDecision(req,undefined,[],true).action,{kind:'wait'});
  });
  await check('逾時第五技優先，逐一跳過封鎖／耗盡，不使用藥劑或普通換人',()=>{
    const st=structuredClone(engine([elf('A',[skill('一'),skill('二'),skill('三'),skill('四'),skill('五',{isFifthSkill:true})])]).getState());
    assert.deepEqual(timeoutAction(st,'p1'),{kind:'skill',slot:4});st.p1.skills[4].pp=0;assert.deepEqual(timeoutAction(st,'p1'),{kind:'skill',slot:0});
    st.p1.skills[0].isAbolished=true;assert.deepEqual(timeoutAction(st,'p1'),{kind:'skill',slot:1});st.p1.skills.forEach((s:any)=>s.pp=0);assert.deepEqual(timeoutAction(st,'p1'),{kind:'wait'});
    st.p1.skills[4].isFifthSkill=false;st.p1.skills[4].pp=10;assert.deepEqual(timeoutAction(st,'p1'),{kind:'wait'});
  });
  await check('人工選擇／PVE 等 AI 不計時；死亡雙方依序計時且強制替補忽略禁換',()=>{
    const st=structuredClone(engine([elf('A'),elf('C')],[elf('B'),elf('D')]).getState());
    assert.deepEqual(timerTurn(st,'PVE'),{side:'p1',forced:false});st.p1SelectedSkill=st.p1.skills[0];assert.equal(timerTurn(st,'PVE'),undefined);
    st.phase='p2_select';assert.equal(timerTurn(st,'PVE'),undefined);assert.deepEqual(timerTurn(st,'PVP'),{side:'p2',forced:false});
    st.phase='forced_switch_both';st.p1.currentHp=0;st.p2.currentHp=0;st.p1Timers=[{remaining:3,payload:{lockSwitch:true}}];
    assert.deepEqual(timerTurn(st,'PVP'),{side:'p1',forced:true});assert.deepEqual(timeoutAction(st,'p1',true),{kind:'switch',index:1});
    st.p1.currentHp=1;assert.deepEqual(timerTurn(st,'PVP'),{side:'p2',forced:true});assert.equal(timerTurn(st,'PVE'),undefined);
  });
  const st=structuredClone(engine([elf('A',[skill('一'),skill('二')])]).getState());st.p1ItemInventory={};st.p2ItemInventory={};
  const req:any={state:st,side:'p1',seed:7,settings:normalizeAISettings({mode:'heuristic',modelEnabled:true})};
  const report=fallbackDecision(req);
  await check('雲端欄位白名單不包含秘密選招、原始狀態／路徑／種子；隱匿遮罩',()=>{
    const source=structuredClone(st);source.p2SelectedSkill=skill('SECRET_CHOICE');source.p2RegistryState={secret:'SECRET_STATE'};source.p2.isConcealed=true;source.p2.name='SECRET_ELF';source.p2.skills=[skill('SECRET_SKILL')];
    const dto=JSON.stringify(buildDecisionContext({...req,state:source,seed:1234567,prngCounters:{SECRET_SEED:1}},report).input);
    for(const secret of ['SECRET_CHOICE','SECRET_STATE','SECRET_ELF','SECRET_SKILL','SECRET_SEED','1234567'])assert.ok(!dto.includes(secret),secret);
  });
  await check('模型關閉零請求；開啟選擇合法候選；失敗與低信心回退',async()=>{
    let calls=0;
    const fake={start(){},dispose(){},async decide(){return report;}};
    const client=createAssistedAIClient(fake,async()=>{calls++;return {choice:'a1',confidence:0.95,inputTokens:20};});
    assert.deepEqual((await client.decide({...req,settings:{...req.settings,modelEnabled:false}})).action,report.action);assert.equal(calls,0);
    const dto=buildDecisionContext(req,report);assert.deepEqual((await client.decide(req)).action,dto.shortlist[1].action);assert.equal(calls,1);client.dispose();
    const bad=createAssistedAIClient(fake,async()=>{throw Error('network');});assert.deepEqual((await bad.decide(req)).action,report.action);bad.dispose();
    const low=createAssistedAIClient(fake,async()=>({choice:'a1',confidence:0.1}));assert.deepEqual((await low.decide(req)).action,report.action);low.dispose();
  });
  await check('模型同意與低信心平手可區分；玩家選招前啟動，同局面重用一次結果',async()=>{
    let calls=0, resolve:any, payload:any;
    const fake={start(){},dispose(){},async decide(){return report;}};
    const client=createAssistedAIClient(fake,async (_route:any,body:any)=>{calls++;payload=body;return new Promise(r=>resolve=r);});
    const before={...req,settings:{...req.settings,mode:'heuristic'},state:{...st,phase:'p2_select'}};
    client.prepare(before);await new Promise(r=>setTimeout(r,0));
    assert.equal(calls,1);
    const selected={...before,state:{...before.state,p1SelectedSkill:skill('尚未公開的選招')}};
    const pending=client.decide(selected);
    resolve({choice:'a0',confidence:0.22,inputTokens:22});
    const result=await pending;
    assert.equal(calls,1);assert.equal(result.model.status,'agreed');assert.equal(result.model.prepared,true);
    assert.ok(!JSON.stringify(payload).includes('尚未公開的選招'));
    client.dispose();
  });
  await check('本地推演與模型並行，逾時保留完整比較並記錄等待來源',async()=>{
    let finishLocal:any, started=0, signal:AbortSignal|undefined;
    const compared={...report,mode:'planner',firstSweepMs:18,completedSweeps:1,simulations:2};
    const local={start(){},dispose(){},decide(_r:any,progress:any){
      return new Promise(resolve=>{finishLocal=()=>{progress(compared); resolve(compared);};});
    }};
    const client=createAssistedAIClient(local,(_route:any,body:any,s:AbortSignal)=>{
      started++;signal=s;assert.ok(body.timeoutMs>=1000);
      return new Promise(()=>{});
    });
    try {
      const slow=client.decide({...req,settings:{...req.settings,mode:'planner',budgetMs:100}});
      assert.equal(started,1,'不等待本地完成才送模型');
      finishLocal();
      const result=await slow;
      assert.equal(signal?.aborted,true);
      assert.equal(result.mode,'planner');assert.equal(result.completedSweeps,1);
      assert.equal(result.timing.waitBudgetMs,100);
      assert.equal(result.timing.firstSweepMs,18);
      assert.equal(result.timing.modelWaitExpired,true);
    } finally {client.dispose();}
  });
  await check('PVE 在玩家出招前啟動對手評估，整場事件涵蓋雙方選招與結算',async()=>{
    const warm:any[]=[], actions:any[]=[];
    const a=[elf('A',[skill('玩家出招')])],b=[elf('B',[skill('模型出招')])];
    const e=engine(a,b,{battleMode:'PVE',aiSettings:()=>({...req.settings,modelEnabled:true}),
      prepareAi:(r:any)=>warm.push(r),selectAi:async(r:any)=>({...fallbackDecision(r),action:{kind:'skill',slot:0}}),
      onBattleAction:(event:any)=>actions.push(event)});
    e.mount();e.start();await e.idle();
    assert.ok(warm.length>0);assert.equal(warm[0].side,'p2');assert.equal(warm[0].state.p1SelectedSkill,null);
    e.onSkillSelect('p1',e.getState().p1.skills[0]);await e.idle();
    for(const side of ['p1','p2']) {
      assert.ok(actions.some(x=>x.side===side&&x.stage==='selected'),side);
      assert.ok(actions.some(x=>x.side===side&&x.stage==='resolved'&&x.hpDamage>0),side);
    }
  });
  await check('關閉／取消／卸載後舊模型回應作廢',async()=>{
    let resolve:any;
    const client=createAssistedAIClient({start(){},dispose(){},async decide(){return report;}},()=>new Promise(r=>resolve=r));
    const pending=client.decide(req);await new Promise(r=>setTimeout(r,0));client.cancel();resolve({choice:'a1',confidence:0.99});
    assert.deepEqual((await pending).action,report.action);client.dispose();
  });
  await check('新回合有效請求不誤取消；死亡換人忽略上回合殘留選招',async()=>{
    const dead={...st,phase:'forced_switch_p1',p1SelectedSkill:st.p1.skills[0]};
    assert.equal(decisionStillCurrent({...req,state:dead,forced:true},dead),true);
    assert.equal(decisionStillCurrent({...req,state:dead,forced:true},{...dead,phase:'p1_select'}),false);
    assert.equal(decisionStillCurrent(req,{...st,p1SelectedSkill:st.p1.skills[0]}),false);
    let resolve:any,signal:AbortSignal|undefined,current=true;
    const client=createAssistedAIClient({start(){},dispose(){},async decide(){return report;}},(_r:any,_b:any,s:AbortSignal)=>{signal=s;return new Promise(r=>resolve=r);},()=>current);
    const pending=client.decide(req);await new Promise(r=>setTimeout(r,0));client.sync();assert.equal(signal?.aborted,false);
    current=false;client.sync();assert.equal(signal?.aborted,true);resolve({choice:'a1',confidence:0.99});assert.deepEqual((await pending).action,report.action);client.dispose();
  });
  await check('死亡換人仍走模型選擇入口，人工換人後舊結果不覆蓋',async()=>{
    let resolve:any;const e=engine([elf('A'),elf('C'),elf('E')],[elf('B')],{selectAi:(r:any)=>new Promise(ok=>resolve=()=>ok({...fallbackDecision(r),action:{kind:'switch',index:2}}))});
    e.dispatch({type:'UPDATE_ELF',side:'p1',elf:{currentHp:0}});e.dispatch({type:'SET_PHASE',phase:'forced_switch_p1'});
    const pending=e.performAIAction('p1',true);await new Promise(r=>setTimeout(r,0));assert.ok(resolve);e.onSwitchElf('p1',1);resolve();await pending;
    assert.equal(e.getState().p1ActiveIndex,1);
  });
  console.log(`${checks} 項模型／藥劑／計時器語義驗證通過`);
} finally {engines.forEach(e=>e.unmount());await server.close();}
process.exit(0);
