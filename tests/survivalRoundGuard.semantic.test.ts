import assert from 'node:assert/strict';
import {createServer} from 'vite';
/**
 * 存活／死亡判定整理（2026-11-13）：
 * 神降死亡線、六刃免死窗口、柯爾德／柯爾霍德／墜霆·雷伊／龍魂再臨的「當回合致死保留1點」、蓋亞致死門檻、卡修斯超額需護盾。
 */
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
 const sr=await server.ssrLoadModule('/src/battle/survivalRules.ts');
 const {checkElfDead}=await server.ssrLoadModule('/src/battle/elfAlive.ts');
 const {isLethalExcessTrue}=await server.ssrLoadModule('/src/battle/teamPassiveRules.ts');
 const rt=await server.ssrLoadModule('/src/blocks/runtime.ts');
 const {EffectTiming}=await server.ssrLoadModule('/src/effects/types.ts');
 const {sequenceIssue}=await server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const {MIGRATED_KELD_SOUL_KIT:keld}=await server.ssrLoadModule('/src/data/migratedKeldSoulKit.ts');
 const {MIGRATED_KEERHODE_SOUL_KIT:keer}=await server.ssrLoadModule('/src/data/migratedKeerhodeSoulKit.ts');
 const {FINAL_GAIA_SOUL_KIT:gaia}=await server.ssrLoadModule('/src/data/finalGaiaSoulKit.ts');
 const {CORRUPTED_REY_SEEDS:rey}=await server.ssrLoadModule('/src/data/corruptedRey.ts');
 // 神降：上限被壓到 1 時非真傷仍至少扣 1，抵達 -70 即死亡
 const god={mode:'god_descent',active:true,preserveOffField:true,floorMult:70,minHp:0};
 const t=sr.resolveDamageTransition(-69,1,999,'non_true',god);assert.deepEqual([t.hp,t.alive],[-70,false],'上限1：-69→-70 死亡');
 assert.equal(checkElfDead({currentHp:-70,maxHp:1,survivalRule:god}),true);
 assert.equal(checkElfDead({currentHp:-5000,maxHp:1000,survivalRule:god}),false);
 // 六刃：0體力存活只在免死窗口內
 const lr=sr.liurenSurvivalRule();
 assert.equal(checkElfDead({currentHp:0,maxHp:900,survivalRule:lr,deathImmunity:{guardTurns:0,deathImmuneTurns:1}}),false);
 assert.equal(checkElfDead({currentHp:0,maxHp:900,survivalRule:lr}),true,'免死到期後0體力陣亡');
 assert.equal(sr.releaseExpiredSurvivalRule(lr,{deathImmuneTurns:0}),undefined);
 // 卡修斯：沒有護盾不算超額
 assert.equal(isLethalExcessTrue(5000,0,3000),false);assert.equal(isLethalExcessTrue(5000,100,3000),true);
 // 觸發與條件
 const ctx:any={actor:'p1',targetSide:'p2',self:{maxHp:1000,currentHp:300},getPlayerState:()=>undefined,getOpponentState:()=>undefined,activeP1:{},activeP2:{},p1Timers:[],p2Timers:[]};
 assert.deepEqual(rt.eventTriggers(ctx,EffectTiming.ON_DAMAGED,{targetSide:'p2',damageType:'true'}),['opp_damaged_true'],'對手受真傷通知在場觀察者');
 const st=(d:number)=>({last:null,lastAmount:0,event:{trig:'fatal',data:{fatalDamage:d}}});
 assert.equal(rt.evalCond(ctx,{c:'fatal_damage',p:{basis:'max_hp',op:'不小於',ratio:1}},st(1000)),true);
 assert.equal(rt.evalCond(ctx,{c:'fatal_damage',p:{basis:'max_hp',op:'不小於',ratio:1}},st(999)),false);
 assert.equal(rt.evalCond(ctx,{c:'switch_blocked',p:{side:'opp'}},st(0)),false);
 const locked={...ctx,p2Timers:[{id:'x',remaining:2,payload:{lockSwitch:true},scope:'team'}]};
 assert.equal(rt.evalCond(locked,{c:'switch_blocked',p:{side:'opp'}},st(0)),true,'對手被鎖切換');
 // 定義：契約通過＋關鍵動作
 const acts=(e:any)=>JSON.stringify(e.params.clause.body);
 for(const e of [...keld.kit,...keer.kit,...gaia])assert.equal(sequenceIssue(e.params.clause,e.node),null,e.customText);
 assert.match(acts(keld.kit.find((e:any)=>e.node==='self_fatal')),/survive_turns/,'柯爾德：當回合每次致死保留1點');
 assert.ok(keer.kit.some((e:any)=>e.params.clause.trig==='opp_damaged_true'),'柯爾霍德：對手受真傷也觸發');
 assert.match(acts(keer.kit.find((e:any)=>e.node==='self_fatal')),/keerhodeNightGuard/,'柯爾霍德：只有當回合觸發過才存活');
 assert.match(JSON.stringify(gaia.find((e:any)=>e.params.clause.trig==='fatal')),/fatal_damage/,'蓋亞：致死傷害需≥體力上限');
 const yuan=rey.flatMap((s:any)=>s.skills).find((s:any)=>s.name==='怨雷');
 assert.match(JSON.stringify(yuan.kit),/"thenRound":true/,'怨雷：存活後延續當回合');
 console.log('存活判定整理：神降／六刃／柯爾德／柯爾霍德／怨雷／蓋亞／卡修斯 通過');
}finally{await server.close();}
process.exit(0);
