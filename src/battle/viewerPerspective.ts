import type { Elf } from '../types';

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
