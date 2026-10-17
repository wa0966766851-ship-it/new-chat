import React from "react";
import { createPortal } from "react-dom";
import type { Elf } from "../../../types";
import * as E from "../../../modes/interstellar/v2/engine";
import { DUP_STAT_PER_LAYER, TIER_TEXT, dupOf, tokenBrief, tokenGroupKey, tokenHint, tokenLabel, type RecruitToken } from "../../../modes/interstellar/v2/recruit";
import { ElfAvatar, TypeIcon } from "../../SeerImages";
import { ElfPicker } from "../../shared/ElfPicker";
import { alive, hpRatio } from "./parts";

type Dispatch = (f: (r: E.RunV2) => E.RunV2) => void;
const line = "border-[rgba(217,180,90,.2)]";

/** 令牌小徽：款式一眼可辨（任意＝金、單屬性＝青、雙屬性＝紫、重複＝紅） */
export const TokenChip: React.FC<{ token: RecruitToken; count?: number; onClick?: () => void; disabled?: boolean; title?: string }> = ({ token, count, onClick, disabled, title }) => {
  const tone = token.repeat ? "rgba(224,71,95,.6)" : token.kind === "any" ? "rgba(217,180,90,.6)" : token.match === "exact" ? "rgba(192,132,252,.6)" : "rgba(79,209,197,.6)";
  return (
    <button type="button" data-token={token.id} disabled={disabled || !onClick} onClick={onClick} title={title ?? tokenHint(token)}
      className="inline-flex items-center gap-2 px-3 py-1.5 border bg-black/40 text-sm font-black hover:bg-[rgba(217,180,90,.08)] disabled:cursor-default disabled:hover:bg-black/40" style={{ borderColor: tone }}>
      <span className="ecl-gilt">✦</span>{tokenLabel(token)}
      {token.tier && !token.repeat && <span className="text-[10px] ecl-muted font-normal">{TIER_TEXT[token.tier].slice(0, 1)}</span>}
      {count && count > 1 ? <span className="text-xs ecl-muted tabular-nums">×{count}</span> : null}
    </button>
  );
};

/** 星晶價籤：價格＋不足提示；持令時顯示「免費」 */
export const ShardPrice: React.FC<{ price: number; have: number; free?: boolean }> = ({ price, have, free }) => (
  free
    ? <span className="text-[11px] font-black" style={{ color: "var(--ecl-teal)" }} data-price="free">免費</span>
    : <span className={`text-[11px] font-black tabular-nums ${have >= price ? "ecl-gilt" : "ecl-blood"}`} data-price={price} title={have >= price ? undefined : `星晶不足（持有 ${have}）`}>✦ {price}</span>
);

