import React from "react";
import type { Elf } from "../types";
import { EffectDescription } from './EffectDescription';
import { EffectBlockToggle } from './EffectBlockToggle';
import { effectDefinitionEntries } from '../battle/effectSources';

/** 魂印是被動效果總稱；介紹只列精靈本身的效果，配置檢視仍可列出通用特性。 */
export function getElfTraitEntries(elf: Elf, { includeConfigurable = true } = {}) {
  return effectDefinitionEntries(elf).filter(entry => includeConfigurable || !entry.configurable);
}

export function ElfTraitCards({ elf }: { elf: Elf }) {
  const entries = getElfTraitEntries(elf);
  return <section className="space-y-3" aria-label="魂印">
    {entries.length ? entries.map((entry, i) => <details key={`${entry.kind}-${entry.name}`} className="ios-card p-4" open={i === 0}>
      <summary className="cursor-pointer text-[15px] font-semibold text-blue-200 leading-6">
        <span className="text-xs font-normal text-slate-400 mr-2">{entry.kind}</span>{entry.name}
      </summary>
      <EffectBlockToggle {...(entry.soul ? { elf: entry.sourceElf } : { trait: entry })}><EffectDescription description={entry.description || "尚無描述"} className="text-sm leading-7 text-slate-200" /></EffectBlockToggle>
    </details>) : <p className="text-sm text-slate-400">尚無已登記的魂印效果。</p>}
  </section>;
}
