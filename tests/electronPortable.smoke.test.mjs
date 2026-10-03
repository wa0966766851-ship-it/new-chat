import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

assert.equal(process.platform, 'win32', '此驗收僅適用 Windows EXE');
const executable = resolve(process.argv[2] || 'dist-electron/賽爾對戰模擬器-1.0.0-portable.exe');
await mkdir(resolve('build'), { recursive: true });
const profile = await mkdtemp(join(resolve('build'), 'portable-smoke-'));
const probe = createServer();
await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done); });
const port = probe.address().port;
await new Promise(done => probe.close(done));
const env = { ...process.env, SEER_PORT: String(port), SEER_USER_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.GEMINI_API_KEY;
delete env.NODE_OPTIONS;
delete env.NODE_PATH;
let logs = '';
const child = spawn(executable, [], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', data => { logs += data.toString(); });
child.stderr.on('data', data => { logs += data.toString(); });
let spawnError;
child.once('error', error => { spawnError = error; });
try {
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90000;
  let ready = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`EXE 提前退出 ${child.exitCode}\n${logs}`);
    try {
      const response = await fetch(`${url}/api/ai-status`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { assert.deepEqual(await response.json(), { enabled: false }); ready = true; break; }
    } catch (error) { if (error instanceof assert.AssertionError) throw error; }
    await new Promise(done => setTimeout(done, 300));
  }
  assert.ok(ready, `免安裝 EXE 啟動逾時\n${logs}`);
  const html = await fetch(url).then(response => response.text());
  assert.equal(html, await readFile(resolve('dist/index.html'), 'utf8'));
  assert.deepEqual(await fetch(`${url}/version.json`).then(response => response.json()),
    JSON.parse(await readFile(resolve('dist/version.json'), 'utf8')));
  const asset = html.match(/src="([^"\s]+\.js)"/);
  assert.ok(asset, '首頁需載入正式 JavaScript');
  assert.equal((await fetch(new URL(asset[1], url))).status, 200);
  assert.ok((await fetch(`${url}/api/ai-status`)).ok);
  console.log(`免安裝 EXE 已實際啟動：首頁、正式資源、版本與無金鑰 API 通過（${url}）。`);
} finally {
  await writeFile(join(profile, 'smoke.log'), logs);
  // Only terminate the subtree started by THIS test; never target an app name.
  if (child.pid && child.exitCode === null) {
    await promisify(execFile)('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
  }
  console.log(`本次測試存檔與日誌留在：${profile}`);
}
