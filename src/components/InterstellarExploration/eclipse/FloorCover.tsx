import React from "react";
import { motion, useReducedMotion } from "motion/react";
import * as E from "../../../modes/interstellar/v2/engine";
import { depthOf } from "../../../modes/interstellar/v2/recruit";
import { BOSS_TRAIT_BY_ID, bossTraitIcon } from "../../../data/bossTraits";
import { animationSpeed, readAnimationSettings } from "../../../battle/animationSettings";
import { NpcArt, Ornament } from "./parts";

/** 樓層識別：章＋欄＋保命次數（逆時沙漏等倒轉會讓同一層重新進入）。 */
export const floorKeyOf = (run: E.RunV2) => `${run.runId}|${run.act}|${E.currentNode(run).col}|${run.rescues?.length ?? 0}`;
/** 起點（第 0 欄）還不算進入樓層；踏上第 1 欄起才有封面。選燈與結算畫面不顯示。 */
export const floorCoverable = (run: E.RunV2) => run.scene.kind !== "draft" && run.scene.kind !== "end" && E.currentNode(run).col >= 1;
export const FLOOR_COVER_AUTO_MS = 2500;

/** 進入樓層封面：點擊／Enter／Space／Esc 關閉，約 2.5 秒自動關閉；只是覆蓋層，不改動遊戲狀態。 */
const FloorCover: React.FC<{ run: E.RunV2; backdrop?: { src: string; className: string }; onDone: () => void }> = ({ run, backdrop, onDone }) => {
  const act = E.actDef(run);
  const node = E.currentNode(run);
  const floor = depthOf(run.act, node.col);
  const label = E.nodeLabel(run, node);
  const enc = run.scene.kind === "prelude" ? run.scene.encounter : null;
  const traits = (enc?.enemies ?? []).flatMap(e => e.traits ?? []).map(t => BOSS_TRAIT_BY_ID[t.id]).filter(Boolean);
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const done = React.useRef(onDone); done.current = onDone;
  React.useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation(); done.current();
    };
    window.addEventListener("keydown", onKey, true);
    let speed = 1; try { speed = animationSpeed(readAnimationSettings().speed); } catch { /* 無設定 */ }
    const t = setTimeout(() => done.current(), Math.max(500, FLOOR_COVER_AUTO_MS / Math.max(1, speed)));
    return () => { window.removeEventListener("keydown", onKey, true); clearTimeout(t); };
  }, []);
  return (
    <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`第 ${floor} 層・${act.name}`} data-testid="floor-cover" data-floor={floor}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .3 }}
      onClick={() => done.current()} title="點擊或按 Enter 繼續"
      className="absolute inset-0 z-[90] overflow-hidden bg-[var(--ecl-ink,#07060c)] grid place-items-center cursor-pointer outline-none motion-reduce:transition-none">
      {backdrop && <img src={backdrop.src} alt="" aria-hidden className={`absolute pointer-events-none ${backdrop.className}`} />}
      <div className="absolute right-[-4%] top-[6%] h-[84%] w-[44%] pointer-events-none opacity-[.16] mix-blend-screen"><NpcArt id={act.npc} className="w-full h-full" /></div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(7,6,12,.2), rgba(7,6,12,.9))" }} />
      <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: reduce ? 0 : .1, duration: reduce ? 0 : .4 }} className="relative text-center px-6">
        <div className="ecl-roman text-xs ecl-muted">Floor {floor}</div>
        <h2 className="ecl-title text-6xl ecl-md:text-8xl ecl-gilt mt-2" data-testid="floor-cover-title">第 {floor} 層</h2>
        <Ornament className="my-5 mx-auto" />
        <div className="ecl-title text-2xl ecl-md:text-3xl" title={act.epithet} style={{ color: act.hue }}>{act.name}</div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm" data-testid="floor-cover-info">
          <span className="px-3 py-1 border border-[rgba(217,180,90,.45)]" title={label.hint}>{label.glyph} {label.name}</span>
          {enc && <span className="px-3 py-1 border border-[rgba(217,180,90,.45)] font-black" title={`${enc.title}`}>{enc.title}</span>}
          <span className="px-3 py-1 border border-[rgba(224,71,95,.45)] ecl-blood tabular-nums" title={E.LIFE_RULE}>♥ {run.lives}{(run.tempLives ?? 0) > 0 ? `(+${run.tempLives})` : ""}</span>
        </div>
        {traits.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" aria-label="BOSS 特性">
            {traits.map(d => <span key={d.id} title={d.name} className="inline-flex items-center gap-0.5 text-xs pr-1.5 border border-[rgba(217,180,90,.55)] ecl-gilt"><img src={bossTraitIcon(d)} alt="" className="w-5 h-5 object-contain" />{d.name}</span>)}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
export default FloorCover;
