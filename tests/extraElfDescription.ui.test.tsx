// 額外精靈（炫彩山神）的詳情介紹不是空的：魂印顯示原文三段（額外精靈／被加入時／進入死亡時）。
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { ElfReadOnlyProfile } = await server.ssrLoadModule('/src/components/ElfReadOnlyProfile.tsx');
  const { createExtraElf } = await server.ssrLoadModule('/src/utils/extraElf.ts');
  const { extraElfKitByName, extraElfSoulMarkByName } = await server.ssrLoadModule('/src/blocks/ops/brinkk.ts');
  const { SHANCAISHEN_DESCRIPTION } = await server.ssrLoadModule('/src/data/migratedShancaishenKit.ts');
  const base: any = { id: '5041', battleId: 'cas', name: '岳峙淵渟.卡修斯', type: '聖靈.地面', level: 100, currentHp: 100, maxHp: 100, calculatedStats: { hp: 100, atk: 1, def: 1, spatk: 1, spdef: 1, speed: 1 }, baseStats: {}, skills: [], statStages: {} };
  // 與 summon_extra_elf 相同的組裝：Kit 與魂印都由名稱查註冊表
  const extra = createExtraElf(base, { id: 'x_shancaishen', name: '炫彩山神', type: '普通', kit: extraElfKitByName('炫彩山神'), soulMark: extraElfSoulMarkByName('炫彩山神') } as any);
  assert.equal(extra.soulMark.description, SHANCAISHEN_DESCRIPTION);
  await act(async () => root.render(React.createElement(ElfReadOnlyProfile, { elf: extra, onClose: () => {}, subtitle: 'P1 · 精靈 #2' })));
  const text = document.body.textContent || '';
  for (const part of ['額外精靈炫彩山神', '炫彩山神被加入時', '炫彩山神進入死亡時', '解除自身異常狀態', '令對手在場精靈所有技能PP值歸0']) assert.ok(text.includes(part), `詳情含「${part}」`);
  assert.ok(!text.includes('其效果請見召喚者專屬魂印'), '不再是「請見召喚者」的空殼描述');
  console.log('額外精靈詳情顯示魂印原文：通過。');
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
