import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadRun, saveRun, prepareBattle, settleStoredBattle, consumePotion, moveRun, newRunId, recruitRun } from "../../modes/interstellar/runState";
import { generateLayerMap } from "../../modes/interstellar/map";
import { buildExplorationSnapshot } from "../../modes/interstellar/battleSnapshot";
import { Elf } from "../../types";
import { isAliveBySurvivalRule } from "../../battle/survivalRules";
import { matchesElfQuery } from '../../utils/elfSearch';
import { ElfAvatar, TypeIcon } from "../SeerImages";
import { TitleDefinition } from "../../data/titles";
import { SuitDefinition } from "../../data/suitsAndEyewears";
import {
  Rocket, Diamond, Zap, Coins, Map as MapIcon, ShieldAlert,
  Tent, Sparkles, Building2, Skull, ChevronRight, ArrowRight,
  Shield, Trophy, FlaskConical, Settings, RefreshCw, Package, X, Heart, Sword, Info, Star, ChevronDown, Check, Users, Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SUIT_CATALOG } from "../../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../../data/titles";
import { INTERSTELLAR_COLLECTIBLES, DIFFICULTY_MODIFIERS, Collectible } from "../../data/interstellarData";

interface InterstellarRunProps {
  allElves: Elf[];
  startingDiamonds: number;
  initialEquipType: "suit" | "title";
  initialEquipId: string;
  selectedModifiers: string[];
  onEndRun: (layer: number, earnedExp: number) => void;
  onStartBattle: (p1: Elf[], p2: Elf[], mode: any, options?: any) => void;
}

type NodeStatus = "unvisited" | "current" | "occupied";
type NodeType = "combat" | "elite" | "boss" | "event_chance" | "event_destiny" | "shop" | "bank" | "heal" | "growth";

interface MapNode {
  id: string;
  type: NodeType;
  status: NodeStatus;
  name: string;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  connections: string[];
  occupied?: boolean;
}

interface LayerData {
  id: number;
  name: string;
  nodes: MapNode[];
}

