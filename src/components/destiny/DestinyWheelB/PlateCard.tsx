import React, { useMemo } from "react";
import { ElfAvatar, TypeIcon } from "../../SeerImages";
import { explainElfDisplayRank } from "../../../utils/elfDisplayRank";
import { RANK_SOURCE_LABEL, DESTINY_RANK_LABEL } from "../../../utils/destinyRankMeta";
import { usesSoulMarkInsteadOfInterceptor, type DestinyElfInstance } from "../../../utils/destinyGacha";
import type { BattleViewMode, Side } from "../../../battle/viewerPerspective";
import { maskForViewer } from "../maskForViewer";
import { C, RANK_VIS, cardArt, hashSeed, sealCross, ring, rule } from "./bModel";
import { Ink, RankSeal } from "./Ink";
import { DW } from "../../../design/sketchStroke";

export const totalOf = (e: Pick<DestinyElfInstance, "baseStats">) =>
  Object.values(e.baseStats || {}).reduce((s, v) => s + (Number(v) || 0), 0);

/** 卡面手繪外框（依分級：S 雙線套印、A 單線、B 虛線、C 折角＋斜線底紋）。 */
function Frame({ seed, rank, selected }: { seed: number; rank: DestinyElfInstance["destinyRank"]; selected?: boolean }) {
  const art = useMemo(() => cardArt(seed, rank), [seed, rank]);
  const v = RANK_VIS[rank];
  const w = selected ? DW(1.2) * 1.35 : DW(0.9);
  return (
    <svg className="dwb-card-art" viewBox="0 0 120 160" preserveAspectRatio="none" aria-hidden="true">
      {art.hatch && <path d={art.hatch} stroke={C.ink} strokeOpacity={0.22} strokeWidth={0.8} fill="none" vectorEffect="non-scaling-stroke" />}
      <path d={art.ringD} stroke={C.pale} strokeOpacity={0.55} strokeWidth={DW(0.2)} fill="none" vectorEffect="non-scaling-stroke" />
      {art.frame.map((d, i) => (
        v.frame === "dashed"
          ? <path key={i} d={d} fill="none" stroke={v.color} strokeWidth={w} strokeDasharray="5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          : <Ink key={i} d={d} color={rank === "S" ? C.warm : rank === "A" ? C.cobalt : C.ink} width={w} alpha={0.95} inked={v.frame === "double" || v.frame === "solid"} />
      ))}
      {art.fold && <path d={art.fold} fill={C.ink} fillOpacity={0.85} stroke={C.ink} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export interface PlateCardProps {
  key?: string | number;
  elf: DestinyElfInstance;
  owner: Side;
  mode: BattleViewMode;
  index: number;
  /** back＝尚未翻開的卡背（不帶任何精靈資訊）。 */
  face: "back" | "front";
  onActivate?: () => void;
  onDetail?: () => void;
  activateLabel?: string;
  /** Ban 階段：已封 */
  banned?: boolean;
  bannedText?: string;
  /** Pick 階段 */
  picked?: boolean;
  pickOrder?: number;
  starter?: boolean;
  onStarter?: () => void;
  starterText?: string;
  dim?: boolean;
  blueprint?: boolean;
  testid: string;
  /** 動畫關閉（靜態模式）時蓋章不跑動畫。 */
  animated?: boolean;
}

export function PlateCard(p: PlateCardProps) {
  const { elf, owner, mode, index, face, banned, picked, starter } = p;
  const seed = useMemo(() => hashSeed(elf.instanceId), [elf.instanceId]);
  const rank = elf.destinyRank;
  const view = useMemo(() => maskForViewer(elf, owner, mode), [elf, owner, mode]);
  const interactive = !!p.onActivate;
  const onKey = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onActivate?.(); }
  };
  const num = String(index).padStart(2, "0");

  if (face === "back") {
    const d = [rule(3, 3, 117, 3, seed + 1, { ext: 2 }), rule(117, 3, 117, 157, seed + 2, { ext: 2 }), rule(117, 157, 3, 157, seed + 3, { ext: 2 }), rule(3, 157, 3, 3, seed + 4, { ext: 2 })];
    return (
      <div role="button" tabIndex={0} aria-label={`第 ${num} 張，點擊翻開`} data-testid={p.testid} data-face="back" data-rank-hidden="true"
        className="dwb-card dwb-card--back" onClick={p.onActivate} onKeyDown={onKey}>
        <svg className="dwb-card-art" viewBox="0 0 120 160" preserveAspectRatio="none" aria-hidden="true">
          {d.map((x, i) => <Ink key={i} d={x} color={C.cobalt} width={DW(0.8)} alpha={0.9} />)}
          <path d={ring(60, 80, 26, seed + 6, { amp: 0.02 })} fill="none" stroke={C.pale} strokeWidth={DW(0.5)} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="dwb-back-q" aria-hidden="true">?</span>
        <span className="dwb-back-no" aria-hidden="true">{num}</span>
        <span className="dwb-sr">點擊翻開此牌</span>
      </div>
    );
  }

  const concealedHere = view.name !== elf.name;
  const isLiujie = usesSoulMarkInsteadOfInterceptor(view.name);
  const intercept = rank === "C" && elf.interceptorEffect && !isLiujie ? elf.interceptorEffect.name : "";
  const info = explainElfDisplayRank(view);
  const label = `${view.name}，${rank} 級${banned ? "，已封" : ""}${picked ? "，已入戰隊" : ""}${starter ? "，首發" : ""}`;
  return (
    <div role="button" tabIndex={0} aria-label={label} aria-pressed={p.picked !== undefined || p.banned !== undefined ? !!(picked || banned) : undefined}
      data-testid={p.testid} data-face="front" data-rank={rank} data-instance={elf.instanceId} data-picked={picked ? "1" : undefined} data-banned={banned ? "1" : undefined}
      className={`dwb-card dwb-card--${rank}${picked ? " is-picked" : ""}${starter ? " is-starter" : ""}${banned ? " is-banned" : ""}${p.dim ? " is-dim" : ""}${p.animated === false ? "" : " is-anim"}`}
      onClick={p.onActivate} onKeyDown={onKey} title={p.activateLabel}>
      <Frame seed={seed} rank={rank} selected={picked || starter} />
      <RankSeal rank={rank} size={30} seed={seed % 997} className="dwb-seal" />
      <span className="dwb-card-no" aria-hidden="true">{num}</span>
      <div className="dwb-portrait" data-testid={`${p.testid}-art`}>
        <ElfAvatar elf={view} battleSide={view.isConcealed ? owner : undefined} kind="body" className="dwb-portrait-img" />
      </div>
      <div className="dwb-card-meta">
        <div className="dwb-card-name" data-testid="b-card-name">{view.name}</div>
        <div className="dwb-card-type">{view.type ? <><TypeIcon type={view.type} size={13} showLabelWhenMissing={false} /><span>{view.type}</span></> : <span>&nbsp;</span>}</div>
        {p.blueprint && (
          <div className="dwb-card-bp" data-testid="b-card-bp">{`總和 ${totalOf(view)} · ${RANK_SOURCE_LABEL[info.source]}`}</div>
        )}
      </div>
      {intercept && <span className="dwb-tag dwb-tag--c" data-testid="b-intercept-tag" title={elf.interceptorEffect?.description}>{intercept}</span>}
      {isLiujie && !concealedHere && <span className="dwb-tag dwb-tag--c" data-testid="b-liujie-tag" title="六界神王以【界】魂印取代攔截效果">【界】魂印</span>}
      {p.onDetail && (
        <button type="button" className="dwb-card-detail" aria-label={`${view.name} 詳情`} title="詳情" data-testid="b-detail-btn"
          onClick={e => { e.stopPropagation(); p.onDetail?.(); }}>詳</button>
      )}
      {p.onStarter && picked && (
        <button type="button" className={`dwb-card-star${starter ? " on" : ""}`} aria-pressed={!!starter} aria-label={starter ? "首發精靈" : "設為首發"} title="設為首發精靈"
          data-testid="b-starter-btn" onClick={e => { e.stopPropagation(); p.onStarter?.(); }}>首</button>
      )}
      {picked && !starter && p.pickOrder !== undefined && <span className="dwb-order" data-testid="b-pick-order">{p.pickOrder}</span>}
      {starter && <span className="dwb-order dwb-order--starter" data-testid="b-starter-mark">{p.starterText ?? "首發"}</span>}
      {starter && (
        <svg className="dwb-starter-ring" viewBox="0 0 120 160" preserveAspectRatio="none" aria-hidden="true">
          <Ink d={ring(60, 68, 44, seed + 7, { amp: 0.02, over: 0.2 })} color={C.cobalt} width={DW(1.2) * 1.6} alpha={0.9} />
        </svg>
      )}
      {banned && (
        <div className="dwb-ban" data-testid="b-ban-mark">
          <svg viewBox="0 0 100 100" aria-hidden="true"><path d={sealCross(seed)} fill={C.warm} /></svg>
          <span>{p.bannedText ?? "已禁用"}</span>
        </div>
      )}
    </div>
  );
}
