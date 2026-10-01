import { sameStatus } from './statusIdentity';
import { normalizeElfSearch } from '../utils/elfSearch';

/** 戰鬥條件不是模糊名稱搜尋：單屬性可命中雙屬性的一項，雙屬性必須完整相同。 */
export function matchesConditionType(actual: unknown, required: unknown): boolean {
  if (typeof actual !== 'string' || typeof required !== 'string' || !required.trim()) return false;
  const split = (value: string) => value.split(/[.·・‧。/／＋+\s_-]+/).filter(Boolean).map(normalizeElfSearch).sort();
  const a = split(actual), r = split(required);
  return normalizeElfSearch(actual) === normalizeElfSearch(required) ||
    (r.length === 1 ? a.includes(r[0]) : a.length === r.length && a.every((v, i) => v === r[i]));
}

/** 缺少快照或出手順序時不推定條件成立；直接原子與持續閘門共用。 */
export function matchesEffectConditions(p: Record<string, any>, ctx: any): boolean {
  const actor = ctx.actor || 'p1';
  const self = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
  const opponent = actor === 'p1' ? ctx.activeP2 : ctx.activeP1;
  if (p.hp_below !== undefined || p.hp_above !== undefined) {
    if (!self || !Number.isFinite(self.currentHp) || !Number.isFinite(self.maxHp) || self.maxHp <= 0) return false;
    const ratio = self.currentHp / self.maxHp;
    if (p.hp_below !== undefined && !(ratio < Number(p.hp_below))) return false;
    if (p.hp_above !== undefined && !(ratio > Number(p.hp_above))) return false;
  }
  if (p.has_shield !== undefined && (!self || (Number(self.shield) > 0) !== p.has_shield)) return false;
  if (p.is_gender !== undefined && (!self || (self.gender || 'none') !== p.is_gender)) return false;
  if (p.enemy_type !== undefined && !matchesConditionType(opponent?.type, p.enemy_type)) return false;
  if (p.layer_gte !== undefined) {
    if (!self || !p.timerId) return false;
    const list = ctx[`${actor}Timers`] || [];
    const timer = list.find((t: any) => t.id === p.timerId && t.remaining > 0 &&
      (t.scope === 'team' || !t.ownerBattleId || t.ownerBattleId === (self.battleId || self.id)));
    if (!timer || (timer.layers ?? 1) < Number(p.layer_gte)) return false;
  }
  if (p.has_status !== undefined) {
    if (!self || !ctx.getStatuses) return false;
    if (!Object.entries(ctx.getStatuses(self) || {}).some(([key, turns]) => Number(turns) > 0 && sameStatus(key, p.has_status))) return false;
  }
  const first = typeof ctx.goesFirst === 'boolean' ? ctx.goesFirst :
    ctx.moveIndex === 0 ? true : ctx.moveIndex === 1 ? false : undefined;
  if (p.is_first !== undefined && (first === undefined || first !== p.is_first)) return false;
  if (p.is_second !== undefined && (first === undefined || !first !== p.is_second)) return false;
  return true;
}
