import type { Elf, Skill } from '../types';
import type { KitEntry } from '../effects/effectSystem.schema';
import packed from './reviewedKits.compressed.json';
import { gunzipSync, strFromU8 } from 'fflate';
if (packed.schemaVersion !== 1) throw new Error('積木資料版本不相容');
type Definition = { kind?:'soul'; elfIds: string[]; name: string; description: string; kit: KitEntry[] };
const definitions: Definition[] = JSON.parse(strFromU8(gunzipSync(Uint8Array.from(atob(packed.gzip), c => c.charCodeAt(0)))));
const byOwner = new Map<string, Definition[]>();
for (const definition of definitions) for (const id of definition.elfIds) byOwner.set(id, [...(byOwner.get(id) || []), definition]);

/** 建置前核對完整原始定義；執行時只還原可信資料一次，不載入大型建構原碼。 */
export function applyReviewedSkillKits(elf: Elf): Elf {
  const candidates = byOwner.get(String(elf.id)) || [];
  const apply = (skill: Skill): Skill => {
    if (skill.effectMode && skill.effectMode !== 'auto' || skill.kit?.length) return skill;
    const exact = candidates.find(d => d.kind!=='soul' && d.name === skill.name && d.description === skill.description);
    return exact ? { ...skill, effectMode: 'kit', kit: structuredClone(exact.kit) } : skill;
  };
  const soul=elf.soulMark,exactSoul=soul && !(soul.effectMode && soul.effectMode!=='auto') && !soul.kit?.length
    ? candidates.find(d=>d.kind==='soul'&&d.name===soul.name&&d.description===soul.description):undefined;
  return { ...elf, skills: elf.skills.map(apply), skillPool: elf.skillPool?.map(apply),
    ...(exactSoul?{soulMark:{...soul!,effectMode:'kit' as const,kit:structuredClone(exactSoul.kit)}}:{}) };
}
