import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  const { REVIEWED_SKILL_KITS, applyReviewedSkillKits } = await server.ssrLoadModule('/src/data/reviewedSkillKits.ts');
  const { runSkillBlocks } = await server.ssrLoadModule('/src/blocks/registry.ts');
  const { describeExecution } = await server.ssrLoadModule('/src/blocks/audit.ts');
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const txts = ['300_譜尼', '5000_聖靈譜尼'].map(name => readFileSync(`elf_source_files/elf_files/${name}.txt`, 'utf8'));
  const samples: any[] = [];
  for (const id of ['300', '5000']) {
    const elf = DEFAULT_ELVES.find((e: any) => e.id === id);
    for (const item of REVIEWED_SKILL_KITS.filter((item: any) => item.elfIds.includes(id))) {
      const skill = [...elf.skills, ...(elf.skillPool || [])].find(s => s.name === item.name);
      assert.ok(skill, `${id}/${item.name} 技能庫存在`);
      assert.equal(skill.description, item.description);
      assert.ok(txts[id === '300' ? 0 : 1].includes(item.description));
      assert.equal(describeExecution({ elf, skill }).route, 'kit');
      assert.ok(describeExecution({ elf, skill }).program.clauses.every((c: any) => c.parsed));
      samples.push(skill); checks++;
    }
    const changed = { ...elf, skills: [{ ...samples[0], effectMode: undefined, kit: undefined, description: '同名但原文不同' }] };
    assert.equal(applyReviewedSkillKits(changed).skills[0].effectMode, undefined, '原文變更不可套舊積木');
    const manual = { ...elf, skills: [{ ...samples[0], effectMode: 'registry', kit: undefined }] };
    assert.equal(applyReviewedSkillKits(manual).skills[0].effectMode, 'registry'); checks++;
  }
  const unique = samples.slice(0, 5);
  // 獨立數值期望，不以轉換器輸出的參數當測試答案。
  for (const side of ['p1', 'p2']) for (const sealed of [false, true]) for (const skill of unique) {
    const opp = side === 'p1' ? 'p2' : 'p1';
    const self: any = { id: 'self', name: '測試持有者', isAdditionalInvalid: sealed, statStages: { atk: -2, def: 3, spatk: 0 }, skills: [skill] };
    const target: any = { id: 'target', name: '測試目標', statStages: { atk: 2, def: -3, spatk: 0 } };
    const calls: any[] = [];
    const ctx: any = { actor: side, targetSide: opp, self, target, skill, activeP1: side === 'p1' ? self : target, activeP2: side === 'p2' ? self : target,
      getPlayerState: () => 0, addLog: () => {},
      applyTrueDamage: (s: string, n: number) => calls.push(['true', s, n]),
      applyPercentDamage: (s: string, n: number) => calls.push(['percent', s, n]),
      applyFixedDamage: () => assert.fail('不得降級為固定傷害'),
      updateElf: (s: string, update: any) => Object.assign(s === side ? self : target, update) };
    runSkillBlocks(ctx, 'use', true);
    runSkillBlocks(ctx, 'after_hit', true);
    runSkillBlocks(ctx, 'on_invalid', true);
    const expected = skill.name === '元素' ? [['true', opp, 200]] : skill.name === '斷空破' ? [['true', opp, 30]] :
      skill.name === '聖靈魔閃光' ? [['percent', opp, 0.125]] : [];
    assert.deepEqual(calls, sealed ? [] : expected, `${side}/${skill.name} 類型／數值／次數`);
    assert.deepEqual(self.statStages, { atk: !sealed && skill.name === '千烈虛光閃' ? 0 : -2, def: 3, spatk: 0 });
    assert.deepEqual(target.statStages, { atk: !sealed && skill.name === '聖堂之門' ? 0 : 2, def: -3, spatk: 0 }); checks++;
  }

  let driver: any;
  const make = (id: string, speed: number, skill: any): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
    currentHp: 4000, maxHp: 4000, baseStats: { hp: 4000, atk: 100, def: 1000, spatk: 100, spdef: 1000, speed },
    calculatedStats: { hp: 4000, atk: 100, def: 1000, spatk: 100, spdef: 1000, speed }, statStages: {},
    skills: [{ ...skill, maxPp: skill.maxPp ?? skill.pp, isSureHit: true }] });
  async function play(side: string, skill: any, sealed: boolean, control: boolean, shield = 0, barrier = 0) {
    const self = { ...make('kit-self', 200, { ...skill, ...(control ? { effectMode: 'kit', kit: [] } : {}) }),
      statStages: { atk: -2, def: 3 }, isAdditionalInvalid: sealed };
    const target = { ...make('kit-target', 100, { name: '等待', type: '普通', category: '屬性', power: 0, pp: 10 }),
      statStages: { atk: 2, def: -3 }, shield, barrier };
    (globalThis as any).__BATTLE_SEED__ = 19; // 引擎在掛載時讀取種子；必須在 render 前固定，否則第一場使用 Date.now() 造成偶發 201≠200
    await act(async () => root.render(React.createElement(Battle, { key: `${side}:${skill.name}:${sealed}:${control}:${shield}:${barrier}`,
      initialP1Team: [side === 'p1' ? self : target], initialP2Team: [side === 'p2' ? self : target],
      p1StarterId: side === 'p1' ? self.id : target.id, p2StarterId: side === 'p2' ? self.id : target.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
    (globalThis as any).__BATTLE_SEED__ = 19;
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 150 && !(driver.getSyncState().turnNumber === 2 && driver.getSyncState().phase === 'p1_select'); i++)
      await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    const state = structuredClone(driver.getSyncState());
    assert.equal(state.turnNumber, 2); assert.equal(state.phase, 'p1_select');
    return { self: state[side], target: state[side === 'p1' ? 'p2' : 'p1'] };
  }
  for (const side of ['p1', 'p2']) for (const skill of unique) {
    const normal = await play(side, skill, false, false);
    const sealed = await play(side, skill, true, false);
    if (skill.name === '千烈虛光閃') {
      assert.equal(normal.self.statStages.atk, 0); assert.equal(normal.self.statStages.def, 3);
      assert.equal(sealed.self.statStages.atk, -2);
    } else if (skill.name === '聖堂之門') {
      assert.equal(normal.target.statStages.atk, 0); assert.equal(normal.target.statStages.def, -3);
      assert.equal(sealed.target.statStages.atk, 2);
    } else {
      const control = await play(side, skill, false, true);
      const amount = skill.name === '元素' ? 200 : skill.name === '斷空破' ? 30 : 500;
      assert.equal(control.target.currentHp - normal.target.currentHp, amount, `${side}/${skill.name} 精確追加且只有一次`);
      assert.equal(control.target.currentHp, sealed.target.currentHp, '附加失效不影響主攻擊');
      const guarded = await play(side, skill, false, false, 1500);
      assert.equal(guarded.target.currentHp, 4000 - amount, '真傷／百分比不由護盾吸收');
      if (skill.name === '聖靈魔閃光') {
        const covered = await play(side, skill, false, false, 1500, 1500);
        assert.equal(covered.target.currentHp, 4000, '主攻擊由護盾、百分比由護罩吸收');
        assert.equal(covered.target.barrier, 1000, '護罩只承受500百分比傷害');
      }
    }
    assert.equal(normal.self.skills[0].pp, skill.pp - 1); checks++;
  }
  console.log(`第一批實際積木遷移：10份定義；TXT、原文失配保護、雙側、附加失效、分類、護盾及真實戰鬥 ${checks}情境通過。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
