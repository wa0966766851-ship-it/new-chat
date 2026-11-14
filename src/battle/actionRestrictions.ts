import type { Elf } from '../types';
import type { Timer } from './timers';
import { getEffectiveStatuses, getNoSwitchTurns, isElfItemDisabled, isElfSwitchDisabled,BATTLE_ITEMS } from '../utils/battleHelpers';
import { hasPortableDuel } from './portableSkillMarks';
import { StatusRegistry } from '../effects/statusRegistry';

/**
 * 行動限制統一查詢（2026-11-07）：切換精靈、使用藥劑、藥劑反噬。
 * 引擎、AI 與畫面讀同一份結果，不再各自判斷（過去畫面沒看計時器的「無法切換」，會顯示可換但實際被擋）。
 *
 * 作用域：
 * - 'elf'：限制綁在目前在場的那一隻（例：癱瘓、個體鎖切換、繳械）。換下場（若可）即不再適用。
 * - 'team'：限制整個陣營（例：「對手無法主動切換精靈 N 回合」、陣營計時器）。換誰上場都一樣。
 */
export type RestrictionScope = 'elf' | 'team';
export interface ActionRestriction {
  /** 畫面顯示的原因（精簡）。 */
  reason: string;
  scope: RestrictionScope;
  /** 剩餘回合；不限或未知為 undefined。 */
  turns?: number;
  /** 來源（技能／魂印／狀態名），提示用。 */
  source?: string;
}
type Side = 'p1' | 'p2';

const elfId = (elf: any) => String(elf?.battleId || elf?.id || '');
/** 目前對該精靈有效的計時器（陣營＋個體）；與 activeConstraints 相同的有效規則，但保留計時器本身以取得回合與來源。 */
export function liveTimers(state: any, side: Side, elf?: Elf): Timer[] {
  const owner = elf || state?.[side];
  const own = elfId(owner);
  const pool: Timer[] = [...(state?.[`${side}Timers`] || [])];
  const banked = state?.[`${side}ElfState`]?.[own]?.timers;
  if (Array.isArray(banked)) for (const t of banked) if (!pool.some(p => p.id === t.id && (p as any).ownerBattleId === (t as any).ownerBattleId)) pool.push(t);
  return pool.filter((t: any) => t && t.remaining > 0 && !t.pendingActivation && (t.scope === 'team' || !t.ownerBattleId || t.ownerBattleId === own));
}
/** 計時器 payload 讀取：積木計時器包在 payload.block 內。 */
const flag = (t: any, key: string) => t?.payload?.[key] === true || t?.payload?.block?.[key] === true;
const timerScope = (t: any): RestrictionScope => (t.scope === 'team' ? 'team' : 'elf');
const timerSource = (t: any): string | undefined => t?.origin?.skillName || t?.origin?.sourceName || t?.payload?.block?.src || undefined;
const statusTurns = (elf: any, names: string[]) => Math.max(0, ...names.map(n => Number(getEffectiveStatuses(elf)[n] || 0)));

/** 切換精靈限制。forcedReplace＝陣亡後強制換人：不受任何「無法切換」影響。 */
export function switchRestrictions(state: any, side: Side, opts: { forcedReplace?: boolean } = {}): { blocked: boolean; list: ActionRestriction[] } {
  const elf = state?.[side];
  const opp = state?.[side === 'p1' ? 'p2' : 'p1'];
  if (!elf || opts.forcedReplace) return { blocked: false, list: [] };
  const list: ActionRestriction[] = [];
  if (hasPortableDuel(elf, opp)) list.push({ reason: '決鬥中無法切換', scope: 'elf' });
  const teamTurns = getNoSwitchTurns(state, side);
  if (teamTurns > 0) list.push({ reason: '無法主動切換精靈', scope: 'team', turns: teamTurns });
  if ((elf.odinNoSwitch2Turns || 0) > 0) list.push({ reason: '無法主動切換精靈', scope: 'elf', turns: elf.odinNoSwitch2Turns, source: '奧丁' });
  const statuses = getEffectiveStatuses(elf);
  for (const [name, turns] of Object.entries(statuses)) {
    if (!(Number(turns) > 0)) continue;
    const entry = (StatusRegistry as any)[name];
    if (name === '癱瘓' || name === 'paralyzed_lock' || entry?.mechanics?.some((m: any) => m.type === 'CANT_SWITCH'))
      list.push({ reason: `${entry?.name || name}：無法切換`, scope: 'elf', turns: Number(turns) < 99 ? Number(turns) : undefined, source: entry?.name || name });
  }
  if (elf.battleStatus === '癱瘓' || elf.battleStatus === 'paralyzed_lock') if (!list.some(r => r.source === '癱瘓')) list.push({ reason: '癱瘓：無法切換', scope: 'elf', source: '癱瘓' });
  for (const t of liveTimers(state, side, elf)) if (flag(t, 'lockSwitch'))
    list.push({ reason: timerScope(t) === 'team' ? '全隊無法主動切換' : '無法主動切換精靈', scope: timerScope(t), turns: t.remaining, source: timerSource(t) });
  // 舊判斷的其他來源（例如新登記的狀態）仍以 isElfSwitchDisabled 為最終保險，避免漏判。
  if (!list.length && isElfSwitchDisabled(elf, opp, false, teamTurns)) list.push({ reason: '無法切換精靈', scope: 'elf' });
  return { blocked: list.length > 0, list };
}

