import React from "react";
import type { Elf } from "../../../types";
import * as E from "../../../modes/interstellar/v2/engine";
import { ElfAvatar, TypeIcon } from "../../SeerImages";
import { ElfFilterBar, ElfPicker, useElfFilter } from "../../shared/ElfPicker";
import { useSlotMover } from "../../shared/useSlotMover";
import { formatBigNumber, formatFullNumber } from "../../../utils/formatBigNumber";
import { alive, hpRatio } from "./parts";
import { dupOf } from "../../../modes/interstellar/v2/recruit";
import { AdvanceDialog, portalToRoot } from "./Recruit";

type Dispatch = (f: (r: E.RunV2) => E.RunV2) => void;
type Target = { kind: "member"; id: string } | { kind: "zone"; zone: E.BagZone; index?: number };
const STAT_LABEL: [keyof Elf["calculatedStats"], string][] = [["hp", "體"], ["atk", "攻"], ["def", "防"], ["spatk", "特攻"], ["spdef", "特防"], ["speed", "速"]];
const ZONE_LABEL: Record<E.BagZone, string> = { lineup: "出戰", bench: "待命", storage: "倉庫" };
const line = "border-[rgba(217,180,90,.2)]";
const btn = "text-[11px] px-2 py-0.5 border hover:bg-[rgba(217,180,90,.1)] disabled:opacity-35 disabled:hover:bg-transparent";
const gold = `${btn} border-[rgba(217,180,90,.5)]`, grey = `${btn} border-[rgba(169,159,139,.4)]`;

