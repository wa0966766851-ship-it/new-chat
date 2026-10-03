import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/?fast=1' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
(dom.window.HTMLDialogElement.prototype as any).showModal = function () { this.open = true; };
(dom.window.HTMLDialogElement.prototype as any).close = function () { this.open = false; };
(window as any).__BATTLE_FAST__ = true;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const click = async (scope: ParentNode, text: string) => {
  const button = [...scope.querySelectorAll('button')].find(e => e.textContent?.includes(text));
  assert.ok(button, text); assert.equal(button.disabled, false);
  await act(async () => button.click());
};
try {
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  let driver: any, home = 0, restart = 0, result = 0;
  const make = (id: string, power: number, speed: number): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
    currentHp: 500, maxHp: 500, baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed },
    calculatedStats: { hp: 500, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, statStages: {},
    skills: [{ name: '測試攻擊', category: '物理', type: '普通', power, pp: 5, maxPp: 5 }] });
  const props = { initialP1Team: [make('a', 5000, 200)], initialP2Team: [make('b', 1, 100)],
    p1StarterId: 'a', p2StarterId: 'b', battleMode: 'PVP', preparedTeams: true,
    onBackToMenu: () => home++, onRestartBattle: () => restart++, onBattleEnd: () => result++,
    onDriverInit: (d: any) => driver = d };
  await act(async () => root.render(React.createElement(Battle, props)));
  await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
  for (let i = 0; i < 80 && !driver.getSyncState().winner; i++) await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  assert.equal(driver.getSyncState().winner, 'p1');
  assert.ok(document.querySelector('dialog[open]')?.textContent?.includes('P1 勝利'));
  await click(document.querySelector('dialog')!, '重來'); assert.equal(restart, 1);
  await click(document.querySelector('dialog')!, '回到首頁'); assert.equal(home, 1); assert.equal(result, 1, '回首頁不重複結算');
  await act(async () => root.render(React.createElement(Battle, { ...props, key: 'restart' })));
  assert.equal(driver.getSyncState().winner, null); assert.equal(document.querySelector('dialog'), null);
  assert.equal(driver.getSyncState().p1.currentHp, 500); assert.equal(driver.getSyncState().turnNumber, 1);
  await act(async () => root.render(React.createElement(Battle, { ...props, key: 'special', specialMode: 'interstellar' })));
  await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
  for (let i = 0; i < 80 && !driver.getSyncState().winner; i++) await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  assert.equal(driver.getSyncState().winner, 'p1');
  const sd = document.querySelector('dialog'); assert.ok(sd?.textContent?.includes('返回回廊'), '特殊模式只給返回模式'); assert.ok(!sd?.textContent?.includes('重來'));
  await click(sd!, '返回回廊'); assert.equal(home, 2);

  // 使用與 App 相同的 key 重建流程，驗收真實按鈕而非只測重建函式。
  const restartProps = { ...props, preparedTeams: false,
    initialP1Team: [make('restart-a', 5000, 100), make('restart-bench', 1, 100)],
    initialP2Team: [make('restart-enemy', 100, 200), make('restart-enemy-bench', 100, 200)],
    p1StarterId: 'restart-a', p2StarterId: 'restart-enemy' };
  const inputs = structuredClone([restartProps.initialP1Team, restartProps.initialP2Team]);
  function RestartHarness() {
    const [key, setKey] = React.useState(0);
    return React.createElement(Battle, { ...restartProps, key, onRestartBattle: () => setKey(k => k + 1) });
  }
  await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(RestartHarness))));
  const baseline = structuredClone(driver.getSyncState());
  for (let round = 0; round < 2; round++) {
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 80 && !driver.getSyncState().winner && !driver.getSyncState().phase.startsWith('forced_switch'); i++) {
      await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    }
    if (!driver.getSyncState().winner) {
      await act(async () => driver.onSwitchElf('p2', 1));
      for (let i = 0; i < 80 && driver.getSyncState().phase !== 'p1_select'; i++) await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    }
  }
  const used = driver.getSyncState();
  assert.equal(used.winner, 'p1'); assert.ok(used.p1.currentHp < baseline.p1.currentHp, '舊局確實扣過體力');
  assert.ok(used.p1.skills[0].pp < baseline.p1.skills[0].pp, '舊局確實消耗 PP');
  // 注入各類殘留狀態，包含場下精靈與全局容器，確保驗收不限於當前畫面。
  for (const side of ['p1', 'p2']) {
    for (const elf of [used[side], ...used[`${side}Team`]]) {
      Object.assign(elf, { currentHp: 3, shield: 999, barrier: 777, battleStatus: '麻痹', battleStatuses: { 麻痹: 5 },
        statStages: { atk: 6 }, effects: [{ id: 'old-effect' }], marks: [{ id: 'old-mark' }], bonusPriorityTurns: 8 });
      elf.skills[0].pp = 0; elf.skills[0].maxPp = 0; elf.skills[0].skillRune = 'old-rune';
    }
    used[`${side}Timers`] = [{ id: 'old-timer', remaining: 9 }];
    used[`${side}Marks`] = [{ id: 'old-mark', count: 9 }];
    used[`${side}RegistryState`] = { 'old-event': 99 };
    used[`${side}ElfState`] = { old: { registry: { retained: true } } };
  }
  used.damageDealt = { old: 999 }; used.activeSkillAnim = { old: true };
  used.floatingDamagePopups.push({ id: 'old-popup' }); used.isTyrDuelField = true;
  const oldDriver = driver;
  await click(document.querySelector('dialog')!, '重來');
  assert.deepEqual(driver.getSyncState(), baseline, '全局／雙隊／場上與場下資料全部恢復開局基準');
  assert.deepEqual([restartProps.initialP1Team, restartProps.initialP2Team], inputs, '原始陣容不被戰鬥反向修改');
  await act(async () => { oldDriver.onSkillSelect('p1', oldDriver.getSyncState().p1.skills[0]); await new Promise(r => setTimeout(r, 1400)); });
  assert.deepEqual(driver.getSyncState(), baseline, '上一局的延後事件／彈字回呼不能影響新局');

  // 結算／動畫尚未完成時重建，也不能送出上一局的結算回呼。
  dom.reconfigure({ url: "http://localhost/" });
  (window as any).__BATTLE_FAST__ = false;
  let staleResults = 0;
  await act(async () => root.render(React.createElement(Battle, { ...props, key: 'in-flight', onBattleEnd: () => staleResults++ })));
  await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); await new Promise(r => setTimeout(r, 30)); });
  assert.equal(staleResults, 0);
  await act(async () => root.render(React.createElement(Battle, { ...props, key: 'replacement' })));
  const replacement = structuredClone(driver.getSyncState());
  await act(async () => { await new Promise(r => setTimeout(r, 1600)); });
  assert.equal(staleResults, 0, '已卸載的局不能再發送結果');
  assert.deepEqual(driver.getSyncState(), replacement);
  console.log('重來驗收：雙隊／場下HP與PP、狀態、護盾、計時器、註冊表、日誌、換人、動畫全快照重設，StrictMode及未完成舊局回呼隔離通過');
  (window as any).__BATTLE_FAST__ = true;

  const { BattleEndDialog } = await server.ssrLoadModule('/src/components/BattleEndDialog.tsx');
  for (const [winner, title] of [['p2', 'P2 勝利'], ['draw', '雙方平手']]) {
    await act(async () => root.render(React.createElement(BattleEndDialog, { winner, onRestart: () => {}, onHome: () => {} })));
    assert.ok(document.querySelector('dialog')?.textContent?.includes(title));
  }
  const { ElfAvatar } = await server.ssrLoadModule('/src/components/SeerImages.tsx');
  const { loadSeerIndex } = await server.ssrLoadModule('/src/battle/seerAssets.ts'); await loadSeerIndex();
  await act(async () => root.render(React.createElement(ElfAvatar, { elf: { id: 'fear', name: '恐懼的化身·咤克斯' }, kind: 'body', battleSide: 'p2' })));
  const fear = document.querySelector('img')!;
  assert.ok(fear.src.endsWith('zhakesi_fear_body.png')); assert.equal(fear.style.transform, 'scaleX(-1)');
  await act(async () => fear.dispatchEvent(new dom.window.Event('error')));
  assert.equal(document.querySelector('img')!.style.transform, '', '備用官方朝左圖不再翻轉');

  const { petImageUrls } = await server.ssrLoadModule('/src/battle/seerAssets.ts');
  assert.equal(petImageUrls({ name: '天蓬元帥八戒', id: 'fixture' }, 'body')[0], '/seer/body/1536.png');
  assert.equal(petImageUrls({ name: '人皇·帝辛', id: 'fixture' }, 'body')[0], '/elf-art/emperor_dixin_body.png');
  // 隱匿只對敵方視角掩蓋：己方（P1）完整顯示真實立繪。
  await act(async () => root.render(React.createElement(ElfAvatar, { elf: { id: 'secret', name: '秘密身份', path: '/secret-real-image.png', isConcealed: true }, kind: 'body', battleSide: 'p1' })));
  assert.ok(document.querySelector('img')!.src.endsWith('/secret-real-image.png'), '己方隱匿精靈顯示真實立繪');
  for (const side of ['p2']) {
    await act(async () => root.render(React.createElement(ElfAvatar, { elf: { id: 'secret', name: '秘密身份', path: '/secret-real-image.png', isConcealed: true }, kind: 'body', battleSide: side })));
    const ghost = document.querySelector('img')!;
    assert.ok(ghost.src.endsWith('/elf-art/unknown_myth_ghost_body.png'));
    assert.equal(ghost.alt, '未知精靈'); assert.equal(ghost.style.transform, '');
    assert.ok(!document.body.innerHTML.includes('/secret-real-image.png'));
  }
  await act(async () => document.querySelector('img')!.dispatchEvent(new dom.window.Event('error')));
  assert.equal(document.querySelector('img'), null, '鬼影缺圖也不能退回真實精靈');
  assert.ok(document.body.textContent?.includes('?'));

  const { GameDataProvider } = await server.ssrLoadModule('/src/contexts/GameDataContext.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { default: Start } = await server.ssrLoadModule('/src/components/StartScreen.tsx');
  const saved = structuredClone(DEFAULT_ELVES.slice(0, 2));
  saved.forEach((e: any, i: number) => { e.battleId = `saved-${i}`; });
  saved[0].inscriptions = [{ id: 'fixture-inscription', name: '測試刻印', description: '', stats: { hp: 20, atk: 10, def: 10, spatk: 10, spdef: 10, speed: 10 } }];
  saved[0].skills = saved[0].skills.slice().reverse();
  saved[0].evs = { hp: 17, atk: 19, def: 0, spatk: 0, spdef: 0, speed: 23 };
  localStorage.setItem('seer_last_used_p1_team', JSON.stringify({ team: saved, starterId: 'saved-1' }));
  const mountStart = () => React.createElement(GameDataProvider, null, React.createElement(Start, { onStartBattle: () => {}, onNavigateToCustom: () => {} }));
  await act(async () => root.render(mountStart()));
  const tool = (side: string) => document.querySelector(`[aria-label="${side} 陣容工具"]`)!;
  assert.equal(tool('P1').querySelectorAll('button').length, 5); assert.equal(tool('P2').querySelectorAll('button').length, 5);
  await click(tool('P1'), '保存當前');
  const p1 = JSON.parse(localStorage.getItem('seer_last_used_p1_team')!);
  assert.equal(p1.starterId, p1.team[1].battleId); assert.deepEqual(p1.team[0].evs, saved[0].evs);
  await click(tool('P2'), '複製 P1'); await click(tool('P2'), '保存當前');
  const p2 = JSON.parse(localStorage.getItem('seer_last_used_p2_team')!);
  assert.equal(p2.starterId, p2.team[1].battleId); assert.deepEqual(p2.team[0].evs, saved[0].evs);
  assert.notEqual(p1.team[0].battleId, p2.team[0].battleId);
  assert.deepEqual(p2.team[0].inscriptions, saved[0].inscriptions);
  assert.deepEqual(p2.team[0].skills.map((s: any) => s.name), saved[0].skills.map((s: any) => s.name));
  await click(tool('P2'), '隨機部署'); await click(tool('P2'), '載入紀錄'); await click(tool('P2'), '保存當前');
  const restored = JSON.parse(localStorage.getItem('seer_last_used_p2_team')!);
  assert.equal(restored.team.length, 2); assert.deepEqual(restored.team[0].evs, saved[0].evs);
  assert.equal(restored.starterId, restored.team[1].battleId);
  await click(tool('P1'), '複製 P2'); await click(tool('P1'), '保存當前');
  assert.equal(JSON.parse(localStorage.getItem('seer_last_used_p1_team')!).starterId,
    JSON.parse(localStorage.getItem('seer_last_used_p1_team')!).team[1].battleId);
  await act(async () => root.render(React.createElement('div')));
  await act(async () => root.render(mountStart()));
  await click(tool('P2'), '保存當前');
  const remounted = JSON.parse(localStorage.getItem('seer_last_used_p2_team')!);
  assert.equal(remounted.team.length, 2); assert.equal(remounted.starterId, remounted.team[1].battleId);
  assert.deepEqual(remounted.team[0].inscriptions, saved[0].inscriptions);
  console.log('普通對戰彈窗、重來清空結果、特殊模式隔離、立繪備用來源、雙向複製／獨立保存／首發與配裝還原通過');
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
