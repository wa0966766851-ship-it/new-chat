import { Elf, StatusCategory, StatusEffect } from "../types";
import { StatusRegistry, StatusRegistryEntry } from "../effects/statusRegistry";
import { getStatuses } from "./battleHelpers";

// StatusEffect is imported from types.ts

/**
 * Parses status effects from a skill description.
 */
export function parseStatusesFromText(text: string): StatusEffect[] {
  const results: StatusEffect[] = [];
  const statusNames = Object.keys(StatusRegistry);

  // Pre-filter names to avoid overlap if possible
  const sortedNames = [...statusNames].sort((a, b) => b.length - a.length);

  sortedNames.forEach(name => {
    // Basic presence check
    if (text.includes(name)) {
      // Avoid matching if it's strictly a transformation target description
      // e.g. "異常結束後轉化為速度-1與凍傷3回合" 
      // We check if it's prefixed by "轉化為" or "化為" or "隨機轉化為"
      const transformRegex = new RegExp(`[轉隨機]*化為[^\\u4e00-\\u9fa5]*${name}`);
      if (transformRegex.test(text)) {
        // If it's ONLY mentioned as a transformation, we might want to skip it
        // BUT if it's also the main effect (e.g. "令對手中毒，且轉化為中毒"), we should keep it.
        // For now, let's look for "令對手", "附加", "進入", "陷入"
        const applyRegex = new RegExp(`(令|附加|進入|陷入|為)[^\\u4e00-\\u9fa5]*${name}`);
        if (!applyRegex.test(text)) {
          return; // Skip if only mentioned as transform target
        }
      }

      let duration = 3; // Default

      // Try various duration patterns
      // 1. "Name N回合"
      const durRegex1 = new RegExp(`${name}[^\\d]*(\\d+)[ ]*回[合次]`);
      // 2. "N回合Name"
      const durRegex2 = new RegExp(`(\\d+)[ ]*回[合次][^\\u4e00-\\u9fa5]*${name}`);
      
      const match1 = text.match(durRegex1);
      const match2 = text.match(durRegex2);
      
      if (match1) {
        duration = parseInt(match1[1]);
      } else if (match2) {
        duration = parseInt(match2[1]);
      }

      const entry = StatusRegistry[name];
      results.push({
        name,
        duration,
        category: entry.categories[0] || 'NONE'
      });
    }
  });

  return results;
}

/**
 * Applies status effects to an elf.
 */
export function applyStatuses(
  elf: Elf, 
  effects: StatusEffect[]
): { elf: Elf; logs: string[] } {
  const clonedElf = { ...elf };
  if (!clonedElf.battleStatuses) {
    clonedElf.battleStatuses = {};
  } else {
    clonedElf.battleStatuses = { ...clonedElf.battleStatuses };
  }

  const logs: string[] = [];

  effects.forEach(effect => {
    // Check for immunity (BOSS statuses or specific traits)
    const isImmune = (clonedElf.battleStatuses!['神話'] || clonedElf.battleStatuses!['免疫'] || clonedElf.battleStatuses!['異常抵抗']);
    if (isImmune && !['神話', '免疫', '異常抵抗', '隱匿'].includes(effect.name)) {
      // Bosses/Immune units skip normal status
      return;
    }

    // Special case: "狂信" needs source name
    // (Handled elsewhere or by params if we had them)

    clonedElf.battleStatuses![effect.name] = effect.duration;
    logs.push(`${elf.name} 陷入了 ${effect.name} 狀態 (${effect.duration} 回合)`);
  });

  return { elf: clonedElf, logs };
}

export const isStatusActive = (elf: any, statusId: string) => {
  if (!elf) return false;
  const statuses = getStatuses(elf);
  return (statuses[statusId] || 0) > 0;
};
