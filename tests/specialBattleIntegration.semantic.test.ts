import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React,{act} from 'react';
import { createServer } from 'vite';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/?fast=1'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,
  getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
(window as any).__BATTLE_FAST__=true;
const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
 const {INTERCEPTOR_EFFECTS}=await server.ssrLoadModule('/src/utils/destinyGacha.ts');
 const {getSoulMarkRegistry}=await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
 assert.ok(getSoulMarkRegistry()['帝皇之盾'].toString().includes('empShieldInited'));
 assert.ok(!getSoulMarkRegistry()['帝皇之盾'].toString().includes('attackSkillInvalidTurns'));
 const make=(id:string,hp:number,power:number,effect?:string):any=>({id,name:'整合測試'+id,battleId:id,type:'普通',level:100,currentHp:hp,maxHp:hp,
  baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},calculatedStats:{hp,atk:100,def:100,spatk:100,spdef:100,speed:id==='a'?200:100},
  skills:[{name:'strike',type:'普通',category:'物理',power,pp:5,maxPp:5}],statStages:{},destinyRank:'C',interceptorEffect:effect?INTERCEPTOR_EFFECTS[effect]:undefined});
 let driver:any,result:any;const a=make('a',2000,5000,'pp_chain'), b=make('b',500,1,'soul_reaper'), fallen=make('fallen',500,1);a.battleId='instance_a';b.battleId='instance_b';fallen.currentHp=0;
 await act(async()=>root.render(React.createElement(Battle,{initialP1Team:[a],initialP2Team:[fallen,b],p1StarterId:a.battleId,p2StarterId:b.battleId,battleMode:'PVP',specialMode:'destiny',preparedTeams:true,
  onBackToMenu:()=>{},onRestartBattle:()=>{},onDriverInit:(x:any)=>driver=x,onBattleEnd:(w:any,t:any)=>result={w,t}})));
 assert.ok(driver);assert.equal(driver.getSyncState().p2ActiveIndex,1);assert.equal(driver.getSyncState().p2.skills[0].pp,3);assert.equal(driver.getSyncState().p2.skills[0].ppMaxOffset,-2);
 await act(async()=>{driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]);driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]);});
 for(let i=0;i<50&&!result;i++)await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 assert.ok(result,'實際戰鬥完成並發送結果');assert.equal(result.w,'p1');assert.equal(result.t[0].currentHp,1300);
 assert.ok(driver.getSyncState().p1Timers.some((t:any)=>t.payload?.priorityDelta===-2));
 assert.ok(driver.getSyncState().logs.some((l:any)=>l.text.includes('索魂')));
 const hero=make('h',500,1,'hero_blessing'), living=make('living',1000,1), dead=make('dead',1000,1), enemy=make('enemy',2000,5000); living.currentHp=400;dead.currentHp=0;
 await act(async()=>root.render(React.createElement(Battle,{key:'hero',initialP1Team:[hero,living,dead],initialP2Team:[enemy],p1StarterId:'h',p2StarterId:'enemy',battleMode:'PVP',specialMode:'destiny',preparedTeams:true,onBackToMenu:()=>{},onRestartBattle:()=>{},onDriverInit:(x:any)=>driver=x})));
 await act(async()=>{driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]);driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]);});
 for(let i=0;i<50&&driver.getSyncState().p1Team[1].currentHp!==700;i++)await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 assert.equal(driver.getSyncState().p1Team[1].currentHp,700,'實際恢復隊伍內場下精靈');assert.equal(driver.getSyncState().p1Team[1].statStages.speed,1);assert.equal(driver.getSyncState().p1Team[2].currentHp,0,'不復活死者');

 const dirge=make('dirge',500,1,'dirge_shield'), next=make('next',1000,1);
 await act(async()=>root.render(React.createElement(Battle,{key:'dirge',initialP1Team:[dirge,next],initialP2Team:[enemy],p1StarterId:'dirge',p2StarterId:'enemy',battleMode:'PVP',specialMode:'destiny',preparedTeams:true,onBackToMenu:()=>{},onRestartBattle:()=>{},onDriverInit:(x:any)=>driver=x})));
 await act(async()=>{driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]);driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]);});
 for(let i=0;i<50&&!driver.getSyncState().phase.startsWith('forced_switch');i++)await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 assert.ok(driver.getSyncState().phase.startsWith('forced_switch'));
 await act(async()=>{driver.onSwitchElf('p1',1);});
 for(let i=0;i<50&&driver.getSyncState().phase!=='p1_select';i++)await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 assert.equal(driver.getSyncState().p1.barrier,400);assert.equal(driver.getSyncState().p1Timers.find((t:any)=>t.payload?.immuneStatus)?.remaining,2,'強制換人不浪費免疫期限');
 const block=make('block',2000,1,'block_attack'), blocked=make('blocked',2000,1);blocked.skills.push({name:'utility',type:'普通',category:'屬性',power:0,pp:5,maxPp:5});
 await act(async()=>root.render(React.createElement(Battle,{key:'block',initialP1Team:[block],initialP2Team:[blocked],p1StarterId:'block',p2StarterId:'blocked',battleMode:'PVP',specialMode:'destiny',preparedTeams:true,onBackToMenu:()=>{},onRestartBattle:()=>{},onDriverInit:(x:any)=>driver=x})));
 await act(async()=>{driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]);driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]);});
 for(let i=0;i<50&&driver.getSyncState().turnNumber<2;i++)await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 await act(async()=>driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]));
 await act(async()=>driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]));assert.equal(driver.getSyncState().phase,'p2_select');assert.equal(driver.getSyncState().p2SelectedSkill,null,'封技期間不能選攻擊技');
 await act(async()=>driver.onSkillSelect('p2',driver.getSyncState().p2.skills[1]));assert.notEqual(driver.getSyncState().phase,'p2_select','屬性技仍可選用');
 console.log('真實戰鬥：唯一命運入口、原生隔離、PP上限、擊殺來源索魂700真傷、場下祝福、悲歌期限、封技選擇與結果快照通過');
} finally {await act(async()=>root.unmount());await server.close();dom.window.close()}
