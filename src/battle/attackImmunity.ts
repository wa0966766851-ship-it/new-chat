// 攻擊免疫類（effectClassificationCatalog ATTACK_IMMUNE）
// - 防守方處於攻擊免疫時，進攻方的攻擊技能未命中；必中無效。
// - 可被「無視攻擊免疫效果」貫穿。
// - 次數型：只有實際擋下攻擊時才消耗；被無視或攻擊本身未命中時不消耗。
// - 與「免疫／抵擋／轉化受到的攻擊傷害」是不同系統（那些在傷害階段處理）。
import { getElfAdvancedMechanics } from "../data/traitsRegistry";

export type AttackImmunity = { kind: "count" | "turns"; key: string; left: number };

/** 防守方目前的攻擊免疫（次數型優先） */
export function getAttackImmunity(reg: Record<string, any> | undefined): AttackImmunity | null {
  const r = reg || {};
  if ((r.blockAttackCount || 0) > 0) return { kind: "count", key: "blockAttackCount", left: r.blockAttackCount };
  if ((r.immuneAttackTurns || 0) > 0) return { kind: "turns", key: "immuneAttackTurns", left: r.immuneAttackTurns };
  return null;
}

const IGNORE_LINE = /^(?:■|🎯)?\s*(?:自身攻擊)?無視對手(?:的)?(?:攻擊免疫|免疫攻擊)效果/;

function clauses(desc?: string): string[] {
  return String(desc || "").split(/\n|；|;/).map(s => s.trim()).filter(Boolean);
}

/**
 * 進攻方這次攻擊是否無視攻擊免疫。回傳來源說明，否則 null。
 * addEffectsInvalid：附加效果失效時，🎯 行的無視不生效。
 */
export function ignoresAttackImmunity(
  actor: any,
  actorReg: Record<string, any> | undefined,
  skill: any,
  opts: { addEffectsInvalid?: boolean; poemChapters?: number } = {}
): string | null {
  const r = actorReg || {};
  for (const c of clauses(skill?.description)) {
    if (IGNORE_LINE.test(c)) {
      if (c.startsWith("🎯") && opts.addEffectsInvalid) continue;
      return skill?.name || "技能";
    }
    // 條件式：攻擊不少於特攻則無視對手免疫效果
    if (/攻擊不少於特攻則無視對手免疫效果/.test(c)) {
      const st = actor?.calculatedStats || {};
      if ((st.atk || 0) >= (st.spatk || 0)) return skill?.name || "技能";
    }
  }
  if (r.ignoreAttackImmunityNext) return "下次攻擊無視攻擊免疫";
  if ((r.ignoreAttackImmunityUntilSwitch || 0) > 0 || r.ignoreAttackImmunityUntilSwitch === true) return "直到下場前無視攻擊免疫";
  if (actor && getElfAdvancedMechanics(actor).ignoreImmuneShieldEffects) return "特質";
  if (actor && (getElfAdvancedMechanics(actor) as any).ignoreImmunityLimitShield) return "特質";
  if ((opts.poemChapters || 0) >= 8) return "詩章8";
  return null;
}

/** 技能描述：「無視成功則自身下次攻擊無視對手免疫攻擊效果」 */
export function grantsNextIgnoreOnSuccess(skill: any): boolean {
  return /無視成功則自身下次攻擊無視對手(?:的)?(?:免疫攻擊|攻擊免疫)效果/.test(String(skill?.description || ""));
}
