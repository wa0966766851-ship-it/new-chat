# 積木代號系統（L3 / L4）說明

> 建立日期：2026-11-11
> 狀態：**P1 / P2 / P3 / P4 全部完成**。
> 本系統全程**不改寫任何戰鬥邏輯**，只為既有積木建立代號、別名與對照表（P3/P4 亦同）。

---

## 1. 為什麼要這套代號

專案原本已有三套彼此對不上的編號，但**真正會執行的積木沒有編號**：

| 層 | 既有系統 | 編號 | 數量 | 是什麼 |
| --- | --- | --- | --- | --- |
| L1 | `src/data/codex.json` | `0001`–`2545` | 2278 | 歷史技能**描述模板**（含 22 種 atoms） |
| L2 | `src/data/blockLibrary.json` | `O0001…` / `B…` | 2790 | 積木**骨架模板**（⟨插槽⟩） |
| L3 | **本系統新增** | `A-001`…`X-008` | 246 | **執行期積木動作**（runtime OPS / sequenceContract） |
| L4 | **本系統新增** | `elfId.技能.entry` | 2748 筆引用 | 哪個精靈／技能用了哪個 L3 動作 |

問題：百科查的是「描述句子的編號」，戰鬥跑的是「沒有編號的 op」，中間只靠 22 種 atoms 勉強對照。
結果就是同一句話（例如「無法附加雙方任一方異常狀態」）散成 4 套實作、7 個資料檔，改一個字要動 7 處。

L3/L4 補上缺的那一層後：

- 可以**反向查詢**：輸入 `S-016` 立刻列出所有使用它的精靈／技能
- 改判定只改一處，不會再出現「TraitsEngine 旁路沒擋」
- 稽核可自動檢查「每個 op 都有編號、每個編號都有讀取端、沒有孤兒 op」
- **編號不受描述改字影響**：改神明文字不用再動 7 個檔

舊的 codex `0001` 與 blockLibrary `O/B` **保留不重編**；L3 用 mapping 與之銜接即可。

---

## 2. 代號格式

```
FAMILY - ###        （族字母 + 三位序號，族內穩定）
```

- **族字母**：語意字首，見第 3 節
- **三位序號**：該族內按 op 名稱字母排序後依序給號，`001` 起
- **變體不進編號**：`scope` / `kind` / `turns` / `side` 本來就是參數，放呼叫點的 `p`，不放代號
  - 正確：`{ op: 'status_inflict_guard_turns', p: { side:'both', kind:'all', turns:3 } }` → 代號 `S-016`
  - 不建議：`S-016a` / `S-016b`（會組合爆炸）

呼叫點複合鍵（L4）用 `elfId.技能名.entryOrder`，例如 `5022.靜刃止水.e4`，不另造流水號。

---

## 3. 十個族（Family）

| 字母 | 名稱 | 涵蓋語意 | 數量 |
| --- | --- | --- | --- |
| `A` | 能力／面板 | 能力等級、六維、剋制、威力、先制 | 13 |
| `C` | 條件／查詢 | 條件判斷、狀態／事件查詢（不改變狀態） | 25 |
| `D` | 傷害 | 造成／附加／結算傷害、倍率、上限、反彈、轉化 | 68 |
| `G` | 防護／存活 | 護盾、護罩、抵擋、免疫傷害、免死、重生、消逝 | 22 |
| `H` | 體力 | 恢復、吸取、汲取、體力調整、上限變動 | 32 |
| `M` | 印記／標記 | 印記增減、層數、持有者、轉移 | 13 |
| `P` | 資源／PP | PP 增減、歸零、消耗倍率、技能槽 | 22 |
| `S` | 異常 | 附加／解除／轉換／免疫／反彈／**限制附加** | 22 |
| `T` | 回合／時點 | 持續回合、下回合、回合結束、計時器、條件閘 | 21 |
| `X` | 流程／特殊 | 選目標、額外行動、召喚、自訂、無效化、場景 | 8 |

合計 **246** 個已確認讀取端的 op。

### 族別判定規則

依 op 名稱前綴自動歸類，優先順序：`S → M → P → H → D → A → G → T → C → X`。
少數邊界以人工覆寫（例如 `recovery_*` 歸 H、`immune_status_*` 歸 S、`block_damage` 歸 G）。
完整對應表在 `src/data/opCatalog.ts`。

