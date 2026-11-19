import { createLocalAIClient } from './client';
import { fallbackDecision } from './decision';
import { decisionKnowledge, repeatedAttack } from './knowledge';
import { buildDecisionContext } from './decisionContext';
import { providerPost } from './providerApi';
import { AI_SETTINGS_EVENT } from './settings';
import { aiLegalActions } from './actionPolicy';
import { isCriticalDecision } from './tactics';
import { actionKey, type DecisionRequest, type DecisionReport } from './types';

type LocalAI = Omit<ReturnType<typeof createLocalAIClient>, 'cancel'> & {cancel?: () => void};
type Job = {
  request: DecisionRequest;
  controller: AbortController;
  local: DecisionReport;
  localDone: boolean;
  modelDone: boolean;
  modelTimedOut?: boolean;
  model?: DecisionReport['model'];
  complete: Promise<unknown>;
};

const positionFields = ['p1','p2','p1Team','p2Team','p1Timers','p2Timers','p1Marks','p2Marks',
  'p1ItemInventory','p2ItemInventory','p1RegistryState','p2RegistryState','p1ElfState','p2ElfState',
  'p1ActiveIndex','p2ActiveIndex','isTyrDuelField'] as const;

function preparationMismatch(a: DecisionRequest, b: DecisionRequest) {
  if (a.side !== b.side || !!a.forced !== !!b.forced || a.state.turnNumber !== b.state.turnNumber) return 'turn-or-phase';
  const field = positionFields.find(key => a.state[key] !== b.state[key]);
  if (field) return field;
  if (a.potionRemaining !== b.potionRemaining) return 'potion-limit';
  if (JSON.stringify(a.settings) !== JSON.stringify(b.settings)) return 'settings';
  if (JSON.stringify(a.prdCounters) !== JSON.stringify(b.prdCounters) ||
      JSON.stringify(a.prngCounters) !== JSON.stringify(b.prngCounters)) return 'random-state';
}

function waitBudget(request: DecisionRequest): number {
  return request.settings.mode === 'planner' && request.settings.budgetMs >= 600 && isCriticalDecision(request)
    ? Math.max(1200, request.settings.budgetMs) : request.settings.budgetMs;
}

