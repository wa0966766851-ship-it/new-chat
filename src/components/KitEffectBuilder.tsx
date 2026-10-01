import React, { useState, useMemo, useRef, useDeferredValue, useEffect } from "react";
import { isBlocklyEntry } from "../blocks/kitEntries";
import { KitEntry, EffectCode, Role, Node, Era } from "../effects/effectSystem.schema";
import { CODEX, searchEffectCodes } from "../data/codexRegistry";
import { Sparkles, Plus, Trash2, Tag, Info, Layers, Check, Search, AlertTriangle, Box, Shuffle, Edit3, Puzzle } from "lucide-react";
const LazyBlocklyBuilder = React.lazy(() => import('./BlocklyBuilder').then(m => ({ default: m.BlocklyBuilder })));
function BlocklyBuilder(props: React.ComponentProps<typeof LazyBlocklyBuilder>) {
  return <React.Suspense fallback={<p role="status" className="p-4 text-slate-400">載入積木工作區…</p>}><LazyBlocklyBuilder {...props} /></React.Suspense>;
}
import { DamageEffectComposer } from './DamageEffectComposer';
import { DamageModifierComposer } from './DamageModifierComposer';

/** 積木（Blockly）可編輯的詞條：codeId 為原子名 */
export { isBlocklyEntry } from "../blocks/kitEntries";

interface BlockSlot {
  type: string;
  cur?: string;
}

interface BlockItem {
  id: string;
  src: string;
  skeleton: string;
  role: string;
  atomic?: boolean;
  slots?: BlockSlot[];
}

interface BlockLibrary {
  pools: {
    狀態: string[];
    目標: string[];
    傷害類型: string[];
    屬性項: string[];
    傷害運算: string[];
    數值類: Record<string, string>;
    [key: string]: any;
  };
  blocks: BlockItem[];
}

const EMPTY_BLOCK_LIBRARY: BlockLibrary = {
  pools: { 狀態: [], 目標: [], 傷害類型: [], 屬性項: [], 傷害運算: [], 數值類: {} },
  blocks: [],
};

interface KitEffectBuilderProps {
  kit: KitEntry[];
  onChange: (newKit: KitEntry[]) => void;
  source?: "skill" | "soulmark" | "mechanic" | "item";
  onInsertDescription?: (text: string) => void;
}

const NODES: { value: Node; label: string }[] = [
  { value: "battle_start", label: "戰鬥開始時 (battle_start)" },
  { value: "on_entered", label: "登場時 (on_entered)" },
  { value: "before_action", label: "先出手/出手前 (before_action)" },
  { value: "before_skill", label: "使用技能前 (before_skill)" },
  { value: "before_damage", label: "造成傷害前 (before_damage)" },
  { value: "on_hit", label: "技能命中時 (on_hit)" },
  { value: "on_damaged", label: "受擊時 (on_damaged)" },
  { value: "after_action", label: "出手流程結束 (after_action)" },
  { value: "round_start", label: "回合開始時 (round_start)" },
  { value: "round_end", label: "回合結束時 (round_end)" },
  { value: "on_kill", label: "擊敗對手/未擊敗時 (on_kill)" },
  { value: "self_fatal", label: "致死時/重生 (self_fatal)" },
];

function getDefaultSlotValue(typeText: string, idx: number, block: BlockItem, blockLibrary: BlockLibrary): string {
  if (block.slots && block.slots.length > 0) {
    const found = block.slots.find(s => s.type === typeText && s.cur);
    if (found && found.cur) return found.cur;
    if (block.slots[idx] && block.slots[idx].cur) {
      return block.slots[idx].cur!;
    }
  }
  if (typeText === "狀態") return blockLibrary.pools.狀態?.[0] || "中毒";
  if (typeText === "傷害類型") return blockLibrary.pools.傷害類型?.[0] || "固定傷害";
  if (typeText === "屬性項") return blockLibrary.pools.屬性項?.[0] || "全屬性";
  if (typeText === "傷害運算" || typeText === "運算") return blockLibrary.pools.傷害運算?.[0] || "秒殺";
  if (typeText === "百分比" || typeText === "數值") return "100";
  if (typeText === "回合數") return "3";
  if (typeText === "分數") return "1/3";
  return "1";
}

