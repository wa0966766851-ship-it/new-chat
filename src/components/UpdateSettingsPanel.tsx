import { useEffect, useState, useSyncExternalStore } from 'react';
import { applySiteUpdate, currentSiteVersion, reloadWebsiteVersion, siteUpdates, type SiteUpdateStore } from '../utils/siteUpdates';
type DesktopState = { status: string; currentVersion?: string; version?: string; kind?: string; size?: number; received?: number; total?: number; message?: string; executableBackup?: string };
type DesktopUpdates = { check(): Promise<DesktopState>; status(): Promise<DesktopState>; download(snapshot: string): Promise<DesktopState>; cancel(): Promise<DesktopState>; openFolder(): Promise<string> };
const desktopApi = () => typeof window === 'undefined' ? undefined : (window as unknown as { seerDesktop?: { updates?: DesktopUpdates } }).seerDesktop?.updates;
export function createPlayerBackup(storage: Storage, origin: string): string {
  const values: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith('seer_') || /key|token|secret|password/i.test(key)) continue;
    const value = storage.getItem(key); if (value !== null) values[key] = value;
  }
  const json = JSON.stringify({ schemaVersion: 1, origin, createdAt: new Date().toISOString(), storage: values }, null, 2);
  if (new TextEncoder().encode(json).length > 4 * 1024 * 1024) throw new Error('本機資料超過 4 MB，請先使用精靈／背包匯出功能備份。');
  return json;
}
const siteMessages = { idle: '尚未檢查', checking: '正在檢查網站部署…', latest: '目前與伺服器提供的版本相同', available: '伺服器有不同版本，可重新整理載入', error: '檢查未完成，保留目前版本', development: '開發預覽，不是正式部署版本' };
export function UpdateSettingsPanel({ canApplyUpdates, store = siteUpdates }: { canApplyUpdates: boolean; store?: SiteUpdateStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [desktop, setDesktop] = useState<DesktopState>({ status: 'idle' });
  const [feedback, setFeedback] = useState(''); const api = desktopApi();
  useEffect(() => {
    if (!api) return; let mounted = true;
    const read = () => api.status().then(value => { if (mounted) setDesktop(value); }).catch(() => { if (mounted) setFeedback('無法取得桌面更新狀態'); });
    void read(); const timer = window.setInterval(read, 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, [api]);
  const backup = () => {
    try {
      const json = createPlayerBackup(localStorage, location.origin);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `seer-player-backup-${Date.now()}.json`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setFeedback('已送出備份下載，請確認檔案已儲存；原存檔未修改。');
    } catch (error) { setFeedback(error instanceof Error ? error.message : '備份失敗'); }
  };
  const checkDesktop = async () => {
    if (!api) return; setDesktop(previous => ({ ...previous, status: 'checking' }));
    try { setDesktop(await api.check()); } catch { setFeedback('桌面版本檢查失敗，舊程式保留。'); setDesktop(previous => ({ ...previous, status: 'error' })); }
  };
  const download = async () => {
    if (!api || !window.confirm('新版會另存，不自動執行或覆寫。會備份本機資料；免安裝版也會核對舊 EXE 備份。確定下載？')) return;
    try { const json = createPlayerBackup(localStorage, location.origin); setDesktop(previous => ({ ...previous, status: 'downloading' })); setDesktop(await api.download(json)); }
    catch (error) { setDesktop(previous => ({ ...previous, status: 'error' })); setFeedback(error instanceof Error ? error.message : '下載失敗，舊程式保留。'); }
  };
  const desktopMessages: Record<string, string> = { idle: '尚未檢查', checking: '正在查詢 GitHub…', latest: '沒有較新的正式版本', available: `可下載 ${desktop.version}（${((desktop.size || 0) / 1e6).toFixed(1)} MB）`, unpublished: 'GitHub 尚未發布可下載的正式版本', downloading: '下載與完整性校驗中…', downloaded: '新版已另存，舊程式保留', cancelled: '下載已取消，舊版保留', error: '檢查／下載失敗，請稍後重試' };
  return <div className="space-y-4" data-update-settings>
    <section className="ios-card p-4 space-y-3">
      <h3 className="text-base font-semibold text-slate-100">網站更新</h3>
      <p className="text-xs text-slate-400 leading-relaxed">檢查此網站是否已部署新內容。套用只重新載入頁面，不清除本機精靈、背包與進度；GitHub 原始碼更新不代表網站已部署。</p>
      <p className="text-xs text-slate-300">目前 {currentSiteVersion.version || '開發中'} · {(currentSiteVersion.buildId || currentSiteVersion.commit || '無正式標記').slice(0, 10)}</p>
      {state.remote?.version && <p className="text-xs text-slate-300">伺服器 {state.remote.version} · {(state.remote.buildId || state.remote.commit || '').slice(0, 10)}</p>}
      {state.checkedAt && <p className="text-xs text-slate-400">最後檢查：{new Date(state.checkedAt).toLocaleTimeString('zh-TW')}</p>}
      <p role="status" aria-live="polite" className="text-sm text-slate-200">{api ? '桌面版的本機頁面隨 EXE 更新，不用重新整理升級。' : state.message || siteMessages[state.status]}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ios-button" disabled={!!api || state.status === 'checking'} onClick={() => void store.check()}>檢查網站更新</button>
        {!api && state.status === 'available' && <button type="button" className="ios-button-primary" disabled={!canApplyUpdates} onClick={() => applySiteUpdate(canApplyUpdates, state, () => window.confirm('確定重新整理套用網站更新？已儲存資料不會清除；未儲存的內容會離開。'), () => reloadWebsiteVersion())}>套用網站更新</button>}
      </div>
      {!canApplyUpdates && <p className="text-xs text-amber-300">可檢查版本；請結束戰鬥／編輯並回首頁，再套用更新。</p>}
    </section>
    <section className="ios-card p-4 space-y-3" aria-label="管理者網站發布">
      <h3 className="text-base font-semibold text-slate-100">管理者：建置與發布</h3>
      <p className="text-xs text-slate-400 leading-relaxed">這是更新網站伺服器，不是重新整理玩家頁面。需要 GitHub 專案操作權限；受邀玩遊戲不代表有發布權。</p>
      <a className="ios-button inline-flex" href="https://github.com/wa0966766851-ship-it/new-chat/actions" target="_blank" rel="noopener noreferrer">前往 GitHub 建置／發布</a>
      <p className="text-xs text-slate-400 leading-relaxed">選擇 Build website package without AI → Run workflow：不勾 publish 只建置及驗證，勾選才發布。固定流程不呼叫 AI，但可能使用 GitHub 建置額度。此按鈕僅開啟管理頁，不會自行啟動發布或變更網站分享設定。</p>
    </section>
    <section className="ios-card p-4 space-y-3">
      <h3 className="text-base font-semibold text-slate-100">桌面版／GitHub 更新</h3>
      {api ? <>
        <p className="text-xs text-slate-400">目前 {desktop.currentVersion || currentSiteVersion.version} · {desktop.kind === 'portable' ? '免安裝版' : '安裝版'}。只下載已提供 SHA-256 的 Windows x64 正式版本，不自動覆寫或安裝。</p>
        <p role="status" className="text-sm text-slate-200">{desktop.message || desktopMessages[desktop.status]}</p>
        {desktop.status === 'downloading' && <progress aria-label="新版下載進度" className="w-full" value={desktop.received || 0} max={desktop.total || desktop.size || 1} />}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ios-button" disabled={['checking', 'downloading'].includes(desktop.status)} onClick={checkDesktop}>檢查桌面更新</button>
          {desktop.status === 'available' && <button type="button" className="ios-button-primary" onClick={download}>下載新版，不覆寫</button>}
          {desktop.status === 'downloading' && <button type="button" className="ios-button" onClick={() => void api.cancel()}>取消下載</button>}
          {desktop.status === 'downloaded' && <button type="button" className="ios-button" onClick={() => void api.openFolder().then(message => { if (message) setFeedback(message); })}>開啟新版與備份資料夾</button>}
        </div>
        {desktop.status === 'downloaded' && <p className="text-xs text-slate-400">{desktop.executableBackup ? '舊免安裝 EXE 已備份並核對。' : '原安裝目錄未變動；尚無安裝版整包自動回滾。'} 本機資料已另存 JSON；新來源不會自動遷移存檔。</p>}
      </> : <p className="text-sm text-slate-300">網頁使用者更新此網站即可；若需 Windows EXE，可至 <a className="text-blue-300 underline" href="https://github.com/wa0966766851-ship-it/new-chat/releases" target="_blank" rel="noopener noreferrer">GitHub 正式下載頁</a>。瀏覽器不會自行改寫網站伺服器。</p>}
    </section>
    <button type="button" className="ios-button" onClick={backup}>匯出本機資料備份</button>
    {feedback && <p role="status" className="text-xs text-slate-300">{feedback}</p>}
  </div>;
}
