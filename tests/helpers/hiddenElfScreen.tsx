import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

/**
 * 隱匿戰鬥畫面 DOM 掃描的共用載具。
 *
 * 為什麼要拆：原本 9 項檢查都在同一個 process 內反覆掛載整個戰鬥 UI，
 * JSDOM 保留的節點樹累積到第 7 項就吃掉整台機器的可用記憶體（Committing semi space failed）。
 * 拆檔後每個檔案只跑一組情境、只掛載少數幾次，單一 process 的峰值就回到可驗證的範圍。
 *
 * 這裡只做「載入模組 + 建立情境 + 掃描」，不含任何斷言內容；
 * 各情境檔自己決定要驗什麼，避免一個檔案重新長回原本的規模。
 */
export async function createHiddenElfHarness() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.fetch = (async () => { throw new Error('offline'); }) as any;
  (dom.window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  Object.assign(globalThis, {
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  });

  const { createRoot } = await import('react-dom/client');
  const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  const root = createRoot(document.getElementById('root')!);

  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { prepareSavedBattleRoster } = await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
  const { BattleContext } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { BattleScreenUI } = await server.ssrLoadModule('/src/components/BattleScreen.ui.tsx');
  const { createDamageLedger, recordDamage } = await server.ssrLoadModule('/src/battle/damageLedger.ts');

  const rich = DEFAULT_ELVES.filter((e: any) => e.name?.length >= 3 && e.soulMark?.name?.length >= 2 && e.skills?.length >= 4 && new Set(e.skills.map((s: any) => s.name)).size === e.skills.length);
  const A = rich[0];
  const B = rich.find((e: any) => e.name !== A.name && e.soulMark.name !== A.soulMark.name && !e.name.includes(A.name) && !A.name.includes(e.name));
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

  const makeLedger = (value: any) => {
    const ledger = createDamageLedger();
    const active = { p1: { battleId: value.p1.battleId, name: A.name }, p2: { battleId: value.p2.battleId, name: B.name } };
    const hit = (targetSide: 'p1' | 'p2', src: any, skill: string, hp: number) => recordDamage(ledger, {
      turn: 1, targetSide, targetBattleId: value[targetSide].battleId, targetName: targetSide === 'p1' ? A.name : B.name, active,
      receipt: { hpLost: hp, shieldAbsorbed: 0, barrierAbsorbed: 0 },
      data: { skillName: skill, sourceSide: src, sourceBattleId: value[src].battleId, sourceElfName: src === 'p1' ? A.name : B.name },
      damageType: 'skill_attack',
    });
    hit('p2', 'p1', A.skills[0].name, 900); hit('p1', 'p2', B.skills[0].name, 700);
    return ledger;
  };

  const html = async (mode: 'PVE' | 'PVP', concealA: boolean, concealB: boolean, phase = 'p1_select', ended = false, retain = false) => {
    const value: any = build(mode, concealA, concealB, phase);
    if (ended) value.winner = 'p1';
    await act(async () => root.render(
      <BattleContext.Provider value={value}>
        <BattleScreenUI battleMode={mode} onSkillSelect={() => {}} onSwitchElf={() => {}} onUseItem={() => {}}
          onReset={() => {}} onBackToMenu={() => {}} onAutoBattleToggle={() => {}} activeSkillAnim={null}
          floatingDamagePopups={[]} consoleShake={null} damageDealt={value.damageDealt}
          ledger={ended ? makeLedger(value) : undefined} />
      </BattleContext.Provider>,
    ));
    const out = document.body.innerHTML;
    if (!retain) await act(async () => root.render(<></>));
    return out;
  };

  const leaked = (out: string, secrets: string[]) => secrets.filter(t => out.includes(t));

  const state = { passed: 0 };
  const check = async (name: string, run: () => void | Promise<void>) => {
    await run();
    state.passed++;
    console.log(`✓ ${name}`);
  };
  const finish = async (label: string) => {
    console.log(`${label} ${state.passed} 項通過。`);
    await act(async () => root.unmount());
    await server.close();
    dom.window.close();
    process.exit(0);
  };

  return { React, act, dom, assert, check, finish, html, leaked, A, B, secA, secB, makeLedger, document };
}
