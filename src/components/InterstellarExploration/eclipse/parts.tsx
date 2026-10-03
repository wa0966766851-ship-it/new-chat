import React from "react";
import type { Elf } from "../../../types";
import { ElfAvatar, TypeIcon } from "../../SeerImages";
import { RELIC_BY_ID, RARITY_LABEL } from "../../../modes/interstellar/v2/relics";
import { eclipseStage } from "../../../modes/interstellar/v2/content";
import { isAliveBySurvivalRule } from "../../../battle/survivalRules";
import { resolvePetIds } from "../../../battle/seerAssets";
import { CARD_ART_IDS } from "../../../modes/interstellar/v2/cardIds";

/** 蝕月：黑影從右側吞沒金色月盤，蝕度 0–100+ */
export function EclipseMoon({ value, size = 44 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const offset = 2 - (v / 100) * 2; // 1 → 完全遮蔽
  const stage = eclipseStage(value);
  return (
    <div className="flex items-center gap-2 group relative" title={`蝕度 ${value}｜${stage.name}：${stage.desc}`}>
      <svg width={size} height={size} viewBox="-1.2 -1.2 2.4 2.4" aria-label={`蝕度 ${value}`}>
        <defs>
          <radialGradient id="ecl-moon" cx="35%" cy="35%"><stop offset="0%" stopColor="#fff3c4" /><stop offset="70%" stopColor="#d9b45a" /><stop offset="100%" stopColor="#7a5418" /></radialGradient>
          <filter id="ecl-corona"><feGaussianBlur stdDeviation=".08" /></filter>
        </defs>
        <circle r="1.08" fill="none" stroke={v >= 100 ? "#e0475f" : "#d9b45a"} strokeWidth=".03" opacity=".6" filter="url(#ecl-corona)" />
        <circle r="1" fill="url(#ecl-moon)" />
        <circle r="1.02" cx={offset} fill="#07060c" />
      </svg>
      <div className="leading-tight">
        <div className="ecl-roman text-[10px] ecl-muted">Eclipse</div>
        <div className={`font-black tabular-nums ${v >= 75 ? "ecl-blood" : ""}`}>{value}<span className="text-xs ecl-muted ml-1">{stage.name}</span></div>
      </div>
    </div>
  );
}

export const RelicSigil: React.FC<{ id: string; size?: "sm" | "md" | "lg"; showName?: boolean }> = ({ id, size = "md", showName = false }) => {
  const r = RELIC_BY_ID[id]; if (!r) return null;
  const dim = size === "sm" ? "1.6rem" : size === "lg" ? "3rem" : "2.1rem";
  return (
    <span className="group relative inline-flex items-center gap-1.5">
      <RelicIcon id={id} rarity={r.rarity} glyph={r.glyph} dim={dim} fontSize={size === "lg" ? "1.4rem" : size === "sm" ? ".8rem" : "1rem"} />
      {showName && <span className="text-sm font-bold">{r.name}</span>}
      <span className="pointer-events-none absolute left-1/2 top-full z-[80] mt-2 w-56 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity ecl-frame p-3 text-left">
        <span className="block text-sm font-black ecl-gilt">{r.name}</span>
        <span className="block text-[10px] ecl-roman ecl-muted mb-1">{RARITY_LABEL[r.rarity]}</span>
        <span className="block text-xs leading-relaxed">{r.desc}</span>
        {r.lore && <span className="block text-[11px] italic ecl-muted mt-1">「{r.lore}」</span>}
      </span>
    </span>
  );
};

/** 遺物圖示：官方道具圖（public/eclipse/relic）置於六角徽框中，缺圖時退回單字徽記 */
export function RelicIcon({ id, rarity, glyph, dim, fontSize }: { id: string; rarity: string; glyph: string; dim: string; fontSize?: string }) {
  const [ok, setOk] = React.useState(true);
  return (
    <span className="ecl-sigil relative" data-rarity={rarity} style={{ width: dim, height: dim, fontSize }}>
      {ok ? <img src={`/eclipse/relic/${id}.webp`} alt="" draggable={false} onError={() => setOk(false)} className="absolute inset-[12%] w-[76%] h-[76%] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,.8)]" /> : glyph}
    </span>
  );
}

/** SeerAPI 精靈全身圖作為 NPC 立繪 */
export function NpcArt({ id, className = "" }: { id: number; className?: string }) {
  const [ok, setOk] = React.useState(true);
  if (!ok) return <div className={`grid place-items-center text-6xl ecl-gilt ${className}`}>☾</div>;
  return <img src={`/seer/body/${id}.png`} alt="" className={`ecl-npc object-contain ${className}`} onError={() => setOk(false)} draggable={false} />;
}

export function hpRatio(e: Elf) { return e.maxHp > 0 ? Math.max(0, Math.min(1, e.currentHp / e.maxHp)) : 0; }
export const alive = (e: Elf) => isAliveBySurvivalRule(e.currentHp, e.survivalRule);

/** 精靈塔羅卡 */
export const ElfTarot: React.FC<{ elf: Elf; picked?: boolean; onClick?: () => void; footer?: React.ReactNode; badge?: React.ReactNode; disabled?: boolean }> = ({ elf, picked, onClick, footer, badge, disabled }) => {
  const cardId = React.useMemo(() => { try { return resolvePetIds(elf as any, "body").find(id => CARD_ART_IDS.has(id)); } catch { return undefined; } }, [elf]);
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="ecl-card w-full text-left disabled:opacity-40" data-picked={picked ? "true" : "false"}>
      {cardId ? (
        <img src={`/seer/card/${cardId}.png`} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover opacity-90" style={{ filter: "saturate(.75) contrast(1.08) brightness(.82)" }} />
      ) : (
        <div className="absolute inset-x-0 top-0 h-[68%] flex items-end justify-center overflow-hidden">
          <ElfAvatar elf={elf} kind="body" className="max-h-full max-w-[92%] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,.8)]" fallbackClassName="text-5xl font-black ecl-gilt" />
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,.85)" }} />
      {badge && <div className="absolute top-2 left-2">{badge}</div>}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/90 to-transparent">
        <div className="ecl-rule mb-2" />
        <div className="font-black text-base leading-tight truncate">{elf.name}</div>
        <div className="flex items-center gap-1 text-xs ecl-muted mt-0.5"><TypeIcon type={elf.type} size={14} showLabelWhenMissing={false} />{elf.type}</div>
        {footer}
      </div>
    </button>
  );
};

/** 隊伍列：橢圓肖像＋細血條 */
export function TeamStrip({ team, max, onPick, highlight }: { team: Elf[]; max: number; onPick?: (i: number) => void; highlight?: (e: Elf, i: number) => boolean }) {
  return (
    <div className="flex items-end gap-3">
      {team.map((e, i) => {
        const dead = !alive(e);
        return (
          <button key={e.battleId || i} type="button" onClick={onPick ? () => onPick(i) : undefined} disabled={!onPick}
            className={`group relative flex flex-col items-center w-16 ${onPick ? "cursor-pointer" : "cursor-default"}`} title={`${e.name}　${Math.max(0, e.currentHp)}/${e.maxHp}`}>
            <div className={`w-14 h-16 rounded-[50%] overflow-hidden border ${highlight?.(e, i) ? "border-[var(--ecl-gold-hi)] shadow-[0_0_18px_rgba(246,226,160,.6)]" : "border-[rgba(217,180,90,.45)]"} bg-black/60 ${dead ? "grayscale opacity-40" : ""}`}>
              <ElfAvatar elf={e} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center text-xl font-black ecl-gilt" />
            </div>
            {dead && <span className="absolute top-4 text-xl ecl-blood font-black">✝</span>}
            {(e as any).runBoost ? <span className="absolute -top-1 -right-1 text-[10px] px-1 ecl-frame">+{Math.round((e as any).runBoost * 100)}%</span> : null}
            <div className="ecl-hp w-full mt-1"><i style={{ width: `${hpRatio(e) * 100}%` }} /></div>
            <div className="text-[10px] truncate w-full text-center ecl-muted mt-0.5">{e.name}</div>
          </button>
        );
      })}
      {Array.from({ length: Math.max(0, max - team.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="w-16 flex flex-col items-center opacity-30"><div className="w-14 h-16 rounded-[50%] border border-dashed border-[rgba(217,180,90,.4)]" /></div>
      ))}
    </div>
  );
}

export function Ornament({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 12" className={`w-48 h-3 ${className}`} aria-hidden>
      <path d="M0 6 H80 M120 6 H200" stroke="#d9b45a" strokeWidth=".8" opacity=".6" />
      <path d="M100 0 L106 6 L100 12 L94 6 Z" fill="#d9b45a" />
      <circle cx="86" cy="6" r="1.6" fill="#d9b45a" /><circle cx="114" cy="6" r="1.6" fill="#d9b45a" />
    </svg>
  );
}
