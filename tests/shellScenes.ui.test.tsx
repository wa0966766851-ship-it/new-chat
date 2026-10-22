// 雙殼畫面的渲染驗證（jsdom）
//
// 為什麼需要它：
//   2026-10-21 Aegis 大廳因為「預覽隊伍少了 active/standby」直接 crash，
//   而我當時只看截圖，沒發現是整頁進錯誤邊界。
//   截圖只能證明「畫面有東西」，不能證明「元件沒拋錯」。
//   這裡用 jsdom 真的把元件渲染出來，任何 TypeError 都會讓測試失敗。
//
// 涵蓋：
//   LobbyScene  — 無存檔（預覽隊伍）與有存檔兩種情況都要能渲染
//   TeamScene   — 12 格、儲存、背包入口
//   BagScene    — 五個分頁、P1/P2 切換、精靈倉庫

import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
// JSDOM 沒有螢幕媒體介面；提供元件實際使用的完整訂閱形狀。
Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: (query: string) => ({
  media: query, matches: query.includes('portrait') ? dom.window.innerHeight > dom.window.innerWidth : false,
  onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  dispatchEvent() { return true; },
}) });
// 圖片一律失敗：驗證「沒有立繪也要有完整構圖」，不是驗證圖片載入
globalThis.fetch = (async () => { throw new Error('offline'); }) as any;

const { createRoot } = await import('react-dom/client');

// ── 共用測試資料 ──
const mkElf = (n: number, type = '暗影'): any => ({
  id: `e${n}`,
  battleId: `e${n}_inst`,
  name: `精靈${n}`,
  type,
  level: 100,
  maxHp: 1000,
  currentHp: 1000,
  calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  skills: [],
  soulMark: { name: '測試', description: '', effectType: 'custom', effectValue: 0 },
});

const allElves = Array.from({ length: 30 }, (_, i) => mkElf(i + 1));

/** 最小可用的 ShellBridge（只填畫面真的會讀的欄位） */
function makeBridge(overrides: Record<string, any> = {}): any {
  const noop = () => {};
  return {
    view: 'start', setView: noop,
    allElves, allElvesCombined: allElves, updateElf: noop,
    handleStartBattle: noop, battleMode: 'PVE', setBattleMode: noop,
    battleFormat: 'normal_6v6', setBattleFormat: noop,
    battleKey: 0, restartedRef: { current: false }, handleRestartBattle: noop,
    isTransitioning: false,
    p1Team: [], p2Team: [], p1StarterId: '', p2StarterId: '',
    p1Suit: '', p1Eyewear: '', p2Suit: '', p2Eyewear: '', p1Title: '', p2Title: '',
    hostPlayer: 'p1', setHostPlayer: noop,
    specialMode: undefined, interstellarOptions: null, setInterstellarOptions: noop,
    editingElf: null, setEditingElf: noop, editorTab: undefined, setEditorTab: noop,
    showEncyclopedia: false, setShowEncyclopedia: noop,
    showPerformanceProbe: false, setShowPerformanceProbe: noop,
    ...overrides,
  };
}

async function render(el: React.ReactElement): Promise<{ root: any; container: HTMLElement; text: () => string }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(el); });
  // 等一輪微任務，讓 useEffect 內的動態 import 有機會失敗而不炸測試
  await act(async () => { await Promise.resolve(); });
  return {
    root,
    container,
    text: () => (container.textContent || ''),
  };
}

async function unmount(root: any) {
  await act(async () => { root.unmount(); });
}