/** 進階二選一：強化（全能力 +40%／層）或 PP 與上限 ×2；持有重複招募令時免費。 */
export function AdvanceChoice({ run, target, dispatch, onDone }: { run: E.RunV2; target: Elf; dispatch: Dispatch; onDone: () => void }) {
  const info = E.advanceInfo(run, target), d = dupOf(target), free = !!E.repeatTokenOf(run);
  const go = (how: "stat" | "pp") => { dispatch(r => E.advanceElf(r, E.bagIdOf(target), how)); onDone(); };
  const can = (price: number | null) => price != null && (free || run.shards >= price) && E.canEditBag(run);
  return (
    <div className="space-y-4" data-testid="dup-choice">
      <div className={`flex gap-3 p-3 border ${line} bg-black/30`}>
        <div className="w-14 h-16 shrink-0 rounded-[50%] overflow-hidden border border-[rgba(217,180,90,.45)] bg-black/60"><ElfAvatar elf={target} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center font-black ecl-gilt" /></div>
        <div className="min-w-0"><div className="font-black text-lg">{target.name}</div><div className="text-xs ecl-muted">強化 {info.layers} / {info.cap} 層{d.pp ? "・PP×2 已選" : ""}</div></div>
        <div className="ml-auto text-xs ecl-muted self-start tabular-nums" title="進階與招募共用的貨幣">星晶 <b className="ecl-gilt">{run.shards}</b></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <button type="button" disabled={!can(info.stat)} onClick={() => go("stat")} data-dup="stat" className="text-left p-4 border border-[rgba(217,180,90,.4)] hover:bg-[rgba(217,180,90,.08)] disabled:opacity-35 disabled:hover:bg-transparent"
          title={info.stat == null ? "強化層數已達上限" : !can(info.stat) ? `星晶不足（需要 ${info.stat}）` : `第 ${info.layers + 1} 層：全能力 ×${(1 + DUP_STAT_PER_LAYER * (info.layers + 1)).toFixed(1)}`}>
          <div className="flex items-center justify-between gap-2"><span className="font-black ecl-gilt">強化　全能力 +40%</span>{info.stat != null && <ShardPrice price={info.stat} have={run.shards} free={free} />}</div>
          <div className="text-xs ecl-muted mt-1">{info.layers} → {Math.min(info.cap, info.layers + 1)} / {info.cap} 層</div>
        </button>
        <button type="button" disabled={!can(info.pp)} onClick={() => go("pp")} data-dup="pp" className="text-left p-4 border border-[rgba(79,209,197,.45)] hover:bg-[rgba(79,209,197,.08)] disabled:opacity-35 disabled:hover:bg-transparent"
          title={d.pp ? "已選過，只能一次" : !info.hasPp ? "沒有可加倍的 PP" : !can(info.pp) ? `星晶不足（需要 ${info.pp}）` : "進戰鬥時技能 PP 與上限 ×2；PP 為 0 的技能不變"}>
          <div className="flex items-center justify-between gap-2"><span className="font-black" style={{ color: "var(--ecl-teal)" }}>雙倍 PP</span>{info.pp != null && <ShardPrice price={info.pp} have={run.shards} free={free} />}</div>
          <div className="text-xs ecl-muted mt-1">{d.pp ? "已選" : "只能選一次"}</div>
        </button>
      </div>
    </div>
  );
}

/** 背包卡的進階視窗 */
export function AdvanceDialog({ run, target, dispatch, onClose }: { run: E.RunV2; target: Elf; dispatch: Dispatch; onClose: () => void }) {
  return portalToRoot(
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-[2px] p-4 pt-16 md:p-10 overflow-y-auto" role="dialog" aria-label="進階" data-testid="advance-dialog" onClick={onClose}>
      <div className="mx-auto max-w-2xl ecl-frame p-5 md:p-7 bg-[var(--ecl-ink-2)]" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="ecl-title text-xl ecl-gilt" title="對已持有的同一隻精靈消耗星晶；持有重複招募令可免費進階一次">進階</h3>
          <button className="ecl-btn ecl-btn-ghost text-xs px-4 py-1.5" onClick={onClose}>關閉</button>
        </div>
        <AdvanceChoice run={run} target={target} dispatch={dispatch} onDone={onClose} />
      </div>
    </div>
  );
}

/**
 * 招募／進階挑選視窗。
 * 星晶招募（token 缺省）：任選未持有、未禁用的精靈，卡上標星晶價；持令招募：只列符合的精靈，免費；
 * advance（或重複招募令）：列出已持有可進階者，點選後二選一。
 */
