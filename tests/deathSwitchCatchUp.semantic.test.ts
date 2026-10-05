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
 R['必殺']=(c:any)=>{ c.applyTrueDamage('p2',99999999,'必殺'); };
 const mk=(id:string,hp:number,skills:string[],speed=100):any=>({id,name:id,battleId:id,type:'普通',level:100,currentHp:hp,maxHp:hp,baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed},calculatedStats:{hp,atk:100,def:100,spatk:100,spdef:100,speed},statStages:{},skills:skills.map(n=>({name:n,category:'屬性',type:'普通',power:0,pp:99,maxPp:99,isSureHit:true}))});
 const bk=normalizeElfStats(structuredClone(DEFAULT_ELVES.find((e:any)=>e.name==='混濁海妖.布林克克'))); bk.battleId='BK';

 let d:any;
 await act(async()=>root.render(React.createElement(Battle,{initialP1Team:[mk('A',9e9,['等待','必殺'],200),bk],initialP2Team:[mk('X',1e6,['等待'],100),mk('Y',9e9,['等待'],50),mk('Z',9e9,['等待'],40)],p1StarterId:'A',p2StarterId:'X',battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(x:any)=>d=x})));
 await wait(8);
 const show=(t:string)=>{const s=d.getSyncState(); console.log(t.padEnd(14),'turn',s.turnNumber,'phase',s.phase,'P2在場',s.p2.name,'|',s.p2Team.map((e:any)=>e.name+(e.isExtra?'(額外)':'')+':'+((e.effects||[]).map((x:any)=>x.id+x.duration).join(',')||'-')).join('  '));};
 const turn=async(p1:number, p2:'skill'|number)=>{ let s=d.getSyncState(); await act(async()=>{ d.onSkillSelect('p1',s.p1.skills[p1]); if(p2==='skill') d.onSkillSelect('p2',s.p2.skills[0]); else d.onSwitchElf('p2',p2); }); await wait();
   s=d.getSyncState(); if(s.phase.startsWith('forced')){ show('  [換人前]'); const idx=s.p2Team.findIndex((e:any,i:number)=>i!==s.p2ActiveIndex&&!e.isExtra&&e.currentHp>0); await act(async()=>d.onSwitchElf('p2',idx)); await wait(); show('  [死切後]'); } };
 const fx=(n:string)=>{const e=d.getSyncState().p2Team.find((x:any)=>x.name===n); return (e.effects||[]).map((x:any)=>x.id+x.duration).join(',');};
 assert.equal(fx('X'),'漸凍1');
 await turn(1,'skill');
 assert.equal(d.getSyncState().p2.name,'Y'); assert.equal(fx('Y'),'漸凍1','死切上場附加 1 回合漸凍');
 await turn(0,'skill');
 assert.equal(fx('Y'),'冰封2','下回合開始轉化為冰封 3，回合結束扣為 2（與主動換人一致）');
 assert.ok(d.getSyncState().logs.some((l:any)=>l.turn===2&&/漸凍】衍生轉化為【冰封/.test(l.text)),'第 2 回合開始轉化');
 console.log('死亡換人：換人時附加的漸凍於下回合開始補扣並轉化通過');
} finally { await server.close(); process.exit(0); }
