# 未接入 73 項計畫（unconnected-73-plan）

來源：docs/audits/block-migration.json（43 位精靈、397 筆定義、已接 324、未接 73）。完整逐筆資料見同目錄 unconnected-73-plan.json。

## 分類結果

| 類別 | 筆數 | 說明 |
|---|---|---|
| (a) 只缺解析／參數 | 2 | 不需新通用機制，補解析或欄位即可（#41 星祈·繞指星瀾、#49 淨世洗禮頌）。需實作者再確認 |
| (b) 需新增通用 op | 24 | 新增通用 op／條件／事件後可由 Kit 表達 |
| (c) 需先拆專屬狀態機 | 47 | 符文、詩章、龍鱗、四龍、機甲、無為之境、額外精靈等；過渡期以 legacy_handler 包裝 |

注意：(a)(b)(c) 是依原文與未解析原因所做的人工判斷，不是跑過實作的結果；實作者開工前應再核對該筆的 unresolved 清單。

## 三組分工（組間新 op 不重疊）

### A 組：7 筆定義

- 精靈：5009 誑獅魔軀.魔獅迪露、5013 柯爾霍德、5016 變革·馬爾修斯、5023 無序·蝕言
- 定義 #：6, 7, 12, 16, 17, 18, 34
- 專屬新 op：`pp_zero_random`、`pp_to_charge`、`pp_cost_multiplier`、`ignore_priority`、`atk_sum_power`、`pp_cap_floor`、`cond:pp_full_count / cond:pp_not_full_count`

### B 組：10 筆定義

- 精靈：5025 恐懼的化身·咤克斯、5027 蓓麗安特、5029 異境神霆·雷伊、5030 聖靈邁爾斯、5031 六界神王
- 定義 #：36, 40, 41, 42, 44, 46, 47, 48, 49, 50
- 專屬新 op：`stat_view_swap`、`cond:stat_level_equal_count`、`immune_next_n`、`convert_damage_to_heal_next`、`status_transfer_all`、`on_next_switch_in`、`scale_by_hp_lost_pct`、`repeat_by_hp_decile`、`reflect_true_damage`、`standing_query_hook`、`priority_if_hp_below`

### C 組：9 筆定義

- 精靈：5007 混濁海妖.布林克克、5010 星光·魯斯王、5018 蟲后·奧佩婭、5022 無序.六刃、5023 無序·蝕言、5026 無序.墜星
- 定義 #：3, 4, 9, 20, 21, 28, 30, 32, 37
- 專屬新 op：`extra_random_target`、`roster_query`、`drain_repeat_independent`、`convert_foe_type_before_exec`、`cond:level_eq`、`force_crit`、`appearance_counter`、`bench_heal_flat`

每個新機制只列在一組，別組若需要請等該組完成後引用，避免兩組同時改 sequenceContract／runtime 同一 op。三組各自新增的 Kit 檔案不同（見下方「怎麼加」），只有 sequenceContract.ts、runtime.ts、migratedSequenceSkillKits.ts 聚合檔會有併改，請各組在檔案內以註解區塊分段，合併時以段落為單位。

## 新機制介面草案

### A 組

| 名稱 | 類型 | 參數 | 使用的定義 # | 備註 |
|---|---|---|---|---|
| `pp_zero_random` | action | `{side:"self|foe", count:number, only_nonzero:boolean, store_total_as?:string}` | 6, 16, 18 | 隨機挑 N 個 PP≠0 的技能歸 0，可把降低總和存成變數供 pp_to_charge 使用 |
| `pp_to_charge` | action | `{amount_from:string, target:"self_not_full"|"self_all"}` | 16, 18 | 把變數量轉為自身技能充能；充能儲存先掛在 mark_program 的 counter 上，不新增專屬欄位 |
| `pp_cost_multiplier` | action(timed) | `{side, scope:"attack|status|all", mult:number, turns:number}` | 17 | 計時效果；runtime 在扣 PP 的單一入口讀取 |
| `ignore_priority` | action(timed) | `{side, sign:"positive|negative", scope:"attack|status|all", turns?:number}` | 7, 12 | 補「指定無視尚無正式讀取端」：先制計算入口加讀取端 |
| `atk_sum_power` | damage-modifier | `{stats:["atk","spatk"], power_pct:number}` | 7 | 雙攻視為二者之和，威力加成其總和百分比 |
| `pp_cap_floor` | action | `{scope:"foe_bench", set_cap_to:"current_pp", min:number}` | 12 | 對手場下所有精靈 PP 上限降到目前 PP，最低 1 |
| `cond:pp_full_count / cond:pp_not_full_count` | condition/value | `{side:"self|foe|both"}` | 34, 12 | 回傳 PP 滿／未滿的技能數，可用於 repeat 與倍率 |

