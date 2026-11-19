# 模型決策與對戰計時器實裝

## 範圍及設定

- 控制中心 → 對戰：模型輔助預設關閉，等待時間 1–120 秒；本地推演原有 100–2000ms 保留。
- 原有本地 AI 先選候選，再由 Gemini Decision 1 的 v1beta Decisions REST 介面協助評選；0.6 信心以下、選 local、錯誤、逾時或取消時使用本地結果。該門檻是初始策略，尚未以勝率資料校準。
- 每局最多 200 次模型請求，後端單次並發、最短間隔 500ms；不自動重試，實際費用以供應商計費為準。
- AI 攻擊／干擾、控制／異常、直接／附加傷害藥劑三個允許開關預設全開。按效果交集檢查；特殊、解除與指定幻化豁免 AI 偏好，仍遵守正式庫存／禁用規則。人工合法操作不受影響。
- 計時器預設 off「關閉計時器」；可設定整數 5–60 秒，普通／巔峰／特殊模式使用的 BattleScreen 共用。
- ordered 模式：明確第五技 → 普通技能 1–4 → 空過，跳過不可選；第五技只認 metadata。死亡則隊伍順序第一個合法替補。
- auto 模式：逾時後持續託管。P1 使用原有託管，PVP P2 使用同一 AI 入口並提供關閉按鈕；死亡時同樣適用。PVE 原有敵方 AI 不計人工時限。
- 開場、演出、已選招等待 AI 時不扣秒；人工操作、回合／階段改變、卸載後舊計時器和結果失效。

## 分工

新增：

- `server/battleAI/{routes,secretStore,geminiDecision,keyFormat}.ts`：loopback／Host／同源／會話驗證、金鑰記憶體及 DPAPI、固定官方 HTTPS；接受含 `AQ…` authorization keys 的新版金鑰，不依舊式 `AIza…` 前綴限制設定。
- `src/battle/ai/{actionPolicy,decisionContext,providerApi,assistedClient}.ts`：AI 偏好、傳輸白名單、本機 API、模型協調及取消。
- `src/battle/turnTimer.ts`、`src/components/battle/useTurnTimer.ts`：計時設定、選擇規則及生命週期。
- `src/components/{BattleAIProviderPanel,BattleTimerSettingsPanel}.tsx`：設定介面。
- `tests/{decisionProvider.security.test.ts,decisionModelAndTimer.semantic.test.ts,turnTimer.ui.test.tsx}`。

既有入口修改：server 路由註冊、AI 設定／排序／備援政策、BattleScreen 注入及顯示、引擎共用 performAIAction 與最新政策重驗、控制中心設定入口。沒有新增精靈名稱特判或改動戰鬥數值公式。

## 金鑰及資料界線

預設只保留於後端記憶體；Windows 記住時使用 DPAPI CurrentUser，儲存在使用者 LocalAppData，以專案絕對路徑雜湊隔離。只經子程序 stdin 加密，不放命令列。GET 只回是否設定，從不回傳金鑰。錯誤只回固定代碼；無開發者金鑰回退，不自動掃讀桌面檔案。

網路摘要以欄位白名單建立，不傳整個 BattleState、選招、PRNG、登錄表、圖片、程式碼、磁碟路徑或存檔。隱匿／幻化先經現有公開資訊遮罩；供應商只可回候選 ID。模型開啟仍屬雲端處理，不是離線 AI。

## 驗證紀錄

已通過：

- `npm run test:decision-timer`：本機／同源／會話存取防護、供應商格式及錯誤遮蔽、金鑰保存／刪除；Windows 真正 DPAPI 加密與重新讀取；9 組模型、藥劑與計時器語義；React 計時器設定與生命週期。
- `tests/localBattleAI.semantic.test.ts`：19 項既有本地 AI 測試。
- `tests/localBattleAI.integration.test.ts`：4 組正式引擎整合，包括雙側設定、關閉託管作廢、技能註冊接入及全名單合法契約。
- `tests/localBattleAI.ui.test.ts`：原有 AI 設定、即時報告、重設與儲存。
- `npm run test:potion-backlash`：反噬、庫存／目錄、附加異常、恢復、反彈與 AI 評分。
- `npm run test:game-layout`：9 組既有對戰版面測試。
- 型別檢查、桌面正式建置及前後端 HTTP 身分驗證通過。

使用者補充桌面為 5 把 `AQ…` 新版金鑰後，修正先前只辨識 `AIza…` 的測試規則。官方金鑰文件亦說明新 authorization keys 自 2026-05-28 起為新建金鑰預設：[Google 金鑰文件](https://ai.google.dev/gemini-api/docs/api-key)。正式設定驗證只限制長度、可列印 ASCII 及禁止控制字元，不強制舊式前綴。

依使用者授權，在獨立程序記憶體中讀取指定檔案（支援 UTF-8／UTF-16LE），辨識 5 把金鑰。第一把已通過真正官方 Decisions 呼叫，回應正確候選 `a0`、信心約 0.864、輸入 200 tokens，包含加密保存約 684ms；第一把成功後即停止，沒有使用其餘四把。已以 DPAPI CurrentUser 保存至本機專案隔離的憑證位置，沒有將金鑰寫入專案或測試輸出，也沒有改動桌面原檔。模型開關仍維持預設關閉，使用者開啟後才會在正式對戰呼叫。

真正整合測試使用正式引擎生成測試局面，經本機 HTTP 會話防護、重新解密的已保存金鑰、白名單摘要、官方模型，再映射回合法行動：

- 一般出招：模型選中技能槽 1，約 3200ms（含首次金鑰解密／本機 HTTP）；信心約 63%，輸入 1075 tokens，採用建議，無錯誤回退。
- 死亡換人：約 370ms；信心約 57%，輸入 994 tokens，正確依 0.6 門檻沿用本地的替補索引 1。這是低信心保護正常生效，不是 API 失敗。

桌面啟用版本 `1794862088841`，buildId `c05fb197abd0332d771b97439a1663859bae9a076c90b91b2e2b4228351b7d0f`。本輪新增功能回歸通過後，使用 `desktop_update.mjs --quick` 完成型別、正式建置及 HTTP 身分驗證，未重跑該腳本內所有與本輪無關的動畫回歸組。`desktop_stale.mjs` 結束碼 0，確認桌面產物已跟上來源。

另啟動該版本的獨立正式後端，確認已能重新讀取加密保存的金鑰（configured=true、remembered=true），沒有回傳或輸出秘密。測試後關閉自建服務，不關閉使用者原有視窗。掃描目前來源與啟用產物共 1181 個文字檔，比對桌面 5 把完整金鑰，命中 0 筆；金鑰不在來源或產物中。

勝率收益未做 A/B 統計，不宣稱模型已提高勝率。重新開啟原桌面捷徑後，在控制中心 → 對戰開啟模型輔助即可使用；計時器也於同處設定，模型與計時器預設仍關閉。