// ─────────────────────────────────────────────
// LobbyScene
// ─────────────────────────────────────────────
{
  const { LobbyScene } = await import('../src/shell/scenes/LobbyScene');

  // 情境 A：完全沒有存檔（這就是之前 crash 的路徑）
  dom.window.localStorage.clear();
  const navigation: string[] = [];
  const a = await render(<LobbyScene b={makeBridge({setView:(v:string)=>navigation.push(v),handleStartBattle:()=>navigation.push('unexpected-battle')})} />);
  const ta = a.text();
  assert.ok(ta.length > 50, '無存檔時大廳仍必須渲染出內容（不能是空白或錯誤邊界）');
  assert.ok(ta.includes('開始對戰') || ta.includes('進入副本'), '大廳必須有主行動按鈕');
  // 2026-10-21：首頁收斂為摘要（使用者要求「隊伍不要暴露在首頁」）
  assert.ok(ta.includes('SQUAD') || ta.includes('12/12'), '大廳必須顯示隊伍摘要');
  assert.ok(ta.includes('隊伍'), '大廳必須有進隊伍（背包）的入口');
  const launch = [...a.container.querySelectorAll('button')].find(x=>x.classList.contains('lobby-launch'))!;
  await act(async()=>launch.click());
  assert.deepEqual(navigation,['bag'],'首頁開始對戰先確認新背包，不能直接啟動戰鬥');
  await unmount(a.root);

  // 情境 B：有存檔（前 6 出戰、後 6 待命）
  const record = {
    team: Array.from({ length: 12 }, (_, i) => mkElf(i + 1)),
    starterId: 'e1_inst',
    timestamp: '12:00:00',
  };
  dom.window.localStorage.setItem('seer_last_used_p1_team', JSON.stringify(record));
  dom.window.localStorage.setItem('seer_last_used_p2_team', JSON.stringify(record));
  const b = await render(<LobbyScene b={makeBridge()} />);
  const tb = b.text();
  assert.ok(tb.includes('SQUAD') || tb.includes('12/12'), '有存檔時要有隊伍摘要');
  assert.ok(b.container.querySelector('[title="精靈1"]'), '首頁摘要保留首發頭像與名稱提示');
  await unmount(b.root);

  // 情境 C：壞存檔（null 項目）不得崩潰
  dom.window.localStorage.setItem('seer_last_used_p1_team', JSON.stringify({ team: [null, undefined, mkElf(1)], starterId: '' }));
  const c = await render(<LobbyScene b={makeBridge()} />);
  assert.ok(c.text().length > 50, '壞存檔不得讓大廳變成空白');
  await unmount(c.root);
}

// ─────────────────────────────────────────────
// TeamScene
// ─────────────────────────────────────────────
{
  const { SettingsDrawer } = await import('../src/shell/scenes/LobbyPanels');
  let host = '';
  let setup = false;
  const r = await render(<SettingsDrawer b={makeBridge({ battleMode: 'PVP', setHostPlayer: (value: string) => { host = value; } })} onClose={() => {}} onSetup={() => { setup = true; }} />);
  const buttons = [...r.container.querySelectorAll('button')];
  const p2 = buttons.find(e => e.textContent?.includes('房主 P2'));
  assert.ok(p2, '雙人模式明確顯示房主 P2，不誤標 AI');
  await act(async () => { p2.click(); });
  assert.equal(host, 'p2', '房主切換寫回實際對戰設定');
  const full = buttons.find(e => e.textContent?.includes('完整戰前設定'));
  assert.ok(full);
  await act(async () => { full.click(); });
  assert.equal(setup, true, '完整設定入口必須真正開啟設定頁');
  await unmount(r.root);
}
{
  dom.window.localStorage.clear();
  const { TeamScene } = await import('../src/shell/scenes/TeamScene');
  const r = await render(<TeamScene b={makeBridge()} />);
  const t = r.text();
  assert.ok(t.includes('編成'), '編成頁要有標題');
  assert.ok(t.includes('儲存'), '編成頁要有儲存按鈕');
  assert.ok(t.includes('背包'), '編成頁要有背包入口（背包已從主導航移除）');
  assert.ok(t.includes('我方') && t.includes('對手'), '編成頁要能切換 P1/P2');
  // 12 格：空格用「+」表示，至少要有 12 個按鈕層級的空格
  assert.ok(t.includes('0/12'), '空隊伍要顯示 0/12');
  await unmount(r.root);
}

// ─────────────────────────────────────────────
// BagScene
// ─────────────────────────────────────────────
{
  dom.window.localStorage.clear();
  const { BagScene } = await import('../src/shell/scenes/BagScene');
  const r = await render(<BagScene b={makeBridge()} />);
  const t = r.text();
  assert.ok(t.includes('背包'), '背包頁要有標題');
  // 2026-10-21：技能石是「換精靈技能」，屬於精靈編輯器，不在背包
  for (const tab of ['隊伍', '套裝', '護目鏡', '稱號', '精靈']) {
    assert.ok(t.includes(tab), `背包必須有「${tab}」分頁`);
  }
  assert.ok(!t.includes('技能石'), '背包不得有技能石分頁（屬於精靈編輯器）');
  assert.ok(t.includes('P1') && t.includes('P2'), '隊伍分頁必須同時顯示雙方');
  assert.ok(!t.includes('對象'), '隊伍不顯示無關的裝備對象列');
  await unmount(r.root);
}

