import React from 'react';
import { Shuffle, Maximize2, X, ChevronDown, Zap, BookOpen, TestTubes, ScrollText, ChevronRight, Move } from 'lucide-react';
import type { Elf } from '../../types';
import type { ShellBridge } from '../bridge';
import type { TeamSummary } from '../lastTeam';
import { ElfAvatar } from '../../components/SeerImages';
import {HomePetFigure} from '../art/HomePetFigure';
import { typeColor } from '../art/figure';
import { readHeroLayout, writeHeroLayout, heroImageStyle, HeroLayoutPanel, type HeroLayout } from '../art/heroLayout';
import { isHapticsEnabled, toggleHaptics, haptic } from '../haptics';
import { cueCss } from '../../design/cues';

/** 換立繪抽屜只在點擊後才需要：獨立延後載入，搜尋規則與清單排序不進首頁初始 JS。 */
const HeroPicker = React.lazy(() => import('./HeroPicker'));

export function HeroStage({ summary, isPreview, onEdit, b }: {
  summary: TeamSummary;
  isPreview: boolean;
  onEdit: () => void;
  b: ShellBridge;
}) {
  // 使用者要求（2026-10-22）：
  //   1. 名稱、屬性、HP、三圍等資訊全部不要留
  //   2. 去掉背景半透明框（hero-stage 的漸層底與內描邊）
  //   3. 加上「換立繪」按鈕，可以換成其他精靈
  const [pickOpen, setPickOpen] = React.useState(false);
  const [overrideId, setOverrideId] = React.useState<string | null>(() => {
    try { return localStorage.getItem('seer_aegis_lobby_hero'); } catch { return null; }
  });
  const [layoutOpen, setLayoutOpen] = React.useState(false);
  const [layout, setLayout] = React.useState<HeroLayout>(() => readHeroLayout());
  const [positioning, setPositioning] = React.useState(false);
  const drag = React.useRef<{ id: number; x: number; y: number; width: number; height: number; layout: HeroLayout } | null>(null);

  const starter = b.allElvesCombined.find(e => e.id === overrideId) ?? summary.starter;
  if (!starter) return <div className="flex-1" />;

  return (
    <>
      <div className="hero-stage relative w-full overflow-hidden flex-1 min-h-[124px]"
        style={{ touchAction: positioning ? 'none' : 'auto', cursor: positioning ? 'move' : undefined }}
        onDragStart={e => { if (positioning) e.preventDefault(); }}
        onPointerDown={e => {
          if (!positioning || (e.target as HTMLElement).closest('button') || e.button !== 0) return;
          const r = e.currentTarget.getBoundingClientRect();
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, width: r.width, height: r.height, layout };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const clamp = (n: number) => Math.max(-80, Math.min(80, n));
          setLayout({ ...d.layout,
            offsetX: clamp((d.layout.offsetX ?? 0) + (e.clientX - d.x) / Math.max(1, d.width) * 100),
            offsetY: clamp(d.layout.offsetY + (e.clientY - d.y) / Math.max(1, d.height) * 100) });
        }}
        onPointerUp={e => {
          if (drag.current?.id !== e.pointerId) return;
          drag.current = null;
          writeHeroLayout(layout);
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; writeHeroLayout(layout); }}
      >
        {/* 屬性光暈（不是框，是角色背後的光） */}
        <span aria-hidden className="absolute -right-12 top-0 w-[78%] h-full" style={{
          background: `radial-gradient(ellipse at 72% 40%, ${typeColor(starter.type)}, transparent 64%)`,
          opacity: 0.3, filter: "blur(24px)",
        }} />

        {/* 角色立繪：吃滿整個區域，沒有任何框 */}
        <div className="absolute inset-0 pointer-events-none">
          {/*
            立繪四角是透明的（A=0），中央是角色本身的深色煙霧。
            不要再加 mask —— 加了反而會製造橢圓邊界（實測更糟）。
          */}
          <HomePetFigure
            elf={starter}
            style={heroImageStyle(layout)}
          />
        </div>

        {/* 立繪操作：三個圖示，垂直排在右上（2026-10-22 使用者要求全部改圖示） */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setPickOpen(true)}
            title="換立繪"
            aria-label="換立繪"
            className="hero-icon-btn"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setLayoutOpen(true)}
            title="位置與大小"
            aria-label="位置與大小"
            className="hero-icon-btn"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-pressed={positioning}
            onClick={() => { setPositioning(v => !v); writeHeroLayout(layout); }}
            title={positioning ? '完成拖動' : '拖動立繪'}
            aria-label={positioning ? '完成拖動' : '拖動立繪'}
            className="hero-icon-btn"
            data-active={positioning}
          >
            <Move className="w-4 h-4" />
          </button>
        </div>
      </div>

      {layoutOpen && (
        <HeroLayoutPanel
          value={layout}
          onChange={setLayout}
          onClose={() => setLayoutOpen(false)}
        />
      )}

      {/* 換立繪：精靈選擇 */}
      {pickOpen && (
        <React.Suspense fallback={null}><HeroPicker
          b={b}
          current={starter}
          onClose={() => setPickOpen(false)}
          onPick={(elf) => { setOverrideId(elf.id); try { localStorage.setItem('seer_aegis_lobby_hero', elf.id); } catch {} setPickOpen(false); }}
        /></React.Suspense>
      )}
    </>
  );
}


