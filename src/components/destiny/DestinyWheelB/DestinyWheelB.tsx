import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { DestinyDraft } from "../useDestinyDraft";
import type { DestinyElfInstance } from "../../../utils/destinyGacha";
import { rankStats } from "../../../utils/destinyRankMeta";
import { readAnimationSettings } from "../../../battle/animationSettings";
import { Backdrop } from "./Backdrop";
import { PlateCard } from "./PlateCard";
import { DetailSheet } from "./DetailSheet";
import { IntroChapter } from "./IntroChapter";
import { Plate, ChapterHead, TicketButton } from "./Plate";
import { LoadoutPlate } from "./LoadoutPlate";
import { useShellBack } from "../../../shell/shellBack";
import { RankSeal } from "./Ink";
import { CHAPTERS, C, ring, blade, prefersReducedMotion, rng, TAU } from "./bModel";
import { DW, inkLayers } from "../../../design/sketchStroke";
import { paperFiberDataUrl } from "./paperFiber";
import dwbCss from "./dwbCss";
import { useScopedStyle } from "../injectStyle";

const CHAPTER_NOTE: Record<string, string[]> = {
  intro: ["保底 1S＋3A＋2C，其餘 6 隻混合抽取；卡池不足時不開局。", "各級判定規則見下方卡池區。"],
  pulling: ["自全圖鑑為雙方各抽 12 隻；非六界神王的 C 級已在建池時綁定一種命運攔截。"],
  reveal: ["點未翻開的卡只翻開那一張；全翻可跳過。", "點已翻開的卡檢視詳情。"],
  ban: ["從對手卡池點選 3 隻禁用，再點一次取消。", "PVE：AI 對你的禁用在確認後揭曉。PVP：P2 從你的卡池禁用。"],
  pick: ["自未被禁用的 9 隻挑 6 隻，點「首」鈕設首發。", "PVE：對手陣容已由 AI 選定並公開。", "命運配裝：套裝／目鏡／稱號雙方不重複，火焰 2 選 1。"],
};

function useReducedMotion() {
  const [r, setR] = useState(prefersReducedMotion);
  useEffect(() => {
    let mq: MediaQueryList | undefined;
    try { mq = window.matchMedia?.("(prefers-reduced-motion: reduce)"); } catch { /* 無 matchMedia */ }
    if (!mq) return;
    const on = () => setR(mq!.matches);
    mq.addEventListener?.("change", on);
    return () => mq!.removeEventListener?.("change", on);
  }, []);
  return r;
}

