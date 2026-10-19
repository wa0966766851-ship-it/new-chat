# 剩餘 legacyWrapped 收尾計畫（final-1，GLM 中斷後盤點）

盤點時間：2026-10-18。基底：final-1 = pc-sync-6（fbfd1bb1）＋ galaxy-1 ＋ illusion-1 ＋「sync PC (GLM interrupted state)」。
本文件只盤點、規劃；未修改電腦端任何檔案，也未動 759f348／4f99c11／e05ccb7。

## 1. 現況數字

| 項目 | 數字 |
|---|---|
| 精靈 | 43 |
| 效果定義（魂印／特質／技能） | 397 |
| 未接通（unconnectedDefinitions） | 0 |
| 已接通（397 − 0） | 397 |
| 其中真積木 Kit（非包裝） | 351 |
| legacyWrapped（專屬機制包裝） | 46（見 §5 完整清單） |
| 可轉換候選／待補 | 159／238 |
| tsc --noEmit | 0 錯誤 |
| npm run data:kit-pack | 失敗（唯一被拒：5031 魂印「界」，見 §3.2） |
| npm test（258 條子指令，2 平行） | 247 綠、11 紅（其中 `pack_reviewed_kits.ts` 與 `--check` 同因，見 §3.3） |

注意：46 這個數字含 5031「界」。5031 的真 Kit 已寫好並接線，但因 pack 失敗，打包 JSON（reviewedKits.*.json）仍是舊的、仍含「界」的包裝，audit 因此還算它為 legacyWrapped。修好 5031 並重新 pack 後會變 45。

## 2. 合併與同步

- 分支：`final-1`（worktree `/home/claude/wt-final`）。pc-sync-6 被 `/home/claude/wt-sync` 佔用，所以從它的 HEAD commit fbfd1bb1 開新分支。
- merge galaxy-1、merge illusion-1：兩者皆無衝突（共同祖先 9e14884a，改動範圍不重疊）。
- 電腦端 → wt-final：src 全部 652 檔逐一比 bytes 大小＋mtime；tests／scripts／docs／根目錄設定以 mtime 晚於上次同步（cf99565e 之後）為準，共 216 檔 stage 後逐檔 `cmp`，118 檔有差異。
- 實際 commit 112 檔（新增 39、修改 73）：src 66（新增 24）、tests 20（新增 14）、docs 24、scripts 1、package.json 1。EOL 以 bytes 原樣複製（`cp`）。commit：`6fb7890a sync PC (GLM interrupted state)`。
- 刻意不 commit 的 6 檔（電腦端殘留的垃圾）：
  - `tests/_pkl.txt`、`_pkl2.txt`、`_pkl3.txt`、`_pkl4.txt`、`tests/_uif.txt`：UTF-16 PowerShell 錯誤輸出（內容是 pack_reviewed_kits 失敗訊息），不是測試。
  - `scripts/_tmp_arena16_dump.mjs`：一次性探針。
  - 另：雲端已刪的 `tests/_probe_kitshape.ts` 電腦端仍在，未重新加回。
- 同步風險檢查：電腦端覆蓋雲端 d6e09f9a 之後的雲端修改時，逐檔確認雲端新增行是否已存在於電腦端；唯三處「缺席」是 5009 辟冥·鎮獄斷、5013 王·夜予寒吟、5023 械律·置換的包裝／過渡 handler，這是 GLM 已把它們拆成真 Kit 的正常結果，不是遺失。
- 未涵蓋：`public/` 圖片、`dist*`、`build`、`node_modules`、`.git`、`log` 依指示排除；tests／docs 中 mtime 早於上次同步且雲端有改過的檔案不會被覆蓋（保留雲端版）。
- 環境備註：repo 追蹤了 `node_modules/`（約 25,000 檔），worktree 已自帶。第一次 `cp -a` 造成 `node_modules/node_modules` 巢狀、React 重複載入而大量假紅，已刪除巢狀目錄後重跑，本文件數字是重跑後的結果。

## 3. 紅項清單與歸屬

### 3.1 tsc
0 錯誤。GLM 寫到一半的檔案沒有留下型別錯誤。

