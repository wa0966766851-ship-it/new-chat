import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 場景轉場測試
 *
 * 背景：cues.ts 早就定義了 sceneSwap: 320ms，但從來沒被使用。
 * 這輪補上轉場，這裡鎖住三件事：
 *   1. 方向判定正確（進子頁 = 前進、回首頁 = 後退）
 *   2. 時長來自 cues.ts（單一事實來源，不寫死）
 *   3. reduced-motion 時必須被關掉
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

// ── 1. 方向判定（純函式，直接 import 測） ──
{
  const { directionFor } = await import('../src/shell/art/SceneTransition');

  assert.equal(directionFor('start', 'custom'), 'forward', '首頁 → 編成 = 前進');
  assert.equal(directionFor('start', 'bag'), 'forward', '首頁 → 背包 = 前進');
  assert.equal(directionFor('custom', 'start'), 'back', '編成 → 首頁 = 後退');
  assert.equal(directionFor('bag', 'start'), 'back', '背包 → 首頁 = 後退');
  assert.equal(directionFor('custom', 'bag'), 'forward', '子頁之間 = 前進');
  assert.equal(directionFor('start', 'start'), 'none', '同一個 view 不播');
}

// ── 2. 時長必須來自 cues.ts ──
{
  const src = read('src/shell/art/SceneTransition.tsx');
  assert.ok(!src.includes('key={`${viewKey}-${tick}`}'), '轉場不得透過 key 重建子畫面，避免背包控制器狀態遺失');
  assert.ok(src.includes('cueMs("sceneSwap")'), '時長必須從 cues.ts 取，不能寫死');
  // 只檢查「程式碼本體」，先移除註解與字串（註解提到 320 不算寫死）
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 區塊註解
    .replace(/\/\/.*$/gm, '')               // 行註解
    .replace(/`[^`]*`/g, '')                // 樣板字串（keyframes 在那裡）
    .replace(/'[^']*'/g, '');                 // 單引號字串
  assert.ok(!/\b320\b/.test(codeOnly), '不得在程式碼裡寫死 320ms');
}

// ── 3. 必須尊重 reduced-motion ──
{
  const motion = read('src/shell/art/motion.css');
  assert.ok(
    motion.includes('.aegis-scene-enter'),
    'motion.css 必須處理轉場類別',
  );
  const reduceBlock = motion.slice(motion.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(
    reduceBlock.includes('.aegis-scene-enter'),
    'reduced-motion 區塊內必須關掉轉場',
  );
  assert.ok(
    /aegis-scene-enter[^}]*animation:\s*none/.test(reduceBlock),
    'reduced-motion 時轉場動畫必須是 none',
  );
}

// ── 4. 必須真的接進 AegisShell ──
{
  const shell = read('src/shell/AegisShell.tsx');
  assert.ok(shell.includes('SceneTransition'), 'AegisShell 必須引入 SceneTransition');
  assert.ok(
    /<SceneTransition[^>]*viewKey=\{b\.view\}/.test(shell),
    '必須用 b.view 當轉場 key',
  );
  assert.ok(
    /disabled=\{b\.view === "battle"\}/.test(shell),
    '戰鬥中必須停用轉場（避免動畫疊加）',
  );
}

// ── 5. 三個 keyframes 都要存在 ──
{
  const src = read('src/shell/art/SceneTransition.tsx');
  for (const kf of ['aegisSceneInRight', 'aegisSceneInLeft', 'aegisSceneFade']) {
    assert.ok(src.includes(kf), `必須有 ${kf} keyframes`);
  }
}

console.log('場景轉場：方向判定、時長來源、reduced-motion、接線、keyframes 通過');
