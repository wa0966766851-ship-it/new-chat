import { damageScopeLabel } from '../effects/damageChoices';
import { applyActionDamageModifiers } from './actionDamageModifiers';
import type { BattleState, EffectItem } from '../components/BattleManager';
import type { DamageComputation } from '../effects/types';
import { matchesDamageTypes } from '../effects/damageChoices';
import { matchesEffectConditions } from '../effects/effectConditions';
import { normalizeBlockAtom, type RunnableAtom } from '../effects/blockParams';
import { getStatuses } from '../utils/battleHelpers';
import { getScaledParam } from './timers';

type Side = 'p1' | 'p2';
type ActionOrder = { side: Side; moveIndex?: number };

/** 只讀取條件與增減傷，不在傷害計算中執行回血／追加傷害，以免遞迴結算。 */
function visitModifiers(items: any[], ctx: any, visit: (atom: RunnableAtom) => void, depth = 0): void {
  if (depth > 12) return;
  for (const item of items) {
    if (!item || typeof item.atom !== 'string') continue;
    const atom = normalizeBlockAtom(item.atom, item.params || {});
    if (atom.atom !== 'condition_gate') { visit(atom); continue; }
    const p = atom.params;
    if (!matchesEffectConditions(p, ctx)) continue;
    if (Array.isArray(p.innerItems)) visitModifiers(p.innerItems, ctx, visit, depth + 1);
    else if (typeof p.inner === 'string') visitModifiers([{ atom: p.inner, params: { ...(p.innerParams || {}),
      ...(p.innerTarget !== undefined ? { target: p.innerTarget } : {}) } }], ctx, visit, depth + 1);
  }
}

export function applyActiveGateTimersToDamage(
  actorSide: Side, targetSide: Side, damageComp: DamageComputation,
  pushEffect: (effect: EffectItem) => void, syncStateRef: { current: BattleState }, order?: ActionOrder,
): void {
  if (damageComp.pure) return;
  const state = syncStateRef.current;
  applyActionDamageModifiers(state[`${actorSide}RegistryState`], damageComp);
  for (const owner of new Set([actorSide, targetSide])) {
    const self = state[owner];
    const timers = state[`${owner}Timers`] || [];
    const ownerIndex = order?.moveIndex === 0 || order?.moveIndex === 1
      ? order.side === owner ? order.moveIndex : 1 - order.moveIndex : undefined;
    const ctx = { actor: owner, activeP1: state.p1, activeP2: state.p2,
      p1Timers: state.p1Timers, p2Timers: state.p2Timers, getStatuses, moveIndex: ownerIndex };
    for (const timer of timers) {
      if (timer.scope !== 'team' && timer.ownerBattleId && timer.ownerBattleId !== (self.battleId || self.id)) continue;
      const p = timer.payload;
      if (timer.pendingActivation) continue;
      if (p?.applyMode !== 'gate' || timer.remaining <= 0) continue;
      if (typeof p.damageIncreasePercent === 'number' && owner === actorSide && matchesDamageTypes(p.damageTypes, damageComp.damageCategory)) {
        damageComp.increasePercent += p.damageIncreasePercent;
      }
      const items = Array.isArray(p.wrapItems) ? p.wrapItems :
        (Array.isArray(p.wraps) ? p.wraps : [p.wraps]).map(atom => ({ atom, params: p.params || {} }));
      visitModifiers(items, ctx, atom => {
        const params = atom.params;
        const subject = atom.target === 'opponent' ? owner === 'p1' ? 'p2' : 'p1' : owner;
        if (!matchesDamageTypes(params.damageTypes, damageComp.damageCategory)) return;
        const scaled = { ...timer, payload: { ...p, params } };
        if (atom.atom === 'damage_reduce' && subject === targetSide && damageComp.damageCategory !== 'true') {
          const value = getScaledParam(scaled, 'percent', params.amount ?? 50);
          damageComp.decreasePercent = (damageComp.decreasePercent ?? 0) + value / 100;
          pushEffect({ type: 'log', side: subject, data: { text: `🛡️ 【${timer.name}】：${params.damageTypes?.map(damageScopeLabel).join("／") || "傷害（舊範圍待核對）"}減少 ${value}%！`, type: 'effect' } });
        } else if (atom.atom === 'damage_multiplier' && subject === actorSide) {
          const value = getScaledParam(scaled, 'multiplier', params.value ?? 1.5);
          damageComp.multiplier = (damageComp.multiplier ?? 1) * value;
          pushEffect({ type: 'log', side: subject, data: { text: `🔥 【${timer.name}】：${params.damageTypes?.map(damageScopeLabel).join("／") || "傷害（舊範圍待核對）"}乘以 ${value} 倍！`, type: 'effect' } });
        }
      });
    }
  }
}
