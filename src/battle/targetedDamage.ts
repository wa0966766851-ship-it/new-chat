import type { SharedContextDeps } from './contextBuilders';
import { buildDamageAPIs } from './contextBuilders';
import type { BattleState } from '../components/BattleManager';
import type { BattleEventContext } from '../effects/types';
import { isTeamRegistryKey } from './stateScopes';

/** 用同一傷害管線投影指定持有者，僅讀取投影、不改在場指標。 */
export function targetedDamageAPI(shared: SharedContextDeps): NonNullable<BattleEventContext['applyDamageToElf']> {
  return (side, id, amount, type, opts) => {
    const find = () => shared.syncStateRef.current[`${side}Team`].find(e => (e.battleId || e.id) === id);
    const target = find();
    if (!target) return 0;
    const projected = {
      get current(): BattleState {
        const c = shared.syncStateRef.current;
        const e = find() || target;
        if ((c[side].battleId || c[side].id) === id) return c;
        const bank = c[`${side}ElfState`]?.[id];
        const teamKeys = Object.fromEntries(Object.entries(c[`${side}RegistryState`] || {}).filter(([key]) => isTeamRegistryKey(key)));
        return { ...c, [side]: e, [`${side}ActiveIndex`]: c[`${side}Team`].indexOf(e),
          [`${side}Timers`]: [...(c[`${side}Timers`] || []).filter(t => t.scope === 'team'), ...(bank?.timers || [])],
          [`${side}RegistryState`]: { ...teamKeys, ...(bank?.registry || {}) } };
      },
    };
    const api = buildDamageAPIs({ ...shared, syncStateRef: projected,
      pushEffect: effect => shared.pushEffect(effect.type === 'damage' ? { ...effect,
        data: { ...effect.data, targetId: id, reaction: opts?.reaction,
          onSettled: receipt => { effect.data.onSettled?.(receipt); opts?.onSettled?.(receipt); } } } : effect),
      getBattleEventContext: (owner, hit, move, self, entrance) => {
        const ctx = shared.getBattleEventContext(owner, hit, move, self || (owner === side ? find() : undefined), entrance);
        if (owner !== side) Object.defineProperty(ctx, 'target', { configurable: true, enumerable: true, get: find });
        Object.defineProperty(ctx, `${side}Timers`, { configurable: true, enumerable: true, get: () => projected.current[`${side}Timers`] });
        return ctx;
      },
    });
    if (type === 'true') return api.applyTrueDamage(side, amount, opts?.label);
    if (type === 'fixed' || type === 'percent') return api.applyPinkDamage(side, amount, opts?.label, undefined, undefined, type);
    return api.applySkillTypeDamage(side, amount, opts?.label, { elem: opts?.elem,
      category: type === 'skill_extra_action' ? type : 'skill_attribute' });
  };
}