### 3.2 data:kit-pack（唯一被合約拒絕的 Kit）
- 5031 魂印「界」，`kit[9]`：「全部受傷反饋需比例、明確傷害類型及使用事件」（sequenceContract.ts 第 465 行）。
- 原因：`reflect_received_damage{ratio:1,type:'真實'}` 放在 `trig:'defeated'`（自身被擊敗）條款，合約只允許 `use／self_skill／self_attack`。
- 驗證：把 `defeated` 暫改成 `use` 後整份 Kit 通過 validateKit，所以只有這一個阻擋點；其他 344 份通過，深比較還原（compressed 345／homepage 315／deferred 30）也通過。
- 之前提到的 `unit:'式'`、`resource_mark_remove` 多傳 name 在電腦端最終狀態已不存在。
- 後果：reviewedKits.compressed／homepage／deferred.json 與來源不一致（試跑 pack 的位元組數與現存檔不同），`pack --check` 紅。

### 3.3 npm test 紅項（11 條指令，9 個獨立原因）
基準對照：同樣 11 條在 wt-sync（fbfd1bb1）與「final-1 合併後、sync 前」兩個狀態全綠 → 紅項全部來自電腦端這批改動，與 galaxy／illusion 合併無關，也不是環境問題。再依檔案 mtime 順序二分定位出第一個讓它變紅的電腦端檔案：

| # | 紅項 | 定位到的檔案 | 歸屬 |
|---|---|---|---|
| 19、57 | `pack_reviewed_kits.ts`（含 `--check`） | 5031 Kit（§3.2） | GLM 中斷造成（最後一步 pack 就是這個錯，_pkl*.txt 即其輸出） |
| 237 | `audit_effect_implementation.ts --check`（核對 JSON 需重新產生） | docs/全精靈效果實裝核對.* 停在 04:23，之後來源又改 | GLM 中斷造成（沒重產） |
| 253 | specialBattleIntegration：`getSoulMarkRegistry()['帝皇之盾']` 為 undefined | elves/imperial-shield/registry.ts（5002 盾遷 Kit，映射移除） | GLM 既有，測試未同步 |
| 208 | illusionFixes：`SoulMarkRegistry[ctx.self.name]` 呼叫舊盾 handler | 同上（imperial-shield） | GLM 既有，測試未同步 |
| 198、199 | damageReduction／damageReductionIntegration（keld_reduce 管線讀取、柯爾霍德兩分支 0.4 與 1971≠19） | elves/keld/registry.ts（5012 冰魂印遷 Kit，registry 縮成 1.1KB） | GLM 既有，測試未改用真 Kit |
| 209 | hamoShiyan：SHIYAN_SKILLS 預期 5 實際 4 | elves/wuxu-shiyan/registry.ts（5023 械律·置換遷 Kit） | GLM 既有，測試未同步 |
| 232 | skillMeaningRound2：舊 handleOpeiaSoulMark 的 `opeiaTreatInsectAttacks` 為 undefined | elves/opeia/registry.ts（5018 后空殼化） | GLM 既有（子代理 C 批，該測試未在其回歸清單） |
| 83 | migrate_monkeyBaphomet：convert_status 回傳 false | blocks/runtime.ts（5015 夜加入 `status_conversion_ban`，convert_status 現在呼叫 `ctx.getPlayerState/getOpponentState`，測試的模擬 ctx 沒有） | GLM 既有，測試 mock 需補 |
| 195 | opeiaAttackSkills：王·鏽腑喰心「綁定計時只附加一次 30% 真傷」實際 2 | effects/opeiaAttackSkills.ts（王·鏽腑喰心拆 Kit，`attack_received_true_turns` 用 `next:'auto'` 含當回合） | GLM 既有且已自行通報（子代理 C 報告）；與 2026-10-17 使用者先後手規則有關，需裁定改 `next:true` 或改斷言 |

歸納：
- GLM 中斷直接造成：#19／57（pack）、#237（核對檔未重產）。
- GLM 批次改動後測試沒跟上（中斷前就紅）：#253、208、198、199、209、232、83、195。處置一律是「以真 Kit 驅動改寫測試、保留行為斷言」，不是回退實作。
- 環境造成：0（扣掉已排除的巢狀 node_modules）。

## 4. GLM 進行中定義與半成品檔案

說明：子代理 D（奧丁）、E×6、F×5、G×3 在電腦端沒有留下任何落地檔案（最後寫入時間 2026-10-18 04:56，之後無檔案）；協作分工文件最後一段只記錄了 D 的派工。以下是實際落地的狀態。

