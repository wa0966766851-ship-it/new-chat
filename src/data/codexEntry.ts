import type { EffectCode } from "../effects/effectSystem.schema";
import { mapCodeToAtoms } from "../effects/atomMapper";

/** 字典索引立即可查；昂貴的語意解析延至第一次讀取 atoms，且只執行一次。 */
export function createCodexEntry(
  item: Partial<EffectCode> & { id: string },
  mapper = mapCodeToAtoms,
): EffectCode {
  let atoms: EffectCode["atoms"] | undefined;
  return {
    id: item.id,
    template: item.template || "",
    paramCount: item.paramCount ?? 0,
    era: item.era || "legacy",
    role: item.role || "innate",
    node: item.node || null,
    damageType: item.damageType || null,
    counter: item.counter,
    namedStatus: item.namedStatus ?? false,
    isDual: item.isDual ?? false,
    target: item.target || "self",
    targetInferred: item.targetInferred ?? false,
    polarity: item.polarity || "NEUTRAL",
    contexts: item.contexts || ["skill"],
    get atoms() {
      return atoms ??= item.atoms?.length ? item.atoms : mapper(item);
    },
    set atoms(value) { atoms = value; },
    clarity: item.clarity || "clear",
    needsReview: item.needsReview ?? false,
    reviewReason: item.reviewReason || "",
  };
}
