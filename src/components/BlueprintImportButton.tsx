import { useEffect, useRef, useState } from 'react';
import { MAX_BLUEPRINT_BYTES, parseElfBlueprint } from '../utils/elfBlueprint';
import type { Elf } from '../types';
export function BlueprintImportButton({ onImport }: { onImport: (elf: Elf) => void }) {
  const input = useRef<HTMLInputElement>(null), request = useRef(0);
  const [pending, setPending] = useState<ReturnType<typeof parseElfBlueprint> | null>(null), [error, setError] = useState('');
  useEffect(() => () => { request.current++; }, []);
  return <div className="text-sm"><button type="button" className="ios-button" onClick={() => input.current?.click()}>匯入圖紙</button>
    <input ref={input} aria-label="選擇精靈圖紙" type="file" accept=".json,application/json" className="hidden" onChange={async e => {
      const file = e.currentTarget.files?.[0], ticket = ++request.current; e.currentTarget.value = '';
      setError(''); setPending(null); if (!file) return;
      try { if (file.size > MAX_BLUEPRINT_BYTES) throw new Error('圖紙超過 2 MB'); const parsed = parseElfBlueprint(await file.text()); if (ticket === request.current) setPending(parsed); }
      catch (e) { if (ticket === request.current) setError((e as Error).message); }
    }} />
    {error && <p role="alert" className="text-rose-300 mt-2">{error}</p>}
    {pending && <section aria-label="確認匯入草稿" className="ios-card p-3 mt-2 max-w-sm space-y-2">
      <p className="text-blue-200">版本 {pending.version}：{pending.elf.name} · {pending.elf.skills.length} 招技能</p>
      <p className="text-amber-200">確認後會取代目前未儲存的草稿，不會直接儲存或覆寫倉庫中的其他精靈。</p>
      {pending.warnings.map((warning, i) => <p key={i} className="text-xs text-slate-400">{warning}</p>)}
      <div className="flex gap-3"><button type="button" onClick={() => { onImport(pending.elf); setPending(null); }}>確認匯入草稿</button><button type="button" onClick={() => { request.current++; setPending(null); }}>取消匯入</button></div>
    </section>}
  </div>;
}
