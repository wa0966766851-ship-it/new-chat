/** 對戰動畫自訂開關。只影響播放，不影響任何結算。 */
export interface BattleAnimationSettings {
  /** 出招動畫（攻擊前移／屬性亮光） */
  skill: boolean;
  /** 技能傷害紅字（攻擊技能／X系技能傷害） */
  damage: boolean;
  /** 額外行動：紅字播完後多播一次 */
  extra: boolean;
  /** 吃藥回血（綠字黃邊，即時） */
  potion: boolean;
  /** 回合末收束：粉傷 → 回血 → 真實傷害 */
  roundEnd: boolean;
}

export const DEFAULT_BATTLE_ANIMATION: BattleAnimationSettings = {
  skill: true, damage: true, extra: true, potion: true, roundEnd: true,
};

export const BATTLE_ANIMATION_KEY = 'battleAnimationSettings';
export const BATTLE_ANIMATION_EVENT = 'battle-animation-update';

export const BATTLE_ANIMATION_OPTIONS: { key: keyof BattleAnimationSettings; label: string; tip: string }[] = [
  { key: 'skill', label: '出招動畫', tip: '使用技能時的攻擊前移／屬性亮光' },
  { key: 'damage', label: '技能傷害', tip: '攻擊技能與X系技能傷害的紅字，出招當下顯示' },
  { key: 'extra', label: '額外行動', tip: '紅字之後多播一次，不論額外行動幾次都合併為一次' },
  { key: 'potion', label: '吃藥回血', tip: '藥劑回血綠字黃邊，使用當下顯示' },
  { key: 'roundEnd', label: '回合末結算', tip: '固定／百分比傷害、回血、真實傷害統一在回合結束依序顯示' },
];

export function normalizeAnimationSettings(value: unknown): BattleAnimationSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const out = { ...DEFAULT_BATTLE_ANIMATION };
  for (const key of Object.keys(out) as (keyof BattleAnimationSettings)[]) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean;
  }
  return out;
}

export function readAnimationSettings(): BattleAnimationSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_BATTLE_ANIMATION };
    return normalizeAnimationSettings(JSON.parse(localStorage.getItem(BATTLE_ANIMATION_KEY) || 'null'));
  } catch { return { ...DEFAULT_BATTLE_ANIMATION }; }
}

export function writeAnimationSettings(next: BattleAnimationSettings) {
  try { localStorage.setItem(BATTLE_ANIMATION_KEY, JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new Event(BATTLE_ANIMATION_EVENT)); } catch {}
}
