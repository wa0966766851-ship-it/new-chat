import { createContext, useContext } from "react";

/**
 * 殼層是否已提供左上「返回」（2026-11-07）。
 * Aegis 在非首頁、非戰鬥時會顯示返回鈕；頁面內建的「返回首頁／返回大廳／←」在此時隱藏，避免兩顆返回並列。
 * Legacy 殼與單元測試沒有 Provider → false，頁面照舊顯示自己的返回鈕。
 */
export const ShellBackContext = createContext(false);
export const useShellBack = () => useContext(ShellBackContext);
