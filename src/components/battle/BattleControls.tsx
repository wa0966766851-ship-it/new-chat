import { useId, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { FullscreenButton } from '../FullscreenSettings';
import { BattlePauseButton } from './BattlePauseButton';
import { AnimationSpeedControl } from './AnimationSpeedControl';

interface BattleControlsProps {
  paused?: boolean;
  onPause?: () => void;
  auto: boolean;
  onAuto: () => void;
  canPass: boolean;
  onPass: () => void;
  passMode: string;
  onPassMode: () => void;
  onDisplay: () => void;
  onSettings: () => void;
  onInspect?: () => void;
  onLayout: () => void;
  game: boolean;
}

export function BattleControls(p: BattleControlsProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const openPanel = (action: () => void) => { close(); action(); };
  return (
    <div className="battle-controls" data-battle-controls onKeyDown={event => {
      if (open && event.key === 'Escape') { event.stopPropagation(); close(); }
    }}>
      <button ref={trigger} type="button" className="bt-btn battle-controls-trigger" aria-expanded={open}
        aria-controls={open ? id : undefined} data-active={open || p.paused} onClick={() => setOpen(value => !value)}>
        <SlidersHorizontal size={15} aria-hidden="true" />
        {p.paused ? '對戰控制 · 已暫停' : '對戰控制'}
      </button>
      {open && <section id={id} className="battle-controls-panel bt-panel" aria-label="對戰控制選項">
        <div className="battle-controls-options">
          <BattlePauseButton paused={p.paused} onToggle={p.onPause} />
          <button type="button" className="bt-btn" disabled={p.paused} aria-pressed={p.auto} onClick={p.onAuto}>自動託管</button>
          <button type="button" className="bt-btn" data-pass-button disabled={!p.canPass} onClick={() => openPanel(p.onPass)}>空過</button>
          <button type="button" className="bt-btn" data-pass-mode={p.passMode} aria-pressed={p.passMode === 'auto'} onClick={p.onPassMode}>自動空過</button>
        </div>
        <AnimationSpeedControl />
        <div className="battle-controls-options">
          <FullscreenButton className="bt-btn inline-flex items-center gap-1.5" />
          <button type="button" className="bt-btn" onClick={() => openPanel(p.onDisplay)}>顯示設定</button>
          <button type="button" className="bt-btn" onClick={() => openPanel(p.onSettings)}>戰鬥設定</button>
          {p.onInspect && <button type="button" className="bt-btn" onClick={() => openPanel(p.onInspect!)}>效果總覽</button>}
          <button type="button" className="bt-btn" onClick={() => window.dispatchEvent(new Event('toggle-battle-audio'))}>切換音樂播放</button>
          <button type="button" className="bt-btn" onClick={() => openPanel(() => window.dispatchEvent(new Event('toggle-battle-shell-tools')))}>顯示／隱藏工作台工具</button>
          <button type="button" className="bt-btn" onClick={() => openPanel(p.onLayout)}>{p.game ? '切換為實用風' : '切換為原廠風'}</button>
        </div>
      </section>}
    </div>
  );
}
