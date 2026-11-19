import type { Skill } from '../types';
import {hasInnateSureHit} from '../utils/skillDescription';

/** 轉化只更換技能本體與附加效果，原槽的固有條款另保留，不能重跑原槽🎯。 */
export function projectIllusionSkill(original: Skill, target: Skill, slot: number): Skill {
  const innate = String(original.description || '').split('\n').filter(line => /^\s*■/.test(line));
  const priority = original.priority ?? Number(innate.find(line => /^\s*■\s*先制[+＋]\d+\s*$/.test(line))?.match(/[+＋](\d+)/)?.[1] || 0);
  const targetSure=hasInnateSureHit(target);
  const inherited=innate.filter(line=>/先制|必中|必定命中/.test(line))
    .filter(line=>!/^\s*■\s*(?:必中|必定命中)\s*$/.test(line)||!targetSure)
    .filter(line=>!String(target.description||'').split('\n').some(other=>other.trim()===line.trim()));
  const result = { ...target, battleSlot: slot,
    priority: (target.priority || 0) + priority,
    isSureHit: target.isSureHit || original.isSureHit || innate.some(line => /^\s*■\s*必中\s*$/.test(line)),
    // 固有先制／必中需供公式入口查詢；其他原槽固有由原槽註冊接點執行，
    // 不塞給目標的通用附加解析器（否則記憶會被誤報未實裝或重跑）。
    description: [...new Set(inherited),target.description].filter(Boolean).join('\n'),
    pp: original.pp, currentPp: original.pp, maxPp: original.maxPp,
    ppMaxOffset: original.ppMaxOffset, ppMinOffset: original.ppMinOffset };
  for (const key of ['alwaysHit', 'ignoreImmunity', 'ignoreShield', 'ignoreAttackImmunity']) {
    if ((original as any)[key]) (result as any)[key] = true;
  }
  // 2026-11-16 規則：轉化技能＝轉化前技能固有效果＋轉化後技能固有效果＋轉化後附加效果。
  // 原槽的固有序列（非屬性欄位、非行動後節點——行動後由原槽接點執行）併入轉化後 Kit。
  const carried = (original.kit || []).filter(e => e.role === 'innate' && e.codeId !== 'skill_property' && e.node !== 'after_action'
    && !(target.kit || []).some(t => t.customText === e.customText));
  if (carried.length && target.effectMode === 'kit') (result as any).kit = [...carried, ...(target.kit || [])];
  (result as any).convertedFrom = { name: original.name, description: original.description || '' };
  return result;
}
