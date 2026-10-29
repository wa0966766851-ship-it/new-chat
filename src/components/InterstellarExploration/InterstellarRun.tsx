import React from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Elf } from "../../types";
import * as E from "../../modes/interstellar/v2/engine";

import MapView from "./eclipse/MapView";
import { SCENES } from "./eclipse/Scenes";
import { EclipseMoon, NpcArt, alive, useEclRootRef } from "./eclipse/parts";
import Ledger, { type LedgerTab } from "./eclipse/Ledger";
import { RELIC_BY_ID } from "../../modes/interstellar/v2/relics";

interface InterstellarRunProps {
  allElves: Elf[];
  startingDiamonds: number;
  initialEquipType: "suit" | "title";
  initialEquipId: string;
  selectedModifiers: string[];
  /** 局種子、N 等級、禁用名單（只在新開一局時使用） */
  seed?: number; nLevel?: number; bans?: string[];
  onEndRun: (act: number, earnedExp: number) => void;
  onStartBattle: (p1: Elf[], p2: Elf[], mode: any, options?: any) => void;
  /** 暫離：保留存檔回到大廳 */
  onLeave?: () => void;
}

/** 各章背景：使用者資料夾的投影片素材（反相處理）＋官方立繪剪影 */
const ACT_BACKDROP: Record<number, { src: string; className: string }> = {
  1: { src: "/eclipse/ruins_skyline.webp", className: "bottom-0 inset-x-0 h-[46%] object-cover object-bottom opacity-35" },
  2: { src: "/eclipse/bg_collage.webp", className: "inset-0 w-full h-full object-cover opacity-20 mix-blend-screen" },
  3: { src: "/eclipse/ruins_skyline.webp", className: "bottom-0 inset-x-0 h-[52%] object-cover object-bottom opacity-40 [filter:sepia(1)_hue-rotate(-25deg)_saturate(2.5)]" },
  4: { src: "/eclipse/bg_collage.webp", className: "inset-0 w-full h-full object-cover opacity-20 mix-blend-screen [filter:hue-rotate(220deg)]" },
  5: { src: "/eclipse/emblem_gold.png", className: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46%] opacity-[.07] [filter:hue-rotate(290deg)_saturate(3)]" },
  6: { src: "/eclipse/bg_throne.webp", className: "inset-0 w-full h-full object-cover opacity-45" },
};

function Resource({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <img src={`/eclipse/relic/${icon}.webp`} alt="" className="w-7 h-7 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]" />
      <div className="leading-tight whitespace-nowrap"><div className="text-[10px] ecl-muted tracking-widest">{label}</div><div className="font-black tabular-nums">{value}</div></div>
    </div>
  );
}

/** 生命：永久（紅心）與臨時（青，只在當章有效）分開顯示；規則放 tooltip */
function LifeResource({ run, compact }: { run: E.RunV2; compact?: boolean }) {
  const temp = run.tempLives ?? 0, low = E.livesOf(run) <= 1;
  const loss = run.lastLifeLoss;
  const tip = [E.LIFE_RULE, `目前：永久 ${run.lives}、臨時 ${temp}`, loss ? `上一場：${E.lifeLossText(loss)}` : ""].filter(Boolean).join("\n");
  const num = <><span className={low ? "ecl-blood" : ""} data-testid="life-perm">{run.lives}</span>{temp > 0 && <span className="ml-1 text-[var(--ecl-teal)]" data-testid="life-temp" title="臨時生命：優先扣除，換章清空">(+{temp})</span>}</>;
  if (compact) return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[rgba(217,180,90,.45)] bg-black/60 text-xs font-black tabular-nums" title={tip} data-testid="life-resource-scene">
      <span className={low ? "ecl-blood" : "text-[var(--ecl-blood-hi)]"} aria-hidden>♥</span><span aria-label="生命">{num}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2" title={tip} data-testid="life-resource">
      <span className={`w-7 h-7 grid place-items-center text-2xl leading-none ${low ? "ecl-blood" : "text-[var(--ecl-blood-hi)]"} drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]`} aria-hidden>♥</span>
      <div className="leading-tight whitespace-nowrap">
        <div className="text-[10px] ecl-muted tracking-widest">生命</div>
        <div className="font-black tabular-nums">{num}</div>
      </div>
    </div>
  );
}

