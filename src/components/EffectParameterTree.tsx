import React, { useState } from 'react';
import { effectFieldLabel, type EffectValuePath } from '../effects/effectVisualTree';
import { sequenceActionLabel } from '../effects/sequencePresentation';
import { EFFECT_NODE_LABELS } from '../effects/effectNodes';
import { ELF_GROUPS, ELF_GROUP_CODES, ELF_GROUP_TARGETS, elfGroupCondition } from '../data/elfGroups';

interface Props {
  value: any;
  onChange?: (path: EffectValuePath, value: unknown) => void;
  disabled?: boolean;
}
const VALUES: Record<string, string> = {self:'自身',opp:'對手',opponent:'對手',both:'雙方',team:'己方全隊',bench:'場下',now:'當回合起',next:'下回合起',success:'前項成功',fail:'前項失敗',any_fail:'任一前項失敗'};
const valueLabel = (value: unknown) => typeof value === 'string' && Object.hasOwn(VALUES, value) ? VALUES[value] : '';
function summary(value: any, name: string): string {
  if (typeof value?.op === 'string') {
    // 尚未填齊的編輯草稿也能顯示，不讓摘要中斷整棵參數樹。
    try { return sequenceActionLabel(value) || `動作 ${value.op}`; } catch { return `動作 ${value.op}`; }
  }
  if (value?.c==='elf_group' && typeof value.p?.id==='string') return `Q-106 · ${elfGroupCondition(value.p.id,value.p.target).label}`;
  if (typeof value?.c === 'string') return `條件：${value.label || value.c}`;
  if (value?.node) return `${(Object.hasOwn(EFFECT_NODE_LABELS, value.node) ? EFFECT_NODE_LABELS[value.node as keyof typeof EFFECT_NODE_LABELS] : value.node)} · ${value.customText || value.codeId}`;
  if (Array.isArray(value?.acts)) return `分支 · ${valueLabel(value.chain) || '一般執行'}${value.live ? ' · 即時判定' : value.pre ? ' · 句首快照' : ''}`;
  if (typeof value?.trig === 'string') return `${value.raw || name} · ${value.trig}`;
  return Array.isArray(value) ? `${name}（${value.length} 項）` : name;
}

function Scalar({value, path, name, onChange, disabled}: Props & {path: EffectValuePath;name: string}) {
  const id = JSON.stringify(path);
  if (!onChange || value === null || typeof value === 'object') return <span data-effect-value={id} className="break-words">{name}：{value === null ? '未指定' : Array.isArray(value) ? '空清單' : typeof value === 'object' ? '空參數' : typeof value === 'boolean' ? value ? '是' : '否' : valueLabel(value) || String(value)}{valueLabel(value) ? `（${value}）` : ''}</span>;
  return <label data-effect-value={id} className="flex flex-wrap items-center gap-2 py-1 text-xs">
    <span className="text-slate-400">{name}</span>
    {typeof value === 'boolean' ? <input aria-label={`${name} ${id}`} type="checkbox" checked={value} disabled={disabled} onChange={e=>onChange(path,e.target.checked)} />
      : <input aria-label={`${name} ${id}`} type={typeof value === 'number' ? 'number' : 'text'} step={typeof value === 'number' ? 'any' : undefined} value={value} disabled={disabled}
        className="min-w-0 flex-1 rounded border border-white/15 bg-slate-950 p-1.5 text-cyan-200 disabled:opacity-50"
        onChange={e=>{if(typeof value !== 'number')onChange(path,e.target.value);else if(e.target.value !== '' && Number.isFinite(e.target.valueAsNumber))onChange(path,e.target.valueAsNumber);}} />}
  </label>;
}

/** 所有欄位與所有巢狀分支均由原資料產生；包含否則、規則、到期與抵擋後流程。 */
function ElfGroupPreset({add,allowDefeated,disabled}:{add:(value:ReturnType<typeof elfGroupCondition>)=>void;allowDefeated:boolean;disabled?:boolean}) {
  const [target,setTarget]=useState<keyof typeof ELF_GROUP_TARGETS>('self');
  return <div className="flex flex-wrap items-center gap-2 py-1 text-xs" data-group-condition-preset>
    <select aria-label="團體查詢對象" value={target} disabled={disabled} onChange={e=>setTarget(e.target.value as typeof target)}>
      {Object.entries(ELF_GROUP_TARGETS).filter(([key])=>allowDefeated||key!=='defeated').map(([key,label])=>
        <option key={key} value={key}>{label}</option>)}
    </select>
    <select aria-label="加入精靈團體條件" value="" disabled={disabled} onChange={e=>{if(e.target.value)add(elfGroupCondition(e.target.value,target));}}>
      <option value="">加入團體條件（Q-106）</option>
      {ELF_GROUPS.map(group=><option key={group.id} value={group.id}>{ELF_GROUP_CODES[group.id]} {group.name}</option>)}
    </select>
  </div>;
}

export function EffectParameterTree({value, onChange, disabled}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [presetPath,setPresetPath]=useState<string>();
  const render = (current: any, path: EffectValuePath, name: string, trigger?:string): React.ReactNode => {
    const currentTrigger = current?.trig ?? trigger;
    const conditions = Array.isArray(current) && ['cond','conditions'].includes(String(path.at(-1)));
    const newConditions = Array.isArray(current?.acts) && current.cond===undefined;
    const pathKey=JSON.stringify(path);
    const preset = onChange && !disabled && (conditions || newConditions) &&
      (presetPath===pathKey
        ? <ElfGroupPreset allowDefeated={currentTrigger==='kill'}
          add={condition=>{onChange(path,conditions?[...current,condition]:{...current,cond:[condition]});setPresetPath(undefined);}} />
        : <button type="button" className="text-xs text-cyan-300" onClick={()=>setPresetPath(pathKey)}>＋團體條件</button>);
    const children = current !== null && typeof current === 'object' ? Object.entries(current) : [];
    if (!children.length && !preset) return <div key={JSON.stringify(path)}><Scalar value={current} path={path} name={name} onChange={onChange} disabled={disabled} /></div>;
    return <details key={JSON.stringify(path)} open={expanded || path.length < 1} data-effect-branch={JSON.stringify(path)} className="my-1 rounded border border-white/10 bg-white/[0.02] p-2">
      <summary className="cursor-pointer break-words text-xs text-blue-200" title={path.join('.')}>{summary(current,name)}</summary>
      <div className="ml-1 mt-2 space-y-1 border-l border-blue-400/25 pl-2">{preset}{children.map(([key, child])=>render(child,[...path,Array.isArray(current)?Number(key):key],effectFieldLabel(Array.isArray(current)?Number(key):key),currentTrigger))}</div>
    </details>;
  };
  return <div data-effect-parameter-tree>
    <button type="button" className="my-1 text-xs text-cyan-300" onClick={()=>setExpanded(!expanded)}>{expanded ? '收合所有分支' : '展開所有分支'}</button>
    {render(value,[],'積木流程')}
  </div>;
}