export function RecruitPicker({ run, pool, token, advance, dispatch, onClose }: { run: E.RunV2; pool: Elf[]; token?: RecruitToken; advance?: boolean; dispatch: Dispatch; onClose: () => void }) {
  const adv = !!advance || !!token?.repeat;
  const elves = React.useMemo(() => adv ? run.team.filter(e => { const o = E.dupOptions(run, e); return o.stat || o.pp; }) : token ? E.eligibleElves(run, pool, token) : E.shardCandidates(run, pool), [run, pool, token, adv]);
  const [target, setTarget] = React.useState<Elf | null>(null);
  const tier = (e: Elf) => TIER_TEXT[E.tierOf(pool, e)];
  const pick = (e: Elf) => {
    if (adv) { setTarget(e); return; }
    dispatch(r => token ? E.recruitWithToken(r, token.id, String(e.id), pool) : E.recruitWithShards(r, String(e.id), pool)); onClose();
  };
  const priceOf = (e: Elf) => E.recruitPrice(run, pool, e);
  const title = adv ? "進階" : token ? tokenLabel(token) : "星晶招募";
  const tip = adv ? "對已持有的同一隻精靈消耗星晶；重複招募令可免費進階一次" : token ? tokenHint(token) : "任選一隻精靈。基價 2，每次星晶招募 +1，每兩章 +1，Ⅲ +1、Ⅳ +2；持令招募免費且不推高價格";
  const live = target ? run.team.find(e => E.bagIdOf(e) === E.bagIdOf(target)) ?? target : null;
  return portalToRoot(
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-[2px] p-4 pt-16 md:p-10 overflow-y-auto" role="dialog" aria-label="招募" data-testid="recruit-picker" onClick={onClose}>
      <div className="mx-auto max-w-5xl ecl-frame p-5 md:p-7 bg-[var(--ecl-ink-2)]" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="ecl-title text-xl ecl-gilt" title={tip}>{title}<span className="ml-3 text-sm ecl-muted tabular-nums">{elves.length} 隻可選</span>{!token && <span className="ml-3 text-sm ecl-muted tabular-nums" data-testid="picker-shards">星晶 <b className="ecl-gilt">{run.shards}</b></span>}</h3>
          <button className="ecl-btn ecl-btn-ghost text-xs px-4 py-1.5" onClick={onClose}>關閉</button>
        </div>
        {live ? (
          <>
            <AdvanceChoice run={run} target={live} dispatch={dispatch} onDone={() => { setTarget(null); onClose(); }} />
            <button className="ecl-btn ecl-btn-ghost text-sm mt-4" onClick={() => setTarget(null)}>返回</button>
          </>
        ) : (
          <ElfPicker<Elf> variant="eclipse" elves={elves} getKey={e => E.bagIdOf(e)} onPick={pick}
            isDisabled={e => !adv && !token && run.shards < priceOf(e) ? `星晶不足（需要 ${priceOf(e)}）` : false}
            emptyText={adv ? "沒有可進階的精靈" : "沒有符合的精靈（可能已被持有或禁用）"}
            gridClassName="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[62vh] overflow-y-auto pr-1" itemClassName={`text-left flex gap-3 p-2.5 border ${line} bg-black/30 hover:border-[var(--ecl-gold)] disabled:opacity-40 disabled:hover:border-[rgba(217,180,90,.2)]`}
            renderItem={e => { const dd = dupOf(e); return (<>
              <div className={`w-11 h-12 shrink-0 rounded-[50%] overflow-hidden border border-[rgba(217,180,90,.45)] bg-black/60 ${alive(e) ? "" : "grayscale"}`}><ElfAvatar elf={e} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center font-black ecl-gilt" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><span className="font-black truncate">{e.name}</span><span className="text-[10px] ecl-muted shrink-0">{tier(e)}</span>
                  {!adv && <span className="ml-auto shrink-0"><ShardPrice price={priceOf(e)} have={run.shards} free={!!token} /></span>}</div>
                <div className="flex items-center gap-1 text-[11px] ecl-muted"><TypeIcon type={e.type} size={12} showLabelWhenMissing={false} />{e.type}
                  {adv && (dd.stat > 0 || dd.pp) && <span className="ml-auto" style={{ color: "var(--ecl-teal)" }}>{dd.stat > 0 ? `強化 ${dd.stat}` : ""}{dd.stat > 0 && dd.pp ? "・" : ""}{dd.pp ? "PP×2" : ""}</span>}</div>
                {adv && <div className="ecl-hp mt-1"><i style={{ width: `${hpRatio(e) * 100}%` }} /></div>}
              </div></>); }} />
        )}
      </div>
    </div>
  );
}

