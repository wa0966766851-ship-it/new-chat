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
    // 2026-10-29 核對：入口在控制中心「效能診斷」→「開啟本機效能量測」，
    // 派發 window 事件 open-performance-probe，由 App.tsx 監聽開啟。
    // 兩殼共用同一個 ControlHub，因此 legacy / aegis 都算已接通。
    legacy: true,
    aegis: { status: "delegated" },
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
/* ────────────────────────────────────────────────────────────
 * Aegis 側欄目錄（2026-11-07，使用者要求「類似目錄、幾乎囊括所有頁面」）
 * 主導航（aegisNavFeatures）維持精簡給底部欄；側欄改列完整目錄：頁面＋覆蓋層＋子分頁。
 * 每一項都必須能實際到達（tests/shellDirectory.semantic.test.ts 驗收）。
 * ──────────────────────────────────────────────────────────── */
export type EncyclopediaTab = 'search' | 'elves' | 'status' | 'types' | 'mechanics' | 'nodes' | 'editor' | 'effectQuery' | 'opCodes' | 'modes';
export type DirectoryAction =
  | { kind: 'view'; view: 'start' | 'custom' | 'bag' | 'destiny_wheel' | 'interstellar_exploration' | 'test_runner' | 'updates' }
  | { kind: 'battle'; format?: 'normal_6v6' | 'solo_1v1' | 'peak_6v6' | 'peak_3v3' }
  | { kind: 'editor'; tab: 'ai' | 'manual' | 'blockly' }
  | { kind: 'encyclopedia'; tab: EncyclopediaTab }
  | { kind: 'settings'; section: 'background' | 'audio' | 'visual' | 'battle' | 'system' }
  | { kind: 'event'; name: 'open-performance-probe' }
  | { kind: 'switch_shell' };
export interface DirectoryEntry {
  key: string;
  label: string;
  /** 對應 SHELL_FEATURES 的 id（決定圖示與「目前所在」標記）。 */
  feature?: string;
  action?: DirectoryAction;
  children?: DirectoryEntry[];
}
export interface DirectoryGroup { key: FeatureGroup; label: string; entries: DirectoryEntry[] }

export const AEGIS_DIRECTORY: readonly DirectoryGroup[] = [
  { key: 'play', label: '遊玩', entries: [
    { key: 'start', label: '首頁', feature: 'start', action: { kind: 'view', view: 'start' } },
    { key: 'battle', label: '實戰演練', feature: 'battle', action: { kind: 'battle' }, children: [
      { key: 'battle:free', label: '自由對戰 6V6', action: { kind: 'battle', format: 'normal_6v6' } },
      { key: 'battle:solo', label: '單挑 1V1', action: { kind: 'battle', format: 'solo_1v1' } },
      { key: 'battle:peak6', label: '巔峰 6V6', action: { kind: 'battle', format: 'peak_6v6' } },
      { key: 'battle:peak3', label: '巔峰 3V3', action: { kind: 'battle', format: 'peak_3v3' } },
    ] },
    { key: 'destiny_wheel', label: '命運之輪', feature: 'destiny_wheel', action: { kind: 'view', view: 'destiny_wheel' } },
    { key: 'interstellar_exploration', label: '星際探索', feature: 'interstellar_exploration', action: { kind: 'view', view: 'interstellar_exploration' } },
  ] },
  { key: 'roster', label: '精靈', entries: [
    { key: 'custom', label: '精靈編成', feature: 'custom', action: { kind: 'view', view: 'custom' } },
    { key: 'bag', label: '背包與出戰', feature: 'bag', action: { kind: 'view', view: 'bag' } },
    { key: 'editor', label: '新增精靈', children: [
      { key: 'editor:ai', label: 'AI 解析', action: { kind: 'editor', tab: 'ai' } },
      { key: 'editor:manual', label: '手動填寫', action: { kind: 'editor', tab: 'manual' } },
      { key: 'editor:blockly', label: '積木編輯', action: { kind: 'editor', tab: 'blockly' } },
    ] },
  ] },
  { key: 'data', label: '資料', entries: [
    { key: 'encyclopedia', label: '戰鬥百科', feature: 'encyclopedia', action: { kind: 'encyclopedia', tab: 'search' }, children: [
      { key: 'enc:search', label: '總索引', action: { kind: 'encyclopedia', tab: 'search' } },
      { key: 'enc:elves', label: '精靈圖鑑', action: { kind: 'encyclopedia', tab: 'elves' } },
      { key: 'enc:status', label: '異常狀態', action: { kind: 'encyclopedia', tab: 'status' } },
      { key: 'enc:types', label: '屬性克制', action: { kind: 'encyclopedia', tab: 'types' } },
      { key: 'enc:mechanics', label: '戰鬥機制', action: { kind: 'encyclopedia', tab: 'mechanics' } },
      { key: 'enc:nodes', label: '戰鬥節點', action: { kind: 'encyclopedia', tab: 'nodes' } },
      { key: 'enc:editor', label: '自訂克制', action: { kind: 'encyclopedia', tab: 'editor' } },
      { key: 'enc:effectQuery', label: '效果查詢', action: { kind: 'encyclopedia', tab: 'effectQuery' } },
      { key: 'enc:modes', label: '玩法說明', action: { kind: 'encyclopedia', tab: 'modes' } },
      { key: 'enc:opCodes', label: '積木代號', action: { kind: 'encyclopedia', tab: 'opCodes' } },
    ] },
    { key: 'updates', label: '更新與精靈', feature: 'updates', action: { kind: 'view', view: 'updates' } },
  ] },
  { key: 'system', label: '系統', entries: [
    { key: 'settings', label: '控制中心', feature: 'settings', action: { kind: 'settings', section: 'background' }, children: [
      { key: 'settings:background', label: '背景', action: { kind: 'settings', section: 'background' } },
      { key: 'settings:audio', label: '音樂', action: { kind: 'settings', section: 'audio' } },
      { key: 'settings:visual', label: '外觀', action: { kind: 'settings', section: 'visual' } },
      { key: 'settings:battle', label: '戰鬥', action: { kind: 'settings', section: 'battle' } },
      { key: 'settings:system', label: '系統與備份', action: { kind: 'settings', section: 'system' } },
    ] },
    { key: 'performance_probe', label: '效能探針', feature: 'performance_probe', action: { kind: 'event', name: 'open-performance-probe' } },
    { key: 'test_runner', label: '自動測試', feature: 'test_runner', action: { kind: 'view', view: 'test_runner' } },
    { key: 'switch_shell', label: '切換為 Legacy 介面', action: { kind: 'switch_shell' } },
  ] },
];

/** 目錄中的所有可點項目（含子項）。 */
export function directoryEntries(): DirectoryEntry[] {
  return AEGIS_DIRECTORY.flatMap(g => g.entries.flatMap(e => [e, ...(e.children || [])]));
}
