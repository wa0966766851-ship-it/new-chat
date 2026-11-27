import React, {useState,useRef,useEffect} from "react";
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
  const [expanded,setExpanded]=useState<Key|null>(null);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!expanded)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setExpanded(null);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[expanded]);
  return (
    <div ref={root} className="dwb-lo-side" data-testid={`b-loadout-${side}`}>
      <h4>{label}{locked && <small>AI 已選</small>}</h4>
      {ROWS.map(r => (
        <div key={r.key} className="dwb-lo-row" onKeyDown={(event:React.KeyboardEvent<HTMLDivElement>)=>{if(expanded!==r.key)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setExpanded(null);event.currentTarget.querySelector<HTMLButtonElement>('.dwb-lo-summary')?.focus();}else if(event.key.startsWith('Arrow'))event.stopPropagation();}}>
          <span className="dwb-lo-key"><b>{r.name}</b><i>{r.en}</i></span>
          <button type="button" className="dwb-lo-summary" aria-expanded={expanded===r.key} aria-controls={`loadout-options-${side}-${r.key}`} data-testid={`b-lo-summary-${side}-${r.key}`} title={value ? loadoutLabel(r.key,value[r.key]).desc : undefined} onClick={()=>setExpanded(expanded===r.key?null:r.key)}>
            <span>{value ? loadoutLabel(r.key,value[r.key]).name : '尚未選擇'}</span><small aria-hidden="true">{expanded===r.key?'▴':'▾'}</small>
          </button>
          {expanded===r.key&&<div className="dwb-lo-opts" id={`loadout-options-${side}-${r.key}`} role="radiogroup" aria-label={`${label} ${r.name}`}>

            {r.list(options).map(id => {
              const l = loadoutLabel(r.key, id), on = value?.[r.key] === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={on} className={`dwb-lo-opt${on ? " on" : ""}`} title={l.desc}
                  data-testid={`b-lo-${side}-${r.key}`} data-value={id} disabled={locked} onClick={(event:React.MouseEvent<HTMLButtonElement>) => {onPick(r.key, id);setExpanded(null);event.currentTarget.closest('.dwb-lo-row')?.querySelector<HTMLButtonElement>('.dwb-lo-summary')?.focus();}}>
                  {l.color && <i className="dwb-lo-flame" style={{ background: l.color }} aria-hidden="true" />}{l.name}
                </button>
              );
            })}
          </div>}
        </div>
      ))}
    </div>
  );
}

/** 04 編隊章的「命運配裝」圖版：雙方套裝／目鏡／稱號（不重複）與火焰（2 選 1）。說明在 tooltip。 */
export function LoadoutPlate({ d, side }: { d: DestinyDraft; side?: "p1" | "p2" }) {
  if (!d.loadoutOptions) return null;
  const pve = d.battleMode === "PVE";
  return (
    <Plate fig="FIG.07" en="LOADOUT" title="命運配裝" testid={side ? `b-loadout-panel-${side}` : "b-loadout"} className={side ? `dwb-loadout-rail dwb-loadout-rail--${side}` : "dwb-plate--wide"}
      right={<span className="dwb-counts" title="套裝、目鏡、稱號雙方不重複；火焰各抽 2 種選 1">雙方不重複</span>}>
      <div className="dwb-lo">
        {side !== "p2" && <Side side="p1" label={`P1 ${d.p1Title}`} options={d.loadoutOptions.p1} value={d.p1Loadout} locked={false} onPick={(k, id) => d.chooseLoadout("p1", k, id)} />}
        {side !== "p1" && <Side side="p2" label={pve ? "對手 AI" : `P2 ${d.p2Title}`} options={d.loadoutOptions.p2} value={d.p2Loadout} locked={pve} onPick={(k, id) => d.chooseLoadout("p2", k, id)} />}
      </div>
    </Plate>
  );
}
