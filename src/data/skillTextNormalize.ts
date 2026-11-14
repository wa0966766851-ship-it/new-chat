import type { Skill } from '../types';
import type { KitEntry } from '../effects/effectSystem.schema';

/**
 * 技能文字與效果分類的載入期統一整理（2026-11-13）。所有內建／匯入精靈在 prepareSeeds 走同一道，
 * 之後新增的精靈不需各自記得這些規則：
 * 1. 「技能無效時…」是附加效果（effectClassificationCatalog C_ADDITIONAL），不是固有。
 *    只改分類與標記；觸發仍走 on_invalid，且技能本身無效不算「附加效果失效」（connectedEffects 放行）。
 *    固有效果句中順帶提到「技能無效時…」的子條款（如淨世洗禮頌保底值）不動。
 * 2. 屬性列（「飛行.光 特殊攻擊 先制:+3 PP:5 威力:160 爆擊率:0/16 命中率:100%」）是技能欄位，不是效果描述。
 *    從描述移除；被拿來當積木標籤的改成精簡標籤。數值本身已在 priority／pp／power／accuracy 欄位。
 */
const STAT_LINE = /(?:物理|特殊|屬性)攻擊.*(?:PP\s*[:：]\s*\d|威力\s*[:：]\s*\d)|PP\s*[:：]\s*\d+.*威力\s*[:：]\s*\d/;
const INVALID_LEAD = /^\s*(?:[■🎯◇]\s*)?技能無效時/u;
const textOf = (e: KitEntry) => String(e.customText || (e.params as any)?.clause?.raw || '');

export const isSkillStatLine = (line: string) => STAT_LINE.test(line);

function statLabel(line: string): string {
  const crit = line.match(/爆擊率\s*[:：]\s*([\d/]+)/);
  return crit ? `爆擊率${crit[1]}` : '技能數值';
}

/** 固有句中段提到「技能無效時」（不是整句以它開頭）：視為固有條款的一部分。 */
function invalidInsideInnate(description: string) {
  return description.split(/\r?\n/).some(l => /^\s*■/.test(l) && l.includes('技能無效時') && !INVALID_LEAD.test(l));
}

export function normalizeSkillText<T extends Partial<Skill>>(skill: T): T {
  if (!skill) return skill;
  const description = String(skill.description || '');
  const keepInvalidInnate = invalidInsideInnate(description);
  let changed = false;
  const lines = description.split('\n');
  const kept = lines.filter(l => !isSkillStatLine(l)).map(l => {
    if (!keepInvalidInnate && /^(\s*(?:[>＞]\s*)*)■\s*技能無效時/u.test(l)) return l.replace(/■\s*技能無效時/u, '🎯 技能無效時');
    return l;
  });
  const nextDescription = kept.join('\n');
  if (nextDescription !== description) changed = true;
  const kit = skill.kit?.map((e: KitEntry) => {
    const raw = textOf(e);
    if (raw && isSkillStatLine(raw)) {
      changed = true;
      const label = statLabel(raw);
      const params: any = (e.params as any)?.clause ? { ...e.params, clause: { ...(e.params as any).clause, raw: label } } : e.params;
      return { ...e, customText: label, params } as KitEntry;
    }
    const trig = (e.params as any)?.clause?.trig;
    if (!keepInvalidInnate && e.source === 'skill' && e.role === 'innate' && trig === 'self_invalid' && INVALID_LEAD.test(raw)) {
      changed = true;
      const swap = (s: string) => s.replace(/^(\s*)■\s*/u, '$1🎯 ');
      const clause = (e.params as any).clause;
      return { ...e, role: 'attached', customText: e.customText ? swap(e.customText) : e.customText,
        params: { ...e.params, clause: { ...clause, raw: clause.raw ? swap(clause.raw) : clause.raw, ...(clause.marker ? { marker: '🎯' } : {}) } } } as KitEntry;
    }
    return e;
  });
  return changed ? { ...skill, description: nextDescription, ...(kit ? { kit } : {}) } : skill;
}

export function normalizeElfSkillText<E extends { skills?: Skill[]; skillPool?: Skill[] }>(elf: E): E {
  const skills = elf.skills?.map(normalizeSkillText);
  const skillPool = elf.skillPool?.map(normalizeSkillText);
  const same = (a?: Skill[], b?: Skill[]) => !a || a.every((s, i) => s === b![i]);
  return same(skills, elf.skills) && same(skillPool, elf.skillPool) ? elf : { ...elf, ...(skills ? { skills } : {}), ...(skillPool ? { skillPool } : {}) };
}