| 定義 | 狀態 | 檔案 | 建議處置 |
|---|---|---|---|
| 5025 恐懼的化身·咤克斯「懼」 | 已完成驗收（tests/migrate_5025_fear_soul 13 檢查雙側綠；fearSeed.ts 兩個 op `maxhp_absorb_all`、`opp_active_swap` 完整並被使用，不是只有地基） | blocks/ops/fearSeed.ts、data/migratedZhakesiFearSoulKit.ts、effects/markProgram.ts | 保留。另有 2 項歧義仍待使用者裁定（見 §7） |
| 5018 蟲后·奧佩婭「后」 | 已完成驗收（41 檢查雙側綠） | blocks/ops/rosterStats.ts、data/migratedOpeiaSoulKit.ts、groupC／groupCContract | 保留；#232 舊測試要改 |
| 5015 夜、arena_15 莫伊萊、arena_13 魂印＋2 技、5013 凕、5012 冰、5002 盾、5009 辟冥·鎮獄斷、5013 王·夜予寒吟、5023 械律·置換、5018 王·鏽腑喰心 | 已完成驗收（各自測試綠） | 各自 migrated*Kit.ts＋tests/migrate_* | 保留；#253／208／198／199／209／83 是這批留下的舊測試 |
| 5031 六界神王「界」 | Kit 已寫完並接線，但被合約拒絕；沒有測試 | data/migratedLiujieSoulKit.ts（10 條款）、data/liujie.ts（新描述）、reviewedSoulKits.ts 已 import、migratedLegacyWrappedKits.ts 已移出、battleEventRegistry 映射已移除、destiny-c/registry.ts handleLiujieSoulMark 已空殼化、fixture 已剪 | 接手完成（見 G1 第一項）。缺：① 合約放行或改寫 `defeated` 反饋；② `entry_state_snapshot／restore` 在合約有登記但 runtime 沒實作（holyMiles.ts 只實作了 incoming_halve_per_mark、repeat_body）；③ `tests/migrate_5031_jie.semantic.test.ts` 不存在；④ npm script；⑤ 重新 pack |
| 5030 聖靈邁爾斯「聖」＋淨世洗禮頌 | 只做了地基 op，沒有 Kit | arenaShared.ts `hp_steps`、holyMiles.ts `incoming_halve_per_mark`／`repeat_body`、keldSoul.ts `damage_cap_by_mark` 的 in／fixed 模式、descriptions 已改寫（data/holyMiles.ts） | 接手完成（G1）。缺：聖怒「全隊最高體力比例」`hp_steps` scope 擴充、洗禮頌保底值×2^N＋無效時重新結算（use_counter 預掛）、四象 cleansePending、魂印 Kit、技能 Kit |
| `damage_cap_by_mark` in／fixed 模式 | 已實作並登記，只有 5031 Kit 會用到，尚無測試覆蓋 in 模式 | blocks/ops/keldSoul.ts | 保留，隨 5031 測試補覆蓋 |
| 5019 奧丁 | 子代理 D 已派，沒有任何落地檔案（PP 0/0、第五技 1/1、符文印記不顯示、印記跨精靈污染、效果對照總檢全未修） | effects/elves/odin/registry.ts（552 行）、data/migratedOdinRuneSkillKits.ts 為舊狀態 | 由專責代理重做（§6），其他組不碰 |
| 分級邏輯 | 已完成驗收（getElfDestinyRank 委託 getElfDisplayRank） | utils/destinyGacha.ts、utils/elfDisplayRank.ts | 保留 |
| 打包 JSON（3 檔） | 與來源不一致 | data/reviewedKits.compressed／homepage／deferred.json | 不手改；5031 修好後 `npm run data:kit-pack` 重產 |
| 稽核產物 | 過期 | docs/全精靈效果實裝核對.json／.md、docs/audits/block-migration.*（重產只會有排序雜訊） | 整合者在最後一步重產 |
| 神降文字位置、命運之輪首頁圖片 | 只有待辦登記，無檔案 | — | 另案，不列入本計畫 |

## 5. legacyWrapped 完整清單（46）

