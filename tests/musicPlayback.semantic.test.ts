import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { parseMusicSource, youtubeEmbedUrl, youtubeErrorMessage, musicWatchUrl, type MusicSource } from '../src/utils/musicSource';
import { loadYoutubePlayerApi, type YoutubeEvents, type YoutubePlayer } from '../src/utils/youtubePlayerApi';
import { useMusicPlayer } from '../src/components/useMusicPlayer';
import { playAudioTestTone } from '../src/utils/audioTestTone';

let passed = 0;
async function check(name: string, test: () => void | Promise<void>) {
  await test(); passed++; console.log(`✓ ${name}`);
}
await check('純 YouTube ID 試聽不被換成預設曲', () => assert.deepEqual(parseMusicSource('RjYnSIzR9Bo'), { type: 'youtube', id: 'RjYnSIzR9Bo' }));
for (const url of ['https://youtu.be/RjYnSIzR9Bo', 'https://www.youtube.com/watch?v=RjYnSIzR9Bo', 'https://www.youtube.com/embed/RjYnSIzR9Bo', 'https://www.youtube.com/shorts/RjYnSIzR9Bo']) {
  await check(`影片網址解析 ${url}`, () => assert.deepEqual(parseMusicSource(url), { type: 'youtube', id: 'RjYnSIzR9Bo' }));
}
await check('場景 BV 號和分P保留', () => assert.deepEqual(parseMusicSource('BV1uh411Y73e', 26), { type: 'bilibili', id: 'BV1uh411Y73e', page: 26 }));
await check('B站完整網址可以作場景設定', () => assert.deepEqual(parseMusicSource('https://www.bilibili.com/video/BV1uh411Y73e?p=4'), { type: 'bilibili', id: 'BV1uh411Y73e', page: 4 }));
await check('有明確歌單才保留歌單和有效索引', () => assert.deepEqual(parseMusicSource('https://www.youtube.com/watch?v=RjYnSIzR9Bo&list=PL_example&index=7'), { type: 'youtube', id: 'RjYnSIzR9Bo', playlist: 'PL_example', index: 7 }));
await check('無效索引回1', () => assert.equal((parseMusicSource('https://youtu.be/RjYnSIzR9Bo?list=PL_example&index=-7') as any).index, 1));
for (const invalid of ['garbage', 'https://youtube.com.evil.example/watch?v=RjYnSIzR9Bo', 'javascript:alert(1)', 'https://example.com/BV1uh411Y73e', 'https://www.youtube.com/watch?v=bad']) {
  await check(`無效／冒牌連結不偷偷播放預設曲 ${invalid}`, () => assert.equal(parseMusicSource(invalid).type, 'invalid'));
}
await check('單曲嵌入不加入任意歌單、保留來源且不自動播放', () => {
  const url = new URL(youtubeEmbedUrl({ type: 'youtube', id: 'RjYnSIzR9Bo' }, 'http://localhost:3000'));
  assert.equal(url.searchParams.get('list'), null); assert.equal(url.searchParams.get('playlist'), 'RjYnSIzR9Bo');
  assert.equal(url.searchParams.get('autoplay'), '0'); assert.equal(url.searchParams.get('origin'), 'http://localhost:3000');
});
await check('原網站後備連結保留指定曲而非預設曲', () => assert.match(musicWatchUrl({ type: 'youtube', id: 'RjYnSIzR9Bo' })!, /v=RjYnSIzR9Bo/));
await check('153來源識別與101禁止嵌入有不同說明', () => {
  assert.match(youtubeErrorMessage(153), /來源識別/); assert.match(youtubeErrorMessage(101), /禁止嵌入/);
});

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
let previousReady = 0;
(window as any).onYouTubeIframeAPIReady = () => previousReady++;
await check('API載入只建一個script，失敗明確回報', async () => {
  const first = loadYoutubePlayerApi(), second = loadYoutubePlayerApi();
  assert.equal(first, second);
  const script = document.querySelector('script')!;
  assert.equal(script.referrerPolicy, 'strict-origin-when-cross-origin');
  script.dispatchEvent(new dom.window.Event('error'));
  await assert.rejects(first, /無法載入/);
  assert.equal(document.querySelectorAll('script').length, 0);
});

const instances: FakePlayer[] = [];
class FakePlayer implements YoutubePlayer {
  calls: string[] = []; muted = true; volume = 0; destroyed = false; currentState = -1;
  constructor(public frame: HTMLIFrameElement, public options: { events: YoutubeEvents }) { instances.push(this); }
  playVideo() { this.calls.push('play'); }
  pauseVideo() { this.calls.push('pause'); }
  mute() { this.calls.push('mute'); this.muted = true; }
  unMute() { this.calls.push('unmute'); this.muted = false; }
  setVolume(value: number) { this.calls.push(`volume:${value}`); this.volume = value; }
  isMuted() { return this.muted; }
  getVolume() { return this.volume; }
  getPlayerState() { return this.currentState; }
  destroy() { this.destroyed = true; this.frame.remove(); }
  ready() { this.options.events.onReady({ target: this }); }
  state(data: number) { this.currentState = data; this.options.events.onStateChange({ data, target: this }); }
  error(data: number) { this.options.events.onError({ data }); }
}
await check('API失敗後可以重試並保留原ready回呼', async () => {
  const pending = loadYoutubePlayerApi();
  (window as any).YT = { Player: FakePlayer };
  (window as any).onYouTubeIframeAPIReady();
  assert.equal((await pending).Player, FakePlayer); assert.equal(previousReady, 1);
});

