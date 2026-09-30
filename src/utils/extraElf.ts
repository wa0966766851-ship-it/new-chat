import { Elf, SoulMark } from "../types";

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
  const uniqueId = `extra_${overrides.name}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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
