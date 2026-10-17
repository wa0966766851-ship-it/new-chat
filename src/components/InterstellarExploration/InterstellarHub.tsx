import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Elf } from "../../types";
import InterstellarRun from "./InterstellarRun";
import { SUIT_CATALOG } from "../../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../../data/titles";
import * as E from "../../modes/interstellar/v2/engine";
import { ACTS, START_PACTS } from "../../modes/interstellar/v2/content";
import { RELICS } from "../../modes/interstellar/v2/relics";
import { EVENTS } from "../../modes/interstellar/v2/content";
import { Ornament, NpcArt } from "./eclipse/parts";
import SuitSelect from "./eclipse/SuitSelect";
import { SeedField, LevelPicker, BanPicker } from "./eclipse/SetupPanels";
import { newSeed } from "../../modes/interstellar/v2/rng";
import { encodeRunCode, parseSeedInput } from "../../modes/interstellar/v2/seed";
import { clampN, nEffects } from "../../modes/interstellar/v2/levels";
import { perkOf } from "../../modes/interstellar/v2/suitPerks";

interface InterstellarHubProps {
  allElves: Elf[];
  onBack: () => void;
  onStartBattle: (p1: Elf[], p2: Elf[], mode: any, options?: any) => void;
}
type Menu = "title" | "gear" | "setup" | "in_run" | "codex";
interface Meta { exp: number; level: number; bestAct: number; wins: number; runs: number }

function readMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(E.META_KEY) || "null");
    if (m) return { exp: m.exp ?? 0, level: m.level ?? 1, bestAct: m.bestAct ?? m.lastLayerReached ?? 0, wins: m.wins ?? 0, runs: m.runs ?? 0 };
  } catch { /* 損壞的舊資料視為新檔 */ }
  return { exp: 0, level: 1, bestAct: 0, wins: 0, runs: 0 };
}
const LEVEL_EXP = 1000;

