// P4: Op-code lookup panel. Read-only UI over the L3 catalog + L4 usage index.
// No battle logic. See docs/op-code-system.md.
import React, { useMemo, useState } from 'react';
import { CONDITION_CATALOG, OP_CATALOG, OP_CODES, OP_FAMILY_LABEL, opCode, opsByFamily, type OpFamily } from '../data/opCatalog';
import { OP_ALIAS_FAMILIES, ALIAS_BY_CODE, aliasFamiliesOf } from '../data/opAliases';
import usage from '../../docs/audits/op-usage.json';
import { opTitle } from '../data/encyclopediaIndex';
import { ELF_GROUPS, ELF_GROUP_CODES, ELF_GROUP_EFFECTS, elfGroupDefinition } from '../data/elfGroups';

type Mode = 'byCode' | 'byElf' | 'families';

const byCode = usage.byCode as Record<string, { op: string; count: number; elves: string[] }>;
// 2026-11-14：op-usage.json 新版把代碼拆成 actionCode／conditionCode（舊版為 code）；兩種格式都接受。
// 原本的型別斷言與新格式不相容，造成 tsc 失敗——桌面 desktop:update 以 tsc 為第一道關卡，因此一直無法產出新版。
type OpUsageRow = { code?: string | null; actionCode?: string | null; conditionCode?: string | null; count: number; elves: string[]; definitions: string[] };
const byOp: Record<string, { code: string | null; count: number; elves: string[]; definitions: string[] }> = Object.fromEntries(
  Object.entries(usage.byOp as unknown as Record<string, OpUsageRow>).map(([op, v]) => [op, { code: v.code ?? v.actionCode ?? v.conditionCode ?? null, count: v.count, elves: v.elves, definitions: v.definitions }]));
const aliasFamilies = usage.aliasFamilies as Array<{
  id: string; canonicalCode: string; family: string; label: string; intent: string;
  memberCount: number; usedMembers: string[]; unusedMembers: string[]; elves: string[]; referenceCount: number;
}>;

const FAMILIES: OpFamily[] = ['A', 'C', 'D', 'G', 'H', 'M', 'P', 'S', 'T', 'X', 'Q'];
const ENTRY_BY_CODE: Record<string,{op:string;conditionCode?:string}> = {
  ...Object.fromEntries(Object.values(CONDITION_CATALOG).map(e=>[e.code,e])),
  ...Object.fromEntries(Object.values(OP_CATALOG).map(e => [e.code, e])),
};
const lookupCodes = [...new Set([...OP_CODES,...Object.keys(ENTRY_BY_CODE).filter(code=>code.startsWith('Q-'))])];

