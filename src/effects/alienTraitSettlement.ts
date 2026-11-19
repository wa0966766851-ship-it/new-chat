import type { BattleState } from '../components/BattleManager';
import type { Elf } from '../types';
import type { SettlementReceipt } from '../battle/settlementReceipt';
import { isNonTrueDamageType } from '../battle/damageSemantics';
import { readScopedRegistry, scopedTimers } from '../battle/stateScopes';
import { stageTimerBlocksOperation } from './stageProtection';
import { traitNames } from './traitEffects';
import type { BattleEventContext } from './types';

type Side = 'p1' | 'p2';

/** 從傷害回執確認傷害類型及來源，讓附加傷害也能觸發淨化。 */
export function settleOutgoingTraitDamage(
  state: BattleState,
  sourceSide: Side | undefined, sourceId: string | undefined, targetSide: Side, target: Elf,
  receipt: SettlementReceipt, contextFor: (side: Side, elf: Elf) => BattleEventContext,
) {
  if (!sourceSide || !sourceId || sourceSide === targetSide || !isNonTrueDamageType(receipt.damageType || '')
    || receipt.hpLost + receipt.shieldAbsorbed + receipt.barrierAbsorbed <= 0
    || !Object.values(target.statStages || {}).some(value => value > 0)) return;
  const active = state[sourceSide];
  const source = (active.battleId || active.id) === sourceId ? active
    : state[`${sourceSide}Team`].find(elf => (elf.battleId || elf.id) === sourceId);
  if (!source || !traitNames(source).includes('淨化')) return;
  const targetId = target.battleId || target.id;
  if (Number(readScopedRegistry(state, targetSide, target, 'statBoostUnclearableTurns')) > 0
    || stageTimerBlocksOperation(scopedTimers(state, targetSide, target), targetId, 1, 'clear')) return;
  const ctx = contextFor(sourceSide, source);
  const statStages = { ...target.statStages };
  for (const key in statStages) if (statStages[key] > 0) statStages[key] = 0;
  ctx.updateElf(targetSide, { battleId: target.battleId, id: target.id, statStages });
  ctx.addLog('✨ 【淨化】：消除了對手的能力提升狀態！', 'status');
}
