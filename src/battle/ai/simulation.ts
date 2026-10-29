import { createBattleEngine, type BattleEngine } from '../../engine/battleEngine';
import { materializeAiAction, pickAiForcedSwitch } from '../../utils/ai';
import { preservePrd } from '../../utils/prd';
import { makeRng, restorePRNG, snapshotPRNG } from '../../utils/rng';
import { type DecisionRequest, type PlannedAction, type AISide, opposite } from './types';

function submit(engine: BattleEngine, side: AISide, choice: PlannedAction) {
  const action = materializeAiAction(engine.getState(), side, choice);
  if (action.type === 'skill') engine.onSkillSelect(side, action.skill!);
  else if (action.type === 'switch') engine.onSwitchElf(side, action.switchIndex!);
  else engine.onUseItem(side, action.item!);
}
/**
 * 正式瀏覽器僅能在Worker呼叫。Node語意測試須序列執行。
 * 首發不重跑、替補由真正登場流程處理；不呼叫外部存檔／藥劑／勝敗回呼。
 */
export async function simulateAction(request: DecisionRequest, choice: PlannedAction, reply: PlannedAction, seed: number, deadline: number) {
  const restore = preservePrd(), oldCounters = snapshotPRNG(), oldRandom = Math.random;
  let engine: BattleEngine | undefined, error: unknown;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    Math.random = makeRng(seed ^ 0xabc123);
    restorePRNG(request.prngCounters || {});
    const initial = structuredClone(request.state);
    initial.isAutoBattle = false;
    if (!request.forced) initial.phase = 'p1_select';
    let remaining = request.potionRemaining;
    engine = createBattleEngine({ initialState: initial, initialP1Team: initial.p1Team, initialP2Team: initial.p2Team,
      p1StarterId: initial.p1.id, p2StarterId: initial.p2.id, battleMode: 'PVP', preparedTeams: true, simulation: true,
      randomSeed: seed, initialPrdCounters: request.prdCounters || [], runtimeSnapshot: request.runtime,
      p1Suit: request.p1Suit, p2Suit: request.p2Suit, p1Title: request.p1Title, p2Title: request.p2Title,
      specialMode: request.specialMode, battleFormat: request.battleFormat, isFast: () => true,
      interstellarOptions: request.specialMode === 'interstellar' ? { relics: initial.p1Relics, enemyRelics: initial.p2Relics,
        onPotionUse: () => remaining === undefined || (remaining > 0 && (--remaining >= 0)) } : undefined,
      onSimulationError: e => { error = e; } });
    engine.mount();
    const settle = async () => {
      const left = Math.max(1, deadline - performance.now());
      await Promise.race([engine!.idle(), new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('分支逾時')), left);
      })]);
      if (timeout) { clearTimeout(timeout); timeout = undefined; }
      if (error) throw error;
    };
    if (request.forced) {
      submit(engine, request.side, choice);
      await settle();
    } else {
      submit(engine, 'p1', request.side === 'p1' ? choice : reply);
      submit(engine, 'p2', request.side === 'p2' ? choice : reply);
      await settle();
      if (engine.getState().turnNumber === initial.turnNumber && !engine.getState().winner && !engine.getState().phase.startsWith('forced_switch'))
        throw new Error('候選未被引擎接受');
    }
    // 死亡換人／待收尾也在真正引擎完成，不把死亡前快照誤當回合結果。
    for (let n = 0; n < 12 && !engine.getState().winner && engine.getState().phase.startsWith('forced_switch'); n++) {
      const st = engine.getState();
      let changed = false;
      for (const side of ['p1', 'p2'] as const) {
        if (st.phase !== 'forced_switch_both' && st.phase !== `forced_switch_${side}`) continue;
        const index = pickAiForcedSwitch(engine.getState(), side, request.p1Suit, request.p2Suit, makeRng(seed));
        if (index >= 0) { engine.onSwitchElf(side, index); changed = true; await settle(); break; }
      }
      if (!changed) break;
    }
    if (engine.getState().phase.startsWith('forced_switch') && !engine.getState().winner) throw new Error('換人分支未完成');
    return structuredClone(engine.getState());
  } finally {
    if (timeout) clearTimeout(timeout);
    engine?.unmount();
    await Promise.resolve(); // 卸載排程先清乾淨，才恢復主測試的機率計數
    Math.random = oldRandom; restore(); restorePRNG(oldCounters);
  }
}