function LedgerButton({ label, count, warn, onClick, title }: { label: string; count?: string; warn?: boolean; onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="px-4 py-2 border border-[rgba(217,180,90,.45)] hover:bg-[rgba(217,180,90,.1)] font-black tracking-widest text-sm whitespace-nowrap">
      {label}{count !== undefined && <span className={`ml-1.5 text-xs tabular-nums ${warn ? "ecl-blood" : "ecl-muted"}`}>{count}</span>}
    </button>
  );
}

export default function InterstellarRun({ allElves, startingDiamonds, initialEquipType, initialEquipId, selectedModifiers, seed, nLevel, bans, onEndRun, onStartBattle, onLeave }: InterstellarRunProps) {
  const pool = allElves;
  const [run, setRun] = React.useState<E.RunV2>(() => {
    const saved = E.resumeRunV2(localStorage,pool);
    if (saved) return saved;
    const fresh = E.createRun({ pool, equipType: initialEquipType, equipId: initialEquipId, modifiers: selectedModifiers, startingShards: startingDiamonds, seed, nLevel, bans });
    return E.saveRunV2(localStorage, fresh);
  });
  const runRef = React.useRef(run); runRef.current = run;
  const [ledger, setLedger] = React.useState<LedgerTab | null>(null);
  const busy = React.useRef(false);
  React.useEffect(()=>{
    if(busy.current)return;
    const updated=E.resumeRunV2(localStorage,pool);
    if(updated && JSON.stringify(updated)!==JSON.stringify(runRef.current)) {runRef.current=updated;setRun(updated);}
  },[pool]);

  const dispatch = React.useCallback((f: (r: E.RunV2) => E.RunV2) => {
    if (busy.current) return;
    const cur = runRef.current; const next = f(cur);
    if (next === cur) return;
    const saved = E.saveRunV2(localStorage, next);
    runRef.current = saved; setRun(saved);
  }, []);

  const fight = () => {
    const cur = runRef.current;
    const battleId = E.battleIdOf(cur);
    const b = E.startBattle(cur, pool, battleId);
    if (!b) return;
    busy.current = true;
    try { sessionStorage.setItem("ECLIPSE_RETURN", "1"); } catch { /* 無 sessionStorage */ }
    const saved = E.saveRunV2(localStorage, b.run);
    runRef.current = saved; setRun(saved);
    const runId = saved.runId;
    onStartBattle(b.p1, b.p2, "PVE", {
      suit1: saved.equipType === "suit" ? saved.equipId : undefined,
      title1: saved.equipType === "title" ? saved.equipId : undefined,
      format: b.p2.length === 1 ? "solo_1v1" : "normal_6v6", preparedTeams: true, specialMode: "interstellar",
      interstellarOptions: {
        runId, battleId, battleSeed: b.battleSeed, potionUsage: 0, maxPotionUsage: saved.potions, relics: b.relics, enemyRelics: b.enemyRelics,
        onPotionUse: () => E.consumePotionV2(localStorage, runId, battleId),
        onBattleEnd: (winner: string, team?: Elf[]) => E.settleStoredBattleV2(localStorage, runId, battleId, winner, team, pool),
      },
    });
  };

  const rootRef = useEclRootRef();
  const act = E.actDef(run);
  const backdrop = ACT_BACKDROP[run.act];
  const Scene = run.scene.kind !== "map" ? SCENES[run.scene.kind] : null;
  const lineup = E.lineupOf(run);
  const note = run.scene.kind === "map" ? run.scene.note : undefined;
  const rescues = E.rescueSources(run);

  return (
    <div ref={rootRef} className="ecl-root w-full h-full min-h-[100vh] flex flex-col" style={{ ["--ecl-hue" as any]: act.hue }}>
      <div className="ecl-sky" />
      <div className="ecl-stars" />
      <div className="ecl-grain" />
      {backdrop && <img src={backdrop.src} alt="" aria-hidden className={`absolute -z-[1] pointer-events-none ${backdrop.className}`} />}
      <div className="absolute right-[-6%] top-[8%] h-[80%] w-[44%] -z-[1] pointer-events-none opacity-[.13] mix-blend-screen"><NpcArt id={act.npc} className="w-full h-full" /></div>

      {/* 頂部：章名、資源、蝕月 */}
      <header className="relative z-20 flex flex-wrap items-center gap-x-8 gap-y-3 pl-16 pr-6 ecl-md:pr-56 pt-5 pb-3">
        <div className="min-w-0">
          <div className="ecl-roman text-[10px] ecl-muted">Act {["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ"][run.act - 1]} · Eclipse Corridor</div>
          <div className="flex items-baseline gap-3">
            <h1 className="ecl-title text-2xl ecl-md:text-3xl ecl-gilt">{act.name}</h1>
            <span className="text-xs ecl-muted italic hidden ecl-lg:inline">— {act.epithet}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 ecl-md:gap-x-6">
          <LifeResource run={run} />
          <Resource icon="_beans" label="賽爾豆" value={run.beans} />
          <Resource icon="_shard" label="星晶" value={run.shards} />
          <Resource icon="_shard" label="招募令" value={run.tokens.length} />
          <Resource icon="_potion" label="藥劑" value={run.potions} />
          <EclipseMoon value={run.eclipse} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <LedgerButton label="隊伍" count={`${lineup.filter(alive).length}/${E.lineupSlots(run)}`} warn={lineup.some(e => !alive(e))} onClick={() => setLedger("team")} title={`${E.FAIL_RULE}\n全隊存活 ${run.team.filter(alive).length}/${run.team.length}`} />
          {rescues.length > 0 && <LedgerButton label="保命" count={String(rescues.length)} onClick={() => setLedger("relics")} title={`生命將歸零時依序消耗（本場不扣生命），各一次：${rescues.map(id => id === "perk:fate_defier" ? "逆命者特權" : RELIC_BY_ID[id]?.name).join(" → ")}`} />}
          <LedgerButton label="招募" count={String(run.shards)} onClick={() => setLedger("recruit")} />
          <LedgerButton label="遺物" count={String(run.relics.length)} onClick={() => setLedger("relics")} />
          <LedgerButton label="紀事" onClick={() => setLedger("chronicle")} />
          {onLeave && <button className="ecl-btn ecl-btn-ghost text-xs px-4 py-2" onClick={onLeave} title="保留進度，回到大廳">暫離</button>}
        </div>
      </header>
      <div className="ecl-rule mx-6" />

      {/* 地圖 */}
      <main className="relative z-10 flex-1 px-4 ecl-md:px-10 flex items-center">
        <div className="w-full max-w-[1400px] mx-auto">
          <MapView run={run} onMove={id => dispatch(r => E.moveTo(r, id, pool))} />
        </div>
      </main>

      <AnimatePresence>
        {note && (
          <motion.div key={note} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 top-28 -translate-x-1/2 z-30 ecl-frame px-6 py-2 text-sm" onClick={() => dispatch(r => E.backToMap(r))}>
            {note}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ledger && run.scene.kind !== "draft" && <Ledger run={run} pool={pool} tab={ledger} onTab={setLedger} onClose={() => setLedger(null)} dispatch={dispatch} />}
      </AnimatePresence>

      {/* 場景覆蓋層 */}
      <AnimatePresence>
        {Scene && (
          <motion.div key={run.scene.kind} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 overflow-y-auto bg-[rgba(4,3,8,.82)] backdrop-blur-[3px] p-4 ecl-md:p-10 flex items-start ecl-md:items-center">
            <div className="fixed right-[4.5rem] top-4 z-[44]"><LifeResource run={run} compact /></div>
            <button className="fixed right-4 top-4 z-[44] px-3 py-1.5 border border-[rgba(217,180,90,.45)] bg-black/60 hover:bg-[rgba(217,180,90,.12)] font-black tracking-widest text-xs" onClick={() => setLedger("team")} title="整理背包與倉庫">背包</button>
            <Scene run={run} pool={pool} dispatch={dispatch} onFight={fight} onExit={() => onEndRun(run.act, run.exp)} onOpenTeam={() => setLedger("team")} onOpenRecruit={() => setLedger("recruit")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
