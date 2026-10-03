import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { CONTROL_SECTIONS, normalizePlaylist, readControlSetting } from '../utils/controlSettings';
import { Volume2, VolumeX, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSceneResources, saveSceneResources, DEFAULT_SCENE_RESOURCES, SceneResourceMap } from "../utils/resourceManager";
import { readAnimationSettings } from "../battle/animationSettings";

// --- Theme Types & Config ---










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








import { DEFAULT_P1_LAYOUT, DEFAULT_P2_LAYOUT, DEFAULT_TACTICAL_LAYOUT, ACCENT_CONFIGS, OPACITY_CONFIGS, DEFAULT_BACKGROUNDS, DEFAULT_PLAYLIST } from "./ControlHubPresets";
import type { ThemeMode, AccentColor, CardOpacity } from "./ControlHubPresets";
export type { ThemeMode, AccentColor, CardOpacity } from "./ControlHubPresets";
const ControlHubPanel = lazy(() => import("./ControlHubPanel"));

function useControlHubModel(currentScene: string, canApplyUpdates: boolean) {
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

  return { isMaximized, setIsMaximized, setIsOpen, activeTab, searchTerm, setSearchTerm, setActiveTab, state, updateUrlParam, currentAccent, setFeedback, backgrounds, inputBgUrl, setInputBgUrl, isPlaying, musicInfo, togglePlay, setIsPlaying, playlist, inputBgmUrl, setInputBgmUrl, animationSettings, setAnimationSettings, customLayout, setCustomLayout, p1Panel, setP1Panel, p2Panel, setP2Panel, tacticalPanel, setTacticalPanel, hudOpacity, setHudOpacity, setLocalResources, localResources, selectedScene, sceneResources, currentScene, setSelectedScene, updateSceneBg, updateSceneBgm, setIsMuted, setPlaylist, setBackgrounds, feedback, isOpen, isMuted, toggleMute, ytMounted, ytIframeRef, canApplyUpdates };
}

export type ControlHubPanelModel = ReturnType<typeof useControlHubModel>;

export default function ControlHub({ currentScene, canApplyUpdates = false }: { currentScene: string; canApplyUpdates?: boolean }) {
  const model = useControlHubModel(currentScene, canApplyUpdates);
  const { isOpen, setIsOpen, currentAccent, isPlaying, isMuted, toggleMute, ytMounted, musicInfo, ytIframeRef } = model;
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
          <Suspense fallback={<div role="status" className="ios-card p-4 text-slate-200">
            載入控制中心… <button type="button" className="ios-button ml-2" onClick={() => setIsOpen(false)}>取消</button>
          </div>}>
            <ControlHubPanel {...model} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