// 決定性假時鐘，測試逾時不必等20秒，也不連YouTube。
const scheduled = new Map<number, { run: () => void; delay: number }>(); let timerId = 0;
const intervals = new Map<number, () => void>();
window.setInterval = ((run: () => void) => { const id = ++timerId; intervals.set(id, run); return id; }) as any;
window.clearInterval = ((id: number) => { intervals.delete(id); }) as any;
window.setTimeout = ((run: () => void, delay: number) => { const id = ++timerId; scheduled.set(id, { run, delay }); return id; }) as any;
window.clearTimeout = ((id: number) => { scheduled.delete(id); }) as any;
const fireTimer = async (delay: number) => {
  const item = [...scheduled.entries()].find(([, entry]) => entry.delay === delay);
  assert.ok(item, `missing ${delay} timer`); scheduled.delete(item[0]); await act(async () => item[1].run());
};
let model: ReturnType<typeof useMusicPlayer>;
function Harness({ source }: { source: MusicSource }) {
  model = useMusicPlayer(source);
  return model.mounted ? React.createElement('div', { ref: model.containerRef }) : null;
}
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
let source: MusicSource = { type: 'youtube', id: 'RjYnSIzR9Bo' };
const render = async () => { await act(async () => root.render(React.createElement(Harness, { source }))); };
await render();
await check('未點播放不建立iframe／播放器', () => { assert.equal(instances.length, 0); assert.equal(model.isPlaying, false); });
await check('點播放只顯示載入，尚未ready不發指令、不謊報播放中', async () => {
  await act(async () => model.setIsPlaying(true));
  assert.equal(instances.length, 1); assert.equal(instances[0].calls.length, 0); assert.equal(model.isPlaying, false);
  assert.equal(instances[0].frame.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.equal(instances[0].frame.height, '200'); assert.match(instances[0].frame.allow, /autoplay/);
});
const first = instances[0];
await check('ready後送有聲播放和60音量', async () => {
  await act(async () => first.ready());
  assert.deepEqual(first.calls.slice(-3), ['volume:60', 'unmute', 'play']); assert.equal(model.isPlaying, false);
});
await check('只有官方PLAYING事件才顯示播放中', async () => { await act(async () => first.state(1)); assert.equal(model.isPlaying, true); assert.equal(model.isMuted, false); });
await check('重複要求播放不誤設逾時計時器或重播', async () => {
  const plays = first.calls.filter(call => call === 'play').length;
  await act(async () => model.setIsPlaying(true));
  assert.equal(model.isPlaying, true); assert.equal(scheduled.size, 0);
  assert.equal(first.calls.filter(call => call === 'play').length, plays);
});
await check('靜音與取消靜音不重載iframe、不重建播放器', async () => {
  const frame = document.querySelector('iframe'), before = first.frame.src;
  await act(async () => model.toggleMute()); assert.equal(first.muted, true);
  await act(async () => model.toggleMute()); assert.equal(first.muted, false);
  assert.equal(document.querySelector('iframe'), frame); assert.equal(first.frame.src, before); assert.equal(instances.length, 1);
});
await check('預設隱藏，顯示偏好保存但不重載播放器', async () => {
  assert.equal(model.showPlayer, false);
  await act(async () => model.setShowPlayer(true));
  assert.equal(window.localStorage.getItem('seer_music_show_player'), '1');
  await act(async () => model.setShowPlayer(false));
  assert.equal(model.showPlayer, false); assert.equal(instances.length, 1); assert.equal(first.destroyed, false);
});
await check('音量調整／靜音0／取消靜音恢復60／非法值忽略', async () => {
  await act(async () => model.setVolume(35)); assert.equal(first.volume, 35); assert.equal(model.audioInfo?.volume, 35);
  await act(async () => model.setIsPlaying(true)); assert.equal(first.volume, 35);
  await act(async () => model.setVolume(0)); assert.equal(model.isMuted, true); assert.equal(first.muted, true);
  await act(async () => model.setIsMuted(false)); assert.equal(first.volume, 60); assert.equal(first.muted, false);
  await act(async () => model.setVolume(NaN)); assert.equal(first.volume, 60);
  assert.equal(window.localStorage.getItem('seer_music_volume'), '60');
});
await check('影片內的音量／靜音變更讀回本站，不僅顯示送出指令', async () => {
  first.volume = 20; first.muted = true;
  await act(async () => { for (const sample of intervals.values()) sample(); });
  assert.deepEqual(model.audioInfo, { volume: 20, muted: true }); assert.equal(model.isMuted, true); assert.equal(model.volume, 20);
  await act(async () => model.setVolume(60));
});
await check('暫停後再播放保留iframe，直接在點擊流程執行', async () => {
  await act(async () => { model.setIsPlaying(false); first.state(2); }); assert.equal(model.isPlaying, false);
  await act(async () => model.setIsPlaying(true)); assert.equal(first.calls.at(-1), 'play'); assert.equal(instances.length, 1);
});
await check('瀏覽器擋有聲播放明確回報，不亮播放中', async () => {
  await act(async () => first.options.events.onAutoplayBlocked()); assert.equal(model.playback.phase, 'blocked'); assert.equal(model.isPlaying, false);
});
await check('ready但一直沒PLAYING時回報未開始而非假成功', async () => {
  await act(async () => model.setIsPlaying(true)); await fireTimer(12000); assert.equal(model.playback.phase, 'blocked');
});
await check('播放器錯誤153能顯示來源識別錯誤', async () => {
  await act(async () => first.error(153)); assert.equal(model.playback.phase, 'error'); assert.match(model.playback.message, /來源識別/);
});
await check('重新載入會銷毀舊播放器，舊回呼不能覆蓋新狀態', async () => {
  await act(async () => model.retryMusic()); assert.equal(instances.length, 2); assert.equal(first.destroyed, true);
  await act(async () => first.state(1)); assert.equal(model.isPlaying, false);
});
await check('載入逾時能回報，不永久卡在載入', async () => { await fireTimer(20000); assert.equal(model.playback.phase, 'error'); assert.match(model.playback.message, /逾時/); });
await check('換曲只剩一個播放器，舊曲ready不能播舊歌', async () => {
  const old = instances.at(-1)!; source = { type: 'youtube', id: 'wJ8onQryXRY' }; await render();
  assert.equal(document.querySelectorAll('iframe').length, 1); assert.match(document.querySelector('iframe')!.src, /embed\/wJ8onQryXRY/);
  await act(async () => old.ready()); assert.equal(model.isPlaying, false);
  await act(async () => { instances.at(-1)!.ready(); instances.at(-1)!.state(1); }); assert.equal(model.isPlaying, true);
});
await check('原生播放器暫停也同步介面', async () => { await act(async () => instances.at(-1)!.state(2)); assert.equal(model.requestedPlaying, false); assert.equal(model.isPlaying, false); });
await check('停止關閉清掉播放器與所有計時器', async () => {
  await act(async () => model.closeMusic()); assert.equal(document.querySelectorAll('iframe').length, 0); assert.equal(scheduled.size, 0);
  assert.equal(intervals.size, 0);
});
await check('尚未就緒就取消播放，ready後只暫停、不偷播', async () => {
  await act(async () => model.setIsPlaying(true)); const last = instances.at(-1)!;
  await act(async () => model.setIsPlaying(false)); await act(async () => last.ready());
  assert.equal(last.calls.at(-1), 'pause'); assert.equal(last.calls.includes('play'), false);
  assert.equal(model.isPlaying, false); assert.equal(model.playback.phase, 'paused');
  await act(async () => model.closeMusic());
});
await check('B站只回報外部載入，不假稱已播；暫停不被onload改成播放', async () => {
  source = { type: 'bilibili', id: 'BV1uh411Y73e', page: 3 }; await render();
  await act(async () => model.setIsPlaying(true));
  const frame = document.querySelector('iframe')!;
  assert.match(frame.src, /page=3/); await act(async () => frame.dispatchEvent(new dom.window.Event('load')));
  assert.equal(model.playback.phase, 'external'); assert.equal(model.isPlaying, false);
  await act(async () => model.setIsPlaying(false));
  await act(async () => frame.dispatchEvent(new dom.window.Event('load')));
  assert.equal(model.playback.phase, 'paused'); assert.equal(frame.src, 'about:blank');
  await act(async () => model.closeMusic()); assert.equal(scheduled.size, 0);
});
await act(async () => root.unmount()); dom.window.close();

let toneContext: FakeAudioContext;
class FakeAudioContext {
  state = 'suspended'; currentTime = 0; destination = {}; closed = false; disconnected = false;
  static blocked = false;
  oscillator = { type: '', frequency: { value: 0 }, connect: () => {}, start: () => {},
    onended: null as null | (() => void), stop: () => toneContext.oscillator.onended?.(),
    disconnect: () => { this.disconnected = true; } };
  constructor() { toneContext = this; }
  async resume() { if (!FakeAudioContext.blocked) this.state = 'running'; }
  createOscillator() { return this.oscillator; }
  createGain() { return { gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} }, connect: () => {} }; }
  async close() { this.closed = true; }
}
(globalThis as any).AudioContext = FakeAudioContext;
await check('測試音只產生短音，不連外且結束釋放音訊資源', async () => {
  await playAudioTestTone(); assert.equal(toneContext.closed, true); assert.equal(toneContext.disconnected, true);
});
await check('測試音受阻明確回報並仍釋放資源', async () => {
  FakeAudioContext.blocked = true;
  await assert.rejects(playAudioTestTone(), /尚未允許/); assert.equal(toneContext.closed, true);
});
delete (globalThis as any).AudioContext;
console.log(`音樂播放語意測試 ${passed} 項通過。`);
