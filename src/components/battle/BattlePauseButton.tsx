import { Pause, Play } from 'lucide-react';

export function BattlePauseButton({ paused, onToggle, compact = false }: {
  paused?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}) {
  if (!onToggle) return null;
  const label = paused ? '繼續對戰' : '暫停對戰';
  const Icon = paused ? Play : Pause;
  return (
    <button type="button" className={compact ? 'btg-round' : 'bt-btn flex items-center gap-1'} onClick={onToggle}
      aria-label={label} data-battle-pause data-on={!!paused} title={label}>
      <Icon size={18} aria-hidden="true" />
      {!compact && (paused ? '繼續' : '暫停')}
    </button>
  );
}
