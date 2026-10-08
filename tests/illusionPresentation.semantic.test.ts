import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// DOM契約不是像素截圖：以正式元件斷言src、鏡射、遮罩及比例，不假裝已下載圖片。
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperties(dom.window.HTMLElement.prototype, {
  clientWidth: { configurable: true, get: () => 1200 }, clientHeight: { configurable: true, get: () => 600 },
});
Object.defineProperties(dom.window.HTMLImageElement.prototype, {
  naturalWidth: { configurable: true, get: () => 200 }, naturalHeight: { configurable: true, get: () => 200 },
  complete: { configurable: true, get: () => false },
});
// 不對真實素材偽造量測證據；非對稱測試像素只驗鏡射後錨點及換圖重量。
(dom.window.HTMLCanvasElement.prototype as any).getContext = function () {
  return { drawImage() {}, getImageData: (_x: number, _y: number, w: number, h: number) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 20; y < 180; y++) for (let x = 10; x < 110; x++) data[(y * w + x) * 4 + 3] = 255;
    return { data };
  } };
};
(window as any).__BATTLE_FAST__ = true;
(globalThis as any).__BATTLE_SEED__ = 841;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [{ name: 'headless-only', configResolved(c) { c.server.hmr = false; c.server.watch = null; } }] });
const errors: unknown[][] = [], originalError = console.error;
console.error = (...args) => { errors.push(args); originalError(...args); };
let checks = 0;
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 5)); });
const image = (selector = 'img') => { const img = document.querySelector<HTMLImageElement>(selector); assert.ok(img, selector); return img; };
const loaded = async (selector = 'img') => { await act(async () => image(selector).dispatchEvent(new dom.window.Event('load'))); await settle(); };
try {
  const { ElfAvatar } = await server.ssrLoadModule('/src/components/SeerImages.tsx');
  const { ProportionalSprite } = await server.ssrLoadModule('/src/components/battle/ProportionalSprite.tsx');
  const { appearanceElf, startIllusion, endIllusion } = await server.ssrLoadModule('/src/battle/illusion.ts');
  const { ElfReadOnlyProfile } = await server.ssrLoadModule('/src/components/ElfReadOnlyProfile.tsx');
  const { loadSeerIndex } = await server.ssrLoadModule('/src/battle/seerAssets.ts');
  const { spriteHeightRatio } = await server.ssrLoadModule('/src/battle/spriteMetrics.ts');
  await loadSeerIndex();
  const wait = { name: '幻化圖片驗收等待', category: '屬性', type: '普通', power: 0, pp: 30, maxPp: 30, isSureHit: true, description: '' };
  const make = (id: string): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
    maxHp: 100000, currentHp: 50000, height: 50, weight: 20,
    calculatedStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 100 },
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    statStages: {}, effects: [], battleStatuses: {}, skills: [{ ...wait }] });
  for (const side of ['p1', 'p2'] as const) {
    const owner = { ...make(`owner-${side}`), path: `/illusion-owner-${side}.png`, artPresentation: 'scene',
      trait: { name: '原特性', description: '' }, category: 'C', isAlienElf: false };
    const target = { ...make(`target-${side}`), path: '/elf-art/zhakesi_fear_body.png', height: 500, artPresentation: 'sprite',
      trait: { name: '目標特性', description: '' }, category: 'S', isAlienElf: true };
    const original = structuredClone(owner);
    const ctx: any = { actor: side, get self() { return owner; }, updateElf: (_side: string, patch: any) => Object.assign(owner, patch), addLog() {} };
    assert.equal(startIllusion(ctx, target, '顯示契約'), true);
    assert.equal(owner.path, original.path, '戰鬥本體不覆寫原圖路徑');
    assert.equal(appearanceElf(owner).path, target.path);
    assert.equal(appearanceElf(owner).artPresentation, 'sprite', '不繼承原圖場景遮罩');
    assert.equal(owner.battleId, original.battleId);
    const profile = structuredClone(owner);
    profile.skills[0].name = `原槽技能-${side}`;
    profile.illusion.target.skills[0].name = `取得技能-${side}`;
    profile.illusion.target.type = '龍';
    await act(async () => root.render(React.createElement(ElfReadOnlyProfile, { key: `own-${side}`, elf: profile, battleSide: 'p1', onClose() {} })));
    assert.ok(document.body.textContent!.includes('原特性'));
    assert.ok(document.body.textContent!.includes('目標特性'));
    assert.ok(document.body.textContent!.includes('幻化取得'));
    await act(async () => [...document.querySelectorAll('nav button')].find(b => b.textContent === '技能')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    assert.ok(document.body.textContent!.includes(`原槽技能-${side}`));
    assert.ok(document.body.textContent!.includes(`轉化 → 取得技能-${side}`));
    await act(async () => root.render(React.createElement(ElfReadOnlyProfile, { key: `enemy-${side}`, elf: profile, battleSide: 'p2', onClose() {} })));
    assert.ok(!document.body.textContent!.includes('原特性'), '敵方介紹不洩漏原特性');
    assert.ok(document.body.textContent!.includes('目標特性'));
    assert.ok(document.body.textContent!.includes('龍'), '敵方幻化介紹顯示複製對象屬性');
    checks++;
    for (const kind of ['head', 'body']) {
      await act(async () => root.render(React.createElement(ElfAvatar, { elf: owner, kind, battleSide: side })));
      assert.ok(image().src.endsWith(target.path), `${side}/${kind}直接傳戰鬥本體仍須幻化換圖`);
      assert.equal(image().alt, target.name);
      assert.equal(image().style.maskImage, '', '目標非場景，不得沿用原場景遮罩');
      if (kind === 'body') assert.equal(image().style.transform, side === 'p2' ? 'scaleX(-1)' : '');
      checks++;
    }
    const spriteProps = { elf: owner, side, anchorX: 200, stageW: 600, stageH: 600, anim: {}, dead: false, opacity: 1, overlay: () => null };
    await act(async () => root.render(React.createElement(ProportionalSprite, spriteProps)));
    await loaded();
    const wrapper = document.querySelector<HTMLElement>('[data-sprite-side]')!;
    assert.equal(wrapper.dataset.spriteRatio, spriteHeightRatio(500).toFixed(2));
    const targetWidth = image().parentElement!.style.width;
    // 同圖換陣營，非對稱透明邊界也需重新計算錨點。
    const leftBefore = image().parentElement!.style.left;
    const other = side === 'p1' ? 'p2' : 'p1';
    await act(async () => root.render(React.createElement(ProportionalSprite, { ...spriteProps, side: other })));
    await loaded();
    assert.equal(image().style.transform, other === 'p2' ? 'scaleX(-1)' : '');
    assert.notEqual(image().parentElement!.style.left, leftBefore, '同圖反轉後可見中心位置須更新');
    owner.calculatedStats.atk += 25;
    owner.maxHp += 500; owner.currentHp = 150000;
    assert.equal(endIllusion(ctx), true);
    assert.equal(owner.maxHp, original.maxHp + 500, '保留期間獨立取得的上限變化');
    assert.equal(owner.currentHp, owner.maxHp, '解除不虛補血；超過解除後上限才收斂');
    assert.equal(owner.calculatedStats.atk, original.calculatedStats.atk + 25);
    assert.deepEqual(owner.trait, original.trait); assert.equal(owner.category, 'C'); assert.equal(owner.isAlienElf, false);
    assert.deepEqual(owner.skills, original.skills);
    await act(async () => root.render(React.createElement(ProportionalSprite, spriteProps)));
    await loaded();
    assert.ok(image().src.endsWith(original.path), '同一戰鬥身分解除後還原原立繪');
    assert.equal(image().alt, original.name);
    assert.equal(wrapper.dataset.spriteRatio, spriteHeightRatio(50).toFixed(2));
    assert.notEqual(image().parentElement!.style.width, targetWidth, '解除重新計算原身高比例');
    assert.ok(image().style.maskImage.includes('radial-gradient'), '還原原場景遮罩（瀏覽器可正規化省略ellipse關鍵字）');
    await act(async () => root.render(React.createElement(ElfAvatar, { elf: owner, kind: 'head', battleSide: side })));
    assert.ok(image().src.endsWith(original.path), '解除後頭像也還原'); checks++;

    // 身分不能決定幻化目標的雷伊頭像遮罩。
    const rey = { ...make('5029'), name: '異境神霆·雷伊', path: undefined };
    const ctxRey: any = { actor: side, get self() { return rey; }, updateElf: (_s: string, p: any) => Object.assign(rey, p), addLog() {} };
    startIllusion(ctxRey, target, '雷伊外觀契約');
    await act(async () => root.render(React.createElement(ElfAvatar, { elf: rey, kind: 'head', battleSide: side })));
    assert.equal(image().style.objectPosition, '', '雷伊幻化為其他精靈不套雷伊頭像裁切');
    const mimic = make('mimic'); const mimicCtx: any = { actor: side, get self() { return mimic; }, updateElf: (_s: string, p: any) => Object.assign(mimic, p), addLog() {} };
    endIllusion(ctxRey); startIllusion(mimicCtx, rey, '目標雷伊外觀');
    await act(async () => root.render(React.createElement(ElfAvatar, { elf: mimic, kind: 'head', battleSide: side })));
    assert.ok(image().src.endsWith('/otherworld_thunder_rey_head.png')); assert.equal(image().style.objectPosition, '50% 44%'); checks++;
  }

  // 真正BattleScreen：星贖會延長星異常，先由正式技能消除，魂印自行解除幻化。
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  let driver: any;
  async function turn() {
    const before = driver.getSyncState().turnNumber;
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let n = 0; n < 300 && driver.getSyncState().turnNumber === before; n++) await settle();
    assert.equal(driver.getSyncState().turnNumber, before + 1);
  }
  for (const side of ['p1', 'p2'] as const) for (const id of ['5032', '5033']) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const seed = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === id)); assert.ok(seed);
    const self = { ...seed, ...make(id), name: seed.name, soulMark: seed.soulMark,
      path: undefined, skills: [{ ...wait }], height: 50 };
    self.calculatedStats.speed = 1000; // 固定先出手，避免後手吸取殺死圖片驗收目標而轉入勝敗介面。
    const target = { ...make(`visual-target-${side}-${id}`), height: 500, path: '/elf-art/zhakesi_fear_body.png' };
    self.initialCounterpart = structuredClone(target);
    const bench = { ...make(`visual-bench-${side}-${id}`), path: `/visual-bench-${side}-${id}.png` };
    const originalStats = structuredClone(self.calculatedStats);
    await act(async () => root.render(React.createElement(Battle, { key: `${side}-${id}`,
      initialP1Team: side === 'p1' ? [self, bench] : [target], initialP2Team: side === 'p2' ? [self, bench] : [target],
      p1StarterId: side === 'p1' ? self.id : target.id, p2StarterId: side === 'p2' ? self.id : target.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu() {}, onDriverInit: (d: any) => driver = d })));
    let state = driver.getSyncState(); assert.ok(state[side].illusion);
    const head = `[data-hud="${side}"] button img`, body = `[data-sprite-side="${side}"] img`;
    assert.ok(image(head).src.endsWith(target.path)); assert.ok(image(body).src.endsWith(target.path));
    assert.equal(image(body).style.transform, side === 'p2' ? 'scaleX(-1)' : '');
    assert.equal(document.querySelector<HTMLElement>(`[data-sprite-side="${side}"]`)!.dataset.spriteRatio, spriteHeightRatio(500).toFixed(2));
    if (id === '5033') {
      assert.equal(state[side].globalPpMaxOffset, 10);
      // 只設解除前置條件，正式ENFORCE派發及endIllusion仍由引擎處理。
      const probe = `幻化解除條件-${side}`;
      getBattleSkillRegistry()[probe] = (c: any) => {
        c.setOpponentState('fieldDamageCounts', { skill: 5, fixed: 5, percent: 5, true: 5 });
        c.setOpponentState('fieldStatusCount', 5);
        c.setOpponentState('teamEntranceHistory', { [c.target.battleId || c.target.id]: 6 });
      };
      state[other].skills[0].name = probe;
    } else {
      await turn();
      assert.ok(driver.getSyncState()[side].illusion, '星贖延長星異常，不能假設3回合必定解除');
      const { clearStatuses } = await server.ssrLoadModule('/src/effects/semanticOperations.ts');
      const probe = `幻化星異常消除-${side}`;
      getBattleSkillRegistry()[probe] = (c: any) => clearStatuses(c, c.targetSide, c.target, (name: string) => name === '星贖');
      driver.getSyncState()[other].skills[0].name = probe;
    }
    for (let n = 0; n < 4 && driver.getSyncState()[side].illusion; n++) await turn();
    state = driver.getSyncState(); assert.equal(state[side].illusion, undefined, `${id}正式魂印解除：${JSON.stringify({ turn: state.turnNumber, effects: state[side].effects, statuses: state[side].battleStatuses, registry: state[`${side}RegistryState`] })}`);
    assert.equal(state[side].name, self.name); assert.deepEqual(state[side].calculatedStats, originalStats);
    assert.equal(state[side].maxHp, self.maxHp); assert.equal(state[side].globalPpMaxOffset || 0, 0);
    assert.ok(state[side].currentHp <= self.maxHp); assert.equal(state[side].skills[0].name, wait.name);
    const art = id === '5032' ? 79 : 418;
    assert.ok(image(head).src.endsWith(`/seer/head/${art}.png`), `${id}頭像還原原圖`);
    assert.ok(image(body).src.endsWith(`/seer/body/${art}.png`), `${id}立繪還原原圖`);
    assert.equal(image(body).style.transform, side === 'p1' ? 'scaleX(-1)' : '', '還原朝左原圖：P1朝右、P2朝左');
    assert.equal(document.querySelector<HTMLElement>(`[data-sprite-side="${side}"]`)!.dataset.spriteRatio, spriteHeightRatio(50).toFixed(2));
    await act(async () => {
      // PVP依序選指令；P2換人須等P1已提交，不可從p1_select硬呼叫冒充實際UI。
      if (side === 'p2') driver.onSkillSelect(other, driver.getSyncState()[other].skills[0]);
      driver.onSwitchElf(side, 1);
      if (side === 'p1') driver.onSkillSelect(other, driver.getSyncState()[other].skills[0]);
    });
    for (let n = 0; n < 300 && driver.getSyncState()[side].battleId !== bench.battleId; n++) await settle();
    assert.equal(driver.getSyncState()[side].battleId, bench.battleId, JSON.stringify({ phase: driver.getSyncState().phase, winner: driver.getSyncState().winner, own: driver.getSyncState()[side].currentHp, foe: driver.getSyncState()[other].currentHp, logs: driver.getSyncState().logs.slice(-8) }));
    assert.equal(driver.getSyncState()[side].illusion, undefined);
    assert.ok(image(head).src.endsWith(bench.path)); assert.ok(image(body).src.endsWith(bench.path));
    checks++;
  }
  // 仍在幻化時下場：一般切換與驅逐均須先還原；驅逐不冒充登場／下場事件。
  for (const side of ['p1', 'p2'] as const) for (const id of ['5032', '5033']) for (const expelled of [false, true]) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const seed = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === id));
    const self = { ...seed, ...make(id), name: seed.name, soulMark: seed.soulMark, skills: [{ ...wait, pp: 30, maxPp: 30 }] };
    const target = { ...make(`departure-target-${side}-${id}`), path: '/elf-art/zhakesi_fear_body.png' };
    self.initialCounterpart = structuredClone(target);
    self.calculatedStats.speed = 1000;
    const bench = { ...make(`departure-bench-${side}-${id}`), path: `/departure-bench-${side}-${id}.png` };
    const originalStats = structuredClone(self.calculatedStats);
    await act(async () => root.render(React.createElement(Battle, { key: `${side}-${id}-${expelled}-departure`,
      initialP1Team: side === 'p1' ? [self, bench] : [target], initialP2Team: side === 'p2' ? [self, bench] : [target],
      p1StarterId: side === 'p1' ? self.id : target.id, p2StarterId: side === 'p2' ? self.id : target.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu() {}, onDriverInit: (d: any) => driver = d })));
    assert.ok(driver.getSyncState()[side].illusion);
    if (expelled) {
      const probe = `幻化驅逐探針-${side}-${id}`;
      getBattleSkillRegistry()[probe] = (c: any) => assert.equal(c.expel(c.targetSide), true);
      driver.getSyncState()[other].skills[0].name = probe;
      await turn();
    } else {
      const before = driver.getSyncState().turnNumber;
      await act(async () => {
        if (side === 'p2') driver.onSkillSelect(other, driver.getSyncState()[other].skills[0]);
        driver.onSwitchElf(side, 1);
        if (side === 'p1') driver.onSkillSelect(other, driver.getSyncState()[other].skills[0]);
      });
      for (let n = 0; n < 300 && driver.getSyncState().turnNumber === before; n++) await settle();
    }
    const state = driver.getSyncState(), departed = state[`${side}Team`][0];
    assert.equal(state[side].battleId, bench.battleId);
    assert.equal(departed.illusion, undefined, `${id}/${side}/${expelled ? '驅逐' : '切換'}下場解除`);
    assert.deepEqual(departed.calculatedStats, originalStats); assert.equal(departed.maxHp, self.maxHp);
    assert.equal(departed.globalPpMaxOffset || 0, 0); assert.ok(departed.skills[0].pp <= 30, '解除暫時PP上限後收斂');
    assert.equal(state[side].skills[0].name, wait.name); assert.equal(state[side].maxHp, bench.maxHp);
    assert.equal(state[side].illusion, undefined);
    assert.ok(image(`[data-sprite-side="${side}"] img`).src.endsWith(bench.path));
    checks++;
  }
  assert.equal(errors.length, 0, '顯示／註冊表錯誤不能被吞掉算通過');
  console.log(`幻化圖片／解除還原：${checks}個雙側DOM情境通過；含正式魂印解除、換人隔離、頭像立繪、朝向與比例。不含真實圖片下載或像素外觀驗收。`);
} finally { console.error = originalError; await act(async () => root.unmount()); await server.close(); dom.window.close(); }
