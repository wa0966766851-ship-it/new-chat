import React from "react";
import type { DestinyDraft } from "../useDestinyDraft";
import { loadoutLabel, type Loadout, type LoadoutOptions } from "../../../utils/destinyLoadout";
import { Plate } from "./Plate";

type Key = keyof Loadout;
const ROWS: { key: Key; name: string; en: string; list: (o: LoadoutOptions) => string[] }[] = [
  { key: "suit", name: "套裝", en: "SUIT", list: o => o.suits },
  { key: "eyewear", name: "目鏡", en: "LENS", list: o => o.eyewears },
  { key: "title", name: "稱號", en: "TITLE", list: o => o.titles },
  { key: "flame", name: "火焰", en: "FLAME", list: o => o.flames },
];

function Side({ side, label, options, value, locked, onPick }: {
  side: "p1" | "p2"; label: string; options: LoadoutOptions; value: Loadout | null; locked: boolean; onPick: (k: Key, id: string) => void;
}) {
  return (
    <div className="dwb-lo-side" data-testid={`b-loadout-${side}`}>
      <h4>{label}{locked && <small>AI 已選</small>}</h4>
      {ROWS.map(r => (
        <div key={r.key} className="dwb-lo-row" role="radiogroup" aria-label={`${label} ${r.name}`}>
          <span className="dwb-lo-key"><b>{r.name}</b><i>{r.en}</i></span>
          <div className="dwb-lo-opts">
            {r.list(options).map(id => {
              const l = loadoutLabel(r.key, id), on = value?.[r.key] === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={on} className={`dwb-lo-opt${on ? " on" : ""}`} title={l.desc}
                  data-testid={`b-lo-${side}-${r.key}`} data-value={id} disabled={locked && !on} onClick={() => onPick(r.key, id)}>
                  {l.color && <i className="dwb-lo-flame" style={{ background: l.color }} aria-hidden="true" />}{l.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 04 編隊章的「命運配裝」圖版：雙方套裝／目鏡／稱號（不重複）與火焰（2 選 1）。說明在 tooltip。 */
export function LoadoutPlate({ d }: { d: DestinyDraft }) {
  if (!d.loadoutOptions) return null;
  const pve = d.battleMode === "PVE";
  return (
    <Plate fig="FIG.07" en="LOADOUT" title="命運配裝" testid="b-loadout" className="dwb-plate--wide"
      right={<span className="dwb-counts" title="套裝、目鏡、稱號雙方不重複；火焰各抽 2 種選 1">雙方不重複</span>}>
      <div className="dwb-lo">
        <Side side="p1" label={`P1 ${d.p1Title}`} options={d.loadoutOptions.p1} value={d.p1Loadout} locked={false} onPick={(k, id) => d.chooseLoadout("p1", k, id)} />
        <Side side="p2" label={pve ? "對手 AI" : `P2 ${d.p2Title}`} options={d.loadoutOptions.p2} value={d.p2Loadout} locked={pve} onPick={(k, id) => d.chooseLoadout("p2", k, id)} />
      </div>
    </Plate>
  );
}
