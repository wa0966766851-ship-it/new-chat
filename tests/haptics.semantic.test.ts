import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

/**
 * 觸覺回饋測試
 *
 * 為什麼要測：
 *   navigator.vibrate 在多數環境不存在（iOS Safari 完全不支援），
 *   寫錯會直接拋錯讓整個元件崩掉。這裡鎖住「所有情況都優雅降級」。
 *
 * 三個必測條件：
 *   1. 沒支援 → 回 false，不拋錯
 *   2. 使用者關閉 → 不震
 *   3. prefers-reduced-motion → 不震（與 motion.css 同一原則）
 */

const dom = new JSDOM('', { url: 'http://localhost:3000/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const {
  haptic, isHapticsEnabled, setHapticsEnabled, toggleHaptics,
} = await import('../src/shell/haptics');

const ls = dom.window.localStorage;

// ── 1. 瀏覽器不支援 vibrate → 回 false，不拋錯 ──
{
  ls.clear();
  // jsdom 的 navigator 沒有 vibrate
  assert.equal(typeof (dom.window.navigator as any).vibrate, 'undefined', '前提：jsdom 沒有 vibrate');
  assert.doesNotThrow(() => haptic('light'), '沒有 vibrate 時不能拋錯');
  assert.equal(haptic('light'), false, '沒有 vibrate 應回 false');
  assert.equal(haptic('heavy'), false);
}

// ── 2. 支援 vibrate → 依強度給不同 pattern ──
{
  ls.clear();
  const calls: any[] = [];
  (dom.window.navigator as any).vibrate = (p: any) => { calls.push(p); return true; };
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

  haptic('light');
  haptic('medium');
  haptic('heavy');

  assert.equal(calls.length, 3, '三次呼叫都要真的震');
  assert.equal(calls[0], 8, 'light = 8ms');
  assert.equal(calls[1], 16, 'medium = 16ms');
  assert.deepEqual(calls[2], [12, 40, 18], 'heavy = 三段式');
  // 強度必須遞增（light < medium）
  assert.ok(calls[0] < calls[1], 'light 應短於 medium');
}

// ── 3. 使用者關閉 → 不震 ──
{
  ls.clear();
  const calls: any[] = [];
  (dom.window.navigator as any).vibrate = (p: any) => { calls.push(p); return true; };

  assert.equal(isHapticsEnabled(), true, '預設開啟');
  setHapticsEnabled(false);
  assert.equal(isHapticsEnabled(), false, '關閉後讀回 false');

  haptic('medium');
  assert.equal(calls.length, 0, '關閉時不得震動');

  setHapticsEnabled(true);
  haptic('medium');
  assert.equal(calls.length, 1, '重新開啟後可以震');
}

// ── 4. toggleHaptics ──
{
  ls.clear();
  assert.equal(isHapticsEnabled(), true);
  assert.equal(toggleHaptics(), false, '第一次 toggle 關閉');
  assert.equal(isHapticsEnabled(), false);
  assert.equal(toggleHaptics(), true, '第二次 toggle 開啟');
  assert.equal(isHapticsEnabled(), true);
}

// ── 5. prefers-reduced-motion → 不震 ──
{
  ls.clear();
  const calls: any[] = [];
  (dom.window.navigator as any).vibrate = (p: any) => { calls.push(p); return true; };

  // jsdom 的 matchMedia 需要自己 stub
  const originalMatchMedia = dom.window.matchMedia;
  (dom.window as any).matchMedia = (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  haptic('medium');
  assert.equal(calls.length, 0, 'reduced-motion 時不得震動');

  (dom.window as any).matchMedia = originalMatchMedia;
  haptic('medium');
  assert.equal(calls.length, 1, '還原後可以震');
}

// ── 6. localStorage 壞掉 → 預設開啟，不拋錯 ──
{
  const original = ls.getItem;
  (ls as any).getItem = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => isHapticsEnabled(), '讀取失敗不能拋錯');
  assert.equal(isHapticsEnabled(), true, '讀取失敗時預設開啟');
  (ls as any).getItem = original;
}

console.log('觸覺回饋：降級、強度分級、開關、reduced-motion、容錯 通過');
