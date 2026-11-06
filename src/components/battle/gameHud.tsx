import React from 'react';
import './battleGameSkin.css';
import { TypeIcon } from '../SeerImages';
import { splitTypes } from '../../battle/seerAssets';
import { animationSpeed, readAnimationSettings, writeAnimationSettings } from '../../battle/animationSettings';

/**
 * 對戰畫面版面偏好（2026-11-07）。
 * - style：'game'＝原廠風（新）／'classic'＝實用風（舊版，完整保留為退路）。
 * - trayHidden：原廠風頭像下方的分類效果列整排收起。
 */
export type BattleLayoutStyle = 'game' | 'classic';
const STYLE_KEY = 'battleLayoutStyle';
const TRAY_KEY = 'battleTrayHidden';
const EVENT = 'battle-layout-pref';

const read = <T,>(key: string, fallback: T, parse: (s: string) => T): T => {
  try { const v = localStorage.getItem(key); return v == null ? fallback : parse(v); } catch { return fallback; }
};
const write = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* 無痕或停用儲存時只在本次有效 */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* 略過 */ }
};

/** 原廠風外觀：戰術・青／戰術・黃（參考方舟系平面戰術風）／原廠藍（第一版藍色漸層）。星蝕迴廊不受影響。 */
export type BattleGameSkin = 'tactical-cyan' | 'tactical-lime' | 'blue';
const SKIN_KEY = 'battleGameSkin';
export const BATTLE_GAME_SKINS: [BattleGameSkin, string][] = [['tactical-cyan', '戰術・青'], ['tactical-lime', '戰術・黃'], ['blue', '原廠藍']];
export function readBattleGameSkin(): BattleGameSkin {
  return read<BattleGameSkin>(SKIN_KEY, 'tactical-cyan', s => (s === 'tactical-lime' || s === 'blue' ? s : 'tactical-cyan'));
}

export function readBattleLayoutStyle(): BattleLayoutStyle {
  return read<BattleLayoutStyle>(STYLE_KEY, 'game', s => (s === 'classic' ? 'classic' : 'game'));
}

