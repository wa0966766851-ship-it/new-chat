import React, { useState } from 'react';
import type { Elf } from '../types';
import { opCode } from '../data/opCatalog';
import { ELF_GROUPS, ELF_GROUP_CODES, ELF_GROUP_EFFECTS, ELF_GROUP_KIND_LABEL, elfGroups, suggestedElfGroupIds, type ElfGroupDefinition } from '../data/elfGroups';

export function ElfGroupEditor({ elf, readonly, sources = [], onChange }: {
  key?: React.Key;
  elf: Elf;
  readonly?: boolean;
  sources?: readonly Elf[];
  onChange: (elf: Elf) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ElfGroupDefinition['kind']>('group');
  const groups = elfGroups(elf);
  const selected = elf.groupIds ?? suggestedElfGroupIds(elf);
  const custom = elf.groupTags ?? [];
  const known = new Set(ELF_GROUPS.map(group => group.id));
  const otherTags = Array.from(new Map(sources.flatMap(e => e.groupTags ?? []).map(tag => [tag.id, tag])).values())
    .filter(tag => !known.has(tag.id));
  const options = [...ELF_GROUPS.filter(group => group.id !== 'extra'), ...otherTags];
  const canEdit = !readonly && !elf.isExtra;
  function toggle(group: ElfGroupDefinition) {
    if (known.has(group.id)) {
      onChange({ ...elf, groupIds: selected.includes(group.id) ? selected.filter(id => id !== group.id) : [...selected, group.id] });
      return;
    }
    onChange({ ...elf, groupTags: custom.some(tag => tag.id === group.id)
      ? custom.filter(tag => tag.id !== group.id) : [...custom, group] });
  }
  function add() {
    const label = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!label || ELF_GROUPS.some(group => group.name === label)) return;
    const found = [...otherTags, ...custom].find(tag => tag.name === label && tag.kind === kind);
    const id = found?.id ?? `custom:${kind}:${label.toLowerCase()}`;
    if (!custom.some(tag => tag.id === id)) onChange({ ...elf, groupTags: [...custom, found ?? { id, name: label, kind }] });
    setName('');
  }
  return <div className="space-y-3" data-elf-groups>
    <h3 className="font-bold text-sm">團體與標籤</h3>
    <div className="flex flex-wrap gap-1.5">
      {groups.length ? groups.map(group => <span key={group.id} title={[group.source,ELF_GROUP_EFFECTS[group.id]?.description].filter(Boolean).join(' · ')} className="atr-chip rounded border border-slate-600 px-2 py-1 text-xs">
        {ELF_GROUP_KIND_LABEL[group.kind]} · {group.name} {ELF_GROUP_CODES[group.id] && <span className="text-slate-400">{ELF_GROUP_CODES[group.id]}</span>}
        {canEdit && <button type="button" className="ml-2" aria-label={`移除${group.name}`} onClick={() => toggle(group)}>×</button>}
      </span>) : <span className="text-xs text-slate-400">尚未加入標籤</span>}
    </div>
    {groups.some(group=>ELF_GROUP_CODES[group.id]) && <details className="text-xs text-slate-300">
      <summary className="cursor-pointer">團體積木與效果</summary>
      <ul className="mt-2 space-y-1">
        {groups.filter(group=>ELF_GROUP_CODES[group.id]).map(group=>{
          const effect=ELF_GROUP_EFFECTS[group.id];
          return <li key={group.id}><span className="font-mono">{ELF_GROUP_CODES[group.id]}</span> {group.name} · Q-106
            {effect && <> · {effect.ops.map(op=>opCode(op,'condition')??opCode(op)).join('、')} · {effect.description}</>}
          </li>;
        })}
      </ul>
    </details>}
    {canEdit && <>
      <select aria-label="加入既有標籤" className="atr-select bg-slate-900 text-sm" value="" onChange={event => {
        const group = options.find(option => option.id === event.target.value);
        if (group) toggle(group);
      }}>
        <option value="">加入既有標籤</option>
        {options.filter(group => !groups.some(member => member.id === group.id)).map(group => <option key={group.id} value={group.id}>{ELF_GROUP_KIND_LABEL[group.kind]} · {group.name}{ELF_GROUP_CODES[group.id] ? ` · ${ELF_GROUP_CODES[group.id]}` : ''}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        <select aria-label="標籤類型" className="atr-select bg-slate-900 text-sm" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
          {Object.entries(ELF_GROUP_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input aria-label="新標籤名稱" placeholder="新標籤名稱" maxLength={32} className="min-w-24 flex-1 rounded border border-slate-600 bg-slate-900 px-2 text-sm" value={name}
          onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="atr-chip" disabled={!name.trim()} onClick={add}>新增</button>
      </div>
      {elf.groupIds && <button type="button" className="text-xs text-sky-300" onClick={() => onChange({ ...elf, groupIds: undefined })}>恢復預設歸屬</button>}
    </>}
  </div>;
}
