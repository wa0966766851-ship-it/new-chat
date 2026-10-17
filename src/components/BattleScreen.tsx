import React, { useReducer, useEffect, useRef, useMemo } from "react";
import { Skill, BattleItem } from "../types";
import { BattleState, BattleAction, EffectItem } from "./BattleManager";
import { BATTLE_ANIMATION_EVENT, readAnimationSettings, type BattleAnimationSettings } from '../battle/animationSettings';
import { BattleScreenUI } from "./BattleScreen.ui.tsx";
import { createBattleEngine, type BattleEngine } from "../engine/battleEngine";
import { Elf, BattleMode } from "../types";
import { createLocalAIClient } from '../battle/ai/client';
import { readAISettings, publishDecision, clearDecisions } from '../battle/ai/settings';
import './battle/battleFx.css';
import { BattleIntro } from './battle/BattleIntro';
import { planIntro, prefersReducedMotion, createActionGate, formatLabel } from '../battle/introPlan';

export { normalizeDamageType } from "../battle/damageSemantics";
export { checkElfDead } from "../engine/battleEngine";
// TurnDamageStats is imported from BattleManager

export interface BattleContextProps extends BattleState {
  dispatch: React.Dispatch<BattleAction>;
  addLog: (text: string, logType?: string) => void;
  trackCodeExec: (side: "p1" | "p2", code: string, metadata: any) => void;
  pushEffect: (effect: EffectItem) => void;
  onSkillSelect: (skill: Skill) => void;
  onSwitchElf: (index: number) => void;
  onUseItem: (item: any) => void;
}

export const BattleContext = React.createContext<BattleContextProps | null>(null);

export function useBattle() {
  const context = React.useContext(BattleContext);
  if (!context) throw new Error("useBattle must be used within a BattleContext.Provider");
  return context;
}

interface BattleScreenProps {
  key?: any;
  initialP1Team: Elf[];
  initialP2Team: Elf[];
  p1StarterId: string;
  p2StarterId: string;
  p1Suit?: string;
  p1Eyewear?: string;
  p2Suit?: string;
  p2Eyewear?: string;
  p1Title?: string;
  p2Title?: string;
  battleMode: BattleMode;
  onBackToMenu: () => void;
  onRestartBattle: () => void;
  onBattleEnd?: (winner: "p1" | "p2" | "exit" | "draw", team?: Elf[]) => void;
  preparedTeams?: boolean;
  specialMode?: "destiny" | "interstellar";
  battleFormat?: "normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3";
  /** 重來（非首次進入）：入戰動畫播縮短版 */
  introReplay?: boolean;
  interstellarOptions?: {onPotionUse?:()=>boolean;onBattleEnd?:Function;relics?:string[];enemyRelics?:string[];battleSeed?:number};
  /** 固定戰鬥亂數種子（可重現的對局；缺省為隨機） */
  randomSeed?: number;
  onDriverInit?: (driver: {
    getState: () => any;
    getSyncState?: () => any;
    onSkillSelect: (side: "p1" | "p2", skill: Skill) => void;
    onSwitchElf: (side: "p1" | "p2", index: number) => void;
    onUseItem: (side: "p1" | "p2", item: BattleItem) => void;
  }) => void;
  onStateChange?: (state: any) => void;
}


/**
 * 戰鬥畫面：只負責輸入、狀態訂閱與播放。回合結算全部在 src/engine/battleEngine.ts。
 * 精靈專屬邏輯一律寫在註冊表（見 AGENTS.md），這裡與引擎都不得出現精靈名稱判斷。
 */
