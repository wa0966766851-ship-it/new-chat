import { readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const SITE = 'https://seer-battle-preview.worry0487.chatgpt.site';
export async function publishPackage(root, credentials, fetcher = fetch) {
  if (!credentials.service || !credentials.publisher) throw new Error('需要設定兩個網站發布私密變數，不能使用前端或 AI 憑證替代');
  const manifest = JSON.parse(await readFile(join(root, 'web-package-manifest.json'), 'utf8'));
  const request = async (path, method = 'GET', body) => {
    const response = await fetcher(`${SITE}/_updates/${path}`, {
      method, body, redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { 'OAI-Sites-Authorization': `Bearer ${credentials.service}`, 'X-Seer-Publish-Key': credentials.publisher,
        'Content-Type': body instanceof Uint8Array ? 'application/octet-stream' : 'application/json' }
    });
    if (!response.ok) throw new Error(`網站發布操作 ${path.split('/')[0]} 失敗（${response.status}）；舊版本未被刪除`);
    return response.json();
  };
  const before = await request('status');
  // Verify every local file BEFORE the first external write. No symlink/path
  // escapes, corruption, partial-package activation, or secret logging.
  if (!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > Math.min(before.maxFiles || 900, 2000)) throw new Error('網站套件超出發布端支援範圍；未上傳');
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || /[\\:%?#\x00-\x1f]/.test(file.path) || file.path.startsWith('/') || file.path.split('/').some(p => !p || p.startsWith('.'))) throw new Error('非法網站檔案路徑');
    let candidate = root;
    if ((await lstat(candidate)).isSymbolicLink()) throw new Error('網站套件不能是符號連結');
    for (const part of file.path.split('/')) {
      candidate = join(candidate, part);
      if ((await lstat(candidate)).isSymbolicLink()) throw new Error('網站套件不能包含符號連結');
    }
    const bytes = await readFile(join(root, file.path));
    if (bytes.length !== file.size || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('本機網站套件校驗失敗；未上傳');
  }
  const unique = [...new Map(manifest.files.map(f => [f.sha256, f])).values()];
  // Two sequential workers only; do not buffer the complete game in memory.
  let next = 0;
  await Promise.all([0, 1].map(async () => {
    while (next < unique.length) {
      const file = unique[next++];
      await request(`blob/${file.sha256}`, 'PUT', await readFile(join(root, file.path)));
    }
  }));
  const serialized = JSON.stringify(manifest);
  if (before.verificationBatchSize) {
    const batchSize = before.verificationBatchSize;
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 200) throw new Error('發布端核對設定無效；未啟用');
    if (unique.length > batchSize) for (let i = 0; i < Math.ceil(unique.length / batchSize); i++) {
      const checked = await request(`verify/${i}`, 'POST', serialized);
      if (!checked.verified || checked.buildId !== manifest.buildId || checked.batch !== i) throw new Error('分批核對未完成；未啟用');
    }
  }
  const verified = await request('manifest', 'POST', serialized);
  if (!verified.verified || verified.buildId !== manifest.buildId) throw new Error('套件核對未完成；未啟用');
  const result = await request('activate', 'POST', JSON.stringify({ buildId: manifest.buildId, expectedBuildId: before.buildId || null }));
  const current = await request('status');
  const live = await fetcher(`${SITE}/version.json`, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(120000),
    headers: { 'OAI-Sites-Authorization': `Bearer ${credentials.service}`, 'X-Seer-Publish-Key': credentials.publisher } });
  if (!live.ok) throw new Error(`啟用後版本查詢失敗（${live.status}）；資源及前一版本均保留，請確認發布狀態`);
  const identity = await live.json();
  if (current.buildId !== manifest.buildId || identity.buildId !== manifest.buildId || identity.commit !== manifest.commit || identity.version !== manifest.version) {
    throw new Error('啟用後線上版本不符或已有並行發布；不宣稱更新成功，也不刪除或自動回滾資源');
  }
  return { buildId: result.buildId, commit: identity.commit, verified: true, previousBuildId: result.previousBuildId, fileCount: manifest.files.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await publishPackage(resolve(process.argv[2] || 'build/web-package'), {
      service: process.env.SEER_SITE_SERVICE_TOKEN, publisher: process.env.SEER_SITE_PUBLISH_KEY
    });
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