### B 組

| 名稱 | 類型 | 參數 | 使用的定義 # | 備註 |
|---|---|---|---|---|
| `stat_view_swap` | damage-calc modifier | `{from:"self_debuff|foe_buff", as:"buff|debuff", mult?:number}` | 36, 44 | 傷害計算時「視為同級」；改寫能力等級讀取層，不改實際狀態 |
| `cond:stat_level_equal_count` | value | `{pair:"self_vs_foe"}` | 36 | 雙方能力等級相同／不同的項數 |
| `immune_next_n` | action(counter) | `{side, kind:"status|stat_down|attack|skill_damage", n:number, on_success?:Stmt[]}` | 40, 48 | 次數型免疫，成功時可掛後續動作（現有只有回合型免疫） |
| `convert_damage_to_heal_next` | action(counter) | `{n:number, ratio:number}` | 40 | 下 N 次受到的攻擊傷害轉體力 |
| `status_transfer_all` | action | `{from:"foe", to:"self", as?:"highest_mark"}` | 42 | 把對手所有異常轉成自身指定異常（星執最高項） |
| `on_next_switch_in` | trigger | `{side, once:true}` | 40, 42, 41 | 下一隻登場時的一次性掛鉤（含「下隻首次技能附加效果失效」） |
| `scale_by_hp_lost_pct` | value | `{per_pct:number, target:"stat|damage_out", cap?:number}` | 46 | 體力每降低 1% 的線性加成，戰鬥階段結束清除 |
| `repeat_by_hp_decile` | repeat | `{basis:"self_max|foe_max|self_lost", per:0.1}` | 48, 49 | 每 10% 額外執行 N 次（天佑、八荒、翻倍） |
| `reflect_true_damage` | action | `{ratio:number, source:"damage_taken"}` | 50 | 受到攻擊傷害 100% 以真實傷害反饋 |
| `standing_query_hook` | trigger | `{kind:"priority|stat_view"}` | 44, 47 | 「常駐動作需查詢入口」：以查詢端取代每次傷害重播 |
| `priority_if_hp_below` | condition-priority | `{hp_abs?:number, hp_pct?:number, force_first:true}` | 47 | 體力低於 N 必定先手 |

### C 組

| 名稱 | 類型 | 參數 | 使用的定義 # | 備註 |
|---|---|---|---|---|
| `extra_random_target` | damage-modifier | `{pool:"foe_bench|foe_extra", count:1}` | 28, 32, 37 | 亂舞：造成技能傷害時額外隨機選一個場下／額外精靈作為目標；三項通用特性共用同一定義 |
| `roster_query` | value | `{side:"self|foe", filter:"alive|dead|has_type:<系>", scope:"bench"}` | 20 | 背包內符合條件的精靈數（蟲系／混沌系／陣亡） |
| `drain_repeat_independent` | repeat | `{amount:number, times:Value, fallback:"drain_hp"|"none"}` | 4, 30 | N 次各自獨立吸取，吸取後體力未減少則該次改為汲取；回傳每次結果供 on_each 使用 |
| `convert_foe_type_before_exec` | action(pre-exec) | `{to:string, else?:Stmt[]}` | 20 | 執行前先轉化對手屬性，否則改令下次技能無效 |
| `cond:level_eq` | condition | `{side, value:number}` | 9 | 精靈等級判定（等級 100 才有的強化） |
| `force_crit` | action(timed) | `{scope:"self_attack"}` | 9 | 必定致命一擊 |
| `appearance_counter` | value | `{side, scope:"battle", reset_on?:"no_kill"}` | 21 | 本場戰鬥登場次數（已存在於 battle record，只缺值暴露與重置動作） |
| `bench_heal_flat` | action | `{side, amount:number, when?:Cond}` | 20 | 恢復己方不在場精靈固定體力 |

