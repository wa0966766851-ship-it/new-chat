import type { Elf } from '../../types';
import type { BattleState } from '../../components/BattleManager';
import { findBagElf, correspondingBagElf } from '../bagTargets';
import { ILLUSION_OVERRIDE_KEY } from '../illusion';
import { checkElfDead } from '../elfAlive';
import { opposite, type AISide, type PlannedAction } from './types';
import { BATTLE_ITEMS } from '../../utils/battleHelpers';
import { soulDefinition } from '../../effects/soulDefinitionSource';

function illusionPicks(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  if (object.op === 'illusion_start') return [String((object.p as any)?.pick || 'opp_active')];
  return Object.values(object).flatMap(illusionPicks);
}
// 長期啟發分，僅比較複製面板及技能的潛力；實際幻化與戰鬥仍由引擎推演。
function potential(elf: Elf): number {
  // 待命背包仍可能帶原始快照；隱匿者一律同一中性估計，不讀其秘密能力或技能。
  if(elf.isConcealed)return 14.5;
  const stats = elf.calculatedStats;
  const panel = stats ? Object.values(stats).reduce((n,v) => n + Math.max(0, Number(v) || 0), 0) / 150 : 0;
  const attack = Math.max(0, ...elf.skills.filter(s => !s.isAbolished).map(s => Number(s.power) || 0)) / 20;
  return Math.min(100, panel + attack);
}
/** 只替仍有幻化積木的存活隊員估值；尚未執行的指定不等於已取得幻化。 */
export function illusionOverrideValue(state: BattleState, side: AISide, pick?: {side: AISide; battleId: string}): number {
  if (!pick) return 0;
  const teams = {p1: state.p1Team.map((e,i) => i === state.p1ActiveIndex ? state.p1 : e),
    p2: state.p2Team.map((e,i) => i === state.p2ActiveIndex ? state.p2 : e)};
  const target = findBagElf(teams, pick.side, pick.battleId);
  if (!target || target.isVanished) return 0;
  let best = 0;
  for (const elf of teams[side]) {
    if (checkElfDead(elf) || (elf.battleId || elf.id) === (target.battleId || target.id) && side === pick.side) continue;
    const kits = [soulDefinition(elf).kit, elf.trait?.kit, elf.alienTraits?.gen2Trait?.kit,
      elf.alienTraits?.exclusiveTrait?.kit, ...elf.alienTraits?.exclusiveTraits?.map(t => t.kit) || [], ...elf.skills.map(s => s.kit)];
    for (const mode of illusionPicks(kits)) {
      const normal = mode === 'paired_initial' ? correspondingBagElf(teams[side], elf) : state[opposite(side)];
      const gain = potential(target) - (normal ? potential(normal) : 0);
      best = Math.max(best, Math.min(35, gain) * (elf === state[side] ? 1 : 0.5));
    }
  }
  return best;
}
export function pendingIllusionValue(state: BattleState, side: AISide): number {
  return illusionOverrideValue(state, side, state[`${side}RegistryState`]?.[ILLUSION_OVERRIDE_KEY]);
}
export function illusionItemAdjustment(state: BattleState, side: AISide, action: PlannedAction): number {
  if (action.kind !== 'item' || !action.picked || BATTLE_ITEMS.find(i => i.id === action.id)?.effect !== 'set_illusion_target') return 0;
  return illusionOverrideValue(state, side, action.picked) - pendingIllusionValue(state, side);
}
