import type { Elf } from '../types';
import type { EffectDefinition } from '../effects/effectConnection';
import { soulDefinition } from '../effects/soulDefinitionSource';

/** 取得效果只借用定義，不能借用目標戰鬥身分、體力、印記或存活規則。 */
export function effectSourceViews(elf: Elf): Elf[] {
  const own = { ...elf, illusion: undefined };
  const source = elf.illusion?.target;
  return source ? [own, { ...own, name: source.name, soulMark: source.soulMark, kit: source.kit,
    trait: source.trait, alienTraits: source.alienTraits }] : [own];
}

export function effectDefinitionEntries(elf: Elf) {
  return effectSourceViews(elf).flatMap((sourceElf, i) => {
    const entries = [
      sourceElf.soulMark && { ...soulDefinition(sourceElf), kind: '專屬特性', soul: true },
      sourceElf.trait && { ...sourceElf.trait, kind: '通用特性', configurable: true },
      sourceElf.alienTraits?.gen2Trait && { ...sourceElf.alienTraits.gen2Trait, kind: '二代特質' },
      sourceElf.alienTraits?.exclusiveTrait && { ...sourceElf.alienTraits.exclusiveTrait, kind: '專屬特質' },
      ...(sourceElf.alienTraits?.exclusiveTraits || []).map(t => ({ ...t, kind: '專屬特質' })),
      sourceElf.alienTraits?.alienTrait && { ...sourceElf.alienTraits.alienTrait, kind: '異能' },
      sourceElf.alienTraits?.generalTrait && { ...sourceElf.alienTraits.generalTrait, kind: '通用特性', configurable: true },
    ].filter(Boolean) as (EffectDefinition & { kind: string; description: string; soul?: boolean; configurable?: boolean })[];
    // 同一來源內相同定義只展示一次；自身／取得來源分開標註。
    return entries.filter((entry, n) => entries.findIndex(other => other.name === entry.name && other.description === entry.description) === n)
      .map(entry => ({ ...entry, acquired: !!i, sourceElf: i ? elf.illusion!.target : sourceElf,
        kind: i ? `幻化取得・${entry.kind}` : entry.kind }));
  });
}
