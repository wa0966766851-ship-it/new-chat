# 合約、佔位與正式技能重播收尾（2026-10-19）

本檔取代子代理只以 mock 驗證九個未接線動作的初稿。未接線的 migrationClosure.ts 已撤回，沒有匯入執行器或放寬合約。

四份合約修正：5014 燦使用 before_skill/before_skill；5019 可攜符文規則與剝離依各槽正式資料執行（詳見同日奧丁報告）；arena_14 無極攻擊無視使用 on_skill_use/self_attack，正式測得早於攻擊免疫判定；arena_16 首四槽與第五技能喚醒使用 before_skill/before_skill，額外使用在 on_skill_use/self_skill 讀喚醒後狀態。

三份佔位替換：千秋虔以正式擊敗事件記錄下一隻對手臣服；無相諦以 modify_power 的 flat:50 逐層增加固定威力，select_elf/all:true 對包含本次擊敗者的全部陣亡隊員消逝；幽魔相嘯四類清除分別依成功分支觸發，heal_then 讀實際恢復回執，並以出手前 HP 快照判斷倍數。無效補償只在 actual invalid 取得，不在正常使用、Miss 或閃避取得。

赤龍抵擋與累計改由正式 damageBlocks 記錄完成增減傷及上限後的被抵擋量。stored_damage_release/stored_damage_convert_next 讀同一儲存鍵，真實或固定釋放後一次消耗；不再寫入沒有 Kit 讀取端的 redTrue。P1/P2 正式物攻抵擋、累計、釋放、轉換及一次消耗通過。

extra_use_times 不再排入沒有 run 的無效額外行動物件。一般與額外使用共用 executeSkillUse，完整重跑命中、技能效果、主傷害與結果結算，在死亡節點一之前完成，額外使用不扣 PP，executingSkillRepeat 阻止遞迴。正式測得攻擊/屬性技能各原一次加四次、僅一次 PP；四龍依序喚醒後首次第五技能當次即重播。PP 豁免寫為個體 ppLimitIgnoredUntilSwitch，由正式選招查詢讀取，下場解除。

測試：test:migration-closure（含 P1/P2 能力變化、攻擊免疫貫穿、實際無效補償、下一隻臣服、固定威力、全部消逝、回血轉傷及 Blockly 深比較）；test:stored-damage；test:skill-repeat。最終整合結果以接續紀錄為準。

逐龍數值追加修復：新增 resource_panel_scale/resource_damage_scale/resource_round_recovery。四龍按各自甦醒數立即累加基礎五維點數25%及基礎體力25%臨時上限，不重複疊能力等級；每龍攻擊增傷50%、非真實減傷15%、回合末恢復最大體力10%及隨機1點PP吸取後恢復自身未滿槽。下場撤回點數、臨時上限並清空赤龍儲存與下一次傷害分類。真龍屬性技能每次使用各龍150點直接傷害亦有正式讀取。test:resource-panel 與 test:skill-repeat 已以P1/P2實測數值，全部條款Blockly保存重載深比較通過。

限制：結構問題歸零不代表全文語意已驗收。仍須補龍魂印記層數乘龍數的傷害次數、真龍最高克制及各技能對追加效果條件的聯動；其餘精靈亦須逐句驗收。未開前台或人工實戰。
