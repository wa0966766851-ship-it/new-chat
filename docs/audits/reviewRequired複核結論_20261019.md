# reviewRequired 讀取端複核結論（DSH 2026-10-19 16:30）

## 複核結果

17 個 flags 逐鍵驗證（寫入端 → 引擎讀取端）：

### ✅ 有讀取端（9/14 鍵，7 項精靈條目）
| 鍵 | 讀取端 |
|---|---|
| attackPpMultiplierTurns / Value | battleEngine.ts:119/2689、battleRule.ts:37 |
| attackMissTurns | genericSkillText.ts:778 |
| wangshiHealFactor | registry.ts:145 |
| priorityBoostTurns / Value | battleEngine.ts:119/2312、runtime.ts:1165、battleHelpers.ts:645 等 7 處 |
| nextElfAstralPriority | registry.ts:217、newElfLifecycle.ts:53 |
| minimumTypeMultiplierThisAction | battleEngine.ts:2488、damageCalculator.ts:163 |
| priorityPenaltyTurns | battleEngine.ts:2318、moiraiRegistry.ts:19、wujiRegistry.ts:214 |

### ✅ Kit 內部自洽（通用條件消費）
| 鍵 | 說明 |
|---|---|
| tfHitOver300 | pending_counter 寫 → player_state 條件讀 → turn_key_set 重置，全在 migratedArena13SoulKit |

### ❌ 證實缺口（4 鍵）——只寫不讀，無行為測試覆蓋
| 鍵 | 精靈 | 影響 |
|---|---|---|
| yutianPowerBoost | 5035 御天龍神·哈莫「龍神·御天陣」 | 「威力提升150%，後出手翻倍」條款已解析但運行時無效 |
| fenghaoBloodRainArmed | arena_13 龍錄天鋒「鋒毫浸血雨」 | 「下1回合攻擊命中消耗體力½造成等量百分比傷害」未結算 |
| fenghaoPressureTurns | 同上 | 「2回合內每回合使用技能時對手攻特速−1」的期數無讀取端 |
| fenghaoPressureFallback | 同上 | 「未觸發則下2回合攻擊技能無效」後備分支未接 |

**處置**：以上 4 鍵列為下一批的明確工作項（補引擎讀取端＋雙側行為測試）。
本輪不謊報關閉；readiness JSON 的 flags 保持原樣供追溯。

## 後續關閉（Codex 2026-10-19）

上述四鍵已移除，改用正式共用積木與讀取端；原複核結論保留為歷史。御天陣使用威力查詢，100基礎威力分別以250／400進入正式傷害公式；鋒毫下回合命中消耗當前體力一半並結算等量百分比傷害，壓制監控2回合使用技能，失敗或未能使用於回合末建立下2回合攻擊失效。未擊敗、下降失敗、技能無效各走獨立條件入口。

`tests/readerGapClosure.semantic.test.ts`：P1/P2、保存重載、實際血量、未命中到期、成功不誤封、失敗與未能使用分支通過。重新產生readiness，397路由／0包裝／0未接通／0合約問題，剩餘13個reader-review標記仍不是錯誤份數或完整正確率；semanticAccuracy維持null。
