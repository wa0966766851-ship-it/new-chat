/**
 * 2026-11-24 未命名異常圖示（裂鏡多手意象）呈現驗收：
 * 只註冊圖示、不接入 StatusRegistry、不影響任何戰鬥判定。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { statusVisual, UNKNOWN_EFFECT_ICON } = await server.ssrLoadModule('/src/battle/effectIcons.ts');
  const visual = statusVisual('未命名異常');
  assert.ok(visual, '未命名異常有視覺設定');
  assert.equal(visual!.icon, '/status-icons/未命名異常.png', '圖示路徑正確');
  assert.notEqual(visual!.icon, UNKNOWN_EFFECT_ICON, '不是佔位圖');
  const file = resolve('public', 'status-icons', '未命名異常.png');
  assert.ok(existsSync(file), '圖示檔存在');
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', '是有效 PNG');
  // 未接入規則：未知的異常名仍回 null（不因這張圖而憑空多一個狀態）
  assert.equal(statusVisual('不存在異常XYZ'), null, '不建立新異常規則');
  console.log('未命名異常圖示：呈現註冊通過（不影響戰鬥規則）');
} finally {
  await server.close();
}
