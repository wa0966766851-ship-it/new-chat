import { useEffect, useSyncExternalStore } from 'react';
import { applySiteUpdate, reloadWebsiteVersion, siteUpdates } from '../utils/siteUpdates';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** Check one tiny local manifest only while the menu is visible. Never reload a battle. */
export function SiteUpdateNotice({ active }: { active: boolean }) {
  const state = useSyncExternalStore(siteUpdates.subscribe, siteUpdates.getSnapshot, siteUpdates.getSnapshot);

  useEffect(() => {
    if (!active || (window as any).seerDesktop?.isElectron) return;
    let lastCheck = 0;
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      await siteUpdates.check();
    };
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    const initial = window.setTimeout(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
      document.removeEventListener('visibilitychange', check);
    };
  }, [active]);

  if (!active || state.status !== 'available') return null;
  return (
    <div role="status" className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded-xl border border-blue-400/40 bg-slate-950/95 px-4 py-3 text-sm text-white shadow-xl">
      <span>網站有不同版本可載入</span>
      <button type="button" onClick={() => applySiteUpdate(active, state, () => window.confirm('重新整理會關閉目前頁面；已儲存的本機資料不會清除。確定套用？'), reloadWebsiteVersion)} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500">
        套用網站更新
      </button>
    </div>
  );
}
