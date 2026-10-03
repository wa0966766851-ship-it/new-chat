import React from "react";
import { motion } from "motion/react";
import type { Elf } from "../../../types";
import * as E from "../../../modes/interstellar/v2/engine";
import { AFFIX_BY_ID, EVENT_BY_ID, NPC } from "../../../modes/interstellar/v2/content";
import { RELIC_BY_ID, RARITY_LABEL } from "../../../modes/interstellar/v2/relics";
import { ElfTarot, NpcArt, Ornament, RelicIcon, RelicSigil, TeamStrip, alive } from "./parts";
import { ElfAvatar } from "../../SeerImages";

type Dispatch = (f: (r: E.RunV2) => E.RunV2) => void;
interface SceneProps { run: E.RunV2; pool: Elf[]; dispatch: Dispatch; onFight: () => void; onExit: () => void; onOpenTeam?: () => void; }

/** 場景外框：左立繪、右文字 */
function Stage({ npc, kicker, title, children, wide }: { npc?: number; kicker: string; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}
      className={`relative mx-auto w-full ${wide ? "max-w-6xl" : "max-w-5xl"} ecl-frame p-6 md:p-10`}>
      <div className={`grid gap-8 ${npc ? "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : ""}`}>
        {npc ? <div className="relative min-h-56 md:min-h-[26rem] flex items-end justify-center"><NpcArt id={npc} className="max-h-[26rem] w-full" /></div> : null}
        <div className="min-w-0">
          <div className="ecl-roman text-[11px] ecl-muted">{kicker}</div>
          <h2 className="ecl-title text-3xl md:text-4xl ecl-gilt mt-1">{title}</h2>
          <Ornament className="my-4" />
          {children}
        </div>
      </div>
    </motion.div>
  );
}

const Choice: React.FC<{ label: string; hint?: string; disabled?: boolean; reason?: string | null; onClick: () => void; tone?: "blood" }> = ({ label, hint, disabled, reason, onClick, tone }) => {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`group w-full text-left px-4 py-3 border transition-all ${tone === "blood" ? "border-[rgba(224,71,95,.45)] hover:bg-[rgba(155,28,49,.18)]" : "border-[rgba(217,180,90,.35)] hover:bg-[rgba(217,180,90,.08)]"} hover:pl-6 disabled:opacity-35 disabled:hover:pl-4 disabled:cursor-not-allowed`}>
      <div className="flex items-baseline gap-3">
        <span className="ecl-gilt font-black">◆</span>
        <span className="font-black tracking-wider">{label}</span>
      </div>
      {(hint || reason) && <div className="pl-7 text-xs ecl-muted mt-0.5">{reason ? <span className="ecl-blood">{reason}</span> : hint}</div>}
    </button>
  );
};

function Prose({ text }: { text: string }) { return <div className="ecl-prose text-[15px] md:text-base"><p>{text}</p></div>; }

/* ───────── 各場景 ───────── */
export function DraftScene({ run, pool, dispatch }: SceneProps) {
  if (run.scene.kind !== "draft") return null;
  const sc = run.scene;
  return (
    <Stage kicker="The Lantern Bearers" title="選擇持燈者" wide>
      <p className="ecl-muted mb-5">回廊只容得下三盞燈。選出三隻精靈與你同行；之後的夥伴，要在黑暗裡找。</p>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {sc.offer.map(id => { const e = E.findElf(pool, id); if (!e) return null; const picked = sc.picks.includes(id);
          return <ElfTarot key={id} elf={e} picked={picked} onClick={() => dispatch(r => E.toggleDraft(r, id))}
            footer={<div className="text-[10px] ecl-roman mt-1" style={{ color: "var(--ecl-gold)" }}>{tierText(E.tierOf(pool, e))}</div>} />; })}
      </div>
      <div className="flex items-center justify-between mt-6">
        <span className="ecl-muted">已選 <b className="ecl-gilt text-lg">{sc.picks.length}</b> / 3</span>
        <button className="ecl-btn" disabled={sc.picks.length !== 3} onClick={() => dispatch(r => E.confirmDraft(r, pool))}>點燃燈火</button>
      </div>
    </Stage>
  );
}
const tierText = (t: E.Tier) => ({ low: "Ⅰ 微光", mid: "Ⅱ 燭火", high: "Ⅲ 烈焰", apex: "Ⅳ 恆星" }[t]);

