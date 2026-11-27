export interface FullscreenShortcut {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export const DEFAULT_FULLSCREEN_SHORTCUT: FullscreenShortcut = { key: 'F8', ctrl: false, alt: false, shift: false, meta: false };
const STORAGE_KEY = 'seer_fullscreen_shortcut_v1';
const SAFE_FUNCTION_KEYS = ['F2', 'F4', 'F8', 'F9'];

function validShortcut(binding: FullscreenShortcut): boolean {
  const { key, ctrl, alt, shift, meta } = binding;
  if ([ctrl, alt, shift, meta].some(value => typeof value !== 'boolean')) return false;
  if (SAFE_FUNCTION_KEYS.includes(key)) return !ctrl && !alt && !shift && !meta;
  return typeof key === 'string' && /^[A-Z0-9]$/.test(key) && [ctrl, alt, shift, meta].filter(Boolean).length >= 2;
}

export function eventFullscreenShortcut(event: KeyboardEvent): FullscreenShortcut | null {
  if (event.isComposing || event.getModifierState('AltGraph')) return null;
  const physical = /^(?:Key|Digit)([A-Z0-9])$/.exec(event.code)?.[1];
  const key = physical || event.key.toUpperCase();
  const binding = { key, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey };
  return validShortcut(binding) ? binding : null;
}

export function shortcutLabel({ key, ctrl, alt, shift, meta }: FullscreenShortcut): string {
  return [ctrl && 'Ctrl', alt && 'Alt', shift && 'Shift', meta && 'Meta', key].filter(Boolean).join('+');
}

export function readFullscreenShortcut(): FullscreenShortcut {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && validShortcut(saved)) return saved;
  } catch { /* 儲存不可用時使用預設。 */ }
  return DEFAULT_FULLSCREEN_SHORTCUT;
}

export function storeFullscreenShortcut(binding: FullscreenShortcut): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(binding)); return true; }
  catch { return false; }
}

export function isEditableShortcutTarget(target: EventTarget): boolean {
  return target instanceof HTMLElement
    && (!!target.closest('input, textarea, select, [role="textbox"], [role="combobox"]') || target.isContentEditable || !!target.closest('[contenteditable]:not([contenteditable="false"])'));
}
