import { decisionKnowledge, repeatedAttack } from './knowledge';
import { fallbackDecision } from './decision';
import type { DecisionRequest, DecisionReport } from './types';

type Pending = { submit?:()=>void; onProgress?: (report:DecisionReport)=>void; id: number; resolve: (report: DecisionReport) => void; best: DecisionReport; start: number; timer: ReturnType<typeof setTimeout> };
/** 不把Worker引用放到引擎中，避免Worker→引擎→Worker的建置循環。 */
export function createLocalAIClient(factory = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })) {
  let worker: Worker | undefined, ready = false, disposed = false, serial = 0, pending: Pending | undefined;
  let bootTimer: ReturnType<typeof setTimeout> | undefined, failure: string | undefined;
  const finish = (reason?: string, timedOut?: boolean) => {
    if (!pending) return;
    const p = pending; pending = undefined; clearTimeout(p.timer);
    p.resolve({ ...p.best, elapsedMs: performance.now() - p.start, timedOut: timedOut ?? p.best.timedOut,
      fallbackReason: reason || p.best.fallbackReason });
  };
  const stop = () => { worker?.terminate(); worker = undefined; ready = false; if (bootTimer) clearTimeout(bootTimer); };
  const start = () => {
    if (worker || disposed || typeof Worker === 'undefined') return;
    try {
      worker = factory();
      bootTimer = setTimeout(() => { failure = '背景引擎載入逾時'; finish(failure); stop(); }, 15000);
      worker.onmessage = event => {
        const message = event.data;
        if (message.type === 'ready') { ready = true; failure = undefined; clearTimeout(bootTimer); pending?.submit?.(); return; }
        if (message.type === 'boot-error') { failure = '背景引擎無法載入'; finish(failure); stop(); return; }
        if (message.id !== pending?.id) return;
        if (message.type === 'progress' || message.type === 'done') {
          pending!.best = {...message.report,workerStartupMs:pending!.best.workerStartupMs};
          pending!.onProgress?.(pending!.best);
        }
        if (message.type === 'done') finish();
        if (message.type === 'error') { finish('推演失敗：' + message.error); stop(); }
      };
      worker.onerror = () => { failure = '背景引擎不可用'; finish(failure); stop(); };
    } catch { failure = '此環境無法啟動背景引擎'; stop(); }
  };
  return {
    start,
    async decide(source: DecisionRequest, onProgress?: (report:DecisionReport)=>void): Promise<DecisionReport> {
      // 同步取快照；不得在等待期間讀取後來公開的選招或改變的戰局。
      let request: DecisionRequest, assumptions: string[] = [];
      try {
        const knowledge = decisionKnowledge(source.state, source.side);
        request = { ...source, repeatedAttack: repeatedAttack(source.state, source.side), state: knowledge.state }; assumptions = knowledge.assumptions;
      } catch {
        // 動態閉包佇列無法安全複製時不丟棄其效果，也不宣稱完成推演。
        return fallbackDecision(source, '戰局含不可序列化效果，僅選合法保底行動。', [], true);
      }
      const fallback = fallbackDecision(request, undefined, assumptions);
      if (source.settings.mode === 'heuristic' || disposed) return fallback;
      start();
      if (pending) { finish('新的決策取代先前請求'); stop(); start(); }
      if (!worker) return { ...fallback, fallbackReason: failure || '背景引擎不可用，本回合使用快速決策。' };
      return new Promise(resolve => {
        const id = ++serial, begin = performance.now();
        const timer = setTimeout(() => { finish('已達思考時間上限，採用最後完整比較或安全回退。', true); stop(); start(); }, source.settings.budgetMs + 75);
        pending = { id, resolve, best: fallback, start: begin, timer, onProgress };
        const submit = () => {
          const job = pending;
          if (!job || job.id !== id) return;
          job.submit = undefined;
          const startup = performance.now()-begin;
          job.best = {...job.best,workerStartupMs:startup};
          job.onProgress?.(job.best);
          try {
            worker!.postMessage({id,request:{...request,settings:{...request.settings,
              budgetMs:Math.max(1,request.settings.budgetMs-startup)}}, assumptions});
          } catch { finish('無法傳送戰局快照，使用快速決策。'); stop(); }
        };
        if (ready) submit();
        else pending.submit = submit;
      });
    },
    cancel() { if (pending) { finish('舊局面已變更'); stop(); start(); } },
    dispose() { disposed = true; finish('對戰已結束，取消推演。'); stop(); },
  };
}
