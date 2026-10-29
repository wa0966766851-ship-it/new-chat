import React, { Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Menu, Home, Settings, Book, Swords, TestTubes } from "lucide-react";
import type { ShellBridge } from "./bridge";
import { LegacyScenes } from "./scenes/LegacyScenes";
import { ElfAvatar } from "../components/SeerImages";
import { DEFAULT_ELVES } from "../data/defaultElves";
import { SiteUpdateNotice } from "../components/SiteUpdateNotice";
import { ThemeBackground } from "../components/ThemeController";
import { ImageCopyMenu } from "../components/ImageCopyMenu";
import { PageErrorBoundary } from "../components/PageErrorBoundary";
import TechLoadingScreen from "../components/TechLoadingScreen";
import { BattleLoadingScreen } from "../components/battle/BattleLoadingScreen";

const ControlHub = lazy(() => import("../components/ControlHub"));
const Encyclopedia = lazy(() => import("../components/Encyclopedia"));
const PerformanceProbe = lazy(() => import("../components/PerformanceProbe"));

/**
 * LegacyShell — 既有的桌面工作台外殼
 *
 * 從 App.tsx 原樣抽出（側欄 / 主區 / 底欄），行為與外觀不變。
 * 唯一新增：右下角的「切換到 Aegis」按鈕。
 */
export interface LegacyShellProps {
  b: ShellBridge;
  showHeader: boolean;
  setShowHeader: (v: boolean) => void;
  isCompactLayout: boolean;
}

