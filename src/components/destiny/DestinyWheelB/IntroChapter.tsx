import React, { useMemo, useRef, useState } from "react";
import { ElfAvatar, TypeIcon } from "../../SeerImages";
import { matchesElfQuery } from "../../../utils/elfSearch";
import { usesSoulMarkInsteadOfInterceptor, type DestinyElfInstance, type DestinyRank } from "../../../utils/destinyGacha";
import { DESTINY_RANKS, DESTINY_RANK_LABEL, RANK_SOURCE_LABEL, describeRankRule, rankStats } from "../../../utils/destinyRankMeta";
import { explainElfDisplayRank } from "../../../utils/elfDisplayRank";
import type { BattleViewMode } from "../../../battle/viewerPerspective";
import { maskForViewer } from "../maskForViewer";
import { RankSeal } from "./Ink";
import { RANK_VIS, hashSeed } from "./bModel";
import { totalOf } from "./PlateCard";

type Tab = "all" | DestinyRank;
const RANK_ORDER: Record<DestinyRank, number> = { S: 4, A: 3, B: 2, C: 1 };

/** 賽制四項：只留標籤與一行，完整說明放 tooltip（對應舊頁 4 張規則卡）。 */
export const RULE_ITEMS = [
  { no: "1", label: "12 連抽", line: "保底 1S＋3A＋2C", tip: "雙方各自從圖鑑隨機抽取 12 隻不同精靈。保底至少 1 隻 S、3 隻 A、2 隻 C，其餘 6 隻混合抽取；卡池不足時提示原因，不開始抽卡。" },
  { no: "2", label: "Ban 3", line: "禁用對手 3 隻", tip: "抽卡揭曉後，雙方檢視彼此卡池，各禁用對手 3 隻精靈。" },
  { no: "3", label: "Pick 6", line: "剩 9 選 6，指定首發", tip: "從扣除禁用的 9 隻精靈中挑選 6 隻出戰，並指定首發。PVE 為 AI 對手，PVP 為雙人輪流。" },
  { no: "4", label: "C 級攔截", line: "出場或陣亡時觸發", tip: "非六界神王的 C 級卡綁定封技攔截、時空枷鎖、悲歌護盾、索魂同歸、英靈祝福之一，於登場或陣亡時觸發；六界神王改以【界】魂印取代。" },
] as const;

