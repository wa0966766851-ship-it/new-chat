import type { Elf, Skill, StatType } from '../types';

/** 計算用的「視為」不改動真實能力等級，也不需要命中後才開啟。 */
export function skillStageView(elf: Pick<Elf, 'statStages' | 'isInherentInvalid'>, skill: Pick<Skill, 'description'> | null | undefined, stat: StatType, opponent = false): number {
  const original = elf.statStages?.[stat] || 0;
  if (!skill || elf.isInherentInvalid) return original;
  const text = skill.description || '';
  if (opponent) return /(?:將)?對手能力提升(?:狀態|效果)?視為(?:同等級)?能力下降/.test(text) && original > 0 ? -original : original;
  const negatives = Object.values(elf.statStages || {}).filter(v => v < 0);
  if (/自身任意能力下降狀態視為至少2倍同等級的全屬性能力提升/.test(text) && negatives.length) return Math.max(original, Math.min(6, -2 * Math.min(...negatives)));
  if (/自身能力下降(?:狀態|效果)?視為(?:同等級)?能力提升/.test(text) && original < 0) return -original;
  return original;
}
