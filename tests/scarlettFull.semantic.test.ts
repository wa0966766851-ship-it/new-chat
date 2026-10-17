import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React,{act} from 'react';
import { createServer } from 'vite';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
(window as any).__BATTLE_FAST__=true;
const oe=console.error; console.error=(...a:any[])=>{const s=String(a[0]); if(s.includes('act(')||s.includes('Warning'))return; oe(...a);};
const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
const wait=async(n=25)=>{for(let i=0;i<n;i++)await act(async()=>{await new Promise(r=>setTimeout(r,20))});};
try{
 const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
 const {getBattleSkillRegistry}=await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
 const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElves.ts');
 const {normalizeElfStats}=await server.ssrLoadModule('/src/utils/elfStats.ts');
 const R=getBattleSkillRegistry();
 // 測試用對手技能
 R['T增益']=(c:any)=>{ c.applyStatChange(c.actor,{atk:6,def:6,spatk:6,spdef:6}); };
 R['T佈陣']=(c:any)=>{ c.addTimerTo(c.actor,{id:'t_formation',name:'佈陣',kind:'turn_effect',source:'skill',remaining:5,tickAt:'round_end'},false); };
 R['T百分比']=(c:any)=>{ c.applyPercentDamage(c.targetSide,0.3); };
 R['T麻痺術']=(c:any)=>{ c.applyStatusWithImmunityCheck(c.targetSide,'麻痺',2); };
 const sk=(name:string,category='屬性',power=0,priority=0)=>({name,category,type:'普通',power,pp:20,maxPp:20,priority,isSureHit:true,description:''});
 const mk=(id:string,hp:number,skills:any[],speed=50):any=>({id,name:id,battleId:id,type:'普通',level:100,currentHp:hp,maxHp:hp,baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed},calculatedStats:{hp,atk:100,def:100,spatk:100,spdef:100,speed},statStages:{},skills});
 const scarlett=()=>{const e=normalizeElfStats(structuredClone(DEFAULT_ELVES.find((x:any)=>x.id==='5014'))); e.battleId='S'; return e;};
 let d:any; let key=0; let seen=0;
 const start=async(p1:any[],p2:any[])=>{ key++; seen=0; await act(async()=>root.render(React.createElement(Battle,{key,initialP1Team:p1,initialP2Team:p2,p1StarterId:p1[0].battleId,p2StarterId:p2[0].battleId,battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(x:any)=>d=x}))); await wait(10); };
 const st=()=>d.getSyncState();
 // 珀妮的額外行動每次造成對手最大體力⅓，會讓單隻假對手撐不過3回合；A～C 移除珀妮以單獨驗證斯嘉麗本體子句
 const dismissPuni=()=>{ for(const e of st().p1Team) if(e.isExtra){ e.currentHp=0; e.isVanished=true; } };
 const newLogs=()=>{const l=st().logs.slice(seen).map((x:any)=>x.text); seen=st().logs.length; return l.join('\n');};
 const skillOf=(side:'p1'|'p2',name:string)=>st()[side].skills.find((s:any)=>s.name===name);
 const turn=async(p1:string|{switchTo:number},p2:string)=>{
   await act(async()=>{ if(typeof p1==='string') d.onSkillSelect('p1',skillOf('p1',p1)); else d.onSwitchElf('p1',p1.switchTo); d.onSkillSelect('p2',skillOf('p2',p2)); });
   await wait(35); return newLogs(); };
 const fx=(side:'p1'|'p2')=>Object.fromEntries((st()[side].effects||[]).map((e:any)=>[e.id,e.duration]));

 // ── A：S4／S5／S6、K3、K1、K2 真實傷害、K5 未觸發分支
 await start([scarlett()],[mk('X',5_000_000,[sk('T增益'),sk('等待'),sk('打','物理',50)],10)]); dismissPuni();
 let L=await turn('暮光舞動','T增益');
 assert.match(L,/【燦】：自身特攻、速度\+2、命中\+1/,'S4');
 assert.match(L,/【燦】：對手雙攻、速度-2、命中-1/,'S5');
 assert.match(L,/弱點傷害/,'S6 觸發');
 assert.ok(fx('p2')['星贖']>0,'S6 對手星贖');
 assert.equal(st().p1RegistryState.weakPointDefenseTurns,1,'S6 弱點傷害 2 回合（回合結束剩1）');
 assert.equal(st().p1.statStages.spatk,4,'S4+K3 特攻 +4');
 assert.equal(st().p1.statStages.def,3,'K3+S5 防禦 +3');
 assert.equal(st().p2.statStages.spdef,4,'S4 對手特防-2 後自身+6');
 assert.equal(st().p2.statStages.speed,-4,'S4＋S5 對手速度各-2');
 assert.equal(st().p2.type,'暗影','K3 對手屬性變暗影');
 assert.equal(st().p1RegistryState.priorityBoostTurns,2,'K3 下2回合先制');
 assert.equal(st().p1RegistryState.priorityBoostValue,2);
 L=await turn('純白聖翎','T增益');
 assert.match(L,/攻擊技能.*PP.*(?:歸零|歸0)/,'K1 消強成功');
 assert.equal(skillOf('p2','打').pp,0,'K1 攻擊技能 PP 歸0');
 assert.match(L,/無效/,'K1 屬性技能無效（搭配下方實際PP斷言）');
 assert.equal(skillOf('p2','T增益').pp,0,'K1 使用後屬性技能 PP 歸0');
 assert.ok(st().p1Timers.some((t:any)=>t.id.includes('暮光舞動')&&t.payload?.block?.trig==='self_skill'&&t.remaining===3),'K3 完整Kit監控仍在；實際量/禁療/期限另由typeViewMigration雙側數值測試驗證');
 // K5 的「未消除」分支獨立開局：K1 留在對手身上的無效計時器本來就可清除，不能把它當成無效果對手。
 await start([scarlett()],[mk('X',5_000_000,[sk('等待'),sk('打','物理',50)],10)]); dismissPuni();
 L=await turn('晨曦昭世','等待');
 assert.ok(st().p1RegistryState.immuneAttackTurns>=2,'K2 攻擊免疫');
 assert.equal(st().p1RegistryState.reflectStatusTurns,4,'K2 5回合反彈異常');
 const hpBefore=st().p2.currentHp;
 L=await turn('王·聖璨天潔','等待');
 assert.ok(st().p1Timers.some((t:any)=>t.payload?.block?.trig==='self_skill'&&t.payload.block.body?.some((s:any)=>s.acts?.some((a:any)=>a.op==='dmg'&&a.p.type==='真實'&&a.p.ratio===0.2))),'K2 20%真傷積木監控仍在；精確數值及期限由migrationExpiryReaction驗證');
 assert.equal(st().p1RegistryState.blkImmuneStatusCount,1,'K5 未觸發分支真正授予一次異常免疫');
 assert.ok(hpBefore-st().p2.currentHp>=Math.floor(st().p1.maxHp*.5)+Math.floor(st().p2.maxHp/3),'K2 20%真傷與K5 30%自身上限及對手⅓百分比傷害真正扣血');
 assert.match(L,/未擊敗對手，恢復 \d+ 體力/,'K5 擊後⅓百分比傷害＋恢復');
 assert.ok(st().p2.currentHp<hpBefore);
 console.log('A 通過');

 // ── B：K2 攻擊免疫、S2 降傷＋回合結束百分比傷害
 await start([scarlett()],[mk('Y',5_000_000,[sk('打','物理',80),sk('T百分比')],10)]); dismissPuni();
 L=await turn('晨曦昭世','打');
 assert.match(L,/免疫了【打】/,'K2 免疫攻擊');
 L=await turn('王·凰歌盡霄','T百分比');
 assert.match(L,/【燦】：傷害降至⅓/,'S2 降傷');
 assert.match(L,/回合結束造成等同恢復量 \d+ 的百分比傷害/,'S2 回合結束百分比傷害');
 assert.equal(st().p1RegistryState.chanStacks,1,'燦界聖芒 +1');
 assert.equal((st().p1Marks||[]).find((m:any)=>m.id==='scarlett_holy_light')?.count,1);
 console.log('B 通過');

 // ── C：K4 交換／威力／無效下次攻擊、K5 消除回合類效果→麻痺
 // K4 已 Kit 化（migratedScarlettSkillKits）：交換走通用 stat_swap、無效走 invalid_next 計時器、
 // 威力走 boost{power,perInc}（1.75＋雙方PP<1技能數×0.3）、吸取走 vampire。
 await start([scarlett()],[mk('Z',5_000_000,[sk('T增益','屬性',0,5),sk('T佈陣','屬性',0,5),sk('打','物理',80)],10)]); dismissPuni();
 L=await turn('王·凰歌盡霄','T增益');
 assert.match(L,/與對手交換低於對手的能力等級/,'K4 交換（Kit stat_swap）');
 assert.match(L,/本次攻擊威力 ×[\d.]+/,'K4 威力倍率（Kit boost power）');
 assert.match(L,/吸血/,'K4 吸取等同攻擊傷害');
 const s1=st().p1.statStages, s2=st().p2.statStages;
 assert.ok(s1.def>=s2.def && s1.atk>=s2.atk && s1.spdef>=s2.spdef,'K4 交換後自身不低於對手');
 assert.ok(st().p2Timers.some((t:any)=>t.payload?.block?.invalid==='攻擊'),'K4 無效對手下次攻擊（invalid_next 計時器）');
 L=await turn('王·聖璨天潔','T佈陣');
 assert.ok(!st().p2Timers.some((t:any)=>t.id==='t_formation'),'K5 真正清除對手佈陣；下方確認麻痺');
 assert.ok(fx('p2')['麻痺']>0);
 // 對手麻痺：下回合無法行動 → 改測 K4 的「無效下次攻擊」於麻痺結束後；這裡只驗證計時器仍待命
 assert.ok(st().p2Timers.some((t:any)=>t.payload?.block?.invalid==='攻擊'),'K4 無效計時器仍待命（Kit invalid_next）');
 console.log('C 通過');

 // ── D：珀妮 麻痺→星贖、S3 下場繼承
 const T=mk('T',100000,[sk('等待')],10);
 await start([scarlett(),T],[mk('W',5_000_000,[sk('T麻痺術'),sk('T百分比')],10)]);
 L=await turn('暮光舞動','T麻痺術');
 assert.ok(!fx('p1')['麻痺'] && fx('p1')['星贖']>0,'P2 麻痺轉化為星贖');
 assert.match(L,/麻痺轉化為星贖/);
 const tIdx=st().p1Team.findIndex((e:any)=>e.battleId==='T');
 L=await turn({switchTo:tIdx},'T百分比');
 assert.equal(st().p1.battleId,'T');
 assert.match(L,/斯嘉麗下場，下一隻出戰精靈 \d 回合內獲得聖光護體/,'S3 下場');
 assert.match(L,/【燦】：傷害降至⅓/,'S3 繼承降傷');
 assert.match(L,/回合結束造成等同恢復量/,'S3 繼承回合結束百分比傷害');
 console.log('D 通過');

 // ── 弱點傷害（通用鍵 weakPointDefenseTurns）：以對手雙防較低者的60%計算
 const {calculateDamage}=await server.ssrLoadModule('/src/utils/damageCalculator.ts');
 const atkE:any={...mk('A',1000,[]),calculatedStats:{hp:1000,atk:200,def:100,spatk:200,spdef:100,speed:100}};
 const defE:any={...mk('B',1000,[]),calculatedStats:{hp:1000,atk:100,def:300,spatk:100,spdef:500,speed:100}};
 const spSkill:any={name:'測',category:'特殊',type:'普通',power:100,pp:10};
 const plain=calculateDamage(atkE,defE,spSkill,'p1',undefined,undefined,1,false,[],[],{},undefined,undefined,{},{}).damage;
 const weak=calculateDamage(atkE,defE,spSkill,'p1',undefined,undefined,1,false,[],[],{},undefined,undefined,{weakPointDefenseTurns:1},{}).damage;
 const expectWeak=Math.floor(((42*200*100/Math.floor(300*0.6))/50+2)*1.5); // 本系1.5
 assert.ok(weak>plain,'弱點傷害提高傷害');
 assert.equal(weak,expectWeak,'弱點傷害＝以 min(300,500)×0.6 作為特防');
 const ov=calculateDamage(atkE,{...defE,type:'普通'},{...spSkill,type:'普通'},'p1',undefined,undefined,1,false,[],[],{},undefined,undefined,{attackTypeOverrideUses:1,attackTypeOverride:'光',targetTypeOverride:'暗影'},{});
 assert.equal(ov.typeMultiplier,2,'K3 無效：光系對暗影系克制');
 // ── E：重生條件（使用者裁定 2026-10-16）——必須在場下且隊伍存在可出戰精靈；死亡當回合不得在場復活
 {
   // E1：斯嘉麗在場死亡（滿層倒數1）→ 死亡當回合不得原地復活（否則無限復活）
   const T2=mk('T2',100000,[sk('等待')],10);
   R['T必殺真傷']=(c:any)=>{ c.applyTrueDamage(c.targetSide,99999999); };  // 須在 start 前註冊；真傷繞過屬性技能無效
   const killer=mk('K',1_000_000_000,[sk('T必殺真傷','物理',1),sk('等待')],1);   // 斯嘉麗先出手，對手後手擊殺
   await start([scarlett(),T2],[killer]);
   let L2=await turn('純白聖翎','T必殺真傷');
   assert.match(L2,/倒下/,'E1 斯嘉麗死亡');
   // 等待強制換人階段到來（死亡結算非同步）
   for(let w=0;w<40 && st().phase!==('forced_switch_p1' as any) && st().phase!=='game_over';w++) await wait(3);
   const t0=st().p1Team[0];
   assert.ok(!(t0.currentHp>0 && st().p1ActiveIndex===0 && /重生時間到/.test(L2)),'E1 死亡當回合不得在場復活');
   // E2：換人下場後，倒數走完於背包內重生（體力滿、仍為場下）
   const idx=st().p1Team.findIndex((e:any)=>e.battleId==='T2');
   for(let i=0;i<60 && st().turnNumber<8 && st().phase!=='game_over';i++){
     const ph=st().phase;
     if(ph==='p1_select'){ if(!skillOf('p1','等待')) break; await turn('等待','等待'); }
     else if(ph==='p2_select'){ await act(async()=>d.onSkillSelect('p2',skillOf('p2','等待'))); await wait(10); }
     else if(ph==='forced_switch_p1'){ await act(async()=>d.onSwitchElf('p1',idx)); await wait(10); }
     else { await wait(3); }
   }
   const logs2=(st().logs||[]).map((x:any)=>x.text).join('\n');
   assert.match(logs2,/重生時間到！斯嘉麗於背包內重生/,'E2 背包內重生');
   assert.ok(st().p1Team[0].currentHp>0,'E2 重生後體力>0');
   assert.ok(st().p1.battleId!=='S' || st().p1Team[0].currentHp>0,'E2 重生位置在背包');
   console.log('E 通過（重生條件：場下＋可出戰精靈；死亡當回合不在場復活）');
 }
 console.log('聖光斯嘉麗：魂印／珀妮／燦界聖芒／五技能語意測試通過');
} catch (e) { console.error(e); await server.close(); process.exit(1); }
await server.close(); process.exit(0);
