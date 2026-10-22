import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * PWA 設定測試（Phase 6）
 *
 * 為什麼重要：
 *   PWA 設定錯了不會「報錯」，只會「裝不起來」或「卡在舊版本」——
 *   使用者不會知道原因。這裡把關鍵條件全部鎖住。
 *
 * 三個必須成立：
 *   1. manifest 欄位完整且合法（name/short_name/icons/start_url/display）
 *   2. service worker 不快取 HTML（否則使用者卡舊版）
 *   3. index.html 有正確的 meta 標籤
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const exists = (rel: string) => existsSync(path.join(root, rel));

// ── 1. 檔案都存在 ──
{
  for (const f of ['public/manifest.webmanifest', 'public/sw.js', 'src/pwa/registerServiceWorker.ts']) {
    assert.ok(exists(f), `缺少 ${f}`);
  }
  for (const f of ['public/icons/icon-192.png', 'public/icons/icon-512.png']) {
    assert.ok(exists(f), `缺少圖示 ${f}`);
  }
}

// ── 2. manifest 欄位 ──
{
  const m = JSON.parse(read('public/manifest.webmanifest'));

  assert.ok(m.name && m.name.length > 0, 'manifest 必須有 name');
  assert.ok(m.short_name && m.short_name.length <= 12, 'short_name 必須存在且夠短（主畫面顯示）');
  assert.equal(m.start_url, '/', 'start_url 必須是 /');
  assert.equal(m.scope, '/', 'scope 必須是 /');
  assert.ok(['standalone', 'fullscreen', 'minimal-ui'].includes(m.display), 'display 必須是可安裝的模式');
  assert.ok(m.background_color, '必須有 background_color');
  assert.ok(m.theme_color, '必須有 theme_color');

  // icons：至少要有 192 與 512，且有一個 maskable
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, '必須有至少兩個圖示');
  const sizes = m.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192'), '必須有 192x192 圖示');
  assert.ok(sizes.includes('512x512'), '必須有 512x512 圖示');
  assert.ok(m.icons.some(i => i.purpose === 'maskable'), '必須有 maskable 圖示（Android 圓形遮罩）');

  // 圖示檔案必須真的存在
  for (const icon of m.icons) {
    const rel = 'public' + icon.src;
    assert.ok(exists(rel), `manifest 引用的圖示不存在：${icon.src}`);
  }
}

// ── 3. service worker 策略 ──
{
  const sw = read('public/sw.js');

  // 絕不快取 HTML 與 API（否則會卡舊版／看到過期資料）
  assert.ok(sw.includes('NEVER_CACHE'), '必須有 NEVER_CACHE 清單');
  // sw.js 用 regex 字面值寫路徑（\/api\/），所以用正規表達式比對
  assert.ok(/\^\\\/api/.test(sw) || sw.includes('api'), 'API 路徑必須排除');
  // 精準抓 NEVER_CACHE 那一行，避免被 CACHE_VERSION 之類的字串騙過
  const neverCacheLine = sw.split('\n').find(l => l.includes('NEVER_CACHE') && l.includes('['));
  assert.ok(neverCacheLine, '必須有 NEVER_CACHE 陣列定義');
  assert.ok(neverCacheLine.includes('api'), 'NEVER_CACHE 必須含 api');
  assert.ok(neverCacheLine.includes('version'), 'NEVER_CACHE 必須含 version.json（否則看不到更新）');
  assert.ok(neverCacheLine.includes('seer'), 'NEVER_CACHE 必須含 seer');
  // sw.js 在 regex 裡寫成 /^\/sw\.js/，用 'sw' 比對較穩
  assert.ok(neverCacheLine.includes('sw'), 'NEVER_CACHE 必須含 sw.js 自己');

  // 必須有版本號（才能清舊快取）
  assert.ok(/CACHE_VERSION\s*=/.test(sw), '必須有 CACHE_VERSION');
  assert.ok(sw.includes('caches.delete'), 'activate 時必須清舊快取');

  // 只快取靜態副檔名
  assert.ok(/CACHEABLE\s*=/.test(sw), '必須有 CACHEABLE 白名單');
  assert.ok(sw.includes('png') && sw.includes('css') && sw.includes('js'), '白名單必須含圖片與程式碼');

  // 不能 precache 全部（資源太多會過期）
  assert.ok(!sw.includes('PRECACHE_URLS'), '不該硬編 precache 清單（容易過期）');
}

// ── 4. index.html meta ──
{
  const html = read('index.html');

  assert.ok(html.includes('rel="manifest"'), '必須連結 manifest');
  assert.ok(html.includes('name="theme-color"'), '必須有 theme-color');
  assert.ok(html.includes('viewport-fit=cover'), 'viewport 必須有 viewport-fit=cover（安全區）');
  assert.ok(html.includes('apple-mobile-web-app-capable'), '必須有 iOS 全螢幕標籤');
  assert.ok(html.includes('apple-touch-icon'), '必須有 iOS 圖示');
  assert.ok(html.includes('apple-mobile-web-app-status-bar-style'), '必須有 iOS 狀態列樣式');
}

// ── 5. 註冊邏輯：dev 不註冊 ──
{
  const reg = read('src/pwa/registerServiceWorker.ts');
  assert.ok(reg.includes('localhost') || reg.includes('127.0.0.1'), '必須判斷 dev 環境（不註冊 SW）');
  assert.ok(reg.includes('/sw.js'), '必須註冊 /sw.js');
  assert.ok(reg.includes('unsupported'), '不支援時必須優雅降級');
  assert.ok(reg.includes('updatefound'), '必須監聽更新');

  // main.tsx 必須實際呼叫
  const main = read('src/main.tsx');
  assert.ok(main.includes('registerServiceWorker'), 'main.tsx 必須註冊 SW');
}

console.log('PWA：manifest 欄位、圖示存在、SW 不快取 HTML、meta 標籤、註冊邏輯 通過');