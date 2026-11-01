import React, { useEffect, useMemo, useRef } from "react";
import { ElfAvatar, TypeIcon, SkillTypeIcon } from "../../SeerImages";
import { EffectDescription } from "../../EffectDescription";
import { RichDescription } from "../../RichDescription";
import { skillDisplayType } from "../../../utils/skillPresentation";
import { explainElfDisplayRank } from "../../../utils/elfDisplayRank";
import { RANK_SOURCE_LABEL, DESTINY_RANK_LABEL } from "../../../utils/destinyRankMeta";
import { usesSoulMarkInsteadOfInterceptor, type DestinyElfInstance } from "../../../utils/destinyGacha";
import type { BattleViewMode, Side } from "../../../battle/viewerPerspective";
import { maskForViewer } from "../maskForViewer";
import { C, hashSeed, rule } from "./bModel";
import { Ink, RankSeal } from "./Ink";
import { DW } from "../../../design/sketchStroke";

const STAT_ROWS: [keyof NonNullable<DestinyElfInstance["baseStats"]>, string][] = [
  ["hp", "體力"], ["atk", "攻擊"], ["def", "防禦"], ["spatk", "特攻"], ["spdef", "特防"], ["speed", "速度"],
];

/**
 * 精靈詳情圖版：桌機為右側抽屜，手機為全頁；內容區 overflow-y-auto 並限制 max-h（修 D-05），
 * 關閉鈕固定在頂列。魂印／特質走 EffectDescription 層次元件（修 D-06），技能依資料順序並標第五技能（D-09）。
 */
