# 專案開發規範：精靈實裝與重構指南

## 核心原則：避免檔案臃腫 (Anti-Bloat)
為了保持 `src/components/BattleScreen.tsx` 的可維護性，所有精靈的專屬邏輯（技能效果、魂印被動、特殊判定）**嚴格禁止**直接硬編碼在主檔案中。

## 語義分詞與實裝協定 (Semantic Tokenization Protocol)
為了確保「精靈描述」與「戰鬥邏輯」完美同步，所有新機制與精靈必須遵循以下實裝流程：
1. **文本拆解**：將自然語言描述拆解為「觸發 (Trigger)」、「條件 (Condition)」、「目標 (Target)」、「行為 (Action)」等結構化 Tokens。
2. **語義對齊**：由 AI 代理與使用者確認分詞結構，確保機制無歧義。
3. **註冊表生成**：基於分詞結果自動生成註冊表代碼，並掛鉤至 `BattleContext`。
4. **禁止直接修改主控台**：嚴禁繞過此步驟直接修改 `BattleScreen.tsx` 的邏輯。

## 實裝模式：註冊表模式 (Registry Pattern)

### 1. 專屬註冊表檔案
每個複雜精靈應在 `src/effects/` 目錄下擁有自己的註冊表檔案（例如 `deluRegistry.ts`）。
- **技能效果**：匯出 `Record<string, (ctx: BattleContext) => void>`。
- **魂印效果**：匯出專門的處理函數或生命週期掛鉤。

### 2. BattleContext 介面
所有外部化的邏輯必須透過 `BattleContext` 與主狀態互動。該介面定義在 `src/effects/battleEventRegistry.ts` 中，包含：
- `getPlayerState / setPlayerState`: 訪問動態回合狀態（如 `p1DeluFatalResistTurns`）。
- `addLog`: 輸出戰鬥日誌。
- `applyPinkDamage / applyTrueDamage`: 處理各類傷害。
- `applyStatusWithImmunityCheck`: 處理異常狀態。

### 3. 註冊流程
1. 在 `src/effects/` 建立精靈註冊表。
2. 在 `src/effects/battleEventRegistry.ts` 中匯入並使用展開運算子 `...` 加入 `BattleSkillRegistry`。
3. 在 `BattleScreen.tsx` 中，透過 `BattleSkillRegistry[skill.name]?.(context)` 來觸發邏輯。

### 4. 複雜精靈實裝指南 (範例：蟲后·奧佩婭)
對於機制極其複雜的精靈，應遵循以下邏輯拆解：

- **多時點監控**：奧佩婭的魂印涉及「登場時」、「對手使用技能時」、「自身使用技能時」。
- **代碼組織**：
  ```typescript
  // src/effects/opeiaRegistry.ts
  export const handleOpeiaSoulMark = (ctx: BattleContext, event: EffectTiming, extraData?: any) => {
    switch(event) {
      case EffectTiming.ON_ENTRANCE:
        // 處理屬性加成與連擊次數
        break;
      case EffectTiming.BEFORE_ACTION:
        // 判定對手技能類型 (攻擊/屬性) 並觸發封印邏輯
        break;
      case EffectTiming.BEFORE_SKILL:
        // 處理自身技能不消耗 PP 與強制異常
        break;
    }
  };
  ```
- **動態狀態管理**：使用 `setPlayerState("opeiaComboBonus", n)` 來管理跨回合的計數器，避免在 `BattleScreen.tsx` 中定義過多單一用途的 `useState`。

## 注意事項
- **機制優先**：實裝邏輯必須嚴格對齊精靈技能/魂印的文本描述。
- **命名規範**：註冊表鍵值必須與 `Elf.name` 或 `Skill.name` 完全一致。
- **類型安全**：優先使用 `src/effects/types.ts` 中定義的類型。

## 永久性防範與開發自我檢查規則 (Permanent Anti-Hardcoding Rule)
以後在實裝或重構任何新增機制、魂印、技能或異常時，**必須進行自我檢查**：
1. **去特定名稱化**：所使用的 State 鍵名（如 `puniXuWuActiveTurns` 應設計為 `globalSkillInvalidTurns`）、Log 提示文字等，是否僅有某一隻特定精靈才會用到？
2. **優先進行抽象與通用化**：如果該屬性、狀態或行為只針對某一隻精靈，則**嚴格禁止**寫在 `BattleScreen.tsx` 的核心流程中：
   - 必須搬遷至該精靈的專屬 effects 註冊表（Registry）中。
   - 或將該屬性設計為通用的參數化配置/狀態（例如藉由 `RegistryState` 的通用鍵與通用 Reason 屬性傳遞），由 `BattleScreen.tsx` 進行統一、數據驅動的核心行為判定與處理。
3. **單步搬移與驗證**：每次只重構或新增一個機制，並在修改後立即進行 `compile_applet` 和 `lint_applet` 驗證，確保機制 100% 正常運作、無代碼膨脹且完全向後相容。
