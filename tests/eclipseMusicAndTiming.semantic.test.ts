import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldAutoplayOnEnter, AUTOPLAY_SCENES } from '../src/utils/musicAutoplay';
import { POPUP_HOLD_MS, popupHoldMs, POPUP_HOLD_MIN_RATIO } from '../src/battle/presentation';

// 2026-11-08：星蝕回廊進入自動播放、跳字節奏、回廊場景頂列不被殼層工具鈕蓋住、開戰鎖解除。
assert.deepEqual([...AUTOPLAY_SCENES], ['interstellar_exploration', 'eclipse_battle']);
assert.equal(shouldAutoplayOnEnter('start', 'interstellar_exploration', true), true, '進入回廊大廳自動播放');
assert.equal(shouldAutoplayOnEnter('interstellar_exploration', 'eclipse_battle', true), false, '大廳→回廊戰鬥不重複觸發');
assert.equal(shouldAutoplayOnEnter('battle', 'eclipse_battle', true), true);
assert.equal(shouldAutoplayOnEnter('start', 'interstellar_exploration', false), false, '設定關閉時不播');
assert.equal(shouldAutoplayOnEnter(null, 'start', true), false, '其他頁不自動播');
const hub = readFileSync('src/components/ControlHub.tsx', 'utf8'), panel = readFileSync('src/components/ControlHubPanel.tsx', 'utf8');
assert.match(hub, /shouldAutoplayOnEnter\(prev, currentScene, autoplay\)/); assert.match(panel, /data-testid="music-autoplay"/);
assert.match(readFileSync('electron/main.cjs', 'utf8'), /autoplayPolicy: "no-user-gesture-required"/, '桌面版允許自動播放');

// 跳字：單筆 ≤ 1.1 秒（含退場），批次遞減但不低於 60%
assert.ok(POPUP_HOLD_MS.skill + POPUP_HOLD_MS.exit <= 1100 && POPUP_HOLD_MS.other + POPUP_HOLD_MS.exit <= 900);
assert.ok(POPUP_HOLD_MS.skill >= 700 && POPUP_HOLD_MS.other >= 500, '仍需看得清楚（進場 280ms＋辨識）');
assert.equal(popupHoldMs(true, 0), POPUP_HOLD_MS.skill); assert.ok(popupHoldMs(false, 2) < popupHoldMs(false, 0));
assert.equal(popupHoldMs(false, 20), Math.round(POPUP_HOLD_MS.other * POPUP_HOLD_MIN_RATIO));

// 回廊場景：生命／背包不再 fixed（覆蓋層有 backdrop-filter，fixed 會落到殼層右上工具鈕下）；開戰鎖有解除保險
const run = readFileSync('src/components/InterstellarExploration/InterstellarRun.tsx', 'utf8');
assert.ok(!/className="fixed right-4 top-4/.test(run) && !/fixed right-\[4\.5rem\]/.test(run));
assert.match(run, /data-testid="scene-topbar"/); assert.match(run, /pr-\[var\(--control-hub-safe,13rem\)\]/);
assert.match(run, /setTimeout\(\(\) => \{ busy\.current = false; \}, 4000\)/);
console.log('星蝕回廊自動播放、跳字節奏、場景頂列避開殼層工具鈕、開戰鎖保險：通過');
