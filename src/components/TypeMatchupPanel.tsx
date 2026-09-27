// 精靈詳情：屬性圖標框＋克制倍率速查（公式同 statCalculator.getTypeMatchup）
import React, { useMemo, useState } from "react";
import { SEER_TYPES, getTypeMatchup } from "../utils/statCalculator";
import { TypeIcon } from "./SeerImages";
import { splitTypes } from "../battle/seerAssets";

const SINGLE = SEER_TYPES.filter(t => t !== "無屬性");
const fmt = (m: number) => `×${Number(m.toFixed(3))}`;
const tone = (m: number) =>
  m === 0 ? "text-slate-500" : m >= 2 ? "text-rose-300" : m > 1 ? "text-orange-300" : m < 1 ? "text-sky-300" : "text-slate-300";

function Groups({ rows }: { rows: { t: string; m: number }[] }) {
  const map = new Map<number, string[]>();
  rows.forEach(r => { if (r.m !== 1) map.set(r.m, [...(map.get(r.m) || []), r.t]); });
  const keys = [...map.keys()].sort((a, b) => b - a);
  const normal = rows.filter(r => r.m === 1).length;
  return (
    <div className="space-y-1.5">
      {keys.map(k => (
        <div key={k} className="flex items-start gap-2">
          <span className={`w-14 shrink-0 text-[14px] font-bold tabular-nums pt-0.5 ${tone(k)}`}>{k === 0 ? "無效" : fmt(k)}</span>
          <div className="flex flex-wrap gap-1">
            {map.get(k)!.map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-1.5 py-0.5 text-[12px] text-slate-200" title={t}>
                <TypeIcon type={t} size={18} showLabelWhenMissing={false} />{t}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="text-[12px] text-slate-500">×1：{normal} 個屬性</div>
    </div>
  );
}

export function TypeMatchupPanel({ type }: { type: string }) {
  const [side, setSide] = useState<"atk" | "def">("atk");
  const [o1, setO1] = useState("");
  const [o2, setO2] = useState("");
  const parts = splitTypes(type);
  const self = parts.join(".") || type;
  const rows = useMemo(() => SINGLE.map(t => ({ t, m: side === "atk" ? getTypeMatchup(self, t) : getTypeMatchup(t, self) })), [self, side]);
  const opp = [o1, o2].filter(Boolean).join(".");
  const mAtk = opp ? getTypeMatchup(self, opp) : null;
  const mDef = opp ? getTypeMatchup(opp, self) : null;

  return (
    <div className="ios-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[15px] font-semibold text-slate-100 flex items-center gap-1.5">
          <span className="w-1.5 h-3 bg-cyan-500 rounded-sm"></span>屬性與克制
        </h4>
        <div className="ios-segment">
          <button data-active={side === "atk"} onClick={() => setSide("atk")} title="本系技能打各屬性">攻擊</button>
          <button data-active={side === "def"} onClick={() => setSide("def")} title="各屬性打本精靈">防守</button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 shrink-0 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center">
          <TypeIcon type={type} size={52} />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold text-slate-100">{parts.length ? parts.join("・") + "系" : (type || "無屬性")}</div>
          <div className="text-[12px] text-slate-500">{parts.length > 1 ? "雙屬性" : "單屬性"}</div>
        </div>
      </div>
      <Groups rows={rows} />
      <div className="rounded-xl bg-black/25 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-slate-400">對手</span>
          {[{ v: o1, set: setO1, ph: "屬性" }, { v: o2, set: setO2, ph: "副屬性" }].map((s, i) => (
            <select key={i} value={s.v} onChange={e => s.set(e.target.value)} disabled={i === 1 && !o1}
              className="bg-white/[0.06] rounded-lg px-2 py-1.5 text-[13px] text-slate-100 focus:outline-none disabled:opacity-40">
              <option value="" className="bg-slate-900">{s.ph}</option>
              {SINGLE.filter(t => i === 0 || t !== o1).map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
            </select>
          ))}
          {opp && <TypeIcon type={opp} size={22} />}
        </div>
        {opp && mAtk != null && mDef != null && (
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-lg bg-white/[0.04] px-3 py-2">我打對手 <b className={`text-[16px] ${tone(mAtk)}`}>{fmt(mAtk)}</b></div>
            <div className="rounded-lg bg-white/[0.04] px-3 py-2">對手打我 <b className={`text-[16px] ${tone(mDef)}`}>{fmt(mDef)}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}
