import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Sparkles, Search, Check, Tag, Shield, Zap, Flame, Heart, X, HelpCircle, ArrowRight } from 'lucide-react';
import { CardTemplateModule as AIEffectModule, REAL_CARD_EFFECT_MODULES as AI_EFFECT_REFERENCE_LIBRARY, searchCardTemplates as searchEffectLibrary, TEMPLATE_GRAMMAR_GUIDELINES } from '../data/cardTemplates';

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
  const [activeTab, setActiveTab] = useState<"catalog" | "grammar">("catalog");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredModules = searchEffectLibrary(searchQuery).filter(m => {
    if (selectedCategory === "all") return true;
    if (selectedCategory === "soul_mark") return m.category === "soul_mark" || m.category === "survival" || m.category === "boost" || m.category === "control";
    if (selectedCategory === "skill_effect") return m.category === "skill_effect" || m.category === "boost" || m.category === "control" || m.category === "survival";
    return m.category === selectedCategory;
  });

  const handleSelect = (mod: AIEffectModule) => {
    onSelectModule(mod);
    setCopiedId(mod.id);
    setTimeout(() => {
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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#0D0F17] border border-slate-800 rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                AI 效果引用與標準模板詞庫
                <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-normal">
                  解構入庫 & 模板化參考
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                點擊一鍵引用經典精靈效果或系統模組；AI 將自動解構您的文本並進行規範化實裝。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Tabs: Catalog vs Grammar Guidelines */}
        <div className="flex gap-2 mb-4 shrink-0 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "catalog"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            效果模組庫存與引用 ({AI_EFFECT_REFERENCE_LIBRARY.length})
          </button>
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

        {activeTab === "catalog" ? (
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
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
                filteredModules.map((mod) => (
                  <motion.div
                    key={mod.id}
                    layout
                    className="bg-[#050608] border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-100 group-hover:text-violet-300 transition-colors">
                          {mod.name}
                        </span>
                        {getCategoryBadge(mod.category)}
                        <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                          {mod.source}
                        </span>
                        <span className="text-[10px] text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded font-mono">
                          觸發: {mod.triggerTime}
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
                      disabled={copiedId === mod.id}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 w-full md:w-auto justify-center cursor-pointer ${
                        copiedId === mod.id
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                          : "bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30"
                      }`}
                    >
                      {copiedId === mod.id ? (
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
                  </motion.div>
                ))
              )}
            </div>
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
                在《賽爾號》中，強大的精靈技能與魂印具有高度嚴謹的語法結構。當您使用 AI 進行生成或實時修正時，AI 會首先將您的口語描述進行<strong>「功能解構」</strong>，將其中提及的強化、免死、麻痺、吸血等單元提取出來。
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
                  嚴禁使用逗號或句號串連多個獨立判定，分號「；」是遊戲引擎解析判定優先級的核心符號。
                </p>
                <div className="bg-black/60 p-3 rounded-lg border border-slate-800 font-mono text-slate-200">
                  <span className="text-rose-400 line-through block mb-1">❌ 錯誤口語：血少的時候傷害增加50%，然後每回合回血20%，被打可能麻痺對面</span>
                  <span className="text-emerald-400 block">✅ 規範模板：回合開始時：若自身當前體力低於 50%，則造成的傷害提升 50%；回合結束時：自動恢復最大體力的 20%；受到技能傷害時：有 30% 機率使對手麻痺；</span>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-2">
                <h5 className="font-bold text-violet-300">📌 規則三：已有效果引用 vs 新創效果入庫</h5>
                <p className="text-slate-400">
                  您在左側「效果模組庫存」點擊引用的經典效果（例如雷伊麻痺、劍舞強化），AI 在分析時會自動辨識並標記為<strong>「[引用庫存]」</strong>；若您在文本中提出了全新的原創機制，AI 會幫您標準化為上述模板語法，並標記為<strong>「[新入庫規範化效果]」</strong>，確保引擎能無縫相容！
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 mt-4 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            提示：點擊「一鍵引用」會將規範文本直接附加到您目前的輸入框中
          </span>
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
          >
            完成與返回
          </button>
        </div>
      </motion.div>
    </div>
  );
};
