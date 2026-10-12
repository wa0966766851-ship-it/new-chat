import type { DecisionRequest, DecisionReport } from './types';
const scope = self as unknown as { postMessage: (message: unknown) => void; onmessage: (event: MessageEvent<any>) => void };
const loaded = Promise.all([import('./search'), import('./simulation')]);
void loaded.then(() => scope.postMessage({ type: 'ready' })).catch(e => scope.postMessage({ type: 'boot-error', error: String(e) }));
scope.onmessage = async (event: MessageEvent<{ id: number; request: DecisionRequest; assumptions: string[] }>) => {
  const { id, request, assumptions } = event.data;
  try {
    const [{ planDecision }, { simulateAction }] = await loaded;
    const report = await planDecision(request, simulateAction, (report: DecisionReport) => scope.postMessage({ type: 'progress', id, report }), assumptions);
    scope.postMessage({ type: 'done', id, report });
  } catch (error) { scope.postMessage({ type: 'error', id, error: error instanceof Error ? error.message : String(error) }); }
};