---

## 4. P1：`src/data/opCatalog.ts`

**純新增檔，不改任何現有檔案、不改 `OPS` 派發。**

匯出：

| 名稱 | 用途 |
| --- | --- |
| `OP_CATALOG` | `op 名稱 → { code, family, familyLabel, declaredIn }` |
| `OP_CODE_TO_NAME` | `code → op 名稱` |
| `OP_CODES` | 全部 246 個代號 |
| `OP_FAMILY_LABEL` | 族字母 → 中文名 |
| `opCode(op)` / `opByCode(code)` | 雙向查詢 |
| `opsByFamily(f)` | 取某一族全部成員 |

`declaredIn` 標記該 op 出現在 `runtime`（`src/blocks/runtime.ts` 的 `OPS` inline key）還是
`contract`（`src/effects/sequenceContract.ts` 的參數校驗表），或兩者皆有。

### 很重要的範圍限制

這 246 個是**已確認有派發／校驗入口**的 op。Kit 資料（`src/data/**/*Kit*.ts`）實際還引用了
更多 op（定義在 `src/blocks/ops/*.ts` 的 `xxxOperations()` 物件、條件 `evalCond`、或尚未接通的佔位）。
這些**沒有硬塞進編號**，而是由 P2 列為 `unindexed`，等確認讀取端後再補號。
這是刻意保持誠實：代號必須對應「真的會跑的東西」，不能為了好看而編。

---

## 5. P2：`scripts/gen_op_usage.ts` + `docs/audits/op-usage.json`

**純文字掃描，不 import、不執行任何 Kit 模組，因此不會干擾戰鬥或 Vite。**

```bash
node --import tsx scripts/gen_op_usage.ts          # 產出 docs/audits/op-usage.json
node --import tsx scripts/gen_op_usage.ts --check  # 驗證產出檔未過期（可接進 CI / npm test）
```

掃描 `src/data` 下 150 個 `*Kit*.ts`，抓 `a('op')` / `c('op')` / `op: 'op'` 三種引用，
並關聯到最近的 `elfIds` 與 `name`。

產出 `docs/audits/op-usage.json` 內容：

| 欄位 | 意義 |
| --- | --- |
| `byCode` | **反向索引**：`S-016 → { op, count, elves:[5022,5013] }` |
| `byOp` | 正向：`op → 代號、引用數、精靈、所屬定義` |
| `unindexed` | 資料層有引用、但 catalog 沒編號的 op（待補清單） |
| `unusedCodes` | catalog 有編號、但資料層沒引用的代號（可能是只由引擎內部呼叫） |
| `totals` | 統計數字 |

第一次執行的實際數字：

```
150 files / 2748 refs / 533 distinct ops
187 indexed / 346 unindexed / 59 unused codes
```

驗證範例：`S-016`（`status_inflict_guard_turns`）反查到 `5022 靜刃止水` 與 `5013 王·凜冬葬歌`，
比人工盤點更完整。

---

## 6. P3 / P4 已完成內容（**只加代號，不重寫**）

> **P3 / P4 本質上仍然只是「掛代號 + 建立對照」，不是重寫戰鬥邏輯。**

| 期 | 已做 | 會動執行碼嗎 |
| --- | --- | --- |
| P1 | 建 `opCatalog` 對照表（246 代號） | ❌ 完全不動 |
| P2 | 建 `op-usage` 反向索引與稽核（150 檔 / 2748 引用） | ❌ 完全不動 |
| P3 | 建立 6 個語意家族 alias 表；掃描器讀它並做 canonicalCode/member 稽核 | ❌ 只加別名／標註，不改函式本體 |
| P4 | 百科新增「積木代號」分頁（依代號查／依精靈反查／語意家族），側欄目錄同步可達 | ❌ 只讀表、只加 UI |

**唯一會碰到執行碼的**，是若日後真的決定「把 4 軌收斂成單一 `canInflictStatus()` 讀取端」——
那才算重構，應另開一案、先備份、逐隻驗收。P1–P4 都不包含它。

### P3 的 6 個語意家族

定義在 `src/data/opAliases.ts`，每個家族指向一個既有 canonical 代號：

