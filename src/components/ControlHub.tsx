import React, { useState, useEffect, useRef, useMemo } from "react";
import { CONTROL_SECTIONS, normalizePlaylist, readControlSetting } from '../utils/controlSettings';
import { 
  Palette, Sun, Moon, Maximize2, Minimize2, LayoutDashboard, Copy, Image as ImageIcon, Check, RotateCcw, 
  Sparkles, Eye, Music, Play, Square, X, ExternalLink, 
  Volume2, VolumeX, Settings2, Sliders, Monitor
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSceneResources, saveSceneResources, DEFAULT_SCENE_RESOURCES, SceneResourceMap } from "../utils/resourceManager";
import { BATTLE_ANIMATION_OPTIONS, readAnimationSettings, writeAnimationSettings } from "../battle/animationSettings";

// --- Theme Types & Config ---
const DEFAULT_P1_LAYOUT = { pos: { x: 59.6, y: -5.2 }, size: { width: 636.8, height: 400 }, opacity: 0.95, scale: 1 };
const DEFAULT_P2_LAYOUT = { pos: { x: 734.8, y: -3.6 }, size: { width: 598.4, height: 406.4 }, opacity: 0.95, scale: 1.1 };
const DEFAULT_TACTICAL_LAYOUT = { pos: { x: 161.2, y: 414 }, size: { width: 1199.2, height: 320 }, opacity: 0.95, scale: 1.1 };
export type ThemeMode = "day" | "night" | "dark";
export type AccentColor = "emerald" | "crimson" | "blue" | "purple" | "amber";
export type CardOpacity = "high" | "medium" | "solid";


const ACCENT_CONFIGS: Record<AccentColor, { name: string; border: string; glow: string; text: string; dotBg: string; colorHex: string; cardBorder: string; cardTintBg: string }> = {
  emerald: { name: "科技翡翠", border: "border-emerald-500/50", glow: "rgba(16, 185, 129, 0.15)", text: "text-emerald-400", dotBg: "bg-emerald-500", colorHex: "#10b981", cardBorder: "rgba(16, 185, 129, 0.35)", cardTintBg: "6, 24, 18" },
  crimson: { name: "熱血烈焰", border: "border-red-500/50", glow: "rgba(239, 68, 68, 0.18)", text: "text-red-400", dotBg: "bg-red-500", colorHex: "#ef4444", cardBorder: "rgba(239, 68, 68, 0.35)", cardTintBg: "26, 10, 12" },
  blue: { name: "深海天藍", border: "border-blue-500/50", glow: "rgba(59, 130, 246, 0.18)", text: "text-blue-400", dotBg: "bg-blue-500", colorHex: "#3b82f6", cardBorder: "rgba(59, 130, 246, 0.35)", cardTintBg: "10, 18, 30" },
  purple: { name: "虛空紫晶", border: "border-purple-500/50", glow: "rgba(168, 85, 247, 0.18)", text: "text-purple-400", dotBg: "bg-purple-500", colorHex: "#a855f7", cardBorder: "rgba(168, 85, 247, 0.35)", cardTintBg: "20, 10, 28" },
  amber: { name: "神聖琥珀", border: "border-amber-500/50", glow: "rgba(245, 158, 11, 0.18)", text: "text-amber-400", dotBg: "bg-amber-500", colorHex: "#f59e0b", cardBorder: "rgba(245, 158, 11, 0.35)", cardTintBg: "26, 18, 6" },
};

const OPACITY_CONFIGS: Record<CardOpacity, { name: string; alpha: string; blur: string }> = {
  high: { name: "💎 晶瑩", alpha: "0.45", blur: "6px" },
  medium: { name: "🌙 經典", alpha: "0.80", blur: "12px" },
  solid: { name: "🛡️ 沉浸", alpha: "0.96", blur: "20px" },
};

// --- Audio Config ---

const YT_PLAYLIST_ID = "PLKcbDq_GFMWPX-SBoCM_DDUwi0fKRyHld";

// 命運之輪 BGM 輪替邏輯：從 p=26 到 p=1
function getDestinyWheelPage() {
  try {
    const key = "seer_destiny_bgm_p";
    const current = parseInt(localStorage.getItem(key) || "26");
    let next = current - 1;
    if (next < 1) next = 26;
    localStorage.setItem(key, next.toString());
    return current;
  } catch {
    return 26;
  }
}

// YouTube 輪替邏輯
function getYtPlaylistIndex(scene: string) {
  try {
    const key = `seer_yt_index_${scene}`;
    const current = parseInt(localStorage.getItem(key) || (scene === "battle" ? "70" : "1"));
    let next;
    if (scene === "battle") {
      next = current - 1;
      if (next < 1) next = 70;
    } else {
      next = current + 1;
      if (next > 70) next = 1;
    }
    localStorage.setItem(key, next.toString());
    return current;
  } catch {
    return scene === "battle" ? 70 : 1;
  }
}

function getThemeState() {
  let bg: string | null = null;
  let theme: ThemeMode = "night";
  let accent: AccentColor = "emerald";
  let cardOpacity: CardOpacity = "medium";
  let bgmUrl: string | null = null;
  
  try {
    const params = new URLSearchParams(window.location.search);
    bg = params.get("bg");
    const t = params.get("theme") as ThemeMode;
    if (t && ["day", "night", "dark"].includes(t)) theme = t;
    const a = params.get("accent") as AccentColor;
    if (a && ACCENT_CONFIGS[a]) accent = a;
    const o = params.get("cardOpacity") as CardOpacity;
    if (o && OPACITY_CONFIGS[o]) cardOpacity = o;
    bgmUrl = params.get("bgm");
  } catch {}
  return { bg, theme, accent, cardOpacity, bgmUrl };
}

function notifyThemeUpdate() {
  try {
    window.dispatchEvent(new Event("theme-update"));
  } catch {}
}