export default function BattleScreen(props: BattleScreenProps) {
  // 防卡頓：URL ?fast=1 自動開啟省動畫模式（引擎讀 window.__BATTLE_FAST__）。
  if (typeof window !== 'undefined' && !(window as any)._battleFastInit) {
    (window as any)._battleFastInit = true;
    try {
      if (new URLSearchParams(window.location.search).get('fast') === '1') (window as any).__BATTLE_FAST__ = true;
    } catch { /* 非瀏覽器環境略過 */ }
  }

  const animationSettingsRef = useRef<BattleAnimationSettings>(readAnimationSettings());
  useEffect(() => {
    const refresh = () => { animationSettingsRef.current = readAnimationSettings(); };
    window.addEventListener(BATTLE_ANIMATION_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(BATTLE_ANIMATION_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);

  const [potionsUsed, setPotionsUsed] = React.useState(0);
  const potionsUsedRef = useRef(0);
  const [presentationVersion, updatePresentation] = useReducer((n: number) => n + 1, 0);
  const commitRef = useRef<(s: BattleState) => void>(() => {});
  const presentRef = useRef<() => void>(() => {});
  const propsRef = useRef(props);
  propsRef.current = props;

  // 入戰動畫：純展示；動畫期間行動閘門關閉（AI／托管等到結束才出手），引擎照常建立。
  const [intro] = React.useState(() => planIntro({ enabled: readAnimationSettings().intro !== false, specialMode: props.specialMode, replay: props.introReplay, reducedMotion: prefersReducedMotion() }));
  const [introOn, setIntroOn] = React.useState(intro.play);
  const gateRef = useRef<ReturnType<typeof createActionGate>>(null as any);
  if (!gateRef.current) { gateRef.current = createActionGate(); if (intro.play) gateRef.current.hold(); }
  useEffect(() => () => gateRef.current.open(), []);

  const engineRef = useRef<BattleEngine | null>(null);
  const aiRef = useRef<ReturnType<typeof createLocalAIClient> | null>(null);
  if (!aiRef.current) aiRef.current = createLocalAIClient();
  if (!engineRef.current) {
    engineRef.current = createBattleEngine({
      ...props,
      // 結算已完成，等畫面播完最後的演出再通知外層
      onBattleEnd: (w, team) => { void engineRef.current?.presentation.wait().then(() => { if (engineRef.current?.isAlive()) propsRef.current.onBattleEnd?.(w, team); }); },
      onStateCommit: s => commitRef.current(s),
      onPresentationChange: () => presentRef.current(),
      animationSettings: () => animationSettingsRef.current,
      actionGate: () => gateRef.current.wait(),
      selectAi: request => aiRef.current!.decide(request),
      aiSettings: readAISettings,
      onAIDecision: report => { if (readAISettings().explain) publishDecision(report); },
      potionRemaining: () => propsRef.current.interstellarOptions?.onPotionUse
        ? Math.max(0, (Number((propsRef.current.interstellarOptions as any).maxPotionUsage) || 0) - potionsUsedRef.current) : undefined,
      onPotionUsed: () => { potionsUsedRef.current++; setPotionsUsed(potionsUsedRef.current); },
    });
  }
  const engine = engineRef.current;
  const presentation = engine.presentation;

  // 引擎狀態（已算完）只給 onStateChange／驅動用；畫面一律顯示播放時間軸上的狀態（presentation.view），
  // 日誌、異常、能力、回合階段都跟著動畫進度出現，不會先於動畫劇透。
  const [engineState, rawDispatch] = useReducer((_: BattleState, a: { state: BattleState }) => a.state, engine.getState());
  commitRef.current = s => rawDispatch({ state: s });
  presentRef.current = () => updatePresentation();
  if (!presentation.view) void presentation.stage(engine.getState());
  const state: BattleState = presentation.view ?? engineState;

  useEffect(() => {
    engine.mount();
    if (propsRef.current.battleMode === 'PVE') aiRef.current?.start();
    engine.start();
    return () => {
      engine.unmount();
      queueMicrotask(() => { if (!engine.isAlive()) { aiRef.current?.dispose(); clearDecisions(); } });
    };
  }, []);

  useEffect(() => { propsRef.current.onStateChange?.(engineState); }, [engineState]);

  useEffect(() => {
    propsRef.current.onDriverInit?.({
      getState: () => engine.getState(),
      getSyncState: () => engine.getState(),
      onSkillSelect: (side, skill) => engine.onSkillSelect(side, skill),
      onSwitchElf: (side, index) => engine.onSwitchElf(side, index),
      onUseItem: (side, item) => engine.onUseItem(side, item),
      /** 畫面仍在播放（引擎已算完、動畫還沒播完）。 */
      isPresenting: () => engine.presentation.busy,
    } as any);
  }, []);

  const potionLimit = props.interstellarOptions?.onPotionUse ? { max: Number((props.interstellarOptions as any).maxPotionUsage) || 0, left: Math.max(0, (Number((props.interstellarOptions as any).maxPotionUsage) || 0) - potionsUsed) } : undefined;
  const { onSkillSelect, onSwitchElf, onUseItem, dispatch, pushEffect } = engine;

  // Provider value 只在 state 改變時重建
  const contextValue = useMemo<BattleContextProps>(() => ({
    ...state,
    turnNumber: presentation.turnNumber,
    battleFormat: props.battleFormat,
    p1: { ...state.p1, currentHp: presentation.hp.get(`p1:${state.p1.battleId || state.p1.id}`) ?? state.p1.currentHp },
    p2: { ...state.p2, currentHp: presentation.hp.get(`p2:${state.p2.battleId || state.p2.id}`) ?? state.p2.currentHp },
    floatingDamagePopups: presentation.popups,
    lastActionInfo: null,
    consoleShake: { p1: false, p2: false },
    dispatch, pushEffect,
    addLog: (text, type) => pushEffect({ type: 'log', side: 'p1', data: { text, type } }),
    trackCodeExec: () => {},
    onSkillSelect: (skill) => onSkillSelect('p1', skill),
    onSwitchElf: (index) => onSwitchElf('p1', index),
    onUseItem: (item) => onUseItem('p1', item)
  }), [state, presentationVersion]);

  return (
    <BattleContext.Provider value={contextValue}>
      <BattleScreenUI 
        onSkillSelect={onSkillSelect}
        onSwitchElf={onSwitchElf}
        onUseItem={onUseItem}
        potionLimit={potionLimit}
        specialMode={props.specialMode}
        onReset={props.onRestartBattle}
        onBackToMenu={() => { const st = engine.getState(); if (!st.winner) props.onBattleEnd?.("exit", structuredClone(st.p1Team)); props.onBackToMenu(); }}
        onAutoBattleToggle={() => dispatch({ type: 'SET_AUTO_BATTLE', isAuto: !engine.getState().isAutoBattle })}
        activeSkillAnim={presentation.skillAnim}
        floatingDamagePopups={presentation.popups}
        consoleShake={{ p1: false, p2: false }}
        damageDealt={state.damageDealt}
        ledger={engine.ledger}
        battleMode={props.battleMode}
        formatLabel={formatLabel(props.battleFormat)}
      />
      {introOn && <BattleIntro p1={state.p1} p2={state.p2} format={formatLabel(props.battleFormat)} plan={intro}
        onDone={() => { gateRef.current.open(); setIntroOn(false); }} />}
    </BattleContext.Provider>
  );
}