| 家族 id | 代號 | 標籤 | 成員數 |
| --- | --- | --- | --- |
| `status-inflict-guard` | `S-016` | 限制附加異常狀態 | 8 |
| `fatal-survival` | `G-019` | 免死／強制存活 | 12 |
| `shield-barrier` | `G-017` | 護盾／護罩 | 17 |
| `recovery-modifier` | `H-030` | 恢復倍率／降療／禁療 | 8 |
| `damage-bound` | `D-015` | 傷害上限／保底 | 8 |
| `status-cure` | `S-004` | 解除／轉換異常狀態 | 12 |

`S-016` 家族收錄上一輪查到的 4 軌「無法附加異常」相關 op
（`status_inflict_guard_turns` / `status_guard` / `archived_status_guard` / `immune_status_*` 等），
並標註相關精靈 5001 / 5013 / 5019 / 5022 / 5023 / 5025 / 5039 / 5047。
**所有既有 op 名稱與函式本體原樣保留**，家族只是索引上的別名。

`op-usage.json` 升級為 `schemaVersion: 2`，新增 `aliasFamilies` / `aliasOfOp` / `aliasErrors`；
掃描器會檢查每個 canonicalCode 存在於 catalog、且對應 op 列為 member（實測 0 errors）。

### P4 的查詢入口

- `src/components/OpCodePanel.tsx`：獨立唯讀元件，三種模式（依代號查／依精靈反查／語意家族）
- `src/components/Encyclopedia.tsx`：新增 `opCodes` 分頁（僅 import、type union、tab 按鈕、渲染區塊四處）
- `src/shell/features.ts`：`EncyclopediaTab` 加 `opCodes`、側欄目錄加「積木代號」入口，確保新分頁真的能到達
- `KitEffectBuilder` **未改**：它用的是 L2 blockLibrary 的 `O####` 骨架，與 L3 動作不是一對一，硬塞代號會誤導；L2↔L3 mapping 留待後續再加。

### 驗證

`tests/opCodeSystem.semantic.test.ts`（P1–P4 資料層，7 項）與
`tests/opCodePanel.ui.test.tsx`（面板渲染 smoke）皆通過；
`npx tsc --noEmit`、`scripts/gen_op_usage.ts --check`、
`tests/shellDirectory.semantic.test.ts`、`tests/bossEncyclopedia.ui.test.tsx` 全過。

---

## 7. 與既有開發規範的關係

`AGENTS.md` 要求「註冊表模式、禁止硬編碼在主檔案、去特定名稱化、單步搬移與驗證」。
本系統是**對既有註冊表的索引層**，不是新的邏輯層：

- 不新增 state 鍵、不改 `BattleScreen.tsx` / `battleEngine.ts`
- 不改任何 `SurvivalRule` / `Trait` / `Status` 的判定
- 描述文字仍以 `elf_source_files/` 為單一來源，L3/L4 **完全不帶文字**

---

## 8. 檔案清單

| 檔案 | 期 | 類型 |
| --- | --- | --- |
| `src/data/opCatalog.ts` | P1 | 新增（純資料，246 代號） |
| `scripts/gen_op_usage.ts` | P2+P3 | 新增（掃描器，含 alias 稽核） |
| `docs/audits/op-usage.json` | P2+P3 | 產生檔（schemaVersion 2） |
| `src/data/opAliases.ts` | P3 | 新增（6 個語意家族） |
| `src/components/OpCodePanel.tsx` | P4 | 新增（唯讀查詢元件） |
| `src/components/Encyclopedia.tsx` | P4 | 最小修改（4 處） |
| `src/shell/features.ts` | P4 | 最小修改（2 處，目錄可達） |
| `tests/opCodeSystem.semantic.test.ts` | P4 | 新增（資料層回歸） |
| `tests/opCodePanel.ui.test.tsx` | P4 | 新增（UI smoke） |
| `docs/op-code-system.md` | 本檔 | 說明 |
| `src/blocks/runtime.ts`、`src/effects/sequenceContract.ts`、`src/battle/opDisplayNames.ts` | — | **未修改**（僅作為 catalog 輸入來源；其 M 狀態為先前既有工作） |
| `src/data/codex.json`、`src/data/blockLibrary.json` | — | **未修改**（L1/L2 舊編號保留） |
