import React from 'react';
import type { Elf, Skill } from '../types';
import { effectSourceViews } from '../battle/effectSources';
import { getMaxPp } from '../utils/battleHelpers';

/** PP 與充能是不同資源；只讀顯示，不能將充能回寫 PP。 */
export function skillResourceView(elf: Elf, skill: Skill, maxPp = getMaxPp(skill, elf)) {
  const permanentFull = effectSourceViews(elf).some(source => source.name === '變革·馬爾修斯');
  return { maxPp, pp: permanentFull ? maxPp : skill.pp, permanentFull,
    charge: skill.charge ?? (permanentFull ? skill.pp : undefined) };
}

export function SkillResources({ elf, skill, maxPp, normalLabel = 'PP' }: {
  elf: Elf; skill: Skill; maxPp?: number; normalLabel?: string;
}) {
  const resource = skillResourceView(elf, skill, maxPp);
  return <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums" data-skill-resources={skill.name}>
    <span title={resource.permanentFull ? '魂印規則：戰鬥中PP始終視為滿；充能另行計算，0充能仍可選招。' : undefined}>
      {resource.permanentFull ? 'PP' : normalLabel} <b className={resource.pp <= 1 ? 'text-rose-400' : 'text-slate-100'}>{resource.permanentFull ? `${resource.pp}/${resource.maxPp}` : `${resource.pp} / ${resource.maxPp}`}</b>{resource.permanentFull && <span className="ml-1 text-[10px]">恆滿</span>}
    </span>
    {resource.charge !== undefined && <span title="充能無PP上限限制；最低0。">充能 <b className={resource.charge <= 0 ? 'text-rose-400' : 'text-amber-300'}>{resource.charge}</b></span>}
  </span>;
}
