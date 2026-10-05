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
 assert.match(L,/對手所有攻擊技能PP歸0/,'K1 消強成功');
 assert.equal(skillOf('p2','打').pp,0,'K1 攻擊技能 PP 歸0');
 assert.match(L,/受純白聖翎限制/,'K1 屬性技能無效');
 assert.equal(skillOf('p2','T增益').pp,0,'K1 使用後屬性技能 PP 歸0');
 assert.match(L,/暮光舞動】：恢復 \d+ 體力並造成等量百分比傷害/,'K3 使用技能恢復＋百分比傷害');
 L=await turn('晨曦昭世','等待');
 assert.ok(st().p1RegistryState.immuneAttackTurns>=2,'K2 攻擊免疫');
 assert.equal(st().p1RegistryState.reflectStatusTurns,4,'K2 5回合反彈異常');
 const hpBefore=st().p2.currentHp;
 L=await turn('王·聖璨天潔','等待');
 assert.match(L,/晨曦昭世】：附加自身最大體力20%的真實傷害/,'K2 使用技能附加真傷');
 assert.match(L,/未消除回合類效果，自身免疫下1次異常狀態/,'K5 未觸發分支');
 assert.match(L,/王·聖璨天潔】：附加 \d+ 百分比傷害並恢復等量體力/,'K5 30% 百分比傷害');
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
 await start([scarlett()],[mk('Z',5_000_000,[sk('T增益','屬性',0,5),sk('T佈陣','屬性',0,5),sk('打','物理',80)],10)]); dismissPuni();
 L=await turn('王·凰歌盡霄','T增益');
 assert.match(L,/交換 \d 項能力等級/,'K4 交換');
 assert.match(L,/威力 ×1\.75/,'K4 威力+75%');
 const s1=st().p1.statStages, s2=st().p2.statStages;
 assert.ok(s1.def>=s2.def && s1.atk>=s2.atk && s1.spdef>=s2.spdef,'K4 交換後自身不低於對手');
 assert.equal(st().p1RegistryState.nextAttackSkillInvalid,true,'K4 無效對手下次攻擊');
 L=await turn('王·聖璨天潔','T佈陣');
 assert.match(L,/消除對手回合類效果，對手麻痺/,'K5 消除成功→麻痺');
 assert.ok(fx('p2')['麻痺']>0);
 // 對手麻痺：下回合無法行動 → 改測 K4 的「無效下次攻擊」於麻痺結束後；這裡只驗證旗標仍待命
 assert.equal(st().p1RegistryState.nextAttackSkillInvalid,true);
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
 console.log('聖光斯嘉麗：魂印／珀妮／燦界聖芒／五技能語意測試通過');
} catch (e) { console.error(e); await server.close(); process.exit(1); }
await server.close(); process.exit(0);
