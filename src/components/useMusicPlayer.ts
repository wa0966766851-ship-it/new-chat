import { useEffect, useRef, useState } from 'react';
import { youtubeEmbedUrl, youtubeErrorMessage, type MusicSource } from '../utils/musicSource';
import { loadYoutubePlayerApi, type YoutubePlayer } from '../utils/youtubePlayerApi';
import { readMusicReplay, writeMusicReplay, bilibiliReplayDelayMs } from '../utils/musicReplay';

/** 隱藏時最小可播放尺寸（YouTube 依播放器尺寸挑最低解析度）；顯示時正常大小。 */
export const MUSIC_FRAME_HIDDEN = { width: 200, height: 113 };
function sizeFrame(frame: HTMLIFrameElement, shown: boolean) {
  const w = shown ? 320 : MUSIC_FRAME_HIDDEN.width, h = shown ? 200 : MUSIC_FRAME_HIDDEN.height;
  frame.width = String(w); frame.height = String(h);
  frame.style.width = shown ? '100%' : `${w}px`; frame.style.height = `${h}px`;
}
/** YouTube：要求最低畫質（官方 API 已不保證生效，但不影響播放；實際由小尺寸決定）。 */
function lowestQuality(p: any) { try { p?.setPlaybackQuality?.('tiny'); } catch { /* 不支援時略過 */ } }
/** B站嵌入：關彈幕、低畫質（high_quality=0），只為聽音樂。 */
export function bilibiliEmbedUrl(id: string, page: number, muted: boolean) {
  return `https://player.bilibili.com/player.html?bvid=${id}&page=${page}&autoplay=1&muted=${muted ? 1 : 0}&high_quality=0&danmaku=0`;
}

