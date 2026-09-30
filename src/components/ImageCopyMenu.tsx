import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { copyImageToClipboard } from "../utils/copyImage";

export const IMAGE_COPY_EVENT = "seer-image-copy-menu";
interface MenuData { src: string; name: string; x: number; y: number }
export function ImageCopyMenu() {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const open = (event: Event) => { clearTimeout(timer.current); setMenu((event as CustomEvent<MenuData>).detail); setMessage(""); };
    const context = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const image = event.target.closest("img");
      if (!image?.src) return;
      event.preventDefault();
      clearTimeout(timer.current);
      setMenu({ src: image.currentSrc || image.src, name: image.alt || "圖片", x: event.clientX, y: event.clientY });
      setMessage("");
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    window.addEventListener(IMAGE_COPY_EVENT, open);
    window.addEventListener("keydown", key);
    window.addEventListener("contextmenu", context);
    return () => { window.removeEventListener(IMAGE_COPY_EVENT, open); window.removeEventListener("keydown", key); window.removeEventListener("contextmenu", context); clearTimeout(timer.current); };
  }, []);
  if (!menu) return null;
  return createPortal(<div className="fixed inset-0 z-[12000]" onClick={() => { if (!busy) setMenu(null); }}>
    <div role="dialog" aria-label="複製圖片" className="fixed rounded-2xl border border-white/15 bg-slate-950 p-3 shadow-2xl w-[240px] text-sm text-slate-200" style={{ left: Math.max(8, Math.min(menu.x, window.innerWidth - 248)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 160)) }} onClick={e => e.stopPropagation()}>
      <p className="text-xs text-slate-400 mb-2 truncate">{menu.name || "圖片"}</p>
      <button type="button" autoFocus disabled={busy} className="w-full rounded-xl p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50" onClick={async () => {
        setBusy(true); setMessage("");
        try {
          await copyImageToClipboard(menu.src);
          setMessage("已複製圖片");
          clearTimeout(timer.current); timer.current = setTimeout(() => setMenu(null), 1500);
        } catch { setMessage("複製失敗：請檢查剪貼簿權限或圖片的跨站存取限制。"); }
        finally { setBusy(false); }
      }}>{busy ? "複製中…" : "複製圖片本身"}</button>
      {message && <p role="status" className="text-xs leading-5 mt-2">{message}</p>}
    </div>
  </div>, document.body);
}
