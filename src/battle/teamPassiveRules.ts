// 隊伍被動規則（通用讀取端；DSH 2026-10-31，5041 魂印「山」首段使用，名稱不綁特定精靈）。
// 持有者位於出戰背包（存活）時，對「己方在場精靈」生效的護盾類規則。
// 規則由持有者的 Kit 寫入 elf.teamRules（blocks/ops/cassiusShan.ts team_rules），此處只負責讀取與結算。
import type { Elf } from '../types';
import { getMaxPp } from '../utils/battleHelpers';

export interface TeamPassiveRules {
  /** 攻擊傷害使護盾扣減時，扣減量乘以此比例（0.5＝減半）；護盾等效容量為 1/比例 倍。 */
  shieldDeductionRatio?: number;
  /** 超額非真實傷害（穿透護盾的部分）大於當前護盾 → 本次傷害無法造成；戰鬥階段結束再結算。 */
  excessIntercept?: boolean;
  /** 超額真實傷害大於當前護盾且致死 → 100% 重生（持有者僅 1 次）。 */
  excessTrueRebirth?: boolean;
}
declare module '../types' { interface Elf { teamRules?: TeamPassiveRules } }

const alive = (e: any) => !!e && !e.isVanished && !e.isExtra && Number(e.currentHp) > 0;
/** 隊伍被動的持有者判定：不看體力（持有者死亡後仍對隊友生效），只看是否仍在隊伍中。 */
const inTeam = (e: any) => !!e && !e.isVanished && !e.isExtra;
const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 隊伍內存活持有者的規則聯集（比例取最小者）。 */
export function teamRulesOf(team: readonly Elf[] | undefined): TeamPassiveRules & { holders: string[] } {
  const out: TeamPassiveRules & { holders: string[] } = { holders: [] };
  for (const e of team || []) {
    const r = inTeam(e) ? e.teamRules : undefined;
    if (!r) continue;
    out.holders.push(idOf(e));
    if (r.shieldDeductionRatio !== undefined && r.shieldDeductionRatio > 0 && r.shieldDeductionRatio < 1)
      out.shieldDeductionRatio = Math.min(out.shieldDeductionRatio ?? 1, r.shieldDeductionRatio);
    if (r.excessIntercept) out.excessIntercept = true;
    if (r.excessTrueRebirth) out.excessTrueRebirth = true;
  }
  return out;
}

/** 非真實傷害是否超額：本次傷害量高於該精靈當前護盾值（使用者 2026-11-01 確認；需持有護盾）。 */
export function isExcessNonTrue(amount: number, _category: string, shield: number, _barrier: number): boolean {
  return shield > 0 && amount > shield;
}

/** 重生：體力與全部技能 PP 重置為 100%。 */
export function rebirthPatch(elf: Elf): Partial<Elf> {
  return { currentHp: elf.maxHp, skills: (elf.skills || []).map(s => ({ ...s, pp: getMaxPp(s, elf) })) } as Partial<Elf>;
}

/** 超額真實傷害且致死：真實傷害不被護盾吸收，穿透量即全額；需大於當前護盾。 */
export function isLethalExcessTrue(amount: number, shield: number, hp: number): boolean {
  return amount > Math.max(0, shield) && amount >= hp;
}