function WheelRitual({ animated }: { animated: boolean }) {
  const rings = useMemo(() => [ring(0, 0, 76, 3301), ring(0, 0, 58, 7717), ring(0, 0, 38, 9109)], []);
  const blades = useMemo(() => Array.from({ length: 12 }, (_, i) => blade(Math.cos((i / 12) * TAU) * 100, Math.sin((i / 12) * TAU) * 100, 16, (i / 12) * TAU, 3.4)), []);
  return (
    <svg viewBox="-130 -130 260 260" className={`dwb-ritual${animated ? " is-anim" : ""}`} aria-hidden="true">
      <g className="dwb-spin dwb-spin--a">{inkLayers(rings[0], { color: C.cobalt, width: DW(1.2) * 1.6 }).map((l, i) => <path key={i} d={l.d} fill="none" stroke={l.color} strokeOpacity={l.alpha} strokeWidth={l.width} transform={`translate(${l.dx} ${l.dy})`} vectorEffect="non-scaling-stroke" />)}</g>
      <g className="dwb-spin dwb-spin--b">{inkLayers(rings[1], { color: C.ink, width: DW(0.9) * 1.6 }).map((l, i) => <path key={i} d={l.d} fill="none" stroke={l.color} strokeOpacity={l.alpha} strokeWidth={l.width} transform={`translate(${l.dx} ${l.dy})`} vectorEffect="non-scaling-stroke" />)}</g>
      <g className="dwb-spin dwb-spin--c">{inkLayers(rings[2], { color: C.pale, width: DW(0.5) * 1.6 }).map((l, i) => <path key={i} d={l.d} fill="none" stroke={l.color} strokeOpacity={l.alpha} strokeWidth={l.width} transform={`translate(${l.dx} ${l.dy})`} vectorEffect="non-scaling-stroke" />)}</g>
      {blades.map((d, i) => <path key={i} d={d} fill={C.cobalt} fillOpacity={0.25} stroke={C.cobalt} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      <circle cx={0} cy={0} r={6} fill={C.warm} />
    </svg>
  );
}

/**
 * 命運之輪 B 頁：以拾光行記為基礎重新打造的介面。與舊頁共用 useDestinyDraft（資料流、onStartBattle 簽名不變）。
 * 章節：00 序章／01 輪盤／02 圖版／03 禁選／04 編隊。
 */
export default function DestinyWheelB({ draft, onBack, onSwitchToA }: { draft: DestinyDraft; onBack: () => void; onSwitchToA: () => void }) {
  useScopedStyle("destiny-wheel-b-css", dwbCss);
  const d = draft;
  const shellBack = useShellBack();
  const { phase, battleMode } = d;
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [staticMode, setStaticMode] = useState(() => { try { const s = readAnimationSettings(); return s.mode === "static" || !!s.staticMode; } catch { return false; } });
  const animated = !staticMode && !reduced;
  const [blueprint, setBlueprint] = useState(false);
  const [detailOwner, setDetailOwner] = useState<"p1" | "p2">("p1");
  const openDetail = useCallback((e: DestinyElfInstance, owner: "p1" | "p2") => { setDetailOwner(owner); d.setInspectElf(e); }, [d]);
  const paper = useMemo(() => paperFiberDataUrl(), []);

  // 指標視差：只在需要時跑 rAF（指標靜止後停），靜態模式與 reduced-motion 完全不註冊。
  useEffect(() => {
    if (!animated || typeof window === "undefined") return;
    const root = rootRef.current; if (!root) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const step = () => {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      root.style.setProperty("--px", x.toFixed(3)); root.style.setProperty("--py", y.toFixed(3));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    const move = (ev: PointerEvent) => {
      tx = (ev.clientX / Math.max(1, window.innerWidth) - 0.5) * 2; ty = (ev.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const vis = () => { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("pointermove", move); document.removeEventListener("visibilitychange", vis); if (raf) cancelAnimationFrame(raf); };
  }, [animated]);

  // 版面比例：--dwb-s ＝ 背景 slice 縮放（用來讓序章標題剛好落在鈷藍圓盤內）。
  useEffect(() => {
    const root = rootRef.current; if (!root || typeof window === "undefined") return;
    const upd = () => { const w = root.getBoundingClientRect().width || window.innerWidth; root.style.setProperty("--dwb-s", Math.max(w / 1600, window.innerHeight / 900).toFixed(3)); };
    upd(); window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  // 靜態模式：輪盤儀式縮成 0.25 秒。
  useEffect(() => {
    if (phase !== "pulling" || animated) return;
    const t = setTimeout(() => d.skipPull(), 250);
    return () => clearTimeout(t);
  }, [phase, animated]); // eslint-disable-line react-hooks/exhaustive-deps

  // 鍵盤：←→ 切章、B 圖紙、Esc 返回（先關詳情，再關圖紙，再退回上一章）。
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const reach = CHAPTERS.filter(c => c.key !== "pulling" && (c.key === d.phase || d.canGoPhase(c.key)));
      const i = reach.findIndex(c => c.key === d.phase);
      if (ev.key === "ArrowRight" && i >= 0 && reach[i + 1]) d.goPhase(reach[i + 1].key);
      else if (ev.key === "ArrowLeft" && i > 0) d.goPhase(reach[i - 1].key);
      else if (ev.key === "b" || ev.key === "B") setBlueprint(v => !v);
      else if (ev.key === "m" || ev.key === "M") d.setBattleMode(m => (m === "PVE" ? "PVP" : "PVE"));
      else if (ev.key === "Escape") {
        if (d.inspectElf) d.setInspectElf(null);
        else if (blueprint) setBlueprint(false);
        else if (i > 0) d.goPhase(reach[i - 1].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d, blueprint]);

  const lit = Math.min(12, Math.ceil(d.revealedIds.length / 2));
  const chapterIdx = CHAPTERS.findIndex(c => c.key === phase);
  const mode = d.battleMode;
  const p1Avail = d.p1Pool.filter(e => !e.isBanned);
  const p2Avail = d.p2Pool.filter(e => !e.isBanned);

  const counts = (pool: DestinyElfInstance[]) => {
    const st = rankStats(pool);
    return <span className="dwb-counts" data-testid="b-pool-stats" title="S／A／B／C 張數">S {st.counts.S} · A {st.counts.A} · B {st.counts.B} · C {st.counts.C}</span>;
  };
  const panel = (title: string, id: string, pool: DestinyElfInstance[], right: React.ReactNode, cards: React.ReactNode, cols = 4, fig = "FIG.01", en = "POOL", tone: "a" | "b" = "a") => (
    <Plate fig={fig} en={en} title={title} testid={id} right={right} tone={tone}>
      <div className="dwb-grid" style={{ ["--cols" as string]: cols }}>{cards}</div>
    </Plate>
  );

  return (
    <div ref={rootRef} className={`dwb${blueprint ? " dwb--bp" : ""}${animated ? " dwb--anim" : ""}`} data-destiny-view="B" data-chapter={phase}
      style={{ backgroundImage: paper ? `url("${paper}")` : undefined }}>
      <Backdrop chapter={phase} lit={lit} blueprint={blueprint} animated={animated} />

      <header className="dwb-bar">
        <div className="dwb-brand" title="← → 切換章節 · B 圖紙 · M 模式 · Esc 返回"><b>命運之輪</b><i>WHEEL OF DESTINY</i></div>
        <div className="dwb-tools" role="toolbar" aria-label="工具">
          {!shellBack && <button type="button" className="dwb-tbtn" data-testid="b-back" onClick={onBack}><ArrowLeft size={13} aria-hidden="true" /> 返回大廳</button>}
          <button type="button" className="dwb-tbtn" data-testid="b-mode" data-key="M" aria-label={`對戰模式 ${battleMode}`} disabled={d.modeLocked}
            title={d.modeLocked ? "抽卡開始後不能切換模式" : battleMode === "PVE" ? "對戰智能 AI（M 切換 PVP）" : "輪流操作（M 切換 PVE）"}
            onClick={() => d.setBattleMode(m => (m === "PVE" ? "PVP" : "PVE"))}>{battleMode}</button>
          <button type="button" className={`dwb-tbtn${blueprint ? " on" : ""}`} data-testid="b-blueprint" data-key="B" aria-pressed={blueprint} title="圖紙：說明層與判定來源" onClick={() => setBlueprint(v => !v)}>圖紙</button>
          <button type="button" className={`dwb-tbtn${staticMode ? " on" : ""}`} data-testid="b-static" aria-pressed={staticMode} title="靜態：關閉視差與動畫" onClick={() => setStaticMode(v => !v)}>靜態</button>
          <button type="button" className="dwb-tbtn" data-testid="b-switch-a" title="切到經典版面（進度保留）" onClick={onSwitchToA}>經典版</button>
        </div>
      </header>

      <main className="dwb-main" key={phase} aria-live="polite">
        {phase === "intro" && <IntroChapter pool={d.sessionPool} mode={mode} blueprint={blueprint} error={d.pullError} onStart={d.handleStartPull} onDetail={e => openDetail(e, "p1")} />}

        {phase === "pulling" && (
          <section className="dwb-pull" data-testid="b-pulling">
            <span className="dwb-watermark" aria-hidden="true">FORTUNA</span>
            <WheelRitual animated={animated} />
            <h2>輪盤轉動中</h2>
            <button type="button" className="dwb-tbtn" data-testid="b-skip" onClick={d.skipPull}>跳過</button>
          </section>
        )}

        {phase === "reveal" && (
          <>
            <ChapterHead no="02" name="圖版" en="REVEAL" hint="點卡背翻開單張；翻開後點卡看詳情"
              count={<span data-testid="b-revealed-count">已翻 {d.revealedIds.length} / 24</span>}
              actions={<>
                {!d.isRevealingAll && <button type="button" className="dwb-btn" data-testid="b-reveal-all" onClick={d.handleRevealAll}>全部翻開</button>}
                <TicketButton go testid="b-next-ban" sub="NEXT · 03" label="進入禁選" onClick={d.handleProceedToBan} />
              </>} />
            <div className="dwb-pools">
              {panel(`我方卡池 · ${d.p1Title}`, "b-pool-p1", d.p1Pool, counts(d.p1Pool), d.p1Pool.map((e, i) => (
                <PlateCard key={e.instanceId} elf={e} owner="p1" mode={mode} index={i + 1} face={d.isCardRevealed(e.instanceId) ? "front" : "back"} testid="b-card"
                  blueprint={blueprint} animated={animated}
                  onActivate={() => (d.isCardRevealed(e.instanceId) ? openDetail(e, "p1") : d.handleNextReveal(e.instanceId))} />
              )), 4, "FIG.01", "OURS")}
              {panel(`${battleMode === "PVE" ? "對手 AI" : "挑戰者 P2"} · ${d.p2Title}`, "b-pool-p2", d.p2Pool, counts(d.p2Pool), d.p2Pool.map((e, i) => (
                <PlateCard key={e.instanceId} elf={e} owner="p2" mode={mode} index={i + 1} face={d.isCardRevealed(e.instanceId) ? "front" : "back"} testid="b-card"
                  blueprint={blueprint} animated={animated}
                  onActivate={() => (d.isCardRevealed(e.instanceId) ? openDetail(e, "p2") : d.handleNextReveal(e.instanceId))} />
              )), 4, "FIG.02", "RIVAL")}
            </div>
          </>
        )}

        {phase === "ban" && (
          <>
            <ChapterHead no="03" name="禁選" en="EXILE" hint={battleMode === "PVE" ? "從對手卡池點 3 隻禁用；AI 同步禁用你的 3 隻" : "雙方各從對手卡池點 3 隻禁用"}
              count={<span data-testid="b-ban-count">P1 {d.p1BannedIds.length} / 3{battleMode === "PVP" ? `　P2 ${d.p2BannedIds.length} / 3` : ""}</span>}
              actions={<TicketButton go testid="b-confirm-ban" sub="NEXT · 04" label="確認禁用" disabled={!d.canConfirmBan} onClick={d.handleConfirmBan} />} />
            <div className="dwb-pools">
              {panel(`禁用對手 · 剩 ${3 - d.p1BannedIds.length}`, "b-ban-opp", d.p2Pool, counts(d.p2Pool), d.p2Pool.map((e, i) => (
                <PlateCard key={e.instanceId} elf={e} owner="p2" mode={mode} index={i + 1} face="front" testid="b-ban-card" blueprint={blueprint} animated={animated}
                  banned={d.p1BannedIds.includes(e.instanceId)} bannedText="已禁用" onActivate={() => d.toggleBan(e.instanceId)} onDetail={() => openDetail(e, "p2")} />
              )), 4, "FIG.03", "TARGET")}
              {panel(battleMode === "PVE" ? "我方卡池 · 確認後揭曉" : `P2 禁用 · 剩 ${3 - d.p2BannedIds.length}`, "b-ban-own", d.p1Pool, counts(d.p1Pool), d.p1Pool.map((e, i) => (
                <PlateCard key={e.instanceId} elf={e} owner="p1" mode={mode} index={i + 1} face="front" testid="b-ban-own-card" blueprint={blueprint} animated={animated}
                  dim={battleMode === "PVE"} banned={battleMode === "PVP" && d.p2BannedIds.includes(e.instanceId)} bannedText="P2 禁用"
                  onActivate={battleMode === "PVP" ? () => d.toggleP2Ban(e.instanceId) : undefined} onDetail={() => openDetail(e, "p1")} />
              )), 4, "FIG.04", "OURS")}
            </div>
          </>
        )}

        {phase === "pick" && (
          <>
            <ChapterHead no="04" name="編隊" en="ROSTER" hint="挑 6 隻、點「首」設首發；下方選命運配裝"
              count={<span data-testid="b-pick-count">P1 {d.p1PickedIds.length} / 6{battleMode === "PVP" ? `　P2 ${d.p2PickedIds.length} / 6` : ""}</span>}
              actions={<TicketButton go testid="b-launch" sub="PEAK · 6V6" label="啟動巔峰對決" disabled={!d.canLaunch} onClick={d.handleLaunchBattle} />} />
            <div className="dwb-pools">
              {panel(`P1 出戰 · ${d.p1Title}`, "b-pick-p1", p1Avail, <span className="dwb-counts">可用 {p1Avail.length}</span>, p1Avail.map(e => (
                <PlateCard key={e.instanceId} elf={e} owner="p1" mode={mode} index={d.p1Pool.indexOf(e) + 1} face="front" testid="b-pick-card" blueprint={blueprint} animated={animated}
                  picked={d.p1PickedIds.includes(e.instanceId)} pickOrder={d.p1PickedIds.indexOf(e.instanceId) + 1} starter={d.p1StarterId === e.instanceId}
                  dim={!d.p1PickedIds.includes(e.instanceId)} onActivate={() => d.togglePick(e.instanceId)} onDetail={() => openDetail(e, "p1")}
                  onStarter={() => d.setP1StarterId(e.instanceId)} />
              )), 3, "FIG.05", "SQUAD")}
              {panel(battleMode === "PVE" ? "AI 出戰陣容" : `P2 出戰 · ${d.p2Title}`, "b-pick-p2", p2Avail,
                <span className="dwb-counts">{battleMode === "PVE" ? "首發已定" : `${d.p2PickedIds.length} / 6`}</span>,
                p2Avail.filter(e => battleMode === "PVP" || d.p2PickedIds.includes(e.instanceId)).map(e => (
                  <PlateCard key={e.instanceId} elf={e} owner="p2" mode={mode} index={d.p2Pool.indexOf(e) + 1} face="front" testid="b-pick2-card" blueprint={blueprint} animated={animated}
                    picked={d.p2PickedIds.includes(e.instanceId)} pickOrder={d.p2PickedIds.indexOf(e.instanceId) + 1} starter={d.p2StarterId === e.instanceId}
                    starterText={battleMode === "PVE" ? "AI首發" : "P2首發"} dim={!d.p2PickedIds.includes(e.instanceId)}
                    onActivate={battleMode === "PVE" ? () => openDetail(e, "p2") : () => d.toggleP2Pick(e.instanceId)}
                    onDetail={battleMode === "PVP" ? () => openDetail(e, "p2") : undefined}
                    onStarter={battleMode === "PVP" ? () => d.setP2StarterId(e.instanceId) : undefined} />
                )), 3, "FIG.06", "RIVAL", "b")}
            </div>
            <LoadoutPlate d={d} />
          </>
        )}
      </main>

      {/* 章節列與圖紙說明：黏在可視區底部的零高度錨點，位置跟著內容區（避開左側殼層導覽與底部狀態列） */}
      <div className="dwb-dock">
        {blueprint && (
          <aside className="dwb-note" data-testid="b-blueprint-note" aria-label="圖紙說明">
            <b>圖紙 · {CHAPTERS[chapterIdx]?.no} {CHAPTERS[chapterIdx]?.name}</b>
            {(CHAPTER_NOTE[phase] ?? []).map(t => <p key={t}>{t}</p>)}
          </aside>
        )}

        <nav className="dwb-rail" aria-label="章節" data-testid="b-rail">
          {CHAPTERS.map((c, i) => {
            const here = c.key === phase, ok = here || d.canGoPhase(c.key);
            return (
              <button key={c.key} type="button" className={`dwb-dot${here ? " on" : ""}`} data-testid={`b-chap-${i}`} aria-current={here ? "step" : undefined}
                disabled={!ok} onClick={() => d.goPhase(c.key)} title={`${c.no} ${c.name}`}>
                <s aria-hidden="true" /><em>{c.no}</em><span>{c.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {d.inspectElf && <DetailSheet elf={d.inspectElf} owner={detailOwner} mode={mode} blueprint={blueprint} onClose={() => d.setInspectElf(null)} />}
    </div>
  );
}