/** initialQuery：從百科總索引跳來時帶入的積木名稱，直接搜尋並選取其代號。 */
export const OpCodePanel: React.FC<{ initialQuery?: string }> = ({ initialQuery }) => {
  const [mode, setMode] = useState<Mode>('byCode');
  const [query, setQuery] = useState(initialQuery ?? '');
  const [family, setFamily] = useState<OpFamily | 'all'>('all');
  const [selectedCode, setSelectedCode] = useState<string | null>(initialQuery ? OP_CATALOG[initialQuery]?.code ?? (lookupCodes.includes(initialQuery)?initialQuery:elfGroupDefinition(initialQuery)?'Q-106':null) : null);

  const codes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groupMatches = ELF_GROUPS.some(group=>[group.name,group.id,ELF_GROUP_CODES[group.id]].some(v=>v?.toLowerCase().includes(q)));
    return lookupCodes.filter(c => {
      if (family !== 'all' && !c.startsWith(family + '-')) return false;
      if (!q || (c==='Q-106' && groupMatches)) return true;
      const entry = ENTRY_BY_CODE[c];
      const op = entry?.op || '';
      return c.toLowerCase().includes(q) || op.toLowerCase().includes(q) || (entry?.conditionCode ?? '').toLowerCase().includes(q) || (opTitle(op) ?? '').toLowerCase().includes(q);
    }).sort();
  }, [query, family]);

  const elfReverse = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as Array<{ code: string; op: string; count: number; definitions: string[] }>;
    const hits: Record<string, { code: string; op: string; count: number; definitions: string[] }> = {};
    for (const [op, v] of Object.entries(byOp)) {
      if (!v.code || !v.elves.some(e => e.includes(q))) continue;
      const e = hits[v.code] ??= { code: v.code, op: '', count: 0, definitions: [] };
      e.op = op; e.count += v.count;
      for (const d of v.definitions) if (!e.definitions.includes(d)) e.definitions.push(d);
    }
    return Object.values(hits).sort((a, b) => a.code.localeCompare(b.code));
  }, [query]);

  const detail = selectedCode ? byCode[selectedCode] : null;
  const alias = selectedCode ? ALIAS_BY_CODE[selectedCode] : undefined;
  const groupQuery = query.trim().toLowerCase();
  const listedGroups = ELF_GROUPS.filter(group=>[group.name,group.id,ELF_GROUP_CODES[group.id]].some(v=>v?.toLowerCase().includes(groupQuery)));

  return (
    <div className="space-y-5 animate-fade-in pb-8" data-testid="op-code-panel">
      <div className="bg-gradient-to-r from-cyan-500/10 via-violet-500/5 to-transparent border border-cyan-500/20 p-5 rounded-2xl">
        <h3 className="text-base font-bold text-slate-100">積木代號查詢（L3 / L4）</h3>
        <p className="text-xs text-slate-400 mt-1">
          依代號查執行動作、依精靈反查用了哪些代號、或瀏覽同語意家族。
          代號只做對照，不改寫戰鬥邏輯。共 {lookupCodes.length} 個代號、{usage.totals.opReferences} 筆引用、{aliasFamilies.length} 個家族。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(['byCode', 'byElf', 'families'] as const).map(m => (
          <button key={m} data-active={mode === m} onClick={() => { setMode(m); setSelectedCode(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 data-[active=true]:bg-cyan-500/20 data-[active=true]:border-cyan-400/40">
            {m === 'byCode' ? '依代號查' : m === 'byElf' ? '依精靈反查' : '語意家族'}
          </button>
        ))}
        {(mode === 'byCode' || mode === 'byElf') && (
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder={mode === 'byCode' ? '輸入 S-016 或 status...' : '輸入精靈 ID，例如 5022'}
            className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-slate-100" />
        )}
        {mode === 'byCode' && (
          <select value={family} onChange={e => setFamily(e.target.value as OpFamily | 'all')}
            className="px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-slate-100">
            <option value="all">全部族</option>
            {FAMILIES.map(f => <option key={f} value={f}>{f} {OP_FAMILY_LABEL[f]}</option>)}
          </select>
        )}
      </div>

      {mode === 'byCode' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-white/10 rounded-xl p-3 max-h-[420px] overflow-y-auto">
            <div className="text-[11px] text-slate-400 mb-2">{codes.length} 個代號</div>
            <div className="space-y-1">
              {codes.map(c => {
                const op = ENTRY_BY_CODE[c].op;
                const u = byCode[c];
                return (
                  <button key={c} onClick={() => setSelectedCode(c)}
                    data-selected={selectedCode === c}
                    className="w-full text-left px-2 py-1.5 rounded text-xs data-[selected=true]:bg-cyan-500/20 hover:bg-white/5">
                    <span className="font-mono font-bold text-cyan-300">{c}</span>
                    <span className="ml-2 text-slate-200">{op}</span>
                    {opTitle(op) && <span className="ml-2 text-slate-400">{opTitle(op)}</span>}
                    {ENTRY_BY_CODE[c]?.conditionCode && <span className="ml-2 font-mono text-amber-300/80">{ENTRY_BY_CODE[c].conditionCode}</span>}
                    {u && <span className="ml-2 text-slate-500">{u.count}× / {u.elves.length} 精靈</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border border-white/10 rounded-xl p-4">
            {!selectedCode ? <p className="text-xs text-slate-500">點左側代號看詳情</p> : (
              <div className="space-y-3">
                <div className="font-mono text-lg font-bold text-cyan-300">{selectedCode}</div>
                <div className="text-sm text-slate-100">{detail?.op || ENTRY_BY_CODE[selectedCode]?.op}</div>
                {opTitle(ENTRY_BY_CODE[selectedCode]?.op ?? '') && <div className="text-sm text-cyan-100">{opTitle(ENTRY_BY_CODE[selectedCode]?.op ?? '')}</div>}
                {ENTRY_BY_CODE[selectedCode]?.conditionCode && <div className="text-xs text-amber-300/80">條件代號：<span className="font-mono">{ENTRY_BY_CODE[selectedCode].conditionCode}</span></div>}
                <div className="text-xs text-slate-400">族：{selectedCode[0]} {OP_FAMILY_LABEL[selectedCode[0] as OpFamily]}</div>
                {selectedCode==='Q-106' && <div className="space-y-2 text-xs text-slate-300">
                  <p>依編號查詢自身、對手或被擊敗精靈的團體歸屬。可在樹狀積木編輯加入條件。</p>
                  <ul className="max-h-60 space-y-1 overflow-y-auto">
                    {(listedGroups.length?listedGroups:ELF_GROUPS).map(group=>{
                      const effect=ELF_GROUP_EFFECTS[group.id];
                      return <li key={group.id}><span className="font-mono text-cyan-300">{ELF_GROUP_CODES[group.id]}</span> {group.name}
                        {effect && <div className="my-1 flex flex-wrap items-center gap-1">
                          {effect.ops.map(op=>{
                            const code=opCode(op,'condition')??opCode(op);
                            return <button type="button" key={op} className="rounded border border-white/15 px-1 font-mono text-cyan-300"
                              title={opTitle(op)??op} onClick={()=>{setFamily('all');setQuery(code??op);setSelectedCode(code??null);}}>{code??op}</button>;
                          })}
                          <span>{effect.description}</span>
                        </div>}
                      </li>;
                    })}
                  </ul>
                </div>}
                {detail ? (
                  <>
                    <div className="text-xs text-slate-300">引用 {detail.count} 次，精靈：{detail.elves.join('、') || '（無）'}</div>
                    <div className="text-xs text-slate-400">所屬定義：{byOp[detail.op]?.definitions.join('、') || '—'}</div>
                  </>
                ) : <div className="text-xs text-amber-400">此代號目前沒有資料層引用（可能只由引擎內部呼叫）</div>}
                {alias && (
                  <div className="mt-3 p-3 rounded-lg bg-violet-500/10 border border-violet-400/20">
                    <div className="text-xs font-bold text-violet-200">語意家族：{alias.label}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{alias.intent}</div>
                    <div className="text-[11px] text-slate-300 mt-2">成員 {alias.members.length} 個：{alias.members.join('、')}</div>
                  </div>
                )}
                {!alias && detail && aliasFamiliesOf(detail.op).length > 0 && (
                  <div className="text-[11px] text-violet-300">所屬家族：{aliasFamiliesOf(detail.op).map(f => f.label).join('、')}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'byElf' && (
        <div className="border border-white/10 rounded-xl p-3">
          {!query ? <p className="text-xs text-slate-500">輸入精靈 ID 反查</p> : elfReverse.length === 0
            ? <p className="text-xs text-slate-500">查無引用</p> : (
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400 mb-2">{elfReverse.length} 個代號</div>
                {elfReverse.map(e => (
                  <div key={e.code} className="text-xs px-2 py-1.5 rounded hover:bg-white/5">
                    <span className="font-mono font-bold text-cyan-300">{e.code}</span>
                    <span className="ml-2 text-slate-200">{e.op}</span>
                    <span className="ml-2 text-slate-500">{e.count}× · {e.definitions.join('、') || '—'}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {mode === 'families' && (
        <div className="space-y-3">
          {aliasFamilies.map(f => (
            <div key={f.id} className="border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-cyan-300">{f.canonicalCode}</span>
                <span className="text-sm font-bold text-slate-100">{f.label}</span>
                <span className="text-[11px] text-slate-500">{f.memberCount} 成員 / {f.referenceCount} 引用</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{f.intent}</div>
              <div className="text-[11px] text-slate-300 mt-2">已使用：{f.usedMembers.join('、') || '（無）'}</div>
              {f.unusedMembers.length > 0 && <div className="text-[11px] text-slate-500 mt-1">未引用：{f.unusedMembers.join('、')}</div>}
              {f.elves.length > 0 && <div className="text-[11px] text-slate-400 mt-1">相關精靈：{f.elves.join('、')}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
