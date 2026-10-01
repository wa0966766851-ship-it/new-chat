import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Result = { seconds: number; frames: number; slowFrames: number; longestFrameMs: number; longTasks: number; longestTaskMs: number; heapMB: number | null; hidden: boolean; longTaskSupported: boolean };
const empty = (): Result => ({ seconds: 0, frames: 0, slowFrames: 0, longestFrameMs: 0, longTasks: 0, longestTaskMs: 0, heapMB: null, hidden: false, longTaskSupported: false });
/** 僅按下開始時採樣；關閉／到期／卸載即停止，不上傳任何資料。 */
export default function PerformanceProbe({ onClose }: { onClose: () => void }) {
  const [running, setRunning] = useState(false), [result, setResult] = useState<Result>(empty);
  const [durationSeconds, setDurationSeconds] = useState(60);
  const stop = useRef<() => void>(() => {});
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current(); }; }, []);
  function start() {
    stop.current(); const sample = empty(), begin = performance.now(); let last: number | undefined, raf = 0, timer: ReturnType<typeof setInterval>;
    let observer: PerformanceObserver | undefined, finished = false;
    const publish = () => {
      sample.seconds = (performance.now() - begin) / 1000;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      sample.heapMB = memory ? memory.usedJSHeapSize / 1024 / 1024 : null;
      if (mounted.current) setResult({ ...sample });
    };
    const collect = (entries: PerformanceEntry[]) => { for (const entry of entries) { sample.longTasks++; sample.longestTaskMs = Math.max(sample.longestTaskMs, entry.duration); } };
    const finish = () => { if (finished) return; finished = true; cancelAnimationFrame(raf); clearInterval(timer); if (observer) collect(observer.takeRecords()); observer?.disconnect(); document.removeEventListener('visibilitychange', hidden); publish(); if (mounted.current) setRunning(false); };
    const hidden = () => { if (document.hidden) { sample.hidden = true; finish(); } };
    try {
      if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        observer = new PerformanceObserver(list => { if (!finished) collect(list.getEntries()); });
        observer.observe({ type: 'longtask', buffered: false }); sample.longTaskSupported = true;
      }
    } catch { sample.longTaskSupported = false; }
    const frame = (now: number) => {
      if (finished) return;
      if (last !== undefined) { const delta = now - last; sample.frames++; sample.longestFrameMs = Math.max(sample.longestFrameMs, delta); if (delta > 50) sample.slowFrames++; }
      last = now; raf = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', hidden);
    timer = setInterval(() => { publish(); if (performance.now() - begin >= durationSeconds * 1000) finish(); }, 1000);
    raf = requestAnimationFrame(frame); stop.current = finish; setResult(sample); setRunning(true);
  }
  return createPortal(<aside aria-label="本機效能量測" className="fixed bottom-3 right-3 z-[10050] w-[min(350px,calc(100vw-24px))] ios-card p-4 text-xs shadow-2xl space-y-2">
    <div className="flex justify-between gap-2"><strong className="text-blue-200 text-sm">本機效能量測</strong><button type="button" aria-label="關閉效能量測" onClick={() => { stop.current(); onClose(); }}>✕</button></div>
    <p className="text-slate-400">按開始後可關閉控制中心並操作各頁。切到背景即停止。本機讀值，不上傳。</p>
    <label className="flex items-center gap-2">採樣長度<select aria-label="採樣長度" disabled={running} value={durationSeconds} onChange={e => setDurationSeconds(Number(e.target.value))} className="bg-slate-900 rounded px-2 py-1"><option value={60}>1分鐘</option><option value={300}>5分鐘</option><option value={900}>15分鐘</option></select></label>
    <div className="flex gap-3"><button type="button" disabled={running} onClick={start}>開始量測</button><button type="button" disabled={!running} onClick={() => stop.current()}>停止量測</button></div>
    <output className="block space-y-1 text-slate-200" aria-label="效能量測結果">
      <p>{running ? '採樣中' : '已停止'} · {result.seconds.toFixed(1)} 秒 · 平均畫面回呼 {result.seconds > 0 ? (result.frames / result.seconds).toFixed(1) : '—'}/秒</p>
      <p>超過 50 ms 的畫面間隔：{result.slowFrames}；最大 {result.longestFrameMs.toFixed(1)} ms</p>
      <p>長任務：{result.longTaskSupported ? `${result.longTasks}；最大 ${result.longestTaskMs.toFixed(1)} ms` : '瀏覽器未提供／尚未開始'}</p>
      <p>JS 堆積：{result.heapMB !== null ? `${result.heapMB.toFixed(1)} MB` : '瀏覽器未提供'}</p>
      {result.hidden && <p className="text-amber-200">曾切至背景；不可與前景測試直接比較。</p>}
    </output>
    <p className="text-slate-500">畫面回呼不是 GPU FPS；堆積不是整個程序記憶體。桌面／手機尺寸模擬不等於低階手機實測。</p>
  </aside>, document.body);
}
