import type { Elf } from '../types';
import type { BattleEventContext } from '../effects/types';
import { godDescentFloor, type DamageTransition } from './survivalRules';

/**
 * 致死保留窗口（2026-11-21 使用者規則，全精靈共用）：
 * - 「致死時強制存活並保留體力」類效果（不是重生）一旦觸發，直到當回合結束，持有者每次受到致死傷害都不會死亡，
 *   體力保留為觸發當下保留的數值；同回合後續的致死傷害不再重跑效果，也不再消耗次數。
 * - 效果本身的次數於觸發時記一次，視為在回合結束扣減點消耗；窗口以回合數判定，跨回合自動失效、下場後保留。
 * - 重生不開窗口。保留體力值可以高於受擊前的體力，例如頑強保留 2 點。
 */
export interface FatalHold { round: number; hp: number }
const fatalResult = Symbol('fatal result');
type FatalContext = BattleEventContext & { [fatalResult]?: { kind?: 'hold' | 'rebirth' } };
export function reportFatalResult(ctx: BattleEventContext, kind: 'hold' | 'rebirth') {
  const result = (ctx as FatalContext)[fatalResult];
  if (result) result.kind = kind;
}

const identity = (elf: Elf | undefined | null) => String(elf?.battleId || elf?.id || '');

export function fatalHoldActive(elf: Elf | undefined | null, round: number): boolean {
  const hold = (elf as any)?.fatalHold as FatalHold | undefined;
  return !!hold && hold.round === round && hold.hp > 0;
}

/** 本回合已開窗：直接保留體力（不跑抵抗效果）。回傳保留後的體力。 */
export function holdFatal(ctx: BattleEventContext, side: 'p1' | 'p2', elf: Elf): number {
  const hold = (elf as any).fatalHold as FatalHold;
  const hp = Math.max(1, Math.min(hold.hp, elf.maxHp));
  ctx.updateAnyElf(side, identity(elf), { currentHp: hp } as any);
  ctx.addLog(`🛡️ 【${elf.name}】致死保留：本回合每次受到致死傷害皆保留 ${hp} 點體力。`, 'effect');
  return hp;
}

/**
 * 致死抵抗統一入口：先看本回合窗口，再跑抵抗效果；抵抗成功且結果為體力保留時開啟本回合窗口。
 * live() 讀抵抗後的即時精靈（效果可能已改寫體力）。
 */
export function resolveFatalResist(ctx: BattleEventContext, side: 'p1' | 'p2', elf: Elf, hpBefore: number, round: number,
  run: () => boolean, live: () => Elf | undefined): boolean {
  if (fatalHoldActive(elf, round)) { holdFatal(ctx, side, elf); return true; }
  // 封印（seal_fatal_resist）：已用掉本場唯一一次後，致死保留類效果不再觸發；重生不受影響。
  const seal = (elf as any).fatalResistSeal as FatalResistSeal | undefined;
  const result: NonNullable<FatalContext[typeof fatalResult]> = {};
  const frame = ctx as FatalContext;
  const previous = frame[fatalResult];
  frame[fatalResult] = result;
  try { if (!run()) return false; }
  finally { if (previous) frame[fatalResult] = previous; else delete frame[fatalResult]; }
  const after = live();
  const hp = Number(after?.currentHp);
  if (!after || after.isVanished || !(hp > 0)) return true;
  const holds = result.kind === 'hold' || (result.kind !== 'rebirth'
    && (hp === 1 || (hp < after.maxHp && hp <= hpBefore)));
  if (holds && seal === 'spent') {
    ctx.updateAnyElf(side, identity(after!), { currentHp: godDescentFloor(sealedSurvivalRule(elf), elf.maxHp) });
    ctx.addLog(`⛓️ 【${elf.name}】的致死保留已在本場用過一次，無法再觸發！`, 'effect');
    return false;
  }
  if (holds) ctx.updateAnyElf(side, identity(after!), { fatalHold: { round, hp }, ...(seal === 'armed' ? { fatalResistSeal: 'pending' } : {}) } as any);
  return true;
}

/**
 * 致死保留封印（seal_fatal_resist，2026-11-21 使用者規則：涵蓋任意 BOSS 類與所有同類效果）：
 * armed＝待觸發；pending＝本回合已觸發（本回合窗口照常保留）；spent＝回合結束後定案，本場任何「致死不倒下」類效果都不再成立：
 * 魂印／特性／BOSS 特性的致死抵抗（resolveFatalResist）、0 體力存活規則（survivalRule）、免死回合（deathImmuneTurns）。
 * 有明確死亡線的負體力規則依自身死亡線結算。
 * 重生不受影響。
 */
export type FatalResistSeal = 'armed' | 'pending' | 'spent';
export const FATAL_SEAL_MARK_ID = 'fatal_resist_seal';
export const FATAL_SEAL_DESCRIPTION = '下次觸發致死保留或非正體力存活時，效果持續至該回合結束。本場戰鬥此後無法再觸發同類效果。既有負體力死亡線保留；此後新的致死保留仍受封印。';
export const FATAL_SEAL_PHASE_LABEL: Record<FatalResistSeal, string> = {
  armed: '待觸發', pending: '本回合已觸發', spent: '本場已封印',
};
export const fatalSealSpent = (elf: Elf | undefined | null) => elf?.fatalResistSeal === 'spent';

/** 有明確負體力死亡線的規則仍須結算到該死亡線。 */
export const hasNegativeDeathLine = (elf: Elf) => godDescentFloor(elf.survivalRule, elf.maxHp) < 0;
export const sealedSurvivalRule = (elf: Elf) => fatalSealSpent(elf) && !hasNegativeDeathLine(elf) ? undefined : elf.survivalRule;

export function fatalSealTriggeredByDamage(elf: Elf, outcome: DamageTransition, deathImmune: boolean): boolean {
  if (elf.fatalResistSeal !== 'armed') return false;
  if (!outcome.alive) return deathImmune;
  return outcome.hp <= 0;
}
/** 非 resolveFatalResist 的存活（存活規則、免死回合）救下 armed 持有者：本回合記為觸發。 */
export function markFatalSealTriggered(ctx: BattleEventContext, side: 'p1' | 'p2', elf: Elf): void {
  if ((elf as any).fatalResistSeal !== 'armed') return;
  ctx.updateAnyElf(side, identity(elf), { fatalResistSeal: 'pending' } as any);
}
/** 回合結束：本回合觸發過的封印定案。 */
export const settleFatalSeal = <T extends Elf>(elf: T): T => (elf as any)?.fatalResistSeal === 'pending' ? { ...elf, fatalResistSeal: 'spent' } : elf;
