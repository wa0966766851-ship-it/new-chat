import { useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useFullscreen } from '../contexts/FullscreenContext';
import { DEFAULT_FULLSCREEN_SHORTCUT, eventFullscreenShortcut, shortcutLabel, type FullscreenShortcut } from '../utils/fullscreenShortcut';

export function FullscreenButton({ className }: { className?: string }) {
  const fullscreen = useFullscreen();
  if (!fullscreen) return null;
  const { active, shortcut, toggle } = fullscreen;
  const label = active ? '退出全螢幕' : '進入全螢幕';
  const Icon = active ? Minimize : Maximize;
  return <button type="button" className={className} aria-pressed={active} title={label + '（' + shortcutLabel(shortcut) + '）'} onClick={toggle}>
    <Icon size={15} aria-hidden="true" />{label}
  </button>;
}

export function FullscreenSettings() {
  const fullscreen = useFullscreen();
  const [recording, setRecording] = useState(false);
  const [feedback, setFeedback] = useState('');
  if (!fullscreen) return null;

  const save = (binding: FullscreenShortcut) => {
    if (fullscreen.setShortcut(binding)) {
      setRecording(false);
      setFeedback('快捷鍵已更新為 ' + shortcutLabel(binding));
    } else setFeedback('無法儲存快捷鍵，請檢查本機儲存空間。');
  };

  const button = "rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500";
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <FullscreenButton className={button + " inline-flex items-center gap-1.5"} />
      <button type="button" className={button} aria-pressed={recording} onBlur={() => setRecording(false)}
        onClick={() => { setFeedback(''); setRecording(!recording); }}
        onKeyDown={event => {
          if (!recording || event.key === 'Tab') return;
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Escape') { setRecording(false); setFeedback('已取消改鍵'); return; }
          if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
          const binding = eventFullscreenShortcut(event.nativeEvent);
          if (binding) save(binding);
          else setFeedback('請按 F2、F4、F8、F9，或使用至少兩個輔助鍵搭配字母或數字。');
        }}>
        {recording ? '請按下新快捷鍵' : '更換快捷鍵 · ' + shortcutLabel(fullscreen.shortcut)}
      </button>
      <button type="button" className={button} onClick={() => save(DEFAULT_FULLSCREEN_SHORTCUT)}>恢復 F8</button>
    </div>
    {recording && <p className="text-xs text-slate-400">Esc 取消改鍵</p>}
    {feedback && <p role="status" className="text-xs text-slate-300">{feedback}</p>}
  </div>;
}
