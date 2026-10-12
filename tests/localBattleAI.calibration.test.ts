import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
const load = (path:string) => server.ssrLoadModule('/src/'+path+'.ts');
const {createBattleEngine} = await load('engine/battleEngine');
const {getBattleSkillRegistry} = await load('effects/battleEventRegistry');
const {planDecision} = await load('battle/ai/search');
const {simulateAction} = await load('battle/ai/simulation');
const {decisionKnowledge} = await load('battle/ai/knowledge');
const {DEFAULT_AI_SETTINGS} = await load('battle/ai/settings');
const {AI_STYLES} = await load('battle/ai/styles');
const registry=getBattleSkillRegistry();
const skill=(name:string,power=0,category='物理'):any=>({name,power,category:power?category:'屬性',type:'普通',pp:10,maxPp:10,isSureHit:true,description:''});
const elf=(id:string,skills:any[],hp=1000):any=>({id,name:id,battleId:id,type:'普通',level:100,currentHp:hp,maxHp:hp,
  baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},calculatedStats:{hp,atk:350,spatk:350,def:220,spdef:220,speed:200},statStages:{},skills});
const handlers:Record<string,(ctx:any)=>void>={
  'AI校準無用物攻':c=>c.updateElf(c.actor,{statStages:{...c.self.statStages,atk:6}}),
  'AI校準巨大盾':c=>c.updateElf(c.actor,{shield:Math.max(c.self.shield||0,c.self.maxHp*10),statStages:{...c.self.statStages,atk:6,def:6,spatk:6,spdef:6,speed:6,accuracy:6}}),
  'AI校準回血':c=>c.applyHeal(c.actor,c.self.maxHp/2),
  'AI校準有效物攻':c=>c.updateElf(c.actor,{statStages:{...c.self.statStages,atk:6}}),
  'AI校準堆盾':c=>c.updateElf(c.actor,{shield:c.self.maxHp*10}),
  'AI校準死亡':c=>c.updateElf(c.targetSide,{currentHp:0}),
  'AI風格穩守':c=>{c.updateElf(c.actor,{shield:500});c.addTimerTo(c.actor,{id:'ai-style-guard',name:'保護',kind:'turn_effect',source:'skill',remaining:2,tickAt:'round_end',ownerBattleId:c.self.battleId,payload:{blockDamage:true}},false);},
  'AI風格干擾':c=>c.applyStatusWithImmunityCheck(c.targetSide,'害怕',3),
  'AI風格續航':c=>c.applyHeal(c.actor,c.self.maxHp*0.3),
  'AI風險押盾':c=>{if(Math.random()<0.5)c.updateElf(c.actor,{shield:10000});},
};
// Independent behavioral requirements, not generated from score order.
const cases=[
  {name:'純特殊攻擊者不為無用物攻放棄有效攻擊', own:()=>elf('A',[skill('AI校準無用物攻'),skill('AI校準特攻',40,'特殊')]),foe:()=>elf('B',[skill('AI校準等待')]),expected:1},
  {name:'有後備時仍先確定擊敗，不為巨大護盾六項強化放棄擊殺',own:()=>elf('A',[skill('AI校準巨大盾'),skill('AI校準死亡',1)]),foe:()=>elf('B',[skill('AI校準等待')]),expected:1,bench:true},
  {name:'滿血時不浪費回血回合',own:()=>elf('A',[skill('AI校準回血'),skill('AI校準攻擊',90)]),foe:()=>elf('B',[skill('AI校準等待')]),expected:1},
  {name:'低血受攻擊時恢復而非無收益等待',own:()=>{const e=elf('A',[skill('AI校準回血'),skill('AI校準等待')]);e.currentHp=200;return e;},foe:()=>elf('B',[skill('AI校準敵攻',30)]),expected:0},
  {name:'有可用物理攻擊時仍保留有效強化的價值',own:()=>elf('A',[skill('AI校準有效物攻'),skill('AI校準微攻',1)]),foe:()=>elf('B',[skill('AI校準等待')]),expected:0},
  {name:'已有完整護盾且對手無輸出時不繼續堆十倍盾',own:()=>{const e=elf('A',[skill('AI校準堆盾'),skill('AI校準攻擊',90)]);e.shield=e.maxHp;return e;},foe:()=>elf('B',[skill('AI校準等待')]),expected:1},
];
let total=0,failures=0;
const audit=process.argv.includes('--audit');
Object.assign(registry,handlers);
try {
  for(const c of cases)for(const side of ['p1','p2'] as const){
    const own=c.own(),foe=c.foe();foe.calculatedStats.speed=100;
    const otherTeam=c.bench?[foe,elf('後備',[skill('AI校準等待')])]:[foe];
    const engine=createBattleEngine({initialP1Team:side==='p1'?[own]:otherTeam,initialP2Team:side==='p2'?[own]:otherTeam,
      p1StarterId:side==='p1'?own.id:foe.id,p2StarterId:side==='p2'?own.id:foe.id,preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    const st=structuredClone(engine.getState());engine.unmount();st.p1ItemInventory={};st.p2ItemInventory={};
    const result=await planDecision({state:decisionKnowledge(st,side).state,side,seed:17,
      settings:{...DEFAULT_AI_SETTINGS,difficulty:'hard',budgetMs:2000}},simulateAction);
    const pass=result.mode==='planner'&&result.action.kind==='skill'&&result.action.slot===c.expected;
    total++;if(!pass)failures++;
    console.log(`${pass?'✓':'✗'} ${side} ${c.name}: ${result.candidates.find((v:any)=>v.action.slot===result.action.slot)?.label} / `+
      result.candidates.map((v:any)=>`${v.label}=${v.score.toFixed(2)}`).join(', '));
    if(!audit)assert.ok(pass,`${side}/${c.name}；${result.fallbackReason||''}`);
  }
  console.log(`AI行為校準 ${total-failures}/${total}，失敗 ${failures}；${audit?'稽核不阻斷':'語意斷言'}`);
  for(const side of ['p1','p2'] as const){
    const own=elf('A',[skill('AI風格強攻',300),skill('AI風格穩守'),skill('AI風格干擾'),skill('AI風格續航')]);own.currentHp=600;
    const foe=elf('B',[skill('AI校準等待')]);foe.calculatedStats.speed=100;
    const engine=createBattleEngine({initialP1Team:side==='p1'?[own]:[foe],initialP2Team:side==='p2'?[own]:[foe],p1StarterId:side==='p1'?'A':'B',p2StarterId:side==='p2'?'A':'B',preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    const st=structuredClone(engine.getState());engine.unmount();st.p1ItemInventory={};st.p2ItemInventory={};
    const expected:Record<string,number>={balanced:0,aggressive:0,defensive:1,disruptive:2,sustain:3};
    for(const style of Object.keys(AI_STYLES)){
      const report=await planDecision({state:decisionKnowledge(st,side).state,side,seed:17,settings:{...DEFAULT_AI_SETTINGS,style,difficulty:'hard',budgetMs:2000}},simulateAction);
      const pass=report.mode==='planner'&&report.action.slot===expected[style];
      console.log(`${pass?'✓':'✗'} ${side}/${style}: ${report.candidates.map((v:any)=>`${v.label}=${v.score.toFixed(2)}`).join(', ')}`);
      if(!audit)assert.ok(pass,`${side}/${style}不同風格必須有實際選招差異`);
    }
  }
  // 同一戰局、同一組機率樣本；只改風險，不能把「激進」偷偷當成攻擊加權。
  for(const side of ['p1','p2'] as const){
    const own=elf('A',[skill('AI風險穩攻',40),skill('AI風險押盾')]);
    const foe=elf('B',[skill('AI校準等待')]);foe.calculatedStats.speed=100;
    const engine=createBattleEngine({initialP1Team:side==='p1'?[own]:[foe],initialP2Team:side==='p2'?[own]:[foe],p1StarterId:side==='p1'?'A':'B',p2StarterId:side==='p2'?'A':'B',preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    const st=structuredClone(engine.getState());engine.unmount();st.p1ItemInventory={};st.p2ItemInventory={};
    for(const risk of ['conservative','reckless']){
      const report=await planDecision({state:decisionKnowledge(st,side).state,side,seed:17,settings:{...DEFAULT_AI_SETTINGS,risk,difficulty:'easy',budgetMs:2000}},simulateAction);
      const expected=risk==='conservative'?0:1;
      const pass=report.mode==='planner'&&report.action.slot===expected;
      console.log(`${pass?'✓':'✗'} ${side}/${risk}: ${report.candidates.map((v:any)=>`${v.label}=${v.score.toFixed(2)} [${v.worst.toFixed(2)},${v.best.toFixed(2)}]`).join(', ')}`);
      if(!audit){assert.ok(pass,`${side}/${risk}保守可進攻，激進可押防守`);assert.ok(report.completedSweeps>=2);}
    }
  }
  let wins=0;
  for(const side of ['p1','p2'] as const){
    const own=elf('A',[skill('AI校準巨大盾'),skill('AI校準死亡',1)]),foe=elf('B',[skill('AI校準等待')]);
    const engine=createBattleEngine({initialP1Team:side==='p1'?[own]:[foe],initialP2Team:side==='p2'?[own]:[foe],p1StarterId:side==='p1'?'A':'B',p2StarterId:side==='p2'?'A':'B',preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    const st=structuredClone(engine.getState());engine.unmount();st.p1ItemInventory={};st.p2ItemInventory={};
    for(const style of Object.keys(AI_STYLES))for(const risk of ['conservative','balanced','reckless']){
      const report=await planDecision({state:st,side,seed:17,settings:{...DEFAULT_AI_SETTINGS,style,risk,difficulty:'hard',budgetMs:2000}},simulateAction);
      const pass=report.mode==='planner'&&report.action.slot===1;if(pass)wins++;
      if(!audit)assert.ok(pass,`${side}/${style}/${risk}不能因偏好放棄本回合確定獲勝`);
    }
  }
  console.log(`✓ 全部風格×風險×P1/P2優先確定勝利：${wins}/30`);
} finally {for(const name of Object.keys(handlers))delete registry[name];await server.close();}
