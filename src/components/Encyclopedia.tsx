import React, { useState } from 'react';
import { Book, Shield, Zap, Info, ChevronRight, X, Swords, Target, Flame, Layers, Search, Sparkles, HelpCircle, BookOpen, Check, Edit, Copy, Trash2, RefreshCw, Send, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'motion/react';
import { StatusRegistry } from '../effects/statusRegistry';
import { StatusCategory } from '../effects/statusTypes';
import { TYPE_MATCHUPS, SEER_TYPES, setDynamicMatchups, getAttributeBadgeColor, getTypeMatchup } from '../utils/statCalculator';
import { MAJOR_EFFECT_CATEGORIES, INVALIDATION_MECHANISMS, DAMAGE_CATEGORIES, EXECUTION_MECHANICS } from '../data/effectClassificationCatalog';
import { REAL_CARD_EFFECT_MODULES as AI_EFFECT_REFERENCE_LIBRARY } from '../data/cardTemplates';
import { EFFECT_CATALOG } from '../data/effectCatalog';
import { ElfAvatar, TypeIcon } from './SeerImages';
import { statusVisual } from '../battle/effectIcons';
import { ClauseBreakdownCard } from './ClauseBreakdownCard';

import { getElfDestinyRank } from "../utils/destinyGacha";
import { useGameData } from '../contexts/GameDataContext';

interface EncyclopediaProps {
  onClose: () => void;
  initialTab?: 'status' | 'types' | 'mechanics' | 'editor' | 'effectQuery' | 'elves';
}

const Encyclopedia: React.FC<EncyclopediaProps> = ({ onClose, initialTab = 'elves' }) => {
  const { allElves } = useGameData();
  const [activeTab, setActiveTab] = useState<'status' | 'types' | 'mechanics' | 'editor' | 'effectQuery' | 'elves'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusSearchQuery, setStatusSearchQuery] = useState('');
  const [selectedStatusCategories, setSelectedStatusCategories] = useState<StatusCategory[]>([]);
  const [searchQueryEffects, setSearchQueryEffects] = useState("");
  // 搜尋輸入延後處理（打字不卡），結果清單分段顯示
  const deferredEffectQuery = React.useDeferredValue(searchQueryEffects);
  const [effectShowCount, setEffectShowCount] = useState(40);
  const [selectedEffectCategory, setSelectedEffectCategory] = useState<"all" | "core" | "library" | "status">("all");
  const [selectedSandboxId, setSelectedSandboxId] = useState("always_hit_vs_invalid");
  const [customMatchups, setCustomMatchups] = useState<any>(() => {
    const stored = localStorage.getItem('seer_custom_matchups');
    return stored ? JSON.parse(stored) : {};
  });

  // State for fullscreen/maximized mode
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // State for user-defined encyclopedia overrides (editing / modifying names or descriptions)
  const [overrides, setOverrides] = useState<Record<string, { title?: string; description?: string }>>(() => {
    const stored = localStorage.getItem('seer_encyclopedia_overrides');
    return stored ? JSON.parse(stored) : {};
  });

  // Inline editor states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [editingDesc, setEditingDesc] = useState<string>("");
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  const saveOverride = (id: string, title: string, description: string) => {
    const updated = {
      ...overrides,
      [id]: { title, description }
    };
    setOverrides(updated);
    localStorage.setItem('seer_encyclopedia_overrides', JSON.stringify(updated));
  };

  const removeOverride = (id: string) => {
    const updated = { ...overrides };
    delete updated[id];
    setOverrides(updated);
    localStorage.setItem('seer_encyclopedia_overrides', JSON.stringify(updated));
  };

  const handleCopyToClipboardAndBridge = (item: { id: string; title: string; description: string }) => {
    // 1. Save standard syntax to clipboard
    navigator.clipboard.writeText(item.description).catch(() => {});

    // 2. Write to bridge local storage so ElfEditor can recognize it
    localStorage.setItem('seer_selected_effect_for_ai', JSON.stringify({
      name: item.title,
      syntax: item.description
    }));

    // 3. Highlight copy state
    setCopiedItemId(item.id);
    setTimeout(() => {
      setCopiedItemId(null);
    }, 1500);
  };

  const formatToStandardSyntax = (text: string): string => {
    let formatted = text.trim();
    // Ensure brackets around common trigger words if not present
    const triggers = ["每回合結束時", "回合開始時", "受擊時", "登場時", "下回合", "技能命中時", "若自身", "對手", "造成傷害時", "致命傷害時", "命中時"];
    triggers.forEach(t => {
      const regex = new RegExp(`(?<!【)${t}(?!】)`, 'g');
      formatted = formatted.replace(regex, `【${t}】`);
    });
    // Ensure semicolons at the end of statements if missing
    if (formatted && !formatted.endsWith('；') && !formatted.endsWith(';') && !formatted.endsWith('。')) {
      formatted += '；';
    }
    return formatted;
  };

  // State for interactive dynamic type matchup querying
  const [selectedAtk, setSelectedAtk] = useState<string>("火");
  const [selectedDefPrimary, setSelectedDefPrimary] = useState<string>("草");
  const [selectedDefSecondary, setSelectedDefSecondary] = useState<string>("");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  const handleUpdateMatchup = (atk: string, def: string, val: number) => {
    const updated = {
      ...customMatchups,
      [atk]: {
        ...(customMatchups[atk] || {}),
        [def]: val
      }
    };
    setCustomMatchups(updated);
    localStorage.setItem('seer_custom_matchups', JSON.stringify(updated));
    setDynamicMatchups(updated);
  };

  const unifiedItems = React.useMemo(() => {
    const items: any[] = [];

    // 1. MAJOR_EFFECT_CATEGORIES
    Object.values(MAJOR_EFFECT_CATEGORIES).forEach(c => {
      items.push({
        id: `major_${c.code}`,
        title: c.name,
        type: 'core_major',
        sourceName: '底層效果分類',
        description: `${c.description} (觸發條件: ${c.triggerRequirement})`,
        badge: '🎯',
        badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        tags: ['底層', '效果', '攜帶', '固有', '附加', ...c.examples]
      });
    });

    // 2. INVALIDATION_MECHANISMS
    Object.values(INVALIDATION_MECHANISMS).forEach(m => {
      items.push({
        id: `inval_${m.type}`,
        title: m.name,
        type: 'core_invalidation',
        sourceName: '四大失效機制',
        description: `${m.description} (${m.criticalNotes.join(' ')})`,
        badge: '🛡️',
        badgeColor: 'bg-red-500/20 text-red-300 border border-red-500/30',
        tags: ['失效', '必中', '無效', '免疫', '命中', ...m.criticalNotes]
      });
    });

    // 3. DAMAGE_CATEGORIES
    Object.values(DAMAGE_CATEGORIES).forEach(d => {
      items.push({
        id: `dmg_${d.category}`,
        title: d.name,
        type: 'core_damage',
        sourceName: '傷害類型定義',
        description: `${d.definition} (包含來源: ${d.includedSources.join(', ')})`,
        badge: '⚔️',
        badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
        tags: ['傷害', '物理', '特殊', '固定', '百分比', '粉傷', ...d.includedSources]
      });
    });

    // 4. EXECUTION_MECHANICS
    Object.values(EXECUTION_MECHANICS).forEach(e => {
      items.push({
        id: `exec_${e.type}`,
        title: e.name,
        type: 'core_execution',
        sourceName: '終結機制定義',
        description: `${e.definition} (底層機制: ${e.coreMechanism})`,
        badge: '💀',
        badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
        tags: ['秒殺', '瞬殺', '自爆', '保底', '免死', '真傷']
      });
    });

    // 5. AI_EFFECT_REFERENCE_LIBRARY
    AI_EFFECT_REFERENCE_LIBRARY.forEach(m => {
      items.push({
        id: `lib_${m.id}`,
        title: m.name,
        type: 'library_template',
        sourceName: m.source,
        description: `【${m.triggerTime}】${m.standardSyntax} (技術指令: ${m.effectDetail})`,
        badge: '✨',
        badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        tags: [m.source, m.effectType, m.triggerTime, ...m.tags]
      });
    });

    // 6. Abnormal Statuses (Source of truth: StatusRegistry)
    Object.entries(StatusRegistry).forEach(([key, s]) => {
      items.push({
        id: `stat_${key}`,
        title: s.name,
        type: 'status_effect',
        sourceName: '異常狀態',
        description: s.description,
        badge: '❄️',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        tags: ['異常', '狀態', ...s.categories]
      });
    });

    // 7. EFFECT_CATALOG (Excluding actual abnormal status to prevent duplication, focusing on Indicia/Mechanics)
    Object.values(EFFECT_CATALOG).forEach(e => {
      // Check if this label is already in StatusRegistry to avoid mixing
      const isAbnormalStatus = Boolean(StatusRegistry[e.id] || StatusRegistry[e.label]);
      
      if (!isAbnormalStatus) {
        items.push({
          id: `cat_${e.id}`,
          title: e.label,
          type: 'indicia_effect', // Distinct type
          sourceName: '專屬機制與印記', // Distinct source
          description: e.describe({}),
          badge: e.badge || '🏷️',
          badgeColor: e.color || 'bg-slate-500/20 text-slate-300 border-slate-500/30',
          tags: ['專屬機制', '印記', ...e.categories]
        });
      }
    });

    return items.map(item => {
      const override = overrides[item.id];
      if (override) {
        return {
          ...item,
          title: override.title !== undefined ? override.title : item.title,
          description: override.description !== undefined ? override.description : item.description,
          isCustomEdited: true
        };
      }
      return item;
    });
  }, [overrides]);

  const filteredQueryItems = React.useMemo(() => {
    let result = unifiedItems;

    if (selectedEffectCategory === "core") {
      result = result.filter(item => 
        item.type === 'core_major' || 
        item.type === 'core_invalidation' || 
        item.type === 'core_damage' || 
        item.type === 'core_execution'
      );
    } else if (selectedEffectCategory === "library") {
      result = result.filter(item => item.type === 'library_template');
    } else if (selectedEffectCategory === "status") {
      result = result.filter(item => item.type === 'status_effect');
    }

    if (deferredEffectQuery.trim()) {
      const q = deferredEffectQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.sourceName.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [unifiedItems, deferredEffectQuery, selectedEffectCategory]);

  const categoryLabels: Record<string, { label: string; description: string; color: string }> = {
    CONTROL: { label: '【控制類異常】', description: '處於該異常狀態則每回合無法行動。', color: 'text-amber-400' },
    WEAKENING: { label: '【弱化類異常】', description: '每回合對手出手或結束時受傷、降低能力等效果。', color: 'text-purple-400' },
    RESTRICTIVE: { label: '【限制類異常】', description: '限制切換、無法使用藥劑等戰鬥操作限制。', color: 'text-indigo-400' },
    EVOLUTIONARY: { label: '【衍化類異常】', description: '異常結束或觸發條件後轉化為另一種狀態。', color: 'text-emerald-400' },
    AUXILIARY: { label: '【附屬類異常】', description: '星附屬、詛咒附屬、特殊戰場狀態等。', color: 'text-cyan-400' },
    BOSS_ONLY: { label: '【BOSS專用異常】', description: '神話、免疫等 BOSS 專屬附屬異常。', color: 'text-rose-400' },
    NO_EFFECT: { label: '【無效果類異常】', description: '異常抵抗轉化等無效果類異常。', color: 'text-slate-400' },
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm transition-all duration-300 ${isMaximized ? 'p-0' : 'p-4'}`}
    >
      <div className={`ios-panel flex flex-col overflow-hidden transition-all duration-300 ${isMaximized ? 'w-full h-full !rounded-none' : 'w-[94vw] max-w-[1400px] h-[88vh]'}`}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-blue-500/15 flex items-center justify-center">
              <Book className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-[19px] font-semibold text-slate-100 tracking-tight">圖鑑與戰鬥百科</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? "還原視窗" : "全螢幕"}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors text-slate-300"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title="關閉"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs：iOS 分段控制 */}
        <div className="px-5 py-2.5 border-b border-white/[0.06] shrink-0 overflow-x-auto scrollbar-none">
          <div className="ios-segment">
            {([
              ['elves', '精靈圖鑑'],
              ['status', '異常狀態'],
              ['types', '屬性克制'],
              ['mechanics', '戰鬥機制'],
              ['editor', '自訂克制'],
              ['effectQuery', '效果查詢'],
            ] as const).map(([key, label]) => (
              <button key={key} data-active={activeTab === key} onClick={() => setActiveTab(key as any)}>{label}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {activeTab === 'elves' && (
            <div className="space-y-6 animate-fade-in pb-8">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜尋精靈名稱或屬性..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ios-search w-full pl-10 pr-4 py-2 text-[13px] text-slate-200 placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allElves.filter(e => {
                  const normalizedSearch = searchQuery.trim().toLowerCase().replace(/[·.]/g, '');
                  const normalizedName = e.name.toLowerCase().replace(/[·.]/g, '');
                  return normalizedName.includes(normalizedSearch) || e.type.includes(searchQuery);
                }).map((elf, index) => (
                  <div key={`${elf.id}-${index}`} className="ios-card p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden bg-slate-800/80 ring-1 ring-white/10">
                        <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full flex items-center justify-center text-lg font-bold text-slate-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[16px] text-slate-100 truncate">{elf.name}</h3>
                          <span className="text-[11px] text-slate-500">#{elf.id}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-slate-400">
                          <TypeIcon type={elf.type} size={15} showLabelWhenMissing={false} />
                          <span>{elf.type}</span>
                          {getElfDestinyRank(elf) && <span className="px-1.5 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold">命運 {getElfDestinyRank(elf)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-[12px] text-slate-500">
                      {elf.height ?? 0} cm · {elf.weight || "—"} kg{elf.gender ? ` · ${elf.gender}` : ""}
                    </div>
                    {elf.description && <p className="text-[12px] text-slate-400 line-clamp-2">{elf.description}</p>}

                    {/* 專屬特性 Clause Breakdown 透明視圖 */}
                    <ClauseBreakdownCard
                      title={elf.soulMark.name}
                      description={elf.soulMark.description}
                      elfId={String(elf.id)}
                      elfName={elf.name}
                      customKitItems={(elf as any).kit}
                      isSoulMark={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="space-y-6 animate-fade-in">
              {/* Search and Category Filters Panel */}
              <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜尋異常狀態名稱或描述關鍵字..."
                    value={statusSearchQuery}
                    onChange={(e) => setStatusSearchQuery(e.target.value)}
                    className="ios-search w-full pl-10 pr-8 py-2 text-[13px] text-slate-200 placeholder-slate-500 focus:outline-none"
                  />
                  {statusSearchQuery && (
                    <button
                      onClick={() => setStatusSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 font-bold mr-1">分類篩選：</span>
                  <button
                    onClick={() => setSelectedStatusCategories([])}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      selectedStatusCategories.length === 0
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/5"
                        : "bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-900"
                    }`}
                  >
                    全部類別
                  </button>
                  {Object.entries(categoryLabels).map(([catKey, cat]) => {
                    const isSelected = selectedStatusCategories.includes(catKey as StatusCategory);
                    return (
                      <button
                        key={catKey}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStatusCategories(selectedStatusCategories.filter(c => c !== catKey));
                          } else {
                            setSelectedStatusCategories([...selectedStatusCategories, catKey as StatusCategory]);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          isSelected
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/5"
                            : "bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-900"
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status List Grouped by Category */}
              <div className="space-y-8">
                {Object.entries(categoryLabels).map(([catKey, cat]) => {
                  // Filter categories if user selected specific categories
                  if (selectedStatusCategories.length > 0 && !selectedStatusCategories.includes(catKey as StatusCategory)) {
                    return null;
                  }

                  let statusesInCategory = Object.entries(StatusRegistry).filter(([_, entry]) => 
                    entry.categories.includes(catKey as StatusCategory)
                  );

                  // Apply text search query
                  if (statusSearchQuery.trim()) {
                    const q = statusSearchQuery.toLowerCase();
                    statusesInCategory = statusesInCategory.filter(([_, entry]) =>
                      entry.name.toLowerCase().includes(q) ||
                      entry.description.toLowerCase().includes(q) ||
                      entry.categories.some(c => c.toLowerCase().includes(q))
                    );
                  }

                  if (statusesInCategory.length === 0) return null;

                  return (
                    <section key={catKey} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-6 rounded-full bg-current ${cat.color}`} />
                        <h3 className={`text-lg font-bold ${cat.color}`}>{cat.label} (共 {statusesInCategory.length} 個)</h3>
                        <span className="text-xs text-slate-500 ml-2">— {cat.description}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {statusesInCategory.map(([statusName, status]) => (
                          <div key={statusName} className="ios-card p-4 flex gap-4">
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-1.5">
                                  {statusVisual(status.name)?.icon && <img src={statusVisual(status.name)!.icon} alt="" className="w-5 h-5 rounded" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />}
                                  {status.name}
                                </h4>
                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                  {status.categories.map(c => (
                                    <span key={c} className="text-[10px] text-slate-300 px-2 py-0.5 rounded-full bg-white/[0.06]">
                                      {(categoryLabels as any)[c]?.label?.replace(/[【】]/g, "") || c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                                {status.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
          
          {activeTab === 'types' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex gap-3 items-start text-xs text-blue-300 leading-relaxed">
                <Info className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-bold mb-1">屬性克制與戰術導航系統</p>
                  <p>您可以點擊下方的大型克制矩陣儲存格，或直接在「戰術分析查詢器」中任意搭配屬性組合（支援雙屬性！），獲取專屬傷害倍率及深度攻防戰略指南。</p>
                </div>
              </div>

              {/* 🎯 屬性相剋動態查詢與戰術分析 */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">🎯 屬性相剋動態查詢器</h3>
                      <p className="text-[10px] text-slate-400">點擊下方矩陣儲存格或在此選擇屬性，即刻獲取極致戰術規劃情資</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">模式</span>
                    <span className="text-[10px] text-blue-400 font-bold">雙屬性相容</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Selector Column */}
                  <div className="md:col-span-5 space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      {/* Attacker selection */}
                      <div>
                        <label className="block text-[11px] text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                          進攻方屬性
                        </label>
                        <div className="flex gap-2">
                          <select 
                            value={selectedAtk}
                            onChange={(e) => setSelectedAtk(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-bold"
                          >
                            {SEER_TYPES.filter(t => t !== "無屬性" && t !== "未知").map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center justify-center min-w-[70px] ${getAttributeBadgeColor(selectedAtk)} gap-1`}>
                            <TypeIcon type={selectedAtk} size={16} showLabelWhenMissing={false} />{selectedAtk}
                          </span>
                        </div>
                      </div>

                      {/* Defender Primary and Secondary */}
                      <div>
                        <label className="block text-[11px] text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                          防禦方屬性 (精靈)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <select 
                              value={selectedDefPrimary}
                              onChange={(e) => {
                                setSelectedDefPrimary(e.target.value);
                                if (e.target.value === selectedDefSecondary) {
                                  setSelectedDefSecondary("");
                                }
                              }}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-bold"
                            >
                              {SEER_TYPES.filter(t => t !== "未知").map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold text-center ${getAttributeBadgeColor(selectedDefPrimary)} inline-flex items-center justify-center gap-1`}>
                              <TypeIcon type={selectedDefPrimary} size={14} showLabelWhenMissing={false} />主屬性: {selectedDefPrimary}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1">
                            <select 
                              value={selectedDefSecondary}
                              onChange={(e) => setSelectedDefSecondary(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-bold"
                            >
                              <option value="">無 (單屬性)</option>
                              {SEER_TYPES.filter(t => t !== selectedDefPrimary && t !== "未知" && t !== "無屬性").map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold text-center ${selectedDefSecondary ? getAttributeBadgeColor(selectedDefSecondary) : 'bg-slate-950 text-slate-600 border border-slate-900/50'}`}>
                              {selectedDefSecondary && <TypeIcon type={selectedDefSecondary} size={14} showLabelWhenMissing={false} />}副屬性: {selectedDefSecondary || "無"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calculated Matchup Visualization Badge */}
                  <div className="md:col-span-7 flex flex-col justify-center bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 relative overflow-hidden">
                    {(() => {
                      const computedDef = selectedDefSecondary ? `${selectedDefPrimary}.${selectedDefSecondary}` : selectedDefPrimary;
                      const multiplier = getTypeMatchup(selectedAtk, computedDef);
                      let glowColor = "rgba(100, 116, 139, 0.03)";
                      let borderColor = "border-slate-800";
                      let multiColor = "text-slate-400";
                      let label = "普通 (Normal)";
                      let labelColor = "text-slate-400 bg-slate-500/10 border border-slate-500/20";

                      if (multiplier > 1.5) {
                        glowColor = "rgba(16, 185, 129, 0.08)";
                        borderColor = "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
                        multiColor = "text-emerald-400 font-extrabold";
                        label = "🔥 強大克制 (Double Effective)";
                        labelColor = "text-emerald-300 bg-emerald-500/20 border border-emerald-500/30";
                      } else if (multiplier > 1.0) {
                        glowColor = "rgba(52, 211, 153, 0.05)";
                        borderColor = "border-emerald-500/20";
                        multiColor = "text-emerald-500 font-bold";
                        label = "⚡ 屬性克制 (Super Effective)";
                        labelColor = "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20";
                      } else if (multiplier < 1.0 && multiplier > 0) {
                        glowColor = "rgba(239, 68, 68, 0.05)";
                        borderColor = "border-rose-500/20";
                        multiColor = "text-rose-400 font-bold";
                        label = "限制微弱 (Not Very Effective)";
                        labelColor = "text-rose-400 bg-rose-500/10 border border-rose-500/20";
                      } else if (multiplier === 0) {
                        glowColor = "rgba(148, 163, 184, 0.05)";
                        borderColor = "border-slate-700";
                        multiColor = "text-slate-500 font-semibold line-through";
                        label = "🛡️ 屬性免疫 (No Effect)";
                        labelColor = "text-slate-500 bg-slate-800 border border-slate-700";
                      }

                      return (
                        <div 
                          className={`w-full h-full flex flex-col justify-between space-y-3 transition-all duration-300 rounded-lg p-2 ${borderColor}`} 
                          style={{ background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 80%)` }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">傷害係數判定</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${labelColor}`}>
                              {label}
                            </span>
                          </div>

                          <div className="flex items-center justify-center gap-4 py-2">
                            <div className="flex flex-col items-center gap-1.5">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getAttributeBadgeColor(selectedAtk)} shadow-md inline-flex items-center gap-1`}>
                                <TypeIcon type={selectedAtk} size={16} showLabelWhenMissing={false} />{selectedAtk}
                              </span>
                              <span className="text-[9px] text-slate-500 font-bold">進攻技能</span>
                            </div>

                            <div className="flex flex-col items-center justify-center flex-1 px-2">
                              <div className={`text-2xl md:text-3xl font-mono tracking-tight ${multiColor}`}>
                                {multiplier.toFixed(2)}x
                              </div>
                              {/* Dynamic Arrow */}
                              <div className="w-full flex items-center justify-center gap-1 mt-1">
                                <div className="h-[2px] bg-slate-800 flex-1"></div>
                                <div className="text-[10px] font-bold text-slate-600">擊中</div>
                                <div className="h-[2px] bg-slate-800 flex-1"></div>
                              </div>
                            </div>

                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex gap-1">
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getAttributeBadgeColor(selectedDefPrimary)} shadow-md inline-flex items-center gap-1`}>
                                  <TypeIcon type={selectedDefPrimary} size={16} showLabelWhenMissing={false} />{selectedDefPrimary}
                                </span>
                                {selectedDefSecondary && (
                                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getAttributeBadgeColor(selectedDefSecondary)} shadow-md inline-flex items-center gap-1`}>
                                    <TypeIcon type={selectedDefSecondary} size={16} showLabelWhenMissing={false} />{selectedDefSecondary}
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-slate-500 font-bold">防禦精靈</span>
                            </div>
                          </div>

                          {/* Tactical recommendation comment */}
                          <div className="text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">
                            {multiplier > 1.0 ? (
                              <span>⚔️ 戰術建議：使用 <strong className="text-amber-400">【{selectedAtk}】</strong> 系技能進攻此精靈是極佳選擇！可獲得 <strong className="text-emerald-400 font-mono">{(multiplier * 100).toFixed(0)}%</strong> 的增幅傷害，適合作為主力輸出爆發。</span>
                            ) : multiplier < 1.0 && multiplier > 0 ? (
                              <span>🛡️ 戰術建議：使用 <strong className="text-slate-300">【{selectedAtk}】</strong> 技能效果微弱。建議切換能剋制防禦方的屬性，或使用特殊真實傷害（粉傷）繞過屬性抵抗。</span>
                            ) : multiplier === 0 ? (
                              <span>🛑 戰術警告：防禦方對該屬性擁有 <strong className="text-red-400">100% 免疫</strong>！使用此屬性技能將完全無法造成傷害，請絕對避免進攻！</span>
                            ) : (
                              <span>⚖️ 戰術建議：普通傷害關係。可正常運用技能效果與策略，但無法依賴屬性優勢取得爆發，應更注重Buff與控制印記的運用。</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Tactical Planning Report - Statically lists all advantages/disadvantages for planning */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-slate-800/50">
                  {/* Attacker Perspective List */}
                  <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <Flame className="w-4 h-4 text-red-400" />
                      <span>【{selectedAtk}】進攻屬性戰術圖譜</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold mb-1">🔥 效果絕佳！克制對象 (&gt; 1.0x)</div>
                        {(() => {
                          const advantages = SEER_TYPES.filter(def => {
                            if (def === "未知" || def === "無屬性") return false;
                            const val = customMatchups[selectedAtk]?.[def] ?? TYPE_MATCHUPS[selectedAtk]?.[def] ?? 1.0;
                            return val > 1.0;
                          });
                          if (advantages.length === 0) {
                            return <div className="text-[10px] text-slate-600 italic">無克制對象</div>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              {advantages.map(def => {
                                const val = customMatchups[selectedAtk]?.[def] ?? TYPE_MATCHUPS[selectedAtk]?.[def] ?? 1.0;
                                return (
                                  <span 
                                    key={def} 
                                    onClick={() => {
                                      setSelectedDefPrimary(def);
                                      setSelectedDefSecondary("");
                                    }}
                                    className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/50 text-[10px] text-emerald-300 font-bold cursor-pointer transition-colors"
                                    title="點擊設定為查詢防禦方"
                                  >
                                    {def} <span className="font-mono text-[9px] text-emerald-400 ml-0.5">x{val.toFixed(1)}</span>
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500 font-bold mb-1">❄️ 效果微弱/無效！抵抗對象 (&lt; 1.0x)</div>
                        {(() => {
                          const disadvantages = SEER_TYPES.filter(def => {
                            if (def === "未知" || def === "無屬性") return false;
                            const val = customMatchups[selectedAtk]?.[def] ?? TYPE_MATCHUPS[selectedAtk]?.[def] ?? 1.0;
                            return val < 1.0;
                          });
                          if (disadvantages.length === 0) {
                            return <div className="text-[10px] text-slate-600 italic">無抵抗對象</div>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              {disadvantages.map(def => {
                                const val = customMatchups[selectedAtk]?.[def] ?? TYPE_MATCHUPS[selectedAtk]?.[def] ?? 1.0;
                                return (
                                  <span 
                                    key={def}
                                    onClick={() => {
                                      setSelectedDefPrimary(def);
                                      setSelectedDefSecondary("");
                                    }}
                                    className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800/50 text-[10px] text-rose-300 font-bold cursor-pointer transition-colors"
                                    title="點擊設定為查詢防禦方"
                                  >
                                    {def} <span className="font-mono text-[9px] text-rose-400 ml-0.5">x{val.toFixed(1)}</span>
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Defender Perspective List */}
                  <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span>【{selectedDefSecondary ? `${selectedDefPrimary}.${selectedDefSecondary}` : selectedDefPrimary}】防禦屬性防守圖譜</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold mb-1">⚠️ 傷害威脅！受克制來源 (&gt; 1.0x)</div>
                        {(() => {
                          const computedDef = selectedDefSecondary ? `${selectedDefPrimary}.${selectedDefSecondary}` : selectedDefPrimary;
                          const vulnerableTo = SEER_TYPES.filter(atk => {
                            if (atk === "無屬性" || atk === "未知") return false;
                            const val = getTypeMatchup(atk, computedDef);
                            return val > 1.0;
                          });
                          if (vulnerableTo.length === 0) {
                            return <div className="text-[10px] text-slate-600 italic">無受克制屬性</div>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              {vulnerableTo.map(atk => {
                                const val = getTypeMatchup(atk, computedDef);
                                return (
                                  <span 
                                    key={atk}
                                    onClick={() => setSelectedAtk(atk)}
                                    className="px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-800/50 text-[10px] text-amber-300 font-bold cursor-pointer transition-colors"
                                    title="點擊設定為查詢進攻方"
                                  >
                                    {atk} <span className="font-mono text-[9px] text-amber-400 ml-0.5">x{val.toFixed(2)}</span>
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500 font-bold mb-1">🛡️ 固若金湯！抵抗來源 (&lt; 1.0x)</div>
                        {(() => {
                          const computedDef = selectedDefSecondary ? `${selectedDefPrimary}.${selectedDefSecondary}` : selectedDefPrimary;
                          const resistantTo = SEER_TYPES.filter(atk => {
                            if (atk === "無屬性" || atk === "未知") return false;
                            const val = getTypeMatchup(atk, computedDef);
                            return val < 1.0;
                          });
                          if (resistantTo.length === 0) {
                            return <div className="text-[10px] text-slate-600 italic">無抵抗屬性</div>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              {resistantTo.map(atk => {
                                const val = getTypeMatchup(atk, computedDef);
                                return (
                                  <span 
                                    key={atk}
                                    onClick={() => setSelectedAtk(atk)}
                                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/50 text-[10px] text-slate-400 font-bold cursor-pointer transition-colors"
                                    title="點擊設定為查詢進攻方"
                                  >
                                    {atk} <span className="font-mono text-[9px] text-slate-500 ml-0.5">x{val.toFixed(2)}</span>
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <input 
                  type="text"
                  placeholder="搜尋屬性名稱..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-900">
                      <th className="p-3 text-xs font-bold text-slate-400 sticky left-0 bg-slate-900 z-10">類型</th>
                      <th className="p-3 text-xs font-bold text-slate-400 sticky left-[60px] bg-slate-900 z-10">進攻 \ 防禦</th>
                      {SEER_TYPES.map(t => (
                        <th 
                          key={t} 
                          className={`p-3 text-[10px] font-bold whitespace-nowrap transition-colors text-center ${hoveredCol === t ? 'text-blue-400 bg-slate-800/60 font-black' : 'text-slate-500'}`}
                        >
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SEER_TYPES
                      .filter(t => t.includes(searchQuery))
                      .map((atk, idx) => (
                      <tr 
                        key={atk} 
                        className={`border-t border-slate-800/50 transition-colors ${hoveredRow === atk ? 'bg-slate-800/20' : 'hover:bg-slate-800/10'}`}
                      >
                        <td className="p-3 text-[10px] text-slate-500 sticky left-0 bg-[#0F1117] z-10 border-r border-slate-800">
                          {SEER_TYPES.indexOf(atk) < 7 ? '基礎' : SEER_TYPES.indexOf(atk) < 14 ? '進階' : '特殊'}
                        </td>
                        <td className={`p-3 text-xs font-bold sticky left-[60px] bg-[#0F1117] z-10 transition-colors ${hoveredRow === atk ? 'text-blue-400 font-extrabold bg-slate-800/40' : 'text-slate-300'}`}>{atk}</td>
                        {SEER_TYPES.map(def => {
                          let multiplier = customMatchups[atk]?.[def] ?? TYPE_MATCHUPS[atk]?.[def] ?? 1.0;
                          let color = 'text-slate-500';
                          if (multiplier > 1.5) color = 'text-emerald-400 font-black bg-emerald-500/10';
                          else if (multiplier > 1) color = 'text-emerald-500/60 font-bold';
                          else if (multiplier < 1 && multiplier > 0) color = 'text-rose-400 font-bold bg-rose-500/5';
                          else if (multiplier === 0) color = 'text-slate-700 bg-slate-800';
                          
                          const isHoveredCell = hoveredRow === atk && hoveredCol === def;
                          const isInCrosshair = hoveredRow === atk || hoveredCol === def;
                          const isCurrentlySelected = selectedAtk === atk && selectedDefPrimary === def && !selectedDefSecondary;

                          const cellHighlightClass = isHoveredCell
                            ? 'ring-2 ring-amber-400 scale-110 z-20 bg-slate-700/60 font-black text-xs shadow-lg shadow-black/50'
                            : isCurrentlySelected
                              ? 'ring-1 ring-blue-500 bg-blue-500/10 font-bold'
                              : isInCrosshair
                                ? 'bg-slate-800/20'
                                : '';

                          return (
                            <td 
                              key={def} 
                              onMouseEnter={() => {
                                setHoveredRow(atk);
                                setHoveredCol(def);
                              }}
                              onMouseLeave={() => {
                                setHoveredRow(null);
                                setHoveredCol(null);
                              }}
                              onClick={() => {
                                setSelectedAtk(atk);
                                setSelectedDefPrimary(def);
                                setSelectedDefSecondary("");
                              }}
                              className={`p-3 text-center text-[11px] cursor-pointer hover:font-bold transition-all ${color} ${cellHighlightClass}`}
                              title={`點擊設定戰術查詢：【${atk}】進攻【${def}】(${multiplier.toFixed(1)}x)`}
                            >
                              {multiplier.toFixed(1)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-violet-500/5 border border-violet-500/20 p-4 rounded-xl flex gap-3 items-start text-xs text-violet-300 leading-relaxed">
                <Shield className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-bold mb-1">自訂屬性克制倍率系統</p>
                  <p>您可以在此手動調整任意屬性間的克制關係。修改後將立即保存在本地並應用於戰鬥算式。雙屬性精靈將自動計算組合倍率。</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    快速編輯克制值
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">進攻方</label>
                        <select 
                          id="edit-atk-type"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
                        >
                          {SEER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">防禦方</label>
                        <select 
                          id="edit-def-type"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
                        >
                          {SEER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">克制倍率 (如 2.0, 0.5, 0)</label>
                      <input 
                        id="edit-multiplier-val"
                        type="number"
                        step="0.1"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 font-mono"
                        placeholder="2.0"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const atk = (document.getElementById('edit-atk-type') as HTMLSelectElement).value;
                        const def = (document.getElementById('edit-def-type') as HTMLSelectElement).value;
                        const val = parseFloat((document.getElementById('edit-multiplier-val') as HTMLInputElement).value);
                        if (!isNaN(val)) {
                          handleUpdateMatchup(atk, def, val);
                          alert(`已將【${atk}】對【${def}】的倍率更新為 ${val}x`);
                        }
                      }}
                      className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-lg transition-all"
                    >
                      更新克制關係
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 p-4 rounded-xl overflow-hidden flex flex-col">
                   <h3 className="text-xs font-bold text-slate-300 mb-3">當前自訂覆寫清單</h3>
                   <div className="flex-1 overflow-y-auto space-y-2 max-h-[250px]">
                      {Object.entries(customMatchups).map(([atk, relations]: [string, any]) => (
                        Object.entries(relations).map(([def, val]: [string, any]) => (
                          <div key={`${atk}-${def}`} className="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-lg">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400">【{atk}】</span>
                              <ChevronRight className="w-3 h-3 text-slate-600" />
                              <span className="text-slate-400">【{def}】</span>
                              <span className={`font-bold ml-2 ${val > 1 ? 'text-emerald-400' : val < 1 ? 'text-rose-400' : 'text-slate-400'}`}>
                                {val}x
                              </span>
                            </div>
                            <button 
                              onClick={() => {
                                const updated = { ...customMatchups };
                                delete updated[atk][def];
                                if (Object.keys(updated[atk]).length === 0) delete updated[atk];
                                setCustomMatchups(updated);
                                localStorage.setItem('seer_custom_matchups', JSON.stringify(updated));
                                setDynamicMatchups(updated);
                              }}
                              className="text-[10px] text-rose-500 hover:text-rose-400 font-bold"
                            >
                              刪除
                            </button>
                          </div>
                        ))
                      ))}
                      {Object.keys(customMatchups).length === 0 && (
                        <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                          尚無自訂克制關係
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mechanics' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl flex items-center gap-3 text-blue-300 text-xs">
                <Info className="w-5 h-5 text-blue-400 shrink-0" />
                <span>以下為賽爾號核心對戰術語與底層機制定義，嚴格規範了技能結算次序、後手補償、傷害分流與防無限反彈循環法則。</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. 回合與時序機制 */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4 flex flex-col">
                  <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Zap className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-200">回合與時序判定</h3>
                      <p className="text-[11px] text-slate-500">規範回合計數與判定條件</p>
                    </div>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-amber-500/30 transition-colors">
                      <h4 className="text-xs font-bold text-amber-400 mb-1 flex items-center justify-between">
                        <span>回合類效果</span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">核心時序</span>
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        由技能效果附加的、以回合為計數的未命名效果；此類效果在後出手附加時，若當回合因此無法直接觸發收益，則回合數+1。
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <h4 className="text-xs font-bold text-slate-200 mb-1">未觸發</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        前置行為的結果未能正確發生，包括不限於未通過機率判定、被免疫、被修改等。
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <h4 className="text-xs font-bold text-slate-200 mb-1">改變</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        當一項屬性變化為與變化前不同的狀態時，此屬性被判定為改變；若變化前後狀態一致（例如能力已達上限或下限），則本次變化不判定為改變。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. 傷害與吸取法則 */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4 flex flex-col">
                  <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
                    <div className="p-2 bg-rose-500/10 rounded-lg">
                      <Swords className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-200">傷害與吸取類型</h3>
                      <p className="text-[11px] text-slate-500">明確特殊傷害與粉字結算</p>
                    </div>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <h4 className="text-xs font-bold text-rose-400 mb-1 flex items-center justify-between">
                        <span>固定傷害</span>
                        <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">粉字傷害</span>
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        以固定的點數表示的一種傷害的類型（不受防禦與克制影響）。
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <h4 className="text-xs font-bold text-purple-400 mb-1 flex items-center justify-between">
                        <span>百分比傷害</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">比例扣血</span>
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        以分數、百分數表示的一種傷害的類型（如最大體力的 1/3、20% 等）。
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-rose-500/30 transition-colors">
                      <h4 className="text-xs font-bold text-emerald-400 mb-1">吸取 (Drain)</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        附加對手一定的傷害，然後恢復一定的體力，數值由後續搭配的數值決定；當搭配的數值為固定點數時傷害類型為固定傷害，當搭配的數值為比例時傷害類型為百分比傷害。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. 防禦與反彈循環 */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4 flex flex-col">
                  <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Shield className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-200">防禦屏障與反彈機制</h3>
                      <p className="text-[11px] text-slate-500">防禦傷害分類與防無限循環防禦</p>
                    </div>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <h4 className="text-xs font-bold text-blue-400 mb-1 flex items-center justify-between">
                        <span>護盾 (Shield)</span>
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">抵擋威力</span>
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        可以抵消對手攻擊技能造成的攻擊傷害（無法抵擋固定傷害、百分比傷害或真實傷害）。
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <h4 className="text-xs font-bold text-cyan-400 mb-1 flex items-center justify-between">
                        <span>護罩 (Barrier)</span>
                        <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">抵擋粉傷</span>
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        專門抵擋固定傷害與百分比傷害等特殊傷害（在護罩破裂前，保護本體血量安全）。<strong className="text-amber-300">注意：真實傷害與招式直接造成的攻擊傷害無法被護罩抵擋或吸收。</strong>
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                      <h4 className="text-xs font-bold text-indigo-400 mb-1 flex items-center justify-between">
                        <span>反彈 (Reflect) & 反彈攻擊傷害</span>
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">防死循環</span>
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-1.5">
                        <strong className="text-slate-200">反彈：</strong>一種特殊的附加，被反彈的效果不會被再次反彈。
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        <strong className="text-slate-200">反彈(攻擊)傷害：</strong>一種特殊的附加，被反彈的效果不會被再次反彈給自己，真實傷害不受此限但是不會多附加 1 次。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. 對象與能力範圍 */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4 flex flex-col">
                  <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <Target className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-200">作用對象與能力範圍</h3>
                      <p className="text-[11px] text-slate-500">界定團隊標記與屬性範圍</p>
                    </div>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-colors">
                      <h4 className="text-xs font-bold text-emerald-400 mb-1 flex items-center justify-between">
                        <span>全屬性 (All Stat Stages)</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">六大能力</span>
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        即攻擊、防禦、特攻、特防、速度、命中共 6 種能力的等級（不包含閃避與體力上限）。
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-colors">
                      <h4 className="text-xs font-bold text-teal-400 mb-1 flex items-center justify-between">
                        <span>對方 / 己方 (Team & Player Scope)</span>
                        <span className="text-[9px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded">團隊/場地範圍</span>
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        與己方對應的一種特殊對象，包含玩家本身與從屬於玩家的所有精靈；綁定己方/對方的效果（如陣營護盾、團隊特效）不會作為綁定在任意單體精靈的效果進行結算。
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <h4 className="text-xs font-bold text-amber-400 mb-1">真實回合持續法則</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        當前標記為「n 回合」的異常在經過 n 個完整回合結算後消退；控制類計時器在回合結束時遞減；轉化效果在消退瞬間觸發。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'effectQuery' && (
            <div className="space-y-6 animate-fade-in pb-8">
              {/* Top Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-violet-500/5 to-transparent border border-amber-500/20 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    核心效果與對戰判定查詢系統
                  </h3>
                  <p className="text-xs text-slate-400">
                    本系統提供底層判定標準、失效與防禦機制、傷害分類、終結秒殺等衝突判定與詞庫檢索。
                  </p>
                </div>
                <div className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full font-mono font-bold whitespace-nowrap">
                  去數值化標準引擎 v2.1
                </div>
              </div>

              {/* Bento Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Column: Keyword Search & Filter List (col-span-7) */}
                <div className="lg:col-span-7 space-y-4">
                  
                  {/* Search Bar */}
                  <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="輸入關鍵字 (例如: 秒殺、免死、必中、麻痺、消回合)..."
                        value={searchQueryEffects}
                        onChange={(e) => setSearchQueryEffects(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-600 font-medium font-sans"
                      />
                    </div>

                    {/* Filter Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { id: 'all', label: '全部類別' },
                        { id: 'core', label: '🎯 核心底層標準' },
                        { id: 'library', label: '✨ 標準參考詞庫' },
                        { id: 'status', label: '❄️ 異常與狀態' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setSelectedEffectCategory(tab.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                            selectedEffectCategory === tab.id
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-lg shadow-amber-500/5"
                              : "bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-900"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scrollable Results List */}
                  <div className="bg-slate-900/20 border border-slate-800 rounded-xl p-4 space-y-3 max-h-[460px] overflow-y-auto scrollbar-thin">
                    <div className="flex justify-between items-center text-[11px] text-slate-500 font-bold border-b border-slate-800 pb-2">
                      <span>搜尋結果 ({filteredQueryItems.length})</span>
                      {searchQueryEffects && (
                        <button 
                          onClick={() => setSearchQueryEffects("")}
                          className="text-amber-400 hover:underline"
                        >
                          重設搜尋
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {filteredQueryItems.slice(0, effectShowCount).map((item) => {
                        const isEditing = editingItemId === item.id;

                        return (
                          <div 
                            key={item.id} 
                            className={`group border transition-all duration-300 p-4 rounded-xl flex flex-col justify-between space-y-3 ${
                              isEditing 
                                ? "bg-slate-900/90 border-amber-500/50 shadow-lg shadow-amber-500/5" 
                                : item.isCustomEdited
                                  ? "bg-violet-950/20 border-violet-800/50 hover:border-violet-700/60"
                                  : "bg-slate-950/50 hover:bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60"
                            }`}
                          >
                            {isEditing ? (
                              <div className="space-y-3 animate-fade-in text-left">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                    <Edit className="w-3.5 h-3.5" /> 編輯效果項目資訊
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">ID: {item.id}</span>
                                </div>

                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-1 font-bold">項目名稱</label>
                                  <input 
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                                    placeholder="項目名稱"
                                  />
                                </div>

                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <label className="block text-[10px] text-slate-500 font-bold">效果與判定描述</label>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDesc(formatToStandardSyntax(editingDesc))}
                                      className="text-[9px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer bg-amber-500/5 border border-amber-500/20 px-2 py-0.5 rounded"
                                      title="自動套用賽爾號【時機】語法與語氣規範"
                                    >
                                      <Sparkles className="w-3 h-3" /> 智能模板優化
                                    </button>
                                  </div>
                                  <textarea 
                                    rows={4}
                                    value={editingDesc}
                                    onChange={(e) => setEditingDesc(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded p-2.5 text-xs text-slate-200 focus:outline-none font-sans leading-relaxed"
                                    placeholder="請輸入精細效果語法..."
                                  />
                                </div>

                                <div className="flex gap-2 justify-end pt-1">
                                  <button
                                    onClick={() => setEditingItemId(null)}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs rounded-lg transition-all"
                                  >
                                    取消
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (editingTitle.trim() && editingDesc.trim()) {
                                        saveOverride(item.id, editingTitle.trim(), editingDesc.trim());
                                        setEditingItemId(null);
                                      }
                                    }}
                                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" /> 儲存修改
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base select-none">{item.badge}</span>
                                    <h4 className="font-bold text-slate-200 text-xs sm:text-sm group-hover:text-amber-300 transition-colors flex items-center gap-2">
                                      {item.title}
                                      {item.isCustomEdited && (
                                        <span className="text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded font-bold font-sans">
                                          已修改
                                        </span>
                                      )}
                                    </h4>
                                  </div>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${item.badgeColor}`}>
                                    {item.sourceName}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-300 leading-relaxed font-sans text-left">
                                  {item.description}
                                </p>

                                {/* Tags */}
                                {item.tags && item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-900/60">
                                    {item.tags.slice(0, 5).map((t: string) => (
                                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-500 font-medium">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Action Buttons Panel */}
                                <div className="flex flex-wrap gap-1.5 pt-2.5 justify-end">
                                  {item.isCustomEdited && (
                                    <button
                                      onClick={() => removeOverride(item.id)}
                                      className="px-2.5 py-1 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-lg font-bold transition-all flex items-center gap-1"
                                      title="重置回初始官方設定值"
                                    >
                                      <RefreshCw className="w-3 h-3" /> 重置
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingItemId(item.id);
                                      setEditingTitle(item.title);
                                      setEditingDesc(item.description);
                                    }}
                                    className="px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg font-bold transition-all flex items-center gap-1"
                                  >
                                    <Edit className="w-3 h-3" /> 編輯項目
                                  </button>
                                  <button
                                    onClick={() => handleCopyToClipboardAndBridge(item)}
                                    className={`px-2.5 py-1 text-[10px] font-bold border rounded-lg transition-all flex items-center gap-1 ${
                                      copiedItemId === item.id
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700"
                                    }`}
                                  >
                                    {copiedItemId === item.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" /> 已複製
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" /> 複製描述
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleCopyToClipboardAndBridge(item)}
                                    className="px-3 py-1 text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm shadow-amber-500/10"
                                    title="複製效果並直接對接 AI 編輯器，在編輯器中可一鍵導入"
                                  >
                                    <Send className="w-3 h-3" /> 傳送至 AI
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {filteredQueryItems.length > effectShowCount && (
                        <button type="button" onClick={() => setEffectShowCount(c => c + 60)}
                          className="w-full py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-[13px] text-slate-300">
                          顯示更多（還有 {filteredQueryItems.length - effectShowCount} 項）
                        </button>
                      )}
                      {filteredQueryItems.length === 0 && (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                          <HelpCircle className="w-8 h-8 text-slate-600 animate-pulse" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-400">找不到相符的核心機制與效果</p>
                            <p className="text-[10px] text-slate-600">請嘗試更換關鍵字，例如: 免死、先制、麻痺、消強等</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Rule Conflict Sandbox (col-span-5) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                      <Swords className="w-5 h-5 text-amber-400" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-200">⚔️ 對戰機制衝突判定沙盒</h3>
                        <p className="text-[10px] text-slate-400">模擬雙方核心規則交織時的最終優先級裁決</p>
                      </div>
                    </div>

                    {/* Preset Dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        選擇判定衝突情境
                      </label>
                      <select
                        value={selectedSandboxId}
                        onChange={(e) => setSelectedSandboxId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none font-bold font-sans"
                      >
                        {SANDBOX_SCENARIOS.map((scenario) => (
                          <option key={scenario.id} value={scenario.id}>
                            {scenario.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Scenario Content Rendering */}
                    {(() => {
                      const scenario = SANDBOX_SCENARIOS.find(s => s.id === selectedSandboxId);
                      if (!scenario) return null;

                      return (
                        <div className="space-y-4 animate-fade-in">
                          {/* Attack vs Def Diagram */}
                          <div className="space-y-2.5">
                            {/* Attacker Block */}
                            <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-xl space-y-1">
                              <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold font-mono">
                                進攻端 / 技能效果
                              </span>
                              <p className="text-xs font-semibold text-slate-200 leading-normal">
                                {scenario.attackerEffect}
                              </p>
                            </div>

                            {/* VS separator with dynamic pulse arrow */}
                            <div className="flex items-center justify-center py-1">
                              <div className="h-[1px] bg-slate-800 flex-1"></div>
                              <span className="text-[10px] text-slate-600 font-bold px-3 uppercase tracking-widest font-mono">
                                判定交鋒 (COLLISION)
                              </span>
                              <div className="h-[1px] bg-slate-800 flex-1"></div>
                            </div>

                            {/* Defender Block */}
                            <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-xl space-y-1">
                              <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold font-mono">
                                防禦端 / 保護阻斷
                              </span>
                              <p className="text-xs font-semibold text-slate-200 leading-normal">
                                {scenario.defenderEffect}
                              </p>
                            </div>
                          </div>

                          {/* System Verdict Banner */}
                          <div className={`p-4 rounded-xl border flex flex-col gap-1.5 relative overflow-hidden ${scenario.verdictBadgeColor}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                                引擎最終裁決 (Engine Verdict)
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">
                                PRIORITY OK
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm font-bold leading-tight flex items-center gap-1.5">
                              <Check className="w-4 h-4 shrink-0 text-current" />
                              {scenario.verdict}
                            </div>
                          </div>

                          {/* Order of Operations */}
                          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2.5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                              結算程序與先後順序
                            </span>
                            <div className="space-y-2 font-mono">
                              {scenario.orderOfOperations.map((step, idx) => (
                                <div key={idx} className="text-[11px] text-slate-400 leading-relaxed flex gap-2">
                                  <span className="text-amber-500 font-bold shrink-0">{idx + 1}.</span>
                                  <span>{step.substring(3)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Explanation Card */}
                          <div className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl leading-relaxed font-sans">
                            <span className="font-bold text-slate-300 block mb-1">💡 引擎判定法則詳解：</span>
                            {scenario.explanation}
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>
    </motion.div>
  );
};

interface SandboxScenario {
  id: string;
  title: string;
  attackerEffect: string;
  defenderEffect: string;
  verdict: string;
  verdictBadge: string;
  verdictBadgeColor: string;
  orderOfOperations: string[];
  explanation: string;
}

const SANDBOX_SCENARIOS: SandboxScenario[] = [
  {
    id: "always_hit_vs_invalid",
    title: "必中攻擊 (Always Hit) vs 技能無效 (Skill Invalidation)",
    attackerEffect: "必中攻擊技能 (例如：消強封印神技，帶有「必中」固有類效果)",
    defenderEffect: "技能無效類防護 (例如：對方處於「屬性/攻擊技能無效」狀態)",
    verdict: "技能判定未命中 (Miss)！防守方完全免傷並免疫附加效果。",
    verdictBadge: "防守方免疫 (Miss)",
    verdictBadgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    orderOfOperations: [
      "1. 攻擊方出手：發動必中技能。",
      "2. 判定前置：防守方發動【技能無效】機制（例如：屬性無效/技能無效）。",
      "3. 衝突裁決：【技能無效】優先級高於【必中】。系統將必中固有效果強制失效，並重新將命中率歸零（Miss）。",
      "4. 結算結果：技能未命中，防守方不受任何傷害與技能附加效果。"
    ],
    explanation: "根據《對戰引擎判定規範》，技能無效（SKILL_INVALID）在判定命中與否時，擁有絕對防護特權。即使進攻方使用「必中」固有效果，在技能無效面前依然會被判定為 Miss。這也是唯一能 100% 擋下必中攻擊的方法。"
  },
  {
    id: "insta_kill_vs_fatal_survive",
    title: "秒殺/瞬殺 (Insta-kill) vs 意志殘留/免死 (Fatal Resist)",
    attackerEffect: "秒殺/瞬殺效果 (例如：札克斯 15% 機率秒殺，附帶體力修正補償粉傷)",
    defenderEffect: "意志殘留保命模組 (例如：聖靈譜尼/布萊克，常駐或受到致死傷時保留 1HP)",
    verdict: "意志殘留生效！防守方強制保留 1 點體力，並觸發消強與消回合反制。",
    verdictBadge: "鎖血保命成功",
    verdictBadgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    orderOfOperations: [
      "1. 攻擊方出手：觸發 15% 秒殺判定成功。",
      "2. 傷害計算：秒殺以「最大體力值」為基礎發動不可減免的「體力修正」粉色真實傷害。",
      "3. 防禦判定：防守方受到致死傷害，觸發被動【意志殘留】或【免死意志】。",
      "4. 衝突裁決：【免死/意志殘留】優先級高於【體力修正秒殺】。體力降至 1 點後不再扣除。",
      "5. 反制觸發：防守方扣至 1HP 後，消除對手所有回合類效果，強制安全存活。"
    ],
    explanation: "秒殺機制（INSTA_KILL）雖然能繞過大部分常規減傷與護盾，但【意志殘留 / 致命抵抗】是一種「生命最低值強制鎖定」機制。當體力被秒殺修正扣減至致命線時，免死機制會強制攔截扣血，使其保留 1HP 存活。然而，若防守方不帶免死，秒殺將無視任何護盾與防禦直接終結。"
  },
  {
    id: "vampire_vs_barrier",
    title: "吸血/真傷 (Vampire / True Dmg) vs 護罩 (Pink Dmg Barrier)",
    attackerEffect: "追加固定/百分比真實傷害 (例如：粉傷吸血、每回合損失 1/6 體力)",
    defenderEffect: "護罩防護機制 (例如：貝連特/阿爾斯「抵擋固定傷害與百分比傷害」)",
    verdict: "護罩吸收全部粉傷！防護罩扣減等值耐久度，防守方本體無損。",
    verdictBadge: "護罩完美吸收",
    verdictBadgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    orderOfOperations: [
      "1. 攻擊方技能命中：造成正常攻擊紅字傷害，並附加 300 點固定真實傷害（粉傷）。",
      "2. 紅字結算：防守方受到紅字傷害（受防禦與護盾扣減）。",
      "3. 粉字結算：觸發 300 點粉字固定傷害結算。",
      "4. 衝突裁決：防守方有【粉傷護罩】，系統攔截該 300 點固定傷害，轉為扣除護罩耐久值。",
      "5. 回血判定：若進攻方是吸血技能，因粉傷被護罩擋下，進攻方無法吸取任何體力（吸血量為 0）。"
    ],
    explanation: "護罩（Barrier）是專門用來對抗固定傷害（Fixed Damage）和百分比傷害（Percentage Damage）的粉傷屏障。所有屬於技能傷害中的粉傷，在擊中本體前都會優先扣除護罩的耐久度。只有在護罩被完全打破後，後續的粉傷才會對本體造成傷害。此外，真實傷害若被護罩完全吸收，則不會觸發攻擊方的吸血轉換。"
  },
  {
    id: "dispel_support_vs_seal",
    title: "屬性附加效果失效 vs 屬性技能無效 (Support Dispel vs Invalidation)",
    attackerEffect: "屬性技能附加效果 (例如：屬性技能附加能力提升+2、恢復體力等)",
    defenderEffect: "屬性效果失效防護 (例如：對手處於「屬性技能附加效果失效」狀態)",
    verdict: "技能本身命中並扣減 PP，但所有附加的回血、提屬等效果直接無效化！",
    verdictBadge: "附加效果失效",
    verdictBadgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    orderOfOperations: [
      "1. 攻擊方使用屬性技能：系統判定該技能使用成功（命中）。",
      "2. 消耗與計數：正常扣除 1 點 PP 值，技能本身的固有觸發計數（如使用次數）+1。",
      "3. 附加判定：準備為自身施加攻擊+2、防禦+2 與恢復 300HP 的附加效果（分類 C）。",
      "4. 衝突裁決：防守方身上有【附加效果失效】。系統強制將這些附加效果抹除。",
      "5. 最終結算：技能成功放出，但沒有產生任何屬性提升與回血，形同空放。"
    ],
    explanation: "這是一個極其重要的經典概念。【屬性附加效果失效】不等於【屬性技能無效】。前者僅封鎖技能命中後的「追加效果（如提屬、回血、控場）」，但技能本身仍算施放成功，會扣PP並觸發固有計數；而後者（屬性技能無效）是直接把整個技能在命中前擋掉，判定為 Miss，兩者在戰術策略上有著截然不同的深度。"
  }
];

export default Encyclopedia;