export function EventScene({ run, pool, dispatch }: SceneProps) {
  if (run.scene.kind !== "event") return null;
  const ev = EVENT_BY_ID[run.scene.eventId]; if (!ev) return null;
  const outcome = run.scene.outcome;
  return (
    <Stage npc={ev.npc} kicker="Omen" title={ev.title}>
      <Prose text={ev.text} />
      <div className="mt-6 space-y-2">
        {outcome ? (
          <>
            <div className="border-l-2 border-[var(--ecl-gold)] pl-4 py-2 italic">{outcome}</div>
            <div className="pt-3"><button className="ecl-btn" onClick={() => dispatch(r => E.backToMap(r))}>繼續前行</button></div>
          </>
        ) : ev.choices.map((c, i) => { const reason = c.require?.(run) ?? null; return <Choice key={i} label={c.label} hint={c.hint} reason={reason} disabled={!!reason} onClick={() => dispatch(r => E.chooseEvent(r, i, pool))} />; })}
      </div>
    </Stage>
  );
}

function ReplacePicker({ run, onPick, onCancel, incoming }: { run: E.RunV2; onPick: (i: number) => void; onCancel: () => void; incoming: string }) {
  return (
    <div className="mt-5 p-4 border border-[rgba(224,71,95,.5)] bg-black/40">
      <div className="mb-3 text-sm">隊伍已滿。讓誰離開，換【{incoming}】加入？</div>
      <TeamStrip team={run.team} max={run.team.length} onPick={onPick} />
      <button className="ecl-btn ecl-btn-ghost mt-3 text-sm" onClick={onCancel}>取消</button>
    </div>
  );
}

export function ShopScene({ run, pool, dispatch }: SceneProps) {
  const [replace, setReplace] = React.useState<number | null>(null);
  if (run.scene.kind !== "shop") return null;
  const stock = run.scene.stock;
  const full = false; // 隊伍無上限：新成員一律加入（出戰名單滿則待命）
  const buy = (i: number, replaceIdx = -1) => dispatch(r => E.shopBuy(r, i, pool, replaceIdx));
  const label = (s: E.ShopItem) => s.kind === "relic" ? RELIC_BY_ID[s.ref!]?.name : s.kind === "elf" ? E.findElf(pool, s.ref!)?.name : s.kind === "potion" ? "藥劑" : s.kind === "mend" ? "縫合（全隊恢復 30%）" : "淨化（移除一個詛咒）";
  return (
    <Stage kicker="Guild of Pupils" title="瞳孔商會" wide>
      <div className="absolute right-4 top-4 w-40 h-48 md:w-56 md:h-64 opacity-80 pointer-events-none"><NpcArt id={NPC.shop} className="w-full h-full" /></div>
      <p className="ecl-muted mb-4 pr-44 md:pr-60">「每一件都看過很多主人。你會是最後一個嗎？」</p>
      <div className="grid md:grid-cols-2 gap-3 relative">
        {stock.map((s, i) => {
          const can = (s.currency === "beans" ? run.beans : run.shards) >= s.price && !s.sold && !(s.kind === "purge" && !run.relics.some(r => r.startsWith("curse_")));
          const elf = s.kind === "elf" ? E.findElf(pool, s.ref!) : null;
          return (
            <div key={i} className={`relative p-3 border ${s.sold ? "opacity-35" : ""} border-[rgba(217,180,90,.3)] bg-black/35 flex items-center gap-3`}>
              <span className="shrink-0">{s.kind === "relic" ? <RelicSigil id={s.ref!} size="lg" /> : elf ? <ElfHeadMini elf={elf} /> : <RelicIcon id={s.kind === "potion" ? "_potion" : s.kind === "mend" ? "_mend" : "_purge"} rarity="common" glyph={s.kind === "potion" ? "藥" : s.kind === "mend" ? "縫" : "淨"} dim="3rem" fontSize="1.3rem" />}</span>
              <div className="min-w-0 flex-1">
                <div className="font-black truncate">{label(s)}</div>
                <div className="text-xs ecl-muted truncate">{s.kind === "relic" ? `${RARITY_LABEL[RELIC_BY_ID[s.ref!].rarity]}・${RELIC_BY_ID[s.ref!].desc}` : s.kind === "elf" ? "契約：加入隊伍" : s.kind === "potion" ? "戰鬥中使用" : ""}</div>
              </div>
              <button className="ecl-btn text-sm px-3 py-1.5 shrink-0 whitespace-nowrap" disabled={!can} onClick={() => s.kind === "elf" && full ? setReplace(i) : buy(i)}>
                {s.sold ? "已售" : `${s.price}${s.currency === "beans" ? " 豆" : " 晶"}`}
              </button>
            </div>
          );
        })}
      </div>
      {replace !== null && <ReplacePicker run={run} incoming={label(stock[replace]) ?? ""} onPick={i => { buy(replace, i); setReplace(null); }} onCancel={() => setReplace(null)} />}
      <div className="pt-6"><button className="ecl-btn" onClick={() => dispatch(r => E.backToMap(r))}>離開商會</button></div>
    </Stage>
  );
}
function ElfHeadMini({ elf }: { elf: Elf }) {
  return <div className="w-12 h-14 rounded-[50%] overflow-hidden border border-[rgba(217,180,90,.5)] bg-black/60"><ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center font-black ecl-gilt" /></div>;
}

