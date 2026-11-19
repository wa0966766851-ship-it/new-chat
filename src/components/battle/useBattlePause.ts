import { useCallback, useEffect, useState } from 'react';
import { createActionGate } from '../../battle/introPlan';

/** 暫停只影響本場對戰。用同步閘門攔截按鈕與 AI，避免等 React 重繪才生效。 */
export function useBattlePause() {
  const [gate] = useState(createActionGate);
  const [paused, setPaused] = useState(false);
  const toggle = useCallback(() => {
    if (gate.held) gate.open();
    else gate.hold();
    setPaused(gate.held);
  }, [gate]);
  const isPaused = useCallback(() => gate.held, [gate]);
  useEffect(() => () => gate.open(), [gate]);
  return { paused, toggle, isPaused, wait: gate.wait };
}
