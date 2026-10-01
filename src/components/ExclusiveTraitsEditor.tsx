import type { Elf } from '../types';
type Trait = NonNullable<Elf['alienTraits']>['exclusiveTrait'];
export function ExclusiveTraitsEditor({ traits, onChange }: { traits: NonNullable<Trait>[]; onChange: (traits: NonNullable<Trait>[]) => void }) {
  function move(index: number, delta: number) {
    const next = [...traits], other = index + delta;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]]; onChange(next);
  }
  return <section className="ios-card p-4 space-y-3" aria-label="其他專屬特質管理"><h4 className="text-sm text-red-200">其他專屬特質（{traits.length}）</h4>
    <p className="text-xs text-slate-400">與上方主要專屬特質分開保存。排序只調整資料／顯示順序，不保證改變戰鬥優先級；新增描述不等於實裝。</p>
    {traits.map((trait, index) => <div key={index} className="border border-white/10 rounded-xl p-3 space-y-2">
      <input aria-label={`專屬特質 ${index + 1} 名稱`} value={trait.name} className="w-full rounded-lg bg-slate-950 p-2 text-sm" onChange={e => onChange(traits.map((t, i) => i === index ? { ...t, name: e.target.value } : t))} />
      <textarea aria-label={`專屬特質 ${index + 1} 描述`} value={trait.description} rows={3} className="w-full rounded-lg bg-slate-950 p-2 text-sm" onChange={e => onChange(traits.map((t, i) => i === index ? { ...t, description: e.target.value } : t))} />
      <div className="flex gap-2 flex-wrap"><button type="button" aria-label={`上移專屬特質 ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>↑ 上移</button><button type="button" aria-label={`下移專屬特質 ${index + 1}`} disabled={index === traits.length - 1} onClick={() => move(index, 1)}>↓ 下移</button><button type="button" className="text-rose-300" aria-label={`刪除專屬特質 ${index + 1}`} onClick={() => { if (window.confirm(`刪除「${trait.name || '未命名特質'}」？尚未儲存前不會改寫精靈倉庫。`)) onChange(traits.filter((_, i) => i !== index)); }}>刪除</button></div>
    </div>)}
    <button type="button" className="ios-button" onClick={() => onChange([...traits, { name: '', description: '' }])}>新增專屬特質</button>
  </section>;
}
