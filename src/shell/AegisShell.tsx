import React, { Suspense, lazy, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Home, Swords, Settings, Book, TestTubes, Sparkles, Disc, Package, Layers,
} from "lucide-react";
import type { ShellBridge } from "./bridge";
import { LegacyScenes } from "./scenes/LegacyScenes";
import { LobbyScene } from "./scenes/LobbyScene";
import { TeamScene } from "./scenes/TeamScene";
import { BagScene } from "./scenes/BagScene";
import { PALETTES, paletteToCssVars, type PaletteState } from "../design/palette";
import { getFeature, aegisNavFeatures } from "./features";
import { ElfAvatar } from "../components/SeerImages";
import { DEFAULT_ELVES } from "../data/defaultElves";
import { ThemeBackground } from "../components/ThemeController";
import { ImageCopyMenu } from "../components/ImageCopyMenu";
import { PageErrorBoundary } from "../components/PageErrorBoundary";
import { SiteUpdateNotice } from "../components/SiteUpdateNotice";
import TechLoadingScreen from "../components/TechLoadingScreen";
import { TopUtilityBar, SideRail, BottomBar, type RailItem } from "./art/chrome";
import "./art/battleAegis.css";
import "./art/motion.css";
import "./art/shellLayout.css";
import "./art/teamWorkspace.css";
import { haptic } from "./haptics";
import { SceneTransition } from "./art/SceneTransition";
import { AegisBackButton, useEdgeSwipeBack } from "./art/BackButton";
const ControlHub = lazy(() => import("../components/ControlHub"));
import { ResourcePill, PlayerBadge } from "./art/gameUi";
import { ProfileAvatar } from "./art/ProfileAvatar";

const Encyclopedia = lazy(() => import("../components/Encyclopedia"));

/** 直向（手機）用底部導航；橫向/桌面用左側導航 */
function useVerticalLayout(): boolean {
  const [vertical, setVertical] = React.useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px) and (orientation: portrait)");
    const on = () => setVertical(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return vertical;
}

/** 依目前 view 決定色票狀態 */
function paletteStateFor(b: ShellBridge): PaletteState {
  if (b.view === "battle") return "battle";
  if (b.view === "start") return "lobby";
  return "idle";
}

const ICON_CLS = "w-[17px] h-[17px]";

const ICONS: Record<string, React.ReactNode> = {
  start: <Home className={ICON_CLS} />,
  battle: <Swords className={ICON_CLS} />,
  custom: <Layers className={ICON_CLS} />,
  bag: <Package className={ICON_CLS} />,
  encyclopedia: <Book className={ICON_CLS} />,
  test_runner: <TestTubes className={ICON_CLS} />,
  updates: <Book className={ICON_CLS} />,
  destiny_wheel: <Disc className={ICON_CLS} />,
  interstellar_exploration: <Sparkles className={ICON_CLS} />,
};

/**
 * AegisShell — 手遊風外殼
 *
 * 外殼只做三件事：
 *   1. 提供色票（顏色＝狀態）
 *   2. 提供導航（直向底部、橫向側欄）
 *   3. 把畫面交給對應的 Scene；沒重寫的一律委派 LegacyScenes（功能不會少）
 *
 * 頂部列不是「網站標頭」：不寫品牌名、不寫麵包屑。
 * 左邊是工具圖示群、中間是玩家、右邊是資源——這是手遊的資訊層級。
 */
