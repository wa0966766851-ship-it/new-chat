import type { Elf } from '../types';
import { skillSlot } from './skillSlot';
import { projectIllusionSkill } from './illusionSkillProjection';

/** 僅顯示投影；原槽負責PP與選招，不能將轉化技能寫回持有者。 */
export function visibleSkills(elf: Elf): Elf['skills'] {
  return elf.skills.map((skill, slot) => {
    const target = !elf.isInherentInvalid && elf.illusion?.target.skills[slot];
    return target ? projectIllusionSkill(skill, target, slot) : { ...skill, battleSlot: slot };
  });
}

/** 敵方幻化的戰場迷霧：公開介紹取複製對象，不回寫真實戰鬥屬性。 */
export function elfForViewer(elf: Elf, side?: Side): Elf {
  if (side !== 'p2' || !elf.illusion || elf.isConcealed) return elf;
  const target = elf.illusion.target;
  return { ...elf, name: target.name, type: target.type, seerId: target.seerId, path: target.path,
    height: target.height, weight: target.weight, artPresentation: target.artPresentation,
    soulMark: target.soulMark, trait: target.trait, alienTraits: target.alienTraits,
    baseStats: target.baseStats, calculatedStats: target.calculatedStats, category: target.category,
    skills: target.skills.map((s, i) => ({ ...s, pp: elf.skills[i]?.pp ?? s.pp, currentPp: elf.skills[i]?.pp ?? s.pp })), illusion: undefined };
}

export type Side = 'p1' | 'p2';
/** 本地對戰畫面以 P1 為己方視角。 */
export const VIEWER_SIDE: Side = 'p1';
export const UNKNOWN_ELF = '未知精靈';
export const UNKNOWN_SKILL = '未知技能';
export const UNKNOWN_EFFECT = '未知效果';

/** 隱匿：只對敵方視角掩蓋；己方完整顯示。未指定陣營時保守視為隱藏。 */
export function hiddenFromViewer(elf: Pick<Elf, 'isConcealed'> | null | undefined, side?: Side): boolean {
  return !!elf?.isConcealed && side !== VIEWER_SIDE;
}

/** 敵方隱匿精靈在文字中的可識別詞：名稱、技能、魂印與特質名稱。 */
export function viewerMaskTerms(enemyTeam: (Elf | null | undefined)[]): [string, string][] {
  const terms = new Map<string, string>();
  for (const e of enemyTeam) {
    if (e?.illusion && !e.isConcealed) {
      terms.set(e.name, e.illusion.target.name);
      for (const skill of e.skills) {
        const target = e.illusion.target.skills[skillSlot(e, skill)];
        if (target) terms.set(skill.name, target.name);
      }
    }
    if (!e?.isConcealed) continue;
    if (e.name) terms.set(e.name, UNKNOWN_ELF);
    for (const s of [...(e.skills || []), ...((e as any).skillPool || [])]) if (s?.name) terms.set(s.name, UNKNOWN_SKILL);
    const soul = (e as any).soulMark?.name;
    if (soul) terms.set(soul, UNKNOWN_EFFECT);
    const traits = (e as any).alienTraits || {};
    for (const t of Object.values(traits) as any[]) if (t?.name) terms.set(t.name, UNKNOWN_EFFECT);
  }
  return [...terms.entries()].filter(([k]) => k.length >= 2).sort((a, b) => b[0].length - a[0].length);
}

export function maskViewerText(text: string | undefined, terms: [string, string][]): string {
  let out = String(text ?? '');
  for (const [k, v] of terms) if (out.includes(k)) out = out.split(k).join(v);
  return out;
}