/** 帳冊內有 backdrop-filter，會讓 fixed 子層相對它定位而被裁切；彈窗改掛到 .ecl-root 上。 */
export const portalToRoot = (node: React.ReactElement): React.ReactElement => {
  const host = typeof document !== "undefined" ? document.querySelector(".ecl-root") : null;
  return host ? createPortal(node, host) : node;
};

/** 帳冊「招募」分頁：星晶招募與進階，以及持有的令（同款合併，免費使用）。 */
export default function RecruitPage({ run, pool, dispatch }: { run: E.RunV2; pool: Elf[]; dispatch: Dispatch }) {
  const [using, setUsing] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"shards" | "advance" | null>(null);
  const editable = E.canEditBag(run);
  const groups = React.useMemo(() => {
    const m = new Map<string, RecruitToken[]>();
    for (const t of run.tokens) m.set(tokenGroupKey(t), [...(m.get(tokenGroupKey(t)) ?? []), t]);
    return [...m.values()];
  }, [run.tokens]);
  const token = using ? run.tokens.find(t => t.id === using) : undefined;
  React.useEffect(() => { if (using && !token) setUsing(null); }, [using, token]);
  const cheapest = React.useMemo(() => { const c = E.shardCandidates(run, pool); return c.length ? Math.min(...c.map(e => E.recruitPrice(run, pool, e))) : null; }, [run, pool]);
  const canAdvance = run.team.some(e => { const o = E.dupOptions(run, e); return o.stat || o.pp; });
  const lock = editable ? undefined : "戰鬥結算中";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm tabular-nums" data-testid="shard-count" title="招募與進階的貨幣。戰鬥、首領、事件與商店取得">星晶 <b className="ecl-gilt text-lg">{run.shards}</b></span>
        <button className="ecl-btn text-sm px-4 py-1.5" data-testid="recruit-shards" disabled={!editable || cheapest == null || run.shards < cheapest} title={lock ?? (cheapest == null ? "沒有可招募的精靈" : run.shards < cheapest ? `星晶不足（最低 ${cheapest}）` : "任選一隻精靈；價格依招募次數與章節遞增")} onClick={() => setMode("shards")}>招募{cheapest != null ? <span className="ml-2 text-[11px] ecl-muted tabular-nums">✦ {cheapest} 起</span> : null}</button>
        <button className="ecl-btn ecl-btn-ghost text-sm px-4 py-1.5" data-testid="advance-open" disabled={!editable || !canAdvance} title={lock ?? (canAdvance ? "對已持有的精靈進階：強化或 PP×2" : "沒有可進階的精靈")} onClick={() => setMode("advance")}>進階</button>
      </div>
      {groups.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map(g => { const t = g[0]; const n = t.repeat ? run.team.filter(e => { const o = E.dupOptions(run, e); return o.stat || o.pp; }).length : E.eligibleElves(run, pool, t).length; return (
            <div key={t.id} className={`p-3 border ${line} bg-black/30 flex items-center gap-3`}>
              <div className="min-w-0 flex-1">
                <TokenChip token={t} count={g.length} />
                <div className="text-[11px] ecl-muted mt-1.5 truncate" title={tokenHint(t)}>{tokenBrief(t)}</div>
              </div>
              <button className="ecl-btn text-sm px-3 py-1.5 shrink-0" disabled={!editable || !n} title={!editable ? "戰鬥結算中" : !n ? "沒有符合的精靈" : `${n} 隻可選・免費`} onClick={() => setUsing(t.id)}>{t.repeat ? "免費進階" : "免費招募"}</button>
            </div>); })}
        </div>
      ) : <p className="ecl-muted text-sm" title="免費招募或進階一次的限定券。擊敗敵人、商店、事件與祭壇都可能取得">沒有招募令</p>}
      {token && <RecruitPicker run={run} pool={pool} token={token} dispatch={dispatch} onClose={() => setUsing(null)} />}
      {mode && !token && <RecruitPicker run={run} pool={pool} advance={mode === "advance"} dispatch={dispatch} onClose={() => setMode(null)} />}
    </div>
  );
}
