import path from 'node:path';

/** 分享／打包不帶使用者的啟動偏好；路徑先統一分隔符，不能只比較basename。 */
const DROP_FILES = new Set(['.env', '.env.local', 'server.log', 'launcher/server.log', 'launcher/settings.json', 'launcher/settings.json.tmp']);
export function shouldDropShareFile(relative: string): boolean {
  const normalized = relative.replace(/\\/g, '/');
  const base = path.posix.basename(normalized);
  return DROP_FILES.has(normalized) || DROP_FILES.has(base) || base.endsWith('.log') || base.startsWith('.env.');
}
