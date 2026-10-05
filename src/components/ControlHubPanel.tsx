import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Maximize2, Minimize2, Image as ImageIcon, RotateCcw, Copy, Music, X, Sliders, Sun, Moon, Eye, Check, Play, Pause, Plus, Volume2, VolumeX, Palette, Swords, Upload, Gauge } from "lucide-react";
import { CONTROL_SECTIONS, backgroundThumb, type ControlSectionId } from "../utils/controlSettings";
import { DEFAULT_SCENE_RESOURCES, saveSceneResources } from "../utils/resourceManager";
import { BATTLE_ANIMATION_OPTIONS, writeAnimationSettings } from "../battle/animationSettings";
import { ACCENT_CONFIGS, OPACITY_CONFIGS, RECOMMENDED_BACKGROUNDS, RECOMMENDED_BGMS, DEFAULT_PLAYLIST, DEFAULT_BACKGROUNDS } from "./ControlHubPresets";
import type { AccentColor, CardOpacity } from "./ControlHubPresets";
import type { ControlHubPanelModel } from "./ControlHub";
import { UpdateSettingsPanel } from './UpdateSettingsPanel';
import { parseMusicSource } from '../utils/musicSource';
import { playAudioTestTone } from '../utils/audioTestTone';

const TAB_ICONS: Record<ControlSectionId, React.ComponentType<{ className?: string }>> = {
  background: ImageIcon, audio: Music, visual: Palette, battle: Swords, system: Sliders,
};
const ALL = '__all__';
const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden'; };
const isMediaUrl = (url?: string) => !!url && (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:'));

/** 背景名稱：內建清單有名稱就用，否則以檔名／網域簡稱。 */
function backgroundName(url: string, index: number): string {
  const known = RECOMMENDED_BACKGROUNDS.find(item => item.url === url);
  if (known) return known.name.replace(/\s*[\u{1F300}-\u{1FAFF}☀-➿]️?/gu, '');
  try { return url.startsWith('/') ? url.slice(1) : new URL(url).hostname; } catch { return `自訂背景 ${index + 1}`; }
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-slate-300" title={hint}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const chip = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`;
const linkBtn = "text-[11px] text-slate-400 hover:text-white flex items-center gap-1";
const inputCls = "flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500";

export default function ControlHubPanel(model: ControlHubPanelModel) {
  const { isMaximized, setIsMaximized, setIsOpen, activeTab, setActiveTab, state, updateUrlParam, currentAccent, setFeedback, backgrounds, isPlaying, musicInfo, togglePlay, setIsPlaying, playlist, animationSettings, setAnimationSettings, setLocalResources, localResources, currentScene, updateSceneBg, updateSceneBgm, isMuted, setIsMuted, toggleMute, setPlaylist, setBackgrounds, feedback } = model;

  const timer = useRef<number>();
  const flash = (msg: string) => { setFeedback(msg); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setFeedback(null), 1800); };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const scenes = Object.entries(localResources) as [string, { name: string; bg: string; bgm: string }][];
  const sceneName = (key: string) => localResources[key]?.name || key;
  const [bgTarget, setBgTarget] = useState<string>(() => localResources[currentScene] ? currentScene : ALL);
  const [bgFilter, setBgFilter] = useState<'all' | 'image' | 'html'>('all');
  const [newBg, setNewBg] = useState('');
  const [bgmTarget, setBgmTarget] = useState<string>(() => localResources[currentScene] ? currentScene : 'start');
  const [newSong, setNewSong] = useState('');
  const [testToneBusy, setTestToneBusy] = useState(false);
  const [testToneMessage, setTestToneMessage] = useState('');
  const testTone = async () => {
    setTestToneBusy(true); setTestToneMessage('正在送出短測試音…');
    try {
      await playAudioTestTone();
      setTestToneMessage('測試音已送出。若也聽不到，請檢查 Edge 網站靜音、Windows 音量混音器與輸出裝置；若聽得到，問題在影片播放這一側。');
    } catch (error) { setTestToneMessage(error instanceof Error ? error.message : '測試音無法啟動。'); }
    finally { setTestToneBusy(false); }
  };

  // 背景庫：內建推薦＋自訂清單，去重保序
  const library = useMemo(() => Array.from(new Set([...RECOMMENDED_BACKGROUNDS.map(b => b.url), ...backgrounds])), [backgrounds]);
  const visibleLibrary = library.filter(url => bgFilter === 'all' || (bgFilter === 'html') === url.endsWith('.html'));
  const isBuiltIn = (url: string) => DEFAULT_BACKGROUNDS.includes(url) || RECOMMENDED_BACKGROUNDS.some(b => b.url === url);

  const targetBg = bgTarget === ALL ? state.bg || '' : localResources[bgTarget]?.bg || '';
  const shownBg = state.bg || localResources[currentScene]?.bg || localResources.start?.bg || '';
  const overrideBlocks = bgTarget !== ALL && !!state.bg;

  const applyBg = (url: string) => {
    if (bgTarget === ALL) { updateUrlParam({ bg: url || null }); flash(url ? '已套用到全部頁面' : '已取消全部頁面背景'); return; }
    updateSceneBg(bgTarget, url);
    if (bgTarget === currentScene && state.bg) { updateUrlParam({ bg: null }); flash(`已套用到「${sceneName(bgTarget)}」（已取消全部頁面背景）`); return; }
    flash(`已套用到「${sceneName(bgTarget)}」`);
  };
  const addBg = () => {
    const url = newBg.trim();
    if (!url) return;
    if (!library.includes(url)) setBackgrounds([...backgrounds, url]);
    setNewBg(''); applyBg(url);
  };
  const resetBgTarget = () => {
    if (bgTarget === ALL) { updateUrlParam({ bg: null }); flash('已取消全部頁面背景'); return; }
    updateSceneBg(bgTarget, DEFAULT_SCENE_RESOURCES[bgTarget]?.bg || ''); flash('已恢復此頁預設背景');
  };

  const playUrl = (url: string, label: string) => {
    const source = parseMusicSource(url);
    if (source.type === 'invalid') { flash(source.message); return; }
    updateUrlParam({ bgm: url }); setIsPlaying(true); flash(`正在載入：${label}`);
  };
  const addSong = () => {
    const url = newSong.trim(); if (!url) return;
    const source = parseMusicSource(url);
    if (source.type === 'invalid') { flash(source.message); return; }
    setPlaylist([...playlist, { url, title: `歌曲 ${playlist.length + 1}` }]); setNewSong(''); playUrl(url, '新增的歌曲');
  };

  const exportConfig = () => {
    const json = JSON.stringify({ scenes: localResources, backgrounds, playlist }, null, 2);
    navigator.clipboard?.writeText(json).then(() => flash('設定已複製到剪貼簿'), () => flash('無法存取剪貼簿'));
  };
  const importConfig = () => {
    const input = window.prompt('貼上匯出的設定 JSON：'); if (!input) return;
    try {
      const parsed = JSON.parse(input);
      const scenesIn = parsed?.scenes ?? parsed; // 相容舊版只匯出場景配置
      if (!scenesIn || typeof scenesIn !== 'object') throw new Error();
      setLocalResources(scenesIn); saveSceneResources(scenesIn);
      if (Array.isArray(parsed?.backgrounds)) setBackgrounds(parsed.backgrounds.filter((u: unknown) => typeof u === 'string'));
      if (Array.isArray(parsed?.playlist)) setPlaylist(parsed.playlist);
      flash('已匯入設定');
    } catch { flash('JSON 格式錯誤，未變更'); }
  };
  const resetAll = () => {
    if (!window.confirm('恢復所有頁面背景、BGM、背景庫與歌單為預設？')) return;
    setLocalResources(DEFAULT_SCENE_RESOURCES); saveSceneResources(DEFAULT_SCENE_RESOURCES);
    setBackgrounds(DEFAULT_BACKGROUNDS); setPlaylist(DEFAULT_PLAYLIST); updateUrlParam({ bg: null, bgm: null });
    flash('已恢復預設');
  };

  const sceneOptions = (withAll: boolean) => (
    <>
      {withAll && <option value={ALL}>全部頁面</option>}
      {scenes.map(([key, res]) => <option key={key} value={key}>{res.name}{key === currentScene ? '（目前頁面）' : ''}</option>)}
    </>
  );
  const selectCls = "bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500";

  return (
    <motion.div
      role="dialog" aria-label="系統控制中心" data-control-hub
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.18 }}
      className={`fixed top-0 right-0 bottom-0 z-[200] w-full ${isMaximized ? 'sm:w-[min(980px,100vw)]' : 'sm:w-[460px]'} bg-slate-950 border-l border-slate-700/70 shadow-2xl flex flex-col`}
    >
      {/* 標題列 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-sm font-bold text-slate-100">控制中心</h2>
        <div className="flex gap-1">
          <button type="button" aria-label={isMaximized ? '縮小' : '放大'} title={isMaximized ? '縮小' : '放大'} onClick={() => setIsMaximized(!isMaximized)} className="hidden sm:block p-2 text-slate-400 hover:text-white">
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button" aria-label="關閉控制中心" title="關閉" onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* 分頁 */}
      <div className="grid grid-cols-5 gap-1 px-3 pb-2 border-b border-slate-800" role="tablist" aria-label="控制中心分類">
        {CONTROL_SECTIONS.map(section => {
          const Icon = TAB_ICONS[section.id];
          const active = activeTab === section.id;
          return (
            <button key={section.id} type="button" role="tab" aria-selected={active} title={section.description} onClick={() => setActiveTab(section.id)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'}`}>
              <Icon className="w-4 h-4" />{section.title}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {activeTab === 'background' && (<>
          {/* 目前效果預覽 */}
          <div className="relative aspect-[16/7] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
            {isMediaUrl(targetBg || shownBg)
              ? <img src={backgroundThumb(targetBg || shownBg)} alt="" referrerPolicy="no-referrer" onError={hideBroken} className="absolute inset-0 w-full h-full object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">無背景</div>}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 to-transparent" />
            <div className="absolute left-3 right-3 bottom-2 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400">{bgTarget === ALL ? '全部頁面' : sceneName(bgTarget)}</p>
                <p className="text-sm font-bold text-white truncate">{targetBg ? backgroundName(targetBg, library.indexOf(targetBg)) : bgTarget === ALL ? '未設定（各頁使用自己的背景）' : '無背景'}</p>
              </div>
              <button type="button" onClick={resetBgTarget} className="shrink-0 px-2 py-1 rounded-md bg-slate-900/80 border border-slate-700 text-[11px] text-slate-300 hover:text-white flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />{bgTarget === ALL ? '取消' : '預設'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-400">套用到</label>
            <select aria-label="背景套用到" className={selectCls} value={bgTarget} onChange={e => setBgTarget(e.target.value)}>{sceneOptions(true)}</select>
            <div className="ml-auto flex gap-1">
              {([['all', '全部'], ['image', '圖片'], ['html', '動態']] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setBgFilter(k)} className={chip(bgFilter === k)}>{label}</button>
              ))}
            </div>
          </div>
          {overrideBlocks && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              <span>目前「全部頁面」背景優先，單頁設定不會顯示</span>
              <button type="button" className="underline shrink-0" onClick={() => { updateUrlParam({ bg: null }); flash('已取消全部頁面背景'); }}>取消</button>
            </div>
          )}

          {/* 縮圖牆：點一下即套用 */}
          <div className={`grid gap-2 ${isMaximized ? 'grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {visibleLibrary.map(url => {
              const index = library.indexOf(url);
              const selected = targetBg === url;
              return (
                <div key={url} className="relative group">
                  <button type="button" onClick={() => applyBg(url)} title={url} aria-pressed={selected}
                    className={`relative block w-full aspect-video rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-blue-500' : 'border-transparent hover:border-slate-500'}`}>
                    <img src={backgroundThumb(url)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideBroken} className="absolute inset-0 w-full h-full object-cover bg-slate-900" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 to-transparent px-1.5 pt-3 pb-1 text-left text-[10px] font-bold text-white truncate">{backgroundName(url, index)}</span>
                    {url.endsWith('.html') && <span className="absolute top-1 left-1 px-1 rounded bg-slate-950/80 text-[9px] text-cyan-300">動態</span>}
                    {selected && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>}
                  </button>
                  {!isBuiltIn(url) && (
                    <button type="button" aria-label="從背景庫移除" title="從背景庫移除" onClick={() => setBackgrounds(backgrounds.filter(u => u !== url))}
                      className="absolute top-1 right-1 hidden group-hover:flex w-5 h-5 rounded-full bg-slate-950/90 text-slate-300 hover:text-red-400 items-center justify-center"><X className="w-3 h-3" /></button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input type="text" value={newBg} onChange={e => setNewBg(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBg()} placeholder="貼上圖片連結加入背景庫" className={inputCls} />
            <button type="button" onClick={addBg} disabled={!newBg.trim()} className="px-3 rounded-lg bg-blue-600 text-white disabled:opacity-40 flex items-center gap-1 text-xs font-bold"><Plus className="w-4 h-4" />加入</button>
          </div>
        </>)}

        {activeTab === 'audio' && (<>
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <button type="button" onClick={model.playback.phase === 'blocked' || model.playback.phase === 'error' ? () => setIsPlaying(true) : togglePlay} aria-label={model.requestedPlaying && !['blocked', 'error'].includes(model.playback.phase) ? '暫停' : '播放'} className={`w-11 h-11 rounded-full flex items-center justify-center ${isPlaying ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
              {model.requestedPlaying && !['blocked', 'error'].includes(model.playback.phase) ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-100 truncate">{playlist.find(p => p.url === state.bgmUrl)?.title || (state.bgmUrl ? '自訂連結' : `${sceneName(currentScene)} BGM`)}</p>
              <p role="status" className="text-xs text-slate-400">{musicInfo.type} · {model.playback.message}{isPlaying && isMuted ? '（靜音）' : ''}</p>
            </div>
            <button type="button" onClick={toggleMute} aria-label={isMuted ? '取消靜音' : '靜音'} title={isMuted ? '取消靜音' : '靜音'} className="p-2 text-slate-300 hover:text-white">
              {isMuted || !isPlaying ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
          <Section title="播放器與音量">
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" checked={model.showPlayer} onChange={e => model.setShowPlayer(e.target.checked)} />顯示影片播放器
            </label>
            <p className="text-xs text-slate-400 leading-relaxed">預設收起到畫面外，不縮成 0。切換顯示不會重載影片。但 YouTube 不支援隱藏式背景播放，可能暫停或阻擋聲音；無聲時請先勾選顯示，再點影片內播放鍵。B站以影片內控制為準。</p>
            <label className="flex items-center gap-2 text-xs text-slate-200">影片音量 {model.volume}%
              <input aria-label="影片音量" type="range" min="0" max="100" value={model.volume} disabled={musicInfo.type !== 'youtube'} onChange={e => model.setVolume(Number(e.target.value))} className="flex-1 min-w-0" />
            </label>
            <p className="text-xs text-slate-400">{model.audioInfo ? `播放器回報：音量 ${model.audioInfo.volume}% · ${model.audioInfo.muted ? '靜音' : '未靜音'}` : '尚未收到播放器音量。'}「播放中」僅代表影片在跑，無法確認喇叭出聲。</p>
            <button type="button" onClick={() => void testTone()} disabled={testToneBusy} className="ios-button text-xs">{testToneBusy ? '測試中…' : '播放測試音（不經 YouTube）'}</button>
            {testToneMessage && <p role="status" className="text-xs text-slate-300 leading-relaxed">{testToneMessage}</p>}
            {['blocked', 'error'].includes(model.playback.phase) && <button type="button" className={chip(false)} onClick={() => { model.setShowPlayer(true); model.retryMusic(); }}>顯示並重新載入播放器</button>}
          </Section>
          {state.bgmUrl && <button type="button" className={linkBtn} onClick={() => { updateUrlParam({ bgm: null }); flash('改回各頁 BGM'); }}><RotateCcw className="w-3 h-3" />改回各頁預設 BGM</button>}

          <Section title="歌單" hint="點歌名播放" action={<button type="button" className={linkBtn} onClick={() => setPlaylist(DEFAULT_PLAYLIST)}><RotateCcw className="w-3 h-3" />預設</button>}>
            <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-lg border border-slate-800 divide-y divide-slate-800/70">
              {playlist.map((item, i) => {
                const playing = state.bgmUrl === item.url;
                return (
                  <div key={`${item.url}-${i}`} className={`flex items-center gap-2 px-2 py-1.5 group ${playing ? 'bg-blue-600/15' : 'hover:bg-slate-900'}`}>
                    <button type="button" onClick={() => playUrl(item.url, item.title)} title={item.url} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                      {playing ? <Volume2 className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <Play className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      <span className={`text-xs truncate ${playing ? 'text-blue-200 font-bold' : 'text-slate-300'}`}>{item.title}</span>
                    </button>
                    <button type="button" aria-label={`移除歌曲 ${item.title}`} onClick={() => setPlaylist(playlist.filter((_, idx) => idx !== i))} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newSong} onChange={e => setNewSong(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSong()} placeholder="YouTube／B站連結" className={inputCls} />
              <button type="button" onClick={addSong} disabled={!newSong.trim()} className="px-3 rounded-lg bg-blue-600 text-white disabled:opacity-40 flex items-center gap-1 text-xs font-bold"><Plus className="w-4 h-4" />加入</button>
            </div>
          </Section>

          <Section title="各頁 BGM" hint="進入該頁時預設播放的音樂（YouTube ID 或 B站 BV 號）">
            <div className="flex items-center gap-2">
              <select aria-label="BGM 頁面" className={selectCls} value={bgmTarget} onChange={e => setBgmTarget(e.target.value)}>{sceneOptions(false)}</select>
              <input type="text" value={localResources[bgmTarget]?.bgm || ''} onChange={e => updateSceneBgm(bgmTarget, e.target.value)} placeholder="ID / BV 號" className={`${inputCls} font-mono`} />
              {localResources[bgmTarget]?.bgm && <button type="button" title="試聽" onClick={() => playUrl(localResources[bgmTarget].bgm, sceneName(bgmTarget))} className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"><Play className="w-4 h-4" /></button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {RECOMMENDED_BGMS.map(bgm => (
                <button key={bgm.id} type="button" title={bgm.id} onClick={() => { updateSceneBgm(bgmTarget, bgm.id); flash(`${sceneName(bgmTarget)}：${bgm.name}`); }} className={chip(localResources[bgmTarget]?.bgm === bgm.id)}>{bgm.name}</button>
              ))}
            </div>
          </Section>
        </>)}

        {activeTab === 'visual' && (<>
          <Section title="明暗" hint="只調整背景遮罩明暗，不改變數值辨識色">
            <div className="grid grid-cols-3 gap-2">
              {[{ id: "day", icon: Sun, label: "日間" }, { id: "night", icon: Moon, label: "標準" }, { id: "dark", icon: Eye, label: "極黑" }].map(item => (
                <button key={item.id} type="button" aria-pressed={state.theme === item.id} onClick={() => updateUrlParam({ theme: item.id === "night" ? null : item.id })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold ${state.theme === item.id ? 'bg-slate-800 border-blue-500 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-600'}`}>
                  <item.icon className="w-4 h-4" />{item.label}
                </button>
              ))}
            </div>
          </Section>
          <Section title={`主色：${currentAccent.name}`} hint="卡片邊框與選取色；血量、異常等辨識色不變">
            <div className="flex gap-3">
              {(Object.keys(ACCENT_CONFIGS) as AccentColor[]).map(key => (
                <button key={key} type="button" aria-label={`主色：${ACCENT_CONFIGS[key].name}`} title={ACCENT_CONFIGS[key].name} aria-pressed={state.accent === key}
                  onClick={() => updateUrlParam({ accent: key === "emerald" ? null : key })}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-transform ${state.accent === key ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: ACCENT_CONFIGS[key].colorHex }}>
                  {state.accent === key && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </Section>
          <Section title="卡片透明度" hint="只影響一般卡片；長篇詳情保持不透明">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(OPACITY_CONFIGS) as CardOpacity[]).map(key => (
                <button key={key} type="button" aria-pressed={state.cardOpacity === key} onClick={() => updateUrlParam({ cardOpacity: key === "medium" ? null : key })} className={chip(state.cardOpacity === key)}>{OPACITY_CONFIGS[key].name}</button>
              ))}
            </div>
          </Section>
        </>)}

        {activeTab === 'battle' && (
          <Section title="動畫播放" hint="關閉的項目直接略過動畫，不影響結算">
            <div className="grid grid-cols-2 gap-2" data-testid="battle-animation-settings">
              {BATTLE_ANIMATION_OPTIONS.map(option => (
                <label key={option.key} title={option.tip} className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 cursor-pointer select-none">
                  <span className="text-xs font-bold text-slate-200">{option.label}</span>
                  <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={animationSettings[option.key]}
                    onChange={e => { const next = { ...animationSettings, [option.key]: e.target.checked }; setAnimationSettings(next); writeAnimationSettings(next); }} />
                </label>
              ))}
            </div>
          </Section>
        )}

        {activeTab === 'system' && (<>
          <Section title="背景與音樂設定" hint="包含各頁背景／BGM、背景庫與歌單">
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={exportConfig} className="py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 flex items-center justify-center gap-1.5 hover:border-slate-500"><Copy className="w-3.5 h-3.5" />匯出</button>
              <button type="button" onClick={importConfig} className="py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 flex items-center justify-center gap-1.5 hover:border-slate-500"><Upload className="w-3.5 h-3.5" />匯入</button>
              <button type="button" onClick={resetAll} className="py-2 rounded-lg bg-slate-900 border border-rose-800/70 text-xs text-rose-300 flex items-center justify-center gap-1.5 hover:border-rose-500"><RotateCcw className="w-3.5 h-3.5" />全部預設</button>
            </div>
          </Section>
          <Section title="效能" hint="手動量測畫面間隔、長任務與記憶體">
            <button type="button" onClick={() => window.dispatchEvent(new Event('open-performance-probe'))} className="w-full py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 flex items-center justify-center gap-1.5 hover:border-slate-500"><Gauge className="w-3.5 h-3.5" />開啟效能量測</button>
          </Section>
          <Section title="更新">
            <UpdateSettingsPanel canApplyUpdates={model.canApplyUpdates} />
          </Section>
        </>)}
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div role="status" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
            className="absolute bottom-4 left-4 right-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl text-center shadow-lg pointer-events-none">
            {feedback}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
