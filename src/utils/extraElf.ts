import { Elf, SoulMark } from "../types";

/**
 * 額外精靈統一 id 標準（docs/rules/額外精靈id標準.md）：
 *  - 一律英文字母開頭、`x_` 前綴 + 小寫英數底線，不佔用數字序號（5xxx）。
 *  - 登錄表 EXTRA_ELF_KINDS 以名稱對應「種類 id」，createExtraElf 會寫入 `extraKind`。
 *  - 同一時間每隊只會有一隻的額外精靈（如炫彩山神）直接以種類 id 作為實例 id；
 *    可能多隻並存者用 `<種類id>_<時間>_<亂數>` 當實例 id（舊的 `extra_<中文名>_…` 已改成純字母），種類以 extraKind 辨識。
 */
export const EXTRA_ELF_KINDS: Record<string, string> = {
  "克塔亞特": "x_cthyaat",
  "珀妮": "x_puni",
  "賽博怨靈": "x_cyber_wraith",
  "炫彩山神": "x_shancaishen",
  "旭": "x_xu",
  "清": "x_qing",
};
export const EXTRA_ELF_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
export const extraKindOf = (elf: { name?: string; extraKind?: string } | null | undefined): string | undefined =>
  elf?.extraKind ?? (elf?.name ? EXTRA_ELF_KINDS[elf.name] : undefined);

/**
 * Create an extra/support elf (額外精靈) summoned by another elf.
 *
 * Descriptive/effect fields (soulMark / trait / alienTraits) are scoped to the
 * extra elf itself and are NEVER inherited wholesale from the summoner — otherwise
 * the detail panel would show the summoner's entire kit on the extra elf.
 * Callers SHOULD pass an extra-specific `soulMark` whose description is the verbatim
 * sub-clause (unaltered) that describes THIS extra elf inside the summoner's text.
 */
export function createExtraElf(baseElf: Elf, overrides: Partial<Elf> & { name: string }): Elf {
  // 只繼承基礎配置；戰鬥印記、存活規則、PP特權等不能從召喚者複製。
  const inheritedKeys = ["type", "level", "baseStats", "ivs", "evs", "natureModifiers",
    "calculatedStats", "maxHp", "height", "weight", "gender"] as const;
  const cloned = JSON.parse(JSON.stringify(Object.fromEntries(
    inheritedKeys.map(key => [key, baseElf[key]]),
  ))) as Elf;
  // overrides.id（字母開頭的種類 id，如 x_shancaishen）優先；否則沿用唯一實例 id。
  const explicitId = typeof overrides.id === "string" && EXTRA_ELF_ID_PATTERN.test(overrides.id) ? overrides.id : undefined;
  const uniqueId = explicitId ?? `${EXTRA_ELF_KINDS[overrides.name] ?? "x_extra"}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const defaultExtraSoulMark: SoulMark = {
    name: "額外精靈",
    description: `由【${baseElf.name}】召喚的額外精靈。其效果請見召喚者專屬魂印中與本精靈相關的敘述。`,
    effectType: "none",
    effectValue: 0,
  };

  return {
    ...cloned,
    ...overrides,
    id: uniqueId,
    battleId: uniqueId,
    isExtra: true,
    extraKind: overrides.extraKind ?? EXTRA_ELF_KINDS[overrides.name],
    // 召喚者（陣亡後的延後效果，例如斯嘉麗重生，由存活的額外精靈代為執行）
    summonerId: String(baseElf.battleId || baseElf.id),
    skills: overrides.skills ?? [],
    statStages: overrides.statStages ?? { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 },
    marks: overrides.marks ?? [],
    effects: overrides.effects ?? [],
    battleStatuses: overrides.battleStatuses ?? {},
    shield: overrides.shield ?? 0,
    barrier: overrides.barrier ?? 0,
    currentHp: overrides.currentHp ?? overrides.maxHp ?? cloned.maxHp,
    // Scope descriptive/effect fields to the extra elf only — do not inherit the summoner's.
    soulMark: overrides.soulMark ?? defaultExtraSoulMark,
    trait: overrides.trait ?? undefined,
    alienTraits: overrides.alienTraits ?? undefined,
  };
}
