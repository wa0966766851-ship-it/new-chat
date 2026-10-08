import type { Skill } from '../types';

/** 轉化只更換技能本體與附加效果，原槽的固有條款另保留，不能重跑原槽🎯。 */
export function projectIllusionSkill(original: Skill, target: Skill, slot: number): Skill {
  const innate = String(original.description || '').split('\n').filter(line => /^\s*■/.test(line));
  const priority = original.priority ?? Number(innate.find(line => /^\s*■\s*先制[+＋]\d+\s*$/.test(line))?.match(/[+＋](\d+)/)?.[1] || 0);
  const result = { ...target, battleSlot: slot,
    priority: (target.priority || 0) + priority,
    isSureHit: target.isSureHit || original.isSureHit || innate.some(line => /^\s*■\s*必中\s*$/.test(line)),
    // 固有先制／必中需供公式入口查詢；其他原槽固有由原槽註冊接點執行，
    // 不塞給目標的通用附加解析器（否則記憶會被誤報未實裝或重跑）。
    description: [target.description, ...innate.filter(line => /先制|必中|必定命中/.test(line))].filter(Boolean).join('\n'),
    pp: original.pp, currentPp: original.pp, maxPp: original.maxPp,
    ppMaxOffset: original.ppMaxOffset, ppMinOffset: original.ppMinOffset };
  for (const key of ['alwaysHit', 'ignoreImmunity', 'ignoreShield', 'ignoreAttackImmunity']) {
    if ((original as any)[key]) (result as any)[key] = true;
  }
  return result;
}