## 逐筆清單

| # | 精靈 | 類型 | 名稱 | 類別 | 組 | 目前執行路徑 | 擋住原因 / 新機制 |
|---|---|---|---|---|---|---|---|
| 1 | 5002 帝皇之盾 | 專屬特性／魂印 | 盾 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 2 | 5007 混濁海妖.布林克克 | 專屬特性／魂印 | 濁 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 額外精靈／召喚物（克塔亞特、珀妮、賽博怨靈）：需要「額外精靈加入某方」的通用模型與戰場名冊 |
| 3 | 5007 混濁海妖.布林克克 | 技能 | 不淨者之約 | b | C | registry handler src/effects/abilityRegistry.ts:245, src/effects/elves/brinkk/registry.ts:543 | 解析/參數 |
| 4 | 5007 混濁海妖.布林克克 | 技能 | 深潛者盛宴 | b | C | registry handler src/effects/abilityRegistry.ts:270, src/effects/elves/brinkk/registry.ts:38 | drain_repeat_independent |
| 5 | 5009 誑獅魔軀.魔獅迪露 | 專屬特性／魂印 | 獅 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 6 | 5009 誑獅魔軀.魔獅迪露 | 技能 | 劫盡歸塵 | b | A | registry handler src/effects/elves/delu/registry.ts:297 | pp_zero_random |
| 7 | 5009 誑獅魔軀.魔獅迪露 | 技能 | 辟冥·鎮獄斷 | b | A | registry handler src/effects/elves/delu/registry.ts:333 | ignore_priority；atk_sum_power |
| 8 | 5000 聖靈譜尼 | 專屬特性／魂印 | 神 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 9 | 5010 星光·魯斯王 | 專屬特性／魂印 | 海 | b | C | 通用路徑(專屬程式（積木僅供語意對照）) | cond:level_eq；force_crit |
| 10 | 5012 冰魄·柯爾德 | 專屬特性／魂印 | 冰 | c | - | registry handler src/utils/statCalculator.ts:59, src/utils/statCalculator.ts:60, src/utils/statCalculator.ts:62, src/utils/statCalculator.ts:63, src/utils/statCalculator.ts:65, src/utils/statCalculator.ts:67 | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 11 | 5013 柯爾霍德 | 專屬特性／魂印 | 凕 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 12 | 5013 柯爾霍德 | 技能 | 王·夜予寒吟 | b | A | 通用路徑(積木＋未解析文字 fallback（未保證完整）) | ignore_priority；pp_cap_floor；cond:pp_full_count / cond:pp_not_full_count |
| 13 | 5014 聖光斯嘉麗 | 專屬特性／魂印 | 燦 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 額外精靈／召喚物（克塔亞特、珀妮、賽博怨靈）：需要「額外精靈加入某方」的通用模型與戰場名冊 |
| 14 | 5015 混沌·布萊克 | 專屬特性／魂印 | 夜 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 15 | 5016 變革·馬爾修斯 | 專屬特性／魂印 | 械 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 三機甲組合與充能值取代 PP 的整套資源系統 |
| 16 | 5016 變革·馬爾修斯 | 技能 | 核心重構 | b | A | registry handler src/effects/elves/mars/registry.ts:297 | pp_zero_random；pp_to_charge |
| 17 | 5016 變革·馬爾修斯 | 技能 | 王·肅正協議 | b | A | registry handler src/effects/elves/mars/registry.ts:315 | pp_cost_multiplier |
| 18 | 5016 變革·馬爾修斯 | 技能 | 王·超限共頻 | b | A | registry handler src/effects/elves/mars/registry.ts:340 | pp_zero_random；pp_to_charge |
| 19 | 5018 蟲后·奧佩婭 | 專屬特性／魂印 | 后 | c | - | registry handler src/effects/opeiaTimedEffects.ts:17 | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 20 | 5018 蟲后·奧佩婭 | 技能 | 蟲后之冠 | b | C | registry handler src/effects/opeiaTimedEffects.ts:17, src/effects/elves/opeia/registry.ts:170 | roster_query；convert_foe_type_before_exec；bench_heal_flat |
| 21 | 5018 蟲后·奧佩婭 | 技能 | 王·鏽腑喰心 | b | C | registry handler src/effects/opeiaTimedEffects.ts:17, src/effects/elves/opeia/registry.ts:173 | appearance_counter |
| 22 | 5019 眾神之父·奧丁 | 專屬特性／魂印 | ᛏ | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 符文（ᛏ 等）系統：符文附加到精靈與技能位、剝離、激活狀態、傳承給下一隻 |
| 23 | 5019 眾神之父·奧丁 | 技能 | ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ | c | - | registry handler src/effects/elves/odin/registry.ts:447 | 符文（ᛏ 等）系統：符文附加到精靈與技能位、剝離、激活狀態、傳承給下一隻 |
| 24 | 5019 眾神之父·奧丁 | 技能 | ᚱᚨᚷᚾᚨᚱᛟᚲ | c | - | registry handler src/effects/elves/odin/registry.ts:507 | 符文（ᛏ 等）系統：符文附加到精靈與技能位、剝離、激活狀態、傳承給下一隻 |
| 25 | 5021 治癒.龍魂再臨 次元龍 | 專屬特性／魂印 | 龍 | c | - | registry handler src/effects/elves/hamo/registry.ts:185, src/utils/statCalculator.ts:65, src/utils/statCalculator.ts:67, src/utils/statCalculator.ts:71, src/utils/statCalculator.ts:71, src/utils/statCalculator.ts:72 | 詩章計數系統（背包內累計並分級給效果）；技能 26 依賴此狀態 |
| 26 | 5021 治癒.龍魂再臨 次元龍 | 技能 | 遺典.妄世律裁 | c | - | registry handler src/effects/elves/dimensional-dragon/registry.ts:371 | 詩章計數系統（背包內累計並分級給效果）；技能 26 依賴此狀態 |
| 27 | 5022 無序.六刃 | 專屬特性／魂印 | 專屬特性 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 28 | 5022 無序.六刃 | 通用特性 | 亂舞 | b | C | 通用路徑(特質引擎／專屬程式：須逐條核對，未以解析率證明實裝) | extra_random_target |
| 29 | 5022 無序.六刃 | 二代異能特質 | 無我 / 戰士 | c | - | 通用路徑(特質引擎／專屬程式：須逐條核對，未以解析率證明實裝) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 30 | 5022 無序.六刃 | 技能 | 終焉·六花斬 | b | C | registry handler src/effects/elves/wuxu/registry.ts:224 | drain_repeat_independent |
| 31 | 5023 無序·蝕言 | 專屬特性／魂印 | 蝕言 | c | - | registry handler src/effects/abilityRegistry.ts:648 | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 32 | 5023 無序·蝕言 | 通用特性 | 亂舞 | b | C | 通用路徑(特質引擎／專屬程式：須逐條核對，未以解析率證明實裝) | extra_random_target |
| 33 | 5023 無序·蝕言 | 二代異能特質 | 修復 / 咒術師 | c | - | 通用路徑(特質引擎／專屬程式：須逐條核對，未以解析率證明實裝) | 額外精靈／召喚物（克塔亞特、珀妮、賽博怨靈）：需要「額外精靈加入某方」的通用模型與戰場名冊 |
| 34 | 5023 無序·蝕言 | 技能 | 械律·置換 | b | A | registry handler src/effects/elves/wuxu-shiyan/registry.ts:23, src/effects/elves/wuxu-shiyan/registry.ts:57 | cond:pp_full_count / cond:pp_not_full_count |
| 35 | 5025 恐懼的化身·咤克斯 | 專屬特性／魂印 | 懼 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 36 | 5025 恐懼的化身·咤克斯 | 技能 | 懼噬.虛實逆寫 | b | B | registry handler src/effects/elves/zhakesi-fear/registry.ts:319 | stat_view_swap；cond:stat_level_equal_count |
| 37 | 5026 無序.墜星 | 通用特性 | 亂舞 | b | C | 通用路徑(特質引擎／專屬程式：須逐條核對，未以解析率證明實裝) | extra_random_target |
| 38 | 5026 無序.墜星 | 二代異能特質 | 豪邁 / 投石者 | c | - | 通用路徑(特質引擎／專屬程式：須逐條核對，未以解析率證明實裝) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 39 | 5027 蓓麗安特 | 專屬特性／魂印 | 蓓 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 40 | 5027 蓓麗安特 | 技能 | 星垂穹儀 | b | B | registry handler src/effects/elves/beliente/registry.ts:45 | immune_next_n；convert_damage_to_heal_next；on_next_switch_in |
| 41 | 5027 蓓麗安特 | 技能 | 星祈·繞指星瀾 | a | B | 通用路徑(積木＋未解析文字 fallback（未保證完整）) | on_next_switch_in |
| 42 | 5027 蓓麗安特 | 技能 | 星執·浩邃星幕 | b | B | 通用路徑(積木＋未解析文字 fallback（未保證完整）) | status_transfer_all；on_next_switch_in |
| 43 | 5028 怒濤·滄嵐 | 專屬特性／魂印 | 瀾 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 44 | 5029 異境神霆·雷伊 | 專屬特性／魂印 | 異 | b | B | 通用路徑(專屬程式（積木僅供語意對照）) | stat_view_swap；standing_query_hook |
| 45 | 5029 異境神霆·雷伊 | 專屬異能特質 | 神明 | c | - | 通用路徑(特質引擎／專屬程式：須逐條核對，未以解析率證明實裝) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 46 | 5029 異境神霆·雷伊 | 專屬異能特質 | 雷神 | b | B | 通用路徑(特質引擎／專屬程式：須逐條核對，未以解析率證明實裝) | scale_by_hp_lost_pct |
| 47 | 5029 異境神霆·雷伊 | 技能 | 霆·禁雷敕令 | b | B | registry handler src/effects/elves/otherworld-rey/registry.ts:293, src/effects/elves/otherworld-rey/registry.ts:334 | standing_query_hook；priority_if_hp_below |
| 48 | 5030 聖靈邁爾斯 | 專屬特性／魂印 | 聖 | b | B | 通用路徑(專屬程式（積木僅供語意對照）) | immune_next_n；repeat_by_hp_decile |
| 49 | 5030 聖靈邁爾斯 | 技能 | 淨世洗禮頌 | a | B | registry handler src/effects/elves/holy-miles/registry.ts:147 | repeat_by_hp_decile |
| 50 | 5031 六界神王 | 專屬特性／魂印 | 界 | b | B | 通用路徑(通用魂印／Kit（未登記全描述積木執行）) | reflect_true_damage |
| 51 | 5035 御天龍神·哈莫 | 專屬特性／魂印 | 鱗 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 52 | 5035 御天龍神·哈莫 | 技能 | 逐波 | c | - | registry handler src/effects/elves/hamo/registry.ts:209 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 53 | 5035 御天龍神·哈莫 | 技能 | 燼世 | c | - | registry handler src/effects/elves/hamo/registry.ts:214 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 54 | 5035 御天龍神·哈莫 | 技能 | 纏根 | c | - | registry handler src/effects/elves/hamo/registry.ts:220 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 55 | 5035 御天龍神·哈莫 | 技能 | 龍神·御天陣 | c | - | registry handler src/effects/elves/hamo/registry.ts:178, src/effects/elves/hamo/registry.ts:201, src/effects/elves/hamo/registry.ts:226 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 56 | arena_12 無為龍者 | 專屬特性／魂印 | 無為之境 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 無為之境：PP 與已損失 PP 互換、萬相乖離逐條取消條件；技能「無為」子效果與魂印共用同一狀態 |
| 57 | arena_12 無為龍者 | 技能 | 千秋虔 | c | - | registry handler src/effects/elves/staged-arena/wuweiRegistry.ts:87 | 無為之境：PP 與已損失 PP 互換、萬相乖離逐條取消條件；技能「無為」子效果與魂印共用同一狀態 |
| 58 | arena_12 無為龍者 | 技能 | 百法拜 | c | - | registry handler src/effects/elves/staged-arena/wuweiRegistry.ts:93 | 無為之境：PP 與已損失 PP 互換、萬相乖離逐條取消條件；技能「無為」子效果與魂印共用同一狀態 |
| 59 | arena_12 無為龍者 | 技能 | 十玄釋 | c | - | registry handler src/effects/elves/staged-arena/wuweiRegistry.ts:97 | 無為之境：PP 與已損失 PP 互換、萬相乖離逐條取消條件；技能「無為」子效果與魂印共用同一狀態 |
| 60 | arena_12 無為龍者 | 技能 | 孑身誡 | c | - | registry handler src/effects/elves/staged-arena/wuweiRegistry.ts:101 | 無為之境：PP 與已損失 PP 互換、萬相乖離逐條取消條件；技能「無為」子效果與魂印共用同一狀態 |
| 61 | arena_12 無為龍者 | 技能 | 無相諦 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 無為之境：PP 與已損失 PP 互換、萬相乖離逐條取消條件；技能「無為」子效果與魂印共用同一狀態 |
| 62 | arena_13 龍錄天鋒 | 專屬特性／魂印 | 專屬特性 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 出戰次數序列（六段兩回合效果、第 6 次清除、第 7 次恢復）；65 之後可在 B 組 stat_view_swap 完成後降為(b) |
| 63 | arena_13 龍錄天鋒 | 技能 | 鋒毫浸血雨 | c | - | registry handler src/effects/elves/staged-arena/tianfengRegistry.ts:50 | 出戰次數序列（六段兩回合效果、第 6 次清除、第 7 次恢復）；65 之後可在 B 組 stat_view_swap 完成後降為(b) |
| 64 | arena_13 龍錄天鋒 | 技能 | 艷羅劍典 | c | - | registry handler src/effects/elves/staged-arena/tianfengRegistry.ts:57 | 出戰次數序列（六段兩回合效果、第 6 次清除、第 7 次恢復）；65 之後可在 B 組 stat_view_swap 完成後降為(b) |
| 65 | arena_13 龍錄天鋒 | 技能 | 萬蒼書帝錄 | c | - | registry handler src/effects/elves/staged-arena/tianfengRegistry.ts:79 | 出戰次數序列（六段兩回合效果、第 6 次清除、第 7 次恢復）；65 之後可在 B 組 stat_view_swap 完成後降為(b) |
| 66 | arena_14 無極聖武 | 專屬特性／魂印 | 無極聖武 | c | - | registry handler src/effects/battleEventRegistry.ts:265, src/effects/elves/staged-arena/index.ts:16, src/battle/seerAssets.ts:61 | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 67 | arena_15 命運龍輪 莫伊萊 | 專屬特性／魂印 | 命運龍輪 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移 |
| 68 | arena_16 鎮世龍魂・龍之治癒 | 專屬特性／魂印 | 龍之治癒 | c | - | 通用路徑(專屬程式（積木僅供語意對照）) | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 69 | arena_16 鎮世龍魂・龍之治癒 | 技能 | 剛莖棍壓 | c | - | registry handler src/effects/elves/staged-arena/dragonHealingRegistry.ts:213 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 70 | arena_16 鎮世龍魂・龍之治癒 | 技能 | 挨打要立正 | c | - | registry handler src/effects/elves/staged-arena/dragonHealingRegistry.ts:218 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 71 | arena_16 鎮世龍魂・龍之治癒 | 技能 | 幽魔相嘯 | c | - | registry handler src/effects/elves/staged-arena/dragonHealingRegistry.ts:223 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 72 | arena_16 鎮世龍魂・龍之治癒 | 技能 | 雅髯獅嘯 | c | - | registry handler src/effects/elves/staged-arena/dragonHealingRegistry.ts:242 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |
| 73 | arena_16 鎮世龍魂・龍之治癒 | 技能 | 但願不會是個怪物 | c | - | registry handler src/effects/elves/staged-arena/dragonHealingRegistry.ts:253 | 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移 |