| 精靈 id | 精靈名 | 定義名 | 類型 |
|---|---|---|---|
| 5007 | 混濁海妖.布林克克 | 濁 | 魂印 |
| 5009 | 誑獅魔軀.魔獅迪露 | 獅 | 魂印 |
| 5000 | 聖靈譜尼 | 神 | 魂印 |
| 5010 | 星光·魯斯王 | 海 | 魂印 |
| 5014 | 聖光斯嘉麗 | 燦 | 魂印 |
| 5016 | 變革·馬爾修斯 | 械 | 魂印 |
| 5016 | 變革·馬爾修斯 | 核心重構 | 技能 |
| 5016 | 變革·馬爾修斯 | 王·超限共頻 | 技能 |
| 5019 | 眾神之父·奧丁 | ᛏ | 魂印 |
| 5019 | 眾神之父·奧丁 | ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ | 技能 |
| 5019 | 眾神之父·奧丁 | ᚱᚨᚷᚾᚨᚱᛟᚲ | 技能 |
| 5021 | 治癒.龍魂再臨 次元龍 | 龍 | 魂印 |
| 5021 | 治癒.龍魂再臨 次元龍 | 遺典.妄世律裁 | 技能 |
| 5022 | 無序.六刃 | 專屬特性 | 魂印 |
| 5022 | 無序.六刃 | 無我 / 戰士 | 二代異能特質 |
| 5022 | 無序.六刃 | 終焉·六花斬 | 技能 |
| 5023 | 無序·蝕言 | 蝕言 | 魂印 |
| 5023 | 無序·蝕言 | 修復 / 咒術師 | 二代異能特質 |
| 5026 | 無序.墜星 | 豪邁 / 投石者 | 二代異能特質 |
| 5027 | 蓓麗安特 | 蓓 | 魂印 |
| 5028 | 怒濤·滄嵐 | 瀾 | 魂印 |
| 5029 | 異境神霆·雷伊 | 異 | 魂印 |
| 5029 | 異境神霆·雷伊 | 神明 | 專屬異能特質 |
| 5029 | 異境神霆·雷伊 | 雷神 | 專屬異能特質 |
| 5029 | 異境神霆·雷伊 | 霆·禁雷敕令 | 技能 |
| 5030 | 聖靈邁爾斯 | 聖 | 魂印 |
| 5030 | 聖靈邁爾斯 | 淨世洗禮頌 | 技能 |
| 5031 | 六界神王 | 界 | 魂印（Kit 已寫但被合約拒絕，打包 JSON 過期才仍算包裝） |
| 5035 | 御天龍神·哈莫 | 鱗 | 魂印 |
| 5035 | 御天龍神·哈莫 | 逐波 | 技能 |
| 5035 | 御天龍神·哈莫 | 燼世 | 技能 |
| 5035 | 御天龍神·哈莫 | 纏根 | 技能 |
| 5035 | 御天龍神·哈莫 | 龍神·御天陣 | 技能 |
| arena_12 | 無為龍者 | 無為之境 | 魂印 |
| arena_12 | 無為龍者 | 千秋虔 | 技能 |
| arena_12 | 無為龍者 | 百法拜 | 技能 |
| arena_12 | 無為龍者 | 十玄釋 | 技能 |
| arena_12 | 無為龍者 | 孑身誡 | 技能 |
| arena_12 | 無為龍者 | 無相諦 | 技能 |
| arena_13 | 龍錄天鋒 | 鋒毫浸血雨 | 技能 |
| arena_14 | 無極聖武 | 無極聖武 | 魂印 |
| arena_16 | 鎮世龍魂・龍之治癒 | 龍之治癒 | 魂印 |
| arena_16 | 鎮世龍魂・龍之治癒 | 挨打要立正 | 技能 |
| arena_16 | 鎮世龍魂・龍之治癒 | 幽魔相嘯 | 技能 |
| arena_16 | 鎮世龍魂・龍之治癒 | 雅髯獅嘯 | 技能 |
| arena_16 | 鎮世龍魂・龍之治癒 | 但願不會是個怪物 | 技能 |

合計 46；扣掉 5019 的 3 份（專責代理）得 43 份分成 5 組。

## 6. 五組分配

分組原則：組間不改同一精靈；新 op 各放自己的 ops 檔；共用 op 的「擁有者」只有一組；工作量以定義複雜度估點（魂印 4–8、技能 2–3、額外精靈／特殊模式加成），各組約 28–35 點。