export function AegisShell({ b, onSwitchShell }: { b: ShellBridge; onSwitchShell: () => void }) {
  const isVertical = useVerticalLayout();
  const state = paletteStateFor(b);
  const vars = useMemo(() => paletteToCssVars(state), [state]);
  const nav = aegisNavFeatures();

  /**
   * 導航
   *
   * 「對戰」不能只是 setView("battle")：
   * BattleScreen 需要 p1Team / p2Team，沒有隊伍時 LegacyScenes 的分支不會渲染，
   * 畫面會落回上一頁，使用者看起來像「點了沒反應」。
   * 先進入共用背包，由原版控制器確認隊伍、配裝與規則後啟動。
   */
  const go = (id: string) => {
    haptic("light");
    if (id === "encyclopedia") { b.setShowEncyclopedia(true); return; }
    if (id === "battle") {
      b.setEditingElf(null);
      b.setEditorTab(undefined);
      b.setView('bag');
      return;
    }
    b.setView(id as any);
  };

  const activeId = b.showEncyclopedia ? "encyclopedia" : b.view;
  const current = getFeature(activeId);

  const railItems: RailItem[] = nav.map(f => ({
    id: f.id,
    short: f.short,
    label: f.label,
    icon: ICONS[f.id] ?? <Sparkles className={ICON_CLS} />,
  }));

  const starter = b.allElvesCombined[0];
  const openSettings = () => window.dispatchEvent(new CustomEvent("open-settings"));
  const openBattleSetup = () => { b.setEditingElf(null); b.setEditorTab(undefined); b.setView('bag'); };

  // iOS 邊緣滑動返回：只在非首頁、非戰鬥時生效
  const canGoBack = b.view !== "start" && b.view !== "battle";
  useEdgeSwipeBack(() => b.setView("start"), canGoBack);
  return (
    <div
      id="aegis-shell"
      data-layout={isVertical ? "vertical" : "horizontal"}
      className="w-full flex flex-col overflow-hidden relative text-[color:var(--p-text)] select-none"
      style={{
        ...(vars as React.CSSProperties),
        // 2026-10-22：外殼不鋪底色，交給 ThemeBackground 的場景圖（否則頂部會有一條黑）
        background: "transparent",
        width: "100vw",
        maxWidth: "100vw",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <ThemeBackground currentScene={b.showEncyclopedia ? "encyclopedia" : b.view} />
      <Suspense fallback={null}>
        <ControlHub currentScene={b.showEncyclopedia ? "encyclopedia" : b.view} canApplyUpdates={b.view === "start" && !b.editingElf && !b.showEncyclopedia} />
      </Suspense>

      {/* 頂部：工具列 + 玩家 + 資源（戰鬥中隱藏，手遊慣例是全螢幕戰場） */}
      {/* iOS 風格返回：非首頁時出現在左上角。
          2026-10-22：workspace 類頁面（背包與編成）自己已有標題列，
          返回鈕改由該頁面內部渲染，避免和標題擠在一起。 */}
      {canGoBack && (
        <div className="shell-back-slot absolute left-2 z-40" style={{ top: "max(8px, env(safe-area-inset-top))" }}>
          <AegisBackButton onBack={() => (b.view === "bag" && b.goBackFromBag ? b.goBackFromBag() : b.setView("start"))} />
        </div>
      )}

      {b.view !== "battle" && <TopUtilityBar
        onSettings={openSettings}
        onSwitchShell={onSwitchShell}
        shellLabel="Legacy"
        player={null}
        resources={null
          // 2026-10-23：使用者要求拿掉頂欄「精靈總數」。
          // 資源膠囊暫不渲染，但 TopUtilityBar 的展開按鈕保留（之後可能還會放東西）。
        }
      />}

      {/* 內容區 */}
      {/* 頂欄浮起來後，內容要補上它的高度（否則會被蓋住） */}
      <div className="flex-1 min-h-0 flex relative z-10">
        {!isVertical && (
          <SideRail
            items={railItems}
            activeId={activeId}
            onSelect={go}
          />
        )}

        <main
          className="flex-1 min-w-0 min-h-0 relative"
          style={{
            // 頂欄浮起來了，內容要避開它
            paddingTop: b.view === "battle" ? 0 : 52,
            overflowY: b.view === "start" ? "hidden" : "auto",
            overflowX: "hidden",
            maxWidth: "100%",
            paddingBottom: b.view === "start" ? 0 : 8,
          }}
        >
          <SiteUpdateNotice active={b.view === "start" && !b.editingElf} />
          {/* 場景轉場：戰鬥中不播（避免動畫疊加），reduced-motion 由 motion.css 統一關閉 */}
          <SceneTransition viewKey={b.view} disabled={b.view === "battle"}>
            <PageErrorBoundary key={b.view === 'bag' || b.view === 'custom' ? 'shared-team-workspace' : b.view} onBack={() => b.setView("start")}>
              {/* live = 原生畫面；其餘一律委派 LegacyScenes，功能不會少 */}
              {b.view === "start"
                ? <LobbyScene b={b} />
                : b.view === "custom"
                  ? <LegacyScenes b={b} workspace />
                  : b.view === "bag"
                    ? <LegacyScenes b={b} workspace />
                    : <LegacyScenes b={b} />}
            </PageErrorBoundary>
          </SceneTransition>

          {b.showEncyclopedia && createPortal(
            <PageErrorBoundary onBack={() => b.setShowEncyclopedia(false)}>
              <Suspense fallback={<TechLoadingScreen />}>
                <Encyclopedia onClose={() => b.setShowEncyclopedia(false)} />
              </Suspense>
            </PageErrorBoundary>,
            document.body
          )}
          <ImageCopyMenu />
        </main>
      </div>

      {/* 直向：底部導航（戰鬥中隱藏，讓出戰場空間） */}
      {isVertical && b.view !== "battle" && (
        <BottomBar
          items={railItems}
          activeId={activeId}
          onSelect={go}
        />
      )}
    </div>
  );
}