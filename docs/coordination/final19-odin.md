# 最後19份分工：迪露／奧丁／蓓（2026-10-18）

本分工5份：5009魂印獅，5019魂印ᛏ、烏鴉、諸神黃昏，5027魂印蓓。
尚在施工，不能依本檔存在或Kit陣列存在宣稱完成。所有統計、封裝、正式註冊及共用讀取端由主代理統一整合。

## 原始缺陷

- 迪露原文枷鎖每層200%，舊handler為10%；四類受傷回復大半未實作；固定體力鎖沒有共用讀取。
- 奧丁大多符文只附圖示；目前只`ppExemptions`有ᚱᚷ讀取。決鬥控制免疫硬綁名字、主動切換沒有決鬥讀取；`stripAllRunes`一次剝離雙方，不能在持有者下場時拿對方同時剝離。
- 蓓舊魂印只寫belienteStarBearer旗標，星執轉化／能量形態並未執行。

## 本分工檔案

- 新增 `src/blocks/ops/finalOdinDeluBeliente.ts`：通用可攜印記、體力鎖、雙防面板恢復／吸取、異常複製、體力旗標、受傷保底、真傷前致死窗口；隊伍抗性記錄、能量形態與轉化獎勵；常駐戰鬥印記與決鬥查詢。
- 新增 `src/data/migratedFinalOdinDeluBelienteKits.ts`：迪露、蓓、奧丁烏鴉的分詞Kit（正式整合前需測試）。
- 新增 `tests/finalDelu.semantic.test.ts`：正式headless、P1/P2、真實3000000點初始體力、面板固定受傷回復、枷鎖轉移、改參數測試。

## 主代理必要整合合約

1. `sequenceContract.ts`：匯入／展開FINAL_ODB_ACTION_FIELDS與CONDITION_FIELDS，呼叫finalOdbActionIssue與finalOdbConditionIssue；`portable_mark.rules`及`status_bound_round_end.body`遞迴驗證，mark內允許portable_mark_transfer；maximum_health_lock.value保留3000000原值，僅此欄位放寬通用1e6上限，由專門validator限1e9。
2. `runtime.ts`：`...finalOdbOperations(addBlockTimer,runStmts)`；`finalOdbEvalCond(ctx,c,st)`，DYNAMIC_CONDS補last_typed_damage_weak。
3. 最大體力及消逝共用寫入端：`enforceMaximumHealthLock(elf)`，保留上限但**不免疫消逝**。
4. `runBlockEvent`致死讀取：`resistFatalFromWindow(ctx)`。允許窗口內多次存活，不能套普通魂印fatal「每場僅一次」鎖。
5. 隊伍觀察事件：team_battle_start/team_entrance/team_after_action/team_round_end/team_before_status/team_status_received/team_defeated；`observer.includeDead:true`包含已消逝源持有者。self為源owner，event.data.eventSide/eventOwnerBattleId指真正事件對象。team_defeated只死亡節點1。
6. `team_status_replace`附加statusData.portableConversions，成功SELF_STATUS_APPLIED及team_status_received需沿用此metadata；失敗不可領energy_conversion_reward，普通直接附加星賜不可冒領。
7. 決鬥讀取共用函式 `hasPortableDuel(elf,opponent)`，需主動切換合法性及控制異常免疫接入；不能用名字奧丁當成永久控免。

## 使用者裁定

主代理轉述2026-10-18最新明確答覆：蓓「獲得150點能力」是獲得150點能量，並恢復150體力。已更正Kit文字與energy_conversion_reward；每次消耗pendingReward加150，下一次成功轉化才領。正式原始defaultElves描述需主代理同步「能力→能量」，不自動改其他文本。

## 驗證

第一輪Delu測試先在契約層被擋：通用數字上限1e6不能接受原文3000000；已通知主代理精確放行欄位。此時尚未取得完整P1/P2行為通過證據。