(c) 類專屬狀態機理由（分群）：

- 專屬狀態機或規則改寫（守護印記/魔軀枷鎖/輪迴回溯/寂殺之魄/未暝之夜/狂暴轉化/體力上限調整/隱匿/特防公式改寫/恐懼之種/技能石/星執者/護盾減半/神降/印記全套/隨機二選一），需先拆成通用機制再遷移：#1, 5, 8, 10, 11, 14, 19, 27, 29, 31, 35, 38, 39, 43, 45, 66, 67
- 額外精靈／召喚物（克塔亞特、珀妮、賽博怨靈）：需要「額外精靈加入某方」的通用模型與戰場名冊：#2, 13, 33
- 三機甲組合與充能值取代 PP 的整套資源系統：#15
- 符文（ᛏ 等）系統：符文附加到精靈與技能位、剝離、激活狀態、傳承給下一隻：#22, 23, 24
- 詩章計數系統（背包內累計並分級給效果）；技能 26 依賴此狀態：#25, 26
- 龍鱗／四龍喚醒／龍魂印記等專屬狀態機；技能直接讀取魂印狀態，魂印未結構化前不可單獨遷移：#51, 52, 53, 54, 55, 68, 69, 70, 71, 72, 73
- 無為之境：PP 與已損失 PP 互換、萬相乖離逐條取消條件；技能「無為」子效果與魂印共用同一狀態：#56, 57, 58, 59, 60, 61
- 出戰次數序列（六段兩回合效果、第 6 次清除、第 7 次恢復）；65 之後可在 B 組 stat_view_swap 完成後降為(b)：#62, 63, 64, 65

