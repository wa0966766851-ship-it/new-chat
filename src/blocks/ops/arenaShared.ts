// 競技場通用件（legacyWrapped 拆解；DSH 20261017 第十批）。
// fifthPpDiff：自身第五技能目前 PP − 對手第五技能目前 PP（下限 0）——「每多 1 點」句式基準。
// arenaDrainAmount：drain 擴充（每級自身能力下降吸取／PP差翻倍）。
import type { BattleEventContext } from '../../effects/types';

const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 第五技能 PP 差（自身−對手；無第五技能＝0）。 */
export function fifthPpDiff(ctx: BattleEventContext): number {
  const fifthOf = (elf: any) => {
    const skill = (elf?.skills || []).find((s: any) => s.isFifthSkill);
    return Math.max(0, Number(skill?.currentPp ?? skill?.pp ?? 0) || 0);
  };
  const self = (ctx as any).self ?? ((ctx as any).actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
  const opp = (ctx as any).target ?? ((ctx as any).targetSide === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
  return Math.max(0, fifthOf(self) - fifthOf(opp));
}

/** drain 擴充：每級自身能力下降／PP差翻倍。由 runtime drain 呼叫。 */
export function arenaDrainAmount(ctx: BattleEventContext, p: any, baseAmt: number): number {
  let amt = baseAmt;
  if (p.perStageDown) {
    const self = (ctx as any).self ?? ((ctx as any).actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
    const stages: Record<string, number> = self?.statStages || {};
    const dropLevels = Object.values(stages).reduce((n: number, v: any) => n + Math.max(0, -Number(v || 0)), 0);
    amt = Math.floor((p.perStageDown.amount ?? 0) * dropLevels);
    if (p.perStageDown.doubleOnOppBoost) {
      const opp = (ctx as any).target ?? ((ctx as any).targetSide === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
      const ostages: Record<string, number> = opp?.statStages || {};
      if (Object.values(ostages).some(v => Number(v || 0) > 0)) amt *= 2;
    }
  }
  if (p.ppDiffDouble && fifthPpDiff(ctx) > 3) amt *= 2;
  return amt;
}
