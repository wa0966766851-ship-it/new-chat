const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const OWNER = 'wa0966766851-ship-it';
const REPO = 'new-chat';
const RELEASES = `https://github.com/${OWNER}/${REPO}/releases`;
const API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

function compareVersion(a, b) {
  const parse = v => { if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error('版本格式錯誤'); return v.split('.').map(Number); };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1; } return 0;
}
function safeFileName(name) {
  return typeof name === 'string' && name.length < 160 && !name.startsWith('.') && !name.includes('..') && /^[\p{L}\p{N} ._-]+$/u.test(name) && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name);
}
function trustedUrl(raw, initial = false) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw new Error('下載來源不安全');
  if (!['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.hostname)) throw new Error('下載來源不在允許清單');
  if (initial && (url.hostname !== 'github.com' || !url.pathname.startsWith(`/${OWNER}/${REPO}/releases/download/`))) throw new Error('不是本專案的 Release 附件');
  return url.href;
}
async function limitedJson(response, max = 2 * 1024 * 1024) {
  if (!response.ok) throw new Error(`檢查失敗（${response.status}），請稍後重試`);
  let size = 0; const chunks = [];
  for await (const chunk of response.body) { size += chunk.length; if (size > max) throw new Error('版本資訊過大'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function parseRelease(data, current, kind) {
  if (data.draft || data.prerelease || !/^v\d+\.\d+\.\d+$/.test(data.tag_name || '')) throw new Error('不是穩定正式版本');
  const version = data.tag_name.slice(1);
  if (compareVersion(version, current) <= 0) return { status: 'latest', version: current, releaseUrl: RELEASES };
  const suffix = kind === 'portable' ? `-${version}-portable.exe` : `-${version}-win-x64.exe`;
  const assets = (Array.isArray(data.assets) ? data.assets : []).filter(a => safeFileName(a.name) && a.name.endsWith(suffix));
  if (assets.length !== 1) throw new Error('新版尚未提供相符的 Windows x64 檔案');
  const asset = assets[0];
  if (!Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size >= 2 * 1024 ** 3) throw new Error('下載檔案大小無效');
  const sha256 = /^sha256:([a-f0-9]{64})$/.exec(asset.digest || '')?.[1];
  if (!sha256) throw new Error('新版沒有 SHA-256 資訊，已停用自動下載');
  const url = trustedUrl(asset.browser_download_url, true);
  const expected = `/${OWNER}/${REPO}/releases/download/${data.tag_name}/${encodeURIComponent(asset.name)}`;
  if (new URL(url).pathname !== expected) throw new Error('版本與下載位置不一致');
  return { status: 'available', version, kind, fileName: asset.name, size: asset.size, sha256, url,
    releaseUrl: `${RELEASES}/tag/${data.tag_name}`, notes: String(data.body || '').slice(0, 3000) };
}
async function checkRelease(current, kind, fetcher = fetch) {
  const response = await fetcher(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SeerBattleUpdater', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(12000), redirect: 'error' });
  if (response.status === 404) return { status: 'unpublished', releaseUrl: RELEASES };
  if (response.status === 403 || response.status === 429) throw new Error('GitHub 暫時限制查詢，請稍後重試；目前版本仍可使用');
  return parseRelease(await limitedJson(response), current, kind);
}
async function hashFile(file) {
  const hash = createHash('sha256'); for await (const chunk of fs.createReadStream(file)) hash.update(chunk); return hash.digest('hex');
}
async function downloadVerified(asset, directory, { signal, progress = () => {}, fetcher = fetch } = {}) {
  if (!safeFileName(asset.fileName) || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.size) || asset.size <= 0) throw new Error('下載清單無效');
  await fsp.mkdir(directory, { recursive: true });
  const final = path.join(directory, asset.fileName);
  try {
    const s = await fsp.stat(final);
    if (s.size === asset.size && await hashFile(final) === asset.sha256) return final;
    throw new Error('目的地已有不同檔案；不會覆寫');
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const partial = path.join(directory, `${randomUUID()}.part`);
  let stream;
  try {
    let url = trustedUrl(asset.url, true), response;
    for (let hops = 0; hops <= 5; hops++) {
      response = await fetcher(url, { signal, redirect: 'manual' });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location || hops === 5) throw new Error('下載重新導向過多'); url = trustedUrl(new URL(location, url).href); continue;
      } break;
    }
    if (response.status !== 200 || !response.body) throw new Error(`下載失敗（${response.status}）`);
    const length = response.headers.get('content-length'); if (length && Number(length) !== asset.size) throw new Error('下載大小與清單不一致');
    stream = fs.createWriteStream(partial, { flags: 'wx' });
    // Capture errors before the first write; propagate stream failures instead of hanging.
    let streamError; stream.on('error', error => { streamError = error; });
    const hash = createHash('sha256'); let size = 0;
    for await (const chunk of response.body) {
      if (signal?.aborted) throw new Error('下載已取消');
      if (streamError) throw streamError;
      size += chunk.length; if (size > asset.size) throw new Error('下載超出預期大小');
      hash.update(chunk); if (!stream.write(chunk)) await once(stream, 'drain'); progress(size, asset.size);
    }
    const finished = once(stream, 'finish'); stream.end(); await finished;
    if (size !== asset.size || hash.digest('hex') !== asset.sha256) throw new Error('檔案完整性校驗失敗，未套用更新');
    // Exclusive hard link prevents a race from replacing an existing user file.
    await fsp.link(partial, final); await fsp.unlink(partial); return final;
  } finally {
    if (stream && !stream.closed) { stream.destroy(); await new Promise(done => stream.once('close', done)); }
    await fsp.unlink(partial).catch(e => { if (e.code !== 'ENOENT') throw e; });
  }
}
module.exports = { OWNER, REPO, RELEASES, compareVersion, safeFileName, trustedUrl, parseRelease, checkRelease, hashFile, downloadVerified };