export function RestScene({ run, dispatch }: SceneProps) {
  const [mode, setMode] = React.useState<"revive" | "temper" | null>(null);
  if (run.scene.kind !== "rest") return null;
  const done = run.scene.done;
  const fallen = run.team.some(e => !alive(e));
  const heal = Math.round(35 * E.mods(run).restHealMult);
  return (
    <Stage npc={NPC.rest} kicker="Star Furnace" title="星爐">
      <Prose text="爐火是冷的藍色，燒的不是木頭。燭燈使者把你的夥伴一一點名，問你要把火用在哪裡。" />
      <div className="mt-6 space-y-2">
        {done ? (<><div className="border-l-2 border-[var(--ecl-teal)] pl-4 py-2 italic">{done}</div><button className="ecl-btn mt-3" onClick={() => dispatch(r => E.backToMap(r))}>繼續前行</button></>) : (
          <>
            <Choice label="修復" hint={`存活者恢復 ${heal}% 體力，技能 PP 回滿，藥劑 +1`} onClick={() => dispatch(r => E.restAction(r, "mend"))} />
            <Choice label="復甦" hint="一隻陣亡精靈以 50% 體力歸來" disabled={!fallen} reason={fallen ? null : "沒有陣亡的夥伴"} onClick={() => setMode("revive")} />
            <Choice label="淬鍊" hint="一隻精靈全能力永久 +8%" onClick={() => setMode("temper")} />
            {mode && (
              <div className="pt-4">
                <div className="text-sm mb-2 ecl-muted">{mode === "revive" ? "選擇要復甦的夥伴" : "選擇要淬鍊的夥伴"}</div>
                <TeamStrip team={run.team} max={run.team.length} highlight={e => mode === "revive" ? !alive(e) : alive(e)}
                  onPick={i => { const e = run.team[i]; if (mode === "revive" ? alive(e) : !alive(e)) return; dispatch(r => E.restAction(r, mode, i)); setMode(null); }} />
              </div>
            )}
          </>
        )}
      </div>
    </Stage>
  );
}

function RelicChoice({ ids, taken, onTake }: { ids: string[]; taken?: string; onTake: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {ids.map(id => { const r = RELIC_BY_ID[id]; if (!r) return null; const picked = taken === id;
        return (
          <button key={id} type="button" className="ecl-card !aspect-auto min-h-60 text-center p-5 flex flex-col items-center justify-center gap-3 disabled:opacity-30" data-rarity={r.rarity} data-picked={picked ? "true" : "false"} disabled={!!taken && !picked} onClick={() => onTake(id)}>
            <RelicIcon id={id} rarity={r.rarity} glyph={r.glyph} dim="5rem" fontSize="2rem" />
            <span className="font-black ecl-gilt text-lg">{r.name}</span>
            <span className="ecl-roman text-[10px] ecl-muted">{RARITY_LABEL[r.rarity]}</span>
            <span className="text-sm leading-relaxed">{r.desc}</span>
            {r.lore && <span className="text-xs italic ecl-muted">「{r.lore}」</span>}
          </button>
        ); })}
    </div>
  );
}

export function TreasureScene({ run, dispatch }: SceneProps) {
  if (run.scene.kind !== "treasure") return null;
  const sc = run.scene;
  return (
    <Stage kicker="Reliquary" title="寶匣" wide>
      <p className="ecl-muted mb-5">匣子裡有三樣東西，但只有一隻手伸得進去。</p>
      <RelicChoice ids={sc.offer} taken={sc.done ? sc.offer.find(id => RELIC_BY_ID[id]?.name === sc.done) : undefined} onTake={id => dispatch(r => E.takeTreasure(r, id))} />
      <div className="pt-6"><button className="ecl-btn" onClick={() => dispatch(r => E.backToMap(r))}>{sc.done ? "闔上寶匣" : "什麼都不拿"}</button></div>
    </Stage>
  );
}

