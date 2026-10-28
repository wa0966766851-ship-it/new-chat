import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// 整個戰鬥畫面（HUD、技能列、隊伍、訊息、傷害圖表）的 DOM 掃描：
// PVE 對方隱匿 → 遮蔽；PVP → 只有選招側技能列例外可見，其餘區域與戰後仍遮蔽。
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.fetch = (async () => { throw new Error('offline'); }) as any;
(dom.window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Object.assign(globalThis, { requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) });
const { createRoot } = await import('react-dom/client');
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const root = createRoot(document.getElementById('root')!);
let passed = 0;
const check = async (name: string, run: () => void | Promise<void>) => { await run(); passed++; console.log(`✓ ${name}`); };
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { prepareSavedBattleRoster } = await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
  const { BattleContext } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { BattleScreenUI } = await server.ssrLoadModule('/src/components/BattleScreen.ui.tsx');

  const rich = DEFAULT_ELVES.filter((e: any) => e.name?.length >= 3 && e.soulMark?.name?.length >= 2 && e.skills?.length >= 4 && new Set(e.skills.map((s: any) => s.name)).size === e.skills.length);
  const A = rich[0], B = rich.find((e: any) => e.name !== A.name && e.soulMark.name !== A.soulMark.name && !e.name.includes(A.name) && !A.name.includes(e.name));
  const secretsOf = (e: any) => [e.name, e.soulMark.name, ...e.skills.slice(0, 5).map((s: any) => s.name)].filter((t: string) => t.length >= 3);
  const [secA, secB] = [secretsOf(A), secretsOf(B)];
  const team = (e: any, side: string) => prepareSavedBattleRoster([structuredClone(e)], [structuredClone(e)], false, side);
  const build = (mode: 'PVE' | 'PVP', concealA: boolean, concealB: boolean, phase: string) => {
    const p1Team = team(A, 'p1'), p2Team = team(B, 'p2');
    p1Team[0].isConcealed = concealA; p2Team[0].isConcealed = concealB;
    const engine = createBattleEngine({ initialP1Team: p1Team, initialP2Team: p2Team, p1StarterId: p1Team[0].battleId, p2StarterId: p2Team[0].battleId, battleMode: mode, preparedTeams: true });
    const st = engine.getState();
    const logs = [
      { turn: 1, text: `【${A.name}】使用了【${A.skills[0].name}】`, type: 'info' },
      { turn: 1, text: `【${B.name}】使用了【${B.skills[0].name}】，觸發【${B.soulMark.name}】`, type: 'info' },
    ];
    st.p1.shield = 123456; st.p1.barrier = 654321; st.p2.shield = 123456; st.p2.barrier = 654321;
    st.p1.currentHp = st.p1.maxHp * .37; st.p2.currentHp = st.p2.maxHp * .63;
    return { ...st, phase, logs, damageDealt: { [A.name]: 100, [B.name]: 200 } };
  };
  const { createDamageLedger, recordDamage } = await server.ssrLoadModule('/src/battle/damageLedger.ts');
  const makeLedger = (value: any) => {
    const ledger = createDamageLedger();
    const active = { p1: { battleId: value.p1.battleId, name: A.name }, p2: { battleId: value.p2.battleId, name: B.name } };
    const hit = (targetSide: 'p1' | 'p2', src: any, skill: string, hp: number) => recordDamage(ledger, { turn: 1, targetSide, targetBattleId: value[targetSide].battleId, targetName: targetSide === 'p1' ? A.name : B.name, active,
      receipt: { hpLost: hp, shieldAbsorbed: 0, barrierAbsorbed: 0 }, data: { skillName: skill, sourceSide: src, sourceBattleId: value[src].battleId, sourceElfName: src === 'p1' ? A.name : B.name }, damageType: 'skill_attack' });
    hit('p2', 'p1', A.skills[0].name, 900); hit('p1', 'p2', B.skills[0].name, 700);
    return ledger;
  };
  const html = async (mode: 'PVE' | 'PVP', concealA: boolean, concealB: boolean, phase = 'p1_select', ended = false, retain = false) => {
    const value: any = build(mode, concealA, concealB, phase);
    if (ended) value.winner = 'p1';
    await act(async () => root.render(<BattleContext.Provider value={value}><BattleScreenUI battleMode={mode} onSkillSelect={() => {}} onSwitchElf={() => {}} onUseItem={() => {}} onReset={() => {}} onBackToMenu={() => {}} onAutoBattleToggle={() => {}} activeSkillAnim={null} floatingDamagePopups={[]} consoleShake={null} damageDealt={value.damageDealt} ledger={ended ? makeLedger(value) : undefined} /></BattleContext.Provider>));
    const out = document.body.innerHTML;
    if (!retain) await act(async () => root.render(<></>));
    return out;
  };
  const leaked = (out: string, secrets: string[]) => secrets.filter(t => out.includes(t));

  await check('基準：未隱匿時雙方名稱與技能都在 DOM（確認掃描有效）', async () => {
    const out = await html('PVE', false, false);
    assert.ok(out.includes(A.name) && out.includes(B.name), '名稱可見');
    assert.ok(leaked(out, secA).length >= 2 && leaked(out, secB).length >= 1);
  });
  await check('PVE：對方（p2）隱匿 → DOM／title／aria／訊息／圖表不含其名稱、魂印、技能', async () => {
    const out = await html('PVE', false, true);
    assert.deepEqual(leaked(out, secB), []);
    assert.ok(out.includes(A.name), '己方照常可見');
  });
  await check('PVE：己方（p1）隱匿 → 持有方照常看到自己的名稱與技能', async () => {
    const out = await html('PVE', true, false);
    assert.ok(out.includes(A.name) && out.includes(A.skills[0].name), '持有方可見');
    assert.deepEqual(leaked(out, secB).length > 0, true, '對方未隱匿仍可見');
  });
  for (const phase of ['p1_select', 'p2_select']) {
    await check(`PVP（${phase}）：僅操作側技能列可見，HUD 與其他文字遮蔽`, async () => {
      const out = await html('PVP', true, true, phase);
      const page = document.createElement('div'); page.innerHTML = out;
      const row = page.querySelector('[data-act-side]')!;
      const own = phase === 'p1_select' ? A : B;
      assert.ok(row.textContent?.includes(own.skills[0].name), '操作方可看完整技能名');
      row.remove();
      assert.deepEqual(leaked(page.innerHTML, [...secA, ...secB]), []);
      assert.equal(page.querySelectorAll('[data-protection]').length, 0);
      for (const hp of page.querySelectorAll('.bt-hp')) {
        assert.ok(hp.textContent?.includes('？/？'));
        assert.ok(!hp.textContent?.includes('%'), '不顯示百分比');
      }
      assert.ok(page.textContent?.includes('隱匿'));
      assert.ok(!page.textContent?.includes('123456') && !page.textContent?.includes('654321'));
    });
  }
  await check('PVP：只有一方隱匿 → 該方被遮、另一方可見', async () => {
    const out = await html('PVP', true, false, 'resolving');
    assert.deepEqual(leaked(out, secA), []);
    assert.ok(leaked(out, secB).length > 0);
  });
  await check('PVP：換操作方或開始結算時，上一方技能浮窗立即隱藏', async () => {
    await html('PVP', true, true, 'p1_select', false, true);
    const button = document.querySelector('[data-act-side] button:not([disabled])')!;
    assert.ok(button, '測試需有可操作技能');
    await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    assert.ok(document.querySelector('[data-skill-tooltip]'), '選招可開啟技能浮窗');
    await html('PVP', true, true, 'p2_select', false, true);
    assert.equal(document.querySelector('[data-skill-tooltip]')?.outerHTML.slice(0, 160) ?? null, null, '不可殘留前一方浮窗');
    assert.deepEqual(leaked(document.body.innerHTML, secA), []);
    await html('PVP', true, true, 'resolving', false, true);
    assert.equal(document.querySelector('[data-skill-tooltip]')?.outerHTML.slice(0, 160) ?? null, null);
    assert.deepEqual(leaked(document.body.innerHTML, [...secA, ...secB]), []);
    await act(async () => root.render(<></>));
  });
  await check('PVP：出招階段雙方技能仍遮蔽', async () => {
    const out = await html('PVP', true, true, 'resolving');
    assert.deepEqual(leaked(out, [...secA, ...secB]), []);
  });
  await check('結算畫面：PVE 對方隱匿的名稱／技能（MVP、排行、技能 Top）不出現；己方照常', async () => {
    const out = await html('PVE', false, true, 'p1_select', true);
    assert.ok(out.includes('data-testid="battle-result"'), '結算畫面有渲染');
    assert.deepEqual(leaked(out, secB), []);
    assert.ok(out.includes(A.name));
  });
  await check('結算畫面：PVP 雙方隱匿都不出現', async () => {
    const out = await html('PVP', true, true, 'p1_select', true);
    assert.ok(out.includes('data-testid="battle-result"'));
    assert.deepEqual([...leaked(out, secA), ...leaked(out, secB)], []);
  });
  console.log(`隱匿戰鬥畫面 DOM 掃描 ${passed} 項通過。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
process.exit(0);
