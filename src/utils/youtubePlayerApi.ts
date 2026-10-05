export interface YoutubePlayer {
  playVideo(): void; pauseVideo(): void; mute(): void; unMute(): void;
  setVolume(volume: number): void; isMuted(): boolean; getVolume(): number; getPlayerState(): number; destroy(): void;
}
export interface YoutubeEvents {
  onReady(event: { target: YoutubePlayer }): void;
  onStateChange(event: { data: number; target: YoutubePlayer }): void;
  onError(event: { data: number }): void;
  onAutoplayBlocked(): void;
}
export interface YoutubeApi {
  Player: new (element: HTMLIFrameElement, options: { events: YoutubeEvents }) => YoutubePlayer;
}
type YoutubeWindow = Window & { YT?: YoutubeApi; onYouTubeIframeAPIReady?: () => void };
let pending: Promise<YoutubeApi> | undefined;

/** 官方 API 單次載入，錯誤／逾時後可重試，不使用未公開的 postMessage 協定。 */
export function loadYoutubePlayerApi(): Promise<YoutubeApi> {
  const scope = window as YoutubeWindow;
  if (scope.YT?.Player) return Promise.resolve(scope.YT);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    const previous = scope.onYouTubeIframeAPIReady;
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true; window.clearTimeout(timer);
      if (scope.onYouTubeIframeAPIReady === ready) scope.onYouTubeIframeAPIReady = previous;
      script.onerror = null;
      if (error) { script.remove(); reject(error); }
      else resolve(scope.YT!);
    };
    const ready = () => { try { previous?.(); } finally { if (scope.YT?.Player) finish(); } };
    const timer = window.setTimeout(() => finish(new Error('YouTube 控制介面載入逾時；請檢查連線或擋廣告擴充套件後重試。')), 15000);
    scope.onYouTubeIframeAPIReady = ready;
    script.onerror = () => finish(new Error('無法載入 YouTube 控制介面；請檢查網路或擴充套件。'));
    document.head.append(script);
  });
  void pending.catch(() => { pending = undefined; });
  return pending;
}
