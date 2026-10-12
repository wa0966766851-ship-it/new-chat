import { useEffect, useState } from 'react';
type LauncherApi = {
  status(): Promise<{ supported: boolean; autoDesktopShortcut: boolean }>;
  preferences(enabled: boolean): Promise<{ autoDesktopShortcut: boolean }>;
  create(confirm: boolean): Promise<{ message: string }>;
};

/** 本機啟動器偏好不存localStorage：需與下次開啟的PowerShell共享。 */
export function LauncherSettingsPanel() {
  const desktop = typeof window === 'undefined' ? undefined : (window as unknown as { seerDesktop?: { launcher?: LauncherApi } }).seerDesktop?.launcher;
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('正在確認本機啟動器…');
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    const read = desktop ? desktop.status() : fetch('/api/launcher/preferences', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('unsupported');
      return response.json();
    });
    read.then(data => {
      if (alive) { setSupported(data.supported === true); setEnabled(data.autoDesktopShortcut === true); setMessage('預設不建立桌面捷徑。停用不會刪除已存在的捷徑。'); }
    }).catch(() => { if (alive) setMessage('此頁面未由新版本機啟動器啟動，不能修改桌面。請關閉舊伺服器並從本機啟動器重開；一般網站仍不會建立捷徑。'); })
      .finally(() => window.clearTimeout(timer));
    return () => { alive = false; controller.abort(); window.clearTimeout(timer); };
  }, [desktop]);
  const request = async (route: string, payload: { autoDesktopShortcut?: boolean; confirm?: boolean }) => {
    setBusy(true);
    try {
      let data: any;
      if (desktop) data = route.endsWith('preferences') ? await desktop.preferences(payload.autoDesktopShortcut!) : await desktop.create(payload.confirm!);
      else {
        const response = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        data = await response.json();
        if (!response.ok) throw new Error(data.error || '操作失敗');
      }
      if (route.endsWith('preferences')) { setEnabled(data.autoDesktopShortcut === true); setMessage(data.autoDesktopShortcut ? '已啟用；下次啟動時若缺少捷徑才建立，不覆寫既有捷徑。' : '已停用自動建立，既有捷徑保留。'); }
      else setMessage(data.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : '操作失敗'); }
    finally { setBusy(false); }
  };
  return <section className="ios-card p-4 space-y-3" aria-label="本機啟動與桌面捷徑">
    <h3 className="text-base font-semibold text-slate-100">本機啟動與桌面捷徑</h3>
    <p className="text-xs text-slate-400">{desktop ? '桌面版預設不建立捷徑；偏好保存在此電腦，不影響網站玩家。' : '本機啟動視窗不置頂，可最小化；關閉或按「停止啟動」會取消尚未完成的啟動，不會關閉已存在的其他伺服器。'}</p>
    <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
      缺少時自動建立桌面捷徑
      <input type="checkbox" aria-label="缺少時自動建立桌面捷徑" checked={enabled} disabled={!supported || busy}
        onChange={event => void request('/api/launcher/preferences', { autoDesktopShortcut: event.target.checked })} />
    </label>
    <button type="button" className="ios-button" disabled={!supported || busy} onClick={() => {
      if (window.confirm('建立本機啟動器的桌面捷徑？已有同名捷徑不會覆寫。')) void request('/api/launcher/shortcut', { confirm: true });
    }}>只建立一次桌面捷徑</button>
    <p role="status" className="text-xs text-slate-400 leading-relaxed">{message}</p>
  </section>;
}