/** 是否處於「藥劑反噬」：計時器 potionBacklash（積木／效果施加）或舊欄位 potionBacklashTurns。 */
export function potionBacklash(state: any, side: Side, elf?: Elf): ActionRestriction | null {
  const owner: any = elf || state?.[side];
  if (!owner) return null;
  const held=BATTLE_ITEMS.find(item=>item.potionBacklashWhileHeld&&(state?.[side+'ItemInventory']?.[item.id]?.left||0)>0);
  if(held)return {reason:'藥劑反噬',scope:'team',source:held.name};
  for (const t of liveTimers(state, side, owner)) if (flag(t, 'potionBacklash'))
    return { reason: '藥劑反噬', scope: timerScope(t), turns: t.remaining, source: timerSource(t) };
  const legacy = Number(owner.potionBacklashTurns || 0);
  return legacy > 0 ? { reason: '藥劑反噬', scope: 'elf', turns: legacy } : null;
}

/** 使用藥劑限制；藥劑反噬不禁止使用，只把效果反轉（另列於 backlash）。 */
export function itemRestrictions(state: any, side: Side, elf?: Elf): { blocked: boolean; list: ActionRestriction[]; backlash: ActionRestriction | null } {
  const owner: any = elf || state?.[side];
  if (!owner) return { blocked: false, list: [], backlash: null };
  const list: ActionRestriction[] = [];
  const statuses = getEffectiveStatuses(owner);
  for (const [name, turns] of Object.entries(statuses)) {
    if (!(Number(turns) > 0)) continue;
    const entry = (StatusRegistry as any)[name];
    if (name === '繳械' || name === '失溫' || entry?.mechanics?.some((m: any) => m.type === 'MODIFIER_LIMIT' && m.params?.disablePotions))
      list.push({ reason: `${entry?.name || name}：無法使用藥劑`, scope: 'elf', turns: Number(turns) < 99 ? Number(turns) : undefined, source: entry?.name || name });
  }
  const reg = state?.[`${side}RegistryState`] || {};
  const teamTurns = Math.max(Number(reg.noItemTurns || 0), Number(reg[`${side}_noItemTurns`] || 0));
  if (teamTurns > 0) list.push({ reason: '無法使用藥劑', scope: 'team', turns: teamTurns });
  for (const t of liveTimers(state, side, owner)) if (flag(t, 'noItem'))
    list.push({ reason: timerScope(t) === 'team' ? '全隊無法使用藥劑' : '無法使用藥劑', scope: timerScope(t), turns: t.remaining, source: timerSource(t) });
  if (!list.length && isElfItemDisabled(owner)) list.push({ reason: '無法使用藥劑', scope: 'elf' });
  return { blocked: list.length > 0, list, backlash: potionBacklash(state, side, owner) };
}

/** 限制的簡短文字：「原因（N回合）」；陣營範圍加「全隊」前綴（原因已含者不重複）。 */
export function restrictionText(r: ActionRestriction): string {
  const base = r.scope === 'team' && !/全隊/.test(r.reason) ? `全隊${r.reason}` : r.reason;
  return r.turns ? `${base}（${r.turns}回合）` : base;
}