export default function InterstellarRun({
  allElves,
  startingDiamonds,
  initialEquipType,
  initialEquipId,
  selectedModifiers: initialModifiers,
  onEndRun,
  onStartBattle
}: InterstellarRunProps) {
  const [savedRun] = useState(() => loadRun(localStorage));
  const runId = useRef(savedRun?.runId || newRunId());
  const revision = useRef(savedRun?.revision || 0);
  const getSavedRunValue = <T,>(key: string, defaultValue: T): T => savedRun?.[key] ?? defaultValue;
  const [selectedModifiers] = useState<string[]>(() => getSavedRunValue('selectedModifiers', initialModifiers));
  const [piratePrincipal, setPiratePrincipal] = useState(() => getSavedRunValue('piratePrincipal', 0));
  const movementLock = useRef(false);
  // Run States with Sync Initialization
  const [diamonds, setDiamonds] = useState(() => getSavedRunValue("diamonds", startingDiamonds));
  const [fuel, setFuel] = useState(() => getSavedRunValue("fuel", 5));
  const [maxFuel] = useState(10);
  const [saerBeans, setSaerBeans] = useState(() => getSavedRunValue("saerBeans", 200));
  const [bankBalance, setBankBalance] = useState(() => getSavedRunValue("bankBalance", 0));
  const [currentLayer, setCurrentLayer] = useState(() => getSavedRunValue("currentLayer", 1));
  const [equipType, setEquipType] = useState<"suit" | "title">(() => getSavedRunValue("equipType", initialEquipType));
  const [equipId, setEquipId] = useState(() => getSavedRunValue("equipId", initialEquipId));
  const [potionUsage, setPotionUsage] = useState(() => getSavedRunValue("potionUsage", 0));
  const [maxPotionUsage, setMaxPotionUsage] = useState(() => getSavedRunValue("maxPotionUsage", 5));
  const effectiveMaxPotionUsage = selectedModifiers.includes("no_potions") ? Math.max(0,maxPotionUsage-3) : maxPotionUsage;
  const [hasSpecialEquip, setHasSpecialEquip] = useState(() => getSavedRunValue("hasSpecialEquip", false));
  const [earnedExp, setEarnedExp] = useState(() => getSavedRunValue("earnedExp", 0));
  const [runElves, setRunElves] = useState<Elf[]>(() => getSavedRunValue("runElves", []));
  const [collectibles, setCollectibles] = useState<Collectible[]>(() => getSavedRunValue<any[]>("collectibles", []).map(c => INTERSTELLAR_COLLECTIBLES.find(x => x.id === c.id)).filter(Boolean) as Collectible[]);
  const [vouchers, setVouchers] = useState<{ C: number; B: number; A: number; S: number }>(() =>
    getSavedRunValue("vouchers", { C: 1, B: 0, A: 0, S: 0 })
  );
  const [shopDiscountRate, setShopDiscountRate] = useState(() => getSavedRunValue("shopDiscountRate", 0));
  const [healBonusRate, setHealBonusRate] = useState(() => getSavedRunValue("healBonusRate", 0));
  const [bankRateBonus, setBankRateBonus] = useState(() => getSavedRunValue("bankRateBonus", 0));

  const [layers, setLayers] = useState<LayerData[]>(() => {
    const savedLayers = getSavedRunValue<LayerData[] | null>("layers", null);
    if (savedLayers) return savedLayers;
    return [
      { id: 1, name: "起源星雲", nodes: generateLayerMap(1) }
    ];
  });

  const currentLayerData = useMemo(() => layers.find(l => l.id === currentLayer), [layers, currentLayer]);
  const currentNode = useMemo(() => {
    if (!currentLayerData) return undefined;
    const found = currentLayerData.nodes.find(n => n.status === "current");
    if (found) return found;
    const startNode = currentLayerData.nodes.find(n => n.id.endsWith("-start"));
    return startNode || currentLayerData.nodes[0];
  }, [currentLayerData]);

  const [showBackpack, setShowBackpack] = useState(false);
  const [lastBattleResult, setLastBattleResult] = useState<any>(() => getSavedRunValue("lastBattleResult", null));

  const getStatsTotal = (stats: any) =>
    (stats.hp || 0) + (stats.atk || 0) + (stats.def || 0) + (stats.spatk || 0) + (stats.spdef || 0) + (stats.speed || 0);

  // Action States
  const [activeAction, setActiveAction] = useState<"combat" | "shop" | "recruit" | "event" | "bank" | "growth" | null>(null);
  const [actionOutcome, setActionOutcome] = useState<string | null>(null);

  // Recruitment System States
  const [activeVoucherUsed, setActiveVoucherUsed] = useState<"C" | "B" | "A" | "S" | null>(null);
  const [recruitSelectionMode, setRecruitSelectionMode] = useState<"list" | "roll" | null>(null);
  const [recruitSearchQuery, setRecruitSearchQuery] = useState("");
  const [rolledCandidates, setRolledCandidates] = useState<{ elf: Elf; isTemp: boolean }[]>([]);
  const [elfToRecruit, setElfToRecruit] = useState<Elf | null>(null);
  const [elfToRecruitIsTemp, setElfToRecruitIsTemp] = useState(false);
  const [showReplacementScreen, setShowReplacementScreen] = useState(false);

  // Bank System States
  const [bankType, setBankType] = useState<"kiske" | "merchant" | "pirate">("kiske");
  const bankInterestRates = { kiske: 0.15, merchant: 0.40, pirate: 0.80 };

  // Growth System States
  const [selectedGrowthElfIdx, setSelectedGrowthElfIdx] = useState<number | null>(null);

  // Event System States
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [currentEventType, setCurrentEventType] = useState<"chance" | "destiny" | null>(null);

  // Chance (Opportunity) Events Pool
  const CHANCE_EVENTS = [
    {
      id: "dust_supply",
      title: "星塵物資箱 📦",
      desc: "漂流在太空中的軍用物資箱，外部合金結構依然完好。打開後可能獲得賽爾豆與能量補充。",
      options: [
        {
          text: "開啟物資箱 (獲得 200 賽爾豆)",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any) => {
            setBeans((b: number) => b + 200);
            return "你獲得了 200 賽爾豆！";
          }
        }
      ]
    },
    {
      id: "recruit_signal",
      title: "流浪精靈信號 📡",
      desc: "雷達接收到微弱的生命特徵。似乎有一隻遊蕩在星雲深處的精靈在向我們發送求救呼籲。",
      options: [
        {
          text: "發送引導信號 (獲得 C級招募令 x1)",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any) => {
            setVouchers((v: any) => ({ ...v, C: v.C + 1 }));
            return "引導信號發送完畢，一隻精靈在太空中留下了它的專屬座標！你獲得了 1 張 C級招募令。";
          }
        }
      ]
    },
    {
      id: "energy_pulse",
      title: "微型能量井 ⚡",
      desc: "前方發現一個充滿高能等離子的微型太空泉眼，重置波能有助於飛船引擎快速充能。",
      options: [
        {
          text: "補充航道燃料 (獲得 3 點燃料)",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any) => {
            setFuel((f: number) => Math.min(10, f + 3));
            return "飛船主引擎充能成功，獲得了 3 點燃料！";
          }
        }
      ]
    },
    {
      id: "diamond_meteor",
      title: "晶化隕石群 💎",
      desc: "路過一片散發深藍螢光的太空隕石帶，這些富含超高純度能量的晶體極其罕見。",
      options: [
        {
          text: "派遣無人機進行開採 (獲得 1 顆鑽石)",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any) => {
            setDiamonds((d: number) => d + 1);
            return "無人機開採完畢，獲得 1 顆璀璨的超能量鑽石！";
          }
        }
      ]
    },
    {
      id: "relic_fragment",
      title: "古代飛船遺跡 🛸",
      desc: "一艘千年前的先驅者探測船殘骸在小行星軌道上靜靜漂浮，部分核心組件依然完好。",
      options: [
        {
          text: "拆卸探測面板 (獲得 1 個隨機收藏品)",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any) => {
            const rc = INTERSTELLAR_COLLECTIBLES[Math.floor(Math.random() * INTERSTELLAR_COLLECTIBLES.length)];
            setCollectibles((prev: any) => [...prev, rc]);
            return `遺跡核心安全解鎖！獲得收藏品：【${rc.name}】（${rc.description}）`;
          }
        }
      ]
    }
  ];

  // Destiny (Fate) Events Pool
  const DESTINY_EVENTS = [
    {
      id: "abyss_wager",
      title: "星淵賭局 🎲",
      desc: "一個雙眼閃爍螢光的太空遊商攔住了你的艦船：『來玩個簡單的運氣遊戲吧！下注 100 賽爾豆，若猜對重力極性，我加倍奉還！』",
      options: [
        {
          text: "參與下注 (50% 機率贏得 300 賽爾豆，50% 損失 100 賽爾豆)",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any, beans: number) => {
            if (beans < 100) return "賽爾豆不足，無法參與下注！";
            const win = Math.random() < 0.5;
            if (win) {
              setBeans((b: number) => b + 200);
              return "運氣太棒了！你精準預測了重力極性，獲得了 300 賽爾豆！";
            } else {
              setBeans((b: number) => b - 100);
              return "預測失敗，重力逆流吞噬了下注金額，損失 100 賽爾豆。";
            }
          }
        },
        {
          text: "謝絕邀請 (安全離開)",
          action: () => "你謝絕了商人的邀請，安穩地離開了。"
        }
      ]
    },
    {
      id: "space_pirate_deal",
      title: "黑市海盜交易 ☠️",
      desc: "海盜商船發來一條私密加密頻段，他們急需物資。願意提供極其廉價的特種招募令，前提是你必須用相應資源交換。",
      options: [
        {
          text: "用 150 賽爾豆購買 B級招募令 x1",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any, beans: number) => {
            if (beans < 150) return "賽爾豆不足，交易取消！";
            setBeans((b: number) => b - 150);
            setVouchers((v: any) => ({ ...v, B: v.B + 1 }));
            return "黑市交易完成，你獲得了 1 張 B級招募令！";
          }
        },
        {
          text: "用 1 顆鑽石兌換 A級招募令 x1",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any, beans: number, diamonds: number) => {
            if (diamonds < 1) return "鑽石不足，交易取消！";
            setDiamonds((d: number) => d - 1);
            setVouchers((v: any) => ({ ...v, A: v.A + 1 }));
            return "兌換成功，你獲得了 1 張 A級招募令！";
          }
        },
        {
          text: "發動突襲，直接搶劫！ (觸發普通戰鬥)",
          isBattle: true
        }
      ]
    },
    {
      id: "time_warp",
      title: "時空畸變航道 🌀",
      desc: "前方的重力力場發生劇烈折疊。冒險加速穿過可以引導量子力學富集鑽石，但偏航將對飛船引擎造成巨大損傷。",
      options: [
        {
          text: "全速引擎穿越 (70% 獲得 2 顆鑽石，30% 損失 2 點燃料)",
          action: (setBeans: any, setVouchers: any, setFuel: any, setDiamonds: any, setCollectibles: any) => {
            const win = Math.random() < 0.7;
            if (win) {
              setDiamonds((d: number) => d + 2);
              return "穿越成功！量子重力透鏡在護盾表面凝結出 2 顆超能鑽石！";
            } else {
              setFuel((f: number) => Math.max(0, f - 2));
              return "重力畸變引起劇烈偏航，副推進器超載，損失 2 點燃料。";
            }
          }
        },
        {
          text: "繞道慢行 (消耗 1 點燃料安全通過)",
          action: (setBeans: any, setVouchers: any, setFuel: any, setCollectibles: any) => {
            setFuel((f: number) => Math.max(0, f - 1));
            return "安全至上，你規劃了漫長但平穩的繞道航線，安全通過但消耗 1 點燃料。";
          }
        }
      ]
    }
  ];

  const getRunSnapshot = () => ({
    runId: runId.current, revision: revision.current, diamonds, fuel, maxFuel, saerBeans, bankBalance,
    currentLayer, equipType, equipId, potionUsage, maxPotionUsage, hasSpecialEquip, earnedExp,
    runElves, layers, collectibles, vouchers, selectedModifiers, piratePrincipal,
    shopDiscountRate, healBonusRate, bankRateBonus, lastBattleResult,
    pendingBattle: savedRun?.pendingBattle ?? null,
    lastSettledBattleId: savedRun?.lastSettledBattleId
  });
  useEffect(() => {
    if (loadRun(localStorage)?.pendingBattle) return;
    const saved = saveRun(localStorage, getRunSnapshot()); revision.current = saved.revision;
  }, [diamonds, fuel, saerBeans, bankBalance, currentLayer, equipType, equipId, potionUsage, maxPotionUsage, hasSpecialEquip, earnedExp, runElves, layers, collectibles, vouchers, shopDiscountRate, healBonusRate, bankRateBonus, lastBattleResult, piratePrincipal]);

  // Initial Elf Generation (Starts with 3 B-grade Elves as requested)
  useEffect(() => {
    if (runElves.length === 0 && allElves.length > 0) {
      const bPool = allElves.filter(e => {
        const total = getStatsTotal(e.baseStats);
        return total >= 580 && total <= 630;
      });
      const pool = bPool.length >= 3 ? bPool : allElves;

      const selected: Elf[] = [];
      const tempPool = [...pool];
      for (let i = 0; i < 3; i++) {
        if (tempPool.length === 0) break;
        const idx = Math.floor(Math.random() * tempPool.length);
        const elf = tempPool.splice(idx, 1)[0];
        selected.push({
          ...elf,
          battleId: `player-${elf.id}-${Date.now()}-${i}`
        });
      }
      setRunElves(selected);
    }
  }, [allElves, runElves.length]);

  // Determine Bank Type based on current node
  useEffect(() => {
    if (activeAction === "bank" && currentNode) {
      const hash = currentNode.id.split("-").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const types: ("kiske" | "merchant" | "pirate")[] = ["kiske", "merchant", "pirate"];
      setBankType(types[hash % 3]);
    }
  }, [activeAction, currentNode]);

  // Handle Event Rolling on opening event node
  useEffect(() => {
    if (activeAction === "event" && !currentEvent && currentNode) {
      if (currentNode.type === "event_chance") {
        const ev = CHANCE_EVENTS[Math.floor(Math.random() * CHANCE_EVENTS.length)];
        setCurrentEvent(ev);
        setCurrentEventType("chance");
      } else {
        const ev = DESTINY_EVENTS[Math.floor(Math.random() * DESTINY_EVENTS.length)];
        setCurrentEvent(ev);
        setCurrentEventType("destiny");
      }
    } else if (activeAction !== "event") {
      setCurrentEvent(null);
      setCurrentEventType(null);
    }
  }, [activeAction, currentNode]);

  const [showEquipSwitcher, setShowEquipSwitcher] = useState(false);

  const handleNextLayer = () => {
    if (currentLayer >= (hasSpecialEquip ? 6 : 5)) {
      onEndRun(currentLayer, earnedExp + 500);
      return;
    }
    const nextL = currentLayer + 1;
    setCurrentLayer(nextL);
    setLayers(prev => [...prev, { id: nextL, name: getLayerName(nextL), nodes: generateLayerMap(nextL) }]);
    setFuel(10);
    setEarnedExp(e => e + 200);
  };

  const getLayerName = (l: number) => {
    const names = ["起源星雲", "寂靜深淵", "燃燒恆星帶", "混亂地平線", "虛空核心", "終焉之刻"];
    return names[l - 1] || "未知星域";
  };

  // Occupy the current node, marking it as occupied and setting the exploration narrative outcome
  const occupyCurrentNode = (outcomeText: string) => {
    if (!currentNode) return;
    setLayers(prev => prev.map(l => {
      if (l.id !== currentLayer) return l;
      return {
        ...l,
        nodes: l.nodes.map(n => {
          if (n.id === currentNode.id) {
            return { ...n, occupied: true };
          }
          return n;
        })
      };
    }));
    setActionOutcome(outcomeText);
  };

  // Handles movement to an adjacent connected node, costing 1 fuel
  const handleMoveToNode = (targetNodeId: string) => {
    if (movementLock.current) return;
    const next = moveRun(getRunSnapshot(), targetNodeId);
    if (!next) { setActionOutcome('無法移動：請選擇相連節點並確認燃料。'); return; }
    movementLock.current = true;
    setLayers(next.layers); setFuel(next.fuel);
    const target = next.layers.find((l: any) => l.id === currentLayer).nodes.find((n: any) => n.id === targetNodeId);
    handleEngage(target);
    queueMicrotask(() => { movementLock.current = false; });
  };

  // Activates the interactive node interface based on current node type
  const handleEngage = (node: MapNode | unknown = currentNode) => {
    const target = (node && typeof node === "object" && "type" in node) ? node as MapNode : currentNode;
    if (!target) return;
    const type = target.type;

    if (type === "combat" || type === "elite" || type === "boss") {
      setActiveAction("combat");
    } else if (type === "shop") {
      setActiveAction("shop");
    } else if (type === "bank") {
      setActiveAction("bank");
    } else if (type === "growth") {
      setActiveAction("growth");
    } else if (type === "heal") {
      setFuel(maxFuel);
      setRunElves(prev => prev.map(e => ({...e, currentHp:e.maxHp, explorationVitals:true, skills:e.skills.map(s=>({...s,pp:s.maxPp??s.pp}))})));
      setLayers(prev => prev.map(l => ({...l,nodes:l.nodes.map(n=>n.id===target.id?{...n,occupied:true}:n)})));
      setActionOutcome("你成功降落於星際聯盟空間站，主推進器高能燃料已被注滿，全隊狀態已安全恢復！");
    } else if (type === "event_chance" || type === "event_destiny") {
      setActiveAction("event");
    }
  };

  // Helper to determine the tier ranking of an Elf based on its stat total
  const getElfGrade = (elf: Elf): "SS" | "S" | "A" | "B" | "C" => {
    const total = getStatsTotal(elf.baseStats);
    if (total >= 710) return "SS";
    if (total >= 690) return "S";
    if (total >= 650) return "A";
    if (total >= 580) return "B";
    return "C";
  };

  // Returns the diamond cost associated with recruiting a particular Elf tier
  const getRecruitDiamondCost = (elf: Elf): number => {
    const grade = getElfGrade(elf);
    const mod = selectedModifiers.includes("cost_recruit") ? 1 : 0;
    if (grade === "SS") return 5 + mod;
    if (grade === "S") return 3 + mod;
    if (grade === "A") return 1 + mod;
    return 0; // B and C tiers are free
  };

  // Spend a recruitment order of a specific tier to show candidate selections
  const handleUseVoucher = (tier: "C" | "B" | "A" | "S") => {
    if (vouchers[tier] <= 0) return;
    setActiveVoucherUsed(tier);

    if (tier === "S") {
      // Roll 3 random candidates for S-rank recruitment (30% chance for a temporary recruit)
      const rolled: { elf: Elf; isTemp: boolean }[] = [];
      const isBossRage = selectedModifiers.includes("strong_boss");
      const isLucky = Math.random() < 0.3 && !isBossRage;

      for (let i = 0; i < 3; i++) {
        // Roll from high tier pool
        const pool = allElves.filter(e => getStatsTotal(e.baseStats) >= 650);
        const randomElf = pool[Math.floor(Math.random() * pool.length)] || allElves[0];

        // Let first candidate be a temporary free recruit with a 30% chance
        rolled.push({
          elf: { ...randomElf, battleId: `player-recruit-${randomElf.id}-${Date.now()}-${i}` },
          isTemp: i === 0 && isLucky
        });
      }
      setRolledCandidates(rolled);
      setRecruitSelectionMode("roll");
    } else {
      setRecruitSelectionMode("list");
    }
  };

  // Triggers the selection of a candidate Elf, managing team capacity limit
  const handleSelectRecruitElf = (elf: Elf, isTemp: boolean) => {
    const cost = isTemp ? 0 : getRecruitDiamondCost(elf);
    if (diamonds < cost) {
      setActionOutcome("你的金庫鑽石儲備不足，無法支付本項高等招募契約。");
      return;
    }

    if (runElves.length < 6) {
      // Recruit directly if team is not full
      executeRecruitment(elf, isTemp, -1);
    } else {
      // Show team replacement screen
      setElfToRecruit(elf);
      setElfToRecruitIsTemp(isTemp);
      setShowReplacementScreen(true);
    }
  };

  // Perform actual recruitment adding to runElves, replacing if team was full
  const executeRecruitment = (elf: Elf, isTemp: boolean, replaceIdx: number) => {
    if (!activeVoucherUsed || movementLock.current) return;
    const freshElf={...elf,battleId:newRunId()};
    const next=recruitRun(getRunSnapshot(),activeVoucherUsed,freshElf,isTemp?0:getRecruitDiamondCost(elf),replaceIdx);
    if(!next)return;
    movementLock.current=true;
    setDiamonds(next.diamonds);setVouchers(next.vouchers);setRunElves(next.runElves);
    queueMicrotask(()=>{movementLock.current=false;});
    setShowReplacementScreen(false);
    setElfToRecruit(null);
    setActiveVoucherUsed(null);
    setRecruitSelectionMode(null);

    occupyCurrentNode(`成功招募精靈夥伴【${elf.name}】！${isTemp ? "（臨時編制，不耗鑽石）" : ""}已安全加入你的探險主力隊伍！`);
    setActiveAction(null);
  };

  // Initiate real battle by bundling team buffs, scaling enemies, and dispatching battle screen
  const startRealBattle = () => {
    if (!currentNode || (currentNode.occupied && !piratePrincipal)) return;

    // Apply collectibles and custom avatar equipment buffs to player's runElves
    const boostedTeam = runElves.map(elf => {
      let boostedStats = { ...elf.baseStats };

      // Apply active collectibles buffs
      collectibles.forEach(c => {
        if (c.effect) boostedStats = c.effect(boostedStats);
      });

      // Apply negative difficulty modifiers from active interstellar run setup
      selectedModifiers.forEach(id => {
        const mod = DIFFICULTY_MODIFIERS.find(m => m.id === id);
        if (mod?.effect === "p1_hp_0.8") {
          boostedStats.hp = Math.floor((boostedStats.hp || 0) * 0.8);
        }
        if (mod?.effect === "p1_speed_0.85") {
          boostedStats.speed = Math.floor((boostedStats.speed || 0) * 0.85);
        }
      });

      return buildExplorationSnapshot(elf, boostedStats, equipType === "suit" ? equipId : undefined, equipType === "title" ? equipId : undefined);
    });

    // Generate opponent team based on node complexity and current layer number
    let enemyTeam: Elf[] = [];
    const count = currentNode.type === "boss" ? 1 : currentNode.type === "elite" ? 3 : 1;

    let pool = allElves;
    if (currentNode.type === "boss") {
      pool = allElves.filter(e => getStatsTotal(e.baseStats) >= 700);
    } else if (currentNode.type === "elite") {
      pool = allElves.filter(e => getStatsTotal(e.baseStats) >= 670 && getStatsTotal(e.baseStats) < 710);
    } else {
      pool = allElves.filter(e => getStatsTotal(e.baseStats) < 680);
    }

    if (pool.length === 0) pool = allElves;

    // Scale up stats per layer after layer 1 (+20% base stat multiplier per layer)
    const scaling = 1 + (currentLayer - 1) * 0.2;
    const isBossRage = selectedModifiers.includes("strong_boss") && currentNode.type === "boss";
    const extraBossScaling = isBossRage ? 1.2 : 1;

    for (let i = 0; i < count; i++) {
      const e = pool[Math.floor(Math.random() * pool.length)];
      const scaledStats = {
        ...e.baseStats,
        hp: Math.floor((e.baseStats.hp || 0) * scaling * extraBossScaling),
        atk: Math.floor((e.baseStats.atk || 0) * scaling * extraBossScaling),
        def: Math.floor((e.baseStats.def || 0) * scaling * extraBossScaling),
        spatk: Math.floor((e.baseStats.spatk || 0) * scaling * extraBossScaling),
        spdef: Math.floor((e.baseStats.spdef || 0) * scaling * extraBossScaling),
        speed: Math.floor((e.baseStats.speed || 0) * scaling * extraBossScaling),
      };
      enemyTeam.push({ ...buildExplorationSnapshot(e, scaledStats), battleId: `enemy-${e.id}-${i}-${Date.now()}` });
    }

    const finalMaxPotions = effectiveMaxPotionUsage;

    if (!boostedTeam.some(e => isAliveBySurvivalRule(e.currentHp,e.survivalRule))) { setActionOutcome('隊伍已無存活精靈，請先恢復體力。'); return; }
    const stored = loadRun(localStorage);
    const pending = stored?.pendingBattle ? stored : prepareBattle(getRunSnapshot(), newRunId(), Array.from({length:4},()=>Math.random()), {p1:boostedTeam,p2:enemyTeam});
    const saved = stored?.pendingBattle ? stored : saveRun(localStorage,pending);
    revision.current = saved.revision;
    const id = saved.pendingBattle.id; const owner = saved.runId;
    const teams = saved.pendingBattle.teams;
    const options = {
      suit1:equipType === 'suit' ? equipId : undefined, title1:equipType === 'title' ? equipId : undefined,
      format:teams.p2.length === 1 ? 'solo_1v1' : 'normal_6v6', preparedTeams:true, specialMode:'interstellar',
      interstellarOptions:{runId:owner,battleId:id,potionUsage:saved.potionUsage,maxPotionUsage:finalMaxPotions,
        onPotionUse:()=>consumePotion(localStorage,owner,id,finalMaxPotions),
        onBattleEnd:(winner: string, team?: Elf[])=>settleStoredBattle(localStorage,owner,id,winner,team)
      }
    };
    setActiveAction(null);
    onStartBattle(teams.p1,teams.p2,'PVE',options);
  };

  // Change currently active equipment suit/title for 100 Saer Beans
  const handleChangeEquip = (type: "suit" | "title", id: string) => {
    const cost = 100;
    if (saerBeans < cost) {
      setActionOutcome("賽爾豆不足，無法支付設備適配適配費用。");
      return;
    }
    setSaerBeans(s => s - cost);
    setEquipType(type);
    setEquipId(id);
    setActionOutcome(`裝備適配成功！目前已激活：【${type === "suit" ? SUIT_CATALOG[id]?.name : TITLE_CATALOG[id]?.name}】！`);
  };

  const getEquipName = () => {
    if (equipType === "suit") return SUIT_CATALOG[equipId]?.name || "未知套裝";
    return TITLE_CATALOG[equipId]?.name || "未知稱號";
  };

  const getEquipBuff = () => {
    if (equipType === "suit") return "戰鬥中全屬性加成與套裝特效已激活";
    return "角色能力增強與稱號加成已激活";
  };

  if (!currentLayerData) return null;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-20 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-8 z-30 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-600/10 rounded-2xl border border-blue-500/20 text-blue-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-none mb-1">星際探索系統</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Sector:</span>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{currentLayerData.name} L{currentLayer}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-6 bg-slate-950/50 px-6 py-2 rounded-2xl border border-white/5 shadow-inner">
            <div className="flex items-center gap-2" title="鑽石：用於招募精英精靈">
              <Diamond className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-black text-white">{diamonds}</span>
            </div>
            <div className="w-px h-4 bg-white/10"></div>
            <div className="flex items-center gap-2" title="賽爾豆：用於商店購買物資">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-black text-white">{saerBeans}</span>
            </div>
            <div className="w-px h-4 bg-white/10"></div>
            <div className="flex items-center gap-2" title="燃料：移動節點消耗">
              <Zap className="w-4 h-4 text-orange-400" />
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <motion.div className="h-full bg-orange-500" initial={{ width: 0 }} animate={{ width: `${(fuel / maxFuel) * 100}%` }} />
              </div>
              <span className="text-[10px] font-bold text-slate-500">{fuel}/{maxFuel}</span>
            </div>
          </div>

          <button
            onClick={() => setShowBackpack(true)}
            className="p-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-2xl transition-all relative group flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            <span className="hidden md:inline text-xs font-bold">背包</span>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-[10px] font-bold text-white rounded-full flex items-center justify-center border border-slate-900">
              {runElves.length}
            </span>
          </button>

          <div className="h-8 w-px bg-white/5 mx-2"></div>

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${equipType === "suit" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
              {equipType === "suit" ? <Shield className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{equipType === "suit" ? "Active Suit" : "Active Title"}</span>
              <span className="text-sm font-bold text-slate-200">{getEquipName()}</span>
            </div>
            <button
              onClick={() => setShowEquipSwitcher(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <button
            onClick={() => onEndRun(currentLayer, earnedExp)}
            className="px-4 py-2 text-xs font-bold bg-white/5 text-slate-400 border border-white/10 rounded-xl hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95"
          >
            退出
          </button>
        </div>
      </header>

      {/* Main Container: Map & Actions */}
      <div className="flex-grow flex overflow-hidden relative">
        <AnimatePresence>
          {activeAction === "combat" && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-red-950/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-slate-900 border border-red-500/30 rounded-[32px] p-8 max-w-md w-full text-center shadow-2xl"
              >
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">準備進入戰鬥</h3>
                <p className="text-slate-400 mb-8">偵測到敵對信號。這將是一場艱難的對決，確保你的精靈已準備就緒。</p>
                <div className="space-y-3">
                  <button
                    onClick={startRealBattle}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-600/20 transition-all"
                  >
                    發動攻擊
                  </button>
                  <button
                    onClick={() => setActiveAction(null)}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all"
                  >
                    撤退
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {activeAction === "recruit" && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (!showReplacementScreen) {
                    setActiveVoucherUsed(null);
                    setRecruitSelectionMode(null);
                    setActiveAction(null);
                  }
                }}
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-slate-900 border border-indigo-500/30 rounded-[40px] p-8 max-w-5xl w-full flex flex-col max-h-[88vh] shadow-2xl z-10"
              >
                {/* Recruitment Top Info Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-indigo-400" />
                      精英招募中心
                    </h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Personnel Acquisition Protocol</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-cyan-400 bg-cyan-400/10 px-5 py-2.5 rounded-2xl border border-cyan-400/20">
                      <Diamond className="w-5 h-5" />
                      <span className="font-bold text-xl">{diamonds}</span>
                      <span className="text-xs text-slate-500 ml-1">鑽石</span>
                    </div>
                  </div>
                </div>

                {/* Sub-view 1: Voucher Selection */}
                {activeVoucherUsed === null && (
                  <div className="flex-grow overflow-y-auto custom-scrollbar py-2 pr-2">
                    <p className="text-center text-slate-400 text-sm mb-8 max-w-xl mx-auto leading-relaxed">
                      請選擇一張你擁有的「招募令」來開啟本次自選精靈池。不同的招募令將開放不同階級的精靈供你自由選擇。
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-4">
                      {[
                        { tier: "C", name: "C級招募令", desc: "開放C級精靈池自選", color: "from-slate-800/80 to-slate-950 border-slate-700/50 hover:border-slate-400/40" },
                        { tier: "B", name: "B級招募令", desc: "開放B~C級精靈自選", color: "from-blue-950/80 to-slate-950 border-blue-900/50 hover:border-blue-400/40" },
                        { tier: "A", name: "A級招募令", desc: "開放A~C級精靈自選", color: "from-purple-950/80 to-slate-950 border-purple-900/50 hover:border-purple-400/40" },
                        { tier: "S", name: "S級招募令", desc: "抽取3隻S~C級自選，含免費臨時招募", color: "from-amber-950/80 to-slate-950 border-amber-900/50 hover:border-amber-400/40" }
                      ].map((item) => {
                        const count = vouchers[item.tier as keyof typeof vouchers] || 0;
                        return (
                          <div
                            key={item.tier}
                            className={`p-6 rounded-[28px] border bg-gradient-to-br ${item.color} flex flex-col justify-between transition-all group relative overflow-hidden`}
                          >
                            <div className="absolute top-4 right-4 bg-white/10 text-white text-xs font-black px-3 py-1 rounded-full border border-white/10">
                              持有 {count} 張
                            </div>
                            <div className="mb-8 pt-4">
                              <div className="text-4xl font-black text-slate-100 mb-1">{item.tier} <span className="text-xs text-slate-500 font-bold">級令</span></div>
                              <div className="text-sm font-bold text-slate-300 mt-2">{item.name}</div>
                              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.desc}</p>
                            </div>
                            <button
                              disabled={count <= 0}
                              onClick={() => handleUseVoucher(item.tier as any)}
                              className={`w-full py-3 rounded-xl font-black text-xs transition-all active:scale-95 ${
                                count > 0
                                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
                              }`}
                            >
                              使用招募令
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-view 2: Elf Selection List (C, B, A) */}
                {activeVoucherUsed !== null && recruitSelectionMode === "list" && (
                  <div className="flex-grow flex flex-col overflow-hidden">
                    {/* Search and Filters */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative flex-grow">
                        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="名稱、ID、屬性（可用空白組合）"
                          value={recruitSearchQuery}
                          onChange={(e) => setRecruitSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-slate-950/60 border border-white/5 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 text-slate-200 font-medium"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setActiveVoucherUsed(null);
                          setRecruitSelectionMode(null);
                        }}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-all"
                      >
                        返回選擇招募令
                      </button>
                    </div>

                    {/* Elves Grid */}
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allElves
                          .filter(elf => {
                            const grade = getElfGrade(elf);
                            if (activeVoucherUsed === "C") return grade === "C";
                            if (activeVoucherUsed === "B") return grade === "B" || grade === "C";
                            if (activeVoucherUsed === "A") return grade === "A" || grade === "B" || grade === "C";
                            return true;
                          })
                          .filter(elf => matchesElfQuery(elf, recruitSearchQuery))
                          .map((elf, index) => {
                            const grade = getElfGrade(elf);
                            const cost = getRecruitDiamondCost(elf);
                            const canAfford = diamonds >= cost;
                            return (
                              <div
                                key={`${elf.id}-${index}`}
                                className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-indigo-500/20 transition-all group"
                              >
                                <div className="w-16 h-16 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-white/10 shadow-inner">
                                  <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                </div>
                                <div className="flex-grow min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-200 truncate">{elf.name}</span>
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                      grade === "A" ? "bg-purple-500/20 text-purple-400" : grade === "B" ? "bg-blue-500/20 text-blue-400" : "bg-slate-500/20 text-slate-400"
                                    }`}>{grade} 級</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1 inline-flex items-center gap-1">屬性：<TypeIcon type={elf.type} size={12} />{elf.type} | 總和：{getStatsTotal(elf.baseStats)}</div>
                                  <div className="flex items-center gap-3 mt-2">
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><Sword className="w-3 h-3" /> {elf.baseStats.atk}</div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><Shield className="w-3 h-3" /> {elf.baseStats.def}</div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500"><Heart className="w-3 h-3" /> {elf.baseStats.hp}</div>
                                  </div>
                                </div>
                                <button
                                  disabled={!canAfford}
                                  onClick={() => handleSelectRecruitElf(elf, false)}
                                  className={`px-4 py-2 text-xs font-black rounded-xl transition-all active:scale-95 flex flex-col items-center ${
                                    canAfford
                                      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                                      : "bg-slate-800 text-slate-600 cursor-not-allowed"
                                  }`}
                                >
                                  <span>招募</span>
                                  <span className="text-[9px] opacity-75">{cost > 0 ? `${cost} 鑽` : "免費"}</span>
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-view 3: S-Grade Voucher Roll View */}
                {activeVoucherUsed === "S" && recruitSelectionMode === "roll" && (
                  <div className="flex-grow overflow-y-auto custom-scrollbar py-2 pr-2">
                    <p className="text-center text-slate-400 text-sm mb-6">
                      S級招募令已成功解鎖虛空核心通道！隨機抽取到以下 3 隻高等精靈，你可以自選其中一隻加入隊伍：
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full pb-4">
                      {rolledCandidates.map((candidate, idx) => {
                        const elf = candidate.elf;
                        const grade = getElfGrade(elf);
                        const isTemp = candidate.isTemp;
                        const cost = isTemp ? 0 : getRecruitDiamondCost(elf);
                        const canAfford = diamonds >= cost;
                        return (
                          <div
                            key={idx}
                            className={`p-6 rounded-[32px] border flex flex-col justify-between transition-all group overflow-hidden relative ${
                              isTemp
                                ? "bg-gradient-to-b from-cyan-950/90 to-slate-900 border-cyan-400/40 hover:border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                : "bg-gradient-to-b from-purple-950/70 to-slate-900 border-purple-500/20 hover:border-purple-400/40"
                            }`}
                          >
                            {isTemp && (
                              <div className="absolute top-4 left-4 bg-cyan-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                臨時招募 (不耗鑽)
                              </div>
                            )}

                            <div className="text-center py-4">
                              <div className="w-24 h-24 bg-slate-950/60 rounded-3xl mx-auto mb-4 border border-white/5 flex items-center justify-center overflow-hidden">
                                <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                              </div>
                              <div className="flex items-center justify-center gap-2">
                                <h4 className="text-lg font-black text-white">{elf.name}</h4>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  grade === "SS" ? "bg-amber-500 text-slate-950" : "bg-indigo-500/20 text-indigo-400"
                                }`}>{grade}</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">屬性：<TypeIcon type={elf.type} size={13} />{elf.type} | 戰力值：{getStatsTotal(elf.baseStats)}</p>

                              <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                                <div className="text-center"><span className="text-[9px] text-slate-500 block">攻擊</span><span className="text-xs font-bold text-slate-300">{elf.baseStats.atk}</span></div>
                                <div className="text-center"><span className="text-[9px] text-slate-500 block">防禦</span><span className="text-xs font-bold text-slate-300">{elf.baseStats.def}</span></div>
                                <div className="text-center"><span className="text-[9px] text-slate-500 block">生命</span><span className="text-xs font-bold text-slate-300">{elf.baseStats.hp}</span></div>
                              </div>
                            </div>

                            <button
                              disabled={!canAfford}
                              onClick={() => handleSelectRecruitElf(elf, isTemp)}
                              className={`w-full py-3.5 rounded-xl font-black text-xs transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 ${
                                canAfford
                                  ? isTemp
                                    ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20"
                                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
                              }`}
                            >
                              <span>確認招募</span>
                              <span className="text-[9px] opacity-75">{cost > 0 ? `消耗 ${cost} 鑽石` : "免費招募"}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-view 4: Backpack Overflow Team Replacement Selection Overlay */}
                {showReplacementScreen && elfToRecruit && (
                  <div className="absolute inset-0 bg-slate-950/95 z-50 rounded-[40px] p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
                    <div>
                      <h3 className="text-xl font-black text-yellow-500 flex items-center gap-3">
                        <Users className="w-6 h-6" />
                        探險隊伍人員已滿！ (6/6)
                      </h3>
                      <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                        你正在招募精靈夥伴：<span className="font-bold text-white">【{elfToRecruit.name}】</span>。
                        請在下方隊伍中選擇一隻精靈進行替換，被替換的精靈將暫時離開探險隊伍。
                      </p>
                    </div>

                    <div className="flex-grow overflow-y-auto custom-scrollbar my-4 pr-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
                        {runElves.map((elf, idx) => {
                          const grade = getElfGrade(elf);
                          return (
                            <div
                              key={idx}
                              onClick={() => executeRecruitment(elfToRecruit, elfToRecruitIsTemp, idx)}
                              className="p-4 bg-slate-900 border border-white/5 hover:border-red-500/50 hover:bg-red-950/10 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group"
                            >
                              <div className="w-14 h-14 bg-slate-950 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center">
                                <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-grow">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-200 group-hover:text-red-400 transition-colors">{elf.name}</span>
                                  <span className="text-[9px] font-bold text-slate-500">{grade}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">生命：{elf.baseStats.hp} | 攻擊：{elf.baseStats.atk}</p>
                              </div>
                              <div className="text-[10px] text-red-500 font-black opacity-0 group-hover:opacity-100 transition-opacity">
                                點擊替換
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end gap-4 border-t border-white/5 pt-4">
                      <button
                        onClick={() => {
                          setShowReplacementScreen(false);
                          setElfToRecruit(null);
                        }}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors text-xs"
                      >
                        取消替換 (返回列表)
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-between border-t border-white/5 pt-6">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                    持有：C級x{vouchers.C} | B級x{vouchers.B} | A級x{vouchers.A} | S級x{vouchers.S}
                  </span>
                  {!showReplacementScreen && (
                    <button
                      onClick={() => {
                        setActiveVoucherUsed(null);
                        setRecruitSelectionMode(null);
                        setActiveAction(null);
                      }}
                      className="px-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl transition-all"
                    >
                      關閉中心
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {activeAction === "shop" && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveAction(null)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-slate-900 border border-amber-500/30 rounded-[32px] p-8 max-w-lg w-full flex flex-col max-h-[80vh] shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-white flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-amber-400" />
                    星際交易所
                  </h3>
                  <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-xl border border-yellow-400/20">
                    <Coins className="w-4 h-4" />
                    <span className="font-bold">{saerBeans}</span>
                    <span className="text-xs text-slate-500">賽爾豆</span>
                  </div>
                </div>

                <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  <ShopItem
                    name="高能燃料箱"
                    desc="補滿當前燃料，前行必備"
                    cost={100}
                    icon={<Zap className="w-5 h-5" />}
                    onBuy={() => {
                      if (saerBeans >= 100) {
                        setSaerBeans(s => s - 100);
                        setFuel(maxFuel);
                        occupyCurrentNode("高能燃料箱加注完成！飛船續航狀態全滿。");
                        setActiveAction(null);
                      }
                    }}
                  />
                  <ShopItem
                    name="A級招募令"
                    desc="獲得 1 張 A級招募令，召喚強力精靈"
                    cost={300}
                    icon={<Sparkles className="w-5 h-5" />}
                    onBuy={() => {
                      if (saerBeans >= 300) {
                        setSaerBeans(s => s - 300);
                        setVouchers(v => ({ ...v, A: v.A + 1 }));
                        occupyCurrentNode("購買 A 級招募令成功！已存儲至招募核心。");
                        setActiveAction(null);
                      }
                    }}
                  />
                  <ShopItem
                    name="核心能量鑽石 x1"
                    desc="獲得 1 顆能量鑽石，用於招募高級精靈"
                    cost={200}
                    icon={<Diamond className="w-5 h-5" />}
                    onBuy={() => {
                      if (saerBeans >= 200) {
                        setSaerBeans(s => s - 200);
                        setDiamonds(d => d + 1);
                        occupyCurrentNode("超純度能量鑽石充能完畢！已添加至金庫。");
                        setActiveAction(null);
                      }
                    }}
                  />
                  <ShopItem
                    name="戰略解毒藥劑包"
                    desc="解鎖最大藥劑使用次數上限 +2"
                    cost={150}
                    icon={<FlaskConical className="w-5 h-5" />}
                    onBuy={() => {
                      if (saerBeans >= 150) {
                        setSaerBeans(s => s - 150);
                        setMaxPotionUsage(m => m + 2);
                        occupyCurrentNode("戰術套裝藥劑配額解鎖成功！");
                        setActiveAction(null);
                      }
                    }}
                  />
                </div>

                <button
                  onClick={() => setActiveAction(null)}
                  className="mt-8 w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl transition-all"
                >
                  離開交易所
                </button>
              </motion.div>
            </div>
          )}

          {activeAction === "bank" && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveAction(null)}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-slate-900 border border-yellow-500/30 rounded-[32px] p-8 max-w-lg w-full flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-yellow-400">
                      <Coins className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white">
                        {bankType === "kiske" ? "琪斯克宇宙分行" : bankType === "merchant" ? "黑市理財代理商" : "歐比海盜地下金庫"}
                      </h3>
                      <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Interstellar Asset Yield Pool</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">當前利息收益率</span>
                    <span className="text-lg font-black text-green-400">+{(bankInterestRates[bankType] * 100 + bankRateBonus * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Bank Intro text */}
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 text-xs text-slate-400 leading-relaxed mb-6">
                  {bankType === "kiske" && "琪斯克銀行是星際聯盟認證的老字號，本息 100% 安全保障。提款隨時提取，絕無手續費與爆雷風險。"}
                  {bankType === "merchant" && "黑市商人提供的超高收益。提款時有 10% 的可能爆雷（理財經理失聯跑路），屆時只能收回一半本金。"}
                  {bankType === "pirate" && "海盜開設的地下黑金庫，回報率高達 80%！但海盜無信，提款時有 25% 機率直接翻臉，將本金沒收或觸發戰鬥守衛你的存款。"}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 text-center">
                    <span className="text-[10px] text-slate-500 block font-bold">我的隨身現金</span>
                    <span className="text-lg font-black text-yellow-400 mt-1 block">{saerBeans} 豆</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-yellow-500/10 text-center">
                    <span className="text-[10px] text-slate-500 block font-bold">已存儲本金</span>
                    <span className="text-lg font-black text-white mt-1 block">{bankBalance} 豆</span>
                  </div>
                </div>

                <div className="space-y-2 flex-grow">
                  <div className="flex gap-2">
                    <button
                      disabled={saerBeans < 100}
                      onClick={() => {
                        if (saerBeans >= 100) {
                          setSaerBeans(s => s - 100);
                          setBankBalance(b => b + 100);
                        }
                      }}
                      className="flex-grow py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors"
                    >
                      存入 100 豆
                    </button>
                    <button
                      disabled={saerBeans < 500}
                      onClick={() => {
                        if (saerBeans >= 500) {
                          setSaerBeans(s => s - 500);
                          setBankBalance(b => b + 500);
                        }
                      }}
                      className="flex-grow py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors"
                    >
                      存入 500 豆
                    </button>
                  </div>

                  <button
                    disabled={bankBalance <= 0}
                    onClick={() => {
                      if (bankBalance <= 0) return;
                      const rate = bankInterestRates[bankType] + bankRateBonus;
                      const yieldAmount = Math.floor(bankBalance * (1 + rate));

                      if (bankType === "kiske") {
                        setSaerBeans(s => s + yieldAmount);
                        setBankBalance(0);
                        occupyCurrentNode(`存款提現成功！安全領回本金與利息共：${yieldAmount} 賽爾豆！`);
                        setActiveAction(null);
                      } else if (bankType === "merchant") {
                        const fail = Math.random() < 0.1;
                        if (fail) {
                          const cutAmount = Math.floor(bankBalance / 2);
                          setSaerBeans(s => s + cutAmount);
                          setBankBalance(0);
                          occupyCurrentNode(`不妙！黑市理財經理宣稱爆雷，公司已申請破產保護。只追回了一半本金共：${cutAmount} 賽爾豆。`);
                        } else {
                          setSaerBeans(s => s + yieldAmount);
                          setBankBalance(0);
                          occupyCurrentNode(`高風險高回報！理財成功提取！共獲得本息：${yieldAmount} 賽爾豆！`);
                        }
                        setActiveAction(null);
                      } else {
                        const ambush = Math.random() < 0.25;
                        if (ambush) {
                          setPiratePrincipal(bankBalance);
                          setBankBalance(0);
                          setActiveAction(null);
                          // Force a combat action with the bonus pirate defense
                          occupyCurrentNode("海盜翻臉了！『想拿走金子？先問問老子的艦砲吧！』本金已被扣留，海盜護衛已將你重重包圍！");
                          setActiveAction("combat");
                        } else {
                          setSaerBeans(s => s + yieldAmount);
                          setBankBalance(0);
                          occupyCurrentNode(`海盜破天荒地講了一次誠信！本息全額領回共：${yieldAmount} 賽爾豆！`);
                          setActiveAction(null);
                        }
                      }
                    }}
                    className="w-full py-3.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-xl text-xs transition-all shadow-lg shadow-yellow-600/20"
                  >
                    提領所有存款本息 (利息額外 +{(bankRateBonus*100).toFixed(0)}%)
                  </button>
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t border-white/5">
                  <button
                    onClick={() => {
                      // Mark node as occupied, granting a persistent bank interest bonus of +5%
                      setBankRateBonus(b => b + 0.05);
                      occupyCurrentNode("你選擇留下佔領該銀行據點。本次探險後續所有銀行的利息率永久增加 +5%！");
                      setActiveAction(null);
                    }}
                    className="flex-grow py-3 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white font-bold rounded-xl text-xs transition-colors border border-indigo-500/20 text-center"
                  >
                    佔領據點 (+5% 利息加成)
                  </button>
                  <button
                    onClick={() => setActiveAction(null)}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
                  >
                    關閉
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {activeAction === "growth" && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setSelectedGrowthElfIdx(null);
                  setActiveAction(null);
                }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-slate-900 border border-green-500/30 rounded-[40px] p-8 max-w-4xl w-full flex flex-col max-h-[85vh] shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-400">
                      <FlaskConical className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white">超新星基因成長艙</h3>
                      <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Supernova Genetic Recombination Bay</p>
                    </div>
                  </div>
                  <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full border border-green-500/20 font-bold">基因改造</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-grow overflow-y-auto lg:overflow-hidden custom-scrollbar pr-1">
                  {/* Left Column: Team Selection */}
                  <div className="flex flex-col lg:overflow-hidden max-h-[300px] lg:max-h-none">
                    <h4 className="text-sm font-black text-slate-400 mb-4 uppercase tracking-wider">選擇基因受體精靈</h4>
                    <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {runElves.map((elf, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedGrowthElfIdx(idx)}
                          className={`p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer border ${
                            selectedGrowthElfIdx === idx
                              ? "bg-green-950/20 border-green-500 text-white"
                              : "bg-slate-950/40 border-white/5 hover:border-white/10 text-slate-300"
                          }`}
                        >
                          <div className="w-12 h-12 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
                            <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-grow">
                            <span className="font-bold block">{elf.name}</span>
                            <span className="text-[10px] text-slate-500 block">屬性：{elf.element} | 生命力：{elf.baseStats.hp}</span>
                          </div>
                          {selectedGrowthElfIdx === idx && (
                            <span className="text-xs text-green-400 font-bold">已選定</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Gene Mutation Cards */}
                  <div className="flex flex-col lg:overflow-hidden">
                    {selectedGrowthElfIdx === null ? (
                      <div className="h-64 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-slate-600 p-6 text-center">
                        <FlaskConical className="w-12 h-12 mb-3 opacity-10" />
                        <span className="text-sm font-bold opacity-50">請先在左側選定精靈</span>
                        <span className="text-[10px] uppercase tracking-wider mt-1 opacity-35">Select an recipient elf to mutates</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider">選擇注入重組基因</h4>

                        {[
                          { name: "力量突變基因 💪", bonus: "攻擊屬性額外永久 +40", statKey: "atk", amount: 40, desc: "大幅增強物理與特攻破壞力，使其每次打擊更具威脅。" },
                          { name: "生命重組基因 ❤️", bonus: "最大體力永久 +100", statKey: "hp", amount: 100, desc: "重組高能分子，大幅提升戰場耐打度與承傷能力。" },
                          { name: "敏捷反射基因 ⚡", bonus: "先手速度屬性永久 +30", statKey: "speed", amount: 30, desc: "注入神經反射刺激劑，使其更容易在戰鬥中搶佔先手權。" }
                        ].map((gene, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              const nextElves = [...runElves];
                              const target = { ...nextElves[selectedGrowthElfIdx!] };
                              target.baseStats = {
                                ...target.baseStats,
                                [gene.statKey]: (target.baseStats[gene.statKey as keyof typeof target.baseStats] || 0) + gene.amount
                              };
                              nextElves[selectedGrowthElfIdx!] = target;
                              setRunElves(nextElves);
                              setSelectedGrowthElfIdx(null);
                              occupyCurrentNode(`重組完畢！成功為精靈夥伴【${target.name}】注入了【${gene.name}】，${gene.bonus}！`);
                              setActiveAction(null);
                            }}
                            className="p-4 bg-slate-950/60 hover:bg-green-950/10 border border-white/5 hover:border-green-500/30 rounded-2xl cursor-pointer transition-all group"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-200 group-hover:text-green-400 transition-colors">{gene.name}</span>
                              <span className="text-[10px] bg-green-500/10 text-green-400 font-bold px-2 py-0.5 rounded">{gene.bonus}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">{gene.desc}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between border-t border-white/5 pt-6 mt-6">
                  <button
                    onClick={() => {
                      // Occupy current node, and gain some bonus saer beans instead
                      setSaerBeans(s => s + 150);
                      occupyCurrentNode("你放棄了本次基因成長改造，超新星能量轉換為 150 賽爾豆安全回收！");
                      setSelectedGrowthElfIdx(null);
                      setActiveAction(null);
                    }}
                    className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs transition-colors text-center"
                  >
                    回收轉換成 150 賽爾豆
                  </button>
                  <button
                    onClick={() => {
                      setSelectedGrowthElfIdx(null);
                      setActiveAction(null);
                    }}
                    className="py-3 px-8 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors text-center"
                  >
                    關閉
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {activeAction === "event" && currentEvent && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-slate-900 border border-emerald-500/30 rounded-[40px] p-10 max-w-xl w-full flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.15)] overflow-hidden"
              >
                {/* Visual glow backdrop inside */}
                <div className="absolute -top-12 -left-12 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="mb-8 relative z-10">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                    currentEventType === "chance" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                  }`}>
                    {currentEventType === "chance" ? "太空機會遭遇" : "星系命運抉擇"}
                  </span>
                  <h3 className="text-2xl font-black text-white mt-4">{currentEvent.title}</h3>
                  <p className="text-slate-400 text-sm mt-4 leading-relaxed font-medium bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                    {currentEvent.desc}
                  </p>
                </div>

                <div className="space-y-3 relative z-10">
                  {currentEvent.options.map((option: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (option.isBattle) {
                          setActiveAction(null);
                          startRealBattle();
                        } else {
                          const result = option.action(setSaerBeans, setVouchers, setFuel, setDiamonds, setCollectibles, saerBeans, diamonds);
                          occupyCurrentNode(result);
                          setActiveAction(null);
                        }
                      }}
                      className="w-full text-left p-4 bg-slate-950/60 hover:bg-indigo-900/10 border border-white/5 hover:border-indigo-500/40 text-slate-200 hover:text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-between group"
                    >
                      <span>{option.text}</span>
                      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </button>
                  ))}
                </div>

                <div className="mt-8 flex justify-end relative z-10">
                  <button
                    onClick={() => setActiveAction(null)}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs transition-colors"
                  >
                    暫時關閉
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {actionOutcome && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActionOutcome(null)}
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="relative bg-indigo-950 border border-indigo-400/30 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
              >
                <div className="w-16 h-16 bg-indigo-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">任務報告</h3>
                <p className="text-slate-200 mb-8 leading-relaxed font-medium">{actionOutcome}</p>
                <button
                  onClick={() => setActionOutcome(null)}
                  className="w-full py-3 bg-white text-indigo-900 font-black rounded-xl transition-all hover:bg-indigo-50"
                >
                  確認
                </button>
              </motion.div>
            </div>
          )}

          {/* Backpack Modal */}
          {showBackpack && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/30">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">探險背包</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Adventure Inventory</p>
                    </div>
                  </div>
                  <button onClick={() => setShowBackpack(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors">
                    <X className="w-8 h-8" />
                  </button>
                </div>

                <div className="flex-grow p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
                    {/* Elves List */}
                    <div>
                      <h4 className="text-sm font-black text-slate-400 mb-6 flex items-center gap-2 uppercase tracking-widest border-b border-white/5 pb-2">
                        <Users className="w-4 h-4" /> 當前隊伍 ({runElves.length}/6)
                      </h4>
                      <div className="space-y-3">
                         {runElves.map((elf, idx) => {
                           const grade = getElfGrade(elf);
                           return (
                             <div key={idx} className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl flex items-center gap-4 group">
                               <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-xl overflow-hidden border border-white/10">
                                 <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
                               </div>
                               <div className="flex-grow">
                                 <div className="flex items-center gap-2">
                                   <span className="font-bold text-slate-200">{elf.name}</span>
                                   <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                     grade === "SS" ? "bg-amber-500/20 text-amber-500" : "bg-blue-500/20 text-blue-400"
                                   }`}>{grade}</span>
                                 </div>
                              <div className="flex items-center gap-4 mt-1.5">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <Sword className="w-3.5 h-3.5" /> {elf.baseStats.atk}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <Shield className="w-3.5 h-3.5" /> {elf.baseStats.def}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <Heart className="w-3.5 h-3.5" /> {elf.baseStats.hp}
                                </div>
                              </div>
                            </div>
                          </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Collectibles List */}
                    <div>
                      <h4 className="text-sm font-black text-slate-400 mb-6 flex items-center gap-2 uppercase tracking-widest border-b border-white/5 pb-2">
                        <Sparkles className="w-4 h-4" /> 特種裝備 (收藏品)
                      </h4>
                      {collectibles.length === 0 ? (
                        <div className="h-60 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-slate-600">
                          <Package className="w-12 h-12 mb-4 opacity-10" />
                          <span className="text-sm font-bold opacity-50">尚未獲得任何收藏品</span>
                          <span className="text-[10px] uppercase mt-1 opacity-30">Explore sectors to find them</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {collectibles.map((item, idx) => (
                            <div key={idx} className="p-4 bg-gradient-to-r from-blue-900/20 to-slate-900/50 border border-blue-500/20 rounded-2xl shadow-lg">
                              <div className="flex items-center gap-4 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                                  <Star className="w-5 h-5" />
                                </div>
                                <span className="font-black text-slate-100">{item.name}</span>
                              </div>
                              <p className="text-xs text-blue-400/80 leading-relaxed pl-14">{item.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-950/80 border-t border-white/5 flex justify-end">
                  <button
                    onClick={() => setShowBackpack(false)}
                    className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-600/20"
                  >
                    關閉背包
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Battle Result Modal */}
          {lastBattleResult && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-900 border border-white/10 rounded-[48px] w-full max-w-lg overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col"
              >
                <div className={`p-14 text-center relative overflow-hidden ${lastBattleResult.isWin ? "bg-emerald-600/10" : "bg-red-600/10"}`}>
                  <div className={`w-28 h-28 mx-auto rounded-[36px] flex items-center justify-center mb-8 shadow-2xl relative z-10 ${
                    lastBattleResult.isWin ? "bg-emerald-500 text-white shadow-emerald-500/40" : "bg-red-500 text-white shadow-red-500/40"
                  }`}>
                    {lastBattleResult.isWin ? <Trophy className="w-14 h-14" /> : <Skull className="w-14 h-14" />}
                  </div>
                  <h3 className="text-4xl font-black text-white mb-2 relative z-10">
                    {lastBattleResult.isWin ? "戰鬥勝利！" : lastBattleResult.outcome === "exit" ? "已退出戰鬥" : lastBattleResult.outcome === "draw" ? "戰鬥平手" : "戰鬥失敗"}
                  </h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] relative z-10">Sector Mission Complete</p>

                  {/* Decorative Background Icon */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03]">
                    {lastBattleResult.isWin ? <Trophy className="w-64 h-64" /> : <Skull className="w-64 h-64" />}
                  </div>
                </div>

                <div className="p-12 space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-950/80 rounded-3xl border border-white/5 flex flex-col items-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">獲得賽爾豆</div>
                      <div className="text-2xl font-black text-amber-400 flex items-center gap-2">
                        <Coins className="w-6 h-6" /> +{lastBattleResult.beans + (lastBattleResult.recoveredPrincipal || 0)}
                      </div>
                    </div>
                    <div className="p-5 bg-slate-950/80 rounded-3xl border border-white/5 flex flex-col items-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">獲得經驗</div>
                      <div className="text-2xl font-black text-blue-400 flex items-center gap-2">
                        <Star className="w-6 h-6" /> +{lastBattleResult.exp}
                      </div>
                    </div>
                  </div>

                  {lastBattleResult.collectible && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="p-6 bg-gradient-to-br from-indigo-600/30 to-blue-600/10 rounded-[32px] border border-indigo-500/30 shadow-lg"
                    >
                      <div className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> 獲得特種裝備！
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                          <Package className="w-10 h-10" />
                        </div>
                        <div>
                          <div className="text-xl font-black text-white mb-1">{lastBattleResult.collectible.name}</div>
                          <div className="text-xs text-indigo-300 leading-relaxed">{lastBattleResult.collectible.description}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <button
                    onClick={() => {
                      setLastBattleResult(null);
                    }}
                    className="w-full py-5 bg-white text-slate-900 font-black rounded-3xl shadow-2xl hover:bg-slate-100 transition-all active:scale-95 text-lg"
                  >
                    返回地圖
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showEquipSwitcher && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEquipSwitcher(false)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-400" />
                    切換戰術裝備
                  </h3>
                  <button onClick={() => setShowEquipSwitcher(false)} className="p-2 hover:bg-white/10 rounded-lg text-slate-500">
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </button>
                </div>
                <div className="p-8 space-y-6">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-4">
                    <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-yellow-200">切換手續費</div>
                      <div className="text-xs text-yellow-500/70">每次切換需要消耗 100 賽爾豆</div>
                    </div>
                    <div className="ml-auto text-xl font-black text-yellow-400">100</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleChangeEquip("suit", "morning_star")}
                      disabled={saerBeans < 100 || (equipType === "suit" && equipId === "morning_star")}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        equipType === "suit" && equipId === "morning_star"
                          ? "bg-blue-600 border-blue-400 text-white"
                          : "bg-slate-950 border-white/5 hover:border-white/20"
                      } disabled:opacity-50`}
                    >
                      <Shield className="w-6 h-6 mb-2" />
                      <div className="font-bold">晨曦之星戰甲</div>
                      <div className="text-[10px] opacity-70">提供全方位屬性加成</div>
                    </button>
                    <button
                      onClick={() => handleChangeEquip("title", "zhandou_aihaozhe")}
                      disabled={saerBeans < 100 || (equipType === "title" && equipId === "zhandou_aihaozhe")}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        equipType === "title" && equipId === "zhandou_aihaozhe"
                          ? "bg-purple-600 border-purple-400 text-white"
                          : "bg-slate-950 border-white/5 hover:border-white/20"
                      } disabled:opacity-50`}
                    >
                      <Trophy className="w-6 h-6 mb-2" />
                      <div className="font-bold">戰鬥愛好者</div>
                      <div className="text-[10px] opacity-70">全屬性基礎加成</div>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Animated Space Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-slate-950"></div>
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-0.5 h-0.5 bg-white rounded-full opacity-20"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0.1, 0.4, 0.1],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 5,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.15),transparent_70%)]"></div>
        </div>

        {/* Map View: Metro Map Implementation */}
        <div className="flex-grow relative z-10 overflow-hidden flex items-center justify-center p-8">
          <div className="relative w-full max-w-5xl aspect-[2/1] bg-slate-900/30 backdrop-blur-sm rounded-[40px] border border-white/5 shadow-inner p-12 flex items-center justify-center">
            {/* Connection Lines (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
              </defs>
              {currentLayerData.nodes.map(node => (
                node.connections.map(targetId => {
                  const target = currentLayerData.nodes.find(n => n.id === targetId);
                  if (!target) return null;
                  return (
                    <motion.line
                      key={`${node.id}-${targetId}`}
                      x1={`${node.x}%`}
                      y1={`${node.y}%`}
                      x2={`${target.x}%`}
                      y2={`${target.y}%`}
                      stroke="url(#lineGrad)"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.3 }}
                      transition={{ duration: 1 }}
                    />
                  );
                })
              ))}
            </svg>

            {/* Nodes */}
            {currentLayerData.nodes.map((node) => {
              const isCurrent = node.status === "current";
              const isOccupied = node.occupied || node.status === "occupied";
              const isAvailable = currentNode?.connections.includes(node.id) || false;

              return (
                <div
                  key={node.id}
                  className="absolute"
                  style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
                >
                  <motion.div
                    className="relative group"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={isAvailable ? { scale: 1.15 } : {}}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                      {node.name}
                    </div>

                    {/* Node Circle */}
                    <button
                      disabled={!isAvailable && !isCurrent}
                      onClick={() => handleMoveToNode(node.id)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${
                        isCurrent
                          ? "bg-blue-600 border-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.5)] rotate-45"
                          : isOccupied
                            ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-400"
                            : isAvailable
                              ? "bg-slate-800 border-blue-500/40 text-blue-400 cursor-pointer hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                              : "bg-slate-950 border-slate-800 text-slate-700 cursor-default"
                      }`}
                    >
                      <div className={isCurrent ? "-rotate-45" : ""}>
                        {getNodeIcon(node.type, isCurrent || isAvailable)}
                      </div>
                    </button>

                    {/* Available Ripple */}
                    {isAvailable && (
                      <div className="absolute inset-0 -z-10 bg-blue-500/20 rounded-2xl animate-ping" />
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Action Panel */}
        <div className="w-96 bg-slate-900/40 backdrop-blur-xl border-l border-white/5 flex flex-col z-20">
          <div className="p-8 border-b border-white/5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Rocket className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-white">Node Briefing</h2>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Sector Analysis Report</p>
          </div>

          <div className="flex-grow p-8 flex flex-col">
            <div className="flex-grow flex flex-col items-center justify-center text-center">
              {!currentNode ? (
                <p className="text-sm text-slate-500">無當前探險節點數據</p>
              ) : (
                <motion.div
                  key={currentNode.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-2xl ${
                    currentNode.type === "boss" ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}>
                    {getNodeIcon(currentNode.type, true, true)}
                  </div>

                  <h3 className="text-2xl font-black text-white mb-2">{currentNode.name}</h3>
                  <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 border border-white/5">
                    Type: {currentNode.type.replace("_", " ")}
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed max-w-[240px] mb-8">
                    {getNodeDescription(currentNode.type)}
                  </p>

                  <div className="space-y-4 w-full">
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Potion Limit</div>
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-bold text-sm">{potionUsage}/{effectiveMaxPotionUsage}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Hazard Level</div>
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                          <span className="font-bold text-sm">{currentLayer * 10}%</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveAction("recruit")}
                      className="w-full group bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 font-bold py-3 rounded-2xl transition-all border border-indigo-500/20 flex items-center justify-center gap-2 mb-3"
                    >
                      <Diamond className="w-4 h-4" />
                      <span>RECRUIT ELVES</span>
                    </button>

                    <button
                      onClick={() => handleEngage()}
                      className="w-full group bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 overflow-hidden relative"
                    >
                      <span className="relative z-10">ENGAGE NODE</span>
                      <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer Notice */}
            <div className="mt-auto pt-6 border-t border-white/5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                <Shield className="w-3 h-3" /> System Buff: {getEquipName()} Active
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecruitCard({ tier, cost, color, textColor, onRecruit }: { tier: string, cost: number, color: string, textColor: string, onRecruit: () => void }) {
  return (
    <div className={`p-6 rounded-[24px] border bg-gradient-to-br ${color} flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-[0.98]`}>
      <div className="mb-4">
        <div className={`text-3xl font-black ${textColor} mb-1`}>{tier}</div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Recruit Order</div>
      </div>
      <button
        onClick={onRecruit}
        className={`w-full py-3 ${cost > 0 ? "bg-white text-slate-900" : "bg-slate-800 text-white"} font-black rounded-xl text-sm transition-all shadow-lg`}
      >
        {cost > 0 ? `${cost} 鑽招募` : "免費招募"}
      </button>
    </div>
  );
}

function ShopItem({ name, desc, cost, icon, onBuy }: { name: string, desc: string, cost: number, icon: React.ReactNode, onBuy: () => void }) {
  return (
    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-amber-500/30 transition-colors group">
      <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl group-hover:bg-amber-500/20 transition-colors">
        {icon}
      </div>
      <div className="flex-grow">
        <div className="font-bold text-slate-200">{name}</div>
        <div className="text-[10px] text-slate-500">{desc}</div>
      </div>
      <button
        onClick={onBuy}
        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl transition-all active:scale-95"
      >
        {cost} 豆
      </button>
    </div>
  );
}

function StatItem({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 opacity-70">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">{label}</span>
      </div>
      <span className={`font-black text-lg ${color}`}>{value}</span>
    </div>
  );
}

function getNodeIcon(type: NodeType, active: boolean, large: boolean = false) {
  const size = large ? "w-10 h-10" : "w-5 h-5";
  switch (type) {
    case "combat": return <Rocket className={`${size} ${active ? "text-blue-400" : "text-slate-600"}`} />;
    case "elite": return <ShieldAlert className={`${size} ${active ? "text-rose-500" : "text-slate-600"}`} />;
    case "boss": return <Skull className={`${size} ${active ? "text-red-500" : "text-slate-600"}`} />;
    case "event_chance": return <Sparkles className={`${size} ${active ? "text-emerald-400" : "text-slate-600"}`} />;
    case "shop": return <Building2 className={`${size} ${active ? "text-amber-400" : "text-slate-600"}`} />;
    case "bank": return <Coins className={`${size} ${active ? "text-yellow-400" : "text-slate-600"}`} />;
    case "heal": return <Tent className={`${size} ${active ? "text-green-400" : "text-slate-600"}`} />;
    default: return <MapIcon className={`${size}`} />;
  }
}

function getNodeDescription(type: NodeType) {
  switch (type) {
    case "combat": return "星際海盜的巡邏小隊，是檢驗隊伍實力的好機會。";
    case "elite": return "遭遇強大的虛空精英，獲勝可獲得更高級的招募令與裝備。";
    case "boss": return "該星系的守護者，擊敗它以進入更高維度的空間。";
    case "event_chance": return "偵測到未知文明的遺傳訊號，可能隱藏著意想不到的驚喜。";
    case "shop": return "宇宙商人的流浪商站，可以用賽爾豆購買各類物資。";
    case "heal": return "提供短暫歇息的空間站，可修復精靈傷勢或補給燃料。";
    default: return "未知的星際節點。";
  }
}
