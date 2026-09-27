/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useSceneResources, DEFAULT_SCENE_RESOURCES } from "../utils/resourceManager";
import { Palette, Sun, Moon, Image as ImageIcon, Check, RotateCcw, Sparkles, Eye } from "lucide-react";

export interface ThemeControllerProps {
  currentScene: string;
}


export type ThemeMode = "day" | "night" | "dark";
export type AccentColor = "emerald" | "crimson" | "blue" | "purple" | "amber";
export type CardOpacity = "high" | "medium" | "solid";

const ACCENT_CONFIGS: Record<AccentColor, { name: string; border: string; glow: string; text: string; dotBg: string; colorHex: string; cardBorder: string; cardTintBg: string }> = {
  emerald: {
    name: "科技翡翠 (草/自然)",
    border: "border-emerald-500/50",
    glow: "rgba(16, 185, 129, 0.15)",
    text: "text-emerald-400",
    dotBg: "bg-emerald-500",
    colorHex: "#10b981",
    cardBorder: "rgba(16, 185, 129, 0.35)",
    cardTintBg: "6, 24, 18",
  },
  crimson: {
    name: "熱血烈焰 (火/戰鬥)",
    border: "border-red-500/50",
    glow: "rgba(239, 68, 68, 0.18)",
    text: "text-red-400",
    dotBg: "bg-red-500",
    colorHex: "#ef4444",
    cardBorder: "rgba(239, 68, 68, 0.35)",
    cardTintBg: "26, 10, 12",
  },
  blue: {
    name: "深海天藍 (水/高科)",
    border: "border-blue-500/50",
    glow: "rgba(59, 130, 246, 0.18)",
    text: "text-blue-400",
    dotBg: "bg-blue-500",
    colorHex: "#3b82f6",
    cardBorder: "rgba(59, 130, 246, 0.35)",
    cardTintBg: "10, 18, 30",
  },
  purple: {
    name: "虛空紫晶 (混沌/神秘)",
    border: "border-purple-500/50",
    glow: "rgba(168, 85, 247, 0.18)",
    text: "text-purple-400",
    dotBg: "bg-purple-500",
    colorHex: "#a855f7",
    cardBorder: "rgba(168, 85, 247, 0.35)",
    cardTintBg: "20, 10, 28",
  },
  amber: {
    name: "神聖琥珀 (聖靈/黃金)",
    border: "border-amber-500/50",
    glow: "rgba(245, 158, 11, 0.18)",
    text: "text-amber-400",
    dotBg: "bg-amber-500",
    colorHex: "#f59e0b",
    cardBorder: "rgba(245, 158, 11, 0.35)",
    cardTintBg: "26, 18, 6",
  },
};

const OPACITY_CONFIGS: Record<CardOpacity, { name: string; alpha: string; blur: string }> = {
  high: { name: "💎 晶瑩高透 (45%)", alpha: "0.45", blur: "6px" },
  medium: { name: "🌙 經典半透 (80%)", alpha: "0.80", blur: "12px" },
  solid: { name: "🛡️ 沉浸實心 (96%)", alpha: "0.96", blur: "20px" },
};

function getThemeState() {
  let bg: string | null = null;
  let theme: ThemeMode = "night";
  let accent: AccentColor = "emerald";
  let cardOpacity: CardOpacity = "medium";
  try {
    const params = new URLSearchParams(window.location.search);
    const bgParam = params.get("bg");
    if (bgParam) bg = bgParam.trim();

    const themeParam = params.get("theme") as ThemeMode;
    if (themeParam && ["day", "night", "dark"].includes(themeParam)) {
      theme = themeParam;
    }

    const accentParam = params.get("accent") as AccentColor;
    if (accentParam && Object.keys(ACCENT_CONFIGS).includes(accentParam)) {
      accent = accentParam;
    }

    const opacityParam = params.get("cardOpacity") as CardOpacity;
    if (opacityParam && Object.keys(OPACITY_CONFIGS).includes(opacityParam)) {
      cardOpacity = opacityParam;
    }
  } catch {}
  return { bg, theme, accent, cardOpacity };
}

// 觸發全域主題同步事件
function notifyThemeUpdate() {
  try {
    window.dispatchEvent(new Event("theme-update"));
  } catch {}
}

/**
 * 專屬渲染於主畫面一般頁面區塊 (main / start-screen-container) 內部的背景圖層元件
 * 這樣背景圖就不會蓋到最上層的 Header 按鈕與 Navbar！
 */
export function ThemeBackground({ currentScene }: { currentScene: string }) {
  const [state, setState] = useState(() => getThemeState());

  useEffect(() => {
    const handleUpdate = () => {
      setState(getThemeState());
    };
    window.addEventListener("theme-update", handleUpdate);
    window.addEventListener("popstate", handleUpdate);
    return () => {
      window.removeEventListener("theme-update", handleUpdate);
      window.removeEventListener("popstate", handleUpdate);
    };
  }, []);

  const sceneResources = useSceneResources();
  const activeBg = state.bg || sceneResources[currentScene]?.bg || sceneResources["start"]?.bg || "";
  const currentAccent = ACCENT_CONFIGS[state.accent];
  const currentOpacity = OPACITY_CONFIGS[state.cardOpacity] || OPACITY_CONFIGS.medium;

  useEffect(() => {
    document.documentElement.style.setProperty("--accent-glow", currentAccent.glow);
    document.documentElement.style.setProperty("--accent-hex", currentAccent.colorHex);
    document.documentElement.style.setProperty("--card-bg", `rgba(${currentAccent.cardTintBg}, ${currentOpacity.alpha})`);
    document.documentElement.style.setProperty("--card-border", currentAccent.cardBorder);
    document.documentElement.style.setProperty("--card-blur", currentOpacity.blur);
  }, [currentAccent, currentOpacity]);

  // 決定遮罩樣式：針對一般頁面背景呈現合宜的透明與對比度
  const getOverlayClass = () => {
    switch (state.theme) {
      case "day":
        return "bg-gradient-to-b from-slate-900/30 via-slate-900/20 to-slate-950/45";
      case "dark":
        return "bg-slate-950/90";
      case "night":
      default:
        return "bg-gradient-to-b from-slate-950/70 via-[#0a0c10]/65 to-slate-950/80";
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden select-none" id="page-bg-layer">
      {/* 背景圖片層 (當 activeBg 存在且非空時才渲染) */}
      {activeBg && activeBg !== "none" && activeBg !== "null" && (
        activeBg.endsWith(".html") ? (
          <iframe
            src={activeBg}
            className="absolute inset-0 w-full h-full border-none pointer-events-none transition-all duration-700 ease-in-out scale-[1.01]"
            title="Custom HTML Background"
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full transition-all duration-700 ease-in-out scale-[1.01]"
            style={{
              backgroundImage: `url('${activeBg}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        )
      )}
      {/* 日夜模式與遮罩層 */}
      <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${getOverlayClass()}`} />
      {/* 能量主色光暈放射層 */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-in-out opacity-80"
        style={{
          background: `radial-gradient(circle at 50% 15%, ${currentAccent.glow} 0%, transparent 65%)`,
        }}
      />
    </div>
  );
}
