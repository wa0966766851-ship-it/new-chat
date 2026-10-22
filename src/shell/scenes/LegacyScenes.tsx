import React, { Suspense, lazy } from "react";
import type { ShellBridge } from "../bridge";
import TechLoadingScreen from "../../components/TechLoadingScreen";
import { BattleLoadingScreen } from "../../components/battle/BattleLoadingScreen";
import { PageErrorBoundary } from "../../components/PageErrorBoundary";

const StartScreen = lazy(() => import("../../components/StartScreen"));
const ElfEditor = lazy(() => import("../../components/ElfEditor"));
const UpdatesPage = lazy(() => import("../../components/UpdatesPage"));
const DestinyWheelScreen = lazy(() => import("../../components/DestinyWheelScreen"));
const TestRunnerPage = lazy(() => import("../../components/TestRunnerPage"));
const BattleScreen = lazy(() => import("../../components/BattleScreen"));
const InterstellarHub = lazy(() => import("../../components/InterstellarExploration/InterstellarHub"));

/**
 * LegacyScenes — 既有的畫面路由
 *
 * 從 App.tsx 原樣抽出，行為不變。
 * 兩個殼（Legacy / Aegis）都掛這一份，因此 Aegis 的 delegated 畫面
 * 永遠等於 Legacy 的畫面 —— 這是「功能不會落後」的來源。
 */
export function LegacyScenes({ b, workspace = false }: { b: ShellBridge; workspace?: boolean }) {
  const workspaceEditor = workspace && b.view === 'custom' && !!(b.editingElf || b.editorTab);
  const loading = b.view === "battle"
    ? <BattleLoadingScreen p1Team={b.p1Team} p2Team={b.p2Team}
        p1StarterId={b.p1StarterId} p2StarterId={b.p2StarterId} format={b.battleFormat} />
    : <TechLoadingScreen />;

  return (
    <PageErrorBoundary key={workspace ? "team-workspace" : b.view} onBack={() => b.setView("start")}>
      <Suspense fallback={loading}>
        {(b.view === "start" || workspace) && (
          <div style={workspace ? { height: '100%', display: workspaceEditor ? 'none' : undefined } : undefined}>
          <StartScreen
            onBackToLobby={() => b.setView("start")}
            presentation={workspace ? "aegis" : "legacy"}
            initialBattleFormat={b.battleFormat}
            initialBattleMode={b.battleMode}
            hostPlayer={b.hostPlayer}
            onHostPlayerChange={b.setHostPlayer}
            onStartBattle={b.handleStartBattle}
            onNavigateToDestinyWheel={(mode) => {
              if (mode) b.setBattleMode(mode);
              b.setView("destiny_wheel");
            }}
            onNavigateToInterstellar={() => b.setView("interstellar_exploration")}
            onNavigateToCustom={() => {
              b.setEditingElf(null);
              b.setEditorTab("manual");
              b.setView("custom");
            }}
            onEditElf={(elf) => {
              b.setEditingElf(elf);
              b.setEditorTab(undefined);
              b.setView("custom");
            }}
          />
          </div>
        )}

        {b.view === "updates" && (
          <UpdatesPage
            elves={b.allElvesCombined}
            onBack={() => b.setView("start")}
            onEditElf={(elf, tab) => {
              b.setEditingElf(elf);
              b.setEditorTab(tab);
              b.setView("custom");
            }}
          />
        )}

        {b.view === "custom" && (!workspace || workspaceEditor) && (
          <React.Fragment key={(b.editingElf?.id || "new") + (b.editorTab || "")}>
            <ElfEditor
              initialElf={b.editingElf || undefined}
              initialTab={b.editorTab}
              onSaveElf={(elf) => {
                b.updateElf(elf);
                b.setEditingElf(null);
                b.setEditorTab(undefined);
                b.setView(workspace ? "bag" : "start");
              }}
              onBack={() => { b.setEditingElf(null); b.setEditorTab(undefined); b.setView(workspace ? "bag" : "custom"); }}
            />
          </React.Fragment>
        )}

        {b.view === "destiny_wheel" && (
          <DestinyWheelScreen
            initialBattleMode={b.battleMode}
            allElves={b.allElvesCombined}
            onStartBattle={(mode, team1, team2, starter1Id, starter2Id, s1, e1, s2, e2, t1, t2, fmt) => {
              b.handleStartBattle(mode || "PVE", team1, team2, starter1Id, starter2Id,
                s1 || "destiny_armor", e1 || "", s2 || "destiny_armor", e2 || "",
                t1 || "命運之神", t2 || "宿命之敵", fmt || "normal_6v6", { specialMode: "destiny" });
            }}
            onBack={() => b.setView("start")}
          />
        )}

        {b.view === "interstellar_exploration" && (
          <InterstellarHub
            allElves={b.allElvesCombined}
            onBack={() => b.setView("start")}
            onStartBattle={(p1, p2, mode, options) => {
              b.handleStartBattle(mode, p1, p2, p1[0]?.battleId || p1[0]?.id, p2[0]?.battleId || p2[0]?.id,
                options?.suit1, options?.eyewear1, options?.suit2, options?.eyewear2,
                options?.title1, options?.title2, options?.format, options);
              if (options?.interstellarOptions) b.setInterstellarOptions(options.interstellarOptions);
            }}
          />
        )}

        {b.view === "battle" && b.p1Team.length > 0 && b.p2Team.length > 0 && (
          <BattleScreen
            key={b.battleKey}
            initialP1Team={b.p1Team}
            initialP2Team={b.p2Team}
            p1StarterId={b.p1StarterId}
            p2StarterId={b.p2StarterId}
            p1Suit={b.p1Suit}
            p1Eyewear={b.p1Eyewear}
            p2Suit={b.p2Suit}
            p2Eyewear={b.p2Eyewear}
            p1Title={b.p1Title}
            p2Title={b.p2Title}
            battleMode={b.battleMode}
            battleFormat={b.battleFormat}
            hostPlayer={b.hostPlayer}
            onHostPlayerChange={b.setHostPlayer}
            interstellarOptions={b.interstellarOptions}
            randomSeed={b.interstellarOptions?.battleSeed}
            preparedTeams={!!b.interstellarOptions}
            specialMode={b.specialMode}
            onBattleEnd={(winner: any, team: any) => b.interstellarOptions?.onBattleEnd?.(winner, team)}
            onBackToMenu={() => {
              b.setView(b.interstellarOptions ? "interstellar_exploration" : "start");
              b.setInterstellarOptions(null);
            }}
            introReplay={b.battleKey > 0 && !!b.restartedRef.current}
            onRestartBattle={() => { b.restartedRef.current = true; b.handleRestartBattle(); }}
          />
        )}

        {/*
          背包：Legacy 沒有獨立的背包畫面（裝備與編隊都在 StartScreen 的隊伍格裡）。
          從 Aegis 切回 Legacy 若停在 bag，原本會是空白 —— 這裡給明確出口。
        */}
        {b.view === "bag" && !workspace && (
          <div className="p-4 text-sm text-slate-300">
            背包管理已整合在首頁的隊伍格（出戰 6 ＋ 待命 6）。
            <button
              type="button"
              onClick={() => b.setView("start")}
              className="ml-2 px-3 py-1 rounded bg-blue-600 text-white text-xs"
            >
              回首頁
            </button>
          </div>
        )}

        {b.view === "test_runner" && <TestRunnerPage />}
      </Suspense>
    </PageErrorBoundary>
  );
}