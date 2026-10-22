import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Capacitor 設定測試（Phase 6）
 *
 * 為什麼要測：
 *   Capacitor 設定錯了不會在本機報錯 —— 要等到裝到手機上才發現。
 *   這裡鎖住「打包前必須成立」的條件。
 *
 * 注意：本機沒有 Android SDK，所以無法測「真的能 build APK」。
 * 這支測試只保證「設定正確」，不保證「環境齊備」。
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const exists = (rel: string) => existsSync(path.join(root, rel));

// ── 1. 設定檔存在且必要欄位正確 ──
{
  assert.ok(exists('capacitor.config.ts'), '缺少 capacitor.config.ts');

  const cfg = read('capacitor.config.ts');

  // appId 必須是反轉網域格式
  const appIdMatch = cfg.match(/appId:\s*['"]([^'"]+)['"]/);
  assert.ok(appIdMatch, '必須有 appId');
  assert.ok(
    /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/.test(appIdMatch[1]),
    `appId 必須是反轉網域格式（目前：${appIdMatch[1]}）`,
  );

  assert.ok(/appName:\s*['"][^'"]+['"]/.test(cfg), '必須有 appName');

  // webDir 必須指向 vite 的產物
  const webDirMatch = cfg.match(/webDir:\s*['"]([^'"]+)['"]/);
  assert.ok(webDirMatch, '必須有 webDir');
  assert.equal(webDirMatch[1], 'dist', 'webDir 必須是 dist（vite build 產物）');
}

// ── 2. Android 設定 ──
{
  const cfg = read('capacitor.config.ts');
  assert.ok(cfg.includes('androidScheme'), '必須設定 androidScheme（避免 mixed content）');
  assert.ok(cfg.includes("'https'") || cfg.includes('"https"'), 'androidScheme 必須是 https');
  assert.ok(cfg.includes('backgroundColor'), '必須設背景色（避免啟動白閃）');
  assert.ok(cfg.includes('#0A0C10'), '背景色必須與 PWA theme_color 一致');
}

// ── 3. webDir 的內容必須存在（build 過） ──
{
  // 允許尚未 build，但如果有 dist 就必須有 index.html
  if (exists('dist')) {
    assert.ok(exists('dist/index.html'), 'dist 存在但缺少 index.html');
    assert.ok(exists('dist/manifest.webmanifest'), 'dist 必須包含 manifest（PWA 與 Capacitor 共用）');
    assert.ok(exists('dist/icons/icon-512.png'), 'dist 必須包含 App 圖示');
  }
}

// ── 4. package.json 要有 cap 腳本 ──
{
  const pkg = JSON.parse(read('package.json'));
  const scripts = pkg.scripts || {};
  assert.ok(scripts['cap:sync'], '必須有 cap:sync 腳本');
  assert.ok(scripts['cap:android'], '必須有 cap:android 腳本');
  // cap:sync 必須先 build（否則會同步到舊的 dist）
  assert.ok(scripts['cap:sync'].includes('build'), 'cap:sync 必須先 build');
}

// ── 5. 圖示與 PWA 共用（不重複維護兩套） ──
{
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  const iconSrcs = manifest.icons.map(i => i.src);
  for (const src of iconSrcs) {
    assert.ok(exists('public' + src), `manifest 圖示不存在：${src}`);
  }
  // Capacitor 會從 dist 取圖示，所以 public 與 dist 必須一致
  if (exists('dist')) {
    for (const src of iconSrcs) {
      assert.ok(exists('dist' + src), `dist 缺少圖示：${src}`);
    }
  }
}

console.log('Capacitor：appId、webDir、Android 設定、腳本、圖示共用 通過');
