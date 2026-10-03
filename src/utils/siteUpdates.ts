declare const __APP_COMMIT__: string;
declare const __APP_BUILD_ID__: string;
declare const __APP_VERSION__: string;
export type SiteVersion = { commit?: string; buildId?: string; version?: string; builtAt?: string; development?: boolean };
export type SiteUpdateState = { status: 'idle' | 'checking' | 'latest' | 'available' | 'error' | 'development'; remote?: SiteVersion; checkedAt?: number; message?: string };
export const currentSiteVersion: SiteVersion = {
  commit: typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : '',
  buildId: typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : '',
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '',
};
export function parseSiteVersion(value: unknown): SiteVersion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('網站版本資訊格式錯誤');
  const v = value as Record<string, unknown>;
  if (v.development === true) return { development: true };
  const commit = typeof v.commit === 'string' && /^[a-f0-9]{40}$/.test(v.commit) ? v.commit : undefined;
  const buildId = typeof v.buildId === 'string' && /^[a-f0-9]{64}$/.test(v.buildId) ? v.buildId : undefined;
  if (!commit && !buildId) throw new Error('伺服器沒有有效的網站版本資訊');
  return { commit, buildId, version: typeof v.version === 'string' && /^\d+\.\d+\.\d+$/.test(v.version) ? v.version : undefined,
    builtAt: typeof v.builtAt === 'string' && !Number.isNaN(Date.parse(v.builtAt)) ? v.builtAt : undefined };
}
/** Shared check: notice and control centre never disagree or issue duplicate requests. */
export class SiteUpdateStore {
  private state: SiteUpdateState = { status: 'idle' };
  private listeners = new Set<() => void>();
  private pending: Promise<void> | undefined;
  constructor(private current: SiteVersion, private fetcher: typeof fetch = (input, init) => fetch(input, init)) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(state: SiteUpdateState) { this.state = state; this.listeners.forEach(listener => listener()); }
  check = (): Promise<void> => {
    if (this.pending) return this.pending;
    this.publish({ ...this.state, status: 'checking', message: undefined });
    this.pending = this.performCheck().finally(() => { this.pending = undefined; }); return this.pending;
  };
  private async performCheck() {
    const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 10000);
    try {
      const response = await this.fetcher(`/version.json?check=${Date.now()}`, { cache: 'no-store', signal: abort.signal });
      if (!response.ok) throw new Error(`網站版本檢查失敗（${response.status}）`);
      const text = await response.text(); if (text.length > 8192) throw new Error('網站版本資訊過大');
      const remote = parseSiteVersion(JSON.parse(text));
      if (remote.development) { this.publish({ status: 'development', checkedAt: Date.now(), message: '目前是開發預覽，修改由開發伺服器提供，不作正式版本更新。' }); return; }
      const available = remote.buildId && this.current.buildId ? remote.buildId !== this.current.buildId : !!remote.commit && !!this.current.commit && remote.commit !== this.current.commit;
      this.publish({ status: available ? 'available' : 'latest', remote, checkedAt: Date.now() });
    } catch (error) {
      this.publish({ ...this.state, status: 'error', checkedAt: Date.now(), message: abort.signal.aborted ? '檢查逾時，保留目前版本；請稍後重試。' : error instanceof Error ? error.message : '無法連線，保留目前版本。' });
    } finally { clearTimeout(timeout); }
  }
}
export const siteUpdates = new SiteUpdateStore(currentSiteVersion);
/** A protected version URL is immutable; reload must return to the release entry. */
export function reloadWebsiteVersion(target: Pick<Location, 'pathname' | 'assign' | 'reload'> = window.location) {
  if (/^\/__build\/[a-f0-9]{64}\//.test(target.pathname)) target.assign('/');
  else target.reload();
}
export function applySiteUpdate(canApply: boolean, state: SiteUpdateState, confirm: () => boolean, reload: () => void): boolean {
  if (!canApply || state.status !== 'available' || !confirm()) return false;
  // Never clear localStorage or force a reload in a battle/editor.
  reload(); return true;
}
