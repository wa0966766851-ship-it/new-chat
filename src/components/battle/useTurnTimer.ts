import {useEffect,useState} from 'react';
import type {BattleEngine} from '../../engine/battleEngine';
import type {BattleState} from '../BattleManager';
import {readTurnTimer,TURN_TIMER_EVENT,timerTurn,timeoutAction} from '../../battle/turnTimer';

function choiceKey(state: BattleState, turn: ReturnType<typeof timerTurn>) {
  if (!turn) return '';
  const elf = state[turn.side];
  return `${state.turnNumber}:${turn.side}:${elf.battleId || elf.id}:${turn.forced}`;
}

const neverPaused = () => false;

/** 雙人連線的選擇時限（玩家未開啟計時器時使用），避免一方離座讓對局卡住。 */
export const ONLINE_TURN_SECONDS = 60;

/**
 * localSide：雙人連線時只替本機這一側計時；逾時一律依序選擇（不交給 AI 托管，避免雙方不同步）。
 */
export function useTurnTimer(engine: BattleEngine, state: BattleState, battleMode: 'PVE' | 'PVP', introOn: boolean, isPaused = neverPaused, localSide?: 'p1' | 'p2') {
  const [storedSettings,setSettings]=useState(readTurnTimer);
  const settings = localSide ? { mode: 'ordered' as const, seconds: storedSettings.mode === 'off' ? ONLINE_TURN_SECONDS : storedSettings.seconds } : storedSettings;
  const [clock,setClock]=useState<{key: string; seconds: number} | null>(null);
  const [autoP2,setAutoP2]=useState(false);
  const rawTurn=timerTurn(state,battleMode);
  const turn=localSide && rawTurn?.side!==localSide ? undefined : rawTurn;
  const key=choiceKey(state,turn);
  const enabled=settings.mode!=='off' && !introOn && !state.winner;
  const p1Auto=turn?.side==='p1' && state.isAutoBattle;

  useEffect(()=>{
    const refresh=()=>setSettings(readTurnTimer());
    window.addEventListener(TURN_TIMER_EVENT,refresh);
    window.addEventListener('storage',refresh);
    return()=>{
      window.removeEventListener(TURN_TIMER_EVENT,refresh);
      window.removeEventListener('storage',refresh);
    };
  },[]);

  useEffect(()=>{
    setClock(null);
    if (!turn || introOn || p1Auto) return;
    const {side,forced}=turn;
    const controlled=side==='p2' && autoP2;
    if (!controlled && settings.mode==='off') return;

    let cancelled=false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const stillChoosing=()=>{
      const current=engine.getState();
      return !cancelled && engine.isAlive() && !(side==='p1' && current.isAutoBattle)
        && choiceKey(current,timerTurn(current,battleMode))===key;
    };
    const onTimeout=()=>{
      if (settings.mode==='auto') {
        if (side==='p1') engine.dispatch({type:'SET_AUTO_BATTLE',isAuto:true});
        else setAutoP2(true);
        return;
      }
      const current=engine.getState();
      const action=timeoutAction(current,side,forced);
      if (action.kind==='skill') engine.onSkillSelect(side,current[side].skills[action.slot]);
      else if (action.kind==='switch') engine.onSwitchElf(side,action.index);
      else if (!forced) engine.onPass(side);
    };

    let last=performance.now(), left=settings.seconds*1000, paused=true;
    let aiPending = false;
    const start = () => {
      if (cancelled) return;
      // 演出可能在選擇階段已開始後排入。使用同一個倒數暫停／繼續，避免把動畫時間算進玩家的時間。
      const tick=()=>{
        const now=performance.now();
        if (!stillChoosing() || isPaused() || engine.presentation.busy) {
          last=now;
          paused=true;
          return;
        }
        if (controlled) {
          if (aiPending) return;
          aiPending = true;
          void engine.performAIAction(side, forced, () => stillChoosing() && !isPaused())
            .catch(error => console.error('[turn timer AI]', error))
            .finally(() => { aiPending = false; });
          return;
        }
        if (!paused) left=Math.max(0,left-(now-last));
        last=now;
        paused=false;
        const seconds=Math.ceil(left/1000);
        setClock(previous=>previous?.key===key && previous.seconds===seconds ? previous : {key,seconds});
        if (left>0) return;
        clearInterval(interval);
        setClock(null);
        onTimeout();
      };
      interval=setInterval(tick,100);
      tick();
    };
    void engine.presentation.wait().catch(error => console.error('[turn timer presentation]', error)).then(start);

    return()=>{
      cancelled=true;
      clearInterval(interval);
    };
  },[engine,key,battleMode,settings.mode,settings.seconds,introOn,p1Auto,autoP2,isPaused]);

  return {
    enabled,
    remaining: enabled && !p1Auto && clock?.key===key ? clock.seconds : null,
    side: turn?.side,
    waitingForPresentation: enabled && !!turn && !p1Auto && clock?.key !== key && !(turn.side === 'p2' && autoP2),
    autoP2: autoP2 && !state.winner,
    stopP2:()=>setAutoP2(false),
  };
}