export function DetailSheet({ elf, owner, mode, blueprint, onClose }: { elf: DestinyElfInstance; owner: Side; mode: BattleViewMode; blueprint: boolean; onClose: () => void }) {
  const view = useMemo(() => maskForViewer(elf, owner, mode), [elf, owner, mode]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, [elf.instanceId]);
  const seed = hashSeed(elf.instanceId);
  const info = explainElfDisplayRank(view);
  const total = Object.values(view.baseStats || {}).reduce<number>((s, v) => s + (Number(v) || 0), 0);
  const isLiujie = usesSoulMarkInsteadOfInterceptor(view.name);
  const showIntercept = elf.destinyRank === "C" && elf.interceptorEffect && !isLiujie;
  const traits = view.alienTraits;
  const rankLabel = DESTINY_RANK_LABEL[elf.destinyRank];
  return (
    <div className="dwb-sheet-wrap" onClick={onClose} data-testid="b-detail-wrap">
      <aside className="dwb-sheet" role="dialog" aria-modal="true" aria-label={`${view.name} 詳情`} data-testid="b-detail" onClick={e => e.stopPropagation()}>
        <div className="dwb-sheet-top">
          <button ref={closeRef} type="button" className="dwb-sheet-x" aria-label="關閉詳情" data-testid="b-detail-close" onClick={onClose}>關閉</button>
          <span className="dwb-sheet-kicker">FIG. {String(seed % 100).padStart(2, "0")}</span>
        </div>
        <div className="dwb-sheet-body" data-testid="b-detail-body">
          <header className="dwb-sheet-head">
            <div className="dwb-sheet-art"><ElfAvatar elf={view} battleSide={view.isConcealed ? owner : undefined} kind="body" className="dwb-portrait-img" /></div>
            <div className="dwb-sheet-id">
              <h2>{view.name}</h2>
              <div className="dwb-sheet-row"><RankSeal rank={elf.destinyRank} size={34} seed={seed % 997} /><span>{rankLabel.title}</span></div>
              <div className="dwb-sheet-row">{view.type ? <><TypeIcon type={view.type} size={16} showLabelWhenMissing={false} /><span>{view.type}</span></> : null}</div>
              <div className="dwb-sheet-row dwb-muted">魂印：【{view.soulMark?.name || "無"}】</div>
            </div>
          </header>

          <section className="dwb-sec" data-testid="b-detail-stats">
            <h3>種族值 <small>{total}</small></h3>
            <svg className="dwb-sheet-rule" viewBox="0 0 300 4" preserveAspectRatio="none" aria-hidden="true"><Ink d={rule(0, 2, 300, 2, seed + 1)} color={C.cobalt} width={DW(0.8)} /></svg>
            <ul className="dwb-stats">
              {STAT_ROWS.map(([k, label]) => {
                const v = Number(view.baseStats?.[k]) || 0;
                return (
                  <li key={k} data-stat={k}>
                    <span>{label}</span>
                    <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><Ink d={rule(0, 3, Math.max(2, Math.min(100, v / 2)), 3, seed + 20, { ext: 0, bow: 0.002 })} color={C.cobalt} width={DW(1.2) * 1.6} alpha={0.9} inked={false} /></svg>
                    <b>{v || "-"}</b>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="dwb-sec dwb-desc" data-testid="b-detail-soul">
            <h3>魂印 <small>【{view.soulMark?.name || "無"}】</small></h3>
            <EffectDescription description={view.soulMark?.description || "（無記載）"} className="dwb-desc-body" />
          </section>

          {traits && (traits.gen2Trait || traits.exclusiveTrait || (traits.exclusiveTraits || []).length > 0 || traits.generalTrait) && (
            <section className="dwb-sec dwb-desc" data-testid="b-detail-traits">
              <h3>特質</h3>
              {traits.gen2Trait && <div className="dwb-trait"><b>二代特質：【{traits.gen2Trait.name}】</b><EffectDescription description={traits.gen2Trait.description} className="dwb-desc-body" /></div>}
              {traits.exclusiveTrait && <div className="dwb-trait"><b>專屬特質：【{traits.exclusiveTrait.name}】</b><EffectDescription description={traits.exclusiveTrait.description} className="dwb-desc-body" /></div>}
              {(traits.exclusiveTraits || []).map(t => <div key={t.name} className="dwb-trait"><b>專屬特質：【{t.name}】</b><EffectDescription description={t.description} className="dwb-desc-body" /></div>)}
              {traits.generalTrait && <div className="dwb-trait"><b>通用特性：【{traits.generalTrait.name}】</b><EffectDescription description={traits.generalTrait.description} className="dwb-desc-body" /></div>}
            </section>
          )}

          {showIntercept && (
            <section className="dwb-sec dwb-sec--c" data-testid="b-detail-intercept">
              <h3>C 級命運攔截 <small>【{elf.interceptorEffect!.name}】</small></h3>
              <RichDescription text={elf.interceptorEffect!.description} className="dwb-desc-body" />
            </section>
          )}

          <section className="dwb-sec" data-testid="b-detail-skills">
            <h3>技能 <small>{view.skills?.length || 0} 招</small></h3>
            <ol className="dwb-skills">
              {(view.skills || []).map((sk, i) => (
                <li key={i} data-skill-index={i}>
                  <div className="dwb-skill-head">
                    <span className="dwb-skill-no">{String(i + 1).padStart(2, "0")}</span>
                    <b>{sk.name}</b>
                    {sk.isFifthSkill && <span className="dwb-fifth" data-fifth-skill="true" data-testid="b-fifth">第五技能</span>}
                    <span className="dwb-skill-facts">
                      <SkillTypeIcon skill={sk} size={13} showLabelWhenMissing={false} />
                      {skillDisplayType(sk)}／{sk.category}　威力 {sk.power}　PP {sk.pp}
                      {sk.priority ? `　先制${sk.priority > 0 ? "+" : ""}${sk.priority}` : ""}
                    </span>
                  </div>
                  <RichDescription text={sk.description} className="dwb-desc-body" />
                </li>
              ))}
              {!(view.skills || []).length && <li className="dwb-muted">尚無已登記的技能。</li>}
            </ol>
          </section>

          {blueprint && (
            <section className="dwb-sec dwb-sec--bp" data-testid="b-detail-bp">
              <h3>圖紙 <small>判定來源</small></h3>
              <p>{elf.destinyRank} 級　依據：{RANK_SOURCE_LABEL[info.source]}　種族值總和 {total}</p>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