## 怎麼新增一筆 Kit 定義

1. 技能：在 `src/data/migrated<名稱>SkillKits.ts` 新增（或加進同精靈既有檔），匯出 `ReviewedSequenceSkill[]`，每筆 `{elfIds, name, description, kit}`。`name` 與 `description` 必須和精靈資料完全一致（逐字），`applyReviewedSkillKits` 靠它們比對，並把 `effectMode` 設成 `kit`。寫法用 `src/data/reviewedSequenceSkillKits.ts` 的 `property(text, prop, value, order)`、`action(op, p)`、`sequence(raw, body, order)`；`afterSkill`／`afterHit` 在 migratedSequenceSkillKits.ts。新檔要在 `src/data/migratedSequenceSkillKits.ts` 匯入並 spread 進 `MIGRATED_SEQUENCE_SKILL_KITS`。
2. 魂印：加入 `src/data/reviewedSoulKits.ts`（或 `migratedMarkSoulKits.ts` 這類檔），Kit 帶 `kind:'soul'`。特質：`src/data/migratedTraitKits.ts` 的 `MIGRATED_TRAIT_KITS`（`kind:'trait'`）。
3. 打包：`npm run data:kit-pack`（`scripts/pack_reviewed_kits.ts`）會檢查 (owner, kind, name, description) 不重複、`validateKit` 通過，並重寫 `src/data/reviewedKits.compressed.json`／`homepage.json`／`deferred.json`（arena_／wiki_ 進 deferred）。`--check` 只檢查不寫入。這三個檔案有改才 commit。
4. 新通用 op：在 `src/effects/sequenceContract.ts` 的 `SEQUENCE_ACTION_FIELDS`（op → 允許參數名）登記，條件登 `SEQUENCE_CONDITION_FIELDS`，事件登 `SEQUENCE_TRIGGERS`；執行端在 `src/blocks/runtime.ts` 的 `ACT` 表加同名函式（讀取端另需改該機制的單一入口，例如扣 PP、先制、傷害計算）；若要能從文字解析，改 `src/blocks/parse.ts`／`model.ts`。契約沒登記的 op 會被 `validateKit` 擋下（「尚無已核對的可編輯合約」）。
5. 讓舊 handler 停止：只要 Kit 比對成功、`effectMode` 為 `kit`，`effectRoute` 就走 kit，`usesAuthoredSkill/Soul` 為真，舊的 skill handler 以及 AFTER_HIT／ON_INVALID 包裝會跳過。仍建議刪除對應的 handler 函式與 `SOUL_MARK_MAPPING` 條目（`src/effects/battleEventRegistry.ts`）避免兩套並存。
6. 註冊表基準：`tests/elfRegistryModules.semantic.test.ts` 會比對現有註冊表鍵與 `tests/fixtures/elfRegistryBeforeMove.json`。已遷移的技能要在測試的 `migrations` 表加 `{技能名: [擁有者 id]}`（或照舊文件從 fixture 刪鍵），兩種都被接受，但一定要有其一。
7. 測試：新增 `tests/<名稱>.semantic.test.ts`，用 migrationHarness 跑一場真實結算，斷言要覆蓋原文每一句（不要放寬既有斷言）；在 `package.json` 的對應 test 腳本加入新檔（動畫類加進 `test:animation`）。注意 package.json 是 CRLF，編輯時保留 CR。
8. 回報：`npm run audit:block-migration` 重新產生 `docs/audits/block-migration{,-queue-342}.{json,md}`，確認該筆從 unconnected 移到 connected；最後跑 `npm test`、`npm run lint`、`npm run build`、`npm run audit:bundle`（預算 950000，不可調高）。
9. 命名：op 用 snake_case 動詞開頭（`pp_zero_random`），條件用 `cond:` 前綴，值查詢用名詞；不要把精靈名寫進通用 op（AGENTS.md 禁止在 BattleScreen.tsx、battleEngine.ts 寫精靈專屬程式）。

