import path from 'node:path';

/** 分享／打包不帶使用者的啟動偏好；路徑先統一分隔符，不能只比較basename。 */
const DROP_FILES = new Set(['.env', '.env.local', 'server.log', 'launcher/server.log', 'launcher/settings.json', 'launcher/settings.json.tmp', 'launcher/animation-source.local.json', 'launcher/animation-source.local.json.bak']);
const DROP_DIRECTORIES = new Set(['node_modules', 'dist', 'release', '.git', 'build', 'dist-electron',
  '.seer-cache', '_修正前備份', '_asset_backup', 'dist_release', '.desktop-releases', '.local-archives',
  '.cleanup-audit', 'shots', '_shots', '.tmp-esbuild', '.tmp-testlogs', '__pycache__', 'logs']);
export function shouldDropShareDirectory(relative: string): boolean {
  return relative.replace(/\\/g, '/').split('/').some(part => DROP_DIRECTORIES.has(part) || part.startsWith('_備份'));
}
export function shouldDropShareFile(relative: string): boolean {
  const normalized = relative.replace(/\\/g, '/');
  const base = path.posix.basename(normalized);
  return DROP_FILES.has(normalized) || DROP_FILES.has(base) || base.endsWith('.log') || base.startsWith('.env.');
}
