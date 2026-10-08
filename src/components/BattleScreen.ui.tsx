import { BattleEndDialog, SpecialBattleEndDialog } from "./BattleEndDialog";
import { damagePopupStyle, damagePopupLabel } from '../battle/damagePopupStyle';
import { appearanceElf } from '../battle/illusion';
import { skillSlot } from '../battle/skillSlot';
import { hasBattleItem } from '../battle/itemInventory';
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
import { ProportionalSprite } from "./battle/ProportionalSprite";
import { hiddenFromViewer, viewerMaskTerms, maskViewerText, UNKNOWN_EFFECT, elfForViewer, visibleSkills } from "../battle/viewerPerspective";
import { isAliveBySurvivalRule } from "../battle/survivalRules";
import { statusVisual, buffIconFor, stageDesc, STAT_FULL, signIconFor, STATE_SIGNS } from "../battle/effectIcons";
import { markAppliesToElf } from "../battle/marks";
import { effectLines, formatEffectText, plainDescription } from "../utils/descFormat";
import { StatusRegistry } from "../effects/statusRegistry";
import { EFFECT_CATALOG } from "../data/effectCatalog";
import { BATTLE_ITEMS, ITEM_CATEGORIES, getItemCategory, ItemCategory, isZeroPpExempt, isElfSkillSelectionDisabled } from "../utils/battleHelpers";

interface BattleScreenUIProps {
  specialMode?: "destiny" | "interstellar";
  onSkillSelect: (side: "p1" | "p2", skill: Skill) => void;
  onSwitchElf: (side: "p1" | "p2", index: number) => void;
  onUseItem: (side: "p1" | "p2", item: BattleItem) => void;
  /** 特殊模式的藥劑次數（星際探索）；未提供＝不限 */
  potionLimit?: { left: number; max: number };
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
  // 隱匿：敵方隱匿精靈的名稱、技能、魂印與特質名稱在所有文字中改為未知。
  const fogTerms = useMemo(() => viewerMaskTerms(p2Team || []), [p2Team]);
  // 本地對戰畫面以 P1 為己方視角：魘味只改顯示，不觸碰戰鬥狀態資料。
  const disguiseBattleStates = Object.entries(getStatuses(p1) || {}).some(([name, turns]) =>
    (name === '魘味' || name === '魘昧') && Number(turns) > 0
  );

  // 魘昧：己方看到的文字中，異常狀態名稱一律顯示為魘昧。
  const nightmareStatusPattern = useMemo(() => new RegExp(`【(${Object.keys(StatusRegistry).filter(k => k.length >= 2 && !/魘/.test(k)).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})】`, 'g'), []);
  const fog = (text?: string) => {
    const masked = maskViewerText(text, fogTerms);
    return disguiseBattleStates ? masked.replace(nightmareStatusPattern, '【魘昧】') : masked;
  };