export function IntroChapter(props: {
  pool: DestinyElfInstance[]; mode: BattleViewMode; blueprint: boolean; onStart: () => void; onDetail: (e: DestinyElfInstance) => void; error: string;
}) {
  const { pool, mode, blueprint } = props;
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "grid">(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "grid" : "table"));
  const browserRef = useRef<HTMLElement>(null);
  const stats = useMemo(() => rankStats(pool), [pool]);
  const list = useMemo(() => pool.filter(e => (tab === "all" || e.destinyRank === tab) && matchesElfQuery(e, query)).sort((a, b) =>
    RANK_ORDER[b.destinyRank] - RANK_ORDER[a.destinyRank] || totalOf(b) - totalOf(a)), [pool, tab, query]);
  const pickTab = (t: Tab) => { setTab(t); browserRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); };
  const soulLine = (e: DestinyElfInstance) => e.destinyRank === "C" && e.interceptorEffect && !usesSoulMarkInsteadOfInterceptor(e.name)
    ? `【${e.interceptorEffect.name}】${e.interceptorEffect.description}` : e.soulMark?.name ? `【${e.soulMark.name}】${e.soulMark.description || ""}` : "一般精靈特性";
  return (
    <div className="dwb-intro">
      <section className="dwb-hero" data-testid="b-hero">
        <h1 className="dwb-title">命運之輪</h1>
        <div className="dwb-sub">WHEEL OF DESTINY</div>
        <div className="dwb-tag-line">卷宗 · 貳　／　十二張牌與三次禁令</div>
        <button type="button" className="dwb-start" data-testid="b-start" onClick={props.onStart}
          title="從全圖鑑為雙方各抽 12 隻，保底至少 1S＋3A＋2C，其餘 6 隻混合">啟動命運輪盤</button>
        {props.error && <p role="alert" className="dwb-error" data-testid="b-error">{props.error}</p>}
      </section>

      <section className="dwb-ranks-wrap">
        <div className="dwb-ranks" role="tablist" aria-label="卡池分級">
          {DESTINY_RANKS.map(r => (
            <button key={r} type="button" role="tab" aria-selected={tab === r} className={`dwb-rankcell${tab === r ? " on" : ""}`} data-testid={`b-rank-tab-${r}`}
              title={describeRankRule(r)} onClick={() => pickTab(tab === r ? "all" : r)}>
              <RankSeal rank={r} size={34} seed={r.charCodeAt(0)} />
              <b data-testid={`b-rank-count-${r}`}>{stats.counts[r]}</b>
              <span>{DESTINY_RANK_LABEL[r].title.split("·")[1]}　{stats.pct[r]}%</span>
              <i style={{ width: `${Math.min(100, Number(stats.pct[r]))}%`, background: RANK_VIS[r].color }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="dwb-rules" aria-label="賽制" data-testid="b-rules">
        {RULE_ITEMS.map(r => (
          <div key={r.no} className="dwb-rule" title={r.tip} data-testid={`b-rule-${r.no}`}>
            <em>{r.no}</em><b>{r.label}</b><span>{r.line}</span>
          </div>
        ))}
      </section>

      <section className="dwb-browser" ref={browserRef} data-testid="b-browser" aria-label="卡池檢索">
        <div className="dwb-browser-bar">
          <h2>卡池 <small data-testid="b-browser-total">{stats.total} 隻</small></h2>
          <div className="dwb-browser-tools">
            <input type="search" className="dwb-input" data-testid="b-search" placeholder="名稱、ID、屬性或魂印" aria-label="搜尋卡池" value={query} onChange={e => setQuery(e.target.value)} />
            <div className="dwb-seg" role="group" aria-label="檢視方式">
              <button type="button" className={view === "table" ? "on" : ""} aria-pressed={view === "table"} data-testid="b-view-table" onClick={() => setView("table")}>表格</button>
              <button type="button" className={view === "grid" ? "on" : ""} aria-pressed={view === "grid"} data-testid="b-view-grid" onClick={() => setView("grid")}>網格</button>
            </div>
          </div>
        </div>
        <div className="dwb-tabs" role="tablist" aria-label="分級篩選">
          <button type="button" role="tab" aria-selected={tab === "all"} className={tab === "all" ? "on" : ""} data-testid="b-tab-all" onClick={() => setTab("all")}>全部 {stats.total}</button>
          {DESTINY_RANKS.map(r => (
            <button key={r} type="button" role="tab" aria-selected={tab === r} className={tab === r ? "on" : ""} data-testid={`b-tab-${r}`} onClick={() => setTab(r)} title={describeRankRule(r)}>
              {r} 級 {stats.counts[r]}
            </button>
          ))}
        </div>
        {blueprint && (
          <div className="dwb-rulebox" data-testid="b-rank-rules">
            {(tab === "all" ? DESTINY_RANKS.map(describeRankRule) : [describeRankRule(tab)]).map(t => <p key={t}>{t}</p>)}
          </div>
        )}
        {list.length === 0 ? <p className="dwb-empty">沒有符合條件的精靈。</p> : view === "table" ? (
          <div className="dwb-tablewrap" data-testid="b-list-table">
            <table>
              <thead><tr><th>階級</th><th>精靈</th><th>屬性</th><th>總和</th><th>體</th><th>攻</th><th>防</th><th>特攻</th><th>特防</th><th>速</th><th>魂印／攔截</th><th /></tr></thead>
              <tbody>
                {list.map(e0 => { const e = maskForViewer(e0, "p1", mode); const b = e.baseStats; return (
                  <tr key={e0.instanceId} data-testid="b-list-item" data-rank={e0.destinyRank} onClick={() => props.onDetail(e0)}>
                    <td><RankSeal rank={e0.destinyRank} size={24} seed={hashSeed(e0.instanceId) % 997} /></td>
                    <td className="nm"><span className="av"><ElfAvatar elf={e} kind="head" className="dwb-av-img" /></span>{e.name}{blueprint && <small>{RANK_SOURCE_LABEL[explainElfDisplayRank(e).source]}</small>}</td>
                    <td><span className="ty"><TypeIcon type={e.type} size={13} showLabelWhenMissing={false} />{e.type}</span></td>
                    <td><b>{totalOf(e)}</b></td>
                    <td>{b?.hp || "-"}</td><td>{b?.atk || "-"}</td><td>{b?.def || "-"}</td><td>{b?.spatk || "-"}</td><td>{b?.spdef || "-"}</td><td>{b?.speed || "-"}</td>
                    <td className="soul" title={soulLine(e0)}>{soulLine(e0)}</td>
                    <td><button type="button" className="dwb-mini" data-testid="b-list-detail" aria-label={`${e.name} 詳情`} onClick={ev => { ev.stopPropagation(); props.onDetail(e0); }}>詳情</button></td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dwb-listgrid" data-testid="b-list-grid">
            {list.map(e0 => { const e = maskForViewer(e0, "p1", mode); return (
              <button type="button" key={e0.instanceId} className={`dwb-mini-card dwb-mini-card--${e0.destinyRank}`} data-testid="b-list-item" data-rank={e0.destinyRank} onClick={() => props.onDetail(e0)}>
                <RankSeal rank={e0.destinyRank} size={22} seed={hashSeed(e0.instanceId) % 997} className="dwb-mini-seal" />
                <span className="av"><ElfAvatar elf={e} kind="head" className="dwb-av-img" /></span>
                <b>{e.name}</b>
                <small><TypeIcon type={e.type} size={12} showLabelWhenMissing={false} />{e.type}　總和 {totalOf(e)}</small>
              </button>); })}
          </div>
        )}
      </section>
    </div>
  );
}
