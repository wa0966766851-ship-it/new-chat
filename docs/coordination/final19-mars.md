# 最後19份：馬爾修斯／滄嵐／次元龍（工作中）

目前只允許在必要讀取端與測試通過後才移除包裝。

## 已建立的新檔

- `src/data/migratedFinalMarsLanDragonKits.ts`：核心重構、王·超限共頻逐句Kit；龍16條Kit。
- `src/data/finalMarsLanDragonTexts.json`：由目前舊包裝原文擷取魂印完整描述，沒有重寫原文。
- `src/blocks/ops/finalMarsLanDragon.ts`：通用充能、異常紀錄、任一結果、印記比例/先制、傷害等量盾罩、體力差值、資源快照與查詢規則。
- `src/effects/rules/snapshotResources.ts`：只依已安裝規則參數，所有存活個體回合開始增加獨立快照；死亡時轉給所有存活接收者，每份原快照消耗防重播。
- `tests/finalMarsLanDragon.semantic.test.ts`：P1/P2正式headless測試，等待主代理接線後執行。

## 主代理整合

1. runtime import/spread `finalMarsLanDragonOperations({liveElf,runStmts,dealDamage})`。
2. sequenceContract匯入並展開`FINAL_MARS_LAN_DRAGON_ACTION_FIELDS`；呼叫`finalMarsLanDragonActionIssue(op,p,nested,trig)`。
3. `nested`以同trig包成完整Clause再呼叫sequenceIssue；不能只放行欄位而省略遞迴檢查。
4. stage_view新增`self_down_ignore`及明確PP滿條件；傷害公式只視為0，不能消除原能力下降。
5. battleRules.index匯入snapshotResources，同時停用舊dimensional-dragon/battleRule詩章註冊，避免每回合加兩次。
6. 通用`resource_query_rule`於battle_start寫入持有者`elf.resourceQueryRules[]`。計算器依自身規則、`markAppliesToElf`、規則min查詢視圖。PP豁免同理讀ignorePpLimit，不免扣PP。
7. 舊calculator只按詩章便使所有非龍持有者獲得視圖，應一併改成規則驅動。
8. soul資料接`MIGRATED_FINAL_DRAGON_SOUL_KIT`；skill接`MIGRATED_FINAL_MARS_SKILL_KITS`；通過後才移除5021 soul映射與兩馬爾修斯技能handler及wrapped資料。

## 真實未完成

- 測試目前尚未執行，不能宣稱3份完成。
- 械與瀾兩魂印仍保留原包裝；還未開始遷移。需真實護盾變更事件、場下機甲與HP消耗攔截、解析異常的個體/隊伍保留範圍。
- 龍8篇的ignore attack invalidation舊battleRule不是原文（原文無視攻擊免疫、傷害限制）；新Kit不沿用額外攻擊無效豁免。
- 龍詩章每回合給所有存活精靈（含場下/額外），只有規則接收者自身獲得詩章階段能力。