### 共同協定（五組都要遵守，避免撞檔）
1. 每組在自己的 worktree／分支（從 final-1 HEAD 開）工作；新 op 放新檔 `src/blocks/ops/<組名>.ts`，Kit 放新檔 `src/data/migrated<組名>*Kit.ts`，測試放 `tests/migrate_<id>_*.semantic.test.ts`，npm script 名稱不重複。
2. 共用檔（blocks/runtime.ts、effects/sequenceContract.ts、data/reviewedSoulKits.ts／reviewedSkillKits 聚合、data/migratedLegacyWrappedKits.ts、effects/battleEventRegistry.ts、tests/fixtures/elfRegistryBeforeMove.json、package.json、scripts/audit_block_coverage.ts 閾值）只做「一行 import／spread／移出／剪鍵」的最小手術，且回報時列出行號，讓整合者逐組 merge 時只會有單行衝突。
3. 組分支內不要重產 `reviewedKits.*.json`、`docs/全精靈效果實裝核對.*`、`docs/audits/block-migration.*`（大檔必衝突）；`pack`、`audit:implementation`、`audit:block-migration` 只由整合者在全部 merge 後跑一次。
4. 每份定義遷移的驗收：tsc 0、`validateKit` 通過（可用 §3.2 的做法逐份驗）、該精靈 P1／P2 雙側測試、`legacyWrappedSlim` 與 `elfRegistryModules` 與 `effectAudit` 不新增紅。舊 handler 依規則 3.3 空殼化，舊測試改以真 Kit 驅動。
5. wrapped 條目的 label 必須走 `wrappedLabel()` 約定，不可自訂；描述可以改但要與 wrapped 條目逐字同步。
6. 先後手規則（使用者 2026-10-17）：「N 回合內」先出手含當回合、後出手補償 +1；掛在對手身上、當回合即時消耗的反應用 `attack_received_true_turns{next:'auto'}`；「下 N 回合」「當回合」不適用。
7. 既有可重用 op：`hp_steps`、`incoming_halve_per_mark`、`repeat_body`、`damage_cap_by_mark`(in／out)、`random_branch`、`resource_mark_add／remove`、`mark_program`（含非真實傷害倍率、保底最大體力傷害）、`prio_bonus`、`maxhp_absorb_all`、`opp_active_swap`、`temp_stats_by_last／restore`、`bench_type_stat_transfer`、`attack_bypass_until_switch`、`counter_from_last`、`pp_no_cost`、`reduction_override_turns`、`seal_used_skill_pp_phase_end`、`roster_query`（含 alive_or_type）、`status_conversion_ban`、`attack_received_true_turns`、entranceStack／stageDamage／powerStat／itemUse 系列。

### 組 1：聖／界／龍鱗（9 份，約 28 點）
精靈：5030、5031、5035、arena_13。
- 5031 界（1）：先修收尾（半天內可完成）。
  - 合約：二選一。(a) sequenceContract 第 465 行放行 `trig:'defeated'`，並確認引擎在被擊敗事件寫好 `receivedDamageThisRound`（round／ownerBattleId）且 targetSide 指向致死來源；(b) 改用既有 `reflect_event_damage`（吃 effectEventData 的來源與數值），再確認可轉成真實傷害。原文「位於場下也可觸發」要驗。
  - 實作 `entry_state_snapshot／restore`（體力＋各技能 PP，放 holyMiles.ts）。
  - 補 `tests/migrate_5031_jie.semantic.test.ts`（六秘法、讀法 B 疊加、下場清除、被擊敗反饋）、npm script、整合者 pack。
