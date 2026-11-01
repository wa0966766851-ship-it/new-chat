import type { Elf, Skill } from '../types';
import historical from './legacyDimensionalDragon.json';
import historicalWrappers from './legacyDimensionalDragonWrappers.json';
import { buildWrappedKit, wrappedKey, wrappedLabel } from '../blocks/ops/legacyWrappedKit';
import { unpackReviewedKits } from './packedReviewedKits';

// 只認 Git 中實際發布過的完整定義，不能用關鍵字或相似度覆蓋玩家編輯。
const published = [...unpackReviewedKits<{ kind?: string; name: string; description: string; kit: unknown[] }[]>(historical), ...historicalWrappers.definitions];
const stable = (v: unknown) => JSON.stringify(v, (_k, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
export function correctSavedDimensionalDragon(elf: Elf, defaults: Elf[], protectedDefinitions: Set<object>): Elf {
  if (String(elf.id) !== '5021' || elf.isCustom) return elf;
  const source = defaults.find(e => String(e.id) === '5021' && e.name === elf.name);
  if (!source) return elf;
  const isPublishedKit = (kit: unknown[], kind: string | undefined, name: string, description?: string) =>
    published.some(d => d.kind === kind && d.name === name && stable(d.kit) === stable(kit)) ||
    // 舊包裝器由內建原文產生；只接受已發布或目前正式原文，玩家改過的包裝一律保留。
    !!description && (kind === 'soul' || kind === undefined) && stable(kit) === stable(buildWrappedKit(
      kind === 'soul' ? 'soul' : 'skill', String(elf.id), wrappedKey(kind === 'soul' ? 'soul' : 'skill', elf.name, name),
      description, wrappedLabel(kind === 'soul' ? 'soul' : 'skill', elf.name, name)));
  const restore = <T extends { name: string; description?: string; kit?: unknown[]; effectMode?: string }>(value: T, canonical: T | undefined, kind?: string): T => {
    if (!value || !canonical?.kit?.length || protectedDefinitions.has(value)) return value;
    const old = published.find(d => d.kind === kind && d.name === value.name &&
      (d.description === value.description || canonical.description === value.description) &&
      (!value.kit?.length || isPublishedKit(value.kit, kind, value.name, value.description)));
    if (!old || value.effectMode && !['auto', 'kit', 'registry'].includes(value.effectMode)) return value;
    return { ...value, description: canonical.description, effectMode: canonical.effectMode, kit: structuredClone(canonical.kit) };
  };
  // 未知頂層積木是玩家自訂，保留；不能用內建魂印取代它。
  const top = elf.kit?.filter(e => e.source !== 'skill');
  const knownTop = top?.length && isPublishedKit(top, 'soul', elf.soulMark?.name || '', elf.soulMark?.description);
  const soulMark = top?.length && !knownTop ? elf.soulMark : restore(elf.soulMark!, source.soulMark!, 'soul');
  const skill = (s: Skill) => s.name === '告命詩途' ? restore(s, [...source.skills, ...(source.skillPool || [])].find(x => x.name === s.name)) : s;
  const skills = elf.skills.map(skill), skillPool = elf.skillPool?.map(skill);
  if (soulMark === elf.soulMark && skills.every((s, i) => s === elf.skills[i]) &&
    (!skillPool || skillPool.every((s, i) => s === elf.skillPool?.[i]))) return elf;
  return { ...elf, soulMark, skills, ...(skillPool ? { skillPool } : {}),
    ...(knownTop && soulMark !== elf.soulMark ? { kit: elf.kit?.filter(e => e.source === 'skill') } : {}) };
}
