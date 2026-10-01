import { useEffect, useState } from 'react';

declare const __APP_COMMIT__: string;

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** Check one tiny local manifest only while the menu is visible. Never reload a battle. */
export function SiteUpdateNotice({ active }: { active: boolean }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!active || !__APP_COMMIT__) return;
    let cancelled = false;
    let lastCheck = 0;
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      try {
        const response = await fetch('/version.json', { cache: 'no-store' });
        if (!response.ok) return;
        const data: unknown = await response.json();
        const commit = typeof data === 'object' && data !== null && 'commit' in data ? (data as { commit?: unknown }).commit : null;
        if (!cancelled && typeof commit === 'string' && /^[a-f0-9]{40}$/.test(commit)) {
          setAvailable(commit !== __APP_COMMIT__);
        }
      } catch { /* Offline play still works; check again later. */ }
    };
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    const initial = window.setTimeout(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(initial);
      document.removeEventListener('visibilitychange', check);
    };
  }, [active]);

  if (!active || !available) return null;
  return (
    <div role="status" className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded-xl border border-blue-400/40 bg-slate-950/95 px-4 py-3 text-sm text-white shadow-xl">
      <span>遊戲已有新版本</span>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500">
        重新整理套用
      </button>
    </div>
  );
}