- 5030 聖＋淨世洗禮頌（2）：建議新 op（`ops/holyMiles.ts` 擴充，同檔已有地基）：`hp_steps` 的 `scope:'team-max'`（對方全隊最高體力比例）、`cleanse_pending`（四象：下次回合開始額外解控制／弱化類異常＋對手先制失效）、`floor_damage_doubling`（保底 280×2^N，N＝對手體力每 10% 一次；使用者裁定「無效時保底值再翻倍」）。
- 5035 鱗（1）＋逐波／燼世／纏根／龍神·御天陣（4）：建議新 op（`ops/dragonScale.ts`）：
  - 龍鱗：以資源印記表達無色／紅／藍／綠，`recolor_scale{order:[藍,紅,綠]}` 按序染色、「不可染成已持有顏色」、被染色時清除本次在場回合累計；
  - `type_cycle_gate{cycle:[水,火,草]}`：對手每次造成技能傷害需按循環附加自身單一屬性傷害，滿足→傷害減半並染色，不滿足→該傷害無效＋己方龍系能力上限 +20%＋減半次數 +1；
  - 紅／藍／綠消失效果（免疫成功後本回合結束消失，消失時消除回合類／護盾護罩／削對手體力上限 20%）；
  - `stat_sum_as{from:[atk,spatk],as:'spatk'}`（雙攻總和視為特攻；**本 op 由組 1 擁有，組 4 的雷伊雷神要用**）；
  - `best_type_calc{types:[…]}`（水／龍系中對對手最優屬性）；
  - 技能「無效時重新進行傷害結算且威力 +100%」＝`resettle_on_invalid{powerBonus,body}`，與 5030 洗禮頌共用（同在組 1，所以不撞）。
- arena_13 鋒毫浸血雨（1）：既有件為主（下 1 回合命中時消耗目前體力 1/2 並等量百分比傷害、2 回合屬性技無效、若該回合未觸發則下 2 回合攻擊技無效、技能無效時免疫下一次攻擊）；缺口可能只有「未擊敗且未受到此全屬性下降→2 回合無法主動切換」的條件組合。

### 組 2：競技場龍者（11 份，約 33 點）
精靈：arena_12、arena_16。
- arena_12 無為之境（魂印）＋千秋虔／百法拜／十玄釋／孑身誡／無相諦（5 技，共 6 份）。建議新 op（`ops/wuweiRealm.ts`）：
  - 戰鬥開始「所有能力值變為全部能力值之和的一半」`stats_average_to_half_sum`；
  - PP 互換：使用後不扣固定 PP，改為互換「目前 PP」與「已損失 PP」`pp_swap_lost`；
  - 以非 0／0 PP 使用的分流（解除異常＋免疫下一次異常／必中＋強制命中＋觸發【萬相乖離】）；
  - 未使用技能的回合結束觸發【無為】（每技能一條件，消耗該技能全部 PP）`idle_round_end_trigger`；
  - 【萬相乖離】依序永久取消六項條件之一並累計威力 +50（無相諦）`dissolve_conditions_seq`；
  - 無相諦：威力 0／PP 0、同屬性威力 +170、體力 <300 秒殺、擊敗後令對方全部陣亡精靈消逝；
  - 臣服（既有或新異常）、束縛、「若擊敗臣服的對手，下一隻出場也臣服」。
- arena_16 龍之治癒（魂印）＋挨打要立正／幽魔相嘯／雅髯獅嘯／但願不會是個怪物（4 技，共 5 份）。建議新 op（`ops/dragonHealing.ts`；`effects/elves/staged-arena/dragonHealingRegistry.ts` 已有部分舊 handler，電腦端 14KB）：
  - 四龍喚醒計數（資源印記 金／玄／赤／蒼，首次使用技能 1～4 依序喚醒）與依喚醒數疊加的屬性 25%、臨時體力上限、攻擊傷害 +50%、非真實傷害 −15%、回合結束回復與吸 PP；
  - 真龍・治癒（第五技喚醒，PP 無限、使用技能額外使用 4 次、取消四龍追加條件）；
  - 赤龍抵擋累計值（上限最大體力）與以累計值附加固定傷害；
  - 龍魂印記／龍魂之源／龍魂之力（每層每龍各 150 點龍系直傷，真龍後按最高克制）；
  - 雅髯獅嘯：解除異常「每成功解除 1 個附加 200 固傷、體力大於對手翻倍」；
  - 但願不會是個怪物：以雙方除體力外最高能力值 2 倍視為特攻、最低 50% 視為對手特防（`stat_extreme_as`）、傷害每被減少 10 點 +1 層龍魂印記並全能力 +10%、不足體力上限提升同步。

