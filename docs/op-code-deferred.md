# 積木代號系統：刻意未改部分參考文檔

> 建立日期：2026-11-11
> 搭配文件：`docs/op-code-system.md`（P1–P4 已完成）、`docs/op-code-unindexed.md`（346 待補分析）
> 目的：把「這轮明明可以做但刻意沒做」的項目全部記下來，避免下一個 AI 或使用者誤以為是遺漏。

---

## 0. 一句話原則

> P1–P4 全部是**索引層 / 對照層 / 查詢 UI**，不改寫任何戰鬥邏輯、不改 `OPS` 派發、不改判定流程。
> 下面每一項「未改」都是刻意保留，不是忘了做。

---

## 1. 既有編號系統（保留，不重編）

| 系統 | 檔案 | 編號 | 數量 | 未改原因 |
| --- | --- | --- | --- | --- |
| L1 描述模板 | `src/data/codex.json` / `codex.packed.json` / `codexRegistry.ts` | `0001`–`2545` | 2278 | 歷史技能句子，717 條仍需人工審查；重編會讓稽核基準、存檔指紋全部失效 |
| L2 積木骨架 | `src/data/blockLibrary.json` / `blockLibrary.packed.json` | `O####` / `B####` | 2790 | 編輯器 UI 的 ⟨插槽⟩ 模板，與 L3 執行動作不是一對一 |
| atoms 對照 | codex 每筆的 `atoms[]` | 22 種 | — | 既有「描述→概念」對照，仍保留；L3 是另一層「執行動作」 |

**L1/L2 與 L3 的銜接方式**：在 codex entry 加一個 `opCodes: string[]` mapping 欄位（P4 未做，見 §3），
而不是重編 `0001` 或 `O0001`。

---

## 2. 執行期派發（完全未改）

| 檔案 | 狀態 | 說明 |
| --- | --- | --- |
| `src/blocks/runtime.ts` | 未改（其 M 狀態為先前既有工作） | `export const OPS: Record<string, OpFn>` 是唯一派發點，P1–P4 只讀它來建 catalog |
| `src/effects/sequenceContract.ts` | 未改 | `SEQUENCE_ACTION_FIELDS`（574）／`SEQUENCE_CONDITION_FIELDS`（101）是 catalog 的權威輸入來源之一 |
| `src/blocks/ops/*.ts` | 未改 | 50 個 `xxxOperations()` 展開模組，真正定義動作；未加任何代號欄位 |
| `src/battle/opDisplayNames.ts` | 未改 | 顯示名對照，未加代號 |
| `src/components/BattleScreen.tsx` / `src/engine/battleEngine.ts` | 未改 | 依 AGENTS.md，未在主控台加任何精靈專屬判斷 |

---

## 3. P4 刻意沒接的 UI

| 項目 | 未改原因 |
| --- | --- |
| `src/components/KitEffectBuilder.tsx` | 它用的是 L2 `blockLibrary` 的 `O####` 骨架（⟨數值⟩插槽），與 L3 執行動作**不是一對一**。硬塞 `S-016` 之類代號會讓使用者誤以為骨架＝動作。正確做法是先建立 L2↔L3 mapping 表，再考慮顯示 |
| `src/components/EffectLibraryModal.tsx` | 同上，現有效果庫以描述模板為主，未動 |
| codex 的 `opCodes` mapping 欄位 | 這會改到 2278 筆 codex 資料與 `codex.packed.json` 產生檔，屬資料遷移；P4 選擇只做「新分頁讀表」，不改既有結構 |
| `src/data/codexRegistry.ts` 動態登錄（譜尼等） | 未加代號，理由同上 |

---

## 4. P3 刻意沒做的「真重構」

P3 的 6 個 alias 家族**只是索引上的別名**，沒有收斂任何判定。以下項目全部保留原樣：

| 家族 | 現況（未收斂） | 若日後要做 |
| --- | --- | --- |
| `status-inflict-guard` (`S-016`) | 4 軌並行：`contextBuilders:620` 的 `blocksStatusInfliction`、`traitsEngine:255` 的 `p1/p2_preventStatusInflict`、`traitsEngine:180` 的 `fear_flower`、`contextBuilders:710` 的 `DarkScarTurns` | 統一成單一 `canInflictStatus(source, target, status, origin)`，並讓所有旁路都呼叫它（見 `docs/31隻總體檢.md:57` 的既有缺口） |
| `fatal-survival` (`G-019`) | 六刃 `freeze_at_zero` 與雷伊 `god_descent` 各自判定 | 保持分離（兩者語意不同，11/05 與 11/11 使用者裁定） |
| 其餘 4 家族 | 各 op 獨立讀取端 | 僅標註，未合併 |

**這些都算「重寫戰鬥邏輯」，應另開一案、先備份、逐隻驗收**，P1–P4 完全不包含。

---

## 5. 描述文字（未動）

- `elf_source_files/`、`elfSourceText.json`、`defaultElfSeedsSource.ts`、`migrated*Kits.ts` 的內嵌原文字串
  全部保留（除了前一輪雷伊神明文字同步，那是另案）。
- L3/L4 **完全不帶文字**：`opCatalog.ts` / `opAliases.ts` / `op-usage.json` 只有代號、op 名、族別、意圖說明，
  沒有任何技能描述句子。這是刻意設計，讓「改描述」不會影響編號。

---

## 6. 存檔／資料層（未動）

- `playerSaveBridge.ts` / `server/playerSaves.ts` 的存檔格式未因本系統改變
- `current.json` / `history/` 未動（前一輪空間修復是另案）
- `descriptions.compressed.json` 未重新打包（本系統沒改 `elfSourceText.json` 等來源）

---

## 7. 未來的合理下一步（僅建議，未執行）

1. **補齊 catalog**：把 298 個「真動作但漏編」納入 L3，並把 46 個「條件」從動作代號中移出、
   改給獨立的 `C` 條件編號或標記 `kind:'condition'`（詳見 `docs/op-code-unindexed.md`）。
2. **建立 L2↔L3 mapping**：讓 `KitEffectBuilder` 能安全顯示代號。
3. **codex 加 mapping 欄位**：讓舊 `0001` 能反查新代號（需重產 packed 檔）。
4. **真重構**：收斂 `S-016` 的 4 軌（高風險，另案）。

---

## 8. 一句話給下一個 AI

> 看到 `opCatalog.ts` 只有 246 個代號、或看到 `S-016` 家族成員仍然分散在 4 個檔案，
> **不要以為是 bug 或漏做**——P1–P4 的範圍就是「加代號 + 對照 + 查詢」，
> 收斂判定與補齊 298 個動作都寫在上面第 7 節，等使用者指示才動。
