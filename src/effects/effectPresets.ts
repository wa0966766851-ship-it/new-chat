import type { Elf } from '../types';
import type { KitEntry } from './effectSystem.schema';
import type { EffectDefinition } from './effectConnection';
import { kitEntryIssue } from './effectConnection';
import { distillEffect } from './distillEffect';

export type EffectKind = 'skill' | 'soul';
/** 查看只產生草稿，不替換資料來源；部分轉換不能整份覆蓋原程式。 */
export function defaultEffectKit(definition: EffectDefinition, kind: EffectKind) {
  if (definition.kit?.length || definition.effectMode === 'kit') {
    const kit = structuredClone(definition.kit || []);
    const issues = kit.flatMap((entry, index) => {
      const reason = kitEntryIssue(entry);
      return reason ? [{ index, text: entry.customText || entry.codeId, reason }] : [];
    });
    return { kit, issues, complete: kit.length > 0 && !issues.length, origin: 'authored' as const };
  }
  return { ...distillEffect(definition, kind), origin: 'distilled' as const };
}
export interface EffectPreset {
  id: string; elfId: string; elfName: string; category: string; kind: EffectKind;
  definition: EffectDefinition; kit: KitEntry[]; complete: boolean; issues: { text: string; reason: string }[];
}
function* presetDefinitions(elves: readonly Elf[]) {
  for (const elf of elves) {
    const definitions: Array<[string, string, EffectKind, EffectDefinition | undefined]> = [
      ['soul', '魂印', 'soul', elf.soulMark && { ...elf.soulMark, kit: elf.soulMark.kit ?? elf.kit }],
      ['trait', '特性', 'soul', elf.trait],
      ...(['gen2Trait', 'exclusiveTrait', 'alienTrait', 'generalTrait'] as const).map(key => [key, '特質', 'soul', elf.alienTraits?.[key]] as [string, string, EffectKind, EffectDefinition | undefined]),
      ...(elf.alienTraits?.exclusiveTraits || []).map((t, i) => [`exclusive.${i}`, '專屬特質', 'soul', t] as [string, string, EffectKind, EffectDefinition]),
      ...elf.skills.map((s, i) => [`skill.${i}`, '技能', 'skill', s] as [string, string, EffectKind, EffectDefinition]),
      ...(elf.skillPool || []).map((s, i) => [`pool.${i}`, '替換技能', 'skill', s] as [string, string, EffectKind, EffectDefinition]),
    ];
    for (const [key,category,kind,definition] of definitions) if (definition) yield { id: `${elf.id}:${key}`,elfId:elf.id,elfName:elf.name,category,kind,definition };
  }
}
function makePreset(row: ReturnType<typeof presetDefinitions> extends Generator<infer T> ? T : never): EffectPreset {
  return { ...row, definition: structuredClone(row.definition), ...defaultEffectKit(row.definition,row.kind) };
}
export function collectEffectPresets(elves: readonly Elf[]): EffectPreset[] {
  return [...presetDefinitions(elves)].map(makePreset);
}
/** 效果庫首次解析分批讓出主執行緒，不用一次同步建立數百項。 */
export async function collectEffectPresetsAsync(elves: readonly Elf[], yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0))) {
  const result: EffectPreset[] = []; let start = performance.now();
  for (const row of presetDefinitions(elves)) {
    result.push(makePreset(row));
    if (performance.now() - start >= 8) {await yieldTask();start = performance.now();}
  }
  return result;
}
/** 只複製效果，不借用原主的體力、技能 PP、印記、身分或註冊表。 */
export function instantiateEffectPreset(preset: EffectPreset, kind: EffectKind): Pick<EffectDefinition, 'description' | 'kit' | 'effectMode'> {
  if (!preset.complete || !preset.kit.length || preset.kind !== kind) throw new Error('此效果尚未完整接通，或時點類型不相容。');
  const kit = structuredClone(preset.kit);
  for (const entry of kit) {
    const issue = kitEntryIssue(entry);
    if (issue) throw new Error(issue);
    entry.source = kind === 'skill' ? 'skill' : 'soulmark';
  }
  return { description: preset.definition.description || '', kit, effectMode: 'kit' };
}
