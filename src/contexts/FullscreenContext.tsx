import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { eventFullscreenShortcut, isEditableShortcutTarget, readFullscreenShortcut, shortcutLabel, storeFullscreenShortcut, type FullscreenShortcut } from '../utils/fullscreenShortcut';

interface DesktopFullscreen {
  status(): Promise<boolean>;
  set(enabled: boolean): Promise<void>;
  onChange(listener: (active: boolean) => void): () => void;
}

function desktopFullscreen(): DesktopFullscreen | undefined {
  return (window as Window & { seerDesktop?: { fullscreen?: DesktopFullscreen } }).seerDesktop?.fullscreen;
}

const FullscreenContext = createContext<{
  active: boolean;
  shortcut: FullscreenShortcut;
  setShortcut: (binding: FullscreenShortcut) => boolean;
  toggle: () => void;
} | null>(null);

export function useFullscreen() { return useContext(FullscreenContext); }

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [shortcut, setBinding] = useState(readFullscreenShortcut);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const current = useRef(false);

  useEffect(() => {
    let mounted = true;
    const update = (active: boolean) => {
      if (mounted) { current.current = active; setActive(active); }
    };
    const desktop = desktopFullscreen();
    if (desktop) {
      let receivedChange = false;
      const remove = desktop.onChange(active => { receivedChange = true; update(active); });
      void desktop.status().then(active => { if (!receivedChange) update(active); },
        () => { /* 桌面視窗尚未回報狀態。 */ });
      return () => { mounted = false; remove(); };
    }
    const sync = () => update(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => { mounted = false; document.removeEventListener('fullscreenchange', sync); };
  }, []);

  const toggle = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setError('');
    try {
      const desktop = desktopFullscreen();
      if (desktop) await desktop.set(!current.current);
      else if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setError('目前視窗不支援全螢幕。');
    } catch { setError('無法切換全螢幕，請使用按鈕再試一次。'); }
    finally { pending.current = false; }
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.composedPath().some(isEditableShortcutTarget)) return;
      const pressed = eventFullscreenShortcut(event);
      if (!pressed || shortcutLabel(pressed) !== shortcutLabel(shortcut)) return;
      event.preventDefault();
      void toggle();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [shortcut, toggle]);

  const setShortcut = (binding: FullscreenShortcut) => {
    if (!storeFullscreenShortcut(binding)) return false;
    setBinding(binding);
    return true;
  };

  return <FullscreenContext.Provider value={{ active, shortcut, setShortcut, toggle }}>
    {children}
    {error && <div role="status" className="fixed bottom-4 left-1/2 z-[10020] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-950 px-3 py-2 text-sm text-white shadow-xl">
      {error}<button type="button" className="underline" onClick={() => setError('')}>關閉</button>
    </div>}
  </FullscreenContext.Provider>;
}