export function createAssistedAIClient(local: LocalAI = createLocalAIClient(), call = providerPost,
  isCurrent: (request:DecisionRequest)=>boolean = ()=>true) {
  let disposed = false, calls = 0, prepared: Job | undefined, active: Job | undefined;
  const invalidate = () => {
    prepared?.controller.abort();
    active?.controller.abort();
    prepared = undefined;
    local.cancel?.();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(AI_SETTINGS_EVENT,invalidate);
    window.addEventListener('storage',invalidate);
  }

  function launch(request:DecisionRequest, warm:boolean): Job {
    const controller = new AbortController();
    let draft:DecisionReport;
    try {
      const knowledge = decisionKnowledge(request.state, request.side);
      draft = fallbackDecision({...request,state:knowledge.state,repeatedAttack:repeatedAttack(request.state,request.side)},
        undefined,knowledge.assumptions);
    } catch {
      draft = fallbackDecision(request,'戰局快照不可序列化，僅採用合法保底行動。',[],true);
    }
    const job:Job = {request,controller,local:draft,localDone:false,modelDone:false,complete:Promise.resolve()};
    const budget = warm ? Math.max(1400,waitBudget(request)) : waitBudget(request);
    const started = performance.now();
    const reportLocal = (report:DecisionReport) => {
      job.local = {...report,elapsedMs:performance.now()-started};
    };
    const planner = local.decide({...request,shortlistSearch:true,settings:{...request.settings,budgetMs:budget}},
      reportLocal).then(reportLocal,()=>{
        job.local = {...job.local,fallbackReason:'本地推演未完成，沿用最後有效比較。'};
      }).finally(()=>{job.localDone=true;});
    const provider = request.settings.modelEnabled && !disposed && (warm || isCurrent(request))
      ? requestModel(job,draft,warm) : Promise.resolve();
    job.complete = Promise.all([planner,provider.finally(()=>{job.modelDone=true;})]);
    return job;
  }

  async function requestModel(job:Job, draft:DecisionReport, warm:boolean) {
    if (calls >= 200) {job.model={status:'limit'};return;}
    const {request,controller} = job;
    let context:ReturnType<typeof buildDecisionContext>;
    try { context = buildDecisionContext(request,draft); }
    catch { job.model={status:'unavailable',prepared:warm};return; }
    const {input,shortlist} = context;
    if (shortlist.length < 2) return;
    const timeoutMs = request.settings.modelTimeoutMs || 15000;
    const timeout = setTimeout(()=>{
      job.modelTimedOut = true;
      controller.abort();
    },Math.min(timeoutMs,warm ? 2000 : waitBudget(request)));
    const start = performance.now();
    try {
      calls++;
      const answer = await call('decide',{input,timeoutMs},controller.signal);
      if (controller.signal.aborted) return;
      const selected = /^a[0-7]$/.test(answer.choice) ? shortlist[Number(answer.choice.slice(1))] : undefined;
      job.model = {status:'local',confidence:answer.confidence,inputTokens:answer.inputTokens,choice:answer.choice,
        suggestedAction:selected?.action,suggestedLabel:selected?.label,providerMs:performance.now()-start,prepared:warm};
    } catch {
      job.model={status:'unavailable',prepared:warm,providerMs:performance.now()-start};
    } finally {clearTimeout(timeout);}
  }

  function choose(job:Job, request:DecisionRequest): DecisionReport {
    const report = job.local, answer = job.controller.signal.aborted ? undefined : job.model;
    const legal = aiLegalActions(request);
    if (disposed || !isCurrent(request) || !legal.some(a=>actionKey(a)===actionKey(report.action)))
      return {...fallbackDecision(request,undefined,[],true),model:{status:'stale'}};
    const suggested = answer?.suggestedAction;
    if (!answer || !suggested || !legal.some(a=>actionKey(a)===actionKey(suggested))) return {...report,model:answer};
    const same = actionKey(suggested)===actionKey(report.action);
    const baseline = report.candidates.find(c=>actionKey(c.action)===actionKey(report.action));
    const compared = report.candidates.find(c=>actionKey(c.action)===actionKey(suggested));
    const gap = baseline && compared ? baseline.score-compared.score : undefined;
    const close = gap!==undefined && gap<=Math.max(4,Math.abs(baseline!.score)*0.08);
    const conservative = request.settings.risk==='conservative';
    const threshold = close ? (conservative?0.35:0.25) : (conservative?0.65:0.55);
    // 已有引擎比較時，模型只能挑近似候選，不能蓋過已驗算的生死差異。
    const comparable = report.mode !== 'planner' || !!(close && baseline && compared &&
      compared.worst >= baseline.worst - 40 && (!compared.losesToLethalPotion || !!baseline.losesToLethalPotion));
    const accepted = same || (comparable && (answer.confidence ?? 0)>=threshold);
    return {...report,action:accepted?suggested:report.action,model:{...answer,
      status: same?'agreed':accepted?'used':comparable?'low-confidence':'local',
      localAction:report.action,scoreGap:gap,threshold:same?undefined:threshold}};
  }

  return {
    start: () => local.start(),
    cancel: invalidate,
    sync: () => { if (active && !isCurrent(active.request)) active.controller.abort(); },
    prepare(request:DecisionRequest) {
      if (disposed || (request.settings.mode!=='planner' && !request.settings.modelEnabled) ||
        (prepared && !preparationMismatch(prepared.request, request))) return;
      if (prepared) invalidate();
      prepared = launch(request,true);
    },
    async decide(request:DecisionRequest):Promise<DecisionReport> {
      const started = performance.now(), cached = prepared;
      const mismatch = cached && preparationMismatch(cached.request, request);
      const hit = !!cached && !mismatch;
      if (cached && !hit) invalidate();
      prepared = undefined;
      const job = hit ? cached! : launch(request,false);
      active = job;
      const budget = waitBudget(request);
      let timer:ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([job.complete,new Promise<void>(resolve=>{
          timer = setTimeout(resolve,Math.max(0,budget-(performance.now()-started)));
        })]);
        const modelWaitExpired = !!job.modelTimedOut || (!job.modelDone && request.settings.modelEnabled);
        if (modelWaitExpired) job.controller.abort();
        const report = choose(job,request);
        return {...report,selectionWaitMs:performance.now()-started,
          timedOut:report.timedOut || !job.localDone,
          timing:{preparation:hit?'hit':cached?'miss':'none',preparationMismatch:mismatch,localMs:report.elapsedMs,waitBudgetMs:budget,
            firstSweepMs:report.firstSweepMs,workerStartupMs:report.workerStartupMs,modelMs:job.model?.providerMs,modelWaitExpired}};
      } finally {
        if (timer) clearTimeout(timer);
        if (active===job) active=undefined;
      }
    },
    dispose() {
      disposed=true;invalidate();local.dispose();
      if (typeof window!=='undefined') {
        window.removeEventListener(AI_SETTINGS_EVENT,invalidate);
        window.removeEventListener('storage',invalidate);
      }
    },
  };
}
