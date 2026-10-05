import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { normalizePlaylist, readControlSetting, resolveControlSection, type ControlSectionId } from '../utils/controlSettings';
import { Volume2, VolumeX, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSceneResources, saveSceneResources, DEFAULT_SCENE_RESOURCES, SceneResourceMap } from "../utils/resourceManager";
import { readAnimationSettings } from "../battle/animationSettings";
import { parseMusicSource, musicWatchUrl } from "../utils/musicSource";
import { useMusicPlayer } from "./useMusicPlayer";

// --- Theme Types & Config ---










// --- Audio Config ---


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
  const [activeTab, setActiveTab] = useState<ControlSectionId>("background");
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
      const tab = resolveControlSection(e.detail?.tab); if (tab) setActiveTab(tab);
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

  const [feedback, setFeedback] = useState<string | null>(null);

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
  // B站分P沿用既有輪替；YouTube 單曲不再擅自加入其他歌單。
  const destinyPage = useMemo(() => currentScene === 'destiny_wheel' && !state.bgmUrl ? getDestinyWheelPage() : 1, [currentScene, state.bgmUrl]);
  const musicInfo = useMemo(() => parseMusicSource(state.bgmUrl || sceneResources[currentScene]?.bgm ||
    (currentScene === 'destiny_wheel' ? 'BV1uh411Y73e' : 'wJ8onQryXRY'), destinyPage),
    [state.bgmUrl, currentScene, sceneResources[currentScene]?.bgm, destinyPage]);
  const music = useMusicPlayer(musicInfo);

  return { isMaximized, setIsMaximized, setIsOpen, activeTab, searchTerm, setSearchTerm, setActiveTab, state, updateUrlParam, currentAccent, setFeedback, backgrounds, inputBgUrl, setInputBgUrl, musicInfo, playlist, inputBgmUrl, setInputBgmUrl, animationSettings, setAnimationSettings, customLayout, setCustomLayout, p1Panel, setP1Panel, p2Panel, setP2Panel, tacticalPanel, setTacticalPanel, hudOpacity, setHudOpacity, setLocalResources, localResources, selectedScene, sceneResources, currentScene, setSelectedScene, updateSceneBg, updateSceneBgm, setPlaylist, setBackgrounds, feedback, isOpen, canApplyUpdates, ...music };
}

export type ControlHubPanelModel = ReturnType<typeof useControlHubModel>;

export default function ControlHub({ currentScene, canApplyUpdates = false }: { currentScene: string; canApplyUpdates?: boolean }) {
  const model = useControlHubModel(currentScene, canApplyUpdates);
  const { isOpen, setIsOpen, currentAccent, isPlaying, isMuted, toggleMute, mounted, musicInfo, containerRef, playback, retryMusic, closeMusic, showPlayer, setShowPlayer } = model;
  const watchUrl = musicWatchUrl(musicInfo);
  return (
    <div className="fixed top-2.5 right-6 sm:right-8 z-[100] flex flex-col items-end gap-3 select-none font-sans">
      {/* 保留尺寸，顯示切換不重建影片；畫面外播放並非 YouTube 支援的背景音樂模式。 */}
      {mounted && <section aria-label="音樂播放器" aria-hidden={!showPlayer} inert={!showPlayer}
        style={!showPlayer ? { left: '-10000px' } : undefined}
        className="fixed left-3 bottom-4 z-[250] w-[320px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-700 bg-slate-950 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-xs">{musicInfo.type === 'bilibili' ? 'B站音樂' : 'YouTube 音樂'}</span>
          <button type="button" onClick={() => setShowPlayer(false)} aria-label="隱藏播放器" className="text-xs text-slate-400 hover:text-white">隱藏</button>
          <button type="button" onClick={closeMusic} aria-label="停止並關閉播放器" className="text-xs text-slate-400 hover:text-white">停止</button>
        </div>
        <div ref={containerRef} className="h-[200px]" />
        <div className="px-3 py-2 space-y-2 text-xs">
          <p role="status" data-testid="music-playback-status">{playback.message}{isPlaying && isMuted ? '（靜音）' : ''}</p>
          {['blocked', 'error'].includes(playback.phase) && <button type="button" onClick={retryMusic} className="rounded bg-blue-600 px-2 py-1">重新載入播放器</button>}
          {watchUrl && <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="block text-blue-300 underline">在原網站開啟</a>}
        </div>
      </section>}

      <div className="flex items-center gap-2">
        {/* 快速播放按鍵：點擊啟動並解除靜音 */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleMute}
          aria-label={isMuted || !isPlaying ? '播放音樂' : '靜音'} title={isMuted || !isPlaying ? '播放音樂' : '靜音'}
          className={`w-9 h-9 rounded-full flex items-center justify-center shadow-2xl border backdrop-blur-2xl transition-all ${
            isPlaying && !isMuted
              ? "bg-blue-600 border-blue-400 text-white animate-pulse" 
              : "bg-slate-900/90 border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
        >
          {isMuted || !isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </motion.button>

        {/* 主入口按鈕 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="控制中心" title="控制中心（背景、音樂、外觀）"
          className={`flex items-center gap-1.5 h-9 px-3 rounded-full border backdrop-blur-xl shadow-2xl transition-all ${
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
          <span className="hidden xl:inline text-xs font-bold text-slate-100">控制中心</span>
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
