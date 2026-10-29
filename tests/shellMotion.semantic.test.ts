import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Aegis 動效無障礙測試
 *
 * 為什麼重要：
 *   Aegis 有 6 處持續動畫（軌道環旋轉 48s、掃描線 11s、抽屜滑入…），
 *   在 2026-10-21 之前**完全沒有 respects prefers-reduced-motion**。
 *   前庭功能敏感者會因持續動態不適 —— 這是無障礙底線，不是「打磨」。
 *
 * 判定原則（與 Legacy 的 index.css 一致）：
 *   reduce 時「保留狀態變化，取消位移與循環」，不是整個關掉。
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

const css = read('src/shell/art/motion.css');

// ── 1. 必須有 reduced-motion 媒體查詢 ──
{
  assert.ok(
    css.includes('@media (prefers-reduced-motion: reduce)'),
    '必須有 prefers-reduced-motion: reduce 媒體查詢',
  );
}

// ── 2. 必須限定在 #aegis-shell（不影響 Legacy） ──
{
  const reduceBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  const rules = reduceBlock.split('\n').filter(l => l.trim().endsWith('{'));
  for (const rule of rules) {
    if (!rule.includes('#')) continue;
    assert.ok(
      rule.includes('#aegis-shell'),
      `reduced-motion 規則必須限定在 #aegis-shell：${rule.trim()}`,
    );
  }
}

// ── 3. 動畫必須被縮到極短（保留狀態變化，不晃動） ──
{
  assert.ok(
    /animation-duration:\s*0\.001ms\s*!important/.test(css),
    '動畫時長必須縮到 0.001ms',
  );
  assert.ok(
    /animation-iteration-count:\s*1\s*!important/.test(css),
    '動畫不得循環',
  );
  assert.ok(
    /transition-duration:\s*0\.001ms\s*!important/.test(css),
    '轉場時長必須縮到 0.001ms',
  );
}

// ── 4. 軌道環與掃描線要特別處理 ──
{
  assert.ok(css.includes('aegisSpin'), '軌道環旋轉必須被停掉');
  assert.ok(css.includes('aegisScan'), '掃描線必須被處理');
  assert.ok(css.includes('drawerUp'), '抽屜滑入必須被處理');
}

// ── 5. 按壓縮放要取消（避免手指移動時畫面跟著晃） ──
{
  assert.ok(
    css.includes('active:scale') || css.includes('button:active'),
    '按壓縮放必須被取消',
  );
}

// ── 6. 必須被 AegisShell 實際引入（寫了沒引入等於沒做） ──
{
  const shell = read('src/shell/AegisShell.tsx');
  assert.ok(
    shell.includes('motion.css'),
    'AegisShell 必須引入 motion.css',
  );
}

// ── 7. 脈衝光點要停止閃爍 ──
{
  assert.ok(
    css.includes('animate-pulse'),
    '脈衝光點必須停止閃爍',
  );
}

console.log('Aegis 動效：reduced-motion 覆蓋、作用域、循環停止、按壓取消 通過');