## 既有 custom op 與 legacy_handler 設計

現況：`custom` op 來自 `src/blocks/parse.ts` 的 `customAct`，執行端是 `src/blocks/runtime.ts` 的 `ACT.custom`，查 `src/blocks/custom.ts` 的 `CUSTOM` 表（以正規化子句文字為 key，`CustomDef {label, run, trig?, prio?}`）。目前合約拒收它（10 筆定義被擋），所以只用在編輯器顯示，不算語意通過。

提案：新增 `legacy_handler{elf,key,kind}`。
- 合約：`SEQUENCE_ACTION_FIELDS.legacy_handler=["elf","key","kind"]`，且一個 Kit 只能含這一個動作。
- 執行：`ACT.legacy_handler` 依 elf+key 查集中註冊的原 handler（技能來自 `getBattleSkillRegistry()`，魂印來自 `SOUL_MARK_MAPPING` 的函式），以原簽章呼叫。
- 顯示：編輯器顯示唯讀「專屬機制：<名稱>」，可看原文、不可改參數。
- 稽核：`describeExecution` 標 `legacyWrapped:true`，不算 `semanticallyAccepted`，報表另開「包裝（未拆解）」欄，不混入已拆解的 324。
- 防護：key 不存在時 `validateKit` 失敗；不得對 legacy 包裝宣告 `migrations`；新定義禁止使用，只作為 (c) 類 47 筆的過渡。
- 注意：若包裝後把 `effectMode` 設成 `kit`，舊 handler 會被 gate 跳過，必須在 `effectConnection` 為 `legacy_handler` 開例外，否則舊行為會消失。