export function LegacyShell({ b, showHeader, setShowHeader, isCompactLayout }: LegacyShellProps) {
  const navItems = [
    { id: "start", label: "首頁 / 模式", icon: <Home className="w-5 h-5" />, onClick: () => b.setView("start") },
    { id: "custom", label: "精靈自定", icon: <Settings className="w-5 h-5" />, onClick: () => b.setView("custom") },
    { id: "encyclopedia", label: "戰鬥百科", icon: <Book className="w-5 h-5" />, onClick: () => b.setShowEncyclopedia(true) },
    {
      id: "battle",
      label: "實戰演練",
      icon: <Swords className="w-5 h-5" />,
      onClick: () => {
        if (b.p1Team.length > 0 && b.p2Team.length > 0) b.setView("battle");
        else {
          const t1 = b.allElves[0] ? [b.allElves[0]] : [];
          const t2 = b.allElves[1] ? [b.allElves[1]] : (b.allElves[0] ? [b.allElves[0]] : []);
          if (t1.length > 0 && t2.length > 0) b.handleStartBattle(b.battleMode, t1, t2, t1[0].id, t2[0].id);
        }
      },
    },
    { id: "test_runner", label: "自動測試", icon: <TestTubes className="w-5 h-5" />, onClick: () => b.setView("test_runner") },
    { id: "updates", label: "更新與精靈", icon: <Book className="w-5 h-5" />, onClick: () => b.setView("updates") },
  ];

  const activeId = b.showEncyclopedia ? "encyclopedia" : b.view;

  return (
    <div className="h-screen w-full flex relative bg-transparent text-slate-100 overflow-hidden" id="app-wrapper">
      <Suspense fallback={null}>
        <ControlHub
          currentScene={b.showEncyclopedia ? "encyclopedia" : b.view}
          canApplyUpdates={b.view === "start" && !b.editingElf && !b.showEncyclopedia}
        />
      </Suspense>

      <aside
        style={{ width: showHeader ? 256 : 0, transition: "width 220ms ease-out" }}
        className={`ios-sidebar shrink-0 h-full shadow-2xl overflow-hidden ${isCompactLayout ? "fixed inset-y-0 left-0 z-[100]" : "relative z-[50]"} ${showHeader ? "border-r" : "border-r-0"}`}
        aria-hidden={!showHeader}
      >
        <div className="w-64 h-full flex flex-col relative">
          <div
            onClick={() => setShowHeader(false)}
            className="absolute right-0 top-0 bottom-0 w-3 cursor-pointer flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/5 transition-colors z-20"
            title="隱藏側邊欄"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </div>

          <div className="p-5 border-b border-slate-800 flex items-center justify-between pr-8">
            <button
              onClick={() => b.setView("start")}
              className="flex items-center gap-3 text-slate-100 hover:text-white select-none cursor-pointer font-display"
            >
              <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-blue-400/30 bg-blue-950/20 shrink-0" title="聖靈譜尼 · 右鍵可複製圖片">
                <ElfAvatar elf={DEFAULT_ELVES.find(elf => elf.name === "聖靈譜尼") || DEFAULT_ELVES[0]} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col items-start overflow-hidden">
                <h1 className="text-base font-bold tracking-tight text-blue-400 flex items-center whitespace-nowrap">賽爾號模擬器</h1>
                <span className="text-[10px] font-normal text-slate-500 uppercase bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded mt-1">v1.0 Beta</span>
              </div>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto flex flex-col gap-2 p-4">
            <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">選單</div>
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={activeId === item.id ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer w-full text-left ${
                  activeId === item.id
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800 flex flex-col gap-4 pr-6">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
              className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer w-full text-left text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50 group"
            >
              <Settings className="w-5 h-5 text-blue-400 group-hover:rotate-90 transition-transform" />
              系統控制中心
            </button>

            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-medium text-xs flex items-center gap-2 bg-emerald-400/10 px-2.5 py-1.5 rounded-md border border-emerald-400/20">
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                連線就緒
              </span>
              <button
                onClick={() => setShowHeader(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="隱藏側邊欄"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {isCompactLayout && showHeader && (
        <button
          type="button"
          aria-label="關閉側邊欄"
          onClick={() => setShowHeader(false)}
          className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-[1px]"
        />
      )}

      {!showHeader && (
        <button
          onClick={() => setShowHeader(true)}
          className="fixed top-4 left-0 z-[90] p-3 bg-slate-900/80 backdrop-blur-md border border-l-0 border-slate-700 rounded-r-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
          title="展開側邊欄"
        >
          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
          <Menu className="w-5 h-5" />
        </button>
      )}

      <div className="flex-grow flex flex-col h-full overflow-hidden relative z-[60]">
        <SiteUpdateNotice active={b.view === "start" && !b.editingElf} />
        <main className="flex-grow flex flex-col bg-transparent relative overflow-y-auto overflow-x-hidden w-full">
          <ThemeBackground currentScene={b.showEncyclopedia ? "encyclopedia" : b.view} />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-15 pointer-events-none -z-10"></div>

          {b.isTransitioning && (
            <BattleLoadingScreen p1Team={b.p1Team} p2Team={b.p2Team}
              p1StarterId={b.p1StarterId} p2StarterId={b.p2StarterId} format={b.battleFormat} battleMode={b.battleMode} />
          )}

          <LegacyScenes b={b} />

          {b.showEncyclopedia && createPortal(
            <PageErrorBoundary onBack={() => b.setShowEncyclopedia(false)}>
              <Suspense fallback={<TechLoadingScreen />}>
                <Encyclopedia onClose={() => b.setShowEncyclopedia(false)} />
              </Suspense>
            </PageErrorBoundary>,
            document.body
          )}
          <ImageCopyMenu />
          {b.showPerformanceProbe && (
            <Suspense fallback={null}>
              <PerformanceProbe onClose={() => b.setShowPerformanceProbe(false)} />
            </Suspense>
          )}
        </main>

        {b.view !== "battle" && (
          <footer className="bg-slate-900/85 backdrop-blur-md border-t border-slate-800 py-3 sm:py-0 sm:h-10 flex flex-col sm:flex-row items-center px-4 sm:px-8 text-[10px] text-slate-400 gap-2 sm:gap-8 font-mono shrink-0 select-none relative z-10">
            <span>計算公式: [(攻擊方LV×0.4+2)×技能威力×攻擊/防禦/50+2]×修正</span>
            <span className="hidden md:inline">屬性係數: 本系修正(1.5x) / 克制係數(0.5x-4.0x)</span>
            <span className="hidden sm:ml-auto">© 2026 AI 賽爾號對戰模擬器 - 繁體中文版</span>
          </footer>
        )}
      </div>

    </div>
  );
}

/**
 * 殼切換按鈕（兩殼共用同一顆）
 *
 * 用 portal 掛到 document.body：
 * 任何殼的 overflow / transform / backdrop-filter 都不會裁掉它或改變它的定位基準。
 * 位置固定右下；在 Aegis 直向版面時抬高到導航列之上。
 */
export function ShellSwitchButton({ onClick, target }: { onClick: () => void; target: "legacy" | "aegis" }) {
  const [offset, setOffset] = React.useState(76);

  React.useEffect(() => {
    const compute = () => {
      // Aegis 直向有底部導航列（約 64px + 安全區），需抬高；其餘情況貼右下
      const shell = document.getElementById("aegis-shell");
      const vertical = shell ? shell.dataset.layout : "legacy";
      setOffset(vertical === "vertical" ? 84 : 16);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const label = target === "aegis" ? "Aegis 介面" : "Legacy 介面";

  return createPortal(
    <button
      type="button"
      onClick={onClick}
      title={target === "aegis" ? "切換到 Aegis 手遊介面" : "切換回 Legacy 桌面介面"}
      aria-label={target === "aegis" ? "切換到 Aegis 手遊介面" : "切換回 Legacy 桌面介面"}
      style={{ position: "fixed", right: 12, bottom: `${offset}px`, zIndex: 2147483000 }}
      className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-400/60 hover:bg-slate-800 transition-all shadow-xl text-xs font-semibold select-none"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      {label}
    </button>,
    document.body
  );
}