export function AltarScene({ run, dispatch }: SceneProps) {
  if (run.scene.kind !== "altar") return null;
  const done = run.scene.done;
  return (
    <Stage npc={NPC.altar} kicker="Altar of the Eclipse" title="蝕之祭壇">
      <Prose text="祭壇上沒有神像，只有一個凹槽，形狀像你。詛咒之神從石縫裡伸出手指：「代價先付，恩賜後給。」" />
      <div className="mt-6 space-y-2">
        {done ? (<><div className="border-l-2 border-[var(--ecl-blood-hi)] pl-4 py-2 italic">{done}</div><button className="ecl-btn mt-3" onClick={() => dispatch(r => E.backToMap(r))}>離開祭壇</button></>) : (
          <>
            {E.ALTAR_PACTS.map(p => <Choice key={p.id} tone="blood" label={p.label} hint={p.hint} onClick={() => dispatch(r => E.altarPact(r, p.id))} />)}
            <Choice label="離開" onClick={() => dispatch(r => E.altarPact(r, "leave"))} />
          </>
        )}
      </div>
    </Stage>
  );
}

export function PreludeScene({ run, pool, dispatch, onFight, onOpenTeam }: SceneProps) {
  if (run.scene.kind !== "prelude") return null;
  const enc = run.scene.encounter;
  const foes = E.buildEnemies(enc, pool, E.enemyHpFloor(run, enc));
  const boss = enc.kind === "boss";
  return (
    <Stage kicker={boss ? "Throne" : enc.kind === "elite" ? "Nightmare" : "Encounter"} title={enc.title} wide>
      <div className="flex flex-wrap gap-4 justify-center">
        {foes.map((f, i) => (
          <div key={i} className="w-40 md:w-48">
            <ElfTarot elf={f} footer={
              <div className="mt-1 space-y-1">
                <div className="text-[11px] ecl-muted tabular-nums">體力 {f.maxHp}・攻 {f.calculatedStats.atk}・特攻 {f.calculatedStats.spatk}</div>
                <div className="flex flex-wrap gap-1">{enc.enemies[i]?.affixes.map(a => <span key={a} title={AFFIX_BY_ID[a]?.desc} className="text-[10px] px-1.5 border border-[rgba(224,71,95,.6)] ecl-blood">{AFFIX_BY_ID[a]?.name}</span>)}</div>
              </div>} />
          </div>
        ))}
      </div>
      <div className="mt-4 text-center text-sm ecl-muted">體力 ×{enc.hpScale ?? enc.scale}・其他能力 ×{enc.scale}{enc.reward ? `・勝利可得${enc.reward === "legendary" ? "傳說" : "稀有"}遺物` : ""}</div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="ecl-muted mr-1">出戰 {E.lineupOf(run).filter(alive).length}/{E.lineupSlots(run)}：</span>
        {E.lineupOf(run).map((e, i) => <span key={e.battleId || i} className={`px-2 py-0.5 border ${alive(e) ? "border-[rgba(217,180,90,.35)]" : "border-[rgba(224,71,95,.4)] ecl-blood line-through"}`}>{e.name}</span>)}
        {onOpenTeam && <button className="text-xs ml-2 px-3 py-1 border border-[rgba(217,180,90,.5)] hover:bg-[rgba(217,180,90,.1)]" onClick={onOpenTeam}>調整出戰</button>}
      </div>
      <div className="flex justify-center gap-4 pt-4">
        <button className={`ecl-btn ${boss ? "ecl-btn-blood" : ""}`} disabled={!E.lineupOf(run).some(alive)} title={E.lineupOf(run).some(alive) ? "" : "出戰名單沒有存活的精靈"} onClick={onFight}>迎戰</button>
        {!boss && <button className="ecl-btn ecl-btn-ghost" onClick={() => dispatch(r => E.fleeEncounter(r))}>撤離</button>}
      </div>
    </Stage>
  );
}

