// 持續恢復藥劑（2026-11-07）：每回合結束對指定對象恢復體力／PP；使用當下處於藥劑反噬則反轉為藥劑反噬傷害／扣 PP。
// 對象：active＝在場精靈、bench＝不在場（背包待命，非額外）、extra＝額外精靈。消逝或已倒下者不受影響。
import type { BattleEventContext } from '../effects/types';
import type { Elf } from '../types';
import { changePp, identity } from '../effects/newElfOperations';
import { getMaxPp } from '../utils/battleHelpers';

export type RegenTarget = 'active' | 'bench' | 'extra';
export interface PotionRegenParams {
  hp?: number; hpPercent?: number; pp?: number; ppPercent?: number;
  targets: RegenTarget[]; inverted?: boolean; label?: string;
}
export const REGEN_TARGET_LABEL: Record<RegenTarget, string> = { active: '在場', bench: '不在場', extra: '額外' };
/** 百分比上限與一般百分比藥劑相同（30%）。 */
const cap = (n: unknown) => Math.max(0, Math.min(30, Number(n) || 0));
export const regenTargetText = (targets: RegenTarget[]) => targets.map(t => REGEN_TARGET_LABEL[t]).join('＋') + '精靈';

export function regenParamIssue(p: any): string | null {
  if (!p || !Array.isArray(p.targets) || !p.targets.length || p.targets.some((t: unknown) => !['active', 'bench', 'extra'].includes(t as string))) return '持續恢復需指定對象（在場／不在場／額外）';
  for (const k of ['hp', 'pp']) if (p[k] !== undefined && !(Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1e6)) return '持續恢復數值不合法';
  for (const k of ['hpPercent', 'ppPercent']) if (p[k] !== undefined && !(Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 30)) return '持續恢復百分比需在 0–30';
  if (!((p.hp || 0) > 0 || (p.hpPercent || 0) > 0 || (p.pp || 0) > 0 || (p.ppPercent || 0) > 0)) return '持續恢復需有體力或 PP 數值';
  return null;
}

export function regenTargetsOf(ctx: BattleEventContext, side: 'p1' | 'p2', targets: RegenTarget[]): Elf[] {
  const active = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
  const activeId = active ? identity(active) : '';
  return ctx.getFullTeam(side).filter(e => {
    if (!e || e.isVanished || !(e.maxHp > 0) || !(e.currentHp > 0)) return false;
    if (identity(e) === activeId) return targets.includes('active');
    return e.isExtra ? targets.includes('extra') : targets.includes('bench');
  });
}

/** 結算一次（一個回合結束）。回傳是否有任何對象受影響。 */
export function tickPotionRegen(ctx: BattleEventContext, side: 'p1' | 'p2', p: PotionRegenParams): boolean {
  const list = regenTargetsOf(ctx, side, p.targets);
  if (!list.length) return false;
  const active = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
  const label = p.label || '持續恢復藥劑';
  for (const elf of list) {
    const hp = Math.floor((p.hp || 0) + (p.hpPercent ? elf.maxHp * cap(p.hpPercent) / 100 : 0));
    if (hp > 0) {
      if (p.inverted) ctx.applyPotionBacklashDamage?.(side, hp, `${label}・藥劑反噬`, identity(elf));
      else if (active && identity(elf) === identity(active)) ctx.applyHeal(side, hp, { isPotion: true, presentationPotion: true } as any);
      else ctx.applyHealToElf?.(side, identity(elf), hp, { isPotion: true, presentationPotion: true } as any);
    }
    if ((p.pp || 0) > 0 || (p.ppPercent || 0) > 0) {
      const amount = (s: any) => (p.pp || 0) + (p.ppPercent ? Math.max(1, Math.ceil(getMaxPp(s, elf) * cap(p.ppPercent) / 100)) : 0);
      if (p.inverted) changePp(ctx, side, elf, s => Math.max(0, s.pp - amount(s)));
      else changePp(ctx, side, elf, s => Math.min(getMaxPp(s, elf), s.pp + amount(s)), true);
    }
  }
  ctx.addLog(`🧪 【${label}】${p.inverted ? '（藥劑反噬）' : ''}：${regenTargetText(p.targets)}${p.inverted ? '受到反噬' : '持續恢復'}。`, 'effect');
  return true;
}
