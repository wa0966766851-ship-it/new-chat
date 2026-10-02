import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
(window as any).__BATTLE_FAST__ = true;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { calculateDamage } = await server.ssrLoadModule('/src/utils/damageCalculator.ts');
  const { SoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  let driver: any;
  for (const side of ['p1','p2']) for (const sealed of [false,true]) {
    const skill = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === '5007').skills.find((s: any) => s.name === '溺咒之握'));
    skill.isSureHit = true;
    const make = (id: string, speed: number): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
      currentHp: 1200, maxHp: 1200, baseStats: { hp:1200,atk:100,def:1000,spatk:100,spdef:1000,speed },
      calculatedStats: { hp:1200,atk:100,def:1000,spatk:100,spdef:1000,speed }, statStages: {},
      skills: [{ name:'等待', type:'普通',category:'屬性',power:0,pp:5,maxPp:5 }] });
    const attacker = make('文義測試',200); attacker.skills=[skill]; attacker.ivs={hp:0}; attacker.isAdditionalInvalid=sealed;
    const defender = make('文義對手',100); defender.statStages={atk:2,def:2};
    await act(async () => root.render(React.createElement(Battle, {
      key: `${side}:${sealed}`, initialP1Team:[side==='p1'?attacker:defender], initialP2Team:[side==='p2'?attacker:defender],
      p1StarterId:side==='p1'?attacker.id:defender.id,p2StarterId:side==='p2'?attacker.id:defender.id,
      battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d: any)=>driver=d,
    })));
    (globalThis as any).__BATTLE_SEED__=19;
    await act(async () => { driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]); });
    for (let i=0;i<150 && !(driver.getSyncState().turnNumber===2 && driver.getSyncState().phase==='p1_select');i++) await act(async()=>{await new Promise(r=>setTimeout(r,20));});
    const st=driver.getSyncState(); const other=side==='p1'?'p2':'p1';
    assert.equal(st.turnNumber,2); assert.equal(st.phase,'p1_select');
    assert.equal(st[side].statStages.atk || 0,sealed?0:2); assert.equal(st[other].statStages.def,sealed?2:-2);
    const expected=calculateDamage(st[side],st[other],{...skill,power:500},side,undefined,undefined,1,false).damage;
    const loss=1200-st[other].currentHp;
    assert.ok(loss>=Math.floor(expected*217/255) && loss<=expected*2,`真實引擎使用威力500且吸取反轉在公式前；${side}/${sealed} ${loss}/${expected}`);
    assert.equal(st[`${side}TurnStats`].trueDmg,0,'沒有替代真傷');
    assert.equal(st[side].skills[0].pp,14);
  }
  console.log('真實引擎驗收：P1/P2、附加效果失效/正常，固有威力保留、強化前置、沒有替代真傷、PP正確。');
} finally { await act(async()=>root.unmount()); await server.close(); dom.window.close(); }