export function useBattleLayoutPrefs() {
  const [style, setStyleState] = React.useState<BattleLayoutStyle>(readBattleLayoutStyle);
  const [trayHidden, setTrayState] = React.useState<boolean>(() => read(TRAY_KEY, false, s => s === '1'));
  const [skin, setSkinState] = React.useState<BattleGameSkin>(readBattleGameSkin);
  React.useEffect(() => {
    const sync = () => { setStyleState(readBattleLayoutStyle()); setTrayState(read(TRAY_KEY, false, s => s === '1')); setSkinState(readBattleGameSkin()); };
    window.addEventListener(EVENT, sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return {
    style, trayHidden, skin,
    setSkin: (k: BattleGameSkin) => { setSkinState(k); write(SKIN_KEY, k); },
    setStyle: (s: BattleLayoutStyle) => { setStyleState(s); write(STYLE_KEY, s); },
    setTrayHidden: (v: boolean) => { setTrayState(v); write(TRAY_KEY, v ? '1' : '0'); },
  };
}

/** 窄螢幕（手機直向）或極矮視窗仍用實用風：原廠風以桌面寬度設計。 */
export function useWideEnoughForGameLayout() {
  const check = () => typeof window === 'undefined' || (window.innerWidth >= 900 && window.innerHeight >= 560);
  const [ok, setOk] = React.useState(check);
  React.useEffect(() => {
    const on = () => setOk(check());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return ok;
}

const SPEEDS = [1, 2, 5, 10];
/** 動畫速度循環切換（×1→×2→×5→×10→×1）；自訂倍率先跳到下一個標準檔。 */
export function cycleAnimationSpeed(current: number) {
  const next = SPEEDS.find(s => s > current + 1e-6) ?? SPEEDS[0];
  writeAnimationSettings({ ...readAnimationSettings(), speed: animationSpeed(next) });
}

/** 屬性圖示槽：雙屬性預留兩格寬，官方組合圖缺圖時以兩個單屬性並排（TypeIcon 內建退路）。 */
export function TypeSlot({ type, size = 26, title }: { type: string; size?: number; title?: string }) {
  let dual = false;
  try { dual = splitTypes(type || '').length > 1; } catch { dual = false; }
  return <span className="btg-typeslot" data-dual={dual} title={title} style={{ height: size + 2 }}>
    <TypeIcon type={type} size={size} />
  </span>;
}

/** 屬性主色（戰術風技能卡左側色條用）；雙屬性取第一個，屬性技能為灰。 */
const TYPE_COLORS: Record<string, string> = {
  草: '#5fd068', 水: '#45a4ff', 火: '#ff6a3d', 飛行: '#9cc2ff', 電: '#ffd23d', 機械: '#a3b1c2', 地面: '#c99a5b', 普通: '#c4c4c4', 冰: '#94e8ff',
  超能: '#d77bff', 戰鬥: '#ff5a4a', 光: '#fff07a', 暗影: '#9177ff', 神祕: '#b878ff', 神秘: '#b878ff', 龍: '#6a86ff', 聖靈: '#ffdc8f', 次元: '#73dcff',
  遠古: '#d2b075', 邪靈: '#a656e0', 自然: '#74db93', 王: '#ffd24f', 混沌: '#c957ff', 神靈: '#fff4b8', 輪迴: '#ffa3d9', 蟲: '#b0dc55', 虛空: '#8585ff',
};
export function typeAccent(type: string): string {
  if (!type || /無屬性|^屬性$/.test(type)) return '#6b7480';
  let first = '';
  try { first = splitTypes(type)[0] || ''; } catch { first = ''; }
  return TYPE_COLORS[first] || TYPE_COLORS[type.replace(/系$/, '')] || '#8a939e';
}

/** 戰術風第五技能背景飾：分段弧＋刻度環＋三角＋點陣（純裝飾、靜態，不攔截點擊）。其他外觀以 CSS 隱藏。 */
export function FifthDeco() {
  const arcs = [[-150, -95], [-80, -10], [10, 60], [80, 150]];
  const R = 104;
  const pt = (deg: number, r: number) => [95 + r * Math.cos((deg * Math.PI) / 180), 95 + r * Math.sin((deg * Math.PI) / 180)];
  return <svg className="btg-deco btg-deco-fifth" viewBox="-30 -30 250 250" aria-hidden="true">
    {arcs.map(([a, b], i) => { const [x1, y1] = pt(a, R), [x2, y2] = pt(b, R); return <path key={i} d={`M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}`} fill="none" stroke="var(--t-acc)" strokeWidth={i % 2 ? 1 : 3} opacity={i % 2 ? .5 : .85} />; })}
    {Array.from({ length: 36 }, (_, i) => { const d = i * 10, [x1, y1] = pt(d, 114), [x2, y2] = pt(d, i % 3 ? 117 : 121); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--t-line-strong)" strokeWidth="1" />; })}
    <path d="M-18 172 L10 172 L-4 148 Z" fill="var(--t-acc)" opacity=".9" />
    <path d="M196 4 L214 4 L205 -12 Z" fill="none" stroke="var(--t-acc)" strokeWidth="1.5" />
    {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={188 + (i % 4) * 7} cy={168 + Math.floor(i / 4) * 7} r="1.4" fill="var(--t-line-strong)" />)}
  </svg>;
}

/** 第五技能名稱斷行：有「·」從間隔號斷；≤4 字單行；其餘對半。 */
export function splitFifthName(name: string): string {
  if (!name) return '';
  const dot = name.search(/[·・‧]/);
  if (dot > 0 && dot < name.length - 1) return `${name.slice(0, dot)}\n${name.slice(dot + 1)}`;
  if (name.length <= 4) return name;
  const half = Math.ceil(name.length / 2);
  return `${name.slice(0, half)}\n${name.slice(half)}`;
}
/** 斷行後的各行；間隔號保留在文字內容（讀屏、搜尋、比對名稱都用完整名稱），畫面上隱藏。 */
export function fifthNameLines(name: string): { text: string; sep?: string }[] {
  if (!name) return [{ text: '' }];
  const dot = name.search(/[·・‧]/);
  if (dot > 0 && dot < name.length - 1) return [{ text: name.slice(0, dot), sep: name[dot] }, { text: name.slice(dot + 1) }];
  return splitFifthName(name).split('\n').map(text => ({ text }));
}
export function fifthNameSize(name: string): string {
  const n = (name || '').replace(/[·・‧]/g, '').length;
  return n <= 4 ? '1.45rem' : n <= 6 ? '1.25rem' : n <= 8 ? '1.1rem' : '.95rem';
}

export interface FifthMedallionProps {
  name: string;
  type: string;
  ppText: React.ReactNode;
  powerText: string;
  ppFrac: number;
  selected?: boolean;
  disabled?: boolean;
  abolished?: boolean;
  empty?: boolean;
  /** 轉化（幻化）時顯示原技能名 */
  originalName?: string;
  tag?: { text: string; color: string } | null;
  runeBadge?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: () => void;
  title?: string;
  className?: string;
}

/** 第五技能圓章：外圈弧＝剩餘 PP；轉化時改冷色，廢除蓋章。 */
export function FifthMedallion(p: FifthMedallionProps) {
  const R = 85, C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, p.ppFrac || 0));
  const conv = !!p.originalName;
  const gid = React.useId().replace(/:/g, '');
  return <button type="button" className={`btg-fifth ${p.className || ''}`} data-fifth-skill data-disabled={p.disabled} data-abolished={p.abolished} data-empty={p.empty}
    aria-disabled={p.disabled} title={p.title} onClick={p.onClick} onMouseEnter={p.onMouseEnter} onMouseLeave={p.onMouseLeave}>
    <FifthDeco />
    <svg viewBox="0 0 190 190" aria-hidden="true">
      <defs>
        <radialGradient id={`f${gid}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={conv ? '#bfeaff' : 'var(--g-fifth-hi)'} />
          <stop offset="100%" stopColor={conv ? '#2f86b8' : 'var(--g-fifth-lo)'} />
        </radialGradient>
      </defs>
      <circle cx="95" cy="95" r="91" fill="rgba(6,10,20,.85)" stroke={p.selected ? '#ffe7a0' : 'transparent'} strokeWidth={p.selected ? 5 : 0} />
      <circle cx="95" cy="95" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
      <circle cx="95" cy="95" r={R} fill="none" stroke={conv ? '#7fd8ff' : 'var(--g-fifth-ring)'} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(C * frac).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 95 95)" />
      <circle cx="95" cy="95" r="75" fill={`url(#f${gid})`} />
      <circle cx="95" cy="95" r="75" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
    </svg>
    <span className="face">
      {conv && <span className="text-[11px] font-bold opacity-85 max-w-[7.5rem] truncate">原 {p.originalName}</span>}
      <TypeSlot type={p.type} size={26} />
      <span className="nm" style={{ fontSize: fifthNameSize(p.name) }}>{fifthNameLines(p.name).map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{line.text}{line.sep && <span className="sr-only">{line.sep}</span>}</React.Fragment>)}</span>
      <span className="flex items-center gap-2 text-[12px] font-black tabular-nums whitespace-nowrap [&_.gap-x-2]:gap-x-1">{p.ppText}<span>{p.powerText}</span></span>
    </span>
    <span className="tag5">第五</span>
    {p.runeBadge}
    {p.tag && <span className="btg-tag" style={{ left: '50%', top: 'auto', bottom: '-.3rem', transform: 'translateX(-50%)', background: p.tag.color }}>{p.tag.text}</span>}
    {p.abolished && <span className="btg-stamp">已廢除</span>}
  </button>;
}
