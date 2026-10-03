const fs = require('node:fs/promises');
const path = require('node:path');
const { downloadVerified, hashFile, OWNER, REPO } = require('./releaseClient.cjs');
function validateAssetManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(manifest.version || '') || !Array.isArray(manifest.entries) || manifest.entries.length > 900) throw new Error('素材清單無效');
  const seen = new Set();
  for (const item of manifest.entries) {
    if (!/^\/(elf-art|images)\/[^/]+\.png$/.test(item.url) && !/^\/seer\/body\/\d+\.png$/.test(item.url)) throw new Error('素材路徑不受支援');
    if (item.url.includes('..') || /[\\\x00-\x1f?#]/.test(item.url) || seen.has(item.url)) throw new Error('素材路徑無效或重複'); seen.add(item.url);
    if (!/^[a-f0-9]{64}$/.test(item.sha256) || item.fileName !== `asset-${item.sha256}.png` || !Number.isSafeInteger(item.size) || item.size < 8 || item.size > 32 * 1024 * 1024) throw new Error('素材大小／校驗無效');
    const expected = `https://github.com/${OWNER}/${REPO}/releases/download/v${manifest.version}/${item.fileName}`;
    if (item.downloadUrl !== expected) throw new Error('素材版本來源不一致');
  }
  return manifest;
}
class AssetCache {
  constructor(manifest, directory, fetcher = fetch) { this.manifest = validateAssetManifest(manifest); this.directory = directory; this.fetcher = fetcher; this.pending = new Map(); this.running = 0; this.waiters = []; }
  async slot() { if (this.running < 3) { this.running++; return; } if (this.waiters.length >= 64) throw new Error('素材下載忙碌，請稍後重試'); await new Promise(resolve => this.waiters.push(resolve)); }
  release() { const next = this.waiters.shift(); if (next) next(); else this.running--; }
  async get(url) {
    const item = this.manifest.entries.find(item => item.url === url); if (!item) return null;
    if (this.pending.has(item.sha256)) return this.pending.get(item.sha256);
    const job = (async () => {
      await this.slot();
      try {
        const directory = path.join(this.directory, item.sha256); const file = path.join(directory, item.fileName);
        try { const s = await fs.stat(file); if (s.size === item.size && await hashFile(file) === item.sha256) return file; await fs.rename(file, `${file}.corrupt-${Date.now()}`); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        return await downloadVerified({ ...item, url: item.downloadUrl }, directory, { signal: AbortSignal.timeout(60000), fetcher: this.fetcher });
      } finally { this.release(); }
    })();
    this.pending.set(item.sha256, job);
    try { return await job; } finally { this.pending.delete(item.sha256); }
  }
}
module.exports = { AssetCache, validateAssetManifest };