function extractSkeletonTokens(skeleton: string): { typeText: string; index: number }[] {
  const regex = /⟨([^⟩]+)⟩/g;
  const result: { typeText: string; index: number }[] = [];
  let match;
  let idx = 0;
  while ((match = regex.exec(skeleton)) !== null) {
    result.push({ typeText: match[1], index: idx });
    idx++;
  }
  return result;
}

export const KitEffectBuilder: React.FC<KitEffectBuilderProps> = ({
  kit,
  onChange,
  source = "soulmark",
  onInsertDescription,
}) => {
  const [mode, setMode] = useState<"id" | "block" | "blockly">("blockly");
  const [blockLibrary, setBlockLibrary] = useState<BlockLibrary>(EMPTY_BLOCK_LIBRARY);
  const [libraryError, setLibraryError] = useState(false);
  useEffect(() => {
    if (mode !== "block" || blockLibrary !== EMPTY_BLOCK_LIBRARY) return;
    let active = true;
    setLibraryError(false);
    import("../data/blockLibraryData").then(module => {
      if (active) setBlockLibrary(module.default as unknown as BlockLibrary);
    }).catch(() => { if (active) setLibraryError(true); });
    return () => { active = false; };
  }, [mode, blockLibrary]);
  // 積木模式只編輯積木詞條，其他（編號／換槽）詞條原樣保留
  const blocklyPart = useMemo(() => (kit || []).filter(isBlocklyEntry), [kit]);
  const otherPart = useMemo(() => (kit || []).filter(e => !isBlocklyEntry(e)), [kit]);
  const lastEmitted = useRef<string>(JSON.stringify(blocklyPart));
  const keyRef = useRef(0);
  const blocklyJson = JSON.stringify(blocklyPart);
  if (blocklyJson !== lastEmitted.current) { lastEmitted.current = blocklyJson; keyRef.current++; } // 外部改動（例如刪除、AI 解析）→ 重建畫布
  const blocklyKey = keyRef.current;
  const [selectedRole, setSelectedRole] = useState<Role | "all">("all");
  const [selectedEra, setSelectedEra] = useState<Era | "all">("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeCodeId, setActiveCodeId] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [selectedNode, setSelectedNode] = useState<Node>("on_hit");

  // Block Mode state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [blockSlotValues, setBlockSlotValues] = useState<string[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>("對手");
  const [blockSearchKeyword, setBlockSearchKeyword] = useState("");
  const [blockRoleFilter, setBlockRoleFilter] = useState<string>("all");
  const deferredSearchKeyword = useDeferredValue(searchKeyword);
  const deferredBlockSearchKeyword = useDeferredValue(blockSearchKeyword);

  const filteredCodes = useMemo(() => {
    if (mode !== "id") return [];
    return searchEffectCodes({
      role: selectedRole === "all" ? undefined : selectedRole,
      era: selectedEra === "all" ? undefined : selectedEra,
      keyword: deferredSearchKeyword,
    });
  }, [mode, selectedRole, selectedEra, deferredSearchKeyword]);

  const filteredBlocks = useMemo(() => {
    if (mode !== "block") return [];
    const kw = deferredBlockSearchKeyword.trim().toLowerCase();
    return (blockLibrary.blocks || []).filter(b => {
      if (blockRoleFilter !== "all" && b.role !== blockRoleFilter) return false;
      if (!kw) return true;
      return (
        b.id.toLowerCase().includes(kw) ||
        b.skeleton.toLowerCase().includes(kw) ||
        (b.src && b.src.toLowerCase().includes(kw))
      );
    });
  }, [mode, deferredBlockSearchKeyword, blockRoleFilter, blockLibrary]);

  const { displayedBlocks, remainingCount } = useMemo(() => {
    const limit = deferredBlockSearchKeyword.trim() ? 300 : 100;
    const displayed = filteredBlocks.slice(0, limit);
    return {
      displayedBlocks: displayed,
      remainingCount: filteredBlocks.length - displayed.length,
    };
  }, [filteredBlocks, deferredBlockSearchKeyword]);

  const activeCode = activeCodeId ? CODEX[activeCodeId] : null;
  const activeBlock = selectedBlockId
    ? (blockLibrary.blocks || []).find(b => b.id === selectedBlockId) || null
    : null;

  const handleSelectBlock = (block: BlockItem) => {
    setSelectedBlockId(block.id);
    const tokens = extractSkeletonTokens(block.skeleton);
    const defaults = tokens.map((tk, idx) => getDefaultSlotValue(tk.typeText, idx, block, blockLibrary));
    setBlockSlotValues(defaults);
    const hasSelf = block.skeleton.includes("自身") || block.skeleton.includes("自己") || block.skeleton.includes("己方");
    setSelectedTarget(hasSelf ? "自身" : "對手");
  };

  const previewBlockText = useMemo(() => {
    if (!activeBlock) return "";
    let text = activeBlock.skeleton;
    const tokens = extractSkeletonTokens(activeBlock.skeleton);
    tokens.forEach((tk, idx) => {
      const val = blockSlotValues[idx] || getDefaultSlotValue(tk.typeText, idx, activeBlock, blockLibrary);
      text = text.replace(`⟨${tk.typeText}⟩`, val);
    });
    // Adjust target wording
    if (selectedTarget === "自身") {
      text = text.replace(/對方|對手|敵方/g, "自身").replace(/對方全體/g, "己方全體");
    } else if (selectedTarget === "對手") {
      text = text.replace(/對方|對手/g, "對手");
    } else if (selectedTarget === "雙方") {
      text = text.replace(/對方|對手|自身|自己/g, "雙方");
    } else if (selectedTarget === "己方全體") {
      text = text.replace(/對方|對手|自身|自己/g, "己方全體");
    } else if (selectedTarget === "對方全體") {
      text = text.replace(/對方|對手|自身|自己/g, "對方全體");
    } else if (selectedTarget === "己方在場") {
      text = text.replace(/對方|對手|自身|自己/g, "己方在場");
    } else if (selectedTarget === "場上全體") {
      text = text.replace(/對方|對手|自身|自己/g, "場上全體");
    }
    return text;
  }, [activeBlock, blockSlotValues, selectedTarget, blockLibrary]);

  const handleAddEntry = () => {
    if (!activeCode) return;
    const normalizedParams: Record<string, any> = {};
    Object.entries(paramValues).forEach(([k, v]) => {
      const m = k.match(/\{(\d+)\}/);
      normalizedParams[m ? m[1] : k] = String(v);
    });
    const entry: KitEntry = {
      codeId: activeCode.id,
      params: normalizedParams,
      node: selectedNode,
      source: source as "skill" | "soulmark" | "mechanic" | "item",
      order: kit.length + 1,
    };
    onChange([...kit, entry]);
    setActiveCodeId(null);
    setParamValues({});
  };

  const handleAddBlockEntry = () => {
    if (!activeBlock) return;
    const isChanged =
      previewBlockText !== activeBlock.skeleton ||
      activeBlock.atomic === false ||
      !CODEX[activeBlock.id];
    const entry: KitEntry = {
      codeId: isChanged ? "custom" : activeBlock.id,
      customText: previewBlockText,
      params: {},
      node: selectedNode,
      source: source as "skill" | "soulmark" | "mechanic" | "item",
      order: kit.length + 1,
    };
    onChange([...kit, entry]);
    setSelectedBlockId(null);
  };

  const handleRemoveEntry = (index: number) => {
    const next = kit.filter((_, i) => i !== index).map((item, idx) => ({ ...item, order: idx + 1 }));
    onChange(next);
  };

  return (
    <div id="kit-effect-builder" className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 text-slate-200">
      <DamageEffectComposer source={source as KitEntry['source']} onAdd={entry => onChange([...kit, { ...entry, order: kit.length }])} />
      <DamageModifierComposer source={source as KitEntry['source']} onAdd={entry => onChange([...kit, { ...entry, order: kit.length }])} />
      <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-slate-100 text-sm">AI 模組化積木效果庫 ({kit.length} 條)</h3>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setMode("blockly")}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
              mode === "blockly"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Puzzle className="w-3.5 h-3.5 text-cyan-400" />
            🧩 Blockly 可視化積木
          </button>
          <button
            type="button"
            onClick={() => setMode("block")}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
              mode === "block"
                ? "bg-amber-600 text-slate-950 shadow"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            積木換槽模式
          </button>
          <button
            type="button"
            onClick={() => setMode("id")}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
              mode === "id"
                ? "bg-amber-600 text-slate-950 shadow"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            編號模式
          </button>
        </div>
      </div>

      {/* Existing Kit Entries */}
      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
        {kit.length === 0 ? (
          <div className="text-xs text-slate-400 italic text-center py-4 border border-dashed border-slate-800 rounded-lg">
            尚未添加積木詞條。從下方效果庫挑選骨架或編號並加入。
          </div>
        ) : (
          kit.map((entry, idx) => {
            const code = CODEX[entry.codeId];
            return (
              <div key={idx} id={`kit-entry-${idx}`} className="flex items-center justify-between bg-slate-800/80 border border-slate-700 rounded px-3 py-2 text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-mono text-amber-400 font-bold px-1.5 py-0.5 bg-amber-950/80 border border-amber-700/50 rounded text-[11px]">
                    #{entry.codeId === "custom" ? "自訂" : entry.codeId}
                  </span>
                  <span className="text-slate-300 truncate font-medium">
                    {entry.customText || (code ? code.template : "自訂效果")}
                  </span>
                  <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 border border-cyan-800/40 rounded">
                    {entry.node}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEntry(idx)}
                  className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40 ml-2"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {mode === "blockly" ? (
        <BlocklyBuilder
          key={blocklyKey}
          initialKit={blocklyPart}
          onChange={(k) => { lastEmitted.current = JSON.stringify(k); onChange([...otherPart, ...k]); }}
          source={source}
          onInsertDescription={onInsertDescription}
        />
      ) : mode === "block" && blockLibrary === EMPTY_BLOCK_LIBRARY ? (
        <p role={libraryError ? "alert" : "status"} className="p-3 text-sm text-slate-400">
          {libraryError ? "積木資料載入失敗，請切換其他模式後重試。" : "載入積木換槽資料…"}
        </p>
      ) : mode === "block" ? (
        /* Block Mode (積木換槽模式) */
        <div className="border-t border-slate-800 pt-3">
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex-1 min-w-[160px]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={blockSearchKeyword}
                  onChange={e => setBlockSearchKeyword(e.target.value)}
                  placeholder="搜尋骨架描述或積木編號..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <select
              value={blockRoleFilter}
              onChange={e => setBlockRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1.5 text-slate-300"
            >
              <option value="all">全部分類 (■🎯◇)</option>
              <option value="innate">■ 固有 (Innate)</option>
              <option value="attached">🎯 附加 (Attached)</option>
              <option value="carried">◇ 攜帶 (Carried)</option>
            </select>
          </div>

          {/* Active Block Customization Panel */}
          {activeBlock && (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 mb-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>骨架 #{activeBlock.id}</span>
                  <span className="text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                    {activeBlock.role === "innate" ? "■ 固有" : activeBlock.role === "attached" ? "🎯 附加" : "◇ 攜帶"}
                  </span>
                  {activeBlock.atomic && (
                    <span className="bg-red-950/80 text-red-300 border border-red-800/40 px-1.5 py-0.5 rounded text-[10px]">
                      整條·不可換槽
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBlockId(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  取消
                </button>
              </div>

              {/* Skeleton Original */}
              <div className="text-slate-400 text-[11px] mb-2 font-mono bg-slate-950/60 p-2 rounded border border-slate-800">
                原始骨架: <span className="text-slate-200">{activeBlock.skeleton}</span>
              </div>

              {/* Slots customization controls */}
              {!activeBlock.atomic && (
                <div className="space-y-2 mb-3 bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <div className="text-[11px] font-bold text-amber-400 mb-1 flex items-center gap-1">
                    <Shuffle className="w-3.5 h-3.5" />
                    自訂插槽與目標對象：
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Independent Target Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-cyan-300 font-bold">目標對象:</span>
                      <select
                        value={selectedTarget}
                        onChange={e => setSelectedTarget(e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200"
                      >
                        {(blockLibrary.pools.目標 || ["自身", "對手", "雙方", "己方全體", "對方全體", "己方在場", "場上全體"]).map((t, idx) => (
                          <option key={idx} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Angle bracket slot editors */}
                    {extractSkeletonTokens(activeBlock.skeleton).map((tk, idx) => {
                      const currentVal = blockSlotValues[idx] || "";
                      const typeName = tk.typeText;
                      let selector = null;

                      if (typeName === "狀態") {
                        selector = (
                          <select
                            value={currentVal}
                            onChange={e => {
                              const next = [...blockSlotValues];
                              next[idx] = e.target.value;
                              setBlockSlotValues(next);
                            }}
                            className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 w-full"
                          >
                            {(blockLibrary.pools.狀態 || []).map((s, sIdx) => (
                              <option key={sIdx} value={s}>{s}</option>
                            ))}
                          </select>
                        );
                      } else if (typeName === "傷害類型") {
                        selector = (
                          <select
                            value={currentVal}
                            onChange={e => {
                              const next = [...blockSlotValues];
                              next[idx] = e.target.value;
                              setBlockSlotValues(next);
                            }}
                            className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 w-full"
                          >
                            {(blockLibrary.pools.傷害類型 || []).map((s, sIdx) => (
                              <option key={sIdx} value={s}>{s}</option>
                            ))}
                          </select>
                        );
                      } else if (typeName === "屬性項") {
                        selector = (
                          <select
                            value={currentVal}
                            onChange={e => {
                              const next = [...blockSlotValues];
                              next[idx] = e.target.value;
                              setBlockSlotValues(next);
                            }}
                            className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 w-full"
                          >
                            {(blockLibrary.pools.屬性項 || []).map((s, sIdx) => (
                              <option key={sIdx} value={s}>{s}</option>
                            ))}
                          </select>
                        );
                      } else if (typeName === "傷害運算" || typeName === "運算") {
                        selector = (
                          <select
                            value={currentVal}
                            onChange={e => {
                              const next = [...blockSlotValues];
                              next[idx] = e.target.value;
                              setBlockSlotValues(next);
                            }}
                            className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 w-full"
                          >
                            {(blockLibrary.pools.傷害運算 || []).map((s, sIdx) => (
                              <option key={sIdx} value={s}>{s}</option>
                            ))}
                          </select>
                        );
                      } else {
                        selector = (
                          <input
                            type="text"
                            value={currentVal}
                            onChange={e => {
                              const next = [...blockSlotValues];
                              next[idx] = e.target.value;
                              setBlockSlotValues(next);
                            }}
                            placeholder={`填入${typeName}`}
                            className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 w-full"
                          />
                        );
                      }

                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <span className="text-[10px] text-amber-300 font-bold">
                            ⟨{typeName}⟩:
                          </span>
                          {selector}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Instant Preview Box */}
              <div className="bg-slate-950 p-2.5 rounded border border-amber-500/40 mb-3">
                <span className="text-[10px] text-emerald-400 font-bold block mb-1">即時生成預覽 (對戰文字):</span>
                <p className="text-slate-100 font-mono text-xs font-semibold leading-relaxed">
                  {previewBlockText}
                </p>
              </div>

              {/* Trigger Node Select */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-slate-400">觸發節點:</span>
                <select
                  value={selectedNode}
                  onChange={e => setSelectedNode(e.target.value as Node)}
                  className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 flex-1"
                >
                  {NODES.map(n => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddBlockEntry}
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 font-bold text-slate-950 text-xs rounded-lg flex items-center justify-center gap-1 shadow cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> 加入為 kit 詞條
                </button>
                {onInsertDescription && (
                  <button
                    type="button"
                    onClick={() => {
                      onInsertDescription(previewBlockText);
                      setSelectedBlockId(null);
                    }}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-slate-950 text-xs rounded-lg flex items-center justify-center gap-1 shadow cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> 插入至描述框
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Skeletons List */}
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {displayedBlocks.map(block => (
              <div
                key={block.id}
                onClick={() => handleSelectBlock(block)}
                className={`p-2 rounded border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                  selectedBlockId === block.id
                    ? "bg-amber-950/60 border-amber-500 text-amber-200"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-mono text-amber-400 font-bold text-[11px] shrink-0">#{block.id}</span>
                  <span className="truncate">{block.skeleton}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {block.atomic && (
                    <span className="bg-red-950 text-red-300 border border-red-800 px-1 py-0.5 rounded text-[9px]">
                      整條
                    </span>
                  )}
                  <span
                    className="text-[11px] font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center justify-center cursor-help"
                    title={block.role === "innate" ? "固有 (innate)" : block.role === "attached" ? "附加 (attached)" : "攜帶 (carried)"}
                  >
                    {block.role === "innate" ? "■" : block.role === "attached" ? "🎯" : "◇"}
                  </span>
                </div>
              </div>
            ))}

            {remainingCount > 0 && (
              <div className="p-2 text-center text-[10px] text-amber-400/80 bg-amber-950/20 border border-dashed border-amber-900/40 rounded-lg font-mono">
                🔍 還有 {remainingCount} 筆相符積木，請輸入關鍵字縮小範圍
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ID Mode (現有編號模式) */
        <div className="border-t border-slate-800 pt-3">
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex-1 min-w-[140px]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  placeholder="搜尋效果編號或關鍵字..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1.5 text-slate-300"
            >
              <option value="all">全角色 (■🎯◇)</option>
              <option value="innate">■ 固有 (Innate)</option>
              <option value="attached">🎯 附加 (Attached)</option>
              <option value="carried">◇ 攜帶 (Carried)</option>
            </select>

            <select
              value={selectedEra}
              onChange={e => setSelectedEra(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1.5 text-slate-300"
            >
              <option value="all">全世代</option>
              <option value="modern">Modern (精確)</option>
              <option value="legacy">Legacy (老代碼)</option>
            </select>
          </div>

          {/* Selected Active Code Config Panel */}
          {activeCode && (
            <div id="active-code-panel" className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 mb-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>編號 #{activeCode.id}</span>
                  <span className="text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                    {activeCode.role === "innate" ? "■ 固有" : activeCode.role === "attached" ? "🎯 附加" : "◇ 攜帶"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCodeId(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  取消
                </button>
              </div>

              <p className="text-slate-200 mb-2 font-mono bg-slate-900/80 p-2 rounded border border-slate-800">
                {activeCode.template}
              </p>

              {/* Parameter Slot Inputs */}
              {activeCode.paramCount > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {Array.from({ length: activeCode.paramCount }).map((_, pIdx) => (
                    <div key={pIdx} className="flex items-center gap-1.5">
                      <span className="text-[11px] text-amber-400 font-mono">{`{${pIdx}}`}:</span>
                      <input
                        type="text"
                        placeholder={`參數 ${pIdx}`}
                        value={paramValues[`{${pIdx}}`] || ""}
                        onChange={e => setParamValues({ ...paramValues, [`{${pIdx}}`]: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-xs px-2 py-1 rounded text-slate-100"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Trigger Node Select */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-slate-400">觸發節點:</span>
                <select
                  value={selectedNode}
                  onChange={e => setSelectedNode(e.target.value as Node)}
                  className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 flex-1"
                >
                  {NODES.map(n => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddEntry}
                className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 font-bold text-slate-950 text-xs rounded-lg flex items-center justify-center gap-1 shadow"
              >
                <Plus className="w-3.5 h-3.5" /> 確認加入詞條
              </button>
            </div>
          )}

          {/* Search Results List */}
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {filteredCodes.slice(0, 30).map(code => (
              <div
                key={code.id}
                onClick={() => setActiveCodeId(code.id)}
                className={`p-2 rounded border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                  activeCodeId === code.id
                    ? "bg-amber-950/60 border-amber-500 text-amber-200"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-mono text-amber-400 font-bold text-[11px] shrink-0">#{code.id}</span>
                  <span className="truncate">{code.template}</span>
                </div>
                <span 
                  className="text-[11px] font-mono font-bold shrink-0 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center justify-center cursor-help"
                  title={code.role === "innate" ? "固有 (innate)" : code.role === "attached" ? "附加 (attached)" : "攜帶 (carried)"}
                >
                  {code.role === "innate" ? "■" : code.role === "attached" ? "🎯" : "◇"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

