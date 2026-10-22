/**
 * 六態色票 — 顏色是「狀態」不是「裝飾」
 *
 * 借鏡 world.execute(me) MV 的 config.json → palettes：
 * 每個狀態是一整套色票，元件只能引用角色（bg / panel / text / accent…），
 * 不得寫死 hex。換皮 = 改這裡，不是改 200 個檔案。
 *
 * 對應遊戲流程：
 *   idle    待機（首頁、未開戰）
 *   lobby   大廳（編隊中）
 *   battle  戰鬥中
 *   victory 勝利
 *   defeat  敗北
 *   error   錯誤 / 載入失敗
 */
export type PaletteState = "idle" | "lobby" | "battle" | "victory" | "defeat" | "error";

export interface PaletteRole {
  /** 頁面底色 */
  bg: string;
  /** 較暗的面板 */
  panel: string;
  /** 抬起的卡片 / 泡泡 / 輸入框 */
  raised: string;
  /** 髮絲線 */
  line: string;
  /** 主要文字 */
  text: string;
  /** 次要文字 */
  sub: string;
  /** 停用文字 */
  mute: string;
  /** 強調色（我方 / 主要行動） */
  accent: string;
  /** 強調色的亮版 */
  accentHot: string;
  /** 強調色的暗版 */
  accentDim: string;
  /** 警示色 */
  warn: string;
  /** 光暈倍率 0–1.5 */
  glow: number;
  /** 飽和度保留 0–1（0 = 灰階） */
  sat: number;
}

export const PALETTES: Record<PaletteState, PaletteRole> = {
  idle: {
    bg: "#0A0C10", panel: "#0F1117", raised: "#161A22", line: "#1E293B",
    text: "#F1F5F9", sub: "#94A3B8", mute: "#64748B",
    accent: "#3B82F6", accentHot: "#60A5FA", accentDim: "#1D4ED8",
    warn: "#F59E0B", glow: 0.4, sat: 0.85,
  },
  lobby: {
    bg: "#0A0C10", panel: "#101720", raised: "#17202C", line: "#1E3A5F",
    text: "#F1F5F9", sub: "#A5B4C8", mute: "#6B7C93",
    accent: "#38BDF8", accentHot: "#7DD3FC", accentDim: "#0369A1",
    warn: "#FBBF24", glow: 0.7, sat: 1,
  },
  battle: {
    bg: "#07090D", panel: "#0C1016", raised: "#141A24", line: "#22303F",
    text: "#F8FAFC", sub: "#9FB0C4", mute: "#5F7086",
    accent: "#22D3EE", accentHot: "#67E8F9", accentDim: "#0E7490",
    warn: "#FB7185", glow: 1, sat: 1,
  },
  victory: {
    bg: "#0B0D0A", panel: "#12160F", raised: "#1A2016", line: "#3F4A28",
    text: "#F7F9F2", sub: "#C4CEA9", mute: "#7C8862",
    accent: "#FBBF24", accentHot: "#FDE68A", accentDim: "#B45309",
    warn: "#F59E0B", glow: 1.2, sat: 1,
  },
  defeat: {
    bg: "#0A0A0D", panel: "#111114", raised: "#191A1F", line: "#2A2B33",
    text: "#E7E7EC", sub: "#8E8F9A", mute: "#5C5D68",
    accent: "#818CF8", accentHot: "#A5B4FC", accentDim: "#4338CA",
    warn: "#F43F5E", glow: 0.5, sat: 0.5,
  },
  error: {
    bg: "#120A0C", panel: "#1A0F12", raised: "#241418", line: "#5C2230",
    text: "#FDF2F4", sub: "#D9A5AE", mute: "#8C5A63",
    accent: "#F43F5E", accentHot: "#FB7185", accentDim: "#9F1239",
    warn: "#F43F5E", glow: 0.9, sat: 1,
  },
};

/** 把一個狀態轉成 CSS 變數表，掛在容器上即可讓子樹使用 */
export function paletteToCssVars(state: PaletteState): Record<string, string> {
  const p = PALETTES[state];
  return {
    "--p-bg": p.bg,
    "--p-panel": p.panel,
    "--p-raised": p.raised,
    "--p-line": p.line,
    "--p-text": p.text,
    "--p-sub": p.sub,
    "--p-mute": p.mute,
    "--p-accent": p.accent,
    "--p-accent-hot": p.accentHot,
    "--p-accent-dim": p.accentDim,
    "--p-warn": p.warn,
    "--p-glow": String(p.glow),
    "--p-sat": String(p.sat),
  };
}

/** 從戰鬥結果推導狀態 */
export function paletteForBattleOutcome(winner: "p1" | "p2" | "draw" | null, hostPlayer: "p1" | "p2"): PaletteState {
  if (!winner) return "battle";
  if (winner === "draw") return "defeat";
  return winner === hostPlayer ? "victory" : "defeat";
}
