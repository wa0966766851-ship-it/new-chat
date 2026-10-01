import React from "react";
import type { Elf } from "../types";
import { formatEffectText } from "../utils/descFormat";
import { EffectBlockToggle } from './EffectBlockToggle';

export function getElfTraitEntries(elf: Elf) {
  const entries = [
    elf.soulMark && { kind: "專屬特性／魂印", ...elf.soulMark },
    elf.trait && { kind: "通用特性", ...elf.trait },
    elf.alienTraits?.gen2Trait && { kind: "二代異能特質", ...elf.alienTraits.gen2Trait },
    elf.alienTraits?.exclusiveTrait && { kind: "專屬異能特質", ...elf.alienTraits.exclusiveTrait },
    ...(elf.alienTraits?.exclusiveTraits || []).map(trait => ({ kind: "專屬異能特質", ...trait })),
    elf.alienTraits?.alienTrait && { kind: "異能特質", ...elf.alienTraits.alienTrait },
    elf.alienTraits?.generalTrait && { kind: "通用異能特性", ...elf.alienTraits.generalTrait },
  ].filter((entry): entry is { kind: string; name: string; description: string } => !!entry);
  return entries.filter((entry, i) => entries.findIndex(other => other.name === entry.name && other.description === entry.description) === i);
}

export function ElfTraitCards({ elf }: { elf: Elf }) {
  const entries = getElfTraitEntries(elf);
  return <section className="space-y-3" aria-label="魂印與特質">
    {entries.length ? entries.map((entry, i) => <details key={`${entry.kind}-${entry.name}`} className="ios-card p-4" open={i === 0}>
      <summary className="cursor-pointer text-[15px] font-semibold text-blue-200 leading-6">
        <span className="text-xs font-normal text-slate-400 mr-2">{entry.kind}</span>{entry.name}
      </summary>
      <EffectBlockToggle {...(entry.kind === '專屬特性／魂印' ? { elf } : { trait: entry })}><p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{formatEffectText(entry.description || "尚無描述")}</p></EffectBlockToggle>
    </details>) : <p className="text-sm text-slate-400">尚無已登記的專屬特性。</p>}
  </section>;
}
