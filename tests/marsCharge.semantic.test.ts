import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (fn: any) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
(window as any).__BATTLE_FAST__ = true;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let checks = 0;
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { BattleSkillRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const souls = getSoulMarkRegistry();
  const template = DEFAULT_ELVES.find((e: any) => e.id === '5016');
  const wait = { name: '充能驗收等待', type: '普通', category: '屬性', power: 0, pp: 20, maxPp: 20, description: '' };
  for (const side of ['p1', 'p2']) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const fixture = () => {
      const self = { ...structuredClone(template), battleId: `mars-${side}`, maxHp: 1000, currentHp: 100,
        statStages: {}, skills: [{ ...wait, name: '充能驗收攻擊', category: '特殊', power: 1, charge: 4, isSureHit: true }] };
      const target = { ...structuredClone(self), name: '充能驗收對手', id: `enemy-${side}`, battleId: `enemy-${side}`,
        maxHp: 2000, currentHp: 2000, shield: 0, barrier: 0, skills: [{ ...wait }] };
      const state: any = {}, oppState: any = {}, damage: any[] = [], heals: number[] = [];
      const ctx: any = { self, target, actor: side, targetSide: other, skill: self.skills[0], goesFirst: false,
        activeP1: side === 'p1' ? self : target, activeP2: side === 'p2' ? self : target,
        getPlayerState: (key: string) => state[key], setPlayerState: (key: string, v: any) => state[key] = v,
        getOpponentState: (key: string) => oppState[key], setOpponentState: (key: string, v: any) => oppState[key] = v,
        setNextTurns: () => {}, addLog: () => {}, trackCodeExec: () => {},
        applyHeal: (owner: string, amount: number) => { assert.equal(owner, side); heals.push(amount); },
        applyTrueDamage: (owner: string, amount: number) => { assert.equal(owner, other); damage.push(['true', amount]); return amount; },
        applyPinkDamage: (owner: string, amount: number, _label: string, _a: any, _b: any, type: string) => {
          assert.equal(owner, other); damage.push([type, amount]); return amount;
        },
        updateElf: (owner: string, patch: any) => Object.assign(owner === side ? self : target, patch),
        clearTurnEffectsOf: () => false,
      };
      return { self, target, ctx, state, damage, heals };
    };
    const soul = souls[template.name];
    assert.equal(typeof soul, 'function', '透過實際註冊入口，不直接測未掛接函式');
    {
      const f = fixture(); soul(f.ctx, 'ON_ENTRANCE');
      assert.equal(f.self.shield, 333); assert.equal(f.self.barrier, 333); checks++;
      soul(f.ctx, 'ROUND_START'); assert.equal(f.self.shield, 333); assert.equal(f.self.barrier, 333); checks++;
    }
    {
      const f = fixture(); f.self.skills[0].charge = 0;
      soul(f.ctx, 'ROUND_END'); assert.deepEqual(f.heals, [333]); assert.deepEqual(f.damage, [['percent', 333]]);
      assert.equal(f.self.skills[0].charge, 0, '回合末不可自動補5點充能'); assert.equal(f.self.skills[0].pp, 20); checks++;
    }
    {
      const f = fixture(); f.state.marsEndTurnChargeStrike = true;
      soul(f.ctx, 'BEFORE_ACTION'); assert.deepEqual(f.damage, [['true', 60]]); assert.deepEqual(f.heals, [60]);
      assert.equal(f.self.skills[0].charge, 0); assert.equal(f.self.skills[0].pp, 20); checks++;
    }
    {
      const f = fixture(); f.state.marsEndTurnChargeStrike = true;
      f.self.skills = [{ ...f.self.skills[0], charge: 9 }, { ...f.self.skills[0], charge: 4 }];
      f.ctx.skill = { ...f.self.skills[1], battleSlot: 1 }; f.ctx.moveIndex = 0;
      soul(f.ctx, 'BEFORE_ACTION');
      assert.deepEqual(f.self.skills.map((skill: any) => skill.charge), [9, 0], '同名技能依原槽扣充能，不依出手順序');
      assert.deepEqual(f.self.skills.map((skill: any) => skill.pp), [20, 20]); checks++;
    }
    {
      const f = fixture(); f.state.marsMechaMode = 'destroy';
      soul(f.ctx, 'AFTER_ACTION'); assert.deepEqual(f.damage, [['percent', 600]]); assert.deepEqual(f.heals, [600]);
      assert.equal(f.self.skills[0].charge, 3); assert.equal(f.self.skills[0].pp, 20); checks++;
    }
    for (const charge of [0, 44]) {
      const f = fixture(); f.ctx.skill = { ...f.ctx.skill, name: '革新已至', charge, pp: 0 };
      BattleSkillRegistry['革新已至'](f.ctx);
      assert.deepEqual(f.damage, [['percent', 1000]], 'PP永遠滿不取充能，吸取當前體力½');
      assert.deepEqual(f.heals, [1000]); checks++;
    }
    {
      const f = fixture(); f.self.skills = [{ ...f.self.skills[0], charge: 0 }, { ...wait, charge: 44 }];
      f.ctx.skill = { ...wait, name: '王·超限共頻', isFifthSkill: true };
      BattleSkillRegistry['王·超限共頻'](f.ctx);
      assert.deepEqual(f.self.skills.map((s: any) => s.charge), [5, 49]);
      assert.deepEqual(f.self.skills.map((s: any) => s.pp), [20, 20]); checks++;
    }
    // 真實對戰連跑兩回合：第一回合建立充能打擊，第二回合必須走真傷、穿盾罩且不扣PP。
    const f = fixture(); f.self.calculatedStats = { hp: 1000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 200 };
    f.target.calculatedStats = { ...f.self.calculatedStats, hp: 2000, speed: 100 };
    f.target.currentHp = 2000; f.target.shield = 9999; f.target.barrier = 9999;
    const receipts: any[] = []; let driver: any;
    souls[f.target.name] = (_ctx: any, event: string, data: any) => { if (event === 'ON_DAMAGED') receipts.push(data.receipt); };
    try {
      await act(async () => root.render(React.createElement(Battle, { key: side,
        initialP1Team: [side === 'p1' ? f.self : f.target], initialP2Team: [side === 'p2' ? f.self : f.target],
        p1StarterId: side === 'p1' ? f.self.id : f.target.id, p2StarterId: side === 'p2' ? f.self.id : f.target.id,
        battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
      for (let round = 0; round < 2; round++) {
        const before = driver.getSyncState().turnNumber;
        await act(async () => {
          driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]);
          driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]);
        });
        for (let i = 0; i < 250 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
        assert.equal(driver.getSyncState().turnNumber, before + 1);
      }
      const receipt = receipts.find(r => r?.damageType === 'true' && r.requestedAmount === 60);
      assert.ok(receipt); assert.equal(receipt.hpLost, 60); assert.equal(receipt.shieldAbsorbed, 0); assert.equal(receipt.barrierAbsorbed, 0);
      const live = driver.getSyncState()[side];
      assert.equal(live.skills[0].charge, 0); assert.equal(live.skills[0].pp, 20); checks++;
    } finally { delete souls[f.target.name]; }
  }
  console.log(`馬爾修斯精確⅓、等量基數、真傷汲取、PP/充能隔離及第五補充：${checks}情境通過（含P1/P2真實兩回合）。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
