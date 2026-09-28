/**
 * 黯痕拆分與組合（最終規格 A1-4）
 * 原則：不刪舊 handleSobiratSoulMark；此處只定義子效果與組合器，供積木 custom / 未來 registry 调用。
 * 子效果（對應描述）：
 *  - skillCap1：持有者每次技能傷害無法超過 1 點
 *  - percentHalve：造成的百分比傷害減半
 *  - fixedHalve：造成的固定傷害減半
 *  - ignoreToHalve：對方無視傷害限制時改為本次技能傷害減半
 *  - noStatus：期間持有者無法附加雙方任一方異常狀態
 *  - takenDouble：受到攻擊技能傷害翻倍
 *  - duration3：持續 3 回合（+ 待觸發 bonus）
 */
export interface DarkScarParts {
  skillCap1: boolean;
  percentHalve: boolean;
  fixedHalve: boolean;
  ignoreToHalve: boolean;
  noStatus: boolean;
  takenDouble: boolean;
  duration: number;
}

export function defaultDarkScarParts(bonusTurns = 0): DarkScarParts {
  return {
    skillCap1: true,
    percentHalve: true,
    fixedHalve: true,
    ignoreToHalve: true,
    noStatus: true,
    takenDouble: true,
    duration: 3 + Math.max(0, bonusTurns),
  };
}

/** 技能傷害上限：僅對技能傷害（skill_attack / skill_attribute / skill_extra_action）生效 */
export function applyDarkScarSkillCap(
  damageCategory: string,
  amount: number,
  parts: DarkScarParts,
  ignoreLimit: boolean,
): number {
  const isSkill =
    damageCategory === "skill_attack" ||
    damageCategory === "skill_attribute" ||
    damageCategory === "skill_extra_action";
  if (!isSkill || !parts.skillCap1) return amount;
  // 最終規格：無視傷害限制時改為本次減半，而非直接壓到 1
  if (ignoreLimit && parts.ignoreToHalve) return Math.floor(amount * 0.5);
  return Math.min(amount, 1);
}

/** 百分比 / 固定傷害減半（持有者造成時） */
export function darkScarDealtMultiplier(
  damageCategory: string,
  parts: DarkScarParts,
): number {
  if (damageCategory === "percent" && parts.percentHalve) return 0.5;
  if (damageCategory === "fixed" && parts.fixedHalve) return 0.5;
  return 1;
}

/** 受擊翻倍（持有者受到攻擊技能傷害時） */
export function darkScarTakenMultiplier(
  damageCategory: string,
  parts: DarkScarParts,
): number {
  if (damageCategory === "skill_attack" && parts.takenDouble) return 2;
  return 1;
}

/** 禁附加異常（持有者作為附加者時） */
export function darkScarBlocksStatus(parts: DarkScarParts): boolean {
  return parts.noStatus;
}

/** 組合積木：一次掛上全部子效果（回傳描述，供日誌/顯示用，不直接寫狀態） */
export function combineDarkScar(parts: DarkScarParts): string[] {
  const out: string[] = [];
  if (parts.skillCap1) out.push("技能傷害上限1點");
  if (parts.percentHalve) out.push("造成百分比傷害減半");
  if (parts.fixedHalve) out.push("造成固定傷害減半");
  if (parts.ignoreToHalve) out.push("無視傷害限制改為本次減半");
  if (parts.noStatus) out.push("無法附加異常");
  if (parts.takenDouble) out.push("受到攻擊技能傷害翻倍");
  out.push(`持續${parts.duration}回合`);
  return out;
}