type Playback = { phase: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'blocked' | 'error' | 'external'; message: string };
export function useMusicPlayer(sceneSource: MusicSource, sceneOptions?: {
  scene: string;
  override: string | null;
  continuous: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useRef<YoutubePlayer | null>(null);
  const ready = useRef(false);
  const desired = useRef({ playing: false, muted: true });
  const [volume, updateVolume] = useState(() => {
    try {
      const stored = window.localStorage.getItem('seer_music_volume');
      const value = stored === null ? NaN : Number(stored);
      return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : 60;
    } catch { return 60; }
  });
  const volumeRef = useRef(volume);
  const [audioInfo, setAudioInfo] = useState<{ volume: number; muted: boolean } | null>(null);
  const [showPlayer, updateShowPlayer] = useState(() => {
    try { return window.localStorage.getItem('seer_music_show_player') === '1'; } catch { return false; }
  });
  const showPlayerRef = useRef(showPlayer); showPlayerRef.current = showPlayer;
  // 顯示／隱藏只改 iframe 尺寸，不重建播放器（不中斷播放）。
  useEffect(() => { const frame = containerRef.current?.querySelector('iframe'); if (frame) sizeFrame(frame, showPlayer); }, [showPlayer]);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [requestedPlaying, setRequestedPlaying] = useState(false);
  const [isMuted, updateMuted] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [playback, setPlayback] = useState<Playback>({ phase: 'idle', message: '尚未播放' });
  // 播完停幾秒再重播（預設開、5 秒）
  const [replay, updateReplay] = useState(readMusicReplay);
  const replayRef = useRef(replay); replayRef.current = replay;
  const replayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearReplay = () => { window.clearTimeout(replayTimer.current); replayTimer.current = undefined; };
  const setReplay = (v: { enabled: boolean; gap: number }) => { writeMusicReplay(v); updateReplay(readMusicReplay()); };
  const [biliCycle, setBiliCycle] = useState(0);
  // 跨頁模式保留已掛載的同一個 iframe（含暫停、緩衝與重播間隔）。
  // 手動選歌／清除全域曲目仍更新來源，停止並關閉後重新採用當前頁的 BGM。
  const candidate = { source: sceneSource, key: JSON.stringify(sceneSource), scene: sceneOptions?.scene, override: sceneOptions?.override };
  const [selection, setSelection] = useState(candidate);
  const followScene = !sceneOptions?.continuous || !mounted || candidate.override !== selection.override;
  const track = followScene ? candidate : selection;
  if (followScene && (candidate.key !== selection.key || candidate.scene !== selection.scene || candidate.override !== selection.override)) {
    setSelection(candidate);
  }
  const { source, key: sourceKey } = track;
  const clearWatchdog = () => window.clearTimeout(watchdog.current);
  const armWatchdog = () => {
    clearWatchdog();
    watchdog.current = window.setTimeout(() => {
      setPlayback({ phase: 'blocked', message: '尚未開始播放：請點下方影片的播放鍵；若仍無法播放，請檢查網路或換曲。' });
    }, 12000);
  };
  const apply = () => {
    if (!ready.current || !player.current) return;
    player.current.setVolume(volumeRef.current);
    desired.current.muted ? player.current.mute() : player.current.unMute();
    if (desired.current.playing) {
      if (player.current.getPlayerState() === 1) {
        clearWatchdog(); setPlayback({ phase: 'playing', message: '播放中' });
      } else { armWatchdog(); player.current.playVideo(); }
    }
    else { clearWatchdog(); player.current.pauseVideo(); setPlayback({ phase: 'paused', message: '已暫停' }); }
  };
  const setIsPlaying = (playing: boolean) => {
    if (!playing) clearReplay();
    desired.current.playing = playing; setRequestedPlaying(playing);
    if (playing) {
      desired.current.muted = volumeRef.current === 0; updateMuted(volumeRef.current === 0); setMounted(true);
      setPlayback({ phase: 'loading', message: '正在要求播放…' });
      if (playback.phase === 'error') setAttempt(value => value + 1);
    } else setPlayback({ phase: 'paused', message: '已暫停' });
    // 就緒後在使用者點擊事件中直接執行，保留瀏覽器的手勢授權。
    apply();
  };
  const setIsMuted = (muted: boolean) => {
    desired.current.muted = muted; updateMuted(muted);
    if (!muted && volumeRef.current === 0) setVolume(60);
    if (ready.current && player.current) muted ? player.current.mute() : player.current.unMute();
  };
  const setVolume = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.round(Math.min(100, Math.max(0, value)));
    volumeRef.current = next; updateVolume(next);
    try { window.localStorage.setItem('seer_music_volume', String(next)); } catch { /* 儲存不可用仍可調整。 */ }
    desired.current.muted = next === 0; updateMuted(next === 0);
    if (ready.current && player.current) {
      player.current.setVolume(next);
      next === 0 ? player.current.mute() : player.current.unMute();
      setAudioInfo({ volume: next, muted: next === 0 });
    }
  };
  const setShowPlayer = (shown: boolean) => {
    updateShowPlayer(shown);
    try { window.localStorage.setItem('seer_music_show_player', shown ? '1' : '0'); } catch { /* 偏好儲存失敗不影響播放。 */ }
  };
  const togglePlay = () => setIsPlaying(!requestedPlaying);
  const toggleMute = () => {
    if (!requestedPlaying || ['blocked', 'error'].includes(playback.phase)) setIsPlaying(true);
    else setIsMuted(!isMuted);
  };
  const retryMusic = () => {
    desired.current = { playing: true, muted: volumeRef.current === 0 };
    setRequestedPlaying(true); updateMuted(volumeRef.current === 0); setMounted(true); setAttempt(value => value + 1);
  };
  const closeMusic = () => { setIsPlaying(false); setMounted(false); };

  // 原生播放器也能改音量，定期讀回，避免本站仍顯示「有聲」。不代表系統喇叭出聲。
  useEffect(() => {
    setAudioInfo(null);
    if (!mounted || source.type !== 'youtube') { setAudioInfo(null); return; }
    const sample = () => {
      if (!ready.current || !player.current) return;
      const actualVolume = player.current.getVolume(), muted = player.current.isMuted();
      setAudioInfo({ volume: actualVolume, muted });
      volumeRef.current = actualVolume; updateVolume(actualVolume);
      desired.current.muted = muted; updateMuted(muted || actualVolume === 0);
    };
    const timer = window.setInterval(sample, 1000);
    return () => window.clearInterval(timer);
  }, [mounted, sourceKey, attempt]);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;
    let instance: YoutubePlayer | undefined;
    ready.current = false; clearWatchdog();
    setPlayback({ phase: 'loading', message: '正在載入播放器…' });
    if (source.type === 'invalid') {
      setPlayback({ phase: 'error', message: source.message });
      return;
    }
    const frame = document.createElement('iframe');
    frame.title = `${source.type === 'youtube' ? 'YouTube' : 'B站'} 音樂播放器`;
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    // 純音樂（2026-11-07）：播放器隱藏時用最小尺寸，YouTube 依尺寸自動降到最低畫質；顯示時才放大。
    sizeFrame(frame, showPlayerRef.current); frame.style.border = '0';
    const attachFrame = () => { container.replaceChildren(frame); };
    const fail = (message: string, phase: 'blocked' | 'error' = 'error') => {
      if (disposed) return;
      clearWatchdog(); setPlayback({ phase, message });
    };
    const loadTimer = window.setTimeout(() => fail('播放器載入逾時；請檢查連線、瀏覽器限制或按「重新載入」。'), 20000);
    if (source.type === 'bilibili') {
      frame.src = bilibiliEmbedUrl(source.id, source.page, desired.current.muted);
      frame.onload = () => {
        window.clearTimeout(loadTimer);
        if (!disposed) setPlayback(desired.current.playing
          ? { phase: 'external', message: 'B站已載入；請使用影片內播放／音量鍵。本站無法確認它是否出聲。' }
          : { phase: 'paused', message: '已暫停' });
      };
      attachFrame();
    } else {
      void loadYoutubePlayerApi().then(api => {
        if (disposed) return;
        frame.src = youtubeEmbedUrl(source, window.location.origin, !replayRef.current.enabled); attachFrame();
        instance = new api.Player(frame, { events: {
          onReady: event => {
            if (disposed) return;
            window.clearTimeout(loadTimer); player.current = event.target; ready.current = true;
            lowestQuality(event.target);
            setPlayback({ phase: 'ready', message: '播放器已就緒' }); apply();
          },
          onStateChange: event => {
            if (disposed) return;
            const state = event.data;
            if (state === 1) {
              lowestQuality(event.target);
              clearWatchdog(); desired.current.playing = true; setRequestedPlaying(true);
              updateMuted(event.target.isMuted() || event.target.getVolume() === 0);
              setPlayback({ phase: 'playing', message: '播放中' });
            } else if (state === 0 && replayRef.current.enabled && desired.current.playing && !source.playlist) {
              // 播完：停 gap 秒再從頭播（仍視為播放中，使用者按停止才會取消）。
              clearWatchdog(); clearReplay();
              const gap = replayRef.current.gap;
              setPlayback({ phase: 'paused', message: gap ? `播放結束，${gap} 秒後重播` : '重新播放' });
              replayTimer.current = setTimeout(() => { if (disposed || !desired.current.playing) return; try { event.target.seekTo(0, true); event.target.playVideo(); } catch { /* 播放器已釋放 */ } }, gap * 1000);
            } else if (state === 2 || state === 0) {
              clearWatchdog(); desired.current.playing = false; setRequestedPlaying(false);
              setPlayback({ phase: 'paused', message: state === 0 ? '播放結束' : '已暫停' });
            } else if (state === 3) setPlayback({ phase: 'buffering', message: '影片緩衝中…' });
          },
          onError: event => { window.clearTimeout(loadTimer); fail(youtubeErrorMessage(event.data)); },
          onAutoplayBlocked: () => fail('瀏覽器阻擋有聲播放：請直接點下方影片的播放鍵授權，或再按一次播放。', 'blocked'),
        } });
        player.current = instance;
      }).catch(error => { window.clearTimeout(loadTimer); fail(error instanceof Error ? error.message : '播放器載入失敗'); });
    }
    return () => {
      disposed = true; ready.current = false; player.current = null; clearReplay();
      window.clearTimeout(loadTimer); clearWatchdog(); frame.onload = null;
      instance?.destroy(); container.replaceChildren();
    };
  }, [mounted, sourceKey, attempt]);

  // B站沒有受支援的跨站控制 API；停止時卸除，恢復／換音量重新載入，不謊報「播放中」。
  useEffect(() => {
    if (!mounted || source.type !== 'bilibili' || !containerRef.current) return;
    const frame = containerRef.current.querySelector('iframe');
    if (frame) frame.src = requestedPlaying
      ? bilibiliEmbedUrl(source.id, source.page, isMuted) : 'about:blank';
  }, [mounted, sourceKey, requestedPlaying, isMuted, biliCycle]);

  // B站沒有「播放結束」事件：向本機後端查影片長度，播到長度＋間隔時重新載入（重頭播放）。
  useEffect(() => {
    if (!mounted || source.type !== 'bilibili' || !requestedPlaying || !replay.enabled) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined;
    void fetch(`/api/music/bilibili-duration/${source.id}?p=${source.page}`).then(r => r.ok ? r.json() : null).then(j => {
      const ms = bilibiliReplayDelayMs(j?.duration, replay.gap);
      if (cancelled || ms === null) return;
      timer = setTimeout(() => { if (!cancelled) setBiliCycle(n => n + 1); }, ms);
    }).catch(() => { /* 查不到長度：維持原狀 */ });
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [mounted, sourceKey, requestedPlaying, replay.enabled, replay.gap, biliCycle]);
  return { containerRef, playback, source, musicScene: track.scene, isPlaying: playback.phase === 'playing', requestedPlaying, isMuted, mounted,
    setIsPlaying, setIsMuted, togglePlay, toggleMute, retryMusic, closeMusic,
    volume, setVolume, audioInfo, showPlayer, setShowPlayer, replay, setReplay };
}
