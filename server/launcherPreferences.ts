import type { Express, Request } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

export function readLauncherPreferences(file: string): { autoDesktopShortcut: boolean } {
  try { return { autoDesktopShortcut: JSON.parse(fs.readFileSync(file, 'utf8')).autoDesktopShortcut === true }; }
  catch { return { autoDesktopShortcut: false }; }
}
/** 僅允許啟動器的同源loopback頁面，阻擋其他網站與DNS rebinding操作桌面。 */
export function isLocalLauncherRequest(req: Pick<Request, 'headers' | 'socket' | 'method'>): boolean {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) return false;
  const host = req.headers.host || '';
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) return false;
  if (req.headers.origin && req.headers.origin !== `http://${host}`) return false;
  return req.method === 'GET' || (req.headers.origin === `http://${host}` && req.headers['content-type']?.startsWith('application/json') === true);
}
export function registerLauncherPreferences(app: Express, root: string, enabled = process.env.SEER_LAUNCHER === '1',
  createShortcut = () => new Promise<string>((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'launcher', 'create-shortcut.ps1')],
      { windowsHide: true, timeout: 15000 }, (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
  })) {
  const file = path.join(root, 'launcher', 'settings.json');
  const guard = (req: Request) => enabled && process.platform === 'win32' && isLocalLauncherRequest(req);
  app.get('/api/launcher/preferences', (req, res) => {
    if (!guard(req)) return res.status(404).json({ supported: false });
    res.json({ supported: true, ...readLauncherPreferences(file) });
  });
  app.post('/api/launcher/preferences', (req, res) => {
    if (!guard(req)) return res.status(403).json({ error: '僅限本機啟動器的同源頁面' });
    if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.autoDesktopShortcut !== 'boolean') return res.status(400).json({ error: '捷徑偏好需為布林值' });
    try {
      const next = { autoDesktopShortcut: req.body.autoDesktopShortcut };
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(next), 'utf8');
      fs.renameSync(`${file}.tmp`, file);
      res.json({ supported: true, ...next });
    } catch { res.status(500).json({ error: '啟動偏好儲存失敗，既有偏好未確認變更' }); }
  });
  app.post('/api/launcher/shortcut', async (req, res) => {
    if (!guard(req)) return res.status(403).json({ error: '僅限本機啟動器的同源頁面' });
    if (req.body?.confirm !== true) return res.status(400).json({ error: '尚未明確確認建立捷徑' });
    try { const result = await createShortcut(); res.json({ message: result === 'already-exists' ? '桌面已有同名捷徑，未覆寫。' : '已建立桌面捷徑。' }); }
    catch { res.status(500).json({ error: '未能確認桌面捷徑建立成功' }); }
  });
}
