import { BattleEndDialog } from "./BattleEndDialog";
import React, { useState, useContext, useEffect, useMemo, useRef } from "react";
import { ElfReadOnlyProfile } from "./ElfReadOnlyProfile";
import { createPortal } from "react-dom";
import { 
  Shield, 
  Sword, 
  Activity, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare, 
  Zap, 
  TrendingUp, 
  Maximize2, 
  RotateCcw, 
  Copy,
  Play, 
  Pause,
  Layout,
  Cpu,
  Monitor,
  FlaskConical,
  Star,
  BarChart2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { BattleContext } from "./BattleScreen";
import { TurnDamageStats } from "./BattleManager";
import { DraggableResizablePanel } from "./DraggableResizablePanel";
import { computeDefaultLayout, fitsArea, LAYOUT_VERSION } from "../battle/layout";
import { StatusBadgePanel } from "./StatusBadgePanel";
import { StatStagePanel } from "./StatStagePanel";
import { getMaxPp, getStatuses } from "../utils/battleHelpers";
import { computeHitChance } from "../effects/genericSkillText";
import { ShieldBarrierPanel } from "./ShieldBarrierPanel";
import { Elf, Skill, BattleLog, BattleItem } from "../types";
import { BattleEffectViewModel, buildEffectViewModels, describeEffectMeta } from "../battle/effectViewModel";
import { getHpBarColor } from "./BattleComponents";
import { StatusInspector } from "./StatusInspector";
import { getTypeMatchup, getAttributeBadgeColor, getEffectiveBody } from "../utils/statCalculator";
import { battleSpriteProfile, battleSpriteScale } from "../battle/seerAssets";
import { ElfAvatar, TypeIcon, ChainImage } from "./SeerImages";
import { isAliveBySurvivalRule } from "../battle/survivalRules";
import { statusVisual, buffIconFor, stageDesc, STAT_FULL } from "../battle/effectIcons";
import { markAppliesToElf } from "../battle/marks";
import { effectLines, formatEffectText } from "../utils/descFormat";
import { StatusRegistry } from "../effects/statusRegistry";
import { EFFECT_CATALOG } from "../data/effectCatalog";
import { BATTLE_ITEMS, ITEM_CATEGORIES, getItemCategory, ItemCategory, isZeroPpExempt, isElfSkillSelectionDisabled } from "../utils/battleHelpers";

interface BattleScreenUIProps {
  specialMode?: "destiny" | "interstellar";
  onSkillSelect: (side: "p1" | "p2", skill: Skill) => void;
  onSwitchElf: (side: "p1" | "p2", index: number) => void;
  onUseItem: (side: "p1" | "p2", item: BattleItem) => void;
  onReset: () => void;
  onBackToMenu: () => void;
  onAutoBattleToggle: () => void;
  activeSkillAnim: any;
  floatingDamagePopups: any[];
  consoleShake: any;
  damageDealt: Record<string, number>;
}

const COLORS = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

const DEFAULT_P1_LAYOUT = { pos: { x: 59.6, y: -5.2 }, size: { width: 636.8, height: 400 }, opacity: 0.95, scale: 1 };
const DEFAULT_P2_LAYOUT = { pos: { x: 734.8, y: -3.6 }, size: { width: 598.4, height: 406.4 }, opacity: 0.95, scale: 1.1 };
const DEFAULT_TACTICAL_LAYOUT = { pos: { x: 161.2, y: 414 }, size: { width: 1199.2, height: 320 }, opacity: 0.95, scale: 1.1 };

const COUNTER_LABELS: Record<string, string> = {
      marsmechamode: "當前裝載機甲",
      marsreformactivemode: "共鳴組合模式",
      marsenergy: "主充能核心",
      marspower: "核心超載係數",
      p1delufatalresistturns: "致死防護能量",
      p2delufatalresistturns: "致死防護能量",
      fatalresistturns: "不屈守護回合",
      opeiacombobonus: "蟲印共鳴疊加",
      opeiaskilltypesused: "已用技能類型型態",
      roundcount: "已歷經回合",
      actioncount: "累計出手次數",
      damageinflicted: "累計造成傷害",
      damagetaken: "累計承受傷害",
      healcount: "回復施展計數"
    };


const LOG_RENDER_LIMIT = 150;
const PHASE_LABEL: Record<string, string> = {
  p1_select: "選擇指令", p2_select: "對手選擇", resolving: "結算中",
  forced_switch_p1: "請換人", forced_switch_p2: "對手換人", forced_switch_both: "雙方換人", game_over: "戰鬥結束",
};

export function BattleScreenUI(props: BattleScreenUIProps) {
  const battle = useContext(BattleContext);
  if (!battle) return null;

  const { 
    p1, p2, p1Team, p2Team, turnNumber, logs, phase, isAutoBattle, 
    p1ActiveIndex, winner,
    p1SelectedSkill, p1LastDamage, p2LastDamage, lastDamage, p1TurnStats, p2TurnStats,
    p1StartHp, p2StartHp, lastActionInfo,
    damageDealt, p1Marks, p2Marks, p1Timers, p2Timers
  } = battle;
  // 本地對戰畫面以 P1 為己方視角：魘味只改顯示，不觸碰戰鬥狀態資料。
  const disguiseBattleStates = Object.entries(getStatuses(p1) || {}).some(([name, turns]) =>
    (name === '魘味' || name === '魘昧') && Number(turns) > 0
  );

  // 防卡頓：傷害圖表按 damageDealt 緩存，避免每 effect 重算重繪（recharts 整圖重渲染是卡頓主因之一）。
  const chartData = useMemo(() => Object.entries(damageDealt || {}).map(([name, value]) => ({
    name,
    value: Number(value)
  })).filter(d => d.value > 0), [damageDealt]);

  const totalDamage = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);

  const [tacticalTab, setTacticalTab] = useState<"SKILLS" | "TEAM" | "ITEMS" | "EFFECTS">("SKILLS");
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null);
  const [hoveredSkillAnchor, setHoveredSkillAnchor] = useState<{ x: number; y: number; top?: number; bottom?: number } | null>(null);
  const [hoveredSoulMark, setHoveredSoulMark] = useState<{name: string, desc: string} | null>(null);
  const [modalContent, setModalContent] = useState<{ title: string; content: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showResist, setShowResist] = useState<Record<"p1" | "p2", boolean>>({ p1: false, p2: false });
  const [showTurnStats, setShowTurnStats] = useState<Record<"p1" | "p2", boolean>>({ p1: false, p2: false });
  const [showStatStages, setShowStatStages] = useState<Record<"p1" | "p2", boolean>>({ p1: true, p2: true });
  const [showShields, setShowShields] = useState<Record<"p1" | "p2", boolean>>({ p1: true, p2: true });

  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [selectedElfDetail, setSelectedElfDetail] = useState<{ elf: Elf; side: "p1" | "p2"; idx: number } | null>(null);

  const DEFAULT_SECTION_VISIBILITY = {
    turnStats: true,
    statStages: true,
    shieldBarrier: true,
    statusAndImmunity: true,
    turnEffects: true,
    countEffects: true,
    marks: true,
  };

  const SECTION_LABELS: Record<string, string> = {
    turnStats: "本回合統計",
    statStages: "能力等級狀態",
    shieldBarrier: "精靈護盾與護罩",
    statusAndImmunity: "異常狀態與免疫",
    turnEffects: "回合類與其他計時",
    countEffects: "次數效果",
    marks: "印記與特質",
  };

  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('seer_section_visibility');
      if (saved) return { ...DEFAULT_SECTION_VISIBILITY, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_SECTION_VISIBILITY;
  });

  type DetailTab = "STATS" | "SHIELDS" | "STATUSES" | "MARKS" | "TIMERS" | "SUMMARY";
  const [panelTab, setPanelTab] = useState<Record<"p1" | "p2", DetailTab>>({ p1: "SUMMARY", p2: "SUMMARY" });

  useEffect(() => {
    try {
      localStorage.setItem('seer_section_visibility', JSON.stringify(sectionVisibility));
    } catch (e) {}
  }, [sectionVisibility]);

  // Auto-switch to TEAM tab when forced to switch
  useEffect(() => {
    if (phase === "forced_switch_p1" || phase === "forced_switch_both") {
      setTacticalTab("TEAM");
    }
  }, [phase]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 自訂佈局（拖曳/縮放/透明）：預設關閉，只能在「控制中心 → 戰鬥」開啟
  const [customLayout, setCustomLayout] = useState(() => { try { return localStorage.getItem('battleCustomLayout') === '1'; } catch { return false; } });
  const [cardOpen, setCardOpen] = useState<Record<"p1" | "p2", boolean>>({ p1: false, p2: false });
  const [logOpen, setLogOpen] = useState(false);
  const [itemCat, setItemCat] = useState<ItemCategory | "all">("all");
  const [spriteMode, setSpriteMode] = useState<"show" | "dim" | "hide">(() => { try { return (localStorage.getItem("battleSpriteMode") as any) || "show"; } catch { return "show"; } });
  useEffect(() => { try { localStorage.setItem("battleSpriteMode", spriteMode); } catch {} }, [spriteMode]);
  const [hudOpacity, setHudOpacity] = useState(() => parseFloat(localStorage.getItem('hudOpacity') || "0.95"));
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, logOpen, sidebarOpen]);
  
  // Draggable panels state
  const [p1Panel, setP1Panel] = useState(() => JSON.parse(localStorage.getItem('p1Panel') || JSON.stringify(DEFAULT_P1_LAYOUT)));
  const [p2Panel, setP2Panel] = useState(() => JSON.parse(localStorage.getItem('p2Panel') || JSON.stringify(DEFAULT_P2_LAYOUT)));
  const [tacticalPanel, setTacticalPanel] = useState(() => JSON.parse(localStorage.getItem('tacticalPanel') || JSON.stringify(DEFAULT_TACTICAL_LAYOUT)));

  useEffect(() => {
    localStorage.setItem('p1Panel', JSON.stringify(p1Panel));
    localStorage.setItem('p2Panel', JSON.stringify(p2Panel));
    localStorage.setItem('tacticalPanel', JSON.stringify(tacticalPanel));
    localStorage.setItem('hudOpacity', hudOpacity.toString());
  }, [p1Panel, p2Panel, tacticalPanel, hudOpacity]);

  // ── 布局合理化：依實際戰鬥區域計算預設布局；舊版布局或超出畫面的面板自動重排
  const battleRootRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = battleRootRef.current;
    if (!el) return;
    const update = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => { ro?.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  const defaultLayout = area.w > 0 ? computeDefaultLayout(area.w, area.h, hudOpacity) : null;
  const resetAllPanels = () => {
    if (!defaultLayout) return;
    setP1Panel(defaultLayout.p1); setP2Panel(defaultLayout.p2); setTacticalPanel(defaultLayout.tactical);
  };
  useEffect(() => {
    if (!defaultLayout) return;
    let version: string | null = null;
    try { version = localStorage.getItem('battleLayoutVersion'); } catch {}
    if (version !== LAYOUT_VERSION) {
      resetAllPanels();
      try { localStorage.setItem('battleLayoutVersion', LAYOUT_VERSION); } catch {}
      return;
    }
    if (!fitsArea(p1Panel, area.w, area.h)) setP1Panel(defaultLayout.p1);
    if (!fitsArea(p2Panel, area.w, area.h)) setP2Panel(defaultLayout.p2);
    if (!fitsArea(tacticalPanel, area.w, area.h)) setTacticalPanel(defaultLayout.tactical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.w, area.h]);

  useEffect(() => {
    const handleLayoutUpdate = () => {
      try { setCustomLayout(localStorage.getItem('battleCustomLayout') === '1'); } catch {}
      setP1Panel(JSON.parse(localStorage.getItem('p1Panel') || JSON.stringify(DEFAULT_P1_LAYOUT)));
      setP2Panel(JSON.parse(localStorage.getItem('p2Panel') || JSON.stringify(DEFAULT_P2_LAYOUT)));
      setTacticalPanel(JSON.parse(localStorage.getItem('tacticalPanel') || JSON.stringify(DEFAULT_TACTICAL_LAYOUT)));
      setHudOpacity(parseFloat(localStorage.getItem('hudOpacity') || "0.95"));
      // 控制中心按「重置 UI 佈局」時會把版本清掉 → 依目前畫面重新計算
      let version: string | null = null;
      try { version = localStorage.getItem('battleLayoutVersion'); } catch {}
      if (version !== LAYOUT_VERSION) {
        const el = battleRootRef.current;
        if (el) {
          const d = computeDefaultLayout(el.clientWidth, el.clientHeight, parseFloat(localStorage.getItem('hudOpacity') || "0.95"));
          setP1Panel(d.p1); setP2Panel(d.p2); setTacticalPanel(d.tactical);
          try { localStorage.setItem('battleLayoutVersion', LAYOUT_VERSION); } catch {}
        }
      }
    };
    window.addEventListener('battle-layout-update', handleLayoutUpdate);
    return () => window.removeEventListener('battle-layout-update', handleLayoutUpdate);
  }, []);


  const getDynamicEffects = (side: "p1" | "p2", elf: Elf) => {
    const isP1 = side === "p1";
    const dynamicEffects: any[] = [];

    // 1. 異常狀態免疫 (Status Immunities)
    if (elf.statusImmuneTurns && elf.statusImmuneTurns > 0) {
      dynamicEffects.push({ catalogId: 'immune_status_turns', remainingTurns: elf.statusImmuneTurns });
    }
    // 2. 屬性技能封鎖 (Attribute Skills Sealed)
    if (elf.cannotUseAttrSkillsTurns && elf.cannotUseAttrSkillsTurns > 0) {
      dynamicEffects.push({ catalogId: 'seal_support_turns', remainingTurns: elf.cannotUseAttrSkillsTurns });
    }
    // 3. 攻擊技能失效 (Attack Skills Sealed)
    if (elf.cannotUseAttackSkillsTurns && elf.cannotUseAttackSkillsTurns > 0) {
      dynamicEffects.push({ catalogId: 'prop_invalid_turns', remainingTurns: elf.cannotUseAttackSkillsTurns });
    }
    // 4. 攻擊傷害免疫 (Damage Negation)
    if (elf.isAttackImmune) {
      dynamicEffects.push({ catalogId: 'negate_attack_turns', remainingTurns: 1 });
    }
    // 5. 機械護盾 (Active Shields)
    if (elf.shield && elf.shield > 0) {
      dynamicEffects.push({ catalogId: 'shield_active', remainingTurns: 1, stacks: elf.shield, note: `剩餘護盾吸收值: ${elf.shield}` });
    }
    // 6. 戰術護罩 (Active Barriers)
    if (elf.barrier && elf.barrier > 0) {
      dynamicEffects.push({ catalogId: 'barrier_active', remainingTurns: 1, stacks: elf.barrier, note: `剩餘護罩吸收值: ${elf.barrier}` });
    }

    // 7. 馬爾修斯械印機甲共鳴解析
    if (elf.name === '變革·馬爾修斯') {
      const registryState = isP1 ? battle.p1RegistryState : battle.p2RegistryState;
      const activeMode = registryState?.marsMechaMode || registryState?.marsReformActiveMode || 'speed';
      if (activeMode === 'defense' || activeMode === 'wall' || activeMode === '堅壁') {
        dynamicEffects.push({ catalogId: 'mars_record_paralyzed', remainingTurns: 1, note: '【堅壁機甲】護航：每回合啟動⅓最大生命護盾與護罩，非真傷減半，回合結束高額修復與被動反傷。' });
      } else if (activeMode === 'speed' || activeMode === '極速') {
        dynamicEffects.push({ catalogId: 'star_rule', remainingTurns: 1, note: '【極速機甲】護航：自身先制等級額外+2，先出手時壓制對手全屬性-1（若提速則翻倍），後手封鎖對方先制。' });
      } else if (activeMode === 'destroy' || activeMode === '毀滅') {
        dynamicEffects.push({ catalogId: 'demon_curse', remainingTurns: 1, note: '【毀滅機甲】護航：所有攻擊技能威力提升100%-170%。出手後判定斬殺或造成30%生命汲取。' });
      }
    }
    return dynamicEffects;
  };

  const renderPopups = (side: "p1" | "p2") => (
                <AnimatePresence>
                  {(battle.floatingDamagePopups || props.floatingDamagePopups || [])
                    .filter((p: any) => p.side === side && (!p.elfId || p.elfId === ((side === 'p1' ? p1 : p2).battleId || (side === 'p1' ? p1 : p2).id)))
                    .map((pop: any) => {
                      const isAbsorb = pop.type === 'absorb' || pop.label?.includes('汲取');
                      const isTrue = pop.type === 'true' || pop.type === 'true_damage' || isAbsorb;
                      const isPink = pop.type === 'fixed' || pop.type === 'percent' || pop.type === 'fixed_damage' || pop.type === 'percent_damage';
                      const isHeal = pop.type === 'heal' || pop.type === 'adjust_up';
                      const isAdjustment = pop.type === 'adjust_up' || pop.type === 'adjust_down';

                      const isMissLike = pop.type === 'notice' || pop.type === 'miss' || pop.type === 'invalid' || pop.type === 'addInvalid';

                      return (
                        <motion.div
                          key={pop.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ 
                            opacity: 1, 
                            y: 0,
                          }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.12, ease: "easeOut" }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/70"
                          data-battle-popup={pop.type}
                          data-presentation-id={pop.id}
                          data-elf-id={pop.elfId}
                        >
                          <span className="text-xs font-bold text-slate-300">{pop.isCrit ? '暴擊 ' : ''}{pop.label || ''}</span>
                          <span className={`text-2xl font-black ${isHeal ? 'text-green-400' : isTrue ? 'text-white' : isPink ? 'text-pink-400' : isMissLike || isAdjustment ? 'text-slate-200' : 'text-red-400'}`}
                            style={isHeal ? { textShadow: '-1px -1px 0 #eab308, 1px -1px 0 #eab308, -1px 1px 0 #eab308, 1px 1px 0 #eab308' } : undefined}>{pop.text}</span>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
  );

  const renderElfDetails = (side: "p1" | "p2", elf: Elf) => {
    const isP1 = side === "p1";
    const dynamicEffects = getDynamicEffects(side, elf);
    const effectViews = buildEffectViewModels(
      (isP1 ? p1Marks : p2Marks) || [],
      (isP1 ? p1Timers : p2Timers) || [],
      elf.battleId || elf.id,
    );
    const renderEffectGroup = (effects: BattleEffectViewModel[], emptyHint: string) => (
      effects.length ? (
        <div className="flex flex-wrap gap-1">
          {effects.map(effect => (
            <button
              type="button"
              key={effect.id}
              onClick={() => setModalContent({ title: effect.label, content: describeEffectMeta(effect) })}
              className={`px-1.5 py-0.5 rounded border text-[9px] font-bold transition-colors hover:brightness-125 ${
                effect.polarity === "negative"
                  ? "bg-rose-950/60 border-rose-500/30 text-rose-200"
                  : effect.category === "count"
                    ? "bg-violet-950/60 border-violet-500/30 text-violet-200"
                    : "bg-cyan-950/60 border-cyan-500/30 text-cyan-200"
              }`}
            >
              {effect.shortLabel} {effect.value}{effect.unit}
            </button>
          ))}
        </div>
      ) : <span className="text-[9px] text-slate-600">{emptyHint}</span>
    );
    return (
      <div className="space-y-3">
            {/* 資訊分類按鈕列 (Categorized Info Tabs) */}
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 border-b border-slate-800/80 mb-2 select-none">
              {[
                { key: 'SUMMARY', label: '⚔️ 統計' },
                { key: 'STATS', label: '📊 能力' },
                { key: 'SHIELDS', label: '🛡️ 防護' },
                { key: 'STATUSES', label: '🔮 異常與抗性' },
                { key: 'MARKS', label: '✦ 印記' },
                { key: 'TIMERS', label: '◷ 計時效果' },
              ].map((t) => {
                const isActive = panelTab[side] === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setPanelTab((prev) => ({ ...prev, [side]: t.key as DetailTab }))}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                        : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {panelTab[side] === 'SUMMARY' && sectionVisibility.turnStats && (() => {
              const stats = side === 'p1' ? p1TurnStats : p2TurnStats;
              const typeConfig: Record<string, { label: string; color: string }> = {
                skill:   { label: '⚔️技能傷害', color: 'text-red-300 bg-amber-950/80 border border-red-700/80' },
                crit:    { label: '💥致命一擊', color: 'text-amber-200 bg-red-950/90 border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' },
                fixed:   { label: '💗固定傷害', color: 'text-pink-300 bg-pink-950/80 border border-pink-700/80' },
                percent: { label: '💗百分比傷害', color: 'text-pink-300 bg-pink-950/80 border border-pink-700/80' },
                true:    { label: '⚡真實傷害', color: 'text-white bg-slate-900 border border-slate-200 shadow-[0_0_8px_rgba(255,255,255,0.6)]' },
                absorb:  { label: '⚡真實傷害', color: 'text-white bg-slate-900 border border-slate-200 shadow-[0_0_8px_rgba(255,255,255,0.6)]' },
                heal:    { label: '💚回復體力', color: 'text-emerald-300 bg-emerald-950/80 border border-emerald-700/80' },
                adjust_up:   { label: '🔄體力調整', color: 'text-cyan-200 bg-cyan-950/80 border border-cyan-700/80' },
                adjust_down: { label: '🔄體力調整', color: 'text-cyan-200 bg-cyan-950/80 border border-cyan-700/80' },
              };
              const lastCfg = stats?.lastType ? typeConfig[stats.lastType] : null;
              const lastValue = stats?.lastAmount !== undefined ? stats.lastAmount : 0;

              return (
                <div className="mb-2">
                  <div
                    onClick={() => setShowTurnStats(prev => ({ ...prev, [side]: !prev[side] }))}
                    className="flex justify-between items-center mb-1 cursor-pointer hover:bg-slate-800/40 p-1 rounded transition-colors border border-transparent hover:border-slate-800"
                  >
                    <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest flex items-center gap-1 select-none">
                      ⚔️ 本回合統計 {showTurnStats[side] ? "▼" : "▶"}
                    </span>
                    {lastCfg && lastValue > 0 && (
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black tracking-tight ${lastCfg.color}`}>
                        {lastCfg.label} {stats.lastType === 'heal' || stats.lastType === 'adjust_up' ? `+${lastValue}` : `-${lastValue}`}
                      </span>
                    )}
                  </div>

                  {showTurnStats[side] && (
                    <div className="border border-slate-800 rounded-lg bg-slate-950/90 p-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] select-none">
                      <div className="text-red-400 flex justify-between"><span>技能傷害:</span><span className="font-bold">{stats?.skillDmg || 0}</span></div>
                      <div className="text-pink-400 flex justify-between"><span>固定傷害:</span><span className="font-bold">{stats?.fixedDmg || 0}</span></div>
                      <div className="text-pink-400 flex justify-between"><span>百分比:</span><span className="font-bold">{stats?.percentDmg || 0}</span></div>
                      <div className="text-slate-100 flex justify-between"><span>真實傷害:</span><span className="font-bold">{stats?.trueDmg || 0}</span></div>
                      <div className="text-emerald-400 flex justify-between"><span>體力回復:</span><span className="font-bold">{stats?.heal || 0}</span></div>
                      <div className="text-cyan-400 flex justify-between"><span>淨變化:</span><span className="font-bold">{stats?.hpChange > 0 ? '+' : ''}{stats?.hpChange || 0}</span></div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            <div className="space-y-3">
              {/* Stat Stage Panel */}
              {panelTab[side] === 'STATS' && sectionVisibility.statStages && (
                <div>
                  <StatStagePanel
                    elf={elf}
                    disguiseAsNightmare={disguiseBattleStates}
                    isExpanded={showStatStages[side]}
                    onToggleExpand={() => setShowStatStages(prev => ({ ...prev, [side]: !prev[side] }))}
                  />
                </div>
              )}

              {/* Shield and Barrier Panel */}
              {panelTab[side] === 'SHIELDS' && sectionVisibility.shieldBarrier && (
                <div>
                  <ShieldBarrierPanel
                    elf={elf}
                    isExpanded={showShields[side]}
                    onToggleExpand={() => setShowShields(prev => ({ ...prev, [side]: !prev[side] }))}
                  />
                </div>
              )}

              {panelTab[side] === 'STATUSES' && sectionVisibility.statusAndImmunity && (
                <div>
                    <span className="text-[10px] text-rose-500 font-black uppercase tracking-widest block mb-1">異常狀態與免疫:</span>
                    <StatusBadgePanel elf={elf} otherEffects={dynamicEffects} disguiseAbnormalStatuses={disguiseBattleStates} categoryFilter={["CONTROL", "WEAKENING", "RESTRICTIVE", "EVOLUTIONARY", "AUXILIARY", "BOSS_ONLY"]} emptyHint="無異常狀態" />
                </div>
              )}

              {/* Resistances Summary */}
              {panelTab[side] === 'STATUSES' && elf.resistances && (
                <div>
                  <div 
                    onClick={() => setShowResist(prev => ({ ...prev, [side]: !prev[side] }))}
                    className="flex justify-between items-center mb-1 cursor-pointer hover:bg-slate-800/40 p-1 rounded transition-colors border border-transparent hover:border-slate-800"
                  >
                    <span className="text-[10px] text-teal-400 font-black uppercase tracking-widest flex items-center gap-1 select-none">
                      🛡️ 抗性配置 {showResist[side] ? "▼" : "▶"}
                    </span>
                    {elf.resistances.statusResist?.allImmune && (
                      <span className="text-[8px] px-1 bg-teal-950/40 border border-teal-800/30 rounded text-teal-300 font-bold scale-90 origin-right select-none">
                        5% 全免已啟動
                      </span>
                    )}
                  </div>
                  
                  {/* 3x3 Grid Table */}
                  {showResist[side] && (
                    <div className="border border-slate-800 rounded bg-slate-950/70 overflow-hidden font-mono text-[9px]">
                      {/* Table Header */}
                      <div className="grid grid-cols-3 bg-slate-900/90 border-b border-slate-800 text-slate-400 font-black py-0.5 px-1.5 text-center tracking-wider scale-95">
                        <div>傷害抗性</div>
                        <div>控制抗性</div>
                        <div>弱化抗性</div>
                      </div>
                      
                      {/* Table Rows */}
                      {(() => {
                        const controlSlots = (elf.resistances.statusResist?.slots || []).filter(s => s.category === 'control' && s.status);
                        const weakeningSlots = (elf.resistances.statusResist?.slots || []).filter(s => s.category === 'weakening' && s.status);
                        const bonus = elf.resistances.statusResist?.allImmune ? 5 : 0;
                        
                        const rowData = [
                          {
                            dmg: `固傷 ${elf.resistances.damageResist?.fixed || 0}%`,
                            ctrl: controlSlots[0] ? `${controlSlots[0].status} ${controlSlots[0].rate + bonus}%` : "無",
                            weak: weakeningSlots[0] ? `${weakeningSlots[0].status} ${weakeningSlots[0].rate + bonus}%` : "無"
                          },
                          {
                            dmg: `百分比 ${elf.resistances.damageResist?.percent || 0}%`,
                            ctrl: controlSlots[1] ? `${controlSlots[1].status} ${controlSlots[1].rate + bonus}%` : "無",
                            weak: weakeningSlots[1] ? `${weakeningSlots[1].status} ${weakeningSlots[1].rate + bonus}%` : "無"
                          },
                          {
                            dmg: `致命 ${elf.resistances.damageResist?.crit || 0}%`,
                            ctrl: controlSlots[2] ? `${controlSlots[2].status} ${controlSlots[2].rate + bonus}%` : "無",
                            weak: weakeningSlots[2] ? `${weakeningSlots[2].status} ${weakeningSlots[2].rate + bonus}%` : "無"
                          }
                        ];
                        
                        return rowData.map((row, idx) => (
                          <div key={idx} className="grid grid-cols-3 border-b border-slate-900/50 last:border-0 py-0.5 px-1.5 text-center text-slate-300">
                            <div className="text-cyan-400 font-medium">{row.dmg}</div>
                            <div className={row.ctrl !== "無" ? "text-purple-400" : "text-slate-600 font-normal"}>{row.ctrl}</div>
                            <div className={row.weak !== "無" ? "text-purple-400" : "text-slate-600 font-normal"}>{row.weak}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}
              
              {/* Registry States & Marks */}
              {panelTab[side] === 'MARKS' && sectionVisibility.marks && (() => {
                const registryState = isP1 ? battle.p1RegistryState : battle.p2RegistryState;
                const entries = Object.entries(registryState || {}).filter(([key, val]) => {
                  const lowerKey = key.toLowerCase();
                  return COUNTER_LABELS[lowerKey] !== undefined;
                });
                const marks = isP1 ? p1Marks : p2Marks;
                
                if (entries.length === 0 && (!marks || marks.length === 0)) return null;
                return (
                  <div>
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest block mb-1">印記:</span>
                    <div className="flex flex-wrap gap-1">
                      {marks && marks.map((mark) => (
                        <button
                          key={mark.id}
                          onClick={() => setModalContent({ title: mark.name, content: mark.description })}
                          className="px-1.5 py-0.5 bg-amber-950/40 border border-amber-500/30 rounded flex items-center gap-1.5 hover:bg-amber-900/40 transition-colors cursor-pointer"
                        >
                          <span className="text-[9px] text-amber-300 font-black">{mark.displayChar}</span>
                          <span className="text-[10px] font-black text-white">{mark.count}</span>
                        </button>
                      ))}
                      {entries.map(([key, val]) => {
                        const lowerKey = key.toLowerCase();
                        let displayVal = String(val);
                        if (lowerKey === 'marsmechamode' || lowerKey === 'marsreformactivemode') {
                          if (val === 'speed') displayVal = '極速機甲 ⚡';
                          if (val === 'destroy') displayVal = '毀滅機甲 💥';
                          if (val === 'wall' || val === 'defense' || val === '堅壁') displayVal = '堅壁機甲 ⚙️';
                        }
                        return (
                          <div key={key} className="px-1.5 py-0.5 bg-cyan-950/40 border border-cyan-500/20 rounded flex items-center gap-1.5">
                            <span className="text-[9px] text-cyan-300 font-black">{COUNTER_LABELS[lowerKey]}</span>
                            <span className="text-[10px] font-black text-white">{displayVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          {panelTab[side] === 'TIMERS' && (sectionVisibility.turnEffects || sectionVisibility.countEffects) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-800/50 pt-3">
               {sectionVisibility.turnEffects && (
                 <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-black uppercase">回合類效果:</span>
                    {renderEffectGroup(effectViews.filter(effect => effect.category === "turn"), "無回合類效果")}
                 </div>
               )}
               {sectionVisibility.turnEffects && (
                 <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-black uppercase">其他計時:</span>
                    {renderEffectGroup(effectViews.filter(effect => effect.category === "round"), "無其他計時")}
                 </div>
               )}
               {sectionVisibility.countEffects && (
                 <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-black uppercase">次數效果:</span>
                    {renderEffectGroup(effectViews.filter(effect => effect.category === "count"), "無次數效果")}
                 </div>
               )}
            </div>
          )}
      </div>
    );
  };

  const renderLogList = () => (
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] custom-scrollbar">
                {logs.length > LOG_RENDER_LIMIT && (
                  <div className="text-center text-slate-500 text-[10px]">（僅顯示最近 {LOG_RENDER_LIMIT} 筆）</div>
                )}
                {logs.slice(-LOG_RENDER_LIMIT).map((log, idx) => (
                   <div key={logs.length - Math.min(logs.length, LOG_RENDER_LIMIT) + idx} className={`p-2 rounded border border-l-4 ${
                     log.type === "damage" ? "border-rose-900/30 border-l-rose-500 bg-rose-950/10 text-rose-200" :
                     log.type === "heal" ? "border-emerald-900/30 border-l-emerald-500 bg-emerald-950/10 text-emerald-200" :
                     log.type === "status" ? "border-amber-900/30 border-l-amber-500 bg-amber-950/10 text-amber-200" :
                     log.type === "effect" ? "border-indigo-900/30 border-l-indigo-500 bg-indigo-950/10 text-indigo-200" :
                     log.type === "system" ? "border-cyan-900/30 border-l-cyan-500 bg-cyan-950/10 text-cyan-200" :
                     log.type === "defeat" ? "border-slate-700 border-l-slate-400 bg-slate-800/40 text-slate-400 grayscale" :
                     log.type === "p1" ? "border-blue-900/30 border-l-blue-500 bg-blue-950/10 text-blue-100" :
                     log.type === "p2" ? "border-purple-900/30 border-l-purple-500 bg-purple-950/10 text-purple-100" :
                     "border-slate-800 border-l-slate-500 bg-slate-900/30 text-slate-300"
                   }`}>
                     <div className="flex justify-between items-center mb-1 opacity-60">
                        <span>TURN {log.turn}</span>
                        <span>{log.type?.toUpperCase()}</span>
                     </div>
                     <p className="leading-relaxed">{log.text}</p>
                   </div>
                ))}
              </div>
  );

  const renderSkillsLegacy = () => (
    <>
                  {tacticalTab === "SKILLS" && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-emerald-500" />
                        <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">
                          {phase === "p1_select" ? `玩家一 【${p1.name}】 請下達指令` : "等待系統響應中..."}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        {(() => {
                          const baseSkills = p1.skills || [];
                          // Reorder: 5th skill (index 4) first, then 0, 1, 2, 3
                          const displaySkills = baseSkills.length >= 5 
                            ? [baseSkills[4], baseSkills[0], baseSkills[1], baseSkills[2], baseSkills[3]]
                            : baseSkills;

                          return displaySkills.map((skill, idx) => {
                            const isUltimate = baseSkills.length >= 5 && skill.name === baseSkills[4].name;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (phase === "p1_select") props.onSkillSelect("p1", skill);
                                }}
                                onMouseEnter={(e) => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setHoveredSkillAnchor({ x: rect.left + rect.width / 2, y: rect.top, top: rect.top, bottom: rect.bottom });
                                  setHoveredSkill(skill);
                                }}
                                onMouseLeave={() => {
                                  setHoveredSkill(null);
                                  setHoveredSkillAnchor(null);
                                }}
                                className={`group relative flex flex-col bg-slate-900/60 border ${isUltimate ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-1 ring-amber-500/50 scale-[1.02]' : 'border-slate-800'} hover:border-cyan-500/60 rounded-xl p-3 transition-all hover:bg-slate-800 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] text-left disabled:opacity-40 disabled:cursor-not-allowed`}
                                disabled={phase !== "p1_select" || isElfSkillSelectionDisabled(p1) || ((skill.charge !== undefined ? skill.charge : skill.pp) <= 0 && !isZeroPpExempt(p1, skill, p2))}
                              >
                                {isUltimate && (
                                  <div className="absolute -top-2 -left-2 px-1.5 py-0.5 bg-gradient-to-r from-amber-600 to-yellow-600 rounded text-[8px] font-black text-white shadow-lg z-10 border border-amber-400/30 ">SIGNATURE</div>
                                )}
                                {/* 預備特殊印記/標記動態顯示區 (資料驅動，有標記物件時自動映射渲染，無標記時不佔用空間與顯示) */}
                                {skill.specialBadge && (
                                  <div className={`absolute -top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black shadow-lg z-10 border ${skill.specialBadge.bg || 'bg-purple-900/90'} ${skill.specialBadge.color || 'text-purple-200'} ${skill.specialBadge.border || 'border-purple-500/40'} ${skill.specialBadge.animate || ''}`}>
                                    {skill.specialBadge.text}
                                  </div>
                                )}
                                {skill.specialMarks?.map((mark, mIdx) => (
                                  <div
                                    key={mark.id || mIdx}
                                    className={`absolute -top-2 px-1.5 py-0.5 rounded text-[8px] font-black shadow-lg z-10 border ${mark.bg || 'bg-cyan-900/90'} ${mark.color || 'text-cyan-200'} ${mark.border || 'border-cyan-500/40'} ${mark.animate || ''}`}
                                    style={{ right: `${0.5 + mIdx * 2.2}rem` }}
                                  >
                                    {mark.text}
                                  </div>
                                ))}
                                <div className="flex justify-between items-start mb-2">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                    skill.category === '物理' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                    skill.category === '特殊' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  }`}>
                                    {skill.category || "攻擊"}
                                  </span>
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${getAttributeBadgeColor(skill.type === "--" ? "無屬性" : (skill.type || "無屬性"))} inline-flex items-center gap-1`}>
                                    <TypeIcon type={skill.type} size={13} showLabelWhenMissing={false} />{skill.type && skill.type !== "--" ? `${skill.type}` : "無屬性"}
                                  </span>
                                </div>
                                <h4 className={`font-black text-sm mb-2 group-hover:text-cyan-400 transition-colors line-clamp-1 ${isUltimate ? 'text-purple-100' : 'text-white'}`}>
                                  {skill.name}
                                </h4>
                                <div className="mt-auto flex justify-between items-center text-[10px] font-mono">
                                   <span className="text-slate-500 uppercase">
                                     {skill.category === "屬性" ? "技能屬性" : `威力: ${skill.power || 0}`}
                                   </span>
                                   {p1.name === "變革·馬爾修斯" ? (
                                     <span className={`font-black ${(skill.charge !== undefined ? skill.charge : skill.pp) <= 0 ? "text-rose-500" : "text-amber-500"}`}>充能: {skill.charge !== undefined ? skill.charge : skill.pp} ⚡</span>
                                   ) : (
                                     <span className={`font-black ${skill.pp <= 1 ? "text-rose-500" : "text-emerald-500"}`}>PP: {skill.pp}/{getMaxPp(skill, p1)}</span>
                                   )}
                                </div>
                                {p1SelectedSkill?.name === skill.name && (
                                   <div className={`absolute inset-0 border-2 ${isUltimate ? 'border-amber-500' : 'border-cyan-500'} rounded-xl pointer-events-none`} />
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>

                      {/* Skill Description Overlay - Removed from here to move to root */}
                    </>
                  )}
    </>
  );

  const renderTacticalOther = () => (
    <>
                  {tacticalTab === "TEAM" && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-cyan-500" />
                        <span className="text-xs font-black text-cyan-500 uppercase tracking-widest">點擊精靈頭像以進行切換 (消耗一回合)</span>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
                        {p1Team.map((elf, idx) => {
                          const isExtra = idx >= 6 || !!elf.isExtra;
                          const isDead = !elf || (!isAliveBySurvivalRule(elf.currentHp, elf.survivalRule) && !(elf.deathImmunity && elf.deathImmunity.deathImmuneTurns > 0));
                          const isDeathImmuneActive = !!(elf && elf.currentHp <= 0 && elf.deathImmunity && elf.deathImmunity.deathImmuneTurns > 0);
                          return (
                            <button
                              key={`p1-team-${idx}-${elf.name}`}
                              onClick={() => {
                                if (isExtra) {
                                  setSelectedElfDetail({ elf, side: "p1", idx });
                                } else if (phase === "p1_select" || phase.includes("forced_switch")) {
                                  props.onSwitchElf("p1", idx);
                                  setTacticalTab("SKILLS");
                                }
                              }}
                              onMouseEnter={() => {
                                if (elf.soulMark) {
                                  setHoveredSoulMark({ name: elf.soulMark.name, desc: elf.soulMark.description });
                                }
                              }}
                              onMouseLeave={() => setHoveredSoulMark(null)}
                              className={`group relative flex flex-col items-center bg-slate-900/60 border rounded-xl p-2.5 transition-all cursor-pointer
                                ${idx === p1ActiveIndex ? 'border-cyan-500 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.1)] opacity-100 grayscale-0' : isExtra ? 'border-amber-500/40 bg-amber-950/10 shadow-[0_0_10px_rgba(245,158,11,0.05)] hover:border-amber-400' : 'border-slate-800 hover:border-slate-600'} 
                                ${isDead || elf.isVanished ? 'opacity-40 grayscale' : ''}`}
                              disabled={!isExtra && (idx === p1ActiveIndex || isDead || (phase !== "p1_select" && !phase.includes("forced_switch")))}
                            >
                               <div className="w-12 h-12 mb-1.5 rounded-full overflow-hidden border border-cyan-500/40 bg-slate-900"><ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full flex items-center justify-center text-xl font-black text-slate-300" /></div>
                               <span className={`text-xs font-black mb-1 ${isExtra ? 'text-amber-400' : 'text-white'}`}>{elf.isConcealed ? "未知精靈" : elf.name}</span>
                               {!elf.isConcealed && <span className="mb-2 inline-flex items-center gap-1 text-xs text-slate-300"><TypeIcon type={elf.type} size={16} />{elf.type}</span>}
                               <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-1">
                                  <div className={`h-full ${getHpBarColor(elf.currentHp, elf.maxHp)}`} style={{ width: `${elf.maxHp > 0 ? (elf.currentHp / elf.maxHp) * 100 : 0}%` }} />
                               </div>
                               <span className="text-[9px] font-bold text-slate-500">{elf.currentHp}/{elf.maxHp}</span>
                               {idx === p1ActiveIndex && (
                                 <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-cyan-500 text-[8px] font-black text-white rounded rounded-bl-none">出場中</div>
                               )}
                               {isExtra && (
                                 <div className="absolute -top-1 -left-1 px-1.5 py-0.5 bg-amber-600 text-[8px] font-black text-white rounded rounded-br-none shadow-md ring-1 ring-amber-400/30">額外・不計勝負</div>
                               )}
                               {isDeathImmuneActive && !elf.isVanished && (
                                 <div className="absolute inset-0 bg-purple-950/40 rounded-xl flex items-center justify-center border border-purple-500/60 shadow-[inset_0_0_15px_rgba(168,85,247,0.3)] pointer-events-none">
                                   <span className="text-[10px] font-black text-purple-300 uppercase border border-purple-400 px-2 py-0.5 -rotate-12 tracking-widest">庇護中</span>
                                 </div>
                               )}
                               {elf.isVanished ? (
                                 <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center border border-purple-500/50 shadow-[inset_0_0_15px_rgba(147,51,234,0.3)]">
                                   <span className="text-[10px] font-black text-purple-400 uppercase border border-purple-400 px-2 py-0.5 -rotate-12 tracking-widest">消逝</span>
                                 </div>
                               ) : isDead ? (
                                 <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                                   <span className="text-[10px] font-black text-rose-500 uppercase border border-rose-500 px-2 py-0.5 -rotate-12">撤退</span>
                                 </div>
                               ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {tacticalTab === "ITEMS" && (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap" title="使用道具消耗一回合">
                        {[{ key: "all", label: "全部" }, ...ITEM_CATEGORIES].map(c => {
                          const n = c.key === "all" ? BATTLE_ITEMS.length : BATTLE_ITEMS.filter(it => getItemCategory(it) === c.key).length;
                          return (
                            <button key={c.key} onClick={() => setItemCat(c.key as any)} disabled={n === 0}
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors disabled:opacity-30 ${itemCat === c.key ? "bg-amber-500/20 text-amber-200 border-amber-500/60" : "bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200"}`}>
                              {c.label} <span className="opacity-60">{n}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
                        {BATTLE_ITEMS.filter(it => itemCat === "all" || getItemCategory(it) === itemCat).map((item, idx) => {
                          const cat = getItemCategory(item);
                          const tone = cat === "hp" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                            : cat === "pp" ? "text-sky-400 border-sky-500/30 bg-sky-500/10"
                            : cat === "cleanse" ? "text-violet-300 border-violet-500/30 bg-violet-500/10"
                            : cat === "hybrid" ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
                            : "text-rose-300 border-rose-500/30 bg-rose-500/10";
                          return (
                            <button
                              key={item.id || idx}
                              onClick={() => { props.onUseItem("p1", item as any); setTacticalTab("SKILLS"); }}
                              title={item.description}
                              className="group flex items-center gap-2.5 bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 rounded-xl px-2.5 py-2 transition-all hover:bg-slate-800 disabled:opacity-40 text-left"
                              disabled={phase !== "p1_select"}
                            >
                              <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center border ${tone}`}>
                                <FlaskConical className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-black text-white truncate">{item.name}</div>
                                <div className="text-[10px] text-slate-400 leading-tight truncate">{item.description}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {tacticalTab === "EFFECTS" && (
                    <StatusInspector state={battle} />
                  )}
    </>
  );


  const renderElfConsole = (side: "p1" | "p2", elf: Elf) => {
    const isP1 = side === "p1";
    const hpPercent = elf.maxHp > 0 ? (elf.currentHp / elf.maxHp) * 100 : 0;
    const startHp = isP1 ? p1StartHp : p2StartHp;
    const hpDiff = elf.currentHp - startHp;
    const team = isP1 ? p1Team : p2Team;
    const panelState = isP1 ? p1Panel : p2Panel;
    const setPanelState = isP1 ? setP1Panel : setP2Panel;
    const isAttacking = false; // 資訊艙保持穩定，出招只作用於場上的立繪。
    const isShaking = props.consoleShake?.[side];
    let panelAnimate = {};
    if (isAttacking) {
      panelAnimate = { x: [panelState.pos.x, panelState.pos.x + (isP1 ? 60 : -60), panelState.pos.x] };
    } else if (isShaking) {
      panelAnimate = { x: [panelState.pos.x - 6, panelState.pos.x + 6, panelState.pos.x - 6, panelState.pos.x + 6, panelState.pos.x], transition: { duration: 0.3 } };
    }
    return (
      <DraggableResizablePanel
        pos={panelState.pos}
        setPos={(pos) => setPanelState(prev => ({ ...prev, pos }))}
        size={panelState.size}
        setSize={(size) => setPanelState(prev => ({ ...prev, size }))}
        opacity={panelState.opacity}
        setOpacity={(opacity) => setPanelState(prev => ({ ...prev, opacity }))}
        onReset={() => setPanelState(defaultLayout ? (isP1 ? defaultLayout.p1 : defaultLayout.p2) : (isP1 ? DEFAULT_P1_LAYOUT : DEFAULT_P2_LAYOUT))}
        scale={panelState.scale}
        setScale={(scale) => setPanelState(prev => ({ ...prev, scale }))}
        animate={panelAnimate}
        className={`border-2 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col transition-colors duration-300 ${isShaking ? "border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.3)]" : "border-cyan-500/40"}`}
      >
        <div className="bg-cyan-500/10 border-b border-cyan-500/30 px-4 py-2 flex justify-between items-center gap-3 cursor-move">
          <h2 className="text-sm font-black text-white tracking-widest">{isP1 ? "P1 戰鬥艙" : "AI 戰鬥艙"}</h2>
          <div className="flex gap-3 text-[10px] items-center text-slate-300">
            <label className="flex items-center gap-1">縮放<input type="range" min="0.5" max="1.5" step="0.1" value={panelState.scale} onChange={(e) => setPanelState(prev => ({ ...prev, scale: parseFloat(e.target.value) }))} className="w-16" /></label>
            <label className="flex items-center gap-1">透明<input type="range" min="0.2" max="1" step="0.1" value={panelState.opacity} onChange={(e) => setPanelState(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))} className="w-16" /></label>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex justify-center min-h-8">{renderPopups(side)}</div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => !elf.isConcealed && setSelectedElfDetail({ elf, side, idx: isP1 ? p1ActiveIndex : battle.p2ActiveIndex })}
                className={`w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl shadow-inner cursor-pointer hover:scale-105 hover:border-cyan-400 transition-all ${elf.isConcealed ? 'brightness-0 opacity-80 text-black' : ''}`}
                title="點擊查看精靈種族值、魂印與技能完整資料"
              >
                {elf.isConcealed ? "👤" : ((elf as any).badge || elf.soulMark?.badgeChar || "🛡️")}
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => !elf.isConcealed && setSelectedElfDetail({ elf, side, idx: isP1 ? p1ActiveIndex : battle.p2ActiveIndex })}
                  className="text-left cursor-pointer hover:text-cyan-300 transition-colors"
                  title="點擊查看精靈完整詳情"
                >
                  <h3 className="text-lg font-black text-white tracking-tight leading-none mb-1 hover:underline flex items-center gap-1.5">
                    {elf.isConcealed ? "未知精靈" : elf.name}
                    <span className="text-[10px] text-cyan-400 font-normal">🔍</span>
                  </h3>
                </button>
                  {(() => {
                    const opponent = isP1 ? p2 : p1;
                    const mult = getTypeMatchup(elf.type, opponent.type);
                    const isSuper = mult > 1;
                    const isWeak = mult > 0 && mult < 1;
                    const isImmune = mult === 0;
                    const colorClass = 
                        isSuper ? "text-rose-400 border-rose-800/50 bg-rose-950/60"        // 克制：紅色
                      : isImmune ? "text-slate-500 border-slate-700 bg-slate-900/80"       // 無效：灰色
                      : isWeak ? "text-sky-300 border-sky-800/50 bg-sky-950/60"            // 微弱：淺藍色
                      : "text-white border-slate-600 bg-slate-800/60";                     // 普通：白色
                    
                    const label = isSuper ? "克制" : isImmune ? "無效" : isWeak ? "微弱" : "普通";
                    
                    return (
                      <span className={`px-2 py-0.5 border rounded text-[10px] font-black tracking-tighter ${colorClass}`}>
                         {label} {mult}x
                      </span>
                    );
                  })()}
                  
                  {/* Soul Mark */}
                  <button 
                    onClick={() => setModalContent({ title: elf.soulMark?.name || "專屬魂印", content: elf.soulMark?.description || "該精靈目前無專屬魂印效果。" })}
                    className="px-2 py-0.5 bg-purple-950/60 border border-purple-800/50 rounded text-[10px] font-bold text-purple-400 flex items-center gap-1 hover:bg-purple-900/60 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3 h-3" /> 魂印: {elf.soulMark?.name || "無"}
                  </button>

                  {/* Trait (特性) */}
                  {elf.trait && (
                    <button 
                      onClick={() => setModalContent({ title: elf.trait!.name, content: elf.trait!.description })}
                      className="px-2 py-0.5 bg-indigo-950/60 border border-indigo-800/50 rounded text-[10px] font-bold text-indigo-400 flex items-center gap-1 hover:bg-indigo-900/60 transition-colors cursor-pointer"
                    >
                      <FlaskConical className="w-3 h-3" /> 特性: {elf.trait.name}
                    </button>
                  )}

                  {/* Alien Trait (異能特質) */}
                  {(elf.alienTraits?.gen2Trait || elf.alienTraits?.exclusiveTrait || elf.alienTraits?.alienTrait || elf.alienTraits?.generalTrait || (elf as any).trait_stone_thrower) && (
                    <button 
                      onClick={() => setModalContent({ 
                        title: elf.alienTraits?.gen2Trait?.name || elf.alienTraits?.exclusiveTrait?.name || elf.alienTraits?.alienTrait?.name || elf.alienTraits?.generalTrait?.name || "投石者", 
                        content: elf.alienTraits?.gen2Trait?.description || elf.alienTraits?.exclusiveTrait?.description || elf.alienTraits?.alienTrait?.description || elf.alienTraits?.generalTrait?.description || "投石者：使用技能石時威力大幅增加，且能裝備多個技能石。" 
                      })}
                      className="px-2 py-0.5 bg-amber-950/60 border border-amber-800/50 rounded text-[10px] font-bold text-amber-400 flex items-center gap-1 hover:bg-amber-900/60 transition-colors cursor-pointer"
                    >
                      <Star className="w-3 h-3" /> 異能: {elf.alienTraits?.gen2Trait?.name || elf.alienTraits?.exclusiveTrait?.name || elf.alienTraits?.alienTrait?.name || elf.alienTraits?.generalTrait?.name || "投石者"}
                    </button>
                  )}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">陣容存亡:</span>
                <div className="flex flex-wrap gap-1">
                  {team.map((e, idx) => {
                    const activeIdx = isP1 ? p1ActiveIndex : battle.p2ActiveIndex;
                    const isActive = idx === activeIdx;
                    const isDead = !e || (!isAliveBySurvivalRule(e.currentHp, e.survivalRule) && !(e.deathImmunity && e.deathImmunity.deathImmuneTurns > 0));
                    const isExtraElf = idx >= 6;
                    
                    let colorClass;
                    if (!e) {
                      colorClass = 'bg-slate-800 border-slate-700 opacity-50';
                    } else if (e.isVanished) {
                      colorClass = 'bg-purple-600 border-purple-400 shadow-[0_0_5px_rgba(147,51,234,0.5)]';
                    } else if (isDead) {
                      colorClass = 'bg-rose-900 border-rose-700 opacity-70';
                    } else if (isActive) {
                      colorClass = 'bg-cyan-500 border-cyan-400 shadow-[0_0_5px_rgba(6,182,212,0.5)]';
                    } else {
                      colorClass = 'bg-emerald-500 border-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.5)]';
                    }

                    return (
                      <button 
                        key={idx} 
                        onClick={() => e && !e.isConcealed && setSelectedElfDetail({ elf: e, side, idx })}
                        className={`w-3.5 h-3.5 rounded-sm transition-all cursor-pointer hover:scale-125 flex items-center justify-center text-[8px] font-mono font-bold text-amber-200 ${colorClass} ${
                          isExtraElf ? 'border-2 border-amber-400 ring-1 ring-amber-400/40' : 'border'
                        }`} 
                        title={`${e ? e.name : '空白'}${isExtraElf ? '（額外精靈）' : ''}${e?.isVanished ? '（消逝）' : isDead ? '（陣亡）' : isActive ? '（出戰中）' : '（場下）'}`}
                      >
                        {isExtraElf ? '+' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          <div className="mb-3 relative">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[10px] text-slate-400 font-bold">體力</span>
                <span className="text-lg font-black text-white">{elf.currentHp} <span className="text-xs text-slate-500">/ {elf.maxHp}</span></span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${getHpBarColor(elf.currentHp, elf.maxHp)}`} style={{ width: `${hpPercent}%` }} />
              </div>
              {hpDiff !== 0 && (
                <div className={`text-[10px] font-bold mt-0.5 ${hpDiff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  本回合變化：{hpDiff > 0 ? '+' : ''}{hpDiff}
                </div>
              )}
          </div>
          {renderElfDetails(side, elf)}
        </div>
      </DraggableResizablePanel>
    );
  };


  // ────────────────────────── 固定排版（預設） ──────────────────────────
  const aliveCount = (team: Elf[]) => team.filter((e, i) => e && !e.isExtra && i < 6 && !e.isVanished && (isAliveBySurvivalRule(e.currentHp, e.survivalRule) || (e.deathImmunity && e.deathImmunity.deathImmuneTurns > 0))).length;

  const catalogDesc = (c: any, inst: any) => {
    try { return typeof c?.describe === "function" ? c.describe(inst || {}) : (c?.description || ""); } catch { return c?.description || ""; }
  };

  const renderChips = (side: "p1" | "p2", elf: Elf) => {
    type Chip = { key: string; text: string; cls: string; name: string; desc?: string; icon?: string; stageLabel?: string; stageValue?: string };
    const rows: { key: string; label: string; chips: Chip[]; vertical?: boolean }[] = [];
    const addRow = (key: string, label: string, chips: Chip[], vertical = false) => {
      if (chips.length) rows.push({ key, label, chips, vertical });
    };

    // 第 1 行：防護資源只在有容量時顯示。
    const protection: Chip[] = [
      { key: "shield", name: "護盾", text: `護盾 ${elf.shield}`, icon: buffIconFor("護盾"), cls: "border-sky-500/40 bg-sky-950/50 text-sky-200", desc: "優先吸收技能攻擊傷害。" },
      { key: "barrier", name: "護罩", text: `護罩 ${elf.barrier}`, icon: buffIconFor("護罩"), cls: "border-fuchsia-500/40 bg-fuchsia-950/50 text-fuchsia-200", desc: "優先吸收固定與百分比傷害。" },
    ].filter(item => Number(item.key === "shield" ? elf.shield : elf.barrier) > 0);
    addRow("protection", "防護", protection);

    // 第 2 行：沿用遊戲畫面的緊湊文字標籤；通用強化／弱化素材不是各能力等級的準確圖示。
    const stageLabels: Record<string, string> = { atk: "攻擊", def: "防禦", spatk: "特攻", spdef: "特防", speed: "速度", accuracy: "命中" };
    const stageChips: Chip[] = [];
    const stages = (elf.statStages || {}) as Record<string, number>;
    if (disguiseBattleStates && Object.values(stages).some(value => Number(value) !== 0)) {
      stageChips.push({ key: "stage-nightmare", name: "魘味", text: "魘味", cls: "border-purple-500/40 bg-purple-950/50 text-purple-200", icon: statusVisual("魘味")?.icon, desc: StatusRegistry["魘味"].description });
    } else {
      for (const key of ["atk", "def", "spatk", "spdef", "speed", "accuracy"]) {
        const value = Number(stages[key] || 0);
        if (!value) continue;
        const label = stageLabels[key] || STAT_FULL[key] || key;
        stageChips.push({
          key: `stage-${key}`, name: `${label}能力等級`, text: `${label} ${value > 0 ? "+" : ""}${value}`,
          cls: value > 0 ? "border-amber-500/40 bg-amber-950/50 text-amber-200" : "border-violet-500/40 bg-violet-950/50 text-violet-200",
          desc: stageDesc(key, value), stageLabel: label, stageValue: `${value > 0 ? "+" : ""}${value}`,
        });
      }
    }
    addRow("stages", "能力等級", stageChips);

    // 第 3 行：異常狀態；魘味只影響顯示，不改動底層狀態。
    const st = getStatuses(elf) as Record<string, any>;
    const activeStatusEntries = Object.entries(st || {}).filter(([, turns]) => Number(turns) > 0);
    const statusChips: Chip[] = [];
    if (disguiseBattleStates && activeStatusEntries.length > 0) {
      const visual = statusVisual('魘味');
      statusChips.push({ key: 's-魘味-mask', name: '魘味', text: '魘味', cls: "bg-rose-950/70 text-rose-200 border-rose-500/40", desc: StatusRegistry['魘味'].description, icon: visual?.icon });
    } else activeStatusEntries.forEach(([id, turns]) => {
      if (!turns) return;
      const reg = (StatusRegistry as any)[id];
      const cat = (EFFECT_CATALOG as any)[id];
      const name = reg?.name || cat?.label || id;
      const vis = statusVisual(name);
      const n = Number(turns);
      const statusChipColor = reg?.categories?.includes('BOSS_ONLY')
        ? name === '神話' ? "bg-amber-950/70 text-amber-200 border-amber-500/50" : "bg-sky-950/70 text-sky-200 border-sky-500/50"
        : "bg-rose-950/70 text-rose-200 border-rose-500/40";
      statusChips.push({
        key: `s-${id}`, name, text: reg?.categories?.includes('BOSS_ONLY') ? name : n > 0 && n < 99 ? `${name}(${n})` : name,
        cls: statusChipColor,
        desc: vis?.desc || reg?.description || catalogDesc(cat, { remainingTurns: n }) || name,
        icon: vis?.icon || buffIconFor(name),
      });
    });

    addRow("statuses", "異常", statusChips);

    // 第 4 行：印記與所有計時／次數效果統一收在同一列，無效果時不佔位。
    const effectChips: Chip[] = [];
    const marks = (side === "p1" ? p1Marks : p2Marks) || [];
    const timers = (side === "p1" ? p1Timers : p2Timers) || [];
    buildEffectViewModels(marks, timers, elf.battleId || elf.id).forEach(effect => {
      if (effect.category === "mark") {
        effectChips.push({
          key: effect.id, name: effect.label,
          text: `${effect.shortLabel}${effect.value !== undefined ? ` ${effect.value}${effect.unit || ""}` : ""}`,
          cls: "bg-yellow-950/70 text-yellow-200 border-yellow-500/40", desc: describeEffectMeta(effect),
        });
      } else {
        const cls = effect.category === "count" ? "bg-violet-950/70 text-violet-200 border-violet-500/40"
          : effect.polarity === "negative" ? "bg-rose-950/70 text-rose-200 border-rose-500/40"
            : "bg-cyan-950/70 text-cyan-200 border-cyan-500/40";
        effectChips.push({
          key: effect.id, name: effect.label,
          text: `${effect.label} ${effect.value ?? ""}${effect.unit || ""}`.trim(),
          cls, desc: describeEffectMeta(effect), icon: buffIconFor(effect.label),
        });
      }
    });
    getDynamicEffects(side, elf).forEach((d: any) => {
      if (d.catalogId === "shield_active" || d.catalogId === "barrier_active") return;
      const c = (EFFECT_CATALOG as any)[d.catalogId];
      if (!c) return;
      const desc = d.note || catalogDesc(c, d) || c.label;
      effectChips.push({ key: `d-${d.catalogId}`, name: c.label, text: d.remainingTurns > 1 ? `${c.label}（${d.remainingTurns}）` : c.label, cls: "bg-violet-950/70 text-violet-200 border-violet-500/40", desc, icon: statusVisual(c.label)?.icon || buffIconFor(`${c.label} ${desc}`) });
    });
    addRow("effects", "印記 / 回合", effectChips);
    if (!rows.length) return null;
    return (
      <div className="mt-1.5 space-y-1">
        {rows.map(row => (
          <div key={row.key} className={`flex items-start gap-2 ${side === "p2" ? "flex-row-reverse text-right" : ""}`}>
            <span className="w-[72px] shrink-0 pt-1 text-[9px] font-black text-slate-500">{row.label}</span>
            <div className={`min-w-0 flex-1 ${row.key === "stages" ? "flex flex-wrap items-start gap-1" : row.vertical ? "flex flex-col gap-0.5" : "flex flex-wrap gap-1"}`}>
              {row.chips.map(chip => (
                <button type="button" key={chip.key} title={`${chip.name}\n${chip.desc || ""}`}
                  onClick={() => setModalContent({ title: chip.name, content: chip.desc || chip.name })}
                  className={`inline-flex max-w-full items-center gap-1 rounded border text-[10px] font-bold leading-4 hover:brightness-125 ${chip.cls} ${row.key === "stages" ? "h-[42px] w-[40px] shrink-0 flex-col justify-center gap-0 px-0.5 py-0.5 text-center whitespace-normal" : `px-1.5 py-0.5 ${row.vertical ? "w-full justify-start" : "whitespace-nowrap"}`}`}>
                  {row.key === "stages" ? <><span className="text-[9px] leading-3">{chip.stageLabel}</span><span className="font-mono text-[11px] leading-4">{chip.stageValue}</span></> : <>
                    {chip.icon && <ChainImage urls={[chip.icon]} className="h-4 w-4 shrink-0 rounded-sm object-contain" />}
                    <span className="truncate">{chip.text}</span>
                  </>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCard = (side: "p1" | "p2") => {
    const isP1 = side === "p1";
    const elf = isP1 ? p1 : p2;
    if (!elf) return null;
    const idx = isP1 ? p1ActiveIndex : battle.p2ActiveIndex;
    const hpPct = elf.maxHp > 0 ? Math.max(0, Math.min(100, (elf.currentHp / elf.maxHp) * 100)) : 0;
    const openDetail = () => !elf.isConcealed && setSelectedElfDetail({ elf, side, idx });
    const isShaking = props.consoleShake?.[side];
    const trait = elf.alienTraits?.gen2Trait || elf.alienTraits?.exclusiveTrait || elf.alienTraits?.alienTrait || elf.alienTraits?.generalTrait;
    return (
      <div className={`pointer-events-auto w-full rounded-2xl border bg-slate-950/85 shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-colors ${isShaking ? "border-rose-500/80" : "border-cyan-500/30"}`}>
        <div className={`flex gap-3 p-2.5 ${isP1 ? "" : "flex-row-reverse"}`}>
          <button type="button" onClick={openDetail} title="查看精靈詳情"
            className="shrink-0 w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-cyan-400/60 bg-slate-900 hover:scale-105 transition-transform">
            <ElfAvatar
              elf={elf}
              kind="head"
              className={`w-full h-full object-cover ${side === "p1" && String(elf.id) === "5029" ? "-scale-x-100" : ""}`}
            />
          </button>
          <div className={`flex-1 min-w-0 ${isP1 ? "" : "text-right"}`}>
            <div className={`flex items-center gap-1.5 min-w-0 ${isP1 ? "" : "flex-row-reverse"}`}>
              <TypeIcon type={elf.type} size={20} />
              <button type="button" onClick={openDetail} className="font-black text-base text-white truncate hover:text-cyan-300">
                {elf.isConcealed ? "未知精靈" : elf.name}
              </button>
              {elf.soulMark && (
                <button type="button" onClick={() => setModalContent({ title: elf.soulMark?.name || "魂印", content: elf.soulMark?.description || "" })}
                  title={`魂印：${elf.soulMark.name}`}
                  className="shrink-0 px-1.5 rounded bg-purple-900/70 border border-purple-500/50 text-[11px] font-black text-purple-200 hover:bg-purple-800/70">
                  「{elf.soulMark.badgeChar || (elf.soulMark.name || "").slice(0, 1)}」
                </button>
              )}
              {trait && (
                <button type="button" onClick={() => setModalContent({ title: trait.name, content: trait.description })} title={`特質：${trait.name}`}
                  className="shrink-0 px-1.5 rounded bg-amber-900/60 border border-amber-500/40 text-[10px] font-bold text-amber-200">{trait.name}</button>
              )}
              {elf.trait && (
                <button type="button" onClick={() => setModalContent({ title: elf.trait!.name, content: elf.trait!.description })} title={`特性：${elf.trait.name}`}
                  className="shrink-0 px-1.5 rounded bg-indigo-900/60 border border-indigo-500/40 text-[10px] font-bold text-indigo-200">{elf.trait.name}</button>
              )}
            </div>
            <div className="relative mt-1.5 h-5 rounded-full bg-slate-800 overflow-hidden border border-white/10">
              <div className={`absolute inset-y-0 ${isP1 ? "left-0" : "right-0"} transition-all duration-300 ${getHpBarColor(elf.currentHp, elf.maxHp)}`} style={{ width: `${hpPct}%` }} />
              <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                <span>{elf.currentHp}/{elf.maxHp}</span>
                <span>{hpPct >= 10 ? Math.round(hpPct) : hpPct.toFixed(1)}%</span>
              </div>
            </div>
            {renderChips(side, elf)}
          </div>
        </div>
        <button type="button" onClick={() => setCardOpen(prev => ({ ...prev, [side]: !prev[side] }))}
          className="w-full border-t border-white/5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-cyan-300 hover:bg-white/5 rounded-b-2xl">
          {cardOpen[side] ? "收起 ▲" : "詳情 ▼"}
        </button>
        {cardOpen[side] && (
          <div className="max-h-[38vh] overflow-y-auto custom-scrollbar border-t border-white/5 p-3">
            {renderElfDetails(side, elf)}
          </div>
        )}
      </div>
    );
  };

  const renderMatchInfo = () => {
    const m1 = p1 && p2 ? getTypeMatchup(p1.type, p2.type) : 1;
    const m2 = p1 && p2 ? getTypeMatchup(p2.type, p1.type) : 1;
    const multCls = (m: number) => m > 1 ? "text-rose-400" : m === 0 ? "text-slate-500" : m < 1 ? "text-sky-300" : "text-slate-200";
    const fmt = (m: number) => `×${Number(m.toFixed(3))}`;
    // 陣容點：一般精靈（計勝負）＋額外精靈（金色菱形，不計勝負）；數量可超過 6 自動延伸
    const dots = (side: "p1" | "p2") => {
      const team = side === "p1" ? p1Team : p2Team;
      const activeIdx = side === "p1" ? p1ActiveIndex : battle.p2ActiveIndex;
      const n = aliveCount(team);
      const extras = team.filter((e, i) => e && (e.isExtra || i >= 6)).length;
      return (
        <span className={`flex items-center gap-1 ${side === "p2" ? "flex-row-reverse" : ""}`}
          title={`剩餘 ${n} 隻（計入勝負）${extras ? `\n額外精靈 ${extras} 隻：不計入勝負` : ""}`}>
          <span className={`flex flex-wrap gap-0.5 max-w-[120px] ${side === "p2" ? "justify-end" : ""}`}>
            {team.map((e, i) => {
              if (!e) return null;
              const extra = !!e.isExtra || i >= 6;
              const dead = e.isVanished || (!isAliveBySurvivalRule(e.currentHp, e.survivalRule) && !(e.deathImmunity && e.deathImmunity.deathImmuneTurns > 0));
              const active = i === activeIdx;
              return (
                <button key={i} type="button" onClick={() => !e.isConcealed && setSelectedElfDetail({ elf: e, side, idx: i })}
                  title={`${e.isConcealed ? "未知精靈" : e.name}${extra ? "（額外精靈・不計勝負）" : ""}${e.isVanished ? "（消逝）" : dead ? "（陣亡）" : active ? "（出戰中）" : ""}`}
                  className={`${extra ? "w-2 h-2 rotate-45 rounded-[1px]" : "w-2 h-2 rounded-full"} ${
                    extra ? (dead ? "bg-amber-900/60" : "bg-amber-400") : dead ? "bg-slate-700" : active ? "bg-cyan-300 ring-1 ring-cyan-200" : "bg-emerald-400"
                  } hover:scale-150 transition-transform`} />
              );
            })}
          </span>
          <span className="text-xs font-black text-white">{n}</span>
          {extras > 0 && <span className="text-[10px] font-bold text-amber-300" title="額外精靈不計入勝負">+{extras}</span>}
        </span>
      );
    };
    return (
      <div className="flex flex-col items-center gap-1 pointer-events-auto">
        <div className="px-4 py-0.5 rounded-full bg-slate-950/85 border border-cyan-500/30 text-sm font-black text-slate-200 flex items-baseline gap-1.5">
          第<span className="text-xl text-cyan-300">{turnNumber}</span>回合
          <span className="ml-1 text-[10px] font-bold text-slate-400">{PHASE_LABEL[phase] || phase}</span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-1 rounded-xl bg-slate-950/80 border border-white/10">
          {dots("p1")}
          <TypeIcon type={p1?.type} size={22} />
          <span className={`text-xs font-black ${multCls(m1)}`} title="我方屬性對對方的克制倍率">{fmt(m1)}</span>
          <span className="text-[10px] font-black text-slate-500">VS</span>
          <span className={`text-xs font-black ${multCls(m2)}`} title="對方屬性對我方的克制倍率">{fmt(m2)}</span>
          <TypeIcon type={p2?.type} size={22} />
          {dots("p2")}
        </div>
      </div>
    );
  };

  const renderSprite = (side: "p1" | "p2") => {
    const isP1 = side === "p1";
    const elf = isP1 ? p1 : p2;
    if (!elf) return null;
    const isActing = props.activeSkillAnim?.side === side;
    const isAttacking = isActing && props.activeSkillAnim?.category !== 'property';
    const isShaking = props.consoleShake?.[side];
    const anim = isAttacking ? { x: [0, isP1 ? 40 : -40, 0], filter: 'brightness(1)' }
      : isActing ? { x: 0, filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'] }
      : { x: 0, filter: 'brightness(1)' };
    const dead = !isAliveBySurvivalRule(elf.currentHp, elf.survivalRule);
    const spriteProfile = battleSpriteProfile(elf.name);
    const height = Number(elf.height);
    const spriteScale = battleSpriteScale(elf.name, height);

    const spriteStyle: React.CSSProperties = spriteProfile
      ? { width: spriteProfile.width || "54%", height: spriteProfile.height || "118%" }
      : { width: "26%", height: "74%", maxHeight: 400 };
    return (
      <div className={`absolute bottom-[2%] ${isP1 ? (spriteProfile ? "left-0" : "left-[4%]") : (spriteProfile ? "right-0" : "right-[4%]" )} flex items-end justify-center pointer-events-none`}
        style={{ ...spriteStyle, opacity: spriteMode === "dim" ? 0.55 : 1, display: spriteMode === "hide" ? "none" : undefined }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5 w-max">
          {renderPopups(side)}
          {isActing && <span className="rounded-lg bg-slate-950/80 px-3 py-1 text-sm font-bold text-cyan-200">{props.activeSkillAnim.skillName}</span>}
        </div>
        <motion.div animate={anim} transition={{ duration: 0.35 }} style={{ scale: spriteScale }} className={`h-full w-full flex items-end justify-center ${dead ? "opacity-30 grayscale" : ""}`}>
          <ElfAvatar
            elf={elf}
            kind="body"
            battleSide={side}
            className="max-h-full max-w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.6)]"
            fallbackClassName="w-36 h-36 rounded-full overflow-hidden ring-2 ring-white/15 flex items-center justify-center text-5xl font-black text-slate-200 mb-6 bg-black/20"
          />
        </motion.div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-4 rounded-[50%] bg-black/30 blur-md -z-10" />
      </div>
    );
  };

  const renderSkillRow = () => {
    const baseSkills = p1?.skills || [];
    const displaySkills = baseSkills.length >= 5 ? [baseSkills[4], baseSkills[0], baseSkills[1], baseSkills[2], baseSkills[3]] : baseSkills;
    const isMars = p1?.name === "變革·馬爾修斯";
    return (
      <div className="grid grid-cols-5 gap-2.5">
        {displaySkills.map((skill, i) => {
          const isFifth = !!skill.isFifthSkill || (baseSkills.length >= 5 && skill.name === baseSkills[4].name);
          const uses = skill.charge !== undefined ? skill.charge : skill.pp;
          const disabled = phase !== "p1_select" || isElfSkillSelectionDisabled(p1) || (uses <= 0 && !isZeroPpExempt(p1, skill, p2));
          const selected = p1SelectedSkill?.name === skill.name;
          return (
            <button
              key={i}
              onClick={(e) => {
                // 手機端：沒有 hover，點已選中的技能彈說明浮窗，再點收起；點未選中的照常選招。
                if (phase === "p1_select" && selected && hoveredSkill?.name === skill.name) {
                  setHoveredSkill(null); setHoveredSkillAnchor(null); return;
                }
                if (phase === "p1_select") {
                  props.onSkillSelect("p1", skill);
                  // 手機 tap 同步彈說明（無 hover 環境下看得到技能描述）
                  try {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setHoveredSkillAnchor({ x: rect.left + rect.width / 2, y: rect.top, top: rect.top, bottom: rect.bottom });
                    setHoveredSkill(skill);
                  } catch { /* 略過 */ }
                }
              }}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHoveredSkillAnchor({ x: rect.left + rect.width / 2, y: rect.top, top: rect.top, bottom: rect.bottom });
                setHoveredSkill(skill);
              }}
              onMouseLeave={() => { setHoveredSkill(null); setHoveredSkillAnchor(null); }}
              disabled={disabled}
              className={`group relative flex flex-col gap-1 rounded-xl border px-2.5 pt-2.5 pb-2 text-left transition-all bg-gradient-to-b from-slate-800/90 to-slate-900/90 hover:from-slate-700/90 hover:border-cyan-400/70 disabled:opacity-45 disabled:cursor-not-allowed min-h-[44px] ${isFifth ? "border-amber-400/80 shadow-[0_0_14px_rgba(245,158,11,0.25)]" : "border-white/10"} ${selected ? "ring-2 ring-cyan-400" : ""}`}
            >
              {isFifth && <span className="absolute -top-2 left-2 px-1.5 rounded bg-gradient-to-r from-amber-500 to-yellow-400 text-[10px] font-black text-slate-900 shadow">第五</span>}
              {skill.specialBadge && (
                <span className={`absolute -top-2 right-2 px-1.5 rounded text-[9px] font-black border ${skill.specialBadge.bg || "bg-purple-900/90"} ${skill.specialBadge.color || "text-purple-200"} ${skill.specialBadge.border || "border-purple-500/40"}`}>{skill.specialBadge.text}</span>
              )}
              <div className="flex items-center gap-1.5 min-w-0">
                <TypeIcon type={skill.type && skill.type !== "--" ? skill.type : "無屬性"} size={20} />
                <span className="font-black text-sm text-white truncate group-hover:text-cyan-300">{skill.name}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                {isMars ? (
                  <span>充能 <b className={uses <= 0 ? "text-rose-400" : "text-amber-300"}>{uses}</b></span>
                ) : (
                  <span>次數 <b className={skill.pp <= 1 ? "text-rose-400" : "text-slate-100"}>{skill.pp}/{getMaxPp(skill, p1)}</b></span>
                )}
                <span>{skill.category === "屬性" ? <b className="text-emerald-300">屬性</b> : <>威力 <b className="text-slate-100">{skill.power || 0}</b></>}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const lastLog = logs.length ? logs[logs.length - 1] : null;
  const TABS: { key: "SKILLS" | "TEAM" | "ITEMS" | "EFFECTS"; label: string }[] = [
    { key: "SKILLS", label: "戰鬥" }, { key: "TEAM", label: "精靈" }, { key: "ITEMS", label: "道具" }, { key: "EFFECTS", label: "效果" },
  ];

  const renderFixedLayout = () => (
    <div className="absolute inset-0">
      {/* 場地 */}
      <div className="absolute inset-x-0 top-[170px] bottom-[196px] pointer-events-none">
        {renderSprite("p1")}
        {renderSprite("p2")}
      </div>

      {/* 上方：雙方精靈卡 + 中央回合資訊（手機直屏改上下疊卡，避免左右挤在一起蓋住技能鈕） */}
      <div className="absolute top-[118px] sm:top-[56px] left-3 w-[43%] sm:w-[min(480px,35%)] z-30">{renderCard("p1")}</div>
      <div className="absolute top-[118px] sm:top-[56px] right-3 w-[43%] sm:w-[min(480px,35%)] z-30">{renderCard("p2")}</div>
      <div className="absolute top-[44px] sm:top-2 left-1/2 -translate-x-1/2 z-20">{renderMatchInfo()}</div>

      {/* 本次傷害提示 */}
      <div className="absolute top-[224px] sm:top-[92px] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <AnimatePresence>
          {lastActionInfo && lastActionInfo.amount > 0 && (
            <motion.div key={`${lastActionInfo.side}-${lastActionInfo.amount}-${turnNumber}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="px-3 py-1 rounded-xl bg-slate-950/85 border border-white/15 text-xs font-black text-slate-100 whitespace-nowrap">
              【{lastActionInfo.targetElfName}】 {lastActionInfo.type === "heal" || lastActionInfo.type === "adjust_up" ? `+${lastActionInfo.amount}` : `-${lastActionInfo.amount}`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 下方：對戰信息 + 指令 */}
      <div className="absolute inset-x-3 bottom-2 z-30 flex flex-col gap-1.5 pointer-events-auto">
        {logOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-[min(620px,70%)] h-[46vh] rounded-xl bg-slate-950/95 border border-cyan-500/30 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-xs font-black text-cyan-300">
              對戰信息
              <button onClick={() => setLogOpen(false)} className="text-slate-400 hover:text-white">收起</button>
            </div>
            {renderLogList()}
          </div>
        )}
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-950/85 border border-white/10 text-xs">
          <span className="shrink-0 font-black text-cyan-400">對戰信息</span>
          <span className="flex-1 truncate text-slate-200" title={lastLog?.text}>{lastLog ? lastLog.text : "—"}</span>
          <button onClick={() => setLogOpen(v => !v)} className="shrink-0 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">{logOpen ? "收起" : "展開"}</button>
        </div>
        <div className="rounded-2xl bg-slate-950/88 border border-white/10 shadow-2xl">
          <div className="flex items-center gap-1.5 px-3 pt-2">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTacticalTab(t.key)}
                className={`px-3 py-1 rounded-md text-xs font-black transition-colors ${tacticalTab === t.key ? "bg-cyan-600 text-white" : "bg-slate-800/80 text-slate-400 hover:text-slate-200"}`}>{t.label}</button>
            ))}
            <span className="flex-1 truncate px-2 text-[11px] text-slate-400">
              {phase === "p1_select" ? "請選擇指令" : phase.includes("forced_switch") ? "請選擇出戰精靈" : PHASE_LABEL[phase] || ""}
            </span>
            <button onClick={props.onAutoBattleToggle} title="自動戰鬥"
              className={`px-3 py-1 rounded-md text-xs font-black border transition-colors ${isAutoBattle ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800/80 text-slate-300 border-white/10 hover:bg-slate-700"}`}>托管</button>
            <button onClick={() => setShowDisplaySettings(true)} title="顯示設定" className="p-1.5 rounded-md bg-slate-800/80 text-slate-300 hover:text-white border border-white/10"><Layout className="w-4 h-4" /></button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'battle' } }))} title="戰鬥設定" className="p-1.5 rounded-md bg-slate-800/80 text-slate-300 hover:text-white border border-white/10"><Settings className="w-4 h-4" /></button>
            <button onClick={props.onBackToMenu} title="撤退離開" className="px-2.5 py-1 rounded-md text-xs font-black bg-rose-950/70 text-rose-300 border border-rose-800/60 hover:bg-rose-900/70">撤退</button>
          </div>
          <div className="p-3 pt-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
            {tacticalTab === "SKILLS" ? renderSkillRow() : renderTacticalOther()}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={battleRootRef} data-battle-root className="h-full w-full bg-transparent overflow-hidden relative font-sans text-slate-200">
      {winner && !props.specialMode && <BattleEndDialog winner={winner} onRestart={props.onReset} onHome={props.onBackToMenu} />}
      {/* Global Interaction Blocker while resolving or during transitions */}
      {(phase === "resolving" || phase === "processing") && (
        <div className="fixed inset-0 z-[100] cursor-wait" />
      )}

      {/* Background Blueprint Grid - Lower Opacity to show theme background */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)] pointer-events-none" />

      {!customLayout && renderFixedLayout()}

      {customLayout && (<>
      {/* Floating Settings Trigger — shifted left of the global ControlHub trigger (which occupies ~172px from the right edge) to avoid overlap */}
      <div className="absolute top-4 right-[184px] z-[60] flex items-center gap-2">
         <button 
           onClick={() => setShowDisplaySettings(prev => !prev)} 
           className="px-3 py-2 rounded-xl bg-[#0A0D14]/80 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all shadow-2xl flex items-center gap-1.5 text-xs font-bold cursor-pointer"
           title="顯示設定"
         >
           <Layout className="w-4 h-4 text-cyan-400" />
           <span>顯示設定</span>
         </button>
         <button 
           onClick={() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'battle' } }))} 
           className="p-2.5 rounded-xl bg-[#0A0D14]/80 backdrop-blur-xl border border-white/10 text-slate-500 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all shadow-2xl group cursor-pointer"
           title="戰鬥視窗設定"
         >
           <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
         </button>
      </div>



      {/* Main Layout Area */}
      <div className="flex h-full overflow-hidden relative">
        
        {/* Sidebar Log Panel */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 350, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-cyan-500/20 bg-[#0A0D14]/60 backdrop-blur-md flex flex-col overflow-hidden relative z-40"
            >
              <div className="p-4 border-b border-cyan-500/20 flex justify-between items-center bg-cyan-500/5">
                <span className="text-xs font-black text-cyan-400 uppercase flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> 觀測日誌與分析
                </span>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              {renderLogList()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar Toggle Button */}
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-32 bg-cyan-600/10 border-y border-r border-cyan-500/30 rounded-r-xl flex flex-col items-center justify-center gap-4 text-cyan-500 hover:bg-cyan-600/20 transition-all z-40 group"
          >
            <ChevronRight className="w-4 h-4 group-hover:scale-125 transition-transform" />
            <div className="[writing-mode:vertical-lr] text-[10px] font-black uppercase tracking-widest">展開日誌與分析</div>
          </button>
        )}

        {/* Floating Draggable Panels (Absolute positioned, consistent origin) */}
        {renderElfConsole("p1", p1)}
        {renderElfConsole("p2", p2)}

        {/* Combat Theater */}
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden relative pointer-events-none">
          
          {/* Top Row: Consoles */}
          <div className="flex justify-center items-start flex-1 min-h-0">
             
             {/* Center Status / Turn Info */}
             <div className="flex flex-col items-center gap-4 -mt-4 pointer-events-auto">
                <div className="px-6 py-2 bg-slate-900/80 border border-cyan-500/30 rounded-full flex items-center gap-4 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                   <div className="text-center">
                      <span className="text-[10px] text-slate-500 font-black block uppercase">回合</span>
                      <span className="text-2xl font-black text-cyan-400">{turnNumber}</span>
                   </div>
                   <div className="w-px h-8 bg-slate-800" />
                   <div className="text-center">
                      <span className="text-[10px] text-slate-500 font-black block uppercase">階段</span>
                      <span className="text-xs font-black text-white">{PHASE_LABEL[phase] || phase}</span>
                   </div>
                </div>
                
                <AnimatePresence>
                  {lastActionInfo && lastActionInfo.amount > 0 && (
                    <motion.div 
                      key={`${lastActionInfo.side}-${lastActionInfo.amount}`}
                      initial={{ opacity: 0, scale: 0.5, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.5, y: -50 }}
                      className="p-0 border-0 bg-transparent shadow-none"
                    >
                      {lastActionInfo && lastActionInfo.amount > 0 ? (
                        <div className={`px-5 py-2 rounded-2xl flex items-center gap-3 border-2 shadow-2xl backdrop-blur-xl ${
                          lastActionInfo.type === 'crit'
                            ? 'bg-gradient-to-r from-red-950 via-red-900 to-rose-950 border-amber-400 text-amber-200 shadow-[0_0_30px_rgba(239,68,68,0.8)]'
                            : lastActionInfo.type === 'true' || lastActionInfo.type === 'absorb'
                            ? 'bg-slate-950/95 border-slate-100 text-white shadow-[0_0_25px_rgba(255,255,255,0.85)]'
                            : lastActionInfo.type === 'fixed' || lastActionInfo.type === 'percent'
                            ? 'bg-pink-950/90 border-pink-500 text-pink-200 shadow-[0_0_20px_rgba(236,72,153,0.7)]'
                            : lastActionInfo.type === 'heal'
                            ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                            : lastActionInfo.type === 'adjust_up' || lastActionInfo.type === 'adjust_down'
                            ? 'bg-cyan-950/90 border-cyan-500 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.7)]'
                            : 'bg-amber-950/90 border-red-700 text-red-200 shadow-[0_0_20px_rgba(185,28,28,0.7)]'
                        }`}>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/50 border border-white/10 uppercase tracking-wider">
                            {lastActionInfo.side === 'p1' ? 'P1' : 'AI'} 【{lastActionInfo.targetElfName}】
                          </span>
                          <span className="text-xs font-black tracking-wide flex items-center gap-1">
                            {lastActionInfo.type === 'crit' && '💥 致命一擊'}
                            {lastActionInfo.type === 'skill' && '⚔️ 技能傷害'}
                            {lastActionInfo.type === 'fixed' && '💗 固定傷害'}
                            {lastActionInfo.type === 'percent' && '💗 百分比傷害'}
                            {lastActionInfo.type === 'true' && '⚡ 真實傷害'}
                            {lastActionInfo.type === 'absorb' && '⚡ 真實傷害'}
                            {lastActionInfo.type === 'heal' && '💚 體力回復'}
                            {(lastActionInfo.type === 'adjust_up' || lastActionInfo.type === 'adjust_down') && '🔄 體力調整'}
                          </span>
                          <span className="text-xl font-black font-mono tracking-tight">
                            {lastActionInfo.type === 'heal' || lastActionInfo.type === 'adjust_up' ? `+${lastActionInfo.amount}` : `-${lastActionInfo.amount}`} HP
                          </span>
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>

             <div className="h-32" />
          </div>
        </div>

        {/* Bottom Row: Tactical Command Console (Moved out of theater) */}
        <DraggableResizablePanel
            pos={tacticalPanel.pos}
            setPos={(pos) => setTacticalPanel(prev => ({ ...prev, pos }))}
            size={tacticalPanel.size}
            setSize={(size) => setTacticalPanel(prev => ({ ...prev, size }))}
            opacity={tacticalPanel.opacity}
            setOpacity={(opacity) => setTacticalPanel(prev => ({ ...prev, opacity }))}
            scale={tacticalPanel.scale}
            setScale={(scale) => setTacticalPanel(prev => ({ ...prev, scale }))}
            onReset={() => setTacticalPanel(defaultLayout ? defaultLayout.tactical : DEFAULT_TACTICAL_LAYOUT)}
            className="border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col shrink-0"
          >
            {/* Header */}
            <div className="bg-slate-800/40 border-b border-slate-700 px-6 py-3 flex justify-between items-center cursor-move">
               <div className="flex items-center gap-3">
                  <Layout className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-black text-sm tracking-widest text-slate-200">
                    {tacticalTab === "SKILLS" && "戰術指令與技能操作表"}
                    {tacticalTab === "TEAM" && "精靈陣容與即時切換"}
                    {tacticalTab === "ITEMS" && "戰備物資與道具選單"}
                    {tacticalTab === "EFFECTS" && "在場精靈狀態與效果檢視"}
                  </h2>
               </div>
               <div className="flex items-center gap-4">
                  <div className="flex gap-2 mr-4">
                    {["SKILLS", "TEAM", "ITEMS", "EFFECTS"].map(tab => (
                      <button 
                        key={tab}
                        onClick={() => setTacticalTab(prev => prev === tab && tab !== "SKILLS" ? "SKILLS" : tab as any)}
                        className={`px-3 py-1 rounded-md text-[10px] font-black tracking-widest transition-all ${tacticalTab === tab ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                      >
                        {tab === "SKILLS" && "技能"}
                        {tab === "TEAM" && "陣容"}
                        {tab === "ITEMS" && "道具"}
                        {tab === "EFFECTS" && "效果"}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-slate-500">自動戰鬥模式</span>
                     <button 
                        onClick={props.onAutoBattleToggle}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${isAutoBattle ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isAutoBattle ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                  </div>
                  {/* Scale/Opacity Controls */}
                  <div className="flex gap-4 text-[10px] items-center text-slate-300 border-l border-slate-700 pl-4">
                    <div className="flex items-center gap-1">
                      <span>縮放:</span>
                      <input type="range" min="0.5" max="1.5" step="0.1" value={tacticalPanel.scale} onChange={(e) => setTacticalPanel(prev => ({ ...prev, scale: parseFloat(e.target.value) }))} className="w-16" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>透明:</span>
                      <input type="range" min="0.2" max="1" step="0.1" value={tacticalPanel.opacity} onChange={(e) => setTacticalPanel(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))} className="w-16" />
                    </div>
                  </div>
               </div>
            </div>

            <div className="flex-1 flex bg-[#0A0D14]/90">
               {/* Main Content Area */}
               <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                  {tacticalTab === "SKILLS" && renderSkillsLegacy()}

                  {renderTacticalOther()}
               </div>

               {/* Action Sidebar */}
               <div className="w-48 bg-slate-900/40 border-l border-slate-800 p-6 flex flex-col gap-3">
                  <button 
                    onClick={() => setTacticalTab(prev => prev === "TEAM" ? "SKILLS" : "TEAM")}
                    className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-black shadow-lg transition-all active:scale-95 ${tacticalTab === "TEAM" ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  >
                    <RotateCcw className="w-4 h-4" /> 切換精靈
                  </button>
                  <button 
                    onClick={() => setTacticalTab(prev => prev === "ITEMS" ? "SKILLS" : "ITEMS")}
                    className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-black shadow-lg transition-all active:scale-95 ${tacticalTab === "ITEMS" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  >
                    <Activity className="w-4 h-4" /> 使用道具
                  </button>
                  <button 
                    onClick={() => setTacticalTab("SKILLS")}
                    className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-black shadow-lg transition-all active:scale-95 ${tacticalTab === "SKILLS" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  >
                    <Sword className="w-4 h-4" /> 技能列表
                  </button>
                  <button 
                    onClick={props.onBackToMenu}
                    className="w-full py-2.5 bg-rose-900/40 hover:bg-rose-900/60 text-rose-400 rounded-lg flex items-center justify-center gap-2 text-xs font-black border border-rose-900/40 mt-auto transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" /> 撤退離開
                  </button>
               </div>
            </div>
          </DraggableResizablePanel>
      </div>

      </>)}

      {/* Trait / Soul Mark Modal */}
      <AnimatePresence>
        {modalContent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[85vh] flex flex-col overflow-hidden"
            >
              <button 
                onClick={() => setModalContent(null)} 
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center z-10"
              >
                ✕
              </button>
              <h3 className="text-xl font-black text-white mb-4 pr-6 leading-tight shrink-0">{modalContent.title}</h3>
              <div className="overflow-y-auto custom-scrollbar pr-2">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                  {modalContent.content}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Skill Tooltip - Moved to root level with dynamic positioning */}
      {createPortal(<AnimatePresence>
        {hoveredSkill && hoveredSkillAnchor && (
          <div
            style={(() => {
              const spaceAbove = hoveredSkillAnchor.top || hoveredSkillAnchor.y;
              const showBelow = spaceAbove < 350; // Tooltip is approx 320px tall
              return {
                position: 'fixed',
                left: Math.min(Math.max(260, hoveredSkillAnchor.x), window.innerWidth - 260),
                top: showBelow ? (hoveredSkillAnchor.bottom || hoveredSkillAnchor.y) + 15 : (hoveredSkillAnchor.top || hoveredSkillAnchor.y) - 15,
                transform: showBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
                zIndex: 10002,
                pointerEvents: 'none',
              };
            })()}
          >
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="w-[500px] bg-slate-950/95 border-2 border-cyan-500 rounded-2xl p-6 shadow-[0_0_100px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-3xl ring-1 ring-white/10 pointer-events-none"
            >
                <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                      {hoveredSkill.name}
                      <span className={`px-2.5 py-1 rounded text-[11px] uppercase tracking-widest font-black ${getAttributeBadgeColor(hoveredSkill.type === "--" ? "無屬性" : (hoveredSkill.type || "無屬性"))} inline-flex items-center gap-1.5`}>
                        <TypeIcon type={hoveredSkill.type} size={18} showLabelWhenMissing={false} />{hoveredSkill.type && hoveredSkill.type !== "--" ? `${hoveredSkill.type}系` : (hoveredSkill.category === "屬性" ? "屬性技能" : "無屬性")}
                      </span>
                    </h3>
                    <div className="flex gap-3 mt-2">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-800/80 px-2 py-0.5 rounded border border-white/5">種類: {hoveredSkill.category}</span>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-800/80 px-2 py-0.5 rounded border border-white/5">PP: {hoveredSkill.pp}/{getMaxPp(hoveredSkill, p1)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-rose-500 italic leading-none drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]">
                      {hoveredSkill.category === "屬性" ? "屬性" : (hoveredSkill.power || "--")}
                    </div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1.5 opacity-60">
                      {hoveredSkill.category === "屬性" ? "STATUS SKILL" : "ATTACK POWER"}
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-900/60 rounded-xl px-4 py-3 mb-4 border border-white/5 min-h-[60px] flex flex-col justify-center">
                  {hoveredSkill.description ? (
                    <ul className="text-slate-200 text-[13px] leading-relaxed font-medium space-y-0.5">
                      {effectLines(hoveredSkill.description).map((l, i) => (
                        <li key={i} className="border-b border-white/5 last:border-0 pb-0.5">{l}</li>
                      ))}
                    </ul>
                  ) : <p className="text-slate-400 text-sm">該技能尚未登載詳細描述文本。</p>}
                  {hoveredSkill.specialBadge && (
                    <div className={`mt-3 px-3 py-2 rounded-xl border text-xs font-bold flex flex-col gap-1 ${hoveredSkill.specialBadge.bg || 'bg-amber-950/80'} ${hoveredSkill.specialBadge.color || 'text-amber-200'} ${hoveredSkill.specialBadge.border || 'border-amber-500/40'}`}>
                      <div className="flex items-center justify-between font-black">
                        <span className="flex items-center gap-1.5 text-amber-300">
                          ✨ {hoveredSkill.specialBadge.text}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${hoveredSkill.isRuneActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800/80 text-slate-400 border-slate-700/60'}`}>
                          {hoveredSkill.isRuneActive ? '【已激活】' : '【未激活】'}
                        </span>
                      </div>
                      {hoveredSkill.specialBadge.description && (
                        <div className="text-[11px] font-normal text-slate-300 leading-normal">
                          {hoveredSkill.specialBadge.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                  <div className="flex gap-5">
                    <span className="flex items-center gap-2 text-emerald-400"><div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 命中率: {(() => { const c = computeHitChance(p1, p2, hoveredSkill, (e) => getStatuses(e), battle.p2RegistryState); return c >= 1 && (hoveredSkill.isSureHit || /必中/.test(hoveredSkill.description || "")) ? "必中" : `${Math.round(c * 100)}%`; })()}</span>
                    <span className="flex items-center gap-2 text-cyan-400"><div className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]" /> 先制級: {hoveredSkill.priority || 0}</span>
                  </div>
                  {hoveredSkill.category !== "屬性" && (
                    <span className="text-amber-400 bg-amber-500/10 px-3 py-1 rounded border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                      {hoveredSkill.category === "物理" ? "物理攻擊" : "特殊攻擊"}
                    </span>
                  )}
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>, document.body)}

      {/* Display Settings Modal */}
      <AnimatePresence>
        {showDisplaySettings && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowDisplaySettings(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0A0D14]/95 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-2xl backdrop-blur-xl text-slate-200"
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-cyan-500/20">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Layout className="w-5 h-5 text-cyan-400" />
                  <span>戰鬥卡片顯示設定</span>
                </h3>
                <button
                  onClick={() => setShowDisplaySettings(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 bg-slate-800/80 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center justify-between mb-4 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs font-bold text-slate-300" title="場上精靈全身圖的顯示方式">精靈立繪</span>
                <div className="ios-segment">
                  {([["show", "顯示"], ["dim", "半透明"], ["hide", "隱藏"]] as const).map(([k, l]) => (
                    <button key={k} data-active={spriteMode === k} onClick={() => setSpriteMode(k)}>{l}</button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                卡片資訊區塊：
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {Object.entries(SECTION_LABELS).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all select-none group"
                  >
                    <input
                      type="checkbox"
                      checked={!!sectionVisibility[key]}
                      onChange={() => setSectionVisibility(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/40 focus:ring-offset-0 bg-slate-800 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                      {label}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <button
                  onClick={() => setSectionVisibility(DEFAULT_SECTION_VISIBILITY)}
                  className="text-xs text-slate-400 hover:text-cyan-400 font-bold transition-colors cursor-pointer"
                >
                  重置為預設全部顯示
                </button>
                <button
                  onClick={() => setShowDisplaySettings(false)}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  完成
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elf Detail Modal */}
      <AnimatePresence>
        {selectedElfDetail && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => setSelectedElfDetail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog" aria-modal="true" aria-label="戰鬥精靈介紹"
              className="ios-panel ios-dialog w-full max-w-3xl p-4 sm:p-6 text-slate-200 max-h-[88vh] overflow-y-auto custom-scrollbar"
            >
              {(() => {
                const selectedTeam = selectedElfDetail.side === "p1" ? p1Team : p2Team;
                const elf = selectedTeam[selectedElfDetail.idx] || selectedElfDetail.elf;
                const isActive = selectedElfDetail.idx === (selectedElfDetail.side === "p1" ? p1ActiveIndex : battle.p2ActiveIndex);
                const marks = (isActive ? (selectedElfDetail.side === "p1" ? battle.p1Marks : battle.p2Marks) : (elf.marks || []))
                  .filter(mark => markAppliesToElf(mark, elf));
                return <ElfReadOnlyProfile key={`${selectedElfDetail.side}-${selectedElfDetail.idx}`}
                  elf={elf} getSkillMaxPp={getMaxPp} subtitle={`${selectedElfDetail.side.toUpperCase()} · 精靈 #${selectedElfDetail.idx + 1}`}
                  effectiveBody={getEffectiveBody(elf, marks as any)} onClose={() => setSelectedElfDetail(null)}>
                  <section className="ios-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-cyan-300">能力等級狀態</h3>
                    <StatStagePanel elf={elf} isExpanded={true} disguiseAsNightmare={disguiseBattleStates} />
                  </section>
                  <section className="ios-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-rose-300">異常狀態與效果</h3>
                    <StatusBadgePanel elf={elf} emptyHint="無任何異常狀態或效果" disguiseAbnormalStatuses={disguiseBattleStates} />
                  </section>
                  {marks.length > 0 && <section className="ios-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-amber-300">目前印記</h3>
                    {marks.map((mark, i) => <details key={`${mark.id}-${i}`}>
                      <summary className="text-sm cursor-pointer">{mark.name} · {mark.count}</summary>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-6 mt-2">{mark.description}</p>
                    </details>)}
                  </section>}
                </ElfReadOnlyProfile>;
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(6, 182, 212, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.4);
        }
      `}} />
    </div>
  );
}