export function SettingsDrawer({ b, onClose, onSetup }: { b: ShellBridge; onClose: () => void; onSetup: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" data-shell-drawer aria-label="設定">
      <button type="button" aria-label="關閉" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        className="relative p-4 flex flex-col gap-3 max-h-[80dvh] overflow-y-auto"
        // 底部留出導航列高度，否則最後一個按鈕會被蓋住
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)",
          background: "linear-gradient(180deg, #0B1620, #060D14)",
          borderTop: "1px solid var(--p-accent)",
          borderRadius: "20px 20px 0 0",
          animation: `drawerUp ${cueCss("drawer")} ease-out`,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-black" style={{ color: "#F8FAFC" }}>對戰設定</span>
          <button type="button" onClick={onClose} className="p-1.5" style={{ borderRadius: 8, background: "rgba(255,255,255,0.08)" }}>
            <ChevronDown className="w-4 h-4" style={{ color: "#CBD5E1" }} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Choice active={b.battleMode === "PVE"} onClick={() => b.setBattleMode("PVE")} title="對戰 AI" sub="PVE" />
          <Choice active={b.battleMode === "PVP"} onClick={() => b.setBattleMode("PVP")} title="雙人同屏" sub="PVP" />
          <Choice active={b.hostPlayer === "p1"} onClick={() => b.setHostPlayer("p1")} title="房主 P1" sub="HOST" />
          <Choice active={b.hostPlayer === "p2"} onClick={() => b.setHostPlayer("p2")} title={b.battleMode === "PVE" ? "房主 AI（P2）" : "房主 P2"} sub="HOST" />
        </div>

        {/* 手感：觸覺回饋開關（預設開，可關） */}
        <HapticsToggle />

        {/* 真實入口（2026-10-22 使用者要求「設定請接上真正的設定」） */}
        <div className="flex flex-col gap-1">
          <span className="text-[8px] font-mono tracking-[0.18em]" style={{ color: "rgba(148,163,184,0.6)" }}>
            更多
          </span>
          <RealEntry icon={<Zap className="w-3.5 h-3.5" />} label="完整戰前設定" hint="賽制、AI、年費" onClick={onSetup} />
          <RealEntry icon={<BookOpen className="w-3.5 h-3.5" />} label="更新與精靈" hint="版本、精靈資料" onClick={() => { onClose(); b.setView("updates"); }} />
          <RealEntry icon={<TestTubes className="w-3.5 h-3.5" />} label="自動測試" hint="戰鬥邏輯驗證" onClick={() => { onClose(); b.setView("test_runner"); }} />
          <RealEntry icon={<ScrollText className="w-3.5 h-3.5" />} label="精靈圖鑑" hint="全精靈資料庫" onClick={() => { onClose(); b.setShowEncyclopedia(true); }} />
        </div>
      </div>
      <style>{`@keyframes drawerUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

/** 設定抽屜裡的真實入口列 */
function RealEntry({ icon, label, hint, onClick }: {
  icon: React.ReactNode; label: string; hint: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-2.5 py-2 text-left active:scale-[0.98] transition-transform"
      style={{
        borderRadius: 9,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(148,163,184,0.16)",
      }}
    >
      <span style={{ color: "var(--p-accent-hot)" }}>{icon}</span>
      <span className="flex flex-col leading-none min-w-0 flex-1">
        <span className="text-[11px] font-bold" style={{ color: "#E2E8F0" }}>{label}</span>
        <span className="text-[8px] mt-0.5" style={{ color: "rgba(148,163,184,0.7)" }}>{hint}</span>
      </span>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(148,163,184,0.5)" }} />
    </button>
  );
}

/** 觸覺開關：自己的 state，切換後立即反映 */
function HapticsToggle() {
  const [on, setOn] = React.useState(() => isHapticsEnabled());
  return (
    <button
      type="button"
      onClick={() => {
        const next = toggleHaptics();
        setOn(next);
        if (next) haptic("medium");
      }}
      className="flex items-center justify-between px-3 py-2.5 active:scale-[0.98] transition-transform"
      style={{
        borderRadius: 10,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(148,163,184,0.2)",
      }}
      aria-pressed={on}
    >
      <span className="flex flex-col items-start leading-none">
        <span className="text-[11px] font-bold" style={{ color: "#CBD5E1" }}>觸覺回饋</span>
        <span className="text-[8px] font-mono mt-0.5" style={{ color: "rgba(148,163,184,0.6)" }}>
          按鍵與開戰時的震動
        </span>
      </span>
      <span
        className="px-2.5 py-1 text-[10px] font-black"
        style={{
          borderRadius: 6,
          background: on ? "#22C55E" : "rgba(148,163,184,0.25)",
          color: on ? "#04121C" : "rgba(203,213,225,0.7)",
        }}
      >
        {on ? "開" : "關"}
      </span>
    </button>
  );
}

function Choice({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active}
      className="py-2.5 flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
      style={{
        borderRadius: 10,
        background: active ? "color-mix(in srgb, var(--p-accent) 20%, transparent)" : "rgba(255,255,255,0.05)",
        boxShadow: active ? "inset 0 0 0 1px var(--p-accent)" : "inset 0 0 0 1px rgba(148,163,184,0.18)",
      }}
    >
      <span className="text-[11px] font-bold" style={{ color: active ? "var(--p-accent-hot)" : "#CBD5E1" }}>{title}</span>
      <span className="text-[7.5px] font-mono tracking-wider" style={{ color: "rgba(148,163,184,0.6)" }}>{sub}</span>
    </button>
  );
}
