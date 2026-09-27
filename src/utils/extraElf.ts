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
  const cloned: Elf = JSON.parse(JSON.stringify(baseElf));
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
    currentHp: overrides.currentHp ?? overrides.maxHp ?? cloned.maxHp,
    // Scope descriptive/effect fields to the extra elf only — do not inherit the summoner's.
    soulMark: overrides.soulMark ?? defaultExtraSoulMark,
    trait: overrides.trait ?? undefined,
    alienTraits: overrides.alienTraits ?? undefined,
  };
}
