import { Elf, StatChange, StatType } from "../types";

export const STAT_NAMES: Record<StatType | 'all', string> = {
  atk: '攻擊',
  def: '防禦',
  spatk: '特攻',
  spdef: '特防',
  speed: '速度',
  accuracy: '命中',
  all: '全屬性'
};

/**
 * Parses a skill description for stat change keywords.
 * Examples: 
 * "令自身特攻、防禦、特防、速度、命中+1"
 * "全屬性+1"
 * "全屬性+1+2"
 */
export function parseStatChangesFromText(text: string): StatChange[] {
  const results: StatChange[] = [];
  
  // 1. Handle "全屬性" (All stats)
  const allMatch = text.match(/全屬性[+]([1-6])/);
  if (allMatch) {
    results.push({ stat: 'all', value: parseInt(allMatch[1]) });
  } else if (text.includes("全屬性+1+2")) {
    // Standardizing this ambiguous case to +1 as requested for the "base" part
    results.push({ stat: 'all', value: 1 });
  }

  // 2. Individual stats mapping
  const mappings: { kw: string; key: StatType }[] = [
    { kw: '攻擊', key: 'atk' },
    { kw: '物攻', key: 'atk' },
    { kw: '防禦', key: 'def' },
    { kw: '物防', key: 'def' },
    { kw: '特攻', key: 'spatk' },
    { kw: '特防', key: 'spdef' },
    { kw: '速度', key: 'speed' },
    { kw: '命中', key: 'accuracy' },
  ];

  // Pattern like "特攻、防禦、特防、速度、命中+1"
  // Look for sequences of keywords followed by a +N
  // We restrict the list to only valid keywords and separators
  const validKws = mappings.map(m => m.kw).join('|');
  const multiRegex = new RegExp(`((?:(?:${validKws})[、，])*(?:${validKws}))[+]([1-6])`);
  const multiMatch = text.match(multiRegex);
  
  if (multiMatch) {
    const statListStr = multiMatch[1];
    const val = parseInt(multiMatch[2]);
    mappings.forEach(({ kw, key }) => {
      // Use exact match or bounded check in the list string
      if (statListStr === kw || statListStr.includes(kw + '、') || statListStr.includes('、' + kw) || statListStr.includes(kw + '，') || statListStr.includes('，' + kw)) {
        if (!results.some(r => r.stat === 'all' || r.stat === key)) {
          results.push({ stat: key, value: val });
        }
      }
    });
  }

  // Also check for individual standalone mentions like "攻擊+1"
  mappings.forEach(({ kw, key }) => {
    // Standardizing the check for standalones
    const singleMatch = text.match(new RegExp(`(?:^|[^\\u4e00-\u9fa5])${kw}[+]([1-6])`));
    if (singleMatch && !results.some(r => r.stat === 'all' || r.stat === key)) {
      results.push({ stat: key, value: parseInt(singleMatch[1]) });
    }
    const singleNegMatch = text.match(new RegExp(`(?:^|[^\\u4e00-\u9fa5])${kw}[-]([1-6])`));
    if (singleNegMatch && !results.some(r => r.stat === 'all' || r.stat === key)) {
      results.push({ stat: key, value: -parseInt(singleNegMatch[1]) });
    }
  });

  return results;
}

/**
 * Applies a list of stat changes to an elf's battle state.
 */
export function applyStatChanges(
  elf: Elf, 
  changes: StatChange[], 
  isDouble: boolean = false
): { elf: Elf; logs: string[] } {
  const clonedElf = { ...elf };
  if (!clonedElf.statStages) {
    clonedElf.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
  } else {
    clonedElf.statStages = { ...clonedElf.statStages };
  }

  const logs: string[] = [];
  const multiplier = isDouble ? 2 : 1;

  changes.forEach(change => {
    const valueToAdd = change.value * multiplier;
    if (change.stat === 'all') {
      const stats: StatType[] = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'];
      stats.forEach(s => {
        const current = clonedElf.statStages![s] || 0;
        clonedElf.statStages![s] = Math.max(-6, Math.min(6, current + valueToAdd));
      });
      logs.push(`${elf.name} ${STAT_NAMES.all} ${valueToAdd > 0 ? '+' : ''}${valueToAdd}`);
    } else {
      const s = change.stat as StatType;
      const current = clonedElf.statStages![s] || 0;
      clonedElf.statStages![s] = Math.max(-6, Math.min(6, current + valueToAdd));
      logs.push(`${elf.name} ${STAT_NAMES[s]} ${valueToAdd > 0 ? '+' : ''}${valueToAdd}`);
    }
  });

  return { elf: clonedElf, logs };
}
