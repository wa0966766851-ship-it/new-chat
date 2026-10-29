import React from "react";
import { Settings, BookOpen, ScrollText, Wifi, ChevronDown, MoreHorizontal } from "lucide-react";

/**
 * 手遊外殼元件 — 頂部列與側邊導航
 *
 * 為什麼要重寫（原本的問題）：
 *   舊的頂部列是「網頁 App 標頭」：品牌名 + AEGIS 徽章 + 麵包屑「首頁/模式 · 原生畫面」+ 兩顆方按鈕。
 *   那是桌面工具的心智模型。手遊的頂部列不是標題列，是「狀態與快捷」：
 *     左邊 → 3–4 顆小圖示（設定／通知／活動／信件）
 *     右邊 → 玩家頭像 + 等級 + 資源
 *   標題不寫，因為你已經在遊戲裡了，不需要告訴你「這是什麼網站」。
 */

/* ────────────── 頂部工具列 ────────────── */

export function TopUtilityBar({
  onSettings, onSwitchShell, onEncyclopedia, onUpdates,
  player, resources, shellLabel,
}: {
  onSettings: () => void;
  onSwitchShell: () => void;
  onEncyclopedia?: () => void;
  onUpdates?: () => void;
  player: React.ReactNode;
  resources?: React.ReactNode;
  shellLabel: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <header
      className="shell-topbar relative z-30 flex items-center gap-2 px-2.5 shrink-0"
      data-expanded={expanded}
      style={{
        paddingTop: "max(8px, env(safe-area-inset-top))",
        paddingBottom: 6,
      }}
    >
      {/* 左：小圖示群（手遊的「工具抽屜」） */}
      {/* 2026-10-22：左側清空——只留給 AegisShell 的返回鈕。
          設定/百科/更新全部移到右側（與 Legacy 切換鈕一起）。 */}
      <div className="shrink-0" style={{ minWidth: 56 }} />

      {/* 中：玩家（頭像 + 等級 + 經驗） */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {player}
      </div>
      <button type="button" aria-label={expanded ? '收起玩家資訊' : '展開玩家資訊'} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}><ChevronDown size={18} /></button>

      {/* 右：資源 */}
      {expanded && resources && (
        <div className="flex items-center gap-1 shrink-0 max-[380px]:hidden">
          {resources}
        </div>
      )}

      {/* 2026-10-22：頂欄不再放設定齒輪——ControlHub 自帶入口鈕（右上 fixed），
          兩者重疊且同功能。頂欄只留 百科/更新。 */}
      <div className="flex items-center gap-0.5 shrink-0">
                <IconButton onClick={onSettings} title="系統控制中心"><Settings className="w-[15px] h-[15px]" /></IconButton>
{onEncyclopedia && (
          <IconButton onClick={onEncyclopedia} title="戰鬥百科"><BookOpen className="w-[15px] h-[15px]" /></IconButton>
        )}
        {onUpdates && (
          <IconButton onClick={onUpdates} title="更新與精靈"><ScrollText className="w-[15px] h-[15px]" /></IconButton>
        )}
      </div>

      {/* 殼切換：2026-10-29 放大到 40x40 最小觸控熱區（原本 13px 圖示 + 9px 文字，手機點不到） */}
      <button
        type="button"
        onClick={onSwitchShell}
        className="shrink-0 flex items-center justify-center gap-1 active:scale-95 transition-transform"
        style={{
          minWidth: 40,
          minHeight: 40,
          padding: "0 4px",
          borderRadius: 10,
          color: "var(--p-accent-hot)",
          textShadow: "0 1px 4px rgba(0,0,0,0.9)",
        }}
        title={`切換到 ${shellLabel} 介面`}
        aria-label={`切換到 ${shellLabel} 介面`}
      >
        <Wifi className="w-[18px] h-[18px]" />
        <span className="text-[11px] font-bold leading-none">{shellLabel}</span>
      </button>
    </header>
  );
}

function IconButton({ children, onClick, title }: {
  children: React.ReactNode; onClick: () => void; title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="relative flex items-center justify-center active:scale-90 transition-transform"
      style={{ width: 30, height: 28, borderRadius: 9, color: "rgba(203,213,225,0.82)" }}
    >
      {children}
    </button>
  );
}

/* ────────────── 側邊導航（橫向 / 桌面） ────────────── */

