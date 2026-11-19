import React, { lazy, Suspense, useState } from 'react';
import { Book, Shield, Zap, Info, ChevronRight, X, Search, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'motion/react';
import tacticalPageCss from '../design/tacticalPageCss';
import { useScopedStyle } from './destiny/injectStyle';
import { StatusRegistry } from '../effects/statusRegistry';
import { StatusCategory } from '../effects/statusTypes';
import { TYPE_MATCHUPS, SEER_TYPES, setDynamicMatchups } from '../utils/statCalculator';
import { ElfAvatar, TypeIcon } from './SeerImages';
import { statusVisual } from '../battle/effectIcons';
import { ElfRosterCard } from './ElfRosterCard';

import { RichDescription } from './RichDescription';
import { readStoredRecord } from '../utils/safeStorage';
import type { Elf } from '../types';
import { BossStatusSection } from './BossStatusSection';

import { IndexSearchPanel, NodeAtlasPanel, MechanicsPanel, ModeGuidePanel } from './encyclopedia/EncyclopediaPanels';
import { TypeMatchupPanel } from './encyclopedia/TypeMatchupPanel';
import encyclopediaCss from './encyclopedia/encyclopediaCss';
import type { IndexEntry, IndexTab } from '../data/encyclopediaIndex';
import type { EncyclopediaTab } from '../shell/features';
import { applyElfFilter } from '../utils/elfFilter';
import { ElfFilterBar, useElfFilter } from './shared/ElfPicker';

import { useGameData } from '../contexts/GameDataContext';

const ElfSpotlight = lazy(() => import('./ElfSpotlight').then(m=>({default:m.ElfSpotlight})));
const OpCodePanel = lazy(() => import('./OpCodePanel').then(m=>({default:m.OpCodePanel})));
const loading = <p role="status" className="p-4 text-slate-400">載入資料…</p>;

interface EncyclopediaProps {
  onClose: () => void;
  initialTab?: EncyclopediaTab;
}

/** 百科分頁導航（目錄測試逐項讀取分頁鍵與名稱）。 */
const ENCYCLOPEDIA_NAV: { title: string; tabs: (readonly [EncyclopediaTab, string])[] }[] = [
  { title: '檢索', tabs: [['search', '總索引']] },
  { title: '資料', tabs: [['elves', '精靈圖鑑'], ['status', '異常狀態'], ['types', '屬性克制']] },
  { title: '規則', tabs: [['mechanics', '戰鬥機制'], ['nodes', '戰鬥節點'], ['opCodes', '積木代號']] },
  { title: '玩法', tabs: [['modes', '玩法說明']] },
  { title: '工具', tabs: [['editor', '自訂克制']] },
];

const Encyclopedia: React.FC<EncyclopediaProps> = ({ onClose, initialTab = 'search' }) => {
  useScopedStyle('tactical-page-css', tacticalPageCss);
  useScopedStyle('encyclopedia-shell-css', encyclopediaCss);
  const { allElves } = useGameData();
  // 已移除的分頁（例如舊「效果查詢」）一律回到總索引。
  const [activeTab, setActiveTab] = useState<EncyclopediaTab>(() => ENCYCLOPEDIA_NAV.some(g => g.tabs.some(([k]) => k === initialTab)) ? initialTab : 'search');
  const [opFocus, setOpFocus] = useState<string | undefined>(undefined);
  const [nodeFocus, setNodeFocus] = useState<string | undefined>(undefined);
  // 總索引 → 原分頁：積木帶代號、節點帶 key、異常與效果帶名稱，直接落在搜尋結果上。
  const jumpFromIndex = (tab: IndexTab, entry: IndexEntry) => {
    if (tab === 'opCodes') setOpFocus(entry.id.replace(/^op:/, ''));
    if (tab === 'nodes') setNodeFocus(entry.code ?? entry.title);
    if (tab === 'status') setStatusSearchQuery(entry.title);
    setActiveTab(tab);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const elfFilter = useElfFilter();
  const [selectedElf, setSelectedElf] = useState<Elf | null>(null);
  const deferredElfSpec = React.useDeferredValue(elfFilter.spec);
  const shownElves = React.useMemo(() => activeTab === 'elves' ? applyElfFilter(allElves, deferredElfSpec) : [], [activeTab, allElves, deferredElfSpec]);
  const [statusSearchQuery, setStatusSearchQuery] = useState('');
  const [selectedStatusCategories, setSelectedStatusCategories] = useState<StatusCategory[]>([]);
  const [customMatchups, setCustomMatchups] = useState<any>(() => {
    return readStoredRecord('seer_custom_matchups');
  });

  // State for fullscreen/maximized mode
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

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

  const categoryLabels: Record<string, { label: string; description: string; color: string }> = {
    CONTROL: { label: '【控制類異常】', description: '處於該異常狀態則每回合無法行動。', color: 'text-amber-400' },
    WEAKENING: { label: '【弱化類異常】', description: '每回合對手出手或結束時受傷、降低能力等效果。', color: 'text-purple-400' },
    RESTRICTIVE: { label: '【限制類異常】', description: '限制切換、無法使用藥劑等戰鬥操作限制。', color: 'text-indigo-400' },
    EVOLUTIONARY: { label: '【衍化類異常】', description: '異常結束或觸發條件後轉化為另一種狀態。', color: 'text-emerald-400' },
    AUXILIARY: { label: '【附屬類異常】', description: '星附屬、詛咒附屬、特殊戰場狀態等。', color: 'text-cyan-400' },
    BOSS_ONLY: { label: '【附屬類・BOSS 類異常】', description: '附屬類異常的子集合：免疫、神話與全部 BOSS 特性（含擴展），依性質分子類；關閉回合數（無回合數、不遞減、下場保留）。', color: 'text-rose-400' },
    NO_EFFECT: { label: '【無效果類異常】', description: '異常抵抗轉化等無效果類異常。', color: 'text-slate-400' },
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 transition-all duration-300 ${isMaximized ? 'p-0' : 'p-4'}`}
    >
      <div data-skin="tactical" data-enc-shell className={`enc-shell transition-all duration-300 ${isMaximized ? 'w-full h-full !rounded-none' : 'w-[94vw] max-w-[1400px] h-[88vh]'}`}>
        <i className="enc-orbit" aria-hidden="true" />
        <div className="enc-head">
          <div className="flex items-center gap-3 min-w-0">
            <span className="enc-icon" aria-hidden="true"><Book className="w-4 h-4" /></span>
            <div className="min-w-0">
              <div className="enc-kicker">SEER // BATTLE ARCHIVE</div>
              <h2 className="enc-title">圖鑑與戰鬥百科</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="enc-icon" onClick={() => setIsMaximized(!isMaximized)} title={isMaximized ? "還原視窗" : "全螢幕"}>
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button className="enc-icon" onClick={onClose} title="關閉"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="enc-body">
        {/* 分頁：依用途分組（檢索／資料／規則／玩法／工具） */}
        <nav className="enc-rail" aria-label="百科分頁">
          {ENCYCLOPEDIA_NAV.map(group => (
            <React.Fragment key={group.title}>
              <h4>{group.title}</h4>
              {group.tabs.map(([key, label]) => (
                <button key={key} data-active={activeTab === key} data-tab={key} onClick={() => setActiveTab(key)}>{label}</button>
              ))}
            </React.Fragment>
          ))}
        </nav>

        {/* Content */}
        <div className="enc-content tac-page space-y-8">
          {activeTab === 'elves' && (
            <div className="space-y-6 animate-fade-in pb-8">
              <ElfFilterBar state={elfFilter} count={`${shownElves.length} / ${allElves.length}`} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {shownElves.map((elf, index) => <ElfRosterCard key={`${elf.id}-${index}`} elf={elf} onDetail={() => setSelectedElf(elf)} />)}
              </div>
              {selectedElf && <Suspense fallback={loading}><ElfSpotlight elves={allElves} selectedElf={allElves.find(e=>e.id===selectedElf.id) ?? selectedElf} onClose={()=>setSelectedElf(null)}/></Suspense>}
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

                  const seenStatusNames = new Set<string>();
                  let statusesInCategory = Object.entries(StatusRegistry).filter(([_, entry]) => {
                    if (!entry.categories.includes(catKey as StatusCategory) || seenStatusNames.has(entry.name)) return false;
                    // BOSS 類＝附屬類的子集合：同名異常只在 BOSS 類區塊顯示一張卡（卡上按鈕切換 BOSS 類／附屬類說明），附屬類區塊不重複列出。
                    if (catKey === 'AUXILIARY' && entry.categories.includes('BOSS_ONLY')) return false;
                    seenStatusNames.add(entry.name);
                    return true;
                  });

                  // Apply text search query
                  if (statusSearchQuery.trim() && catKey !== 'BOSS_ONLY') {
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
                      {catKey === 'BOSS_ONLY' ? <BossStatusSection query={statusSearchQuery} entries={statusesInCategory.map(([, e]) => ({ name: e.name, description: e.description }))} /> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              <RichDescription text={status.description} className="text-xs text-slate-300 font-sans" />
                            </div>
                          </div>
                        ))}
                      </div>}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
          
          {activeTab === 'types' && <TypeMatchupPanel customMatchups={customMatchups} />}

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

          {activeTab === 'mechanics' && (<MechanicsPanel />)}
          {activeTab === 'search' && (<IndexSearchPanel onJump={jumpFromIndex} />)}
          {activeTab === 'nodes' && (<NodeAtlasPanel key={nodeFocus} focus={nodeFocus} />)}
          {activeTab === 'modes' && (<ModeGuidePanel />)}

          {activeTab === 'opCodes' && <Suspense fallback={loading}><OpCodePanel key={opFocus} initialQuery={opFocus} /></Suspense>}


        </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Encyclopedia;
