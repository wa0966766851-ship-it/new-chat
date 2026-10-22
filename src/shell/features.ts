/**
 * 功能註冊表（Feature Registry）— 雙殼架構的單一事實來源
 *
 * 規則（見 docs/shell/PLAN.md）：
 * 1. 任何新功能都必須先在此登記，才能出現在任何一個殼。
 * 2. `legacy` 一旦為 true 就不得再改回 false（不得回歸）。
 * 3. `aegis.status = "delegated"` 表示 Aegis 殼直接內嵌 Legacy 畫面——
 *    新功能因此「自動」同時出現在兩殼，不需要等新殼重做。
 * 4. 只有把畫面重寫成 Aegis 原生（status = "live"）時，才移除 delegated。
 */

export type FeatureKind = "screen" | "overlay" | "action";
export type FeatureGroup = "play" | "roster" | "data" | "system";
export type AegisStatus = "live" | "delegated" | "planned";

export interface ShellFeature {
  /** 穩定 id；同時作為 view 名稱或 overlay 名稱 */
  id: string;
  /** 繁體中文顯示名（兩殼共用） */
  label: string;
  /** 導航短名（顯示在 Aegis 的窄版導航上）；統一使用繁體中文 */
  short: string;
  kind: FeatureKind;
  group: FeatureGroup;
  /** Legacy 殼是否已實作。一旦 true 不得回歸。 */
  legacy: boolean;
  /** Aegis 殼的實作狀態 */
  aegis: {
    status: AegisStatus;
    /** planned 時的目標階段（Phase 編號） */
    phase?: number;
  };
  /** 需要先滿足的功能 id（例如戰鬥需要首頁編隊） */
  requires?: string[];
  /** true = 不進主導航（仍可由程式內導航到達），例如背包只從編成進 */
  hideFromNav?: boolean;
}

export const SHELL_FEATURES: readonly ShellFeature[] = [
  {
    id: "start",
    label: "首頁 / 模式",
    short: "首頁",
    kind: "screen",
    group: "play",
    legacy: true,
    aegis: { status: "live" }, // Phase 2：原生 Lobby
  },
  {
    id: "custom",
    label: "精靈自定",
    short: "編成",
    kind: "screen",
    group: "roster",
    legacy: true,
    aegis: { status: "live" }, // Phase 3：原生 TeamScene
  },
  {
    id: "bag",
    label: "背包管理",
    short: "背包",
    kind: "screen",
    group: "roster",
    legacy: true,
    aegis: { status: "live" }, // Phase 3：原生 BagScene
    hideFromNav: true,         // 背包不暴露在主導航，從「編成」進
  },
  {
    id: "encyclopedia",
    label: "戰鬥百科",
    short: "圖鑑",
    kind: "overlay",
    group: "data",
    legacy: true,
    aegis: { status: "delegated" },
  },
  {
    id: "battle",
    label: "實戰演練",
    short: "對戰",
    kind: "screen",
    group: "play",
    legacy: true,
    aegis: { status: "delegated", phase: 4 }, // Phase 4 改寫成手遊戰鬥 HUD 後轉為 live
    requires: ["start"],
  },
  {
    id: "destiny_wheel",
    label: "命運之輪",
    short: "命運",
    kind: "screen",
    group: "play",
    legacy: true,
    aegis: { status: "delegated" },
  },
  {
    id: "interstellar_exploration",
    label: "星際探索",
    short: "探索",
    kind: "screen",
    group: "play",
    legacy: true,
    aegis: { status: "delegated" },
  },
  {
    id: "test_runner",
    label: "自動測試",
    short: "測試",
    kind: "screen",
    group: "system",
    legacy: true,
    aegis: { status: "delegated" },
  },
  {
    id: "updates",
    label: "更新與精靈",
    short: "更新",
    kind: "screen",
    group: "data",
    legacy: true,
    aegis: { status: "delegated" },
  },
  {
    id: "settings",
    label: "系統控制中心",
    short: "設定",
    kind: "overlay",
    group: "system",
    legacy: true,
    aegis: { status: "delegated" },
  },
  {
    id: "performance_probe",
    label: "效能探針",
    short: "效能",
    kind: "overlay",
    group: "system",
    // 2026-10-23 核對：兩殼目前都沒有實體入口（幽靈條目）。
    // 保留登記以免 parity 測試變動，等效能面板實作後再接。
    legacy: false,
    aegis: { status: "planned", phase: 7 },
  },
] as const;

const BY_ID = new Map(SHELL_FEATURES.map((f) => [f.id, f]));

export function getFeature(id: string): ShellFeature | undefined {
  return BY_ID.get(id);
}

/** Aegis 目前是否能顯示此功能（live 或 delegated 都算能顯示） */
export function aegisCanRender(id: string): boolean {
  const f = BY_ID.get(id);
  if (!f) return false;
  return f.aegis.status === "live" || f.aegis.status === "delegated";
}

/** 供 Aegis 導航使用：只回傳 Aegis 目前能渲染的功能 */
export function aegisNavFeatures(): ShellFeature[] {
  return SHELL_FEATURES.filter((f) => aegisCanRender(f.id) && f.kind !== "overlay" && !f.hideFromNav);
}

export function featuresByGroup(group: FeatureGroup): ShellFeature[] {
  return SHELL_FEATURES.filter((f) => f.group === group);
}