# 2026-11-18 六界復活、命運 C 級顯示與禁選原位

## 修正

- 六界神王的 `entry_state_restore` 原先在陣亡強制換人時仍將體力設回登場快照（最低 1），因此可能呈現復活。共用操作現在先依 `checkElfDead` 與消失旗標判斷，不讓陣亡／消失精靈藉快照復活；存活時的體力與 PP 還原保留，負體力存活仍遵循原本存活規則。
- 斯嘉麗的重生仍由持有者個體鍵與本人死亡事件控制。測試先讓斯嘉麗陣亡，再讓六界陣亡，保留珀妮並等待倒數，驗證只有斯嘉麗在場下復活。
- 五種 C 級命運攔截以唯讀定義加入共用效果來源，精靈效果介紹、狀態檢視與原廠風常駐列可顯示名稱與完整描述；實用風另接入模式效果列。這些顯示定義不作為魂印／積木執行，不由幻化來源借用。隱匿替身清除攔截資料。六界仍以【界】取代 C 級攔截，顯示與執行共用輕量規則，避免共用效果層載入抽卡／AI 資料。
- 命運之輪 A／B 版選角顯示原卡池全部 12 位，保留已禁用與未選用卡。位置以原池索引 1–12 呈現，不按剩餘卡重新編號；編號置於禁用遮罩上方。已禁用卡不能入隊或設首發，選隊共用狀態處理也會攔截已禁用／不存在的個體。
- 巔峰禁選原本已有原位編號，但 PVE 對手在 Pick 階段另有只顯示已出戰者的過濾；移除該分支，雙方均保留原卡池與禁用標示。

## 已通過驗證

- `tests/destinyDisplayAndRevival.semantic.test.ts`：正式引擎 P1／P2 六界死亡換人、存活還原體力與 PP、與斯嘉麗同隊死亡後重生個體隔離；消失／負體力規則；五種 C 級介紹正文、非 C／六界排除、幻化與隱匿隔離。
- `tests/destinyWheelB.ui.test.tsx`：PVE／PVP 選角雙方 12 位、原編號、各 3 張禁用卡、禁止加入戰隊、首發與實際開戰；原有切版／隱匿流程。
- `tests/destinyLegacyFixes.ui.test.tsx`：A 版完整原位卡池、禁用標示與禁止選用，既有詳情／切版回歸。
- `tests/peakBanSlots.ui.test.tsx`：使用正式 StartScreen，僅替換資料庫邊界；PVE／PVP 巔峰禁選到 Pick 後雙方個體順序、1–12 編號與禁用卡均保留，不能選用禁用卡。
- `tests/battleGameLayout.ui.test.tsx`：原廠風／實用風的 C 級名稱與完整描述，以及既有戰鬥版面回歸。
- `tests/destinyInterceptor.semantic.test.ts`、`tests/destinyInterceptor.scopes.test.ts`：五攔截數值、期限、雙方、死亡去重及模式隔離。
- `tests/destinyFlow.semantic.test.ts`：抽卡、禁選、選隊與首發個體。

## 最後交付檢查

`tests/destinyIllusionLaunch.integration.test.tsx` 與 `tests/hiddenElfVisibility.ui.test.tsx` 通過。`desktop_update.mjs --quick` 完成型別檢查、正式前後端建置、產物前後端啟動驗證與啟用，桌面版本 `1794940973664`；`desktop_stale.mjs` 確認沒有待打包變更。未使用 `compile_applet`／`lint_applet`：此環境無這兩項工具，採專案實際的 TypeScript／Vite／桌面更新流程。
