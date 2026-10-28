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

export type BattleViewMode = 'PVE' | 'PVP';

/**
 * 隱匿可見性唯一判斷（viewer × owner × mode）。所有顯示點都呼叫此函式，不得自行判斷 isConcealed。
 * - PVE：持有方（viewer）完整可見，對方不可見。owner 未指定時保守視為不可見。
 * - PVP（同一螢幕）：全局隱藏，雙方皆不可見。
 */
export function hiddenFromViewer(elf: Pick<Elf, 'isConcealed'> | null | undefined, owner?: Side, mode: BattleViewMode = 'PVE', viewer: Side = VIEWER_SIDE): boolean {
  if (!elf?.isConcealed) return false;
  if (mode === 'PVP') return true;
  return owner !== viewer;
}

/** 雙方隊伍中需要在文字裡掩蓋的詞：PVE 只掩蓋對方（p2）隊伍，PVP 掩蓋雙方。 */
export function viewerMaskTermsForMode(p1Team: (Elf | null | undefined)[], p2Team: (Elf | null | undefined)[], mode: BattleViewMode = 'PVE'): [string, string][] {
  return viewerMaskTerms(mode === 'PVP' ? [...(p1Team || []), ...(p2Team || [])] : (p2Team || []));
}

/** 遞迴掩蓋物件內所有字串值（結算摘要等結構化資料用）；不改動鍵與數字。 */
export function maskViewerDeep<T>(value: T, terms: [string, string][]): T {
  if (!terms.length) return value;
  const walk = (v: any): any => typeof v === 'string' ? maskViewerText(v, terms)
    : Array.isArray(v) ? v.map(walk)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  return walk(value);
}

/** 結算畫面用：不可見的隱匿精靈換成不含任何識別資訊的替身（保留 id/battleId 以便對應）。 */
export function maskElfIdentity(elf: Elf, owner: Side, mode: BattleViewMode): Elf {
  if (!hiddenFromViewer(elf, owner, mode)) return elf;
  return { ...elf, name: UNKNOWN_ELF, type: '', soulMark: undefined as any, trait: undefined as any, alienTraits: undefined as any,
    skills: (elf.skills || []).map(s => ({ ...s, name: UNKNOWN_SKILL, description: '' })), path: '', seerId: undefined as any, illusion: undefined } as Elf;
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
