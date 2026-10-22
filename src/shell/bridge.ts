/**
 * ShellBridge — 兩個殼共用的唯一狀態介面
 *
 * 為什麼要有這個檔：
 * Legacy 殼與 Aegis 殼都只透過這個介面取資料、發指令。
 * 任何新功能只要擴充這個介面，兩殼就同時「看得到」它；
 * 這是「舊版不得落後」的技術保證（見 docs/shell/PLAN.md §2）。
 */
import type { RefObject } from "react";
import type { Elf, BattleMode } from "../types";

export type AppView =
  | "start"
  | "custom"
  | "battle"
  | "destiny_wheel"
  | "interstellar_exploration"
  | "test_runner"
  | "updates"
  | "bag";

export type BattleFormat = "normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3";

export type StartBattleFn = (
  mode: BattleMode,
  team1: Elf[],
  team2: Elf[],
  starter1Id: string,
  starter2Id: string,
  suit1?: string,
  eyewear1?: string,
  suit2?: string,
  eyewear2?: string,
  title1?: string,
  title2?: string,
  format?: BattleFormat,
  options?: any
) => void;

export interface ShellBridge {
  // ── 導航 ──
  view: AppView;
  setView: (v: AppView) => void;

  // ── 資料 ──
  allElves: Elf[];
  allElvesCombined: Elf[];
  updateElf: (elf: Elf) => void;

  // ── 對戰參數 ──
  handleStartBattle: StartBattleFn;
  battleMode: BattleMode;
  setBattleMode: (m: BattleMode) => void;
  battleFormat: BattleFormat;
  setBattleFormat: (f: BattleFormat) => void;
  battleKey: number;
  restartedRef: RefObject<boolean>;
  handleRestartBattle: () => void;
  isTransitioning: boolean;
  p1Team: Elf[];
  p2Team: Elf[];
  p1StarterId: string;
  p2StarterId: string;
  p1Suit: string;
  p1Eyewear: string;
  p2Suit: string;
  p2Eyewear: string;
  p1Title: string;
  p2Title: string;
  hostPlayer: "p1" | "p2";
  setHostPlayer: (h: "p1" | "p2") => void;
  specialMode: "destiny" | "interstellar" | undefined;
  interstellarOptions: any;
  setInterstellarOptions: (o: any) => void;

  // ── 編輯器 ──
  editingElf: Elf | null;
  setEditingElf: (e: Elf | null) => void;
  editorTab: "ai" | "manual" | "blockly" | undefined;
  setEditorTab: (t: "ai" | "manual" | "blockly" | undefined) => void;

  // ── 覆蓋層 ──
  showEncyclopedia: boolean;
  setShowEncyclopedia: (v: boolean) => void;
  showPerformanceProbe: boolean;
  setShowPerformanceProbe: (v: boolean) => void;
}
