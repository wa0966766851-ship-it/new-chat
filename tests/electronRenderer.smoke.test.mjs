import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const exe = resolve(process.argv[2] || `dist-electron/賽爾對戰模擬器-${version}-portable.exe`);
async function port() { const s = createServer(); await new Promise(done => s.listen(0, '127.0.0.1', done)); const p = s.address().port; await new Promise(done => s.close(done)); return p; }
await mkdir(resolve('build'), { recursive: true }); const profile = await mkdtemp(resolve('build/renderer-smoke-'));
const debugPort = await port(), serverPort = await port();
const env = { ...process.env, SEER_PORT: String(serverPort), SEER_USER_DATA_DIR: profile };
for (const key of ['ELECTRON_RUN_AS_NODE', 'GEMINI_API_KEY', 'NODE_OPTIONS', 'NODE_PATH']) delete env[key];
const child = spawn(exe, [`--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1'], { env, windowsHide: true, stdio: 'ignore' });
let socket, spawnError; child.once('error', error => { spawnError = error; });
const wait = ms => new Promise(done => setTimeout(done, ms));
try {
  const deadline = Date.now() + 60000; let target;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError; if (child.exitCode !== null) throw new Error(`EXE 提前退出 ${child.exitCode}`);
    try {
      const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: AbortSignal.timeout(1000) }).then(r => r.json());
      target = list.find(t => t.type === 'page' && t.url.startsWith(`http://127.0.0.1:${serverPort}`)); if (target) break;
    } catch { /* isolated startup */ }
    await wait(200);
  }
  assert.ok(target, '未找到本次程式的正式頁面');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  socket.addEventListener('message', event => { const r = JSON.parse(event.data); if (pending.has(r.id)) { const p = pending.get(r.id); pending.delete(r.id); clearTimeout(p.timer); r.error ? p.reject(new Error(r.error.message)) : p.resolve(r.result); } });
  const evaluate = expression => new Promise((resolve, reject) => {
    const n = ++id; const timer = setTimeout(() => { pending.delete(n); reject(new Error('畫面檢查逾時')); }, 10000);
    pending.set(n, { resolve: r => r.exceptionDetails ? reject(new Error(r.exceptionDetails.text)) : resolve(r.result.value), reject, timer });
    socket.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
  });
  const until = async expression => { const end = Date.now() + 15000; while (Date.now() < end) { const result = await evaluate(expression); if (result) return result; await wait(150); } throw new Error(`畫面條件未成立：${expression}`); };
  await until("document.querySelector('#root')?.innerText.includes('開始對戰')");
  assert.equal(await evaluate('typeof window.require'), 'undefined', '頁面不能取得 Node');
  assert.equal((await evaluate('window.seerDesktop.updates.status()')).currentVersion, version);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('控制中心')).click()");
  await until("!!document.querySelector('[data-control-hub]')");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='檢查更新').click()");
  await until("!!document.querySelector('[data-update-settings]')");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='檢查網站更新').disabled"), true);
  assert.equal(await evaluate("!![...document.querySelectorAll('button')].find(b=>b.textContent==='檢查桌面更新')"), true);
  console.log(`真正 Electron 畫面：首頁、控制中心、更新分類、IPC 版本、網頁檢查停用、Node 隔離通過。存檔副本：${profile}`);
} finally {
  socket?.close();
  if (child.pid && child.exitCode === null) await promisify(execFile)('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
}