export function RewardScene({ run, pool, dispatch }: SceneProps) {
  const [replace, setReplace] = React.useState<string | null>(null);
  if (run.scene.kind !== "reward") return null;
  const { reward, title } = run.scene;
  const full = false; // 隊伍無上限：新成員一律加入（出戰名單滿則待命）
  return (
    <Stage kicker="Spoils" title={title} wide>
      <div className="flex flex-wrap gap-6 mb-6 text-lg">
        <span>賽爾豆 <b className="ecl-gilt">+{reward.beans}</b></span>
        {reward.shards > 0 && <span>星晶 <b className="ecl-gilt">+{reward.shards}</b></span>}
        {reward.potions > 0 && <span>藥劑 <b className="ecl-gilt">+{reward.potions}</b></span>}
        <span className="ecl-muted text-sm self-end">經驗 +{reward.exp}</span>
      </div>
      {reward.relicChoices.length > 0 && (<>
        <div className="ecl-roman text-xs ecl-muted mb-2">Choose a relic</div>
        <RelicChoice ids={reward.relicChoices} taken={reward.relicTaken} onTake={id => dispatch(r => E.takeRewardRelic(r, id))} />
      </>)}
      {reward.recruitChoices.length > 0 && (<>
        <div className="ecl-roman text-xs ecl-muted mt-6 mb-2">A soul wishes to follow</div>
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          {reward.recruitChoices.map(id => { const e = E.findElf(pool, id); if (!e) return null;
            return <ElfTarot key={id} elf={e} picked={reward.recruitTaken === id} disabled={!!reward.recruitTaken && reward.recruitTaken !== id}
              onClick={() => full ? setReplace(id) : dispatch(r => E.takeRewardRecruit(r, id, pool))} />; })}
        </div>
        {replace && <ReplacePicker run={run} incoming={E.findElf(pool, replace)?.name ?? ""} onPick={i => { dispatch(r => E.takeRewardRecruit(r, replace, pool, i)); setReplace(null); }} onCancel={() => setReplace(null)} />}
      </>)}
      <div className="pt-8"><button className="ecl-btn" onClick={() => dispatch(r => E.leaveReward(r, pool))}>{reward.isFinal ? "迎接黎明" : reward.isBoss ? "踏入下一章" : "繼續前行"}</button></div>
    </Stage>
  );
}

export function RecruitScene({ run, pool, dispatch }: SceneProps) {
  const [replace, setReplace] = React.useState<string | null>(null);
  if (run.scene.kind !== "recruit") return null;
  const full = false; // 隊伍無上限：新成員一律加入（出戰名單滿則待命）
  return (
    <Stage kicker="Covenant" title={run.scene.note} wide>
      <p className="ecl-muted mb-4">選一個，帶它走。其餘的會留在這裡，等下一個人。</p>
      <div className="grid grid-cols-3 gap-3 max-w-3xl">
        {run.scene.offer.map(id => { const e = E.findElf(pool, id); if (!e) return null;
          return <ElfTarot key={id} elf={e} onClick={() => full ? setReplace(id) : dispatch(r => E.recruitFromOffer(r, id, pool))} />; })}
      </div>
      {replace && <ReplacePicker run={run} incoming={E.findElf(pool, replace)?.name ?? ""} onPick={i => { dispatch(r => E.recruitFromOffer(r, replace, pool, i)); setReplace(null); }} onCancel={() => setReplace(null)} />}
      <div className="pt-6"><button className="ecl-btn ecl-btn-ghost" onClick={() => dispatch(r => E.recruitFromOffer(r, null, pool))}>誰也不帶</button></div>
    </Stage>
  );
}

export function EndScene({ run, onExit }: SceneProps) {
  if (run.scene.kind !== "end") return null;
  const win = run.scene.result === "victory";
  return (
    <Stage npc={win ? NPC.victory : NPC.defeat} kicker={win ? "Dawn" : "Extinguished"} title={win ? "太陽重新升起" : "燈熄了"}>
      <Prose text={win ? "王座空了。你回頭看，來時的路一盞一盞亮起，像是有人替你點的。" : "黑暗沒有聲音。等你醒來，回廊的門已經關上，只剩下這份紀錄。"} />
      <div className="grid grid-cols-2 gap-3 my-6 text-sm">
        <div>抵達章節 <b className="ecl-gilt text-lg">{run.act}</b></div>
        <div>戰鬥 <b className="ecl-gilt text-lg">{run.stats.fights}</b>　精英 {run.stats.elites}　首領 {run.stats.bosses}</div>
        <div>遺物 <b className="ecl-gilt text-lg">{run.relics.length}</b></div>
        <div>經驗 <b className="ecl-gilt text-lg">{run.exp}</b></div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-6">{run.relics.map((id, i) => <RelicSigil key={`${id}-${i}`} id={id} size="sm" />)}</div>
      <button className="ecl-btn" onClick={onExit}>{win ? "記下這段旅程" : "收起殘燭"}</button>
    </Stage>
  );
}

export const SCENES: Record<string, React.FC<SceneProps>> = {
  draft: DraftScene, event: EventScene, shop: ShopScene, rest: RestScene, treasure: TreasureScene,
  altar: AltarScene, prelude: PreludeScene, reward: RewardScene, recruit: RecruitScene, end: EndScene,
};
