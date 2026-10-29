import assert from 'node:assert/strict';
import { homeStaticVisibleRect, type OpaqueBox } from '../src/battle/spriteMetrics';

// 新版首頁動態立繪：以靜態圖不透明區域定位／定大小，不再填滿容器。
const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}：${a} vs ${b}`);

// 1000×1000 圖，不透明區域 200..800 × 100..900；容器 400×300（contain → 縮放 0.3，圖 300×300，左右各留 50）。
const box: OpaqueBox = { w: 1000, h: 1000, left: 200, top: 100, right: 800, bottom: 900 };
const r = homeStaticVisibleRect(box, 400, 300, 'contain');
near(r.width, 180, '可見寬'); near(r.height, 240, '可見高');
near(r.left, 110, '左緣'); near(r.right, 290, '右緣'); near(r.top, 30, '上緣'); near(r.bottom, 270, '下緣（腳底）');
near(r.centerX, 200, '水平中心'); near(r.bottomOffset, 30, '腳底離容器底');
assert.ok(r.width < 400 && r.height < 300, '必須小於容器：舊版直接填滿容器，比靜態圖大');

// cover：以較大縮放填滿並被容器裁切；矩形不得超出容器。
const c = homeStaticVisibleRect(box, 400, 300, 'cover');
assert.ok(c.left >= 0 && c.right <= 400 && c.top >= 0 && c.bottom <= 300, 'cover 的可見矩形限制在容器內');
assert.ok(c.height > r.height, 'cover 比 contain 大');

// 全不透明圖（量測失敗時的整張圖框）：contain 時等於圖被縮放後的完整範圍。
const full = homeStaticVisibleRect({ w: 500, h: 250, left: 0, top: 0, right: 500, bottom: 250 }, 1000, 1000, 'contain');
near(full.width, 1000, '全圖寬'); near(full.height, 500, '全圖高'); near(full.bottomOffset, 250, '垂直置中時腳底離容器底');

// 退化輸入不得產生 0／NaN。
const tiny = homeStaticVisibleRect({ w: 0, h: 0, left: 0, top: 0, right: 0, bottom: 0 }, 100, 100);
assert.ok([tiny.width, tiny.height, tiny.centerX, tiny.bottomOffset].every(Number.isFinite) && tiny.width >= 1 && tiny.height >= 1);
console.log('新版首頁動態立繪對位規則通過');
