import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 真正的路由 parity 測試
 *
 * 為什麼需要它（而不是只靠 shellParity）：
 *   shellParity 檢查的是「功能註冊表本身」有沒有登記、狀態對不對。
 *   但它**不保證「舊版到得了的畫面，新版也到得了」**——
 *   那才是「舊版不得落後」的真正含義。
 *
 * 這個測試直接讀兩邊的路由原始碼，比對「view 名稱 → 有沒有分支」。
 *
 * 判定規則：
 *   1. 每個 AppView 都必須在 LegacyScenes 有分支（舊版完整）
 *   2. 每個 AppView 都必須在 Aegis 有出口：
 *      - 原生分支（AegisShell 內 b.view === "xxx"）
 *      - 或委派（AegisShell 的 else 分支渲染 LegacyScenes）
 *   3. 新增 AppView 時若兩邊都沒接，測試立刻失敗
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
assert.ok(read('src/App.tsx').includes('shellMode === "aegis" && view !== "battle"'), '新版大廳進入戰鬥時必須使用舊版戰鬥介面，保留大廳偏好');

// ── 1. 從 bridge.ts 取出 AppView 的所有成員 ──
const bridgeSrc = read('src/shell/bridge.ts');
const appViewBlock = bridgeSrc.slice(
  bridgeSrc.indexOf('export type AppView'),
  bridgeSrc.indexOf('export type BattleFormat'),
);
const appViews = [...appViewBlock.matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
assert.ok(appViews.length >= 7, `AppView 成員太少（${appViews.length}），解析可能失敗`);

// ── 2. LegacyScenes 必須有全部路由 ──
const legacySrc = read('src/shell/scenes/LegacyScenes.tsx');
const legacyViews = new Set(
  [...legacySrc.matchAll(/b\.view === "([a-z_]+)"/g)].map(m => m[1]),
);
for (const v of appViews) {
  assert.ok(
    legacyViews.has(v),
    `LegacyScenes 缺少 "\${v}" 的分支 —— 舊版會顯示空白`,
  );
}

// ── 3. AegisShell 的原生分支 ──
const aegisSrc = read('src/shell/AegisShell.tsx');
const aegisNativeViews = new Set(
  [...aegisSrc.matchAll(/b\.view === "([a-z_]+)"/g)].map(m => m[1]),
);

// ── 4. Aegis 必須有委派出口（else 分支渲染 LegacyScenes） ──
{
  assert.ok(aegisSrc.includes('LegacyScenes'), 'AegisShell 必須委派 LegacyScenes（否則未重寫的畫面會消失）');
  // 確認委派是「三元運算的 else」，不是某個分支內
  const hasFallback = /:\s*<LegacyScenes/.test(aegisSrc) || /else\s*<LegacyScenes/.test(aegisSrc);
  assert.ok(hasFallback, 'LegacyScenes 必須是 fallback（未重寫的畫面走它）');
}

// ── 5. 每個 AppView 在 Aegis 都要有出口（原生 或 委派） ──
// 有委派 fallback 時，原生沒接的會自動走 LegacyScenes，所以全部都有出口。
// 這裡列出「必須原生」的關鍵畫面，其餘可委派。
const MUST_BE_NATIVE = ['start', 'custom', 'bag'];
for (const v of MUST_BE_NATIVE) {
  assert.ok(
    aegisNativeViews.has(v),
    `Aegis 必須原生實作 "\${v}"（已交付的畫面不得退回委派）`,
  );
}

// ── 6. 反向檢查：Aegis 的原生分支必須是合法 AppView ──
for (const v of aegisNativeViews) {
  assert.ok(
    appViews.includes(v),
    `AegisShell 有 "\${v}" 的分支，但 AppView 型別裡沒有 —— 會導致 TS 錯誤或死碼`,
  );
}

// ── 7. 功能註冊表的 id 必須都是合法 AppView 或 overlay ──
{
  const featuresSrc = read('src/shell/features.ts');
  const featureIds = [...featuresSrc.matchAll(/^\s+id: "([a-z_]+)",/gm)].map(m => m[1]);
  assert.ok(featureIds.length >= 8, '功能 id 解析失敗');
  const overlays = ['encyclopedia', 'settings', 'performance_probe'];
  for (const id of featureIds) {
    const ok = appViews.includes(id) || overlays.includes(id);
    assert.ok(ok, `功能 "${id}" 不是合法 AppView，也不是 overlay`);
  }
}

console.log(
  `路由 parity：${appViews.length} 個 view 兩殼皆可達（原生 ${aegisNativeViews.size} 個、其餘委派）通過`,
);
