import React from "react";
import type { Elf } from "../../../types";
import { MAX_N, N_LEVELS, clampN, nLabel } from "../../../modes/interstellar/v2/levels";
import { ElfAvatar, TypeIcon } from "../../SeerImages";
import { ElfPicker } from "../../shared/ElfPicker";

/** 種子欄：輸入種子、文字或完整局碼；可隨機、複製局碼。 */
export function SeedField({ value, onChange, onRandom, onCopy, note, copied }: { value: string; onChange: (v: string) => void; onRandom: () => void; onCopy: () => void; note?: string; copied?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-black tracking-widest shrink-0" htmlFor="ecl-seed" title="同一個種子（連同 N 等級、裝束、契約、禁用）會產生完全相同的一局">種子</label>
        <input id="ecl-seed" value={value} onChange={e => onChange(e.target.value)} spellCheck={false} placeholder="數字、文字或局碼"
          className="flex-1 min-w-0 bg-black/50 border border-[rgba(217,180,90,.3)] focus:border-[var(--ecl-gold)] px-3 py-1.5 text-sm tabular-nums focus:outline-none" />
        <button type="button" className="ecl-btn ecl-btn-ghost text-xs px-3 py-1.5" onClick={onRandom} title="換一個隨機種子">隨機</button>
        <button type="button" className="ecl-btn ecl-btn-ghost text-xs px-3 py-1.5" onClick={onCopy} title="複製完整局碼（含 N 等級、裝束、契約、禁用），貼回種子欄即可復刻">{copied ? "已複製" : "複製局碼"}</button>
      </div>
      {note && <div className="text-xs ecl-blood mt-1.5">{note}</div>}
    </div>
  );
}

/** N0–N18 難度選擇。 */
export function LevelPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const n = clampN(value);
  const cur = N_LEVELS[n - 1];
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-black tracking-widest shrink-0" title={N_LEVELS.slice(0, n).map(l => `N${l.n} ${l.text}`).join("\n") || "N0 沒有額外限制"}>等級</span>
        <input type="range" min={0} max={MAX_N} step={1} value={n} onChange={e => onChange(Number(e.target.value))} aria-label="N 等級" className="flex-1 accent-[var(--ecl-gold)]" />
        <span className={`ecl-title text-2xl w-14 text-right tabular-nums ${n >= 12 ? "ecl-blood" : "ecl-gilt"}`}>{nLabel(n)}</span>
      </div>
      <div className="text-xs ecl-muted mt-1 min-h-4">{cur ? `${nLabel(n)}　${cur.text}` : "無額外限制"}</div>
    </div>
  );
}

/** 禁用名單：被禁用的精靈本局不會出現在招募、敵方、商店與獎勵。 */
export function BanPicker({ bans, pool, cap, onChange }: { bans: string[]; pool: Elf[]; cap: number; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const byId = React.useMemo(() => new Map(pool.map(e => [String(e.id), e])), [pool]);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-black tracking-widest" title="被禁用的精靈本局不會出現：招募池、敵方、商店、獎勵都排除">禁用</span>
        <span className="flex items-center gap-3">
          <span className="text-xs ecl-muted tabular-nums" title="名額隨 N 等級減少：N0 為 6，每 3 階 −1，N18 為 0；部分套裝特權可 +1">{bans.length} / {cap}</span>
          <button type="button" className="ecl-btn ecl-btn-ghost text-xs px-3 py-1" disabled={bans.length >= cap} onClick={() => setOpen(true)}>＋ 禁用</button>
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2 min-h-8">
        {bans.map(id => { const e = byId.get(id); return (
          <span key={id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 border border-[rgba(224,71,95,.45)] bg-[rgba(155,28,49,.12)] text-sm">
            {e && <span className="w-6 h-6 rounded-full overflow-hidden border border-[rgba(224,71,95,.4)] bg-black/60"><ElfAvatar elf={e} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center text-[10px] ecl-gilt" /></span>}
            <span className="font-black">{e?.name ?? id}</span>
            <button type="button" aria-label={`取消禁用 ${e?.name ?? id}`} className="ecl-blood hover:text-white" onClick={() => onChange(bans.filter(x => x !== id))}>✕</button>
          </span>); })}
        {!bans.length && <span className="text-xs ecl-muted self-center">未禁用</span>}
      </div>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-[2px] p-4 pt-16 ecl-md:p-10 overflow-y-auto" role="dialog" aria-label="選擇禁用精靈" onClick={() => setOpen(false)}>
          <div className="mx-auto max-w-5xl ecl-frame p-5 ecl-md:p-7 bg-[var(--ecl-ink-2)]" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="ecl-title text-xl ecl-gilt">禁用精靈<span className="ml-3 text-sm ecl-muted tabular-nums">{bans.length} / {cap}</span></h3>
              <button className="ecl-btn ecl-btn-ghost text-xs px-4 py-1.5" onClick={() => setOpen(false)}>完成</button>
            </div>
            <ElfPicker<Elf> variant="eclipse" elves={pool.filter(e => !bans.includes(String(e.id)))} getKey={e => String(e.id)}
              onPick={e => { const next = [...bans, String(e.id)]; onChange(next); if (next.length >= cap) setOpen(false); }}
              gridClassName="grid grid-cols-2 ecl-sm:grid-cols-3 ecl-lg:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-1"
              itemClassName="text-left flex items-center gap-2.5 p-2 border border-[rgba(217,180,90,.2)] bg-black/30 hover:border-[rgba(224,71,95,.7)]"
              renderItem={e => (<>
                <span className="w-10 h-11 shrink-0 rounded-[50%] overflow-hidden border border-[rgba(217,180,90,.4)] bg-black/60"><ElfAvatar elf={e} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center text-xs ecl-gilt" /></span>
                <span className="min-w-0"><span className="block font-black text-sm truncate">{e.name}</span><span className="flex items-center gap-1 text-[11px] ecl-muted"><TypeIcon type={e.type} size={12} showLabelWhenMissing={false} />{e.type}</span></span>
              </>)} />
          </div>
        </div>
      )}
    </div>
  );
}
