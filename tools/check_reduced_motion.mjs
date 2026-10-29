#!/usr/bin/env node
/**
 * check_reduced_motion.mjs — 實測 prefers-reduced-motion 是否真的生效
 *
 * 為什麼不能只檢查 CSS 檔：
 *   「寫了 @media (prefers-reduced-motion: reduce)」不等於「瀏覽器真的套用」。
 *   這裡用 CDP 在兩種模式下讀 computed style，比對動畫時長。
 *
 * 需要 dev server 已啟動（預設 http://127.0.0.1:3000）。
 *
 * 用法：
 *   node tools/check_reduced_motion.mjs
 *
 * 離開碼：0 = 正常，1 = 沒生效
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const URL_BASE = process.argv[2] || 'http://127.0.0.1:3000/';
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
if (!EDGE) { console.error('找不到 Edge/Chrome'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function probe(reduce) {
  const port = 9500 + Math.floor(Math.random() * 400);
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${path.join(process.env.TEMP || '.', 'rm-check-' + Date.now())}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let version;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) { version = await res.json(); break; }
    } catch { /* 等 */ }
    await sleep(250);
  }
  if (!version) { proc.kill(); throw new Error('瀏覽器未啟動'); }

  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
  });
  await send('Page.navigate', { url: URL_BASE + (reduce ? '?rm=1' : '?rm=0') });
  await sleep(7000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const scan = [...document.querySelectorAll('#aegis-shell *')]
        .find(e => (e.getAttribute('style') || '').includes('aegisScan'));
      const ring = [...document.querySelectorAll('#aegis-shell svg *')]
        .find(e => (e.getAttribute('style') || '').includes('aegisSpin'));
      return JSON.stringify({
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        scanDuration: scan ? getComputedStyle(scan).animationDuration : 'none',
        scanDisplay: scan ? getComputedStyle(scan).display : 'none',
        ringDuration: ring ? getComputedStyle(ring).animationDuration : 'none',
      });
    })()`,
    returnByValue: true,
  });
  ws.close();
  proc.kill();
  return JSON.parse(res.result.value);
}

const normal = await probe(false);
const reduced = await probe(true);

console.log('正常模式  :', JSON.stringify(normal));
console.log('reduce 模式:', JSON.stringify(reduced));

const problems = [];
if (normal.matches) problems.push('正常模式不該 match reduce');
if (!reduced.matches) problems.push('reduce 模式沒有 match');
// 正常模式動畫必須是「真的有在跑」（>0.1s）
if (parseFloat(normal.scanDuration) < 0.1) problems.push('正常模式的掃描線動畫被關掉了（不該）');
if (parseFloat(normal.ringDuration) < 0.1) problems.push('正常模式的軌道環動畫被關掉了（不該）');
// reduce 模式動畫必須被縮到極短或隱藏
if (parseFloat(reduced.ringDuration) > 0.01) problems.push('reduce 模式的軌道環仍在轉');
if (reduced.scanDisplay !== 'none' && parseFloat(reduced.scanDuration) > 0.01) problems.push('reduce 模式的掃描線仍在動');

if (problems.length) {
  console.error('\n✗ 失敗：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('\n✓ prefers-reduced-motion 實測生效：正常模式有動畫，reduce 模式停止');
