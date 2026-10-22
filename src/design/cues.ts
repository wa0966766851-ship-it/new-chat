/**
 * 動效拍點表 — 所有時長集中在一處
 *
 * 借鏡 world.execute(me) MV 的 src/scenes/cues.js：
 * 每一項都標明「數值 + 來源」，調整手感時只改這個檔，
 * 不用在全專案搜 300ms。
 *
 * source:
 *   measured  實機量測（DevTools Performance 或錄影逐幀）
 *   spec      設計規範（8pt grid、Material motion 標準）
 *   initial   初值，尚未實測
 */
export interface Cue {
  /** 毫秒 */
  ms: number;
  source: "measured" | "spec" | "initial";
  note?: string;
}

export const CUES = {
  /** 側欄收合 / 展開 */
  sidebar: { ms: 220, source: "measured", note: "App.tsx 既有 width transition" },
  /** 進戰鬥前的轉場遮罩 */
  battleEnter: { ms: 300, source: "measured", note: "App.tsx handleStartBattle setTimeout" },
  /** 按鈕按下的下沉 */
  pressDown: { ms: 90, source: "spec", note: "低於 100ms 才跟得上手指" },
  /** 按鈕回彈 */
  pressUp: { ms: 160, source: "spec" },
  /** 卡片抬起 */
  cardLift: { ms: 180, source: "spec" },
  /** 一般淡入 */
  fade: { ms: 200, source: "spec" },
  /** 場景切換（Aegis） */
  sceneSwap: { ms: 320, source: "initial", note: "待 Phase 1 實測" },
  /** 抽屜升起（Aegis） */
  drawer: { ms: 260, source: "initial" },
  /** 長按判定 */
  longPress: { ms: 420, source: "spec", note: "iOS/Android 慣例 400–500ms" },
  /** 雙擊間隔上限 */
  doubleTap: { ms: 280, source: "spec" },
  /** 傷害飄字生命週期 */
  damageFloat: { ms: 900, source: "initial" },
  /** 命中停頓 */
  hitStop: { ms: 70, source: "initial" },
} as const satisfies Record<string, Cue>;

export type CueName = keyof typeof CUES;

/** 取得毫秒 */
export function cueMs(name: CueName): number {
  return CUES[name].ms;
}

/** 取得 CSS 時間字串（例如 "220ms"） */
export function cueCss(name: CueName): string {
  return `${CUES[name].ms}ms`;
}

/** 供 check:ui 與文件生成：列出尚未實測的拍點 */
export function unmeteredCues(): { name: CueName; cue: Cue }[] {
  return (Object.entries(CUES) as [CueName, Cue][])
    .filter(([, c]) => c.source !== "measured")
    .map(([name, cue]) => ({ name, cue }));
}
