/**
 * Aegis 目錄（2026-11-07）：側欄抽屜與手機「目錄」底部面板共用。
 * 資料來源：shell/features.ts 的 AEGIS_DIRECTORY（頁面、覆蓋層與子分頁）。
 * 外觀：群組標題＋圖示列；有子項的條目可展開（目前所在的群組預設展開）。
 */
import React from "react";
import {
  Home, Swords, Disc, Rocket, Layers, Package, UserPlus, Book, Download, Settings, Gauge, TestTubes, Repeat, ChevronRight,
} from "lucide-react";
import { AEGIS_DIRECTORY, type DirectoryEntry, type DirectoryGroup } from "../features";

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  start: Home, battle: Swords, destiny_wheel: Disc, interstellar_exploration: Rocket, custom: Layers, bag: Package, editor: UserPlus,
  encyclopedia: Book, updates: Download, settings: Settings, performance_probe: Gauge, test_runner: TestTubes, switch_shell: Repeat,
};

const isActive = (e: DirectoryEntry, activeKey: string) => e.feature === activeKey || e.key === activeKey;

export function DirectoryList({ activeKey, onOpen, groups = AEGIS_DIRECTORY }: {
  activeKey: string; onOpen: (entry: DirectoryEntry) => void; groups?: readonly DirectoryGroup[];
}) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  return (
    <div className="shell-dir-list" data-shell-directory>
      {groups.map(g => (
        <section key={g.key} className="shell-dir-group" aria-label={g.label}>
          <h3 className="shell-dir-head">{g.label}</h3>
          {g.entries.map(e => {
            const Icon = ICON[e.key] || ICON[e.feature || ''] || Book;
            const active = isActive(e, activeKey);
            const expanded = open[e.key] ?? false;
            return (
              <div key={e.key}>
                <div className="shell-dir-row" data-active={active ? 'true' : undefined}>
                  <button type="button" className="shell-dir-item" data-dir-entry={e.key}
                    onClick={() => (e.action ? onOpen(e) : setOpen(v => ({ ...v, [e.key]: !expanded })))}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{e.label}</span>
                  </button>
                  {e.children?.length ? (
                    <button type="button" className="shell-dir-toggle" aria-label={`${expanded ? '收起' : '展開'}${e.label}`} aria-expanded={expanded}
                      data-dir-toggle={e.key} onClick={() => setOpen(v => ({ ...v, [e.key]: !expanded }))}>
                      <ChevronRight className="w-3.5 h-3.5" style={{ transform: expanded ? 'rotate(90deg)' : undefined }} />
                    </button>
                  ) : null}
                </div>
                {expanded && e.children?.map(c => (
                  <button key={c.key} type="button" className="shell-dir-sub" data-dir-entry={c.key} onClick={() => onOpen(c)}>{c.label}</button>
                ))}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** 桌面／橫向：左側抽屜。滑鼠移到左邊緣或點熱區展開；手機橫向從左邊緣右滑。 */
export function DirectoryRail({ activeKey, onOpen }: { activeKey: string; onOpen: (entry: DirectoryEntry) => void }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    let startX = 0, tracking = false;
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; tracking = startX < 20; };
    const onMove = (e: TouchEvent) => { if (tracking && e.touches[0].clientX - startX > 36) { setOpen(true); tracking = false; } };
    const onEnd = () => { tracking = false; };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
  }, []);
  return (
    <>
      <div className="shell-rail-hotzone" aria-hidden onPointerEnter={() => setOpen(true)} onClick={() => setOpen(o => !o)} />
      <nav className="shell-rail shell-rail-drawer shell-dir z-30" data-open={open} onPointerLeave={() => setOpen(false)} aria-hidden={!open} aria-label="目錄">
        <DirectoryList activeKey={activeKey} onOpen={entry => { setOpen(false); onOpen(entry); }} />
      </nav>
    </>
  );
}