// ─────────────────────────────────────────────
// BagScene：點物品要真的裝備（寫進 Legacy 的 key）
// ─────────────────────────────────────────────
{
  dom.window.localStorage.clear();
  const { BagScene } = await import('../src/shell/scenes/BagScene');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<BagScene b={makeBridge()} />); });

  // 找物品卡：用 title 屬性精準定位（避免誤抓「套裝」分頁按鈕）
  // 套裝改用 SuitRail 的卡片（data-suit-card），預設分頁是隊伍，要先切到套裝
  const suitTab = [...container.querySelectorAll('button')].find(b => (b.textContent || '').trim() === '套裝');
  assert.ok(suitTab, '必須有套裝分頁按鈕');
  await act(async () => { (suitTab as HTMLElement).click(); });
  await act(async () => { await Promise.resolve(); });
  const opponentTab = [...container.querySelectorAll('button')].find(b => (b.textContent || '').trim() === '對手');
  assert.ok(opponentTab, '裝備分頁保留對手配裝入口');

  const itemCard = container.querySelector('button[data-suit-card]');
  assert.ok(itemCard, '套裝分頁必須至少有一張卡片');

  const before = dom.window.localStorage.getItem('seer_p1_suit');
  await act(async () => { (itemCard as HTMLElement).click(); });
  const after = dom.window.localStorage.getItem('seer_p1_suit');
  assert.ok(after && after.length > 0, '點擊物品後必須真的寫入 seer_p1_suit');
  assert.notEqual(after, before, '裝備後的值必須改變');

  // 再點一次同一張 → 卸下
  await act(async () => { (itemCard as HTMLElement).click(); });
  const after2 = dom.window.localStorage.getItem('seer_p1_suit');
  assert.equal(after2, '', '再點一次同一件要卸下（寫空字串）');
  await act(async () => { (opponentTab as HTMLElement).click(); });
  await act(async () => { (itemCard as HTMLElement).click(); });
  assert.ok(dom.window.localStorage.getItem('seer_p2_suit'), '對手配裝寫入 P2');
  assert.equal(dom.window.localStorage.getItem('seer_p1_suit'), '', '對手配裝不修改 P1');

  await act(async () => { root.unmount(); });
}

// 新版背包直接委派舊版控制器：驗證操作目標、交換參數與預設插槽不混用雙方。
{
  const { LegacyTeamWorkspace } = await import('../src/shell/scenes/LegacyTeamWorkspace');
  const calls: string[] = [];
  const side = (name: string): any => ({
    team: allElves.slice(0,12), starterId: allElves[0].battleId, annual: true,
    suit:'',eyewear:'',title:'',presets:{},hasRecord:true,
    ...Object.fromEntries(['setAnnual','setSuit','setEyewear','setTitle','starter','remove','choose','swap','swapStandby','clear','randomize','copyOther','save','load','savePreset','loadPreset','add'].map(key=>[key,(...args: any[])=>calls.push(`${name}:${key}:${args.filter(x=>typeof x!=='object').join(',')}`)])),
  });
  const p: any = {sides:{p1:side('p1'),p2:side('p2')},elves:allElves,message:'',detail:()=>calls.push('detail'),create:()=>calls.push('create'),start:()=>calls.push('start'),swapTeams:()=>calls.push('swapTeams'),mode:'PVE',setMode:()=>{},host:'p1',setHost:()=>{},format:'normal_6v6',setFormat:()=>{},banCount:3,setBanCount:()=>{},pickCount:6,setPickCount:()=>{}};
  const v = await render(<LegacyTeamWorkspace {...p}/>);
  const panel = (side: string) => v.container.querySelector(`[aria-label="${side} 隊伍"]`)!;
  // 2026-10-22：精靈與隊伍工具列改成圖示按鈕，改用 aria-label 定位
  const click = async (scope: Element, label: string) => {
    const button = [...scope.querySelectorAll('button')].find(
      x => x.textContent?.trim() === label || x.getAttribute('aria-label') === label,
    );
    assert.ok(button,`缺少操作 ${label}`);
    await act(async()=>button!.click());
  };
  await click(panel('P2'),'保存紀錄');
  await click(panel('P2'),'複製對方隊伍');
  await click(panel('P1'),'全部出戰⇄待命');
  await click(v.container.querySelector('[data-workspace-slot="p2-0"]')!,'替換精靈');
  await click(v.container.querySelector('[data-workspace-slot="p1-0"]')!,'移動位置');
  await act(async()=>{v.container.querySelector<HTMLButtonElement>('[data-workspace-slot="p1-1"] > button')!.click();});
  await click(panel('P2'),'保存');
  await click(v.container,'開始對戰／選禁');
  assert.deepEqual(calls,['p2:save:','p2:copyOther:','p1:swapStandby:','p2:choose:0','p1:swap:0,1','p2:savePreset:1','start']);
  assert.equal(v.container.querySelectorAll('[data-workspace-slot]').length,24);
  assert.equal(v.container.querySelectorAll('[data-workspace-slot="p1-6"] button:disabled').length,1,'待命格不可指定首發');
  await unmount(v.root);
}

console.log('雙殼畫面渲染與共用舊版控制器按鈕委派通過');