import React, { useId, useState } from "react";
import { HelpCircle } from "lucide-react";

/** 滑鼠、鍵盤與觸控皆可讀取；說明不佔主版面。 */
export function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <span className="info-hint group relative inline-flex align-middle" onMouseLeave={() => setOpen(false)}>
    <button type="button" aria-label={label} aria-describedby={id} aria-expanded={open}
      onClick={() => setOpen(!open)} onBlur={() => setOpen(false)} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-blue-400">
      <HelpCircle className="h-4 w-4" />
    </button>
    <span id={id} role="tooltip" className={`info-hint-content ${open ? "info-hint-open" : ""}`}>{children}</span>
  </span>;
}