### 組 3：額外精靈／無序（7 份，約 35 點）
精靈：5007、5014、5022、5023。核心是「額外精靈」召喚與生命週期，三隻共用，所以放同組。
- 共用新 op（`ops/extraElf.ts`，組 3 擁有）：`summon_extra_elf{template,stats:'sum_half'|'fraction',side}`、額外精靈死亡／消逝／下場連動、額外行動（`extra_action{elf,type-best}`）、「取得己方所有精靈能力值總和一半」。
- 5007 濁（1）：克塔亞特加入敵方；在場／場下兩種對手受真實傷害回饋（直接增加自身等量體力／消耗當前體力 1/8 並以此降低非真實傷害，最多 16 層，「可降為 0 時不執行」）；非真實傷害 +4%×32；回合開始條件（在場回合數 ≤2 或 >8 的精靈）體力上限 +20% 並補滿；克塔亞特出戰漸凍、汲取、戰鬥結束消逝己方死亡精靈。
- 5014 燦（1）：珀妮額外精靈（能力 1/3）、非真實傷害降至 1/3 與燦界聖芒層數（上限 3，下場保留）、星贖轉化、失明轉星贖、弱點傷害（雙防較低者 60%）、珀妮額外行動與 4 回合重生（燦界聖芒縮短）；StatusRegistry 已有星贖定義。
- 5022 專屬特性＋無我／戰士＋終焉·六花斬（3）：出戰紀錄原始體力上限、雙向 1/6 真傷、臨時體力上限轉永久、`heal_cap_to_original`、造成非真實傷害 +120%（體力每降 0.1% 再 +120%）、受真傷後兩回合抵擋、平靜轉化（異常 → 平靜，狂暴則回合翻倍）、弱點傷害與護盾加成、技能 6 次額外行動與「期間不即時傷害、結束時總和結算」`deferred_action_damage_sum`。
- 5023 蝕言＋修復／咒術師（2）：詛咒雙方、特防 ÷10（進位）與敵方特攻公式改「只造成等同特攻值傷害」、賽博怨靈（額外精靈，特防同步、魔咒／滅靈魔咒額外行動、代死保留 20% 體力、場下真傷翻倍）；修復：衍化類異常 → 當回合戰鬥階段立即衍化並補 PP／體力。

### 組 4：機甲／雷伊／護盾（8 份，約 33 點）
精靈：5016、5029、5028。
- 5016 械＋核心重構＋王·超限共頻（3）：建議新 op（`ops/mechaCharge.ts`）：機甲三形態（堅壁／極速／毀滅）以資源印記或 mark_program 表達與組合切換、充能值（PP 改充能、視為滿且可選）、第五技後切換組合、堅壁「解析並記錄異常」異常紀錄清單與免疫、護盾護罩存在時首次非真傷減半、極速後手對手先制失效、毀滅威力 +100% 每次 +10% 上限 170%；核心重構與王·超限共頻多為既有件加「補充充能」。
- 5029 異（魂印）＋神明＋雷神（兩特質）＋霆·禁雷敕令（4）：複製對手能力提升、能力提升視為 2 倍下降、回合類效果無法被消除與對手回合類效果開始變 1 回合、麻痺回合連動、能力等級變動時雙方麻痺 +7；神降（體力下限改為 −70×體力上限、恢復量改為增加最大體力 70%、非真傷免疫並扣上限 70%）屬於「特殊模式留接口」；建議新 op（`ops/thunderGod.ts`）：`hp_floor_override`、`recover_to_gain`、`stat_sum_as`（**組 1 擁有，等組 1 merge 後才做雷神，或請整合者先把該 op 單獨合入**）、`dmg_scale_by_lost_hp{cap}`。
- 5028 瀾（1）：護盾登記為雙方可見數值、`shield_changed` 事件（每達 100 附加千秋一淚）、永恆之水（機率提升至 100%、護盾減少時保留 30%、死亡時以層數重生）、千秋一淚四段降效（恢復量、減傷衰減、護盾附帶效果失效、抵擋／免疫／轉化失效）；多為資源印記＋mark_program 欄位。

