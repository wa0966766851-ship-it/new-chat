import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

/** 自製動作素材：用真實 SwfPlayer + 真實圖集播放，逐序列截圖。
 * 這一步驗的是「播放器吃不吃得下我們烘的素材」，不是「好不好看」。
 * 伺服器（npm run serve:animation-preview -- --dev）需先啟動。
 */
const BASE = process.env.CUSTOM_ANIM_URL || 'http://127.0.0.1:3015/tests/fixtures/customAnimPreview.html';
const IDS = ['wuxu_zhuixing', 'wuxu_shiyan', 'emperor_dixin', 'wuxu_liuren'];
const SHOTS = {
  wuxu_zhuixing: ['standby', 'sa'],
  wuxu_shiyan: ['attack', 'extra'],
  emperor_dixin: ['attack', 'cp'],
  wuxu_liuren: ['attack'],
};
const browser = findPetTestBrowser();
if (!browser) { console.log('跳過：找不到 Edge／Chrome／Chromium（可用 PET_TEST_BROWSER 指定）'); process.exit(0); }

const out = path.resolve('.seer-cache/custom-anim-shots');
fs.mkdirSync(out, {recursive: true});
const port = 9800 + Math.floor(Math.random() * 150);
const profile = petTestProfile();
const proc = launchPetTestBrowser(browser, port, profile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let target;
  for (let i = 0; i < 80; i++) {
    try { target = await (await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', {method: 'PUT'})).json(); break; }
    catch { await sleep(250); }
  }
  assert.ok(target, 'headless browser ready');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, {once: true}); ws.addEventListener('error', j, {once: true}); });
  let id = 0;
  const pending = new Map(), logs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } }
    if (m.method === 'Runtime.exceptionThrown') logs.push(JSON.stringify(m.params.exceptionDetails?.text ?? m.params));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push(JSON.stringify(m.params.args));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, {resolve, reject}); ws.send(JSON.stringify({id: n, method, params})); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true})).result.value;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});

  for (const elf of IDS) {
    await send('Page.navigate', {url: BASE + '?id=' + elf});
    let ready = false;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      ready = await evaluate("document.querySelector('#stage')?.getAttribute('data-ready')==='true'");
      if (ready) break;
    }
    const status = await evaluate("document.querySelector('[data-status]')?.textContent");
    assert.ok(ready, elf + ' 載入失敗：' + status + ' ' + logs.join(' | '));
    const info = await evaluate('window.__pet.info');
    console.log('  ' + elf.padEnd(16) + 'fps ' + info.fps + ' 圖集 ' + info.atlas.join('×') + ' 序列 ' + info.seqs);

    for (const seq of SHOTS[elf]) {
      // 取序列中段影格截圖（首幀常常是全透明或只有本體）
      const total = await evaluate('window.__pet.frameCount(' + JSON.stringify(seq) + ')');
      const frame = Math.max(1, Math.floor((total || 4) * 0.6));
      const landed = await evaluate('window.__pet.seek(' + JSON.stringify(seq) + ',' + frame + ')');
      await sleep(150);
      const shot = await send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(out, elf + '-' + seq + '.png'), Buffer.from(shot.data, 'base64'));
      console.log('    ' + seq.padEnd(8) + '→ 要求第 ' + frame + '/' + total + ' 幀，實際 ' + landed);
      assert.ok(landed >= 0, elf + ' ' + seq + ' 跳幀失敗');
    }
  }
  fs.writeFileSync(path.join(out, 'logs.json'), JSON.stringify(logs, null, 2));
  console.log('自製動作素材在真實播放器上載入、逐序列跳幀與截圖通過');
} finally {
  ws?.close();
  closePetTestBrowser(proc, profile);
}
