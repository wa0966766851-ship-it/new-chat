import { useEffect, useRef, useState } from 'react';
import { youtubeEmbedUrl, youtubeErrorMessage, type MusicSource } from '../utils/musicSource';
import { loadYoutubePlayerApi, type YoutubePlayer } from '../utils/youtubePlayerApi';

type Playback = { phase: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'blocked' | 'error' | 'external'; message: string };
export function useMusicPlayer(source: MusicSource) {
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
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [requestedPlaying, setRequestedPlaying] = useState(false);
  const [isMuted, updateMuted] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [playback, setPlayback] = useState<Playback>({ phase: 'idle', message: '尚未播放' });
  const sourceKey = JSON.stringify(source);
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
    frame.width = '320'; frame.height = '200'; frame.style.width = '100%'; frame.style.height = '200px'; frame.style.border = '0';
    const attachFrame = () => { container.replaceChildren(frame); };
    const fail = (message: string, phase: 'blocked' | 'error' = 'error') => {
      if (disposed) return;
      clearWatchdog(); setPlayback({ phase, message });
    };
    const loadTimer = window.setTimeout(() => fail('播放器載入逾時；請檢查連線、瀏覽器限制或按「重新載入」。'), 20000);
    if (source.type === 'bilibili') {
      frame.src = `https://player.bilibili.com/player.html?bvid=${source.id}&page=${source.page}&autoplay=1&muted=${desired.current.muted ? 1 : 0}`;
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
        frame.src = youtubeEmbedUrl(source, window.location.origin); attachFrame();
        instance = new api.Player(frame, { events: {
          onReady: event => {
            if (disposed) return;
            window.clearTimeout(loadTimer); player.current = event.target; ready.current = true;
            setPlayback({ phase: 'ready', message: '播放器已就緒' }); apply();
          },
          onStateChange: event => {
            if (disposed) return;
            const state = event.data;
            if (state === 1) {
              clearWatchdog(); desired.current.playing = true; setRequestedPlaying(true);
              updateMuted(event.target.isMuted() || event.target.getVolume() === 0);
              setPlayback({ phase: 'playing', message: '播放中' });
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
      disposed = true; ready.current = false; player.current = null;
      window.clearTimeout(loadTimer); clearWatchdog(); frame.onload = null;
      instance?.destroy(); container.replaceChildren();
    };
  }, [mounted, sourceKey, attempt]);

  // B站沒有受支援的跨站控制 API；停止時卸除，恢復／換音量重新載入，不謊報「播放中」。
  useEffect(() => {
    if (!mounted || source.type !== 'bilibili' || !containerRef.current) return;
    const frame = containerRef.current.querySelector('iframe');
    if (frame) frame.src = requestedPlaying
      ? `https://player.bilibili.com/player.html?bvid=${source.id}&page=${source.page}&autoplay=1&muted=${isMuted ? 1 : 0}` : 'about:blank';
  }, [mounted, sourceKey, requestedPlaying, isMuted]);
  return { containerRef, playback, isPlaying: playback.phase === 'playing', requestedPlaying, isMuted, mounted,
    setIsPlaying, setIsMuted, togglePlay, toggleMute, retryMusic, closeMusic,
    volume, setVolume, audioInfo, showPlayer, setShowPlayer };
}