  // 防卡頓：傷害圖表按 damageDealt 緩存，避免每 effect 重算重繪（recharts 整圖重渲染是卡頓主因之一）。
  const chartData = useMemo(() => Object.entries(damageDealt || {}).map(([name, value]) => ({
    name: maskViewerText(name, fogTerms),
    value: Number(value)
  })).filter(d => d.value > 0), [damageDealt, fogTerms]);

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
  const [cardOpen, setCardOpen] = useState<Record<"p1" | "p2", boolean>>({ p1: false, p2: false });
  const [logOpen, setLogOpen] = useState(() => typeof window === "undefined" || (window.innerWidth >= 640 && window.innerHeight > 560));
  const [logPage, setLogPage] = useState(1);
  const [logFollow, setLogFollow] = useState(true);
  const [logCopied, setLogCopied] = useState(false);
  const [itemCat, setItemCat] = useState<ItemCategory | "all">("all");
  const [spriteMode, setSpriteMode] = useState<"show" | "dim" | "hide">(() => { try { return (localStorage.getItem("battleSpriteMode") as any) || "show"; } catch { return "show"; } });
  useEffect(() => { try { localStorage.setItem("battleSpriteMode", spriteMode); } catch {} }, [spriteMode]);
  const [hudOpacity, setHudOpacity] = useState(() => parseFloat(localStorage.getItem('hudOpacity') || "0.95"));
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && logFollow) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, logOpen, sidebarOpen, logFollow]);
  
  const battleRootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fieldSize, setFieldSize] = useState({ w: 0, h: 0 });
  const hudRefs = useRef<Record<"p1" | "p2", HTMLDivElement | null>>({ p1: null, p2: null });
  // 場地可用高度＝場地高 − 被上方 HUD／狀態列佔去的部分（立繪不得與資訊重疊）
  const [fieldReserve, setFieldReserve] = useState(0);
  useEffect(() => {
    const el = fieldRef.current; if (!el) return;
    const update = () => {
      setFieldSize(prev => prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight });
      const top = el.getBoundingClientRect().top;
      const bottoms = (["p1", "p2"] as const).map(k => hudRefs.current[k]?.getBoundingClientRect().bottom ?? 0);
      const r = Math.max(0, Math.ceil(Math.max(...bottoms) - top + 8));
      setFieldReserve(prev => Math.abs(prev - r) < 4 ? prev : r);
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    (["p1", "p2"] as const).forEach(k => { const h = hudRefs.current[k]; if (h) ro?.observe(h); });
    return () => ro?.disconnect();
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
                      const visual = damagePopupStyle(pop.type);
                      const label = damagePopupLabel(pop.label);
                      const isHeal = visual.heal;
                      const isSkillHit = visual.skill;
                      const eff = pop.effectiveness as string | undefined;
                      const effClass = eff === '克制' ? 'text-amber-300 border-amber-400/70 bg-amber-950/70' : eff === '微弱' ? 'text-sky-300 border-sky-400/60 bg-sky-950/70' : eff === '無效' ? 'text-slate-300 border-slate-500/60 bg-slate-900/80' : 'text-slate-200 border-slate-500/40 bg-slate-950/60';
                      const numClass = visual.colorClass;
                      return (
                        <motion.div
                          key={pop.id}
                          initial={{ opacity: 0, y: 14, scale: 0.6 }}
                          animate={{ opacity: 1, y: 0, scale: [0.6, 1.18, 1] }}
                          exit={{ opacity: 0, y: -18, scale: 0.95 }}
                          transition={{ duration: 0.28, ease: "easeOut" }}
                          className="flex flex-col items-center gap-0.5"
                          data-battle-popup={pop.type}
                          data-presentation-id={pop.id}
                          data-elf-id={pop.elfId}
                        >
                          {(eff && isSkillHit) || label || pop.isCrit ? (
                            <div className="flex items-center gap-1">
                              {eff && isSkillHit && <span className={`px-1.5 py-px rounded border text-xs font-black tracking-widest ${effClass}`} data-effectiveness={eff}>{eff}</span>}
                              {(label || pop.isCrit) && <span className="text-xs font-bold text-slate-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{fog(label || '暴擊')}</span>}
                            </div>
                          ) : null}
                          <span className={`${isSkillHit ? 'text-5xl' : 'text-3xl'} font-black tabular-nums ${numClass}`}
                            style={{ textShadow: visual.textShadow }}>{fog(pop.text)}</span>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
  );

  const renderElfDetails = (side: "p1" | "p2", elf: Elf) => {
    // 隱匿：敵方視角不展示能力等級、防護、異常、印記與計時效果。
    if (hiddenFromViewer(elf, side)) return <div className="text-[11px] text-slate-400 p-2 rounded border border-slate-800 bg-slate-900/60">{UNKNOWN_EFFECT}</div>;
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

  const LOG_PAGE_SIZE = 40;
  const logPages = Math.max(1, Math.ceil(logs.length / LOG_PAGE_SIZE));
  const shownPage = logFollow ? logPages : Math.min(logPage, logPages);
  const copyLogs = async () => {
    const text = logs.map(l => `第${l.turn}回合　${fog(l.text)}`).join("\n");
    try { await navigator.clipboard.writeText(text); setLogCopied(true); setTimeout(() => setLogCopied(false), 1500); }
    catch { setModalContent({ title: "對戰訊息（文字）", content: text }); }
  };
  const gotoLogPage = (n: number, where: "top" | "bottom") => {
    const pg = Math.max(1, Math.min(logPages, n));
    setLogFollow(pg >= logPages && where === "bottom");
    setLogPage(pg);
    requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollTop = where === "top" ? 0 : el.scrollHeight; });
  };
  const logTone = (type?: string) =>
    type === "damage" ? "border-l-rose-500 text-rose-100" :
    type === "heal" ? "border-l-emerald-500 text-emerald-100" :
    type === "status" ? "border-l-amber-500 text-amber-100" :
    type === "effect" ? "border-l-indigo-400 text-indigo-100" :
    type === "system" ? "border-l-cyan-400 text-cyan-100" :
    type === "defeat" ? "border-l-slate-400 text-slate-400" :
    type === "p1" ? "border-l-sky-400 text-sky-50" :
    type === "p2" ? "border-l-fuchsia-400 text-fuchsia-50" : "border-l-slate-500 text-slate-200";
  /** 對戰訊息公告欄：分頁、至頂／至底、複製成文字。 */
  const renderBattleLog = () => {
    const start = (shownPage - 1) * LOG_PAGE_SIZE;
    const pageLogs = logs.slice(start, start + LOG_PAGE_SIZE);
    let lastTurn = -1;
    return (
      <div className="bt-panel flex flex-col h-full min-h-0 overflow-hidden" data-battle-log>
        <div className="flex items-center gap-1 px-2.5 py-1.5 border-b whitespace-nowrap [&_.bt-btn]:px-1.5" style={{ borderColor: "var(--bt-line-soft)" }}>
          <span className="bt-title text-sm">對戰訊息</span>
          <span className="text-[11px] bt-muted tabular-nums">{logs.length}</span>
          <span className="flex-1" />
          <button className="bt-btn" onClick={copyLogs} title="複製全部對戰訊息為文字"><Copy className="w-3.5 h-3.5" />{logCopied ? "已複製" : ""}</button>
          <button className="bt-btn" onClick={() => gotoLogPage(1, "top")} title="至頂">至頂</button>
          <button className="bt-btn" disabled={shownPage <= 1} onClick={() => gotoLogPage(shownPage - 1, "bottom")} title="上一頁">‹</button>
          <span className="text-xs tabular-nums bt-muted min-w-[2.6rem] text-center">{shownPage}/{logPages}</span>
          <button className="bt-btn" disabled={shownPage >= logPages} onClick={() => gotoLogPage(shownPage + 1, "top")} title="下一頁">›</button>
          <button className="bt-btn" onClick={() => gotoLogPage(logPages, "bottom")} title="至底（跟隨最新）">至底</button>
        </div>
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1 text-[13px] leading-relaxed custom-scrollbar"
          onScroll={e => { const el = e.currentTarget; if (shownPage === logPages) setLogFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24); }}>
          {pageLogs.map((log, idx) => {
            const head = log.turn !== lastTurn; lastTurn = log.turn;
            return (
              <React.Fragment key={start + idx}>
                {head && <div className="text-[11px] font-black bt-accent pt-1 tracking-widest">第 {log.turn} 回合</div>}
                <div className={`bt-log-line ${logTone(log.type)}`}>{fog(log.text)}</div>
              </React.Fragment>
            );
          })}
          {!pageLogs.length && <div className="text-center text-xs bt-muted py-6">尚無對戰訊息</div>}
        </div>
      </div>
    );
  };

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
                              className={`group relative flex items-center gap-2 text-left bg-slate-900/60 border rounded-xl px-2 py-1.5 transition-all cursor-pointer
                                ${idx === p1ActiveIndex ? 'border-cyan-500 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.1)] opacity-100 grayscale-0' : isExtra ? 'border-amber-500/40 bg-amber-950/10 shadow-[0_0_10px_rgba(245,158,11,0.05)] hover:border-amber-400' : 'border-slate-800 hover:border-slate-600'} 
                                ${isDead || elf.isVanished ? 'opacity-40 grayscale' : ''}`}
                              disabled={!isExtra && (idx === p1ActiveIndex || isDead || (phase !== "p1_select" && !phase.includes("forced_switch")))}
                            >
                               <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden border border-cyan-500/40 bg-slate-900"><ElfAvatar elf={elf} battleSide="p1" kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full flex items-center justify-center text-xl font-black text-slate-300" /></div>
                               <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                               <span className={`text-xs font-black truncate ${isExtra ? 'text-amber-400' : 'text-white'}`}>{hiddenFromViewer(elf, "p1") ? "未知精靈" : elf.name}</span>
                               {!hiddenFromViewer(elf, "p1") && <span className="inline-flex items-center gap-1 text-[11px] text-slate-300 truncate"><TypeIcon type={elf.type} size={14} />{elf.type}</span>}
                               <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full ${getHpBarColor(elf.currentHp, elf.maxHp)}`} style={{ width: `${elf.maxHp > 0 ? (elf.currentHp / elf.maxHp) * 100 : 0}%` }} />
                               </div>
                               <span className="text-[9px] font-bold text-slate-400 leading-none">{elf.currentHp}/{elf.maxHp}</span>
                               </div>
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
                      {props.potionLimit && (
                        <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-black ${props.potionLimit.left > 0 ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-rose-500/50 bg-rose-950/40 text-rose-300"}`} data-potion-limit>
                          <span>藥劑次數</span>
                          <span className="tabular-nums" title="「特殊」類道具不計次">{props.potionLimit.left} / {props.potionLimit.max}{props.potionLimit.left <= 0 ? "　已用盡（特殊類仍可用）" : ""}</span>
                        </div>
                      )}
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
                          const stock = battle.p1ItemInventory?.[item.id];
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
                              disabled={phase !== "p1_select" || !hasBattleItem(battle.p1ItemInventory, item.id) || (!!props.potionLimit && props.potionLimit.left <= 0 && item.type !== "special")}
                            >
                              <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center border ${tone}`}>
                                <FlaskConical className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-black text-white truncate">{item.name}</div>
                                {stock && <div className="text-[11px] font-bold text-amber-200 tabular-nums" data-item-stock={item.id}>{stock.left}/{stock.max}</div>}
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


  const aliveCount = (team: Elf[]) => team.filter((e, i) => e && !e.isExtra && i < 6 && !e.isVanished && (isAliveBySurvivalRule(e.currentHp, e.survivalRule) || (e.deathImmunity && e.deathImmunity.deathImmuneTurns > 0))).length;

  const catalogDesc = (c: any, inst: any) => {
    try { return typeof c?.describe === "function" ? c.describe(inst || {}) : (c?.description || ""); } catch { return c?.description || ""; }
  };

  const renderChips = (side: "p1" | "p2", elf: Elf) => {
    if (hiddenFromViewer(elf, side)) return (
      <div className="flex flex-wrap gap-1"><span className="px-1.5 py-0.5 rounded border border-slate-600 bg-slate-900/80 text-[10px] text-slate-300">{UNKNOWN_EFFECT}</span></div>
    );
    type Chip = { key: string; text: string; cls: string; name: string; desc?: string; icon?: string; stageLabel?: string; stageValue?: string };
    const rows: { key: string; label: string; chips: Chip[]; vertical?: boolean }[] = [];
    const addRow = (key: string, label: string, chips: Chip[], vertical = false) => {
      if (chips.length) rows.push({ key, label, chips, vertical });
    };

    // 第 2 行：沿用遊戲畫面的緊湊文字標籤；通用強化／弱化素材不是各能力等級的準確圖示。
    const stageLabels: Record<string, string> = { atk: "攻擊", def: "防禦", spatk: "特攻", spdef: "特防", speed: "速度", accuracy: "命中" };
    const stageChips: Chip[] = [];
    const stages = (elf.statStages || {}) as Record<string, number>;
    // 魘昧（官方）：能力提升狀態對己方展示為 1 回合的魘昧；能力下降照常顯示。
    if (disguiseBattleStates && Object.values(stages).some(value => Number(value) > 0)) {
      stageChips.push({ key: "stage-nightmare", name: "魘昧", text: "魘昧(1)", cls: "border-purple-500/40 bg-purple-950/50 text-purple-200", icon: statusVisual("魘昧")?.icon, desc: StatusRegistry["魘昧"].description });
    }
    {
      for (const key of ["atk", "def", "spatk", "spdef", "speed", "accuracy"]) {
        const value = Number(stages[key] || 0);
        if (!value || (disguiseBattleStates && value > 0)) continue;
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
      const visual = statusVisual('魘昧');
      statusChips.push({ key: 's-魘昧-mask', name: '魘昧', text: '魘昧(1)', cls: "bg-rose-950/70 text-rose-200 border-rose-500/40", desc: StatusRegistry['魘昧'].description, icon: visual?.icon });
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
          cls: "bg-yellow-950/70 text-yellow-200 border-yellow-500/40", desc: describeEffectMeta(effect), icon: signIconFor(effect.label),
        });
      } else {
        const cls = effect.category === "count" ? "bg-violet-950/70 text-violet-200 border-violet-500/40"
          : effect.polarity === "negative" ? "bg-rose-950/70 text-rose-200 border-rose-500/40"
            : "bg-cyan-950/70 text-cyan-200 border-cyan-500/40";
        effectChips.push({
          key: effect.id, name: effect.label,
          text: `${effect.label} ${effect.value ?? ""}${effect.unit || ""}`.trim(),
          cls, desc: describeEffectMeta(effect), icon: signIconFor(effect.label) || buffIconFor(effect.label),
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
    // 以狀態鍵記錄的專屬印記（星芳之纏／星海之浸／星火之灼）：沒有計時器實體，另行顯示。
    {
      const reg = (side === "p1" ? battle.p1RegistryState : battle.p2RegistryState) || {};
      const opp = side === "p1" ? p2 : p1;
      for (const sg of STATE_SIGNS) {
        const n = Number(reg[sg.key] || 0);
        if (n <= 0 || effectChips.some(c => c.name === sg.name)) continue;
        const src = opp?.soulMark?.description || "";
        const at = src.indexOf(`${sg.name}:`) >= 0 ? src.indexOf(`${sg.name}:`) : src.indexOf(`${sg.name}：`);
        effectChips.unshift({ key: `sign-${sg.key}`, name: sg.name, text: `${sg.name}（${n}）`, cls: "bg-yellow-950/70 text-yellow-200 border-yellow-500/40",
          desc: at >= 0 ? src.slice(at) : `專屬印記・剩餘 ${n} 回合`, icon: signIconFor(sg.name) });
      }
    }
    addRow("effects", "印記 / 回合", effectChips);
    if (!rows.length) return null;
    // 頭像下方分層：能力等級（小長方形）→ 異常 → 印記與回合類；每層各占一列，不併排。
    return (
      <div className={`flex flex-col gap-1 ${side === "p2" ? "items-end" : "items-start"}`} data-status-tray={side}>
        {[...rows].sort((a, b) => ["stages", "effects", "statuses"].indexOf(a.key) - ["stages", "effects", "statuses"].indexOf(b.key)).map(row => (
          <div key={row.key} data-tray-row={row.key} className={`flex flex-wrap gap-1 ${side === "p2" ? "justify-end" : ""}`}>
            {row.chips.map(chip => (
              <button type="button" key={chip.key} title={`${chip.name}\n${chip.desc || ""}`}
                onClick={() => setModalContent({ title: chip.name, content: chip.desc || chip.name })}
                className={row.key === "stages"
                  ? `inline-flex h-[44px] w-[44px] short:h-[32px] short:w-[34px] shrink-0 flex-col items-center justify-center rounded border text-center font-bold leading-none hover:brightness-125 shadow-[0_2px_6px_rgba(0,0,0,.5)] ${chip.cls}`
                  : `bt-tile hover:brightness-125 shadow-[0_2px_6px_rgba(0,0,0,.5)] ${chip.cls}`}>
                {row.key === "stages"
                  ? <><span className="text-[11px]">{chip.stageLabel}</span><span className="font-mono text-[15px] mt-0.5">{chip.stageValue}</span></>
                  : <>{chip.icon && <ChainImage urls={[chip.icon]} className="h-5 w-5 shrink-0 rounded-sm object-contain" />}<span className="whitespace-nowrap">{chip.text}</span></>}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  };

  /** 精靈 HUD：頭像＋名稱＋體力。詳細資訊收在頭像點開的頁面。 */
  const renderCard = (side: "p1" | "p2") => {
    const isP1 = side === "p1";
    const elf = appearanceElf(elfForViewer(isP1 ? p1 : p2, side));
    if (!elf) return null;
    const idx = isP1 ? p1ActiveIndex : battle.p2ActiveIndex;
    const hpPct = elf.maxHp > 0 ? Math.max(0, Math.min(100, (elf.currentHp / elf.maxHp) * 100)) : 0;
    const hidden = hiddenFromViewer(elf, side);
    const openDetail = () => !hidden && setSelectedElfDetail({ elf, side, idx });
    const isShaking = props.consoleShake?.[side];
    const trait = elf.alienTraits?.gen2Trait || elf.alienTraits?.exclusiveTrait || elf.alienTraits?.alienTrait || elf.alienTraits?.generalTrait;
    return (
      <div className={`pointer-events-auto w-full bt-panel transition-colors ${isShaking ? "!border-rose-500/80" : ""}`} data-hud={side}>
        <div className={`flex items-center gap-3 p-2.5 ${isP1 ? "" : "flex-row-reverse"}`}>
          <button type="button" onClick={openDetail} title="精靈詳情（狀態、能力、印記、計時效果）"
            className="relative shrink-0 w-14 h-14 sm:w-[84px] sm:h-[84px] short:w-11 short:h-11 rounded-full overflow-hidden border-2 bg-slate-900 hover:scale-105 transition-transform"
            style={{ borderColor: "var(--bt-line)" }}>
            <ElfAvatar elf={elf} battleSide={side} kind="head"
              className={`w-full h-full object-cover ${side === "p1" && elf.name === "異境神霆·雷伊" ? "-scale-x-100" : ""}`} />
            {!hidden && <span className="absolute bottom-0 inset-x-0 text-[10px] font-black bg-black/60 text-white/90 leading-4">詳情</span>}
          </button>
          <div className={`flex-1 min-w-0 ${isP1 ? "" : "text-right"}`}>
            <div className={`flex items-center gap-1.5 min-w-0 ${isP1 ? "" : "flex-row-reverse"}`}>
              {!hidden && <TypeIcon type={elf.type} size={24} />}
              <button type="button" onClick={openDetail} className="font-black text-sm sm:text-lg truncate hover:brightness-125" style={{ fontFamily: "var(--bt-title-font)" }}>
                {hidden ? "未知精靈" : elf.name}
              </button>
              {!hidden && elf.soulMark && (
                <button type="button" onClick={() => setModalContent({ title: elf.soulMark?.name || "魂印", content: elf.soulMark?.description || "" })}
                  title={`魂印：${elf.soulMark.name}`}
                  className="hidden sm:inline shrink-0 px-1.5 rounded bg-purple-900/70 border border-purple-500/50 text-xs font-black text-purple-200 hover:bg-purple-800/70">
                  「{elf.soulMark.badgeChar || (elf.soulMark.name || "").slice(0, 1)}」
                </button>
              )}
              {!hidden && trait && (
                <button type="button" onClick={() => setModalContent({ title: trait.name, content: trait.description })} title={`特質：${trait.name}`}
                  className="hidden sm:inline shrink-0 px-1.5 rounded bg-amber-900/60 border border-amber-500/40 text-[11px] font-bold text-amber-200">{trait.name}</button>
              )}
              {!hidden && elf.trait && (
                <button type="button" onClick={() => setModalContent({ title: elf.trait!.name, content: elf.trait!.description })} title={`特性：${elf.trait.name}`}
                  className="hidden sm:inline shrink-0 px-1.5 rounded bg-indigo-900/60 border border-indigo-500/40 text-[11px] font-bold text-indigo-200">{elf.trait.name}</button>
              )}
            </div>
            <div className="bt-hp mt-2">
              <div className={`absolute inset-y-0 ${isP1 ? "left-0" : "right-0"} transition-all duration-300 ${getHpBarColor(elf.currentHp, elf.maxHp)}`} style={{ width: `${hpPct}%` }} />
              <div className="absolute inset-0 flex items-center justify-between px-1.5 sm:px-2.5 text-[10px] sm:text-[13px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] tabular-nums">
                <span>{elf.currentHp}/{elf.maxHp}</span>
                <span>{hpPct >= 10 ? Math.round(hpPct) : hpPct.toFixed(1)}%</span>
              </div>
            </div>
            {(elf.shield || 0) + (elf.barrier || 0) > 0 && (
              <div className={`mt-1.5 flex gap-1.5 ${isP1 ? "" : "justify-end"}`} data-protection={side}>
                {(elf.shield || 0) > 0 && <button type="button" onClick={() => setModalContent({ title: "護盾", content: "優先吸收技能攻擊傷害。" })} title="護盾：優先吸收技能攻擊傷害"
                  className="bt-tile border-sky-500/40 bg-sky-950/60 text-sky-200"><ChainImage urls={[signIconFor("護盾")!]} className="h-5 w-5 object-contain" />護盾 {elf.shield}</button>}
                {(elf.barrier || 0) > 0 && <button type="button" onClick={() => setModalContent({ title: "護罩", content: "優先吸收固定與百分比傷害。" })} title="護罩：優先吸收固定與百分比傷害"
                  className="bt-tile border-fuchsia-500/40 bg-fuchsia-950/60 text-fuchsia-200"><ChainImage urls={[signIconFor("護罩")!]} className="h-5 w-5 object-contain" />護罩 {elf.barrier}</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMatchInfo = () => {
    const fogged = hiddenFromViewer(p1, "p1") || hiddenFromViewer(p2, "p2");
    const shownP1 = elfForViewer(p1, 'p1'), shownP2 = elfForViewer(p2, 'p2');
    const m1 = p1 && p2 ? getTypeMatchup(shownP1.type, shownP2.type) : 1;
    const m2 = p1 && p2 ? getTypeMatchup(shownP2.type, shownP1.type) : 1;
    const multCls = (m: number) => fogged ? "text-slate-400" : m > 1 ? "text-rose-400" : m === 0 ? "text-slate-500" : m < 1 ? "text-sky-300" : "text-slate-100";
    const fmt = (m: number) => fogged ? "×?" : `×${Number(m.toFixed(3))}`;
    // 陣容點：一般精靈（計勝負）＋額外精靈（金色菱形，不計勝負）
    const dots = (side: "p1" | "p2") => {
      const team = side === "p1" ? p1Team : p2Team;
      const activeIdx = side === "p1" ? p1ActiveIndex : battle.p2ActiveIndex;
      const n = aliveCount(team);
      const extras = team.filter((e, i) => e && (e.isExtra || i >= 6)).length;
      return (
        <span className={`flex items-center gap-1.5 ${side === "p2" ? "flex-row-reverse" : ""}`}
          title={`剩餘 ${n} 隻（計入勝負）${extras ? `\n額外精靈 ${extras} 隻：不計入勝負` : ""}`}>
          <span className={`flex flex-wrap gap-1 max-w-[110px] ${side === "p2" ? "justify-end" : ""}`}>
            {team.map((e, i) => {
              if (!e) return null;
              const extra = !!e.isExtra || i >= 6;
              const dead = e.isVanished || (!isAliveBySurvivalRule(e.currentHp, e.survivalRule) && !(e.deathImmunity && e.deathImmunity.deathImmuneTurns > 0));
              const active = i === activeIdx;
              return (
                <button key={i} type="button" onClick={() => !hiddenFromViewer(e, side) && setSelectedElfDetail({ elf: e, side, idx: i })}
                  title={`${hiddenFromViewer(e, side) ? "未知精靈" : elfForViewer(e, side).name}${extra ? "（額外精靈・不計勝負）" : ""}${e.isVanished ? "（消逝）" : dead ? "（陣亡）" : active ? "（出戰中）" : ""}`}
                  className={`${extra ? "w-2 h-2 rotate-45 rounded-[1px]" : "w-2 h-2 rounded-full"} ${
                    extra ? (dead ? "bg-amber-900/60" : "bg-amber-400") : dead ? "bg-slate-700" : active ? "bg-cyan-300 ring-1 ring-cyan-200" : "bg-emerald-400"
                  } hover:scale-150 transition-transform`} />
              );
            })}
          </span>
          <span className="text-base font-black text-white">{n}</span>
          {extras > 0 && <span className="text-xs font-bold text-amber-300" title="額外精靈不計入勝負">+{extras}</span>}
        </span>
      );
    };
    const limit = battle.battleFormat === "peak_6v6" ? 50 : 0;
    return (
      <div className="flex flex-col items-center gap-1.5 pointer-events-auto" data-match-info>
        <div className="bt-panel px-5 py-1 flex items-baseline gap-2">
          <span className="text-sm font-black bt-muted">第</span>
          <span className="text-3xl font-black bt-accent tabular-nums leading-none">{turnNumber}</span>
          <span className="text-sm font-black bt-muted">回合</span>
          {limit > 0 && <span className="text-xs font-bold bt-muted" title="巔峰 6V6：滿 50 回合依存活精靈數判勝負（額外精靈不計）">/ {limit}</span>}
          <span className="ml-1 text-xs font-bold bt-muted">{PHASE_LABEL[phase] || phase}</span>
        </div>
        <div className="bt-panel flex flex-col items-center gap-1 px-4 py-1.5">
          <div className="flex items-center gap-2.5">
            <TypeIcon type={shownP1?.type} size={30} />
            <span className={`text-xl font-black tabular-nums ${multCls(m1)}`} title="我方屬性對對方的克制倍率">{fmt(m1)}</span>
            <span className="text-xs font-black bt-muted">VS</span>
            <span className={`text-xl font-black tabular-nums ${multCls(m2)}`} title="對方屬性對我方的克制倍率">{fmt(m2)}</span>
            {hiddenFromViewer(p2, "p2") ? <span className="text-base font-black text-slate-400">?</span> : <TypeIcon type={shownP2?.type} size={30} />}
          </div>
          <div className="flex items-center gap-4">{dots("p1")}<span className="w-px h-3 bg-white/15" />{dots("p2")}</div>
        </div>
      </div>
    );
  };

  const renderSprite = (side: "p1" | "p2") => {
    const isP1 = side === "p1";
    const elf = appearanceElf(isP1 ? p1 : p2);
    if (!elf) return null;
    const isActing = props.activeSkillAnim?.side === side;
    // 額外行動紅字播放時，攻擊方也做一次出招動作
    const extraStrike = (battle.floatingDamagePopups || props.floatingDamagePopups || []).some((p: any) => p.sourceSide === side && p.channel === 'extra');
    const isAttacking = (isActing && props.activeSkillAnim?.category !== 'property') || extraStrike;
    const isShaking = props.consoleShake?.[side];
    const skillPopup = (battle.floatingDamagePopups || props.floatingDamagePopups || []).find((p: any) => p.sourceSide === side && p.skillName);
    const skillBanner: string | null = skillPopup?.skillName || (isActing ? props.activeSkillAnim?.skillName : null) || null;
    const isHit = (battle.floatingDamagePopups || props.floatingDamagePopups || []).some((p: any) => p.side === side && p.type === 'skill' && p.amount > 0);
    const anim = isHit ? { x: [0, isP1 ? -10 : 10, isP1 ? 6 : -6, 0], filter: ['brightness(1)', 'brightness(2.2)', 'brightness(1)'] }
      : isAttacking ? { x: [0, isP1 ? 40 : -40, 0], filter: 'brightness(1)' }
      : isActing ? { x: 0, filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'] }
      : { x: 0, filter: 'brightness(1)' };
    const dead = !isAliveBySurvivalRule(elf.currentHp, elf.survivalRule);
    const spriteProfile = battleSpriteProfile(elf.name);
    const height = Number(elf.height);
    const spriteScale = battleSpriteScale(elf.name, height);

    // 一般精靈：依身高比例、量測可見區域擺放；咤克斯（大型首領）維持專用框
    if (!spriteProfile) {
      const fw = fieldSize.w, fh = Math.max(120, fieldSize.h - fieldReserve);
      if (!fw || !fh) return (
        <div className={`absolute bottom-[30%] ${isP1 ? "left-[19%]" : "right-[19%]"} z-30 pointer-events-none flex flex-col items-center gap-1.5 w-max`}>{renderPopups(side)}</div>
      );
      return (
        <ProportionalSprite key={elf.battleId || elf.id} elf={elf} side={side} anchorX={fw * (isP1 ? 0.165 : 0.835)} stageW={fw * 0.32} stageH={fh}
          anim={anim} dead={dead} opacity={spriteMode === "hide" ? 0 : spriteMode === "dim" ? 0.55 : 1}
          overlay={(visible) => <>
            <div className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5 w-max" style={{ bottom: Math.min(visible * 0.78, fh - 120) }}>
              {renderPopups(side)}
            </div>
            {skillBanner && (
              <motion.div key={skillBanner} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none w-max max-w-[80vw]" style={{ bottom: Math.max(40, visible * 0.42) }}>
                <span className="block px-4 py-1.5 bt-panel text-xl font-black tracking-wider bt-accent truncate">{fog(skillBanner)}</span>
              </motion.div>
            )}
          </>} />
      );
    }
    const spriteStyle: React.CSSProperties = spriteProfile
      ? { width: spriteProfile.width || "54%", height: spriteProfile.height || "118%" }
      : { width: "26%", height: "74%", maxHeight: 400 };
    return (
      <div className={`absolute bottom-[2%] ${isP1 ? (spriteProfile ? "left-0" : "left-[4%]") : (spriteProfile ? "right-0" : "right-[4%]" )} flex items-end justify-center pointer-events-none`}
        style={{ ...spriteStyle, opacity: spriteMode === "dim" ? 0.55 : 1, display: spriteMode === "hide" ? "none" : undefined }}>
        {/* 受擊數字：立繪中上方 */}
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5 w-max">
          {renderPopups(side)}
        </div>
        {/* 技能名：顯示在使用方本體上，持續到該技能紅字播完 */}
        {skillBanner && (
          <motion.div key={skillBanner} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
            className="absolute top-[48%] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-max max-w-[90%]">
            <span className="block px-4 py-1.5 rounded-md border border-cyan-300/50 bg-slate-950/80 text-xl font-black tracking-wider text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.35)] truncate">{fog(skillBanner)}</span>
          </motion.div>
        )}
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
    const baseSkills = visibleSkills(p1);
    const displaySkills = baseSkills.length >= 5 ? [baseSkills[4], baseSkills[0], baseSkills[1], baseSkills[2], baseSkills[3]] : baseSkills;
    const isMars = p1?.name === "變革·馬爾修斯";
    return (
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2.5">
        {displaySkills.map((skill, i) => {
          const slot = skill.battleSlot!;
          const original = { ...p1.skills[slot], battleSlot: slot };
          const isFifth = !!original.isFifthSkill || slot === 4;
          const uses = skill.charge !== undefined ? skill.charge : skill.pp;
          const disabled = phase !== "p1_select" || isElfSkillSelectionDisabled(p1) || (uses <= 0 && !isZeroPpExempt(p1, skill, p2));
          const selected = skillSlot(p1, p1SelectedSkill) === slot;
          const hover = p1.illusion && !p1.isInherentInvalid ? { ...skill, name: `${original.name} → ${skill.name}`,
            description: `【原技能】${original.name}\n${original.description}\n\n【轉化後】${skill.name}\n${skill.description}` } : skill;
          return (
            <button
              key={i}
              onClick={(e) => {
                // 手機端：沒有 hover，點已選中的技能彈說明浮窗，再點收起；點未選中的照常選招。
                if (phase === "p1_select" && selected && hoveredSkill?.battleSlot === slot) {
                  setHoveredSkill(null); setHoveredSkillAnchor(null); return;
                }
                if (phase === "p1_select") {
                  props.onSkillSelect("p1", original);
                  // 手機 tap 同步彈說明（無 hover 環境下看得到技能描述）
                  try {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setHoveredSkillAnchor({ x: rect.left + rect.width / 2, y: rect.top, top: rect.top, bottom: rect.bottom });
                    setHoveredSkill(hover);
                  } catch { /* 略過 */ }
                }
              }}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHoveredSkillAnchor({ x: rect.left + rect.width / 2, y: rect.top, top: rect.top, bottom: rect.bottom });
                setHoveredSkill(hover);
              }}
              onMouseLeave={() => { setHoveredSkill(null); setHoveredSkillAnchor(null); }}
              disabled={disabled}
              className={`bt-skill group relative flex flex-col gap-1 short:gap-0 px-2.5 pt-2.5 pb-2 short:py-1 text-left transition-all disabled:opacity-45 disabled:cursor-not-allowed min-h-[52px] short:min-h-[38px] ${isFifth ? "!border-amber-400/80 shadow-[0_0_14px_rgba(245,158,11,0.25)]" : ""} ${selected ? "ring-2 ring-cyan-400" : ""}`}
            >
              {isFifth && <span className="absolute -top-2 left-2 px-1.5 rounded bg-gradient-to-r from-amber-500 to-yellow-400 text-[10px] font-black text-slate-900 shadow">第五</span>}
              {skill.specialBadge && (
                <span className={`absolute -top-2 right-2 px-1.5 rounded text-[9px] font-black border ${skill.specialBadge.bg || "bg-purple-900/90"} ${skill.specialBadge.color || "text-purple-200"} ${skill.specialBadge.border || "border-purple-500/40"}`}>{skill.specialBadge.text}</span>
              )}
              <div className="flex items-center gap-1.5 min-w-0">
                <TypeIcon type={original.type && original.type !== "--" ? original.type : "無屬性"} size={20} />
                <span className="font-black text-xs sm:text-[15px] text-white truncate group-hover:brightness-125">{original.name}</span>
              </div>
              {p1.illusion && !p1.isInherentInvalid && skill.name !== original.name && <div className="text-[10px] sm:text-xs text-cyan-200 truncate" title={`原技能固有效果保留；實際使用：${skill.category}／${skill.type}／威力${skill.power}`}>轉化 → {skill.name} · {skill.type} · {skill.category}</div>}
              <div className="flex items-center justify-between text-xs bt-muted">
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
      {/* 場地：立繪依身高比例擺放（左右），中間留給對戰訊息 */}
      <div ref={fieldRef} className="absolute inset-x-0 top-[250px] sm:top-[120px] bottom-[290px] sm:bottom-[214px] short:top-[60px] short:bottom-[112px] pointer-events-none">
        {renderSprite("p1")}
        {renderSprite("p2")}
      </div>

      {/* 上方：雙方 HUD（頭像・名稱・體力），下方為狀態圖示 */}
      {(["p1", "p2"] as const).map(side => {
        const elf = side === "p1" ? p1 : p2;
        return (
          <div key={side} ref={el => { hudRefs.current[side] = el; }} className={`absolute top-[172px] sm:top-[56px] short:top-[58px] ${side === "p1" ? "left-2 sm:left-3 items-start" : "right-2 sm:right-3 items-end"} w-[48%] sm:w-[min(440px,29%)] short:w-[min(300px,28%)] z-30 flex flex-col gap-1.5 short:gap-1`}>
            {renderCard(side)}
            <div className={`w-full ${side === "p1" ? "pl-1" : "pr-1"}`}>{elf && renderChips(side, elf)}</div>
          </div>
        );
      })}
      <div className="absolute top-[56px] sm:top-2 left-1/2 -translate-x-1/2 z-20 max-sm:scale-90 short:scale-75 short:origin-top short:top-0">{renderMatchInfo()}</div>

      {/* 中間：對戰訊息公告欄（開關在指令列中間） */}
      {logOpen && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 w-[94%] sm:w-[min(500px,34%)] top-[250px] sm:top-[178px] bottom-[300px] sm:bottom-[214px] short:top-[44px] short:bottom-[112px] short:w-[min(560px,46%)] pointer-events-auto flex flex-col">
          <div className="flex-1 min-h-0">{renderBattleLog()}</div>
        </div>
      )}

      {/* 下方：指令 */}
      <div className="absolute inset-x-2 sm:inset-x-3 bottom-2 z-30 pointer-events-auto">
        <div className="bt-panel">
          <div className="flex items-center gap-1.5 px-3 pt-2 short:pt-1 flex-wrap">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTacticalTab(t.key)} className="bt-tab" data-active={tacticalTab === t.key}>
                {t.label}{t.key === "ITEMS" && props.potionLimit ? <span className={`ml-1 tabular-nums ${props.potionLimit.left > 0 ? "text-amber-300" : "text-rose-400"}`}>{props.potionLimit.left}</span> : null}
              </button>
            ))}
            <span className="flex-1 min-w-0 truncate px-2 text-xs bt-muted max-sm:hidden">
              {phase === "p1_select" ? "請選擇指令" : phase.includes("forced_switch") ? "請選擇出戰精靈" : PHASE_LABEL[phase] || ""}
            </span>
            <button onClick={() => setLogOpen(v => !v)} className="bt-btn shrink-0" data-active={logOpen} data-log-toggle>{logOpen ? "收起對戰訊息" : "打開對戰訊息"}</button>
            <span className="flex-1 max-sm:hidden" />
            <button onClick={props.onAutoBattleToggle} title="自動戰鬥" className="bt-btn" style={isAutoBattle ? { background: "#059669", color: "#fff", borderColor: "#34d399" } : undefined}>托管</button>
            <button onClick={() => setShowDisplaySettings(true)} title="顯示設定" className="bt-btn"><Layout className="w-4 h-4" /></button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'battle' } }))} title="戰鬥設定" className="bt-btn"><Settings className="w-4 h-4" /></button>
            <button onClick={props.onBackToMenu} title="撤退離開" className="bt-btn !text-rose-300 !border-rose-800/70">撤退</button>
          </div>
          <div className="p-3 pt-2.5 short:p-1.5 max-h-[30vh] sm:max-h-[150px] short:max-h-[70px] overflow-y-auto custom-scrollbar">
            {tacticalTab === "SKILLS" ? renderSkillRow() : renderTacticalOther()}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={battleRootRef} data-battle-root data-skin={props.specialMode === "interstellar" ? "eclipse" : "default"} className="h-full w-full bg-transparent overflow-hidden relative font-sans text-slate-200">
      {winner && !props.specialMode && <BattleEndDialog winner={winner} onRestart={props.onReset} onHome={props.onBackToMenu} />}
      {winner && props.specialMode && <SpecialBattleEndDialog winner={winner} mode={props.specialMode} onBack={props.onBackToMenu} />}
      {/* Global Interaction Blocker while resolving or during transitions */}
      {(phase === "resolving" || phase === "processing") && (
        <div className="fixed inset-0 z-[100] cursor-wait" />
      )}

      {/* Background Blueprint Grid - Lower Opacity to show theme background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)] pointer-events-none" />

      {renderFixedLayout()}


      {/* Trait / Soul Mark Modal */}
      <AnimatePresence>
        {modalContent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bt-panel max-w-xl w-full p-6 relative max-h-[85vh] flex flex-col overflow-hidden"
            >
              <button 
                onClick={() => setModalContent(null)} 
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center z-10"
              >
                ✕
              </button>
              <h3 className="bt-title text-xl mb-4 pr-6 leading-tight shrink-0">{modalContent.title}</h3>
              <div className="overflow-y-auto custom-scrollbar pr-2">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                  {plainDescription(modalContent.content)}
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
              className="bt-panel w-full max-w-4xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {(() => {
                const selectedTeam = selectedElfDetail.side === "p1" ? p1Team : p2Team;
                const elf = selectedTeam[selectedElfDetail.idx] || selectedElfDetail.elf;
                const isActive = selectedElfDetail.idx === (selectedElfDetail.side === "p1" ? p1ActiveIndex : battle.p2ActiveIndex);
                const marks = (isActive ? (selectedElfDetail.side === "p1" ? battle.p1Marks : battle.p2Marks) : (elf.marks || []))
                  .filter(mark => markAppliesToElf(mark, elf));
                return <ElfReadOnlyProfile battleSide={selectedElfDetail.side} key={`${selectedElfDetail.side}-${selectedElfDetail.idx}`}
                  elf={elf} getSkillMaxPp={getMaxPp} subtitle={`${selectedElfDetail.side.toUpperCase()} · 精靈 #${selectedElfDetail.idx + 1}`}
                  effectiveBody={getEffectiveBody(elfForViewer(elf, selectedElfDetail.side), marks as any)} onClose={() => setSelectedElfDetail(null)}
                  battlePanel={isActive ? <section className="bt-sub p-4 space-y-3" data-battle-detail>
                    {elf.battleId && renderChips(selectedElfDetail.side, elf)}
                    <div style={{ zoom: 1.2 } as React.CSSProperties}>{renderElfDetails(selectedElfDetail.side, elf)}</div>
                  </section> : undefined}>
                  <section className="bt-sub p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-cyan-300">能力等級狀態</h3>
                    <StatStagePanel elf={elf} isExpanded={true} disguiseAsNightmare={disguiseBattleStates} />
                  </section>
                  <section className="bt-sub p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-rose-300">異常狀態與效果</h3>
                    <StatusBadgePanel elf={elf} emptyHint="無任何異常狀態或效果" disguiseAbnormalStatuses={disguiseBattleStates} />
                  </section>
                  {marks.length > 0 && <section className="bt-sub p-4 space-y-3">
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
