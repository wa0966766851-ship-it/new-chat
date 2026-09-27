import React from "react";
import { Zap, CheckCircle2, AlertTriangle, Clock, Blocks } from "lucide-react";
import { analyzeClauseBreakdown, ClauseAnalysisResult } from "../utils/clauseBreakdown";

interface ClauseBreakdownCardProps {
  title: string;
  description: string;
  elfId: string;
  elfName: string;
  customKitItems?: any[];
  onOpenBlockly?: (elfId: string) => void;
  badgeChar?: string;
  isSoulMark?: boolean;
}

export const ClauseBreakdownCard: React.FC<ClauseBreakdownCardProps> = ({
  title,
  description,
  elfId,
  elfName,
  customKitItems,
  onOpenBlockly,
  badgeChar,
  isSoulMark = true,
}) => {
  const analysis: ClauseAnalysisResult = analyzeClauseBreakdown(
    elfId,
    description,
    customKitItems,
    isSoulMark
  );

  const [open, setOpen] = React.useState(false);
  const clauses = analysis.clauses.filter(c => !/命運之輪/.test(c.clauseText));
  const statusText = (c: any) => c.status === "installed" ? "已實裝" : c.status === "missing" ? "未實裝" : (analysis.isKitMode ? "待確認" : "專屬程式");

  const handleOpenBlocklyClick = () => {
    if (onOpenBlockly) {
      onOpenBlockly(elfId);
    } else {
      // 前往「精靈自定 → 積木」並綁定這隻精靈
      window.dispatchEvent(new CustomEvent("edit-elf", { detail: { elfId, tab: "blockly" } }));
    }
  };

  return (
    <div className="rounded-2xl bg-black/25 p-3.5 space-y-3 text-left">
      {/* 標頭與卡牌原文 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200">
                {isSoulMark ? "專屬特性" : "技能"}: {title}
              </span>
              {badgeChar && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  【{badgeChar}】
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {analysis.isKitMode && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${analysis.overallStatus === "all_installed" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                積木效果
              </span>
            )}
            <button
              type="button"
              onClick={handleOpenBlocklyClick}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-cyan-300 transition-colors"
              title="用積木編輯"
            >
              <Blocks className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 卡牌原文 */}
        {(() => {
          const [mainText, ...rest] = (description || "").split("【命運之輪");
          const destiny = rest.length ? "【命運之輪" + rest.join("【命運之輪") : "";
          return (
            <>
              <p className="text-[12.5px] text-slate-300 leading-relaxed whitespace-pre-line">
                {mainText.trim() || "尚無描述文字"}
              </p>
              {destiny && (
                <div className="rounded-xl bg-cyan-500/10 px-2.5 py-1.5 text-[11.5px] text-cyan-200 leading-relaxed">
                  <span className="font-semibold">命運之輪模式限定：</span>{destiny.replace(/^【命運之輪\s*[A-Z]?\s*級?專屬攔截[:：]\s*/, "【")}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* 逐句分解 (Clause Breakdown) */}
      <div className="space-y-2 border-t border-white/[0.06] pt-2.5">
        <div className="flex justify-between items-center text-[11px] font-bold text-slate-400">
          <button type="button" onClick={() => setOpen(v => !v)} className="hover:text-slate-200 transition-colors">
            逐句分解 · {clauses.length} 句 {open ? "▾" : "▸"}
          </button>

        </div>

        {open && <div className="space-y-2">
          {clauses.map((clause, idx) => {
            const isInstalled = clause.status === "installed";
            const isMissing = clause.status === "missing";

            return (
              <div
                key={idx}
                className={`px-2.5 py-2 rounded-xl text-xs space-y-1.5 ${isMissing ? "bg-rose-500/10" : "bg-white/[0.04]"}`}
              >
                {/* 句原文 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5 text-slate-200 font-medium">
                    <span className="text-[11px] font-bold text-slate-500 shrink-0">
                      {idx + 1}.
                    </span>
                    {!isSoulMark && (() => {
                      let roleIcon = "🎯";
                      let roleName = "附加";
                      let roleClass = "bg-emerald-950/80 text-emerald-300 border-emerald-800/80";
                      
                      const txt = clause.clauseText;
                      if (txt.includes("必中") || txt.includes("先制") || txt.includes("無視") || txt.includes("不受PP") || txt.includes("視為弱化")) {
                        roleIcon = "■";
                        roleName = "固有";
                        roleClass = "bg-blue-950/80 text-blue-300 border-blue-800/80";
                      } else if (txt.includes("攜帶") || txt.includes("條件")) {
                        roleIcon = "◇";
                        roleName = "攜帶";
                        roleClass = "bg-amber-950/80 text-amber-300 border-amber-800/80";
                      }
                      
                      return (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border shrink-0 ${roleClass}`}
                          title={`技能【${roleName}】效果`}
                        >
                          {roleIcon} {roleName}
                        </span>
                      );
                    })()}
                    <span>{clause.clauseText}</span>
                  </div>

                  {/* 狀態 Icon & Label */}
                  <div className="shrink-0 flex items-center gap-1">
                    {isInstalled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                        <CheckCircle2 className="w-3 h-3" /> {statusText(clause)}
                      </span>
                    ) : isMissing ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60">
                        <AlertTriangle className="w-3 h-3" /> {statusText(clause)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300">
                        {statusText(clause)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 對應原子 & 參數細節 */}
                {false && (clause.matchedAtomName || clause.timePoint) && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400 pl-4 pt-0.5">
                    {clause.matchedAtomName && (
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-cyan-300">
                        原子: {clause.matchedAtomName}
                      </span>
                    )}
                    {clause.timePoint && (
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-amber-300/90">
                        時點: {clause.timePoint}
                      </span>
                    )}
                    {clause.paramsSummary && (
                      <span className="text-slate-400">
                        參數: {clause.paramsSummary}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>}
      </div>

      {/* 底部覆蓋率 */}
      {open && analysis.isKitMode && <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-400">
        <div className="flex items-center gap-2">
          <span>覆蓋率:</span>
          <span
            className={`font-mono font-extrabold ${
              analysis.isKitMode
                ? analysis.overallStatus === "all_installed"
                  ? "text-emerald-400"
                  : "text-amber-400"
                : "text-violet-400"
            }`}
          >
            {analysis.coverageText}
          </span>
        </div>

        {/* 可視化進度點 */}
        {analysis.isKitMode ? (
          <div className="flex items-center gap-1">
            {analysis.clauses.map((c, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${
                  c.status === "installed"
                    ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                    : "bg-amber-500"
                }`}
              />
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-violet-400/80 font-mono">
            ●●● (需戰鬥測試)
          </span>
        )}
      </div>}
    </div>
  );
};
