import React, { useState, useMemo, useDeferredValue, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Sparkles, Search, Check, Tag, Shield, Zap, Flame, Heart, X, HelpCircle, ArrowRight } from 'lucide-react';
import { CardTemplateModule as AIEffectModule, REAL_CARD_EFFECT_MODULES as AI_EFFECT_REFERENCE_LIBRARY, searchCardTemplates as searchEffectLibrary, TEMPLATE_GRAMMAR_GUIDELINES } from '../data/cardTemplates';
import { getTemplateReviewReason, getTemplateTimingLabel } from '../utils/templateReview';

const reviewCount = AI_EFFECT_REFERENCE_LIBRARY.filter(m => getTemplateReviewReason(m.standardSyntax)).length;

interface EffectLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (module: AIEffectModule) => void;
  currentText?: string;
}

export const EffectLibraryModal: React.FC<EffectLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectModule,
  currentText = ""
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"catalog" | "review" | "grammar">("catalog");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(onClose);
  const deferredQuery = useDeferredValue(searchQuery);
  const pageSize = 32;
  useEffect(() => setPage(0), [deferredQuery, selectedCategory, activeTab]);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const controls = Array.from<HTMLElement>(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]'))
        // 複合選擇器在不同 DOM 實作的順序可能不同，明確依畫面節點順序導航。
        .sort((a, b) => a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  const filteredModules = useMemo(() => searchEffectLibrary(deferredQuery).filter(m => {
    const needsReview = !!getTemplateReviewReason(m.standardSyntax);
    if (activeTab === "review") return needsReview;
    if (needsReview) return false;
    if (selectedCategory === "all") return true;
    if (selectedCategory === "soul_mark") return m.category === "soul_mark" || m.category === "survival" || m.category === "boost" || m.category === "control";
    if (selectedCategory === "skill_effect") return m.category === "skill_effect" || m.category === "boost" || m.category === "control" || m.category === "survival";
    return m.category === selectedCategory;
  }), [deferredQuery, selectedCategory, activeTab]);
  const pageCount = Math.max(1, Math.ceil(filteredModules.length / pageSize));
  if (!isOpen) return null;

  const handleSelect = (mod: AIEffectModule) => {
    if (getTemplateReviewReason(mod.standardSyntax)) return;
    onSelectModule(mod);
    setCopiedId(mod.id);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "control":
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Zap className="w-3 h-3" /> 控場異常</span>;
      case "survival":
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Heart className="w-3 h-3" /> 生存續航</span>;
      case "boost":
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Flame className="w-3 h-3" /> 強化增傷</span>;
      default:
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Tag className="w-3 h-3" /> 技能機制</span>;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="效果引用資料庫"
        ref={dialogRef}
        className="ios-panel ios-dialog p-4 sm:p-6 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4 mb-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                AI 效果引用與標準模板詞庫
                <span className="hidden sm:inline-block sm:ml-2 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-normal">
                  解構入庫 & 模板化參考
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                引用精靈效果的描述模板；模板可供生成參考，不代表效果已完成實裝或驗證。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="關閉效果引用資料庫"
            className="w-8 h-8 shrink-0 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Tabs: Catalog vs Grammar Guidelines */}
        <div className="flex flex-wrap gap-2 mb-4 shrink-0 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "catalog"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            描述候選 ({AI_EFFECT_REFERENCE_LIBRARY.length - reviewCount})
          </button>
          <button onClick={() => setActiveTab("review")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "review" ? "bg-amber-600 text-white" : "bg-slate-800/60 text-slate-400"}`}>待確認資料 ({reviewCount})</button>
          <button
            onClick={() => setActiveTab("grammar")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "grammar"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            賽爾號模板化描述規範指引
          </button>
        </div>

        {activeTab !== "grammar" ? (
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            {activeTab === "review" && <p className="text-xs text-amber-300 leading-5">原始內容保留。以下標題／背景資料暫不提供效果引用；需回到原始 txt 確認。其餘候選也不代表已實裝。</p>}
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                {[
                  { id: "all", label: "全部效果" },
                  { id: "control", label: "⚡ 控場/麻痺" },
                  { id: "survival", label: "❤️ 生存/續航/免死" },
                  { id: "boost", label: "🔥 強化/增傷/劍舞" },
                  { id: "skill_effect", label: "🏷️ 技能連擊反彈" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedCategory === cat.id
                        ? "bg-slate-700 text-white border border-slate-600"
                        : "bg-[#050608] text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜尋關鍵字 (例如: 麻痺、劍舞、免死)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#050608] border border-slate-800 focus:border-violet-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Modules List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
              {filteredModules.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  未找到匹配的效果模組，試試搜尋其他關鍵字或切換分類！
                </div>
              ) : (
                filteredModules.slice(page * pageSize, (page + 1) * pageSize).map((mod) => (
                  <div
                    key={mod.id}
                    className="bg-[#050608] border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                  >
                    <div className="space-y-2 flex-1 min-w-0 break-words">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-100 group-hover:text-violet-300 transition-colors">
                          {mod.name}
                        </span>
                        {getCategoryBadge(mod.category)}
                        <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                          {mod.source}
                        </span>
                        <span className="text-[10px] text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded font-mono">
                          時點: {getTemplateTimingLabel(mod.standardSyntax)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono leading-relaxed bg-black/40 p-2.5 rounded-xl border border-slate-800/60">
                        {mod.standardSyntax}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {mod.tags.map((tag, i) => (
                          <span key={i} className="text-[9px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelect(mod)}
                      disabled={activeTab === "review" || copiedId === mod.id}
                      title={getTemplateReviewReason(mod.standardSyntax) || "僅引用描述文字，不會新增戰鬥 handler"}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 w-full md:w-auto justify-center cursor-pointer ${
                        copiedId === mod.id
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                          : "bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30"
                      }`}
                    >
                      {activeTab === "review" ? <span>待原始文本確認</span> : copiedId === mod.id ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>已引用到描述中！</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>一鍵引用此模組</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
            <nav aria-label="效果引用資料分頁" className="shrink-0 grid grid-cols-4 gap-1.5 text-center text-xs text-slate-300">
              <span className="col-span-2 text-left text-slate-400">{filteredModules.length} 項</span>
              <span className="col-span-2 text-right">第 {page + 1} / {pageCount} 頁</span>
              <button type="button" disabled={page === 0} onClick={() => setPage(0)} className="rounded-xl bg-white/5 px-3 py-2 disabled:opacity-30">首頁</button>
              <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-xl bg-white/5 px-3 py-2 disabled:opacity-30">上一頁</button>
              <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)} className="rounded-xl bg-white/5 px-3 py-2 disabled:opacity-30">下一頁</button>
              <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(pageCount - 1)} className="rounded-xl bg-white/5 px-3 py-2 disabled:opacity-30">末頁</button>
            </nav>
          </div>
        ) : (
          /* Grammar Guidelines Tab */
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#050608] border border-slate-800 rounded-2xl space-y-6 text-slate-300 text-xs leading-relaxed">
            <div className="border-b border-slate-800 pb-4">
              <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                什麼是「AI 解構與規範化模板描述」？
              </h4>
              <p className="text-slate-400">
                  描述可拆成觸發時點、條件、目標與行為，例如強化、免死、麻痺或吸血。AI 或本地解析結果只能當作草稿，仍須核對原始 TXT 與實際執行的效果。
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-2">
                <h5 className="font-bold text-amber-300">📌 規則一：觸發時機與條件標籤化</h5>
                <p className="text-slate-400">
                  每個獨立效果必須明確其觸發時點。系統標準化的時點包含：
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] text-cyan-300">
                  <span className="bg-black/50 p-1.5 rounded border border-slate-800">登場時：...；</span>
                  <span className="bg-black/50 p-1.5 rounded border border-slate-800">回合開始時：...；</span>
                  <span className="bg-black/50 p-1.5 rounded border border-slate-800">回合結束時：...；</span>
                  <span className="bg-black/50 p-1.5 rounded border border-slate-800">攻擊命中後：...；</span>
                  <span className="bg-black/50 p-1.5 rounded border border-slate-800">受到技能傷害時：...；</span>
                  <span className="bg-black/50 p-1.5 rounded border border-slate-800">常駐效果：...；</span>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-2">
                <h5 className="font-bold text-emerald-300">📌 規則二：複合效果使用正體全形分號「；」隔開</h5>
                <p className="text-slate-400">
                  建議以分號「；」分開不同判定，讓描述較易閱讀與核對；分號本身不保證引擎能解析，也不決定戰鬥結算優先級。
                </p>
                <div className="bg-black/60 p-3 rounded-lg border border-slate-800 font-mono text-slate-200">
                  <span className="text-rose-400 line-through block mb-1">❌ 錯誤口語：血少的時候傷害增加50%，然後每回合回血20%，被打可能麻痺對面</span>
                  <span className="text-emerald-400 block">✅ 規範模板：回合開始時：若自身當前體力低於 50%，則造成的傷害提升 50%；回合結束時：自動恢復最大體力的 20%；受到技能傷害時：有 30% 機率使對手麻痺；</span>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-2">
                <h5 className="font-bold text-violet-300">📌 規則三：已有效果引用 vs 新創效果入庫</h5>
                <p className="text-slate-400">
                  點擊引用只會附加描述文字，不會新增戰鬥處理器。新機制須另外建立積木或專屬處理器，加入技能語意測試；未確認的時點、條件與原始描述應保留待確認，不能視為已實裝。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 mt-4 flex justify-between items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            提示：點擊「一鍵引用」會將規範文本直接附加到您目前的輸入框中
          </span>
          <button
            onClick={onClose}
            className="py-2 px-3 sm:px-5 shrink-0 whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
          >
            完成與返回
          </button>
        </div>
      </motion.div>
    </div>, document.body
  );
};
