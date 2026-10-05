// 引擎基礎掛鉤語意測試：出手結果事件、ON_SKILL_HIT／AFTER_DAMAGE、技能 after-hit／on-invalid 註冊表、
// 條件式先制（handler 技能）、下N回合（setNextTurns）、ctx 即時讀取、異常免疫事件、傷害分類正規化、BEFORE_SWITCH_OUT。
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
 const reg=await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
 const {normalizeDamageType}=await server.ssrLoadModule('/src/battle/damageSemantics.ts');
 const {handlerSkillCondPriority,parsedCondPriority,COND_PRIORITY_OWNED_BY_HANDLER}=await server.ssrLoadModule('/src/battle/conditionalPriority.ts');
 const R=reg.getBattleSkillRegistry();
 const SOUL=reg.getSoulMarkRegistry();
 const AFTER_HIT=reg.getBattleSkillAfterHitRegistry();
 const ON_INVALID=reg.getBattleSkillOnInvalidRegistry();

 // ── 事件記錄用魂印（HookA／HookB）
 let events:{elf:string;ev:string;data:any;actor:string}[]=[];
 const rec=(elf:string)=>(ctx:any,ev:string,data:any)=>{ events.push({elf,ev,data:data&&typeof data==='object'?{...data}:data,actor:ctx.actor}); return false; };
 SOUL['HookA']=rec('HookA'); SOUL['HookB']=rec('HookB');
 const evs=(elf:string,ev:string)=>events.filter(e=>e.elf===elf&&e.ev===ev);

 // ── 測試技能
 const probe:any={};
 R['T封印']=(c:any)=>{ c.setOpponentState('allSkillInvalidTurns',1); c.setOpponentState('powerMultiplierThisAction',3); };
 R['T條件先制']=()=>{};
 R['T下回合']=(c:any)=>{ c.setNextTurns('self','hookNextTurns',2); c.setPlayerState('hookNowTurns',2); };
 R['T即時']=(c:any)=>{
   probe.atkBefore=c.self.statStages?.atk||0;
   probe.result=c.applyStatChange(c.actor,{atk:2});
   probe.atkAfter=c.self.statStages?.atk||0;
   c.updateElf(c.actor,{shield:123});
   probe.shield=c.self.shield;
   probe.activeShield=(c.actor==='p1'?c.activeP1:c.activeP2).shield;
   c.applyStatChange(c.targetSide,{def:-1});
   probe.targetDef=c.target.statStages?.def||0;
   probe.capped=c.applyStatChange(c.actor,{spatk:9});
 };
 R['T免疫']=(c:any)=>{ c.setPlayerState('immuneStatusTurns',3); };
 R['T麻痺']=(c:any)=>{ c.applyStatusWithImmunityCheck(c.targetSide,'麻痺',2); };
 R['T粉']=(c:any)=>{ c.applyPinkDamage(c.targetSide,100,'粉測',undefined,undefined,'百分比傷害'); };
 R['T重擊']=()=>{};
 AFTER_HIT['T重擊']=(c:any,info:any)=>{ probe.afterHit={...info,targetHp:c.target.currentHp}; };
 ON_INVALID['T重擊']=(c:any,info:any)=>{ probe.onInvalid={...info,skill:c.skill?.name}; };

 const sk=(name:string,category='屬性',power=0,priority=0,description='')=>({name,category,type:'普通',power,pp:20,maxPp:20,priority,isSureHit:true,description});
 const mk=(id:string,hp:number,skills:any[],speed=50,stages:any={}):any=>({id,name:id,battleId:id,type:'普通',level:100,currentHp:hp,maxHp:hp,baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed},calculatedStats:{hp,atk:100,def:100,spatk:100,spdef:100,speed},statStages:{...stages},skills});
 let d:any; let key=0; let seen=0;
 const start=async(p1:any[],p2:any[])=>{ key++; seen=0; events=[]; for(const k of Object.keys(probe)) delete probe[k];
   await act(async()=>root.render(React.createElement(Battle,{key,initialP1Team:p1,initialP2Team:p2,p1StarterId:p1[0].battleId,p2StarterId:p2[0].battleId,battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(x:any)=>d=x}))); await wait(10); };
 const st=()=>d.getSyncState();
 const newLogs=()=>{const l=st().logs.slice(seen).map((x:any)=>x.text); seen=st().logs.length; return l.join('\n');};
 const skillOf=(side:'p1'|'p2',name:string)=>st()[side].skills.find((s:any)=>s.name===name);
 const turn=async(p1:string|{switchTo:number},p2:string)=>{
   await act(async()=>{ if(typeof p1==='string') d.onSkillSelect('p1',skillOf('p1',p1)); else d.onSwitchElf('p1',p1.switchTo); d.onSkillSelect('p2',skillOf('p2',p2)); });
   await wait(35); return newLogs(); };

 // ── 1. AFTER_ACTION／OPPONENT_AFTER_ACTION／ON_SKILL_HIT／AFTER_DAMAGE payload
 await start([mk('HookA',100000,[sk('打','物理',80),sk('等待')],100)],[mk('HookB',5_000_000,[sk('等待')],10)]);
 let hpB=st().p2.currentHp;
 await turn('打','等待');
 const dealt=hpB-st().p2.currentHp;
 const aa=evs('HookA','AFTER_ACTION').find(e=>e.data?.skill?.name==='打');
 assert.ok(aa,'AFTER_ACTION 有 extraData');
 assert.equal(aa!.data.actor,'p1'); assert.equal(aa!.data.category,'物理');
 assert.equal(aa!.data.hit,true); assert.equal(aa!.data.invalid,false); assert.equal(aa!.data.killed,false);
 assert.ok(dealt>0); assert.equal(aa!.data.damageDealt,dealt,'damageDealt＝主傷害實際 HP 減少');
 const oaa=evs('HookB','OPPONENT_AFTER_ACTION').find(e=>e.data?.skill?.name==='打');
 assert.ok(oaa,'對手收到 OPPONENT_AFTER_ACTION'); assert.equal(oaa!.actor,'p2'); assert.equal(oaa!.data.actor,'p1'); assert.equal(oaa!.data.damageDealt,dealt);
 const hit=evs('HookA','ON_SKILL_HIT');
 assert.equal(hit.length,1,'ON_SKILL_HIT 每次出手一次'); assert.equal(hit[0].data.damage,dealt); assert.equal(hit[0].data.targetSide,'p2');
 const adIn=evs('HookB','AFTER_DAMAGE').find(e=>e.data.isIncoming);
 const adOut=evs('HookA','AFTER_DAMAGE').find(e=>!e.data.isIncoming);
 assert.ok(adIn&&adOut,'AFTER_DAMAGE 受擊方與造成方各一次');
 assert.equal(adIn!.data.side,'p2'); assert.equal(adIn!.data.damageType,'skill_attack'); assert.equal(adOut!.data.side,'p2'); assert.equal(adOut!.data.attackerSide,'p1');
 assert.ok(evs('HookB','ON_DAMAGED').every(e=>['skill_attack','skill_attribute','skill_extra_action','fixed','percent','true'].includes(e.data.damageType)),'ON_DAMAGED damageType 正規化');
 assert.equal(evs('HookA','ACTION_FAILED').length,0);
 console.log('1 出手結果事件 通過');

 // ── 2. after-hit 註冊表：主傷害與陣亡標記之後
 await start([mk('HookA',100000,[sk('T重擊','物理',200)],100)],[mk('HookB',50,[sk('等待')],10)]);
 await turn('T重擊','等待');
 assert.ok(probe.afterHit,'*_AFTER_HIT 被呼叫');
 assert.equal(probe.afterHit.killed,true,'擊敗判定為結算後');
 assert.ok(probe.afterHit.targetHp<=0,'after-hit 讀到結算後體力');
 assert.ok(probe.afterHit.damageDealt>0); assert.equal(probe.afterHit.hit,true);
 const aa2=evs('HookA','AFTER_ACTION').find(e=>e.data?.skill?.name==='T重擊');
 assert.equal(aa2!.data.killed,true,'AFTER_ACTION.killed');
 console.log('2 after-hit 通過');

 // ── 3. 技能無效：SKILL_INVALID＋*_ON_INVALID＋ACTION_FAILED，且本次行動旗標被清除
 await start([mk('HookA',100000,[sk('T重擊','物理',80)],10)],[mk('HookB',5_000_000,[sk('T封印','屬性',0,5)],100)]);
 await turn('T重擊','T封印');
 assert.equal(probe.onInvalid?.kind,'invalid','*_ON_INVALID kind'); assert.equal(probe.onInvalid?.skill,'T重擊');
 assert.equal(probe.afterHit,undefined,'無效時不呼叫 after-hit');
 const si=evs('HookA','SKILL_INVALID')[0];
 assert.ok(si&&si.data.kind==='invalid'&&si.data.isIncoming===false,'SKILL_INVALID 到行動方魂印');
 const af=evs('HookA','ACTION_FAILED')[0];
 assert.ok(af,'ACTION_FAILED'); assert.equal(af.data.hit,false); assert.equal(af.data.invalid,true); assert.equal(af.data.failKind,'invalid');
 assert.ok(!evs('HookA','AFTER_ACTION').some(e=>e.data?.skill?.name==='T重擊'),'失敗時不派發 AFTER_ACTION');
 const ob=evs('HookB','OPPONENT_AFTER_ACTION').find(e=>e.data?.skill?.name==='T重擊');
 assert.ok(ob&&ob.data.invalid===true&&ob.data.hit===false,'對手收到失敗結果');
 assert.equal(st().p1RegistryState.powerMultiplierThisAction,1,'本次行動旗標不殘留');
 console.log('3 技能無效 通過');

 // ── 4. 條件式先制（handler 技能）
 const condSkill=sk('T條件先制','物理',40,0,'■ 自身處於能力下降狀態時先制+3');
 await start([mk('HookA',100000,[condSkill],10,{atk:-1})],[mk('HookB',5_000_000,[sk('等待')],100)]);
 let L=await turn('T條件先制','等待');
 assert.ok(L.indexOf('使用了【T條件先制】')>=0 && L.indexOf('使用了【T條件先制】')<L.indexOf('使用了【等待】'),'能力下降時先制+3 → 先出手');
 await start([mk('HookA',100000,[condSkill],10)],[mk('HookB',5_000_000,[sk('等待')],100)]);
 L=await turn('T條件先制','等待');
 assert.ok(L.indexOf('使用了【等待】')>=0 && L.indexOf('使用了【等待】')<L.indexOf('使用了【T條件先制】'),'條件不成立 → 依速度後出手');
 const gs=(e:any)=>e.battleStatuses||{};
 const dropped={statStages:{atk:-1}}; const none={statStages:{}};
 assert.equal(parsedCondPriority({name:'x',description:'■ 若自身處於能力下降狀態則先制+3'},dropped,none,gs),3,'若…則先制');
 assert.equal(parsedCondPriority({name:'y',description:'■ 對手處於能力提升狀態則先制+1且必定命中'},none,{statStages:{atk:1}},gs),1,'對手能力提升');
 for(const n of COND_PRIORITY_OWNED_BY_HANDLER) assert.equal(handlerSkillCondPriority({name:n,description:'■ 自身處於能力下降狀態時先制+3'},dropped,none,gs),0,`去重：${n}`);
 console.log('4 條件式先制 通過');

 // ── 5. setNextTurns：下N回合（本回合不生效、不扣減）
 await start([mk('HookA',100000,[sk('T下回合'),sk('等待')],100)],[mk('HookB',5_000_000,[sk('等待')],10)]);
 await turn('T下回合','等待');
 assert.equal(st().p1RegistryState.hookNowTurns,1,'setPlayerState：本回合結束即扣 1（舊行為）');
 assert.equal(st().p1RegistryState.hookNextTurns,2,'setNextTurns：回合結束後才寫入 2');
 await turn('等待','等待');
 assert.equal(st().p1RegistryState.hookNextTurns,1);
 await turn('等待','等待');
 assert.equal(st().p1RegistryState.hookNextTurns,0,'恰好持續下 2 回合');
 console.log('5 setNextTurns 通過');

 // ── 6. ctx 即時讀取＋applyStatChange 回傳實際變化量
 await start([mk('HookA',100000,[sk('T即時')],100,{spatk:5})],[mk('HookB',5_000_000,[sk('等待')],10)]);
 await turn('T即時','等待');
 assert.equal(probe.atkBefore,0); assert.equal(probe.atkAfter,2,'applyStatChange 後 ctx.self 即時');
 assert.deepEqual(probe.result,{success:true,applied:{atk:2}});
 assert.equal(probe.shield,123,'updateElf 後 ctx.self 即時'); assert.equal(probe.activeShield,123,'activeP1/P2 即時');
 assert.equal(probe.targetDef,-1,'ctx.target 即時');
 assert.deepEqual(probe.capped.applied,{spatk:1},'受 +6 上限的實際變化量');
 console.log('6 即時 ctx 通過');

 // ── 7. 異常：BEFORE_STATUS_APPLY targetSide／sourceSide；ON_STATUS_IMMUNIZED 到魂印
 await start([mk('HookA',100000,[sk('T麻痺')],10)],[mk('HookB',5_000_000,[sk('等待'),sk('T免疫','屬性',0,5)],100)]);
 await turn('T麻痺','等待');
 const bsa=evs('HookB','BEFORE_STATUS_APPLY')[0];
 assert.ok(bsa,'BEFORE_STATUS_APPLY'); assert.equal(bsa.data.targetSide,'p2'); assert.equal(bsa.data.sourceSide,'p1');
 await start([mk('HookA',100000,[sk('T麻痺')],10)],[mk('HookB',5_000_000,[sk('T免疫','屬性',0,5)],100)]);
 await turn('T麻痺','T免疫');
 const imm=evs('HookB','ON_STATUS_IMMUNIZED')[0];
 assert.ok(imm,'ON_STATUS_IMMUNIZED 到魂印'); assert.equal(imm.data.status,'麻痺'); assert.equal(imm.data.targetSide,'p2'); assert.equal(imm.data.reason,'immuneStatus');
 console.log('7 異常事件 通過');

 // ── 8. 傷害分類正規化（applyPinkDamage 中文標籤）
 assert.equal(normalizeDamageType({damageType:'百分比傷害'}),'percent');
 assert.equal(normalizeDamageType({damageType:'固定傷害'}),'fixed');
 assert.equal(normalizeDamageType({damageType:'true_damage'}),'true');
 await start([mk('HookA',100000,[sk('T粉')],100)],[mk('HookB',5_000_000,[sk('等待')],10)]);
 await turn('T粉','等待');
 const pd=evs('HookB','ON_DAMAGED').find(e=>e.data.label==='粉測');
 assert.ok(pd,'百分比傷害 ON_DAMAGED'); assert.equal(pd!.data.damageType,'percent');
 console.log('8 傷害分類 通過');

 // ── 9. BEFORE_SWITCH_OUT 在 ON_SWITCH_OUT 之前
 await start([mk('HookA',100000,[sk('等待')],100),mk('Mate',100000,[sk('等待')],100)],[mk('HookB',5_000_000,[sk('等待')],10)]);
 const mateIdx=st().p1Team.findIndex((e:any)=>e.battleId==='Mate');
 await turn({switchTo:mateIdx},'等待');
 const order=events.filter(e=>e.elf==='HookA'&&(e.ev==='BEFORE_SWITCH_OUT'||e.ev==='ON_SWITCH_OUT')).map(e=>e.ev);
 assert.deepEqual(order,['BEFORE_SWITCH_OUT','ON_SWITCH_OUT']);
 console.log('9 BEFORE_SWITCH_OUT 通過');

 console.log('引擎掛鉤（事件／after-hit／on-invalid／條件先制／下N回合／即時 ctx）語意測試通過');
} catch (e) { console.error(e); await server.close(); process.exit(1); }
await server.close(); process.exit(0);
