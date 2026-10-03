import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT:true,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
(window as any).__BATTLE_FAST__=true;
const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElves.ts');
  const {getBattleSkillRegistry,getSoulMarkRegistry}=await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const {STARLIGHT_RUS_SKILLS,handleStarlightRusSoulMark}=await server.ssrLoadModule('/src/effects/starlightRusRegistry.ts');
  let driver:any;
  const make=(id:string,speed:number):any=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:10000,maxHp:10000,
    baseStats:{hp:10000,atk:100,def:1000,spatk:100,spdef:1000,speed},calculatedStats:{hp:10000,atk:100,def:1000,spatk:100,spdef:1000,speed},statStages:{},
    skills:[{name:'等待',type:'普通',category:'屬性',power:0,pp:5,maxPp:5}]});
  for(const side of ['p1','p2'])for(const scenario of ['five','ten','fatal','rebirth','backlash','sealed']){
    const hits:any[]=[];let rolled=0,reborn=false;
    const skills=getBattleSkillRegistry(), souls=getSoulMarkRegistry();
    skills['星光·浪打千擊']=(ctx:any)=>STARLIGHT_RUS_SKILLS['星光·浪打千擊']({...ctx,rng:()=>scenario==='ten'?0.999:0});
    souls['逐擊觀測者']=(ctx:any,event:string,data:any)=>{
      if(event==='AFTER_ATTACK_HIT'){
        rolled++;
      }
    };
    souls['受擊觀測者']=(ctx:any,event:string,data:any)=>{
      if(event==='ON_DAMAGED'&&data.damageType==='skill_attack'){
        hits.push({damage:data.damage,hp:ctx.self.currentHp});
        if(scenario==='backlash')ctx.applyTrueDamage(ctx.targetSide,20000,'逐擊反擊');
      }
      if(event==='FATAL_RESIST'&&scenario==='rebirth'&&!reborn){reborn=true;ctx.self.currentHp=10000;return true;}
      return false;
    };
    const skill=structuredClone(DEFAULT_ELVES.find((e:any)=>e.id==='5010').skills.find((s:any)=>s.name==='星光·浪打千擊'));
    const a=make('逐擊觀測者',200);a.skills=[skill];a.isAdditionalInvalid=scenario==='sealed';
    const b=make('受擊觀測者',100);if(scenario==='fatal'||scenario==='rebirth')b.currentHp=1;
    await act(async()=>root.render(React.createElement(Battle,{key:side+scenario,
      initialP1Team:[side==='p1'?a:b],initialP2Team:[side==='p2'?a:b],p1StarterId:side==='p1'?a.id:b.id,p2StarterId:side==='p2'?a.id:b.id,
      battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d:any)=>driver=d})));
    (globalThis as any).__BATTLE_SEED__=19;
    await act(async()=>{driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]);driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]);});
    for(let i=0;i<250;i++){
      await act(async()=>{await new Promise(r=>setTimeout(r,10));});
      const st=driver.getSyncState();if(st.turnNumber>=2||st.p1.currentHp<=0||st.p2.currentHp<=0)break;
    }
    // 等待已開始的佇列結算完成；動畫不參與結算。
    await act(async()=>{await new Promise(r=>setTimeout(r,30));});
    // 連擊＝一次計算×連擊次數：受擊節點只有一次；每擊附帶判定仍逐擊（攻擊方被反擊致死則停止）。
    const n=scenario==='ten'?10:5;
    const wanted=scenario==='backlash'?0:n;
    assert.equal(hits.length,1,`${side}/${scenario}: 連擊只結算一次傷害`);
    assert.equal(rolled,scenario==='sealed'?1:wanted,`${side}/${scenario}: 每一擊只通知一次`);
    assert.ok(hits.every(x=>x.damage>0));
    if(scenario==='rebirth')assert.equal(reborn,true,'免死／重生');
    // 每擊強化於傷害前以 PRD 結算（10 擊必至少觸發一次）
    if(scenario==='ten')assert.ok((driver.getSyncState()[side].statStages.atk||0)>=1,'逐擊強化先結算');
    if(scenario==='sealed')assert.equal(driver.getSyncState()[side].statStages.atk||0,0,'附加失效不擲強化骰');
  }
  console.log('真實引擎連擊：P1/P2、5擊/10擊單次結算、逐擊判定、反擊致死停止、附加失效通過。');
} finally {await act(async()=>root.unmount());await server.close();dom.window.close();}