### 組 5：龍魂雜項（8 份，約 34 點）
精靈：5021、5000、5009、5010、5026、5027、arena_14。
- 5021 龍（魂印）＋遺典.妄世律裁（2）：詩章（轉移給存活的次元龍、增加體力上限、獨立計算無上限）、1～10+ 階梯效果表（`poem_tier_effects`，用 mark_program＋cond has_mark 階梯）、首次死亡進龍魂；`effects/elves` 已有次元龍 registry，沿用其詩章資料。
- 5000 神（1）：七個子效果（虛無、元素、能量、生命、輪迴、永恆、聖潔）。輪迴最重：「回合結束後體力、PP、能力等級返回當回合選擇操作之後的狀態」→ 建議 `round_checkpoint_restore`（與 5031 的 `entry_state_*` 同屬快照類，**命名請沿用組 1 的 entry_state 風格但各自實作，不共用函式**）。
- 5009 獅（1）：體力與上限 3,000,000、魔軀枷鎖（轉移、攻擊傷害與重量 +10%/道）、體力上限不可被變化、受傷吸取（雙防 50%、0.0187% 最大體力）、真實傷害強制存活；重量加成是新讀取端。
- 5010 海（1）：星海之浸（屬性技無效、受攻擊後額外百分比傷害＋回復對方）、每場一次致死保護（等級 100 條件）。
- 5026 豪邁／投石者（1）：技能石轉 SS 級威力 240、四種不同屬性石條件的神話與減傷、每次使用技能石對手背包全員 25%×克制的真傷；依賴 skill-stones 既有資料。
- 5027 蓓（1）：星執（記錄異常抗性最高項、進入時轉 3 回合星賜）、被擊敗化為星執者（能量池、每次消耗 ≥150、轉化獎勵）；星賜是既有附屬類異常。
- arena_14 無極聖武（1）：英雄之耀層數（由隊友通用特性計算）、砥礪判定（亮節／威怯）、武誅標記與五段效果、四個標記皆「是印記不是異常」。

### 專責線（不在五組內）：5019 奧丁（3 份）
- 定義：ᛏ 魂印、ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ、ᚱᚨᚷᚾᚨᚱᛟᚲ。
- 專責代理另處理：PP 值錯誤（ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚠᚠᚱᚨᛜ＝0/0、ᚱᚨᚷᚾᚨᚱᛟᚲ 第五技＝1/1）、符文印記視覺不顯示、印記跨精靈污染、效果對照描述總檢。
- 獨佔檔案：effects/elves/odin/registry.ts、data/migratedOdinRuneSkillKits.ts、odin 相關測試與印記顯示元件；其他組不可碰。

## 7. 使用者已裁定事項（GLM 已記錄）

1. 5031 六界神王「界」：讀法 B —— 已領悟的秘法「疊加保留、持續生效」直到自身下場後全部清除（可重複領悟同一秘法，效果再次觸發）。描述已改寫為繁中層次格式（`LIUJIE_SOUL_DESCRIPTION`，496 字，與 wrapped 條目逐字同步）。
2. 5030 淨世洗禮頌：「技能無效時翻倍」的對象是**保底值**（不是整體傷害）；描述已改寫為「對方在場精靈體力每有 10% 則保底值額外翻倍 1 次，技能無效時保底值再翻倍 1 次」。
3. 命運之輪分級：悲歌.索比拉特＝C（文本含「命運之輪 C 級專屬攔截：悲歌護盾」）、皮特薩拉羅＝B；不因種族值 735 自動升 S。實作：`getElfDestinyRank` 委託 `getElfDisplayRank`（單一事實源），全圖鑑 S＝12（皆為列名真神）。
4. 原廠先後手規則（2026-10-17／10-18 確認）：「N 回合內」一律適用先出手含當回合、後出手補償 +1，除非遇到邏輯問題（屆時回報使用者）；「下 N 回合」「當回合」自帶語意不適用。
5. UI 文案：標籤＋控制項，設計理由放 tooltip（既有偏好）。

仍待使用者裁定（已寫入 docs/積木化續作與時點規則_20261012.md 待確認區）：
- 5025「懼」：①「受到害怕計層」的半句——免疫當下是否視同受到而計層；②「至少減至 1」的下限語意。
- 王·鏽腑喰心（5018 技能）：opeiaAttackSkills 的先後手斷言（`next:'auto'` 含當回合 vs 測試期望只附加一次）。

## 8. 建議整合順序

1. 先由整合者：修 5031 合約、補 `entry_state_*` runtime、補測試、重新 pack（把 46 降到 45，並讓 `pack --check`／`audit --check` 轉綠）；順手改寫 §3.3 的 7 支舊測試（不涉及新機制）。
2. 派出 5 組＋奧丁專責線並行。
3. 逐組 merge，每次 merge 後跑 tsc＋該組測試＋`legacyWrappedSlim`／`elfRegistryModules`／`effectAudit`；全部完成後重產 pack、`audit:implementation`、`audit:block-migration`，目標 legacyWrapped 0。
