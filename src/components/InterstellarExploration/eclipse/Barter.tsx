import React from "react";
import type { Elf } from "../../../types";
import * as E from "../../../modes/interstellar/v2/engine";
import { RELIC_BY_ID, RARITY_LABEL } from "../../../modes/interstellar/v2/relics";
import { tokenLabel, TIER_TEXT } from "../../../modes/interstellar/v2/recruit";
import { BARTER_MAX_USES, type BarterGet, type BarterGive, type BarterRecipe } from "../../../modes/interstellar/v2/barter";

type Dispatch = (f: (r: E.RunV2) => E.RunV2) => void;
const RARITY_NAME = (rs?: string[]) => (rs ?? []).map(r => RARITY_LABEL[r as keyof typeof RARITY_LABEL]).join("／");
const sideText = (s: BarterGive | BarterGet): string => {
  switch (s.kind) {
    case "beans": return `${s.qty} 賽爾豆`;
    case "shard": return `${s.qty} 星晶`;
    case "potion": return `${s.qty} 藥劑`;
    case "relic": return `${RARITY_NAME((s as BarterGive).rarities)}遺物`;
    case "token": { const t = (s as BarterGet).tokenTier; return t ? `單屬性令（至${TIER_TEXT[t].split(" ")[0]}）` : "招募令"; }
  }
};

const Row: React.FC<{ run: E.RunV2; r: BarterRecipe; pool: Elf[]; dispatch: Dispatch }> = ({ run, r, pool, dispatch }) => {
  const choices = E.barterGiveChoices(run, r);
  const [relicIdx, setRelicIdx] = React.useState<number | null>(null);
  const [tokenId, setTokenId] = React.useState<string | null>(null);
  const block = E.barterBlock(run, r.id);
  const uses = run.scene.kind === "shop" ? run.scene.barter?.uses[r.id] ?? 0 : 0;
  const relic = relicIdx !== null && choices.relics.includes(relicIdx) ? relicIdx : choices.relics[0];
  const token = tokenId && choices.tokens.includes(tokenId) ? tokenId : choices.tokens[0];
  return (
    <div className="p-3 border border-[rgba(217,180,90,.3)] bg-black/35 flex flex-wrap items-center gap-x-3 gap-y-2" data-testid={`barter-${r.id}`} title={`${r.name}：每家商店最多 ${BARTER_MAX_USES} 次`}>
      <div className="min-w-0 flex-1 basis-56">
        <div className="font-black text-sm">{r.name}</div>
        <div className="text-xs ecl-muted tabular-nums">{sideText(r.give)} → {sideText(r.get)}{uses ? `（已 ${uses}/${BARTER_MAX_USES}）` : ""}</div>
      </div>
      {r.give.kind === "relic" && choices.relics.length > 0 && (
        <select aria-label="選擇要給出的遺物" className="bg-black/60 border border-[rgba(217,180,90,.4)] text-xs px-2 py-1 max-w-[11rem]" value={relic} onChange={e => setRelicIdx(Number(e.target.value))}>
          {choices.relics.map(i => <option key={i} value={i}>{RELIC_BY_ID[run.relics[i]]?.name}</option>)}
        </select>
      )}
      {r.give.kind === "token" && choices.tokens.length > 0 && (
        <select aria-label="選擇要給出的招募令" className="bg-black/60 border border-[rgba(217,180,90,.4)] text-xs px-2 py-1 max-w-[11rem]" value={token} onChange={e => setTokenId(e.target.value)}>
          {choices.tokens.map(id => { const t = run.tokens.find(x => x.id === id)!; return <option key={id} value={id}>{tokenLabel(t)}</option>; })}
        </select>
      )}
      <button className="ecl-btn text-sm px-3 py-1.5 shrink-0 whitespace-nowrap" disabled={!!block} title={block ?? "兌換"} onClick={() => dispatch(x => E.barterTrade(x, r.id, { relic, token }, pool))}>兌換</button>
    </div>
  );
};

/** 商店「失與得」：以物易物。說明放 tooltip，畫面只留標題與配方。 */
export default function Barter({ run, pool, dispatch }: { run: E.RunV2; pool: Elf[]; dispatch: Dispatch }) {
  if (run.scene.kind !== "shop" || !run.scene.barter) return null;
  const recipes = E.barterRecipesOf(run), left = run.scene.barter.left;
  return (
    <section className="mt-6" data-testid="barter" aria-label="失與得">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="ecl-title text-xl ecl-gilt" title="以物易物：遺物、藥劑、賽爾豆、星晶、招募令互換。每家商店限次，每次兌換都會吃虧，換來換去只會變少。">失與得</h3>
        <span className="text-xs ecl-muted tabular-nums" title="本店剩餘兌換次數（N 等級越高越少）">剩餘 {left} 次</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] ecl-md:grid-cols-2 gap-3">
        {recipes.map(r => <Row key={r.id} run={run} r={r} pool={pool} dispatch={dispatch} />)}
      </div>
    </section>
  );
}
