/** 對戰動畫自訂開關。只影響播放，不影響任何結算。 */
export type AnimationMode = 'static' | 'simple' | 'actions';
export const ANIMATION_MODES = [{value:'static',label:'靜態模式'}, {value:'simple',label:'簡易演出'}, {value:'actions',label:'精靈動作'}] as const;
export interface BattleAnimationSettings {
  /** 演出倍率；只改播放時鐘，不改戰鬥結算。 */
  speed?: number;
  mode?: AnimationMode;
  elfModes?: Record<string, AnimationMode>;
  /** 跳過所有戰鬥演出；保留個別選項，關閉後恢復。 */
  staticMode?: boolean;
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
  /** 入戰動畫：進入戰鬥時的雙方登場過場 */
  intro: boolean;
}

export const DEFAULT_BATTLE_ANIMATION: BattleAnimationSettings = {
  speed: 1,
  staticMode: false, skill: true, damage: true, extra: true, potion: true, roundEnd: true, intro: true,
};

export const BATTLE_ANIMATION_KEY = 'battleAnimationSettings';
export const BATTLE_ANIMATION_EVENT = 'battle-animation-update';

export const BATTLE_ANIMATION_OPTIONS: { key: 'skill'|'damage'|'extra'|'potion'|'roundEnd'|'intro'; label: string; tip: string }[] = [
  { key: 'skill', label: '出招動畫', tip: '使用技能時的攻擊前移／屬性亮光' },
  { key: 'damage', label: '技能傷害', tip: '攻擊技能與X系技能傷害的紅字，出招當下顯示' },
  { key: 'extra', label: '額外行動', tip: '紅字之後多播一次，不論額外行動幾次都合併為一次' },
  { key: 'potion', label: '吃藥回血', tip: '藥劑回血綠字黃邊，使用當下顯示' },
  { key: 'roundEnd', label: '回合末結算', tip: '固定／百分比傷害、回血、真實傷害統一在回合結束依序顯示' },
  { key: 'intro', label: '入戰動畫', tip: '進入戰鬥時的雙方登場過場，可點擊或按任意鍵跳過；重來時播放縮短版' },
];

export function normalizeAnimationSettings(value: unknown): BattleAnimationSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const out = { ...DEFAULT_BATTLE_ANIMATION };
  out.speed = animationSpeed(raw.speed);
  for (const key of Object.keys(out) as (keyof typeof DEFAULT_BATTLE_ANIMATION)[]) {
    if (typeof out[key] === 'boolean' && typeof raw[key] === 'boolean') (out as any)[key] = raw[key];
  }
  out.mode = isAnimationMode(raw.mode) ? raw.mode : raw.staticMode === true ? 'static' : 'simple';
  out.staticMode = out.mode === 'static';
  out.elfModes = Object.fromEntries(Object.entries(raw.elfModes && typeof raw.elfModes === 'object' ? raw.elfModes : {}).filter(([key, mode])=>key.length<200 && isAnimationMode(mode))) as Record<string,AnimationMode>;
  return out;
}

export function animationSpeed(value:unknown):number {
  return typeof value==='number'&&Number.isFinite(value)?Math.min(10,Math.max(1,value)):1;
}

export function isAnimationMode(value:unknown):value is AnimationMode { return value==='static'||value==='simple'||value==='actions'; }
/** 按物種保存，不使用會隨每場戰鬥改變的 battleId。 */
export function elfAnimationKey(elf:{id:string;name:string}) { return `${elf.id}:${elf.name}`; }
export function animationModeFor(settings:BattleAnimationSettings, elf?:{id:string;name:string}):AnimationMode {
 return (elf && settings.elfModes?.[elfAnimationKey(elf)]) || settings.mode || (settings.staticMode?'static':'simple');
}
export function withAnimationMode(settings:BattleAnimationSettings, mode:AnimationMode):BattleAnimationSettings { return {...settings,mode,staticMode:mode==='static'}; }
export function setElfAnimationMode(settings:BattleAnimationSettings, elf:{id:string;name:string}, mode:AnimationMode|'inherit'):BattleAnimationSettings {
 const elfModes={...settings.elfModes}; const key=elfAnimationKey(elf);
 if(mode==='inherit') delete elfModes[key]; else elfModes[key]=mode;
 return {...settings,elfModes};
}

export function readAnimationSettings(): BattleAnimationSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_BATTLE_ANIMATION };
    return normalizeAnimationSettings(JSON.parse(localStorage.getItem(BATTLE_ANIMATION_KEY) || 'null'));
  } catch { return { ...DEFAULT_BATTLE_ANIMATION }; }
}

/** UI 保存原偏好，播放端套用總開關，避免關閉靜態模式後丟失原設定。 */
export function effectiveAnimationSettings(settings:BattleAnimationSettings,elf?:{id:string;name:string}):BattleAnimationSettings {
 // 靜態模式只關位移與特效（出招動畫、入戰動畫）；傷害／治療飄字照使用者的個別開關保留。
 return animationModeFor(settings,elf)==='static'?{...settings,skill:false,intro:false}:settings;
}

export function writeAnimationSettings(next: BattleAnimationSettings) {
  try { localStorage.setItem(BATTLE_ANIMATION_KEY, JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new Event(BATTLE_ANIMATION_EVENT)); } catch {}
}
