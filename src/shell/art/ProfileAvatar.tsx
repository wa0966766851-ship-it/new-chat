import React from 'react';
import { createPortal } from 'react-dom';
import type { Elf } from '../../types';
import { ElfAvatar } from '../../components/SeerImages';

import { ElfFilterBar, useElfFilter } from '../../components/shared/ElfPicker';
const KEY = 'seer_aegis_profile_avatar';
/** 頭像只記住精靈 ID，不儲存過期的精靈定義或戰鬥狀態。 */
export function ProfileAvatar({ elves }: { elves: Elf[] }) {
  const [id, setId] = React.useState(() => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } });
  const [open, setOpen] = React.useState(false);
  const filter = useElfFilter();
  const choices = React.useMemo(()=>filter.filter(elves),[filter.filter,elves]);
  const defaultElf = elves.find(e => e.name === '譜尼' || e.name === '谱尼') ?? elves.find(e => /譜尼|谱尼/.test(e.name)) ?? elves[0];
  const elf = elves.find(e => e.id === id) ?? defaultElf;
  const choose = (next: string) => { setId(next); try { localStorage.setItem(KEY, next); } catch {} setOpen(false); };
  return <>
    <button type="button" aria-label="更換玩家頭像" title="更換玩家頭像" onClick={() => setOpen(true)} className="rounded-full overflow-hidden w-10 h-10">
      {elf && <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />}
    </button>
    {open && createPortal(<div role="dialog" aria-modal="true" aria-label="更換玩家頭像" className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4">
      <section className="w-full max-w-xl max-h-[85dvh] rounded-xl bg-slate-950 text-slate-100 p-4 flex flex-col gap-3">
        <div className="flex gap-3 items-center"><strong className="flex-1">選擇玩家頭像</strong><button onClick={() => choose('')}>恢復譜尼</button><button onClick={() => setOpen(false)}>關閉</button></div>
        <ElfFilterBar state={filter} count={`${choices.length} / ${elves.length}`}/>
        <div className="overflow-y-auto grid grid-cols-4 sm:grid-cols-6 gap-2 min-h-0">
          {choices.map(e => <button key={e.id} onClick={() => choose(e.id)} className="p-1 rounded bg-slate-800 flex flex-col items-center gap-1" aria-pressed={e.id === elf?.id}>
            <ElfAvatar elf={e} kind="head" className="w-12 h-12 object-contain" /><span className="text-xs truncate w-full">{e.name}</span>
          </button>)}
          {!choices.length && <p className="col-span-full text-sm text-slate-400">找不到符合的精靈。</p>}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
