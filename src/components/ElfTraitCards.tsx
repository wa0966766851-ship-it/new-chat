import React from "react";
import type { Elf } from "../types";
import { formatEffectText } from "../utils/descFormat";
import { EffectBlockToggle } from './EffectBlockToggle';
import { effectDefinitionEntries } from '../battle/effectSources';

export const getElfTraitEntries = effectDefinitionEntries;

export function ElfTraitCards({ elf }: { elf: Elf }) {
  const entries = getElfTraitEntries(elf);
  return <section className="space-y-3" aria-label="魂印與特質">
    {entries.length ? entries.map((entry, i) => <details key={`${entry.kind}-${entry.name}`} className="ios-card p-4" open={i === 0}>
      <summary className="cursor-pointer text-[15px] font-semibold text-blue-200 leading-6">
        <span className="text-xs font-normal text-slate-400 mr-2">{entry.kind}</span>{entry.name}
      </summary>
      <EffectBlockToggle {...(entry.soul ? { elf: entry.sourceElf } : { trait: entry })}><p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{formatEffectText(entry.description || "尚無描述")}</p></EffectBlockToggle>
    </details>) : <p className="text-sm text-slate-400">尚無已登記的專屬特性。</p>}
  </section>;
}
