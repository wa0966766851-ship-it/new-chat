/**
 * 殼模式（Shell Mode）— 執行期切換 Legacy / Aegis
 *
 * 設計原則：
 * - 兩個殼共用同一份 state（App.tsx 的 view / 隊伍 / 對戰參數），切殼不重置任何東西。
 * - 偏好存 localStorage；未設定時依視窗寬度自動選擇（桌面 → legacy，手機 → aegis）。
 * - 切換一律走 `setShellMode`，不得讓元件各自讀寫 localStorage。
 */
import { useCallback, useEffect, useState } from "react";

export type ShellMode = "legacy" | "aegis";
export type ShellPreference = ShellMode | "auto";

const STORAGE_KEY = "seer_shell_preference";
/** 自動模式的斷點：小於此寬度視為行動裝置 */
export const AUTO_AEGIS_MAX_WIDTH = 1023;

export function readShellPreference(): ShellPreference {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "legacy" || raw === "aegis" || raw === "auto") return raw;
  } catch {
    /* localStorage 不可用時退回 auto */
  }
  return "auto";
}

export function writeShellPreference(pref: ShellPreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* 忽略：無痕模式或配額滿 */
  }
}

export function resolveShellMode(pref: ShellPreference, width: number): ShellMode {
  if (pref === "legacy" || pref === "aegis") return pref;
  return width <= AUTO_AEGIS_MAX_WIDTH ? "aegis" : "legacy";
}

/** 訂閱視窗寬度（SSR 安全） */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

export function useShellMode() {
  const [preference, setPreference] = useState<ShellPreference>(() => readShellPreference());
  const width = useViewportWidth();
  const mode = resolveShellMode(preference, width);

  const setPreferencePersisted = useCallback((next: ShellPreference) => {
    setPreference(next);
    writeShellPreference(next);
  }, []);

  /** 在兩殼之間切換；會把結果寫成明確偏好（離開 auto） */
  const toggle = useCallback(() => {
    setPreferencePersisted(mode === "legacy" ? "aegis" : "legacy");
  }, [mode, setPreferencePersisted]);

  return { mode, preference, setPreference: setPreferencePersisted, toggle };
}