export interface RailItem {
  id: string;
  short: string;
  label: string;
  icon: React.ReactNode;
}

export function SideRail({
  items, activeId, onSelect, onSettings,
}: {
  items: RailItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onSettings?: () => void;
}) {
  /*
    側欄可隱藏（使用者要求 2026-10-22）：
      預設只留 10px 的「提示條」，滑鼠移上去 / 鍵盤聚焦時展開成 62px。
    為什麼不整個消失：
      完全消失會讓人不知道有導航；留一條細提示條可以「被發現」。
    手機不受影響：直向本來就用 BottomBar。
  */
  const [open, setOpen] = React.useState(false);

  // 手機：從左邊緣往右滑，或從底部往上滑都可展開
  React.useEffect(() => {
    let startX = 0, startY = 0, tracking = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      // 只在「靠左 20px」或「靠底 60px」開始追蹤
      tracking = startX < 20 || startY > window.innerHeight - 60;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = startY - t.clientY; // 往上為正
      if (dx > 36 || dy > 36) { setOpen(true); tracking = false; }
    };
    const onEnd = () => { tracking = false; };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  /*
    2026-10-22 重做（使用者要求）：
      「不是要做隱藏按鈕，是隱藏整個欄位，整個欄位可以收起來」
      「電腦端是鼠標，手機端就用手勢往上拉起」

    做法：改成 absolute 浮層抽屜。
      收起：translateX(-100%) —— 完全不佔版面寬度，只剩一條 3px 的邊緣熱區
      展開：滑鼠移到左邊緣 / 點熱區 / 手機上滑
  */
  return (
    <>
      {/* 邊緣熱區：3px，滑鼠碰到就展開（不佔版面） */}
      <div
        className="shell-rail-hotzone"
        aria-hidden
        onPointerEnter={() => setOpen(true)}
        onClick={() => setOpen(o => !o)}
      />
      <nav
        className="shell-rail shell-rail-drawer flex flex-col items-center gap-0.5 py-2 z-30"
        data-open={open}
        onPointerLeave={() => setOpen(false)}
        aria-hidden={!open}
      >
      {items.map((f, i) => {
        const active = activeId === f.id;
        return (
          <React.Fragment key={f.id}>
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              title={f.label}
              className="relative w-full flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
              style={{
                height: 46,
                borderRadius: 12,
                background: active
                  ? "linear-gradient(135deg, color-mix(in srgb, var(--p-accent) 26%, transparent) 0%, color-mix(in srgb, var(--p-accent) 8%, transparent) 100%)"
                  : "transparent",
                color: active ? "var(--p-accent-hot)" : "rgba(148,163,184,0.72)",
                boxShadow: active ? "inset 0 0 0 1px color-mix(in srgb, var(--p-accent) 42%, transparent)" : "none",
              }}
            >
              {/* 左側指示條：手遊常見的「你在這」標記 */}
              {active && (
                <span
                  className="absolute"
                  style={{
                    left: -6, top: 12, bottom: 12, width: 2.5, borderRadius: 999,
                    background: "var(--p-accent)", boxShadow: "0 0 8px var(--p-accent)",
                  }}
                />
              )}
              <span className="flex items-center justify-center" style={{ height: 18 }}>
                {React.cloneElement(f.icon as React.ReactElement, { className: "w-[17px] h-[17px]" })}
              </span>
              <span className="text-[8px] leading-none font-bold">{f.short}</span>
            </button>
            {i === 4 && (
              <span style={{ width: 22, height: 1, background: "rgba(148,163,184,0.18)", margin: "4px 0" }} />
            )}
          </React.Fragment>
        );
      })}

      <div className="mt-auto">
        {onSettings && (
          <button
            type="button"
            onClick={onSettings}
            title="系統控制中心"
            className="w-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ height: 38, borderRadius: 12, color: "rgba(148,163,184,0.6)" }}
          >
            <Settings className="w-[16px] h-[16px]" />
          </button>
        )}
      </div>
      </nav>
    </>
  );
}

/* ────────────── 底部導航（直向） ────────────── */

export function BottomBar({
  items, activeId, onSelect,
}: {
  items: RailItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  /**
   * 2026-10-29：手機底部欄原本硬砍 slice(0, 5)，導覽 7 項時「測試」「更新」完全到不了。
   * 改成：前 4 項固定 + 第 5 格「更多」，點開列出剩餘項目。
   */
  const [moreOpen, setMoreOpen] = React.useState(false);
  const MAX_VISIBLE = 4;
  const overflow = items.length > MAX_VISIBLE + 1 ? items.slice(MAX_VISIBLE) : [];
  const visible = overflow.length ? items.slice(0, MAX_VISIBLE) : items;
  const overflowActive = overflow.some(f => f.id === activeId);
  React.useEffect(() => { if (!moreOpen) return; const on = () => setMoreOpen(false);
    window.addEventListener("pointerdown", on); return () => window.removeEventListener("pointerdown", on); }, [moreOpen]);
  return (
    <nav
      className="flex items-stretch justify-around shrink-0 relative z-20"
      style={{
        paddingBottom: "max(6px, env(safe-area-inset-bottom))",
        paddingTop: 4,
        background: "linear-gradient(180deg, rgba(4,10,18,0.35) 0%, rgba(4,10,18,0.92) 42%, rgba(4,10,18,0.98) 100%)",
        borderTop: "1px solid rgba(148,163,184,0.12)",
      }}
    >
      {visible.map(f => {
        const active = activeId === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 min-h-[50px] active:scale-95 transition-transform"
            style={{ color: active ? "var(--p-accent-hot)" : "rgba(148,163,184,0.66)" }}
          >
            <span
              className="flex items-center justify-center transition-all relative"
              style={{ width: 34, height: 24 }}
            >
              {active && (
                <span
                  className="absolute inset-0"
                  style={{
                    borderRadius: 8,
                    background: "color-mix(in srgb, var(--p-accent) 20%, transparent)",
                    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--p-accent) 38%, transparent)",
                  }}
                />
              )}
              <span className="relative">{React.cloneElement(f.icon as React.ReactElement, { className: "w-[17px] h-[17px]" })}</span>
            </span>
            <span className="text-[9.5px] leading-none font-bold">{f.short}</span>
            {active && (
              <span
                style={{
                  width: 14, height: 2, borderRadius: 999,
                  background: "var(--p-accent)", boxShadow: "0 0 6px var(--p-accent)",
                }}
              />
            )}
          </button>
        );
      })}
      {overflow.length > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMoreOpen(v => !v); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 min-h-[50px] active:scale-95 transition-transform"
          style={{ color: moreOpen || overflowActive ? "var(--p-accent-hot)" : "rgba(148,163,184,0.66)" }}
          aria-label="更多功能"
          aria-expanded={moreOpen}
        >
          <span className="flex items-center justify-center transition-all relative" style={{ width: 34, height: 24 }}>
            {(moreOpen || overflowActive) && (
              <span className="absolute inset-0" style={{ borderRadius: 8,
                background: "color-mix(in srgb, var(--p-accent) 20%, transparent)",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--p-accent) 38%, transparent)" }} />
            )}
            <span className="relative"><MoreHorizontal className="w-[17px] h-[17px]" /></span>
          </span>
          <span className="text-[9.5px] leading-none font-bold">更多</span>
          {(moreOpen || overflowActive) && (
            <span style={{ width: 14, height: 2, borderRadius: 999,
              background: "var(--p-accent)", boxShadow: "0 0 6px var(--p-accent)" }} />
          )}
        </button>
      )}
      {moreOpen && overflow.length > 0 && (
        <div
          className="absolute right-2 z-30 flex flex-col gap-1 p-1.5"
          style={{ bottom: "calc(100% + 8px)", borderRadius: 12,
            background: "rgba(6,14,24,0.97)", border: "1px solid rgba(148,163,184,0.22)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.55)" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {overflow.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setMoreOpen(false); onSelect(f.id); }}
              className="flex items-center gap-2 px-3 py-2 active:scale-95 transition-transform"
              style={{ borderRadius: 8, minHeight: 40, minWidth: 110,
                color: activeId === f.id ? "var(--p-accent-hot)" : "rgba(203,213,225,0.9)",
                background: activeId === f.id ? "color-mix(in srgb, var(--p-accent) 18%, transparent)" : "transparent" }}
            >
              <span className="flex items-center justify-center" style={{ width: 20, height: 20 }}>
                {React.cloneElement(f.icon as React.ReactElement, { className: "w-[16px] h-[16px]" })}
              </span>
              <span className="text-[12px] font-bold leading-none">{f.short}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}