/** 背包（出戰＋待命）與倉庫：拖拉換位、點選互換、搜尋與屬性篩選、從倉庫直接替換。 */
export default function BagPage({ run, dispatch }: { run: E.RunV2; dispatch: Dispatch }) {
  const editable = E.canEditBag(run);
  const slots = E.lineupSlots(run), bslots = E.benchSlots(run);
  const lists = E.bagLists(run);
  const byId = React.useMemo(() => new Map(run.team.map(e => [E.bagIdOf(e), e])), [run.team]);
  const starterId = lists.lineup.find(id => alive(byId.get(id)!));
  const [picker, setPicker] = React.useState<{ zone: E.BagZone; index: number; occupant?: string } | null>(null);
  const [advancing, setAdvancing] = React.useState<string | null>(null);
  const filter = useElfFilter();
  const mover = useSlotMover<Target>((id, t) => dispatch(r => t.kind === "member" ? E.swapBagMembers(r, id, t.id) : E.moveBagMember(r, id, t.zone, t.index)));
  const lock = editable ? undefined : "戰鬥結算中，暫時不能整理背包";

  const badges = (e: Elf) => {
    const boost = Number((e as any).runBoost) || 0, dup = dupOf(e);
    return <>
      {E.bagIdOf(e) === starterId && <span className="text-[10px] px-1 border border-[var(--ecl-gold)] ecl-gilt">首發</span>}
      {!alive(e) && <span className="text-[10px] px-1 border border-[rgba(224,71,95,.6)] ecl-blood">陣亡</span>}
      {dup.stat > 0 && <span data-dup-badge="stat" className="text-[10px] px-1 border border-[rgba(217,180,90,.6)] ecl-gilt" title={`進階強化 ${dup.stat} 層：全能力 +${dup.stat * 40}%`}>強化 {dup.stat}</span>}
      {dup.pp && <span data-dup-badge="pp" className="text-[10px] px-1 border border-[rgba(79,209,197,.5)]" style={{ color: "var(--ecl-teal)" }} title="進戰鬥時技能 PP 與上限 ×2（PP 為 0 的技能不變）">PP×2</span>}
      {boost > 0 && <span className="text-[10px] px-1 border border-[rgba(79,209,197,.5)]" style={{ color: "var(--ecl-teal)" }}>淬鍊 +{Math.round(boost * 100)}%</span>}
    </>;
  };
  const avatar = (e: Elf, cls: string) => (
    <div className={`${cls} shrink-0 rounded-[50%] overflow-hidden border border-[rgba(217,180,90,.45)] bg-black/60 ${alive(e) ? "" : "grayscale"}`}>
      <ElfAvatar elf={e} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center font-black ecl-gilt" />
    </div>
  );

  /** 進階鈕：價格顯示在 tooltip；持有重複招募令時免費 */
  const advBtn = (e: Elf) => {
    const info = E.advanceInfo(run, e), prices = [info.stat, info.pp].filter((x): x is number => x != null), free = !!E.repeatTokenOf(run);
    const none = prices.length === 0, poor = !free && !none && run.shards < Math.min(...prices);
    return <button data-advance={E.bagIdOf(e)} className={gold} disabled={!editable || none || poor}
      title={lock ?? (none ? "已達進階上限" : poor ? `星晶不足（最低 ${Math.min(...prices)}）` : free ? "進階：持有重複招募令，免費一次" : `進階：強化 ${info.stat ?? "—"} 星晶／PP×2 ${info.pp ?? "—"} 星晶`)}
      onClick={() => setAdvancing(E.bagIdOf(e))}>進階{free && !none ? "・免費" : ""}</button>;
  };

  /** 出戰／待命格中的成員卡 */
  const memberCard = (e: Elf, zone: "lineup" | "bench", index: number) => {
    const id = E.bagIdOf(e), snap = E.snapshotElf(run, e), dead = !alive(e), sel = mover.selected === id;
    return (
      <div key={id} data-bag-slot={`${zone}-${index}`} data-member={id} {...(editable ? { ...mover.source(id), ...mover.target({ kind: "member", id }) } : {})}
        onClick={() => editable && mover.click(id, { kind: "member", id })} onDoubleClick={() => editable && setPicker({ zone, index, occupant: id })}
        className={`relative p-3 border cursor-pointer select-none ${sel ? "border-[var(--ecl-gold-hi)] shadow-[0_0_14px_rgba(246,226,160,.35)]" : id === starterId ? "border-[var(--ecl-gold)] bg-[rgba(217,180,90,.06)]" : `${line} bg-black/30`} ${dead ? "opacity-70" : ""} ${mover.dragging === id ? "opacity-40" : ""}`}>
        <div className="flex gap-3">
          {avatar(e, "w-14 h-16")}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap"><span className="font-black truncate">{e.name}</span>{badges(e)}</div>
            <div className="flex items-center gap-1 text-[11px] ecl-muted"><TypeIcon type={e.type} size={13} showLabelWhenMissing={false} />{e.type}<span className="ml-auto tabular-nums" title={`${formatFullNumber(Math.max(0, e.currentHp))} / ${formatFullNumber(e.maxHp)}`}>{formatBigNumber(Math.max(0, e.currentHp))} / {formatBigNumber(e.maxHp)}</span></div>
            <div className="ecl-hp mt-1"><i style={{ width: `${hpRatio(e) * 100}%` }} /></div>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-0.5 mt-2 text-center">
          {STAT_LABEL.map(([k, label]) => <div key={k} className="bg-black/40 py-0.5"><div className="text-[9px] ecl-muted">{label}</div><div className="text-[11px] font-black tabular-nums" title={formatFullNumber(Number(snap.calculatedStats?.[k]) || 0)}>{formatBigNumber(Number(snap.calculatedStats?.[k]) || 0)}</div></div>)}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {e.skills.map((sk, j) => (
            <span key={j} title={sk.name} className={`text-[10px] px-1 border ${(sk.pp ?? 0) <= 0 ? "border-[rgba(224,71,95,.4)] ecl-blood" : `${line} ecl-muted`}`}>
              {sk.name.length > 5 ? sk.name.slice(0, 5) + "…" : sk.name} {sk.pp ?? 0}/{sk.maxPp ?? sk.pp}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2" onClick={ev => ev.stopPropagation()}>
          {id !== starterId && !dead && <button className={gold} disabled={!editable} title={lock ?? "移到出戰最前"} onClick={() => dispatch(r => E.setStarter(r, r.team.findIndex(x => E.bagIdOf(x) === id)))}>設為首發</button>}
          <button className={gold} disabled={!editable} title={lock ?? "從倉庫或背包挑一隻換進來"} onClick={() => setPicker({ zone, index, occupant: id })}>更換</button>
          {advBtn(e)}
          <button className={grey} disabled={!editable || (zone === "lineup" && lists.lineup.length <= 1)} title={lock ?? (zone === "lineup" && lists.lineup.length <= 1 ? "出戰至少要有一隻" : "收進倉庫")} onClick={() => dispatch(r => E.moveBagMember(r, id, "storage"))}>存入倉庫</button>
        </div>
      </div>
    );
  };
  const emptyCell = (zone: "lineup" | "bench", index: number) => (
    <button key={`${zone}-e${index}`} data-bag-slot={`${zone}-${index}`} type="button" disabled={!editable} {...(editable ? mover.target({ kind: "zone", zone, index }) : {})}
      onClick={() => { if (!mover.click(null, { kind: "zone", zone, index })) setPicker({ zone, index }); }}
      className={`p-3 min-h-28 border border-dashed grid place-items-center text-sm ecl-muted ${mover.selected ? "border-[var(--ecl-gold)] bg-[rgba(217,180,90,.06)]" : "border-[rgba(217,180,90,.25)] hover:border-[rgba(217,180,90,.6)]"}`}
      title={lock ?? (mover.selected ? "放到這裡" : "點一下選擇精靈放進來")}>＋ 空位</button>
  );
  const lockedCell = (zone: "lineup" | "bench", index: number) => (
    <div key={`${zone}-l${index}`} className="p-3 min-h-28 border border-dashed border-[rgba(169,159,139,.18)] grid place-items-center text-xs ecl-muted opacity-60" title="背包格隨章節與遺物成長（最多各 6）">未開放</div>
  );
  const zoneCells = (zone: "lineup" | "bench", members: string[], cap: number) =>
    Array.from({ length: 6 }, (_, i) => i < members.length ? memberCard(byId.get(members[i])!, zone, i) : i < cap ? emptyCell(zone, i) : lockedCell(zone, i));

  /** 倉庫的小卡 */
  const storageList = filter.filter(lists.storage.map(id => byId.get(id)!));
  const storageCard = (e: Elf) => {
    const id = E.bagIdOf(e), dead = !alive(e), sel = mover.selected === id;
    const dest: E.BagZone | null = lists.bench.length < bslots ? "bench" : (!dead && lists.lineup.length < slots) ? "lineup" : null;
    return (
      <div key={id} data-member={id} data-bag-slot="storage" {...(editable ? { ...mover.source(id), ...mover.target({ kind: "member", id }) } : {})}
        onClick={() => editable && mover.click(id, { kind: "member", id })}
        className={`flex gap-3 p-2.5 border cursor-pointer select-none ${sel ? "border-[var(--ecl-gold-hi)] shadow-[0_0_14px_rgba(246,226,160,.35)]" : `${line} bg-black/25`} ${dead ? "opacity-70" : ""} ${mover.dragging === id ? "opacity-40" : ""}`}>
        {avatar(e, "w-11 h-12")}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap"><span className="font-black truncate">{e.name}</span>{badges(e)}</div>
          <div className="flex items-center gap-1 text-[11px] ecl-muted"><TypeIcon type={e.type} size={12} showLabelWhenMissing={false} />{e.type}</div>
          <div className="ecl-hp mt-1"><i style={{ width: `${hpRatio(e) * 100}%` }} /></div>
          <div className="flex flex-wrap gap-1.5 mt-1.5" onClick={ev => ev.stopPropagation()}>
            <button className={gold} disabled={!editable || !dest} title={lock ?? (dest ? `放入${ZONE_LABEL[dest]}` : dead ? "待命已滿，陣亡者不能上場" : "背包已滿，用「更換」或拖到格子上互換")}
              onClick={() => dest && dispatch(r => E.moveBagMember(r, id, dest))}>放入背包</button>
          </div>
        </div>
      </div>
    );
  };

  /** 更換視窗：挑一隻與該格互換（倉庫成員也在清單內） */
  const pickerElves = picker ? run.team.filter(e => E.bagIdOf(e) !== picker.occupant) : [];
  const pickerDisabled = (e: Elf): string | false => {
    if (!picker) return false;
    return E.bagMoveIssue(run, E.bagIdOf(e), picker.zone, picker.index);
  };
  const applyPick = (e: Elf) => {
    if (!picker || pickerDisabled(e)) return;
    const id = E.bagIdOf(e);
    dispatch(r => picker.occupant ? E.swapBagMembers(r, id, picker.occupant) : E.moveBagMember(r, id, picker.zone, picker.index));
    setPicker(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="ecl-muted tabular-nums" title="出戰與待命上限：第 1 章各 3，每章 +1，最多各 6（共 12）；排最前的存活者首發">背包 {lists.lineup.length + lists.bench.length} / {slots + bslots}</span>
        <span className="ecl-muted">拖拉或點選兩隻互換；雙擊更換</span>
        <span className="ml-auto flex gap-2">
          <button className={gold} disabled={!editable || E.swapLineupBench(run) === run} title={lock ?? "出戰與待命整排對調"} onClick={() => dispatch(E.swapLineupBench)}>對調出戰／待命</button>
          <button className={grey} disabled={!editable || !lists.bench.length} title={lock ?? "待命全部存入倉庫"} onClick={() => dispatch(E.stashBench)}>待命全收</button>
        </span>
      </div>
      <section>
        <h3 className="font-black tracking-widest ecl-gilt mb-2">出戰<span className="ml-2 text-xs ecl-muted tabular-nums">{lists.lineup.length} / {slots}</span></h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-zone="lineup">{zoneCells("lineup", lists.lineup, slots)}</div>
      </section>
      <section>
        <h3 className="font-black tracking-widest mb-2">待命<span className="ml-2 text-xs ecl-muted tabular-nums">{lists.bench.length} / {bslots}</span></h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-zone="bench">{zoneCells("bench", lists.bench, bslots)}</div>
      </section>
      <section data-zone="storage" {...(editable ? mover.target({ kind: "zone", zone: "storage" }) : {})} className={mover.dragging ? "outline outline-1 outline-dashed outline-[rgba(217,180,90,.45)] outline-offset-4" : ""}>
        <div className="flex items-baseline justify-between mb-2 gap-4 flex-wrap">
          <h3 className="font-black tracking-widest">倉庫<span className="ml-2 text-xs ecl-muted tabular-nums">{lists.storage.length}</span></h3>
          <span className="text-xs ecl-muted" title="倉庫隨時可查看與取回；星爐只修復背包內的精靈，倉庫不會恢復">星爐不修復倉庫</span>
        </div>
        {lists.storage.length > 0 && <div className="mb-3"><ElfFilterBar state={filter} variant="eclipse" count={`${storageList.length} / ${lists.storage.length}`} /></div>}
        {storageList.length
          ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{storageList.map(storageCard)}</div>
          : <p className="text-sm ecl-muted">{lists.storage.length ? "沒有符合的精靈" : "空。拖拉精靈到這裡，或背包滿時新夥伴會送進來。"}</p>}
      </section>

      {advancing && byId.get(advancing) && <AdvanceDialog run={run} target={byId.get(advancing)!} dispatch={dispatch} onClose={() => setAdvancing(null)} />}
      {picker && portalToRoot(
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-[2px] p-4 pt-16 md:p-10 overflow-y-auto" role="dialog" aria-label="更換精靈" onClick={() => setPicker(null)}>
          <div className="mx-auto max-w-4xl ecl-frame p-5 md:p-7 bg-[var(--ecl-ink-2)]" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="ecl-title text-xl ecl-gilt">{ZONE_LABEL[picker.zone]} 第 {picker.index + 1} 格・{picker.occupant ? "更換" : "放入"}</h3>
              <button className="ecl-btn ecl-btn-ghost text-xs px-4 py-1.5" onClick={() => setPicker(null)}>關閉</button>
            </div>
            <ElfPicker<Elf> variant="eclipse" elves={pickerElves} getKey={e => E.bagIdOf(e)} isDisabled={pickerDisabled} onPick={applyPick}
              gridClassName="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pr-1" itemClassName={`text-left flex gap-3 p-2.5 border ${line} bg-black/30 hover:border-[var(--ecl-gold)] disabled:opacity-40`}
              renderItem={e => (<>
                {avatar(e, "w-11 h-12")}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><span className="font-black truncate">{e.name}</span><span className="text-[10px] ecl-muted shrink-0">{ZONE_LABEL[E.bagZoneOf(run, E.bagIdOf(e))?.zone ?? "storage"]}</span></div>
                  <div className="flex items-center gap-1 text-[11px] ecl-muted"><TypeIcon type={e.type} size={12} showLabelWhenMissing={false} />{e.type}{!alive(e) && <span className="ecl-blood ml-1">陣亡</span>}</div>
                  <div className="ecl-hp mt-1"><i style={{ width: `${hpRatio(e) * 100}%` }} /></div>
                </div>
              </>)} />
          </div>
        </div>
      )}
    </div>
  );
}
