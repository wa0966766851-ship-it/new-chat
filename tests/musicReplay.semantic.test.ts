import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('', { url: 'http://localhost/' });
Object.assign(globalThis, { localStorage: dom.window.localStorage });
const { readMusicReplay, writeMusicReplay, bilibiliReplayDelayMs, DEFAULT_REPLAY_GAP } = await import('../src/utils/musicReplay');
const { registerMusicMeta } = await import('../server/musicMeta');
const { youtubeEmbedUrl } = await import('../src/utils/musicSource');

// 2026-11-08：背景音樂播完停幾秒再重播（預設開、5 秒）
assert.deepEqual(readMusicReplay(), { enabled: true, gap: DEFAULT_REPLAY_GAP });
writeMusicReplay({ enabled: false, gap: 99 }); assert.deepEqual(readMusicReplay(), { enabled: false, gap: 60 }, '間隔上限 60 秒');
writeMusicReplay({ enabled: true, gap: -3 }); assert.equal(readMusicReplay().gap, 0);
assert.equal(bilibiliReplayDelayMs(120, 5), 125000); assert.equal(bilibiliReplayDelayMs(0, 5), null); assert.equal(bilibiliReplayDelayMs(undefined, 5), null);
// YouTube：自訂重播時不用 YouTube 立即循環
assert.match(youtubeEmbedUrl({ type: 'youtube', id: 'abcdefghijk' } as any, 'http://x', false), /loop=0/);
assert.match(youtubeEmbedUrl({ type: 'youtube', id: 'abcdefghijk' } as any, 'http://x'), /loop=1/);
// 後端：B站分P長度查詢、格式檢查、快取、失敗回 502
let handler: any; const app: any = { get: (_p: string, h: any) => { handler = h; } };
let calls = 0;
registerMusicMeta(app, (async () => { calls++; return { json: async () => ({ data: { duration: 300, pages: [{ duration: 180 }, { duration: 240 }] } }) }; }) as any);
const call = async (bvid: string, p?: number) => { let code = 200, body: any; await handler({ params: { bvid }, query: { p } }, { status(c: number) { code = c; return this; }, json(b: any) { body = b; return this; } }); return { code, body }; };
assert.deepEqual(await call('BV1QM836hEBB', 2), { code: 200, body: { duration: 240 } });
await call('BV1QM836hEBB', 2); assert.equal(calls, 1, '同一分P 快取');
assert.equal((await call('not-a-bv')).code, 400);
registerMusicMeta(app, (async () => { throw new Error('offline'); }) as any); assert.equal((await call('BV1QM836hEBB', 1)).code, 502);
// 接線
const hook = readFileSync('src/components/useMusicPlayer.ts', 'utf8');
assert.match(hook, /state === 0 && replayRef\.current\.enabled && desired\.current\.playing/); assert.match(hook, /\/api\/music\/bilibili-duration\//);
assert.match(readFileSync('server.ts', 'utf8'), /registerMusicMeta\(app\)/);
assert.match(readFileSync('src/components/ControlHubPanel.tsx', 'utf8'), /data-testid="music-replay-gap"/);
console.log('背景音樂播完間隔重播：設定、B站長度計時、YouTube 結束事件、後端查詢與快取通過');
process.exit(0);
