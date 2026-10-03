const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { checkRelease, downloadVerified, hashFile } = require('./releaseClient.cjs');

class UpdateService {
  constructor({ version, kind, directory, originalExe, fetcher = fetch }) {
    this.version = version; this.kind = kind; this.directory = directory; this.originalExe = originalExe; this.fetcher = fetcher;
    this.state = { status: 'idle', currentVersion: version, kind }; this.pending = null; this.abort = null; this.release = null;
  }
  status() { return { ...this.state }; }
  async check() {
    if (this.pending) return this.status();
    if (this.state.checkedAt && Date.now() - this.state.checkedAt < 15000 && ['available', 'latest', 'unpublished'].includes(this.state.status)) return this.status();
    this.state = { ...this.state, status: 'checking', message: undefined };
    this.pending = (async () => {
      try { this.release = await checkRelease(this.version, this.kind, this.fetcher); this.state = { currentVersion: this.version, kind: this.kind, ...this.release, checkedAt: Date.now() }; }
      catch (error) { this.state = { ...this.state, status: 'error', message: error.message }; }
    })();
    try { await this.pending; return this.status(); } finally { this.pending = null; }
  }
  async download(snapshot) {
    if (this.pending || this.state.status !== 'available') throw new Error('請先檢查新版，或等待目前工作完成');
    if (typeof snapshot !== 'string' || Buffer.byteLength(snapshot) > 4 * 1024 * 1024) throw new Error('存檔備份格式或大小不合規');
    const parsed = JSON.parse(snapshot);
    if (parsed.schemaVersion !== 1 || !parsed.storage || typeof parsed.storage !== 'object' || Array.isArray(parsed.storage)) throw new Error('存檔備份格式錯誤');
    for (const [key, value] of Object.entries(parsed.storage)) if (!key.startsWith('seer_') || /key|token|secret|password/i.test(key) || typeof value !== 'string') throw new Error('備份含不允許的項目');
    const job = path.join(this.directory, `${this.release.version}-${randomUUID()}`);
    this.abort = new AbortController(); const timeout = setTimeout(() => this.abort?.abort(), 10 * 60 * 1000);
    this.state = { ...this.state, status: 'downloading', received: 0, message: undefined };
    this.pending = (async () => {
      await fs.mkdir(job, { recursive: true });
      const save = path.join(job, 'player-backup.json'); await fs.writeFile(save, snapshot, { flag: 'wx' });
      if (await fs.readFile(save, 'utf8') !== snapshot) throw new Error('存檔備份未通過核對');
      let executableBackup;
      if (this.kind === 'portable' && this.originalExe) {
        const before = await hashFile(this.originalExe);
        executableBackup = path.join(job, 'previous-portable.exe');
        await fs.copyFile(this.originalExe, executableBackup, require('node:fs').constants.COPYFILE_EXCL);
        if (await hashFile(executableBackup) !== before || await hashFile(this.originalExe) !== before) throw new Error('舊 EXE 備份未通過核對');
      }
      const file = await downloadVerified(this.release, job, { signal: this.abort.signal, fetcher: this.fetcher,
        progress: (received, total) => { this.state = { ...this.state, received, total }; } });
      await fs.writeFile(path.join(job, 'receipt.json'), JSON.stringify({ schemaVersion: 1, currentVersion: this.version, release: this.release, executableBackup, playerBackup: save, downloadedFile: file, verifiedAt: new Date().toISOString() }, null, 2), { flag: 'wx' });
      this.state = { ...this.state, status: 'downloaded', file, folder: job, executableBackup, message: '新版已校驗並另存，未覆寫或執行；舊程式與存檔保持原狀。' };
    })();
    try { await this.pending; }
    catch (error) { this.state = { ...this.state, status: this.abort.signal.aborted ? 'cancelled' : 'error', message: this.abort.signal.aborted ? '下載已取消；目前版本與備份保留。' : error.message }; }
    finally { clearTimeout(timeout); this.pending = null; this.abort = null; }
    return this.status();
  }
  cancel() { this.abort?.abort(); return this.status(); }
}
module.exports = { UpdateService };
