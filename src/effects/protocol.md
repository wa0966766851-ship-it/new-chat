# 戰鬥系統標準化效果 JSON 協議 (Standardized Battle Effect JSON Protocol)

本協議定義了《賽爾號》戰鬥系統中所有效果（魂印、特性、技能附加效果、異常狀態）的統一結構，旨在將「風味敘事」與「邏輯執行」分離，並支持精確的觸發時點控製。

## 1. 核心分類 (Effect Categories)

根據討論，效果分為三大類：
- **INHERENT (固有類)**: 專屬特性、天生被動。不隨環境消失，優先級最高。
- **CARRIED (攜帶類)**: 魂印、寶石、刻印、套裝、道具。戰鬥開始時加載，響應特定時點。
- **ADDITIONAL (附加效果類)**: 技能後綴、異常狀態、回合增益/減益。通常有持續回合，響應附加效果失效邏輯。

## 2. 觸發時點 (Trigger Timings)

定義在 `EffectTiming` 中，涵蓋完整的戰鬥生命週期：
- `BATTLE_START`: 戰鬥開始時。
- `ROUND_START`: 每回合開始時。
- `BEFORE_ACTION`: 精靈行動開始前。
- `BEFORE_SKILL`: 使用技能時（計算傷害前）。
- `ON_SKILL_HIT`: 命中時（計算基礎傷害）。
- `BEFORE_DAMAGE`: 最終傷害結算前（減傷判定）。
- `ON_DAMAGE`: 造成傷害時（紅傷）。
- `AFTER_ACTION`: 行動結束後（追傷、吸血、狀態判定）。
- `ACTION_END`: 整個出手流程結束。
- `DEATH_NODE`: 死亡判定節點（1/2/3）。

## 3. JSON 協議結構

```json
{
  "id": "string",             // 唯一標識符
  "name": "string",           // 顯示名稱
  "category": "INHERENT" | "CARRIED" | "ADDITIONAL",
  "timing": "EffectTiming",   // 觸發時點
  "priority": number,         // 優先級，數值越大越先執行
  "condition": {              // 觸發條件 (選填)
    "type": "string",         // 如 "HP_BELOW_PERCENT", "HAS_STATUS", "SKILL_CATEGORY"
    "value": any,             // 條件閾值或值
    "target": "self" | "opponent" | "both"
  },
  "actions": [                // 執行的行動列表
    {
      "type": "ActionType",   // 如 "DAMAGE_TRUE", "STAT_CHANGE", "STATUS_ADD"
      "value": any,           // 行動參數
      "chance": number,       // 觸發機率 (0-100)
      "target": "self" | "opponent",
      "message": "string"     // 戰鬥日誌模板
    }
  ],
  "duration": number,         // 持續回合 (-1 為永久)
  "maxOccurrence": number,    // 觸發次數限制 (選填)
  "onExpire": "ExpirationResponse" // 失效響應邏輯
}
```

## 4. 行動類型 (Action Types)

- `DAMAGE_FIXED`: 固定傷害 (粉傷)。
- `DAMAGE_PERCENT`: 百分比傷害。
- `DAMAGE_TRUE`: 真實傷害 (白傷)。
- `STAT_CHANGE`: 能力等級變化 (-6 to +6)。
- `STATUS_ADD`: 添加異常狀態。
- `STATUS_REMOVE`: 淨化/消除狀態。
- `HEAL_PERCENT`: 百分比恢復體力。
- `EXECUTE`: 瞬殺/斬殺判定。

## 5. 擴展性

該協議支持後續通過 `StandardEffectProcessor` 進行自動化解析，減少 `BattleScreen.tsx` 中的硬編碼 `if-else` 邏輯，實現「數據驅動」的戰鬥系統。
