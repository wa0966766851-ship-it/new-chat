import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createRequire } from 'node:module';
import { isLocalLauncherRequest, readLauncherPreferences, registerLauncherPreferences } from '../server/launcherPreferences';
import { shouldDropShareFile } from '../tools/shareFilePolicy';
const require = createRequire(import.meta.url);
const { createDesktopShortcutService } = require('../electron/desktopShortcut.cjs');
let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`); }
fs.mkdirSync('build', { recursive: true });
const temp = fs.mkdtempSync(path.resolve('build/launcher-tests-'));
const file = path.join(temp, 'launcher', 'settings.json');
fs.mkdirSync(path.dirname(file));
check('沒有偏好、損壞偏好、字串true均預設拒絕，不創建偏好或捷徑', () => {
  assert.equal(readLauncherPreferences(file).autoDesktopShortcut, false); assert.ok(!fs.existsSync(file));
  for (const value of ['broken', '{"autoDesktopShortcut":"true"}']) {
    fs.writeFileSync(file, value); assert.equal(readLauncherPreferences(file).autoDesktopShortcut, false);
  }
});
const local: any = { socket: { remoteAddress: '127.0.0.1' }, method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' } };
check('本機同源JSON可設定，跨站／外網／DNS rebinding／無Origin均拒絕', () => {
  assert.ok(isLocalLauncherRequest(local));
  for (const bad of [ { ...local, socket: { remoteAddress: '8.8.8.8' } },
    ...[{ origin: 'https://evil.test' }, { host: 'evil.test:3000' }, { origin: undefined }, { 'content-type': 'text/plain' }].map(h => ({ ...local, headers: { ...local.headers, ...h } })) ]) assert.ok(!isLocalLauncherRequest(bad));
});
check('EXE版預設不建立、明確確認後才建立、同名捷徑不覆寫', () => {
  const exe = path.join(temp, 'fixture.exe'); fs.writeFileSync(exe, 'not executable');
  let writes = 0;
  const service = createDesktopShortcutService({ directory: temp, desktop: temp, executable: exe, supported: true,
    writeShortcut: (target: string, op: string, options: any) => { writes++; assert.equal(op, 'create'); assert.equal(options.target, exe); fs.writeFileSync(target, 'shortcut fixture'); return true; } });
  assert.equal(service.onStartup(), null); assert.equal(writes, 0);
  assert.throws(() => service.create(false));
  service.create(true); assert.equal(writes, 1);
  service.preferences(true); service.onStartup(); assert.equal(writes, 1);
  service.preferences(false); service.onStartup(); assert.equal(writes, 1);
  assert.ok(fs.existsSync(path.join(temp, '賽爾對戰模擬器.lnk')));
});
check('打包預设禁止桌面捷徑，新服務包含在執行包且分享包不攜帶玩家偏好', () => {
  const packaging = fs.readFileSync('electron-builder.yml', 'utf8');
  assert.equal(packaging.match(/createDesktopShortcut: false/g)?.length, 2);
  assert.ok(fs.readFileSync('scripts/prepare_electron_app.mjs', 'utf8').includes("'desktopShortcut.cjs'"));
  assert.ok(fs.readFileSync('tools/prepare_share.ts', 'utf8').includes('shouldDropShareFile(rel)'));
  for (const file of ['launcher/settings.json', 'launcher\\settings.json', 'launcher/settings.json.tmp', 'launcher/server.log', '.env.local']) assert.ok(shouldDropShareFile(file));
  for (const file of ['launcher/startupWindow.ps1', 'launcher/create-shortcut.ps1', 'launcher/launcher.ps1', 'public/settings.json']) assert.equal(shouldDropShareFile(file), false);
});
const app = express(); app.use(express.json()); let invoked = 0;
registerLauncherPreferences(app, temp, true, async () => { invoked++; return 'already-exists'; });
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const url = `http://127.0.0.1:${(server.address() as any).port}`;
const post = (route: string, payload: object, origin = url) => fetch(url + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
try {
  if (process.platform !== 'win32') {
    // 產品只在 Windows 啟用啟動器偏好 API（server/launcherPreferences.ts 的 platform 守門）；其他平台須完全不暴露、不寫檔。
    assert.equal((await fetch(url + '/api/launcher/preferences')).status, 404);
    assert.equal((await post('/api/launcher/preferences', { autoDesktopShortcut: true })).status, 403);
    assert.equal((await post('/api/launcher/shortcut', { confirm: true })).status, 403);
    assert.equal(invoked, 0); assert.equal(readLauncherPreferences(file).autoDesktopShortcut, false);
    checks++; console.log(`✓ 非Windows(${process.platform})：偏好API不暴露（404/403），Windows專屬HTTP契約略過`);
  } else {
  assert.equal((await (await fetch(url + '/api/launcher/preferences')).json()).autoDesktopShortcut, false);
  assert.equal((await post('/api/launcher/preferences', { autoDesktopShortcut: true })).status, 200);
  assert.equal(readLauncherPreferences(file).autoDesktopShortcut, true);
  assert.equal((await post('/api/launcher/preferences', { autoDesktopShortcut: false })).status, 200);
  assert.equal((await post('/api/launcher/preferences', { autoDesktopShortcut: 'true' })).status, 400);
  assert.equal((await post('/api/launcher/shortcut', { confirm: true }, 'https://evil.test')).status, 403);
  assert.equal((await post('/api/launcher/shortcut', { confirm: false })).status, 400);
  assert.equal(invoked, 0);
  assert.equal((await post('/api/launcher/shortcut', { confirm: true })).status, 200); assert.equal(invoked, 1);
  checks++; console.log('✓ 真實HTTP設定保存、型別校驗、同源防護與明確建立契約');
  }
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
console.log(`${checks} launcher preferences checks passed (desktop untouched)`);