function ScenePreviewMedia({ src, alt, className = "", allowPreview = false }: { src: string; alt?: string; className?: string; allowPreview?: boolean }) {
  const [preview, setPreview] = useState(false);
  useEffect(() => setPreview(false), [src]);
  if (!src) return null;
  if (src.endsWith(".html")) {
    // 動態背景只在明確預覽時啟動；不可同時跑數十個隱藏動畫 iframe。
    if (!preview) {
      const placeholderClass = `flex items-center justify-center bg-slate-900 text-slate-300 text-xs ${className}`;
      // 清單縮圖本身在選取按鈕裡，不再巢狀放按鈕；只有獨立大預覽可啟動 iframe。
      return allowPreview
        ? <button type="button" aria-label={`預覽 ${alt || '動態背景'}`} onClick={() => setPreview(true)} className={placeholderClass}>動態背景 · 點擊預覽</button>
        : <span className={placeholderClass}>動態背景</span>;
    }
    return (
      <iframe
        src={src}
        title={alt || "HTML Preview"}
        className={`pointer-events-none select-none border-none ${className}`}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt || "Image Preview"}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}

const DEFAULT_BACKGROUNDS = [
  "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg",
  "https://img.bizhiciyuan.com/item/69bab6ceb96fa53fd04c681d/6fd594e8ad7aa05d95b12a22cf32a634.jpg",
  "/bg_explore_3.html",
  "/bg_explore_4.html",
  "/bg_explore_5.html",
  "/bg_explore_6.html",
  "/bg_explore_7.html",
  "/bg_explore_8.html",
  "/bg_explore_9.html",
  "/bg_explore_21.html",
  "/bg_explore_22.html",
  "/bg_explore_23.html",
  "/bg_explore_24.html",
  "/slide_01.html",
  "/slide_02.html",
  "/slide_03.html",
  "/slide_04.html",
  "/slide_05.html",
  "/slide_06.html",
  "/slide_07.html",
  "/slide_08.html",
  "/slide_09.html",
  "/slide_10.html",
  "/slide_11.html",
  "/slide_12.html"
];

const DEFAULT_PLAYLIST = [
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=1", title: "歌曲 1" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=2", title: "歌曲 2" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=3", title: "歌曲 3" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=4", title: "歌曲 4" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=5", title: "歌曲 5" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=6", title: "歌曲 6" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=7", title: "歌曲 7" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=8", title: "歌曲 8" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=9", title: "歌曲 9" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=10", title: "歌曲 10" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=11", title: "歌曲 11" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=12", title: "歌曲 12" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=13", title: "歌曲 13" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=14", title: "歌曲 14" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=15", title: "歌曲 15" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=16", title: "歌曲 16" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=17", title: "歌曲 17" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=18", title: "歌曲 18" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=19", title: "歌曲 19" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=20", title: "歌曲 20" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=21", title: "歌曲 21" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=22", title: "歌曲 22" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=23", title: "歌曲 23" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=24", title: "歌曲 24" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=25", title: "歌曲 25" }
];

const RECOMMENDED_BACKGROUNDS = [
  { name: "首頁星際殿堂", url: "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg" },
  { name: "精靈實戰決鬥場", url: "https://img.bizhiciyuan.com/item/69bab6ceb96fa53fd04c681d/6fd594e8ad7aa05d95b12a22cf32a634.jpg" },
  { name: "星際背景 · 003 蔚藍母星系 🌌", url: "/bg_explore_3.html" },
  { name: "星際背景 · 004 火紅星塵裂縫 🔥", url: "/bg_explore_4.html" },
  { name: "星際背景 · 005 浩瀚雙星螺旋 🌀", url: "/bg_explore_5.html" },
  { name: "星際背景 · 006 虛空高能信號 ⚡", url: "/bg_explore_6.html" },
  { name: "星際背景 · 007 暗物質吸積盤 🕳️", url: "/bg_explore_7.html" },
  { name: "星際背景 · 008 藍超巨星新星 💫", url: "/bg_explore_8.html" },
  { name: "星際背景 · 009 氣態巨行星帶 🪐", url: "/bg_explore_9.html" },
  { name: "星際背景 · 021 能量風暴通道 🌪️", url: "/bg_explore_21.html" },
  { name: "星際背景 · 022 恆星日冕外殼 ☀️", url: "/bg_explore_22.html" },
  { name: "星際背景 · 023 超對稱重力透鏡 ✨", url: "/bg_explore_23.html" },
  { name: "星際背景 · 024 多元超維通道 🪐", url: "/bg_explore_24.html" },
  { name: "動態幻燈片 · Slide 01 🌌", url: "/slide_01.html" },
  { name: "動態幻燈片 · Slide 02 🌟", url: "/slide_02.html" },
  { name: "動態幻燈片 · Slide 03 🚀", url: "/slide_03.html" },
  { name: "動態幻燈片 · Slide 04 🪐", url: "/slide_04.html" },
  { name: "動態幻燈片 · Slide 05 ⚡", url: "/slide_05.html" },
  { name: "動態幻燈片 · Slide 06 💫", url: "/slide_06.html" },
  { name: "動態幻燈片 · Slide 07 🔥", url: "/slide_07.html" },
  { name: "動態幻燈片 · Slide 08 🌀", url: "/slide_08.html" },
  { name: "動態幻燈片 · Slide 09 ✨", url: "/slide_09.html" },
  { name: "動態幻燈片 · Slide 10 🌠", url: "/slide_10.html" },
  { name: "動態幻燈片 · Slide 11 🔮", url: "/slide_11.html" },
  { name: "動態幻燈片 · Slide 12 🌌", url: "/slide_12.html" },
];

const RECOMMENDED_BGMS = [
  { name: "星際首頁主題 BGM", id: "wJ8onQryXRY" },
  { name: "烈焰決鬥戰鬥 BGM", id: "RjYnSIzR9Bo" },
  { name: "命運輪替 BGM 系列", id: "BV1uh411Y73e" },
  { name: "電音熱血神曲 BGM", id: "dQw4w9WgXcQ" },
  { name: "神秘虛空寂靜 BGM", id: "1Y20pVY25mI" }
];

export default function ControlHub({ currentScene }: { currentScene: string }) {
  const [state, setState] = useState(() => getThemeState());
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<typeof CONTROL_SECTIONS[number]['id']>("visual");
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedScene, setSelectedScene] = useState<string>("start");
  const sceneResources = useSceneResources();
  const [localResources, setLocalResources] = useState<SceneResourceMap>(sceneResources);

  const updateSceneBg = (sceneKey: string, newBg: string) => {
    const currentRes = localResources[sceneKey] || { name: sceneKey, bg: "", bgm: "" };
    const next = { ...localResources, [sceneKey]: { ...currentRes, bg: newBg } };
    setLocalResources(next);
    saveSceneResources(next);
  };

  const updateSceneBgm = (sceneKey: string, newBgm: string) => {
    const currentRes = localResources[sceneKey] || { name: sceneKey, bg: "", bgm: "" };
    const next = { ...localResources, [sceneKey]: { ...currentRes, bgm: newBgm } };
    setLocalResources(next);
    saveSceneResources(next);
  };
  
  // sync localResources when sceneResources changes from outside
  useEffect(() => {
    setLocalResources(sceneResources);
  }, [sceneResources]);
  
  const validPanel = (value: any): value is typeof DEFAULT_P1_LAYOUT => !!value &&
    ['x', 'y'].every(key => Number.isFinite(value.pos?.[key])) &&
    ['width', 'height'].every(key => Number.isFinite(value.size?.[key]) && value.size[key] > 0) &&
    Number.isFinite(value.scale) && value.scale > 0 && Number.isFinite(value.opacity);
  const [p1Panel, setP1Panel] = useState(() => readControlSetting('p1Panel', DEFAULT_P1_LAYOUT, validPanel));
  const [p2Panel, setP2Panel] = useState(() => readControlSetting('p2Panel', DEFAULT_P2_LAYOUT, validPanel));
  const [tacticalPanel, setTacticalPanel] = useState(() => readControlSetting('tacticalPanel', DEFAULT_TACTICAL_LAYOUT, validPanel));
  const [hudOpacity, setHudOpacity] = useState(() => parseFloat(localStorage.getItem('hudOpacity') || "0.95"));
  const [animationSettings, setAnimationSettings] = useState(() => readAnimationSettings());
  const [customLayout, setCustomLayout] = useState(() => { try { return localStorage.getItem('battleCustomLayout') === '1'; } catch { return false; } });

  useEffect(() => {
    try {
    localStorage.setItem('p1Panel', JSON.stringify(p1Panel));
    localStorage.setItem('p2Panel', JSON.stringify(p2Panel));
    localStorage.setItem('tacticalPanel', JSON.stringify(tacticalPanel));
    localStorage.setItem('hudOpacity', hudOpacity.toString());
    window.dispatchEvent(new Event('battle-layout-update'));
    } catch { /* 儲存不可用時不讓設定面板崩潰。 */ }
  }, [p1Panel, p2Panel, tacticalPanel, hudOpacity]);

  useEffect(() => {
    const handleOpenSettings = (e: any) => {
      setIsOpen(true);
      if (CONTROL_SECTIONS.some(section => section.id === e.detail?.tab)) setActiveTab(e.detail.tab);
    };
    window.addEventListener('open-settings', handleOpenSettings as EventListener);
    return () => window.removeEventListener('open-settings', handleOpenSettings as EventListener);
  }, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputBgUrl, setInputBgUrl] = useState("");
  const [inputBgmUrl, setInputBgmUrl] = useState("");
  
  const [playlist, setPlaylist] = useState<{ url: string; title: string }[]>(() => {
    try {
      const saved = localStorage.getItem("seer_playlist");
      return normalizePlaylist(saved ? JSON.parse(saved) : DEFAULT_PLAYLIST, DEFAULT_PLAYLIST);
    } catch {
      return DEFAULT_PLAYLIST.map(item => ({ ...item }));
    }
  });

  const [backgrounds, setBackgrounds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("seer_backgrounds");
      const loaded = saved ? JSON.parse(saved) : [];
      const merged = Array.from(new Set([...DEFAULT_BACKGROUNDS, ...(Array.isArray(loaded) ? loaded.filter(url => typeof url === 'string') : [])]));
      return merged;
    } catch {
      return DEFAULT_BACKGROUNDS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("seer_playlist", JSON.stringify(playlist));
      localStorage.setItem("seer_backgrounds", JSON.stringify(backgrounds));
    } catch { setFeedback('儲存空間不可用：這次變更僅保留在畫面，未存入本機。'); }
  }, [playlist, backgrounds]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [ytMounted, setYtMounted] = useState(false);
  useEffect(() => { if (isPlaying) setYtMounted(true); }, [isPlaying]);
  const [isMuted, setIsMuted] = useState(true); // 預設靜音且停止
  const [feedback, setFeedback] = useState<string | null>(null);
  
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const handleUpdate = () => setState(getThemeState());
    window.addEventListener("theme-update", handleUpdate);
    window.addEventListener("popstate", handleUpdate);
    return () => {
      window.removeEventListener("theme-update", handleUpdate);
      window.removeEventListener("popstate", handleUpdate);
    };
  }, []);

  const updateUrlParam = (params: Record<string, string | null>) => {
    try {
      const url = new URL(window.location.href);
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      });
      window.history.replaceState(null, "", url.toString());
      notifyThemeUpdate();
    } catch {}
  };

  const currentAccent = ACCENT_CONFIGS[state.accent];

  // --- Search Logic ---

  // --- Audio Logic ---
  const getMusicInfo = (url: string | null) => {
    if (!url) {
      const isDestiny = currentScene === "destiny_wheel";
      if (isDestiny) {
        return { type: "bilibili" as const, id: sceneResources.destiny_wheel?.bgm || "BV1uh411Y73e", page: getDestinyWheelPage() };
      }
      return { 
        type: "youtube" as const, 
        id: sceneResources[currentScene]?.bgm || "wJ8onQryXRY",
        index: getYtPlaylistIndex(currentScene) 
      };
    }
    
    if (url.includes("bilibili.com") || url.match(/BV[a-zA-Z0-9]+/i)) {
      const match = url.match(/BV[a-zA-Z0-9]+/i);
      const pMatch = url.match(/[?&]p=(\d+)/);
      return { 
        type: "bilibili" as const, 
        id: match ? match[0] : url,
        page: pMatch ? parseInt(pMatch[1]) : 1
      };
    }
    
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    const listMatch = url.match(/[?&]list=([^&]+)/);
    const indexMatch = url.match(/[?&]index=(\d+)/);

    return { 
      type: "youtube" as const, 
      id: ytMatch ? ytMatch[1] : "wJ8onQryXRY", 
      playlist: listMatch ? listMatch[1] : YT_PLAYLIST_ID,
      index: indexMatch ? parseInt(indexMatch[1]) : 1
    };
  };

  // 輪替有存檔副作用，只在真正切換場景／音樂時執行，不能每次開設定便換曲。
  const musicInfo = useMemo(() => getMusicInfo(state.bgmUrl), [state.bgmUrl, currentScene, sceneResources[currentScene]?.bgm]);

  const sendYtCommand = (command: string, args: any[] = []) => {
    if (ytIframeRef.current?.contentWindow) {
      ytIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: command, args }),
        "*"
      );
    }
  };

  const togglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (musicInfo.type === "youtube") {
      sendYtCommand(nextState ? "playVideo" : "pauseVideo");
    }
  };

  const toggleMute = () => {
    // 預設邏輯：如果沒在播放，按一下就「開始播放且取消靜音」
    if (!isPlaying) {
      setIsPlaying(true);
      setIsMuted(false);
      if (musicInfo.type === "youtube") {
        sendYtCommand("playVideo");
        sendYtCommand("unMute");
      }
    } else {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      if (musicInfo.type === "youtube") {
        sendYtCommand(nextMute ? "mute" : "unMute");
      }
    }
  };

  // 確保播放器指令生效的輔助 Hook
  useEffect(() => {
    if (isPlaying && musicInfo.type === "youtube") {
      const timer = setTimeout(() => {
        sendYtCommand("playVideo");
        sendYtCommand(isMuted ? "mute" : "unMute");
        sendYtCommand("setVolume", [50]);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [musicInfo.id, isPlaying]);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-3 select-none font-sans">
      {/* 隱藏的播放器 */}
      <div className="hidden opacity-0 pointer-events-none">
        {/* 效能：使用者第一次按播放後才建立 YouTube 播放器，避免背景常駐載入 */}
        {musicInfo.type === "youtube" && (isPlaying || ytMounted) && (
        <iframe
          ref={ytIframeRef}
          src={`https://www.youtube.com/embed/${musicInfo.type === "youtube" ? (musicInfo.id || "wJ8onQryXRY") : "wJ8onQryXRY"}?enablejsapi=1&autoplay=1&mute=1&loop=1&list=${(musicInfo as any).playlist || YT_PLAYLIST_ID}&index=${(musicInfo as any).index || 1}`}
          allow="autoplay; encrypted-media"
          className="w-0 h-0"
        />
        )}
        {musicInfo.type === "bilibili" && isPlaying && (
          <iframe
            src={`//player.bilibili.com/player.html?bvid=${musicInfo.id}&page=${musicInfo.page}&high_quality=1&autoplay=1`}
            allow="autoplay"
            className="w-0 h-0"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* 快速播放按鍵：點擊啟動並解除靜音 */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleMute}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-2xl border backdrop-blur-2xl transition-all ${
            isPlaying && !isMuted
              ? "bg-blue-600 border-blue-400 text-white animate-pulse" 
              : "bg-slate-900/90 border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
        >
          {isMuted || !isPlaying ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </motion.button>

        {/* 主入口按鈕 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-xl shadow-2xl transition-all ${
            isOpen ? "bg-slate-800 border-slate-600 ring-2 ring-blue-500/20" : `bg-slate-900/90 ${currentAccent.border} hover:bg-slate-800`
          }`}
        >
          <div className="relative">
            <Settings2 className={`w-4 h-4 ${isOpen ? "text-blue-400 rotate-90" : currentAccent.text} transition-transform duration-300`} />
            {isPlaying && !isMuted && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-slate-100 tracking-wider">控制中心</span>
        </motion.button>
      </div>

      {/* 控制面板 */}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog" aria-label="系統控制中心" data-control-hub
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={isMaximized 
        ? "fixed inset-4 sm:inset-12 z-[200] bg-slate-950/95 backdrop-blur-3xl border border-slate-700/80 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden" 
        : "fixed top-20 right-3 z-[200] w-[calc(100vw-1.5rem)] sm:w-[440px] bg-slate-950/95 backdrop-blur-md border border-slate-700/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)]"}
          >
            {/* Header Tabs */}
            <div className="flex flex-col p-2 bg-slate-900/50 border-b border-slate-800/50 gap-2">
                <div className="flex justify-between items-center px-2 pt-1">
                  <div><h2 className="text-base font-semibold text-slate-100">系統控制中心</h2><p className="text-xs text-slate-400 mt-1">依用途調整；變更會保留在本機</p></div>
                  <div className="flex gap-1"><button type="button" aria-label={isMaximized ? '縮小控制中心' : '放大控制中心'} onClick={() => setIsMaximized(!isMaximized)} className="text-slate-400 hover:text-white transition-colors p-2">
                    {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button><button type="button" aria-label="關閉控制中心" onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button></div>
                </div>
                {activeTab === 'resources' && <input
                  type="text"
                  placeholder="搜尋場景名稱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />}
                <div className="grid grid-cols-3 gap-1" aria-label="控制中心分類">
                    <button
                      onClick={() => setActiveTab("visual")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        activeTab === "visual" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Monitor className="w-4 h-4" /> 外觀
                    </button>
                    <button
                      onClick={() => setActiveTab("audio")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        activeTab === "audio" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Music className="w-4 h-4" /> 音樂
                    </button>
                    <button
                      onClick={() => setActiveTab("battle")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all ${ 
                        activeTab === "battle" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4" /> 戰鬥介面
                    </button>
                    <button
                      onClick={() => setActiveTab("resources")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all ${ 
                        activeTab === "resources" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Monitor className="w-4 h-4" /> 場景配置
                    </button>
                    <button onClick={() => setActiveTab('library')} className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold ${activeTab === 'library' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><ImageIcon className="w-4 h-4" />素材庫</button>
                    <button
                      onClick={() => setActiveTab("advanced")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        activeTab === "advanced" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Sliders className="w-4 h-4" /> 診斷
                    </button>
                </div>
            </div>

            <div className={`p-5 overflow-y-auto custom-scrollbar ${isMaximized ? "flex-1" : "max-h-[70vh]"}`}>
              <p className="text-xs text-slate-400 mb-4">{CONTROL_SECTIONS.find(section => section.id === activeTab)?.description}</p>
              {activeTab === "visual" && (
                <div className="space-y-6">
                  {/* Mode Selector */}
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 font-semibold">環境模式</label>
                    <p className="text-xs text-slate-400">只調整背景遮罩的明暗，不改變主色或戰鬥數值的辨識色。</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "day", icon: Sun, label: "日間", color: "text-amber-400" },
                        { id: "night", icon: Moon, label: "標準", color: "text-blue-400" },
                        { id: "dark", icon: Eye, label: "極黑", color: "text-purple-400" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          aria-pressed={state.theme === item.id}
                          onClick={() => updateUrlParam({ theme: item.id === "night" ? null : item.id })}
                          className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                            state.theme === item.id 
                              ? "bg-slate-800 border-blue-500/50 ring-1 ring-blue-500/30" 
                              : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <item.icon className={`w-5 h-5 ${state.theme === item.id ? item.color : "text-slate-500"}`} />
                          <span className="text-[11px] font-bold text-slate-300">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent Colors */}
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 font-semibold">介面主色：{currentAccent.name}</label>
                    <p className="text-xs text-slate-400">統一卡片邊框、控制中心選項與共用分頁的主色。血量、異常、強化／弱化與連線狀態保留原辨識色；獨立模式的專屬配色暫不變更。</p>
                    <div className="flex justify-between items-center bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
                      {(Object.keys(ACCENT_CONFIGS) as AccentColor[]).map((key) => (
                        <button
                          key={key}
                          aria-label={`主色：${ACCENT_CONFIGS[key].name}`}
                          title={ACCENT_CONFIGS[key].name}
                          aria-pressed={state.accent === key}
                          onClick={() => updateUrlParam({ accent: key === "emerald" ? null : key })}
                          className={`w-8 h-8 rounded-full transition-all flex items-center justify-center border-2 ${
                            state.accent === key ? "border-white scale-110 shadow-lg" : "border-transparent opacity-50 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: ACCENT_CONFIGS[key].colorHex }}
                        >
                          {state.accent === key && <Check className="w-4 h-4 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Opacity */}
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 font-semibold">卡片透明度</label>
                    <p className="text-xs text-slate-400">晶瑩較透明、經典平衡、沉浸接近不透明。只影響一般卡片；長篇詳情保持不透明以便閱讀，戰鬥停用背景模糊以降低負擔。</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(OPACITY_CONFIGS) as CardOpacity[]).map((key) => (
                        <button
                          key={key}
                          aria-pressed={state.cardOpacity === key}
                          onClick={() => updateUrlParam({ cardOpacity: key === "medium" ? null : key })}
                          className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                            state.cardOpacity === key 
                              ? "control-selected"
                              : "bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {OPACITY_CONFIGS[key].name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom BG */}
                  <div className="space-y-3 pt-2 border-t border-slate-800/50">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">選擇場景背景</label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 hover:bg-slate-900"
                        value={state.bg || ""}
                        onChange={(e) => {
                            updateUrlParam({ bg: e.target.value });
                            setFeedback("背景已套用");
                            setTimeout(() => setFeedback(null), 2000);
                        }}
                    >
                        <option value="" className="bg-slate-950 text-slate-400">-- 請選擇一個背景 --</option>
                        {backgrounds.map((url, i) => {
                            let label = `自訂背景 ${i + 1}`;
                            if (url === "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg") {
                              label = "精美插畫 · 太空歌劇院";
                            } else if (url === "https://img.bizhiciyuan.com/item/69bab6ceb96fa53fd04c681d/6fd594e8ad7aa05d95b12a22cf32a634.jpg") {
                              label = "精美插畫 · 深邃星團";
                            } else if (url.includes("bg_explore_3.html")) {
                              label = "星際背景 · 003 蔚藍母星系 🌌";
                            } else if (url.includes("bg_explore_4.html")) {
                              label = "星際背景 · 004 火紅星塵裂縫 🔥";
                            } else if (url.includes("bg_explore_5.html")) {
                              label = "星際背景 · 005 浩瀚雙星螺旋 🌀";
                            } else if (url.includes("bg_explore_6.html")) {
                              label = "星際背景 · 006 虛空高能信號 ⚡";
                            } else if (url.includes("bg_explore_7.html")) {
                              label = "星際背景 · 007 暗物質吸積盤 🕳️";
                            } else if (url.includes("bg_explore_8.html")) {
                              label = "星際背景 · 008 藍超巨星新星 💫";
                            } else if (url.includes("bg_explore_9.html")) {
                              label = "星際背景 · 009 氣態巨行星帶 🪐";
                            } else if (url.includes("bg_explore_21.html")) {
                              label = "星際背景 · 021 能量風暴通道 🌪️";
                            } else if (url.includes("bg_explore_22.html")) {
                              label = "星際背景 · 022 恆星日冕外殼 ☀️";
                            } else if (url.includes("bg_explore_23.html")) {
                              label = "星際背景 · 023 超對稱重力透鏡 ✨";
                            } else if (url.includes("bg_explore_24.html")) {
                              label = "星際背景 · 024 多元超維通道 🪐";
                            } else if (url.includes("slide_01.html")) {
                              label = "動態幻燈片 · Slide 01 🌌";
                            } else if (url.includes("slide_02.html")) {
                              label = "動態幻燈片 · Slide 02 🌟";
                            } else if (url.includes("slide_03.html")) {
                              label = "動態幻燈片 · Slide 03 🚀";
                            } else if (url.includes("slide_04.html")) {
                              label = "動態幻燈片 · Slide 04 🪐";
                            } else if (url.includes("slide_05.html")) {
                              label = "動態幻燈片 · Slide 05 ⚡";
                            } else if (url.includes("slide_06.html")) {
                              label = "動態幻燈片 · Slide 06 💫";
                            } else if (url.includes("slide_07.html")) {
                              label = "動態幻燈片 · Slide 07 🔥";
                            } else if (url.includes("slide_08.html")) {
                              label = "動態幻燈片 · Slide 08 🌀";
                            } else if (url.includes("slide_09.html")) {
                              label = "動態幻燈片 · Slide 09 ✨";
                            } else if (url.includes("slide_10.html")) {
                              label = "動態幻燈片 · Slide 10 🌠";
                            } else if (url.includes("slide_11.html")) {
                              label = "動態幻燈片 · Slide 11 🔮";
                            } else if (url.includes("slide_12.html")) {
                              label = "動態幻燈片 · Slide 12 🌌";
                            }
                            return (
                              <option key={i} value={url} className="bg-slate-900 text-white py-2">
                                  {label}
                              </option>
                            );
                        })}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">直接輸入連結</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputBgUrl}
                        onChange={(e) => setInputBgUrl(e.target.value)}
                        placeholder="圖片連結 (https://...)"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => {
                          if (inputBgUrl) {
                            updateUrlParam({ bg: inputBgUrl });
                            setFeedback("背景已套用");
                            setInputBgUrl("");
                            setTimeout(() => setFeedback(null), 2000);
                          }
                        }}
                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                    {state.bg && (
                      <button
                        onClick={() => updateUrlParam({ bg: null })}
                        className="w-full py-2 flex items-center justify-center gap-2 bg-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> 恢復預設背景
                      </button>
                    )}
                  </div>
                </div>
              )}
              {activeTab === "audio" && (
                <div className="space-y-6">
                  {/* Player Status */}
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 flex flex-col items-center gap-4">
                    <div className={`p-4 rounded-full bg-slate-900/80 border-2 ${isPlaying ? "border-blue-400 animate-pulse" : "border-slate-700"} shadow-xl`}>
                      <Music className={`w-8 h-8 ${isPlaying ? "text-blue-400 animate-[spin_5s_linear_infinite]" : "text-slate-600"}`} />
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-black text-slate-100">{isPlaying ? "正在播放音樂" : "音樂已暫停"}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">
                        {musicInfo.type.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={togglePlay}
                      className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-all shadow-lg active:scale-95 ${
                        isPlaying 
                          ? "bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30" 
                          : "bg-blue-600 text-white hover:bg-blue-500"
                      }`}
                    >
                      {isPlaying ? <><Square className="w-4 h-4 fill-current" /> 暫停播放</> : <><Play className="w-4 h-4 fill-current" /> 恢復播放</>}
                    </button>
                  </div>

                  {/* Playlist Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">選擇歌單音樂</label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 hover:bg-slate-900"
                        value={state.bgmUrl || ""}
                        onChange={(e) => {
                            updateUrlParam({ bgm: e.target.value });
                            setFeedback("音樂已切換");
                            setIsPlaying(true);
                            setTimeout(() => setFeedback(null), 2000);
                        }}
                    >
                        <option value="" className="bg-slate-950 text-slate-400">-- 請選擇一首歌曲 --</option>
                        {playlist.map((item, i) => (
                            <option key={i} value={item.url} className="bg-slate-900 text-white py-2">
                                {item.title}
                            </option>
                        ))}
                    </select>
                  </div>

                  {/* URL Input */}
                  <div className="space-y-3 pt-2 border-t border-slate-800/50">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">直接輸入連結 (YT / B站)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputBgmUrl}
                        onChange={(e) => setInputBgmUrl(e.target.value)}
                        placeholder="貼上連結或 ID"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => {
                          if (inputBgmUrl) {
                            updateUrlParam({ bgm: inputBgmUrl });
                            setFeedback("音樂已載入");
                            setInputBgmUrl("");
                            setIsPlaying(true);
                            setTimeout(() => setFeedback(null), 2000);
                          }
                        }}
                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "battle" && (
                <div className="space-y-6">
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 space-y-2" data-testid="battle-animation-settings">
                    <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest block">動畫播放</span>
                    <div className="grid grid-cols-2 gap-2">
                      {BATTLE_ANIMATION_OPTIONS.map(option => (
                        <label key={option.key} title={option.tip} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 px-3 py-2 cursor-pointer select-none">
                          <span className="text-xs font-bold text-slate-200">{option.label}</span>
                          <input type="checkbox" className="w-4 h-4 accent-cyan-500" checked={animationSettings[option.key]}
                            onChange={e => { const next = { ...animationSettings, [option.key]: e.target.checked }; setAnimationSettings(next); writeAnimationSettings(next); }} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-white/5 cursor-pointer select-none" title="開啟後戰鬥畫面改用可拖曳、縮放、調整透明度的浮動視窗；關閉時使用固定排版">
                    <span className="text-xs font-black text-slate-200">自訂佈局（拖曳／縮放／透明）</span>
                    <input
                      type="checkbox"
                      checked={customLayout}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setCustomLayout(v);
                        try { localStorage.setItem('battleCustomLayout', v ? '1' : '0'); } catch {}
                        window.dispatchEvent(new Event('battle-layout-update'));
                      }}
                      className="w-4 h-4 accent-cyan-500"
                    />
                  </label>
                  {customLayout && (<>
                  {/* Panel Controls */}
                  {[
                    { label: "玩家一 (P1) 視窗", state: p1Panel, setter: setP1Panel },
                    { label: "玩家二 (P2) 視窗", state: p2Panel, setter: setP2Panel },
                    { label: "戰術指令 (Tactical) 視窗", state: tacticalPanel, setter: setTacticalPanel }
                  ].map((panel, idx) => (
                    <div key={idx} className="space-y-3 bg-slate-900/40 p-4 rounded-xl border border-white/5">
                      <label className="text-[10px] font-black text-cyan-500 uppercase tracking-widest block">{panel.label}</label>
                      
                      {/* Position Control */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">X 座標</span>
                          <input 
                            type="number" 
                            value={Math.round(panel.state.pos.x)} 
                            onChange={(e) => panel.setter((prev: any) => ({ ...prev, pos: { ...prev.pos, x: parseInt(e.target.value) || 0 } }))}
                            className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Y 座標</span>
                          <input 
                            type="number" 
                            value={Math.round(panel.state.pos.y)} 
                            onChange={(e) => panel.setter((prev: any) => ({ ...prev, pos: { ...prev.pos, y: parseInt(e.target.value) || 0 } }))}
                            className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>

                      {/* Scale & Opacity Control */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">縮放比例 (%)</span>
                          <input 
                            type="number" 
                            min="0.1" max="2" step="0.05"
                            value={Math.round(panel.state.scale * 100)} 
                            onChange={(e) => panel.setter((prev: any) => ({ ...prev, scale: (parseInt(e.target.value) || 100) / 100 }))}
                            className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">透明度 (%)</span>
                          <input 
                            type="number" 
                            min="0" max="100"
                            value={Math.round(panel.state.opacity * 100)} 
                            onChange={(e) => panel.setter((prev: any) => ({ ...prev, opacity: (parseInt(e.target.value) || 100) / 100 }))}
                            className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">系統 HUD 不透明度 (Opacity)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0.2" 
                        max="1" 
                        step="0.05" 
                        value={hudOpacity} 
                        onChange={(e) => setHudOpacity(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                      <span className="text-sm font-mono font-bold text-cyan-400 w-12">{Math.round(hudOpacity * 100)}%</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => {
                        const layoutConfig = JSON.stringify({ p1: p1Panel, p2: p2Panel, tactical: tacticalPanel }, null, 2);
                        navigator.clipboard.writeText(layoutConfig);
                        setFeedback("視窗佈局代碼已複製到剪貼簿！");
                        setTimeout(() => setFeedback(null), 2000);
                      }}
                      className="flex items-center justify-center gap-2 py-3 bg-cyan-600/20 border border-cyan-500/30 hover:bg-cyan-600/30 text-cyan-400 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest"
                    >
                      <Copy className="w-3 h-3" /> 複製佈局代碼
                    </button>
                    <button 
                      onClick={() => {
                        // 依目前戰鬥畫面大小重新計算布局（由戰鬥畫面接收事件後計算）
                        setHudOpacity(0.95);
                        try { localStorage.setItem('hudOpacity', '0.95'); localStorage.removeItem('battleLayoutVersion'); } catch {}
                        window.dispatchEvent(new Event('battle-layout-update'));
                      }}
                      className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border border-white/5"
                    >
                      重置 UI 佈局
                    </button>
                  </div>
                  </>)}
                </div>
              )}
                         {activeTab === "resources" && (
                <div className="space-y-6">
                  {isMaximized ? (
                    /* ==============================
                       進階全螢幕看板（兩欄式百科風格設計）
                       ============================== */
                    <div className="flex h-full w-full gap-6 text-slate-100 overflow-hidden" style={{ minHeight: "60vh", maxHeight: "75vh" }}>
                      <style>{`
                        @keyframes sound-wave-bar {
                          0%, 100% { transform: scaleY(0.3); }
                          50% { transform: scaleY(1); }
                        }
                        .animate-bar1 { animation: sound-wave-bar 0.6s ease-in-out infinite; transform-origin: bottom; }
                        .animate-bar2 { animation: sound-wave-bar 0.9s ease-in-out infinite 0.15s; transform-origin: bottom; }
                        .animate-bar3 { animation: sound-wave-bar 0.5s ease-in-out infinite 0.3s; transform-origin: bottom; }
                        .animate-bar4 { animation: sound-wave-bar 0.8s ease-in-out infinite 0.05s; transform-origin: bottom; }
                        .animate-spin-slow { animation: spin 8s linear infinite; }
                        @keyframes spin {
                          from { transform: rotate(0deg); }
                          to { transform: rotate(360deg); }
                        }
                      `}</style>
                      
                      {/* 左欄：Scene 清單與基本資訊 */}
                      <div className="w-[35%] flex flex-col gap-4 border-r border-slate-800/80 pr-6 overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-sm font-bold text-slate-300">系統頁面總覽</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">點擊頁面以進行進階視覺/音樂配置</p>
                          </div>
                          <button 
                            onClick={() => {
                              setLocalResources(DEFAULT_SCENE_RESOURCES);
                              saveSceneResources(DEFAULT_SCENE_RESOURCES);
                              setFeedback("已恢復預設配置");
                              setTimeout(() => setFeedback(null), 2000);
                            }}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline font-bold"
                          >
                            恢復預設
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {Object.entries(localResources)
                            .filter(([scene, res]: [string, any]) => {
                              return res.name.toLowerCase().includes(searchTerm.toLowerCase()) || scene.toLowerCase().includes(searchTerm.toLowerCase());
                            })
                            .map(([scene, res]: [string, any]) => {
                              const isSelected = selectedScene === scene;
                              const resHasBg = res.bg && (res.bg.startsWith("http") || res.bg.startsWith("/") || res.bg.startsWith("data:"));
                              const isActiveBg = state.bg === res.bg || (!state.bg && sceneResources[currentScene]?.bg === res.bg && currentScene === scene);
                              
                              return (
                                <div
                                  key={scene}
                                  onClick={() => setSelectedScene(scene)}
                                  className={`relative p-3 rounded-2xl cursor-pointer border transition-all duration-300 group flex items-center justify-between ${
                                    isSelected 
                                      ? "bg-blue-600/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    {/* Thumbnail */}
                                    <div className="w-12 h-9 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 shrink-0 relative">
                                      {resHasBg ? (
                                        <ScenePreviewMedia src={res.bg} alt={res.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-700">
                                          <ImageIcon className="w-4 h-4" />
                                        </div>
                                      )}
                                      {isActiveBg && (
                                        <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-950 animate-pulse" title="目前渲染中" />
                                      )}
                                    </div>

                                    <div className="overflow-hidden">
                                      <p className={`text-xs font-bold leading-none ${isSelected ? "text-blue-400" : "text-slate-200"}`}>{res.name}</p>
                                      <p className="text-[9px] font-mono text-slate-500 mt-1 truncate">{scene}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {res.bgm && (
                                      <span className="p-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-bold flex items-center gap-1">
                                        <Music className="w-2.5 h-2.5 animate-spin-slow" />
                                        BGM
                                      </span>
                                    )}
                                    <span className={`text-xs transition-transform duration-300 font-bold ${isSelected ? "text-blue-400 translate-x-0.5" : "text-slate-600 group-hover:text-slate-400"}`}>→</span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* 批量傳輸 */}
                        <div className="mt-auto border-t border-slate-800/80 pt-4 space-y-2">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">批量資源傳輸</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(localResources, null, 2));
                                setFeedback("配置 JSON 已複製到剪貼簿！");
                                setTimeout(() => setFeedback(null), 2000);
                              }}
                              className="py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                              <Copy className="w-3.5 h-3.5" /> 匯出配置 JSON
                            </button>
                            <button
                              onClick={() => {
                                const input = prompt("請貼上匯出的頁面資源配置 JSON 字串：");
                                if (input) {
                                  try {
                                    const parsed = JSON.parse(input);
                                    if (parsed && typeof parsed === "object") {
                                      setLocalResources(parsed);
                                      saveSceneResources(parsed);
                                      setFeedback("成功匯入新配置！");
                                      setTimeout(() => setFeedback(null), 2000);
                                    } else {
                                      alert("無效的 JSON 格式");
                                    }
                                  } catch (e) {
                                    alert("解析失敗，請確認 JSON 是否正確。");
                                  }
                                }
                              }}
                              className="py-2 bg-blue-600/15 border border-blue-500/30 hover:bg-blue-600/25 text-blue-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> 匯入配置 JSON
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 右欄：編輯與預覽區 */}
                      <div className="flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar pl-2">
                        {/* 大卡片預覽區 */}
                        {(() => {
                          const selectedRes = (localResources as any)[selectedScene] || { name: "未知頁面", bg: "", bgm: "" };
                          const hasValidBg = selectedRes.bg && (selectedRes.bg.startsWith("http") || selectedRes.bg.startsWith("/") || selectedRes.bg.startsWith("data:"));
                          return (
                            <>
                              <div className="relative rounded-2xl border border-slate-800 bg-slate-950 aspect-[21/9] w-full overflow-hidden shadow-2xl flex flex-col justify-end p-5 shrink-0">
                                {hasValidBg ? (
                                  <ScenePreviewMedia src={selectedRes.bg} alt="目前場景" allowPreview className="absolute inset-0 w-full h-full object-cover object-center" />
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-700">
                                    <ImageIcon className="w-10 h-10 mb-2" />
                                    <span className="text-xs">此頁面目前尚未配置背景圖片</span>
                                  </div>
                                )}
                                {/* Overlay gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />

                                {/* Banner Text overlay */}
                                <div className="relative z-10 flex justify-between items-end w-full">
                                  <div>
                                    <span className="px-2 py-0.5 rounded bg-blue-500/25 border border-blue-500/30 text-blue-400 text-[9px] font-mono uppercase tracking-widest">{selectedScene}</span>
                                    <h2 className="text-xl font-black text-white mt-1.5 drop-shadow-lg">{selectedRes.name}</h2>
                                    <p className="text-xs text-slate-300 drop-shadow mt-0.5 font-mono max-w-[280px] truncate">{selectedRes.bg || "無背景圖路徑"}</p>
                                  </div>

                                  {hasValidBg && (
                                    <button
                                      onClick={() => {
                                        updateUrlParam({ bg: selectedRes.bg });
                                        setFeedback(`已套用「${selectedRes.name}」背景！`);
                                        setTimeout(() => setFeedback(null), 2000);
                                      }}
                                      className={`px-4 py-2 rounded-xl text-xs font-black shadow-lg transition-all border ${
                                        state.bg === selectedRes.bg 
                                          ? "bg-emerald-500 border-emerald-400 text-white cursor-default" 
                                          : "bg-blue-600 hover:bg-blue-500 border-blue-400 text-white"
                                      }`}
                                    >
                                      {state.bg === selectedRes.bg ? "當前背景使用中" : "即時套用此背景"}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* 雙卡片區：視覺 vs 音訊 */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 shrink-0">
                                {/* 視覺配置 */}
                                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
                                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <h4 className="text-xs font-bold text-slate-300">視覺背景配置</h4>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">自訂背景圖片路徑 (URL)</label>
                                    <input
                                      type="text"
                                      value={selectedRes.bg || ""}
                                      onChange={(e) => updateSceneBg(selectedScene, e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none placeholder:text-slate-700 font-mono"
                                      placeholder="輸入 https://... 的圖片網址或 /slide_01.html"
                                    />
                                  </div>

                                  {/* 快速推薦畫廊 */}
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">一鍵換裝：官方高畫質背景推薦</p>
                                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                      {RECOMMENDED_BACKGROUNDS.map((item) => {
                                        const isCurrentSelection = selectedRes.bg === item.url;
                                        return (
                                          <button
                                            key={item.name}
                                            onClick={() => {
                                              updateSceneBg(selectedScene, item.url);
                                              setFeedback(`已更換為「${item.name}」背景！`);
                                              setTimeout(() => setFeedback(null), 2000);
                                            }}
                                            className={`relative aspect-video rounded-xl overflow-hidden border transition-all text-left group ${
                                              isCurrentSelection 
                                                ? "border-blue-500 ring-1 ring-blue-500/30" 
                                                : "border-slate-800 hover:border-slate-700"
                                            }`}
                                          >
                                            <ScenePreviewMedia src={item.url} alt={item.name} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                                            <div className="absolute inset-0 bg-slate-950/40 pointer-events-none" />
                                            <div className="absolute bottom-1 left-1.5 right-1.5 z-10 pointer-events-none">
                                              <span className="text-[9px] font-bold text-white block drop-shadow">{item.name}</span>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* 音訊配置 */}
                                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
                                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                                    <h4 className="text-xs font-bold text-slate-300">音軌 BGM 配置</h4>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">YouTube 影片 ID / Bilibili BV 號</label>
                                    <input
                                      type="text"
                                      value={selectedRes.bgm || ""}
                                      onChange={(e) => updateSceneBgm(selectedScene, e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none placeholder:text-slate-700 font-mono"
                                      placeholder="例如: RjYnSIzR9Bo 或 BV1uh411Y73e"
                                    />
                                  </div>

                                  {/* 音訊控制與試聽 */}
                                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                                        <Music className="w-4 h-4" />
                                      </div>
                                      <div className="overflow-hidden">
                                        <p className="text-xs font-bold text-slate-300 truncate">{selectedRes.bgm ? `已配對 ID: ${selectedRes.bgm}` : "尚未配對 BGM"}</p>
                                        {isPlaying && selectedRes.bgm && musicInfo.id === selectedRes.bgm ? (
                                          <div className="flex items-center gap-1 mt-1">
                                            {/* 等化器動畫 */}
                                            <span className="w-0.5 h-2 bg-purple-400 rounded-full animate-bar1" />
                                            <span className="w-0.5 h-3 bg-purple-400 rounded-full animate-bar2" />
                                            <span className="w-0.5 h-1.5 bg-purple-400 rounded-full animate-bar3" />
                                            <span className="w-0.5 h-2.5 bg-purple-400 rounded-full animate-bar4" />
                                            <span className="text-[8px] text-purple-400 font-bold ml-1">正在播放此 BGM...</span>
                                          </div>
                                        ) : (
                                          <p className="text-[9px] text-slate-500 mt-1">點擊右側按鈕即時試聽此音軌</p>
                                        )}
                                      </div>
                                    </div>

                                    {selectedRes.bgm && (
                                      <button
                                        onClick={() => {
                                          updateUrlParam({ bgm: selectedRes.bgm });
                                          setIsPlaying(true);
                                          setIsMuted(false);
                                          setFeedback(`試聽音軌: ${selectedRes.bgm}`);
                                          setTimeout(() => setFeedback(null), 2000);
                                        }}
                                        className="px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0"
                                      >
                                        <Play className="w-3 h-3" /> 試聽
                                      </button>
                                    )}
                                  </div>

                                  {/* 音樂推薦 */}
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">配樂資料庫：一鍵套用背景音樂</p>
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                                      {RECOMMENDED_BGMS.map((bgm) => {
                                        const isCurrentSelection = selectedRes.bgm === bgm.id;
                                        return (
                                          <button
                                            key={bgm.name}
                                            onClick={() => {
                                              const next = { ...localResources, [selectedScene]: { ...selectedRes, bgm: bgm.id } };
                                              setLocalResources(next);
                                              saveSceneResources(next);
                                              setFeedback(`配樂更換為「${bgm.name}」！`);
                                              setTimeout(() => setFeedback(null), 2000);
                                            }}
                                            className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                                              isCurrentSelection 
                                                ? "bg-purple-600/10 border-purple-500/50 text-purple-300" 
                                                : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
                                            }`}
                                          >
                                            <span className="text-[10px] font-bold truncate pr-2">{bgm.name}</span>
                                            <span className="text-[9px] font-mono text-slate-500">{bgm.id}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900/80 rounded-2xl p-4 text-[11px] space-y-4 border border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-slate-500 font-bold uppercase tracking-wider">頁面與資源管理</p>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setIsMaximized(true)}
                            className="px-2 py-1 bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-lg text-[9px] font-bold hover:bg-blue-600/25 transition-all flex items-center gap-1"
                          >
                            <Maximize2 className="w-2.5 h-2.5" /> 開啟全螢幕大看板
                          </button>
                          <button 
                            onClick={() => {
                              setLocalResources(DEFAULT_SCENE_RESOURCES);
                              saveSceneResources(DEFAULT_SCENE_RESOURCES);
                              setFeedback("已恢復預設配置");
                              setTimeout(() => setFeedback(null), 2000);
                            }}
                            className="text-[9px] text-blue-400 hover:text-blue-300 underline"
                          >
                            恢復預設
                          </button>
                        </div>
                      </div>


                    <div className="w-full overflow-hidden border border-slate-800 rounded-xl shadow-inner bg-slate-900/20">
                      <table className="w-full text-xs text-slate-300 table-fixed">
                        <thead className="bg-slate-900/50">
                          <tr>
                            <th className="px-2 py-2.5 text-left w-[20%]">頁面 (Scene)</th>
                            <th className="px-2 py-2.5 text-left w-[35%]">背景圖 (BG)</th>
                            <th className="px-2 py-2.5 text-left w-[22%]">背景預覽</th>
                            <th className="px-2 py-2.5 text-left w-[23%]">音樂 (BGM)</th>
                          </tr>
                        </thead>
                        <tbody className="bg-slate-950">
                          {Object.entries(localResources).map(([scene, res]: [string, any]) => {
                            const hasValidBg = res.bg && (res.bg.startsWith("http") || res.bg.startsWith("/") || res.bg.startsWith("data:"));
                            return (
                              <tr key={scene} className="border-t border-slate-800/50 hover:bg-slate-900/10 transition-colors">
                                <td className="px-2 py-3 font-bold text-slate-400 align-middle">
                                  {res.name}
                                  <br/>
                                  <span className="text-[9px] font-mono font-normal opacity-50">{scene}</span>
                                </td>
                                <td className="px-2 py-3 align-middle">
                                  <input 
                                    type="text" 
                                    value={res.bg}
                                    onChange={(e) => updateSceneBg(scene, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-[10px] text-white focus:border-blue-500 focus:outline-none placeholder:text-slate-600 font-mono"
                                    placeholder="空白將無背景"
                                  />
                                </td>
                                <td className="px-2 py-3 align-middle">
                                  <div className="relative group/thumb flex items-center gap-2">
                                    {hasValidBg ? (
                                      <>
                                        {/* Thumbnail with hover card */}
                                        <div className="w-10 h-7 rounded border border-slate-700 overflow-hidden bg-slate-900 shrink-0 relative cursor-zoom-in shadow-md">
                                          <ScenePreviewMedia 
                                            src={res.bg} 
                                            alt={res.name}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>

                                        {/* Absolute Hover Tooltip Preview Card */}
                                        <div className="invisible group-hover/thumb:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-[250] w-52 p-2 bg-slate-950/95 border border-slate-700 rounded-xl shadow-[0_12px_32px_-4px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-200 pointer-events-none">
                                          <div className="aspect-video w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-900 relative">
                                            <ScenePreviewMedia 
                                              src={res.bg} 
                                              alt="Large preview"
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                          <div className="text-[9px] text-slate-300 mt-1.5 text-center font-bold">
                                            {res.name} 背景預覽
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-[9px] text-slate-600 italic shrink-0">無圖片</span>
                                    )}

                                    {/* Action Apply Button */}
                                    {hasValidBg && (
                                      <button
                                        onClick={() => {
                                          updateUrlParam({ bg: res.bg });
                                          setFeedback(`已將「${res.name}」背景套用至當前畫面！`);
                                          setTimeout(() => setFeedback(null), 3000);
                                        }}
                                        className={`px-1.5 py-1 text-[9px] font-black rounded border transition-all ${
                                          state.bg === res.bg 
                                            ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-400 cursor-default"
                                            : "bg-blue-600/25 border-blue-500/40 text-blue-400 hover:bg-blue-600 hover:text-white"
                                        }`}
                                        title={state.bg === res.bg ? "目前正在使用此背景" : "一鍵套用此背景"}
                                      >
                                        {state.bg === res.bg ? "已套用" : "套用"}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-3 align-middle">
                                  <input 
                                    type="text" 
                                    value={res.bgm}
                                    onChange={(e) => updateSceneBgm(scene, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-[10px] text-white focus:border-blue-500 focus:outline-none placeholder:text-slate-600 font-mono"
                                    placeholder="BGM ID / Bili BV"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Background Visual Gallery Canvas */}
                    <div className="mt-4 border-t border-slate-800/80 pt-4 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">背景資源畫板 (隨改即看)</p>
                        {state.bg && (
                          <button
                            onClick={() => {
                              updateUrlParam({ bg: null });
                              setFeedback("已恢復場景預設背景");
                              setTimeout(() => setFeedback(null), 2000);
                            }}
                            className="text-[9px] text-slate-400 hover:text-slate-300 flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50 transition-all"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> 重設為場景預設
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(localResources).map(([scene, res]: [string, any]) => {
                          const isValid = res.bg && (res.bg.startsWith("http") || res.bg.startsWith("/") || res.bg.startsWith("data:"));
                          const isCurrentlyActive = state.bg === res.bg || (!state.bg && sceneResources[currentScene]?.bg === res.bg && currentScene === scene);
                          return (
                            <div 
                              key={scene} 
                              className={`relative group rounded-xl overflow-hidden border transition-all duration-300 bg-slate-950 aspect-video flex flex-col justify-between ${
                                isCurrentlyActive 
                                  ? "border-blue-500 ring-2 ring-blue-500/20 scale-[1.01] shadow-[0_0_12px_rgba(59,130,246,0.15)]" 
                                  : "border-slate-800/80 hover:border-slate-700 hover:scale-[1.005]"
                              }`}
                            >
                              {isValid ? (
                                <ScenePreviewMedia 
                                  src={res.bg} 
                                  alt={res.name}
                                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 p-2 text-center pointer-events-none">
                                  <ImageIcon className="w-5 h-5 text-slate-700 mb-1" />
                                  <span className="text-[9px] text-slate-600">無背景圖片</span>
                                </div>
                              )}
                              
                              {/* Overlay Darkener to guarantee text legibility */}
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />

                              {/* Action Apply Button over gallery card */}
                              {isValid && (
                                <button
                                  onClick={() => {
                                    updateUrlParam({ bg: res.bg });
                                    setFeedback(`已套用「${res.name}」背景！`);
                                    setTimeout(() => setFeedback(null), 2000);
                                  }}
                                  className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black z-10 transition-all ${
                                    state.bg === res.bg
                                      ? "bg-emerald-500 text-white shadow-md cursor-default"
                                      : "bg-slate-950/80 hover:bg-blue-600 hover:text-white border border-slate-700 text-slate-200"
                                  }`}
                                >
                                  {state.bg === res.bg ? "使用中" : "套用"}
                                </button>
                              )}

                              <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
                                <p className="text-[10px] font-bold text-white drop-shadow-md leading-none">{res.name}</p>
                                <p className="text-[8px] text-slate-400 font-mono mt-1 opacity-80 leading-none">{scene}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              )}
              {activeTab === "advanced" && (
                <div className="space-y-6">
                  <section className="ios-card p-4 space-y-2"><h3 className="text-sm text-blue-200">效能診斷</h3><p className="text-xs text-slate-400">手動量測畫面間隔、長任務與可取得的記憶體；不自動常駐採樣，也不宣稱所有裝置都流暢。</p><button type="button" className="ios-button" onClick={() => window.dispatchEvent(new Event('open-performance-probe'))}>開啟本機效能量測</button></section>
                  <div className="bg-slate-900/80 rounded-2xl p-4 text-[11px] space-y-3 border border-slate-800">
                    <p className="text-slate-500 font-bold uppercase tracking-wider">目前系統配置</p>
                    <div className="text-slate-300 space-y-1.5 break-all">
                        <p>視覺背景: <span className="text-blue-400">{state.bg || localResources[currentScene]?.bg || "預設"}</span></p>
                        <p>背景音樂: <span className="text-purple-400">{state.bgmUrl || "預設"}</span></p>
                        <p>歌單數: <span className="text-emerald-400">{playlist.length}</span> / 圖片數: <span className="text-emerald-400">{backgrounds.length}</span></p>
                    </div>
                  </div>

                </div>
              )}
              {activeTab === 'library' && (
                  <div className="space-y-6">
                      {/* Playlist Management Table */}
                      <div className="space-y-2">
                          <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold text-slate-300">歌單管理</p>
                              <button onClick={() => setPlaylist(DEFAULT_PLAYLIST)} className="text-[9px] text-blue-400 hover:text-blue-300 underline">恢復預設</button>
                          </div>
                          <div className="w-full overflow-hidden border border-slate-800 rounded-xl shadow-inner bg-slate-900/20">
                              <table className="w-full text-xs text-slate-300">
                                  <thead className="bg-slate-900/50">
                                      <tr>
                                          <th className="px-2 py-1 text-left">標題</th>
                                          <th className="px-2 py-1 text-left">操作</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-slate-950">
                                    {playlist.map((item, i) => (
                                      <tr key={i} className="border-t border-slate-800/50">
                                        <td className="px-3 py-2"><span className="block text-sm">{item.title}</span><span className="block text-xs text-slate-500 break-all">{item.url}</span></td>
                                        <td className="px-2 py-1">
                                            <button type="button" aria-label={`移除歌曲 ${item.title}`} onClick={() => setPlaylist(playlist.filter((_, idx) => idx !== i))} className="p-2 hover:text-red-400 text-slate-400">
                                                <X className="w-3 h-3"/>
                                            </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                              </table>
                          </div>
                          <input 
                            type="text" 
                            placeholder="新增連結 (Enter 新增)..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[9px] text-white"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                setPlaylist([...playlist, { url: e.currentTarget.value.trim(), title: "新歌曲" }]);
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                      </div>

                      {/* Image Management Table */}
                      <div className="space-y-2">
                          <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold text-slate-300">背景圖管理</p>
                              <button onClick={() => setBackgrounds(DEFAULT_BACKGROUNDS)} className="text-[9px] text-blue-400 hover:text-blue-300 underline">恢復預設</button>
                          </div>
                          <div className="w-full overflow-hidden border border-slate-800 rounded-xl shadow-inner bg-slate-900/20">
                              <table className="w-full text-xs text-slate-300">
                                  <thead className="bg-slate-900/50">
                                      <tr>
                                          <th className="px-2 py-1 text-left">網址</th>
                                          <th className="px-2 py-1 text-left">操作</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-slate-950">
                                    {backgrounds.map((url, i) => (
                                      <tr key={i} className="border-t border-slate-800/50">
                                        <td className="px-3 py-2 break-all text-xs">{url}</td>
                                        <td className="px-2 py-1">
                                            <button type="button" aria-label={`移除背景 ${i + 1}`} onClick={() => setBackgrounds(backgrounds.filter((_, idx) => idx !== i))} className="p-2 hover:text-red-400 text-slate-400">
                                                <X className="w-3 h-3"/>
                                            </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                              </table>
                          </div>
                          <input 
                            type="text" 
                            placeholder="新增連結 (Enter 新增)..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[9px] text-white"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                setBackgrounds([...backgrounds, e.currentTarget.value.trim()]);
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                      </div>
                  </div>
              )}
            </div>

            {/* Footer / Feedback */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="absolute bottom-4 left-4 right-4 py-2 bg-emerald-600 text-white text-[11px] font-black rounded-xl text-center shadow-lg"
                >
                  {feedback}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
