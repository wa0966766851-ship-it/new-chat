import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { basename, dirname, join, resolve, sep } from 'node:path';

// Verify the bundled production server without the repository's node_modules,
// .env, or development middleware. This is not a full installer acceptance test.
const workspace = await mkdtemp(join(tmpdir(), 'seer-electron-smoke-'));
let child;
let output = '';
try {
  await mkdir(join(workspace, 'dist'));
  await copyFile(resolve('dist/server.cjs'), join(workspace, 'dist/server.cjs'));
  await copyFile(resolve('dist/index.html'), join(workspace, 'dist/index.html'));
  const portProbe = createServer();
  await new Promise((done, reject) => {
    portProbe.once('error', reject);
    portProbe.listen(0, '127.0.0.1', done);
  });
  const port = portProbe.address().port;
  await new Promise((done, reject) => portProbe.close(error => error ? reject(error) : done()));
  const env = { ...process.env, NODE_ENV: 'production', PORT: String(port) };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  delete env.GEMINI_API_KEY;
  child = spawn(process.execPath, [join(workspace, 'dist/server.cjs')], {
    cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  child.stderr.on('data', data => { output += data.toString(); });
  const url = await new Promise((resolveUrl, reject) => {
    const timeout = setTimeout(() => reject(new Error(`伺服器啟動逾時：${output}`)), 15000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`伺服器提前退出 ${code}：${output}`));
    });
    child.stdout.on('data', data => {
      output += data.toString();
      const match = output.match(/Server running on http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolveUrl(`http://127.0.0.1:${match[1]}`); }
    });
  });
  const status = await fetch(`${url}/api/ai-status`, { signal: AbortSignal.timeout(5000) });
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { enabled: false });
  const home = await fetch(url, { signal: AbortSignal.timeout(5000) });
  assert.equal(home.status, 200);
  assert.equal(await home.text(), await readFile(resolve('dist/index.html'), 'utf8'));
  console.log('Electron 正式伺服器：無專案依賴、無金鑰啟動，健康檢查與首頁通過。');
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, 'exit');
    child.kill();
    await stopped;
  }
  // Never recursively remove anything except our verified mkdtemp directory.
  const target = await realpath(workspace);
  const temporaryRoot = await realpath(tmpdir());
  assert.equal(dirname(target).toLowerCase(), temporaryRoot.toLowerCase());
  assert.ok(target.toLowerCase().startsWith(`${temporaryRoot}${sep}`.toLowerCase()));
  assert.ok(basename(target).startsWith('seer-electron-smoke-'));
  await rm(target, { recursive: true, force: true });
}
