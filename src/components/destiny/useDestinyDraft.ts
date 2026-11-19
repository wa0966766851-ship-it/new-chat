import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Elf, BattleMode } from "../../types";
import { bindInitialCounterparts } from "../../battle/illusionPresentation";
import { DestinyElfInstance, buildDestinyPool, pullFromDestinyPool, simulateAiBan, simulateAiPick } from "../../utils/destinyGacha";
import { drawLoadoutOptions, defaultLoadout, aiChooseLoadout, type Loadout, type LoadoutOptions } from "../../utils/destinyLoadout";

export type DraftPhase = "intro" | "pulling" | "reveal" | "ban" | "pick";
export const DRAFT_PHASES: readonly DraftPhase[] = ["intro", "pulling", "reveal", "ban", "pick"];

export type StartBattleFn = (
  mode: BattleMode, team1: Elf[], team2: Elf[], starter1Id: string, starter2Id: string,
  p1Suit?: string, p1Eyewear?: string, p2Suit?: string, p2Eyewear?: string,
  p1Title?: string, p2Title?: string, format?: "normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3",
  options?: { flames?: { p1?: string; p2?: string } },
) => void;

export interface DestinyScreenProps {
  initialBattleMode?: BattleMode;
  allElves: Elf[];
  onStartBattle: StartBattleFn;
  onBack: () => void;
  p1Suit?: string; p1Eyewear?: string; p2Suit?: string; p2Eyewear?: string;
  p1Title?: string; p2Title?: string;
}

/** 抽卡動畫時間（毫秒）；測試與靜態模式可覆寫。 */
export const PULL_ANIMATION_MS = 1500;
const NEUTRAL_STAGES = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };

/**
 * 命運之輪流程狀態（舊頁與 B 頁共用）：pull → reveal → ban → pick → onStartBattle。
 * 資料流與 onStartBattle 簽名不變；只把 17 個 useState 收攏，並修 D-08（抽卡中鎖模式、清理計時器）。
 */