export default function InterstellarHub({ allElves, onBack, onStartBattle }: InterstellarHubProps) {
  const [active, setActive] = React.useState(() => E.loadRunV2(localStorage));
  // 從戰鬥返回（有待結算或剛結算）直接進入回廊
  const [menu, setMenu] = React.useState<Menu>(() => {
    let back = false; try { back = sessionStorage.getItem("ECLIPSE_RETURN") === "1"; sessionStorage.removeItem("ECLIPSE_RETURN"); } catch { /* 無 sessionStorage */ }
    return active && (active.pendingBattle || back) ? "in_run" : "title";
  });
  const [meta, setMeta] = React.useState<Meta>(readMeta);
  const [equipType, setEquipType] = React.useState<"suit" | "title">("suit");
  const [equipId, setEquipId] = React.useState<string>(() => Object.keys(SUIT_CATALOG)[0] ?? "");
  const [pacts, setPacts] = React.useState<string[]>([]);
  const [confirmAbandon, setConfirmAbandon] = React.useState(false);
  const [nLevel, setNLevel] = React.useState(0);
  const [bans, setBans] = React.useState<string[]>([]);
  const [seedText, setSeedText] = React.useState(() => String(newSeed()));
  const [copied, setCopied] = React.useState(false);
  const pool = React.useMemo(() => E.bannablePool(allElves), [allElves]);
  const poolSig = React.useMemo(() => E.poolSigOf(allElves), [allElves]);
  const parsed = React.useMemo(() => parseSeedInput(seedText), [seedText]);
  const seed = parsed ? (parsed.kind === "code" ? parsed.setup.seed : parsed.seed) : 0;
  const seedNote = parsed?.kind === "code" && parsed.setup.poolSig && parsed.setup.poolSig !== poolSig ? "精靈池與局碼產生時不同，地圖相同但敵人與獎勵可能不同"
    : seedText.trim() && !parsed ? "局碼格式不正確" : undefined;
  const lv = nEffects(nLevel);
  const perkNow = lv.perksOff ? null : perkOf(equipType, equipId);
  const cap = E.banCapFor(nLevel, perkNow);
  const setLevel = (n: number) => { const v = clampN(n); setNLevel(v); setBans(b => b.slice(0, E.banCapFor(v, nEffects(v).perksOff ? null : perkOf(equipType, equipId)))); };
  const setup = { seed, nLevel, equipType, equipId, modifiers: pacts, bans, poolSig };
  /** 輸入的是完整局碼 → 把其中的裝束、契約、等級與禁用一起帶入 */
  const onSeedText = (v: string) => {
    setSeedText(v); setCopied(false);
    const p = parseSeedInput(v);
    if (p?.kind === "code") {
      setNLevel(p.setup.nLevel); setBans(p.setup.bans); setPacts(p.setup.modifiers); setEquipType(p.setup.equipType); setEquipId(p.setup.equipId);
    }
  };
  const copyCode = async () => {
    const code = encodeRunCode(setup);
    try { await navigator.clipboard.writeText(code); setCopied(true); } catch { setSeedText(code); }
  };
  const startingShards = 3 + (meta.bestAct >= 3 ? 1 : 0) + (meta.wins > 0 ? 1 : 0);

  React.useEffect(() => { localStorage.setItem(E.META_KEY, JSON.stringify(meta)); }, [meta]);

  const endRun = (act: number, exp: number) => {
    const run = E.loadRunV2(localStorage);
    if (!run) { setMenu("title"); return; }
    const won = run.scene.kind === "end" && run.scene.result === "victory";
    localStorage.removeItem(E.RUN_KEY_V2);
    setActive(null);
    setMeta(m => { const total = m.exp + exp; return { exp: total, level: Math.floor(total / LEVEL_EXP) + 1, bestAct: Math.max(m.bestAct, act), wins: m.wins + (won ? 1 : 0), runs: m.runs + 1 }; });
    setMenu("title");
  };

  if (menu === "in_run") {
    return (
      <InterstellarRun allElves={allElves} startingDiamonds={startingShards} initialEquipType={equipType} initialEquipId={equipId}
        selectedModifiers={pacts} seed={seed} nLevel={nLevel} bans={bans} onEndRun={endRun} onStartBattle={onStartBattle}
        onLeave={() => { setActive(E.loadRunV2(localStorage)); setMenu("title"); }} />
    );
  }

  return (
    <div className="ecl-root w-full h-full min-h-[100vh] overflow-y-auto" style={{ ["--ecl-hue" as any]: "#fbbf24" }}>
      <div className="ecl-sky" />
      <div className="ecl-stars" />
      <div className="ecl-grain" />
      <img src="/eclipse/bg_throne.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-40 -z-[1] pointer-events-none" />

      <div className={`relative z-10 mx-auto px-6 pt-16 md:pt-8 pb-24 md:pb-10 ${menu === "gear" ? "max-w-[1680px] md:pr-24" : "max-w-6xl md:pr-56"}`}>
        <button className="ecl-btn ecl-btn-ghost text-xs px-4 py-2" onClick={() => menu === "title" ? onBack() : menu === "setup" ? setMenu("gear") : setMenu("title")}>{menu === "title" ? "返回首頁" : "返回"}</button>

        <AnimatePresence mode="wait">
          {menu === "title" && (
            <motion.section key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-10 grid md:grid-cols-[1fr_auto] gap-10 items-center">
              <div>
                <div className="ecl-roman text-xs ecl-muted">Interstellar Expedition</div>
                <h1 className="ecl-title text-5xl md:text-7xl ecl-gilt mt-2 leading-tight">星蝕回廊</h1>
                <Ornament className="my-5" />
                <p className="max-w-xl leading-8 text-[15px]">
                  某一天，太陽開始被什麼東西一口一口地吃掉。航道扭曲成一條回廊，六個章節，六張王座。
                  帶上三盞燈，走到太陽背面——每一步都會讓黑暗更近一點。
                </p>
                <div className="flex flex-wrap gap-4 mt-8">
                  {active ? (
                    <>
                      <button className="ecl-btn" onClick={() => setMenu("in_run")} title={active.scene.kind === "end" ? "這局已經結算，進入後可收起存檔" : undefined}>{active.scene.kind === "end" ? (active.scene.result === "wiped" ? "敗北結算" : "旅程結算") : "繼續旅程"}・第 {active.act} 章</button>
                      <button className="ecl-btn ecl-btn-blood" onClick={() => setConfirmAbandon(true)}>熄滅燈火</button>
                    </>
                  ) : <button className="ecl-btn" onClick={() => setMenu("gear")}>啟程</button>}
                  <button className="ecl-btn ecl-btn-ghost" onClick={() => setMenu("codex")}>圖錄</button>
                </div>
                {confirmAbandon && (
                  <div className="mt-5 ecl-frame ecl-frame-blood p-4 max-w-md">
                    <div className="font-black mb-1">放棄這段旅程？</div>
                    <div className="text-sm ecl-muted mb-3">隊伍、遺物與進度都會消失，不會獲得經驗。</div>
                    <div className="flex gap-3">
                      <button className="ecl-btn ecl-btn-blood text-sm" onClick={() => { localStorage.removeItem(E.RUN_KEY_V2); setActive(null); setConfirmAbandon(false); }}>熄滅</button>
                      <button className="ecl-btn ecl-btn-ghost text-sm" onClick={() => setConfirmAbandon(false)}>再想想</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="ecl-frame p-6 w-full md:w-72">
                <div className="flex items-center gap-4">
                  <img src="/eclipse/emblem_gold.png" alt="" className="w-16 h-16 object-contain" />
                  <div>
                    <div className="ecl-roman text-[10px] ecl-muted">Lantern Rank</div>
                    <div className="text-3xl font-black ecl-gilt">{meta.level}</div>
                  </div>
                </div>
                <div className="ecl-hp mt-4"><i style={{ width: `${(meta.exp % LEVEL_EXP) / LEVEL_EXP * 100}%`, background: "linear-gradient(90deg,#7a5418,#f6e2a0)" }} /></div>
                <div className="text-[11px] ecl-muted mt-1 text-right tabular-nums">{meta.exp % LEVEL_EXP} / {LEVEL_EXP}</div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                  <div><div className="ecl-muted">旅程</div><div className="font-black text-lg">{meta.runs}</div></div>
                  <div><div className="ecl-muted">最深</div><div className="font-black text-lg">{meta.bestAct || "—"}</div></div>
                  <div><div className="ecl-muted">黎明</div><div className="font-black text-lg">{meta.wins}</div></div>
                </div>
              </div>
            </motion.section>
          )}

          {menu === "gear" && (
            <motion.section key="gear" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
              <SuitSelect equipType={equipType} equipId={equipId} perksOff={lv.perksOff} onChange={(t, id) => { setEquipType(t); setEquipId(id); setBans(b => b.slice(0, E.banCapFor(nLevel, lv.perksOff || t !== "suit" ? null : perkOf(t, id)))); }} onNext={() => setMenu("setup")} />
            </motion.section>
          )}

          {menu === "setup" && (
            <motion.section key="setup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-8 max-w-3xl">
              <h2 className="ecl-title text-4xl ecl-gilt">啟程之前</h2>
              <Ornament className="my-4" />
              <div className="space-y-6">
                <div className="ecl-frame p-6 space-y-5">
                  <SeedField value={seedText} onChange={onSeedText} onRandom={() => { setSeedText(String(newSeed())); setCopied(false); }} onCopy={copyCode} note={seedNote} copied={copied} />
                  <LevelPicker value={nLevel} onChange={setLevel} />
                  <BanPicker bans={bans} pool={pool} cap={cap} onChange={setBans} />
                </div>
                <div className="ecl-frame ecl-frame-blood p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black tracking-widest">契約詛咒</h3>
                    <span className="text-xs ecl-blood">經驗 ×{(1 + pacts.length * .1).toFixed(1)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {START_PACTS.map(p => { const on = pacts.includes(p.id); return (
                      <button key={p.id} onClick={() => setPacts(v => on ? v.filter(x => x !== p.id) : [...v, p.id])}
                        className={`w-full flex items-center justify-between px-3 py-2 border ${on ? "border-[var(--ecl-blood-hi)] bg-[rgba(155,28,49,.15)]" : "border-[rgba(224,71,95,.2)] hover:border-[rgba(224,71,95,.45)]"}`}>
                        <span><span className={`font-black text-sm ${on ? "ecl-blood" : ""}`}>{p.name}</span><span className="text-xs ecl-muted ml-2">{p.desc}</span></span>
                        <span className={on ? "ecl-blood" : "ecl-muted"}>{on ? "✦" : "◇"}</span>
                      </button>); })}
                  </div>
                </div>
                <div className="ecl-frame p-6 text-sm leading-7" title="最深抵達第 3 章後星晶 +1；曾迎接黎明再 +1；N 等級另計。招募令只來自套裝特權">
                  {(() => { const perk = lv.perksOff ? null : perkOf(equipType, equipId); return (
                    <div>初始：賽爾豆 <b className="ecl-gilt">{Math.max(0, 120 + lv.startBeans + (perk?.beans ?? 0))}</b>・星晶 <b className="ecl-gilt">{Math.max(0, startingShards + lv.startShards)}</b>・招募令 <b className="ecl-gilt">{(perk?.anyTokens ?? 0) + (perk?.typeToken ? 1 : 0) + (perk?.dualToken ? 1 : 0) + (perk?.repeatTokens ?? 0)}</b>・藥劑 <b className="ecl-gilt">{Math.max(0, 3 - (pacts.includes("no_potions") ? 2 : 0) + lv.startPotions + (perk?.potions ?? 0))}</b></div>
                  ); })()}
                </div>
                <div className="flex justify-between items-center">
                  <button className="ecl-btn ecl-btn-ghost" onClick={() => setMenu("gear")}>上一步</button>
                  <button className="ecl-btn text-lg px-10" disabled={!parsed} title={E.FAIL_RULE} onClick={() => { localStorage.removeItem(E.RUN_KEY_V2); setMenu("in_run"); }}>點燃第一盞燈</button>
                </div>
              </div>
            </motion.section>
          )}

          {menu === "codex" && (
            <motion.section key="codex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 space-y-8">
              <div>
                <h2 className="ecl-title text-4xl ecl-gilt">圖錄</h2>
                <Ornament className="my-4" />
                <p className="ecl-muted text-sm">遺物 {RELICS.length} 件・異兆 {EVENTS.length} 則・章節 {ACTS.length}。</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ACTS.map(a => (
                  <div key={a.id} className="ecl-frame p-4 flex items-center gap-4" style={{ ["--ecl-hue" as any]: a.hue }}>
                    <div className="w-20 h-24 shrink-0"><NpcArt id={a.npc} className="w-full h-full" /></div>
                    <div><div className="ecl-roman text-[10px] ecl-muted">Act {a.id}</div><div className="font-black text-lg" style={{ color: a.hue }}>{a.name}</div><div className="text-xs ecl-muted italic">{a.epithet}</div></div>
                  </div>
                ))}
              </div>
              <CodexRelics />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CodexRelics() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {RELICS.map(r => (
        <div key={r.id} className="flex items-center gap-3 px-3 py-2 border border-[rgba(217,180,90,.15)] bg-black/30">
          <span className="ecl-sigil relative shrink-0" data-rarity={r.rarity} style={{ width: "2.6rem", height: "2.6rem" }}>
            <img src={`/eclipse/relic/${r.id}.webp`} alt="" className="absolute inset-[12%] w-[76%] h-[76%] object-contain" />
          </span>
          <div className="min-w-0"><div className="font-black text-sm truncate">{r.name}</div><div className="text-[11px] ecl-muted leading-snug">{r.desc}</div></div>
        </div>
      ))}
    </div>
  );
}