export function useDestinyDraft(props: DestinyScreenProps, opts: { pullMs?: number } = {}) {
  const { initialBattleMode = "PVE", allElves, onStartBattle, p1Suit = "", p1Eyewear = "", p2Suit = "", p2Eyewear = "",
    p1Title = "命運之輪主宰", p2Title = "宿命挑戰者" } = props;
  const pullMs = opts.pullMs ?? PULL_ANIMATION_MS;
  const sessionPool = useMemo(() => buildDestinyPool(allElves), [allElves]);
  const [pullError, setPullError] = useState("");
  const [phase, setPhase] = useState<DraftPhase>("intro");
  const [maxPhaseIdx, setMaxPhaseIdx] = useState(0);
  const [battleMode, setBattleModeRaw] = useState<BattleMode>(initialBattleMode);
  const [p1Pool, setP1Pool] = useState<DestinyElfInstance[]>([]);
  const [p2Pool, setP2Pool] = useState<DestinyElfInstance[]>([]);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [isRevealingAll, setIsRevealingAll] = useState(false);
  const [p1BannedIds, setP1BannedIds] = useState<string[]>([]);
  const [p2BannedIds, setP2BannedIds] = useState<string[]>([]);
  const [p1PickedIds, setP1PickedIds] = useState<string[]>([]);
  const [p1StarterId, setP1StarterId] = useState("");
  const [p2PickedIds, setP2PickedIds] = useState<string[]>([]);
  const [p2StarterId, setP2StarterId] = useState("");
  const [inspectElf, setInspectElf] = useState<DestinyElfInstance | null>(null);
  // 命運配裝：抽卡時一併抽出雙方候選（套裝／目鏡／稱號不重複，火焰各抽 2 選 1）
  const [loadoutOptions, setLoadoutOptions] = useState<{ p1: LoadoutOptions; p2: LoadoutOptions } | null>(null);
  const [p1Loadout, setP1Loadout] = useState<Loadout | null>(null);
  const [p2Loadout, setP2Loadout] = useState<Loadout | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clearTimer, []);

  const modeLocked = phase !== "intro";
  const setBattleMode = useCallback((m: BattleMode | ((p: BattleMode) => BattleMode)) => {
    if (modeLocked) return; // D-08：抽卡開始後不得切換 PVE/PVP
    setBattleModeRaw(m);
  }, [modeLocked]);
  useEffect(() => { if (initialBattleMode && phase === "intro") setBattleModeRaw(initialBattleMode); }, [initialBattleMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = (p: DraftPhase) => { setPhase(p); setMaxPhaseIdx(i => Math.max(i, DRAFT_PHASES.indexOf(p))); };

  const handleStartPull = () => {
    if (phase === "pulling") return;
    let r1: DestinyElfInstance[], r2: DestinyElfInstance[];
    try { r1 = pullFromDestinyPool(sessionPool, Math.random, "p1"); r2 = pullFromDestinyPool(sessionPool, Math.random, "p2"); }
    catch (error) { setPullError((error as Error).message); return; }
    setPullError(""); clearTimer();
    setP1Pool(r1); setP2Pool(r2); setRevealedIds([]); setIsRevealingAll(false);
    setP1BannedIds([]); setP2BannedIds([]); setP1PickedIds([]); setP2PickedIds([]); setP1StarterId(""); setP2StarterId("");
    const lo = drawLoadoutOptions(Math.random);
    setLoadoutOptions(lo); setP1Loadout(defaultLoadout(lo.p1));
    setP2Loadout(battleMode === "PVE" ? aiChooseLoadout(lo.p2) : defaultLoadout(lo.p2));
    setMaxPhaseIdx(DRAFT_PHASES.indexOf("pulling")); setPhase("pulling");
    timer.current = setTimeout(() => { timer.current = null; enter("reveal"); }, pullMs);
  };
  const skipPull = () => { if (phase === "pulling") { clearTimer(); enter("reveal"); } };

  const handleNextReveal = (instanceId?: string) => {
    if (!instanceId) return;
    setRevealedIds(prev => (prev.includes(instanceId) ? prev : [...prev, instanceId]));
  };
  const handleRevealAll = () => {
    setRevealedIds([...p1Pool.map(e => e.instanceId), ...p2Pool.map(e => e.instanceId)]);
    setIsRevealingAll(true);
  };
  const isCardRevealed = (instanceId: string) => isRevealingAll || revealedIds.includes(instanceId);

  const handleProceedToBan = () => {
    enter("ban"); setP1BannedIds([]);
    setP2BannedIds(battleMode === "PVE" ? simulateAiBan(p1Pool, 3, p2Pool) : []);
  };
  const toggleIn = (setter: Dispatch<SetStateAction<string[]>>, ids: string[], id: string, max: number) => {
    if (ids.includes(id)) setter(ids.filter(x => x !== id)); else if (ids.length < max) setter([...ids, id]);
  };
  const toggleBan = (id: string) => toggleIn(setP1BannedIds, p1BannedIds, id, 3);
  const toggleP2Ban = (id: string) => toggleIn(setP2BannedIds, p2BannedIds, id, 3);
  const canConfirmBan = battleMode === "PVE" ? p1BannedIds.length === 3 : p1BannedIds.length === 3 && p2BannedIds.length === 3;

  const handleConfirmBan = () => {
    if (!canConfirmBan) return;
    const updatedP1 = p1Pool.map(e => ({ ...e, isBanned: p2BannedIds.includes(e.instanceId) }));
    const updatedP2 = p2Pool.map(e => ({ ...e, isBanned: p1BannedIds.includes(e.instanceId) }));
    setP1Pool(updatedP1); setP2Pool(updatedP2);
    if (battleMode === "PVE") {
      const ai = simulateAiPick(updatedP2, updatedP1);
      setP2PickedIds(ai.pickedIds); setP2StarterId(ai.starterId);
    } else {
      const ids = updatedP2.filter(e => !e.isBanned).slice(0, 6).map(e => e.instanceId);
      setP2PickedIds(ids); setP2StarterId(ids[0] ?? "");
    }
    const ids1 = updatedP1.filter(e => !e.isBanned).slice(0, 6).map(e => e.instanceId);
    setP1PickedIds(ids1); setP1StarterId(ids1[0] ?? "");
    enter("pick");
  };

  const togglePickFor = (picked: string[], starter: string, setPicked: (v: string[]) => void, setStarter: (v: string) => void, id: string) => {
    if (picked.includes(id)) {
      if (picked.length <= 1) return;
      const next = picked.filter(x => x !== id);
      setPicked(next);
      if (starter === id && next.length > 0) setStarter(next[0]);
    } else {
      if (picked.length >= 6) return;
      setPicked([...picked, id]);
      if (!starter) setStarter(id);
    }
  };
  const togglePick = (id: string) => p1Pool.some(e => e.instanceId === id && !e.isBanned) && togglePickFor(p1PickedIds, p1StarterId, setP1PickedIds, setP1StarterId, id);
  const toggleP2Pick = (id: string) => p2Pool.some(e => e.instanceId === id && !e.isBanned) && togglePickFor(p2PickedIds, p2StarterId, setP2PickedIds, setP2StarterId, id);

  /** 改選配裝（只接受該方候選內的值；PVE 的 AI 方不可改）。 */
  const chooseLoadout = (side: "p1" | "p2", key: keyof Loadout, value: string) => {
    if (!loadoutOptions || (side === "p2" && battleMode === "PVE")) return;
    const opts = loadoutOptions[side];
    const allowed = key === "suit" ? opts.suits : key === "eyewear" ? opts.eyewears : key === "title" ? opts.titles : opts.flames;
    if (!(allowed as string[]).includes(value)) return;
    (side === "p1" ? setP1Loadout : setP2Loadout)(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  const canLaunch = p1PickedIds.length === 6 && !!p1StarterId && p2PickedIds.length === 6 && !!p2StarterId;

  const handleLaunchBattle = () => {
    if (!canLaunch) return;
    const toTeam = (pool: DestinyElfInstance[], ids: string[]): Elf[] => ids.map(id => {
      const found = pool.find(e => e.instanceId === id)!;
      return { ...found, battleId: found.instanceId, currentHp: found.maxHp, statStages: { ...NEUTRAL_STAGES } };
    });
    const p1TeamFinal = toTeam(p1Pool, p1PickedIds), p2TeamFinal = toTeam(p2Pool, p2PickedIds);
    // 初始背包：出戰＝所選 6 隻；待命＝池中未選且未被禁用者（依池內原順序壓緊），供「指定背包內精靈」類幻化使用。
    const toBag = (picked: Elf[], pool: DestinyElfInstance[], pickedIds: string[]): Elf[] => {
      const standby = pool.filter(e => !pickedIds.includes(e.instanceId) && !e.isBanned)
        .map(found => ({ ...found, battleId: found.instanceId, currentHp: found.maxHp, statStages: { ...NEUTRAL_STAGES } }) as Elf);
      return bindInitialCounterparts([...picked, ...standby], picked.length).slice(0, picked.length);
    };
    const p1Bag = toBag(p1TeamFinal, p1Pool, p1PickedIds), p2Bag = toBag(p2TeamFinal, p2Pool, p2PickedIds);
    const s1 = p1Pool.find(e => e.instanceId === p1StarterId), s2 = p2Pool.find(e => e.instanceId === p2StarterId);
    onStartBattle(battleMode, p1Bag, p2Bag, s1 ? s1.instanceId : p1Bag[0].battleId!, s2 ? s2.instanceId : p2Bag[0].battleId!,
      p1Loadout?.suit || p1Suit, p1Loadout?.eyewear || p1Eyewear, p2Loadout?.suit || p2Suit, p2Loadout?.eyewear || p2Eyewear,
      p1Loadout?.title || p1Title, p2Loadout?.title || p2Title, "peak_6v6",
      { flames: { p1: p1Loadout?.flame, p2: p2Loadout?.flame } });
  };

  /** 章節導覽：只能回到已到過的章節（輪盤為過場，不可點）；回序章不清資料，重按開始才重抽。 */
  const canGoPhase = (p: DraftPhase) => p !== "pulling" && phase !== "pulling" && DRAFT_PHASES.indexOf(p) <= maxPhaseIdx;
  const goPhase = (p: DraftPhase) => { if (canGoPhase(p)) setPhase(p); };

  return {
    sessionPool, pullError, phase, battleMode, setBattleMode, modeLocked, p1Title, p2Title,
    p1Pool, p2Pool, revealedIds, isRevealingAll, isCardRevealed,
    handleStartPull, skipPull, handleNextReveal, handleRevealAll, handleProceedToBan,
    p1BannedIds, p2BannedIds, toggleBan, toggleP2Ban, canConfirmBan, handleConfirmBan,
    p1PickedIds, p2PickedIds, p1StarterId, p2StarterId, setP1StarterId, setP2StarterId, togglePick, toggleP2Pick,
    loadoutOptions, p1Loadout, p2Loadout, chooseLoadout,
    canLaunch, handleLaunchBattle, inspectElf, setInspectElf, canGoPhase, goPhase, maxPhaseIdx,
  };
}
export type DestinyDraft = ReturnType<typeof useDestinyDraft>;
