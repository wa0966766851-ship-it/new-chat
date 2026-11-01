# 岳峙淵渟.卡修斯（5041）驗收與稽核報告 2026-10-31

> 範圍：只盤點，不修。分支 cas-audit，基準 7de1f47e，PC 同步 commit f8738286。測試以雲端 wt-cas 實跑。

## 0. 摘要

- 同步：36 個檔案與 PC 不同（src 29、scripts 2、根目錄 5、public 卡修斯 png 4）；其餘已抽樣比對一致。
- 建置卡住的主因：PC 的 `.desktop-releases/update.lock`（0 bytes）殘留，`desktop_update.mjs` 以 `openSync(lock,'wx')` 拿鎖失敗，直接丟「已有桌面更新進行中」。其次是朝向測試（見 §2、§6）。雲端 tsc、kit-pack、vite build、audit:bundle 全綠，建置本身不卡。
- 逐句驗收：✅ 22／⚠ 23／❌ 12（共 57 句）。
- 共用改動造成三組確定的迴歸（基準 7de1f47e 皆綠）：sequenceContract 刪除未知參數攔截（6 測紅）、cassiusShan.ts 覆寫全域 OPS 的 `clear_turn`（2 測紅）、defaultElves 新增 5041（blockPresetWorkflow 紅）。

## 1. 同步結果

- 方法：md5（去 CR）內容比對，PC 為準；已 stage 的檔案 99＋抽樣 30＋png 4，結果 36 個內容不同。
- 公開素材只同步卡修斯相關：`public/seer/body/{3568,798}.png`、`public/seer/head/{3568,798}.png`；其他 public 檔只列不拉。
- `.seer-cache/pet-anim`（只列名稱與大小，未 stage）：`c3f933d81f62103e65b33c92190a71c9.bundle` 2,890,755 bytes（3568）；`32e340f77238916dcbd5039a3b2c652f.bundle` 504,034 bytes（798）；`3568.swf` 2,890,755；`798.swf` 504,034。大小與 petAnimationAssets 登錄的 size 一致。
- 副作用：PC 檔含 BOM（defaultElves、elfSkins、sequenceContract、kitValidation 等開頭有 U+FEFF），去 CR 後 diff 仍顯示整檔改動（defaultElves.ts 顯示 5677 行，實質 +48/-1，即新增 5041）。
- commit：`sync PC 10-31 (cassius): 36 files`（f8738286）。

## 2. 建置為何卡住

證據（PC `.tmp-testlogs`）：
1. `manual-build.log`：`node scripts/desktop_update.mjs` 於第 11 行 `fs.openSync(lock,'wx')` 失敗並丟出「已有桌面更新進行中；確認該流程結束後再處理更新鎖」。`.desktop-releases/update.lock` 為 0 bytes，是更早一次更新中斷（失敗路徑沒走到 finally unlink，或被強制結束）遺留的殘鎖。
2. `desk-art-174904.log`：該次更新在 tsx 測試階段失敗（`更新停止：node_modules/tsx/dist/cli.mjs`），失敗項是 `battleSpriteFacing.semantic.test.ts` 兩條：『岳峙淵渟.卡修斯（cassiusShandi）標成 front 卻沒有視覺證據』『靜態 …/seer/body 不得標成 front』。
3. `desk-a2-180432.log`：之後 `fail 0`——是把朝向從 front 改成 left 才轉綠，不是補了證據（見 §6）。
4. 雲端重現：tsc 0、`data:kit-pack` 0（reviewedKits 三份 json 重新打包後與 PC 內容相同，gzip 標頭差異屬 Windows/Linux 差，已 git checkout 還原）、`vite build --target esnext` 0（約 2 分鐘）、`audit:bundle` 0（126 個區塊均低於 500 kB，首頁靜態 JS 940.91 kB）。
5. desktop_update.mjs 本次也被改動（+17 行）；update 流程中的 fingerprint 會掃整個 tests／scripts，若建置期間有檔案變動會拒絕切換。

結論：卡住＝殘鎖（需人工確認無進程後刪除 0-byte 的 update.lock）＋朝向測試曾紅。雲端建置鏈全綠。

## 3. 測試（雲端 leaf by leaf，2 平行，exit code 逐筆存於 /tmp/claude-0/s/cas/res）

387 個 leaf 全部跑完：350 綠、37 紅。37 個紅項全數歸因如下。tsc、data:kit-pack、build、audit:bundle 全綠。

### 3.1 紅項歸因

| 組 | 數量 | 項目 | 原因 | 基準 7de1f47e |
|---|---|---|---|---|
| 1 本次同步造成：sequenceContract 刪除未知參數攔截 | 6（單獨驗證） | skillStonesSplit.generic（「多餘參數」）、markProgram、typeViewMigration、blockRecoveryMigration（Missing expected exception）、damageImmunityQuery、instantKillBlocks（falsy）等 | `paramsIssue` 刪掉 `尚無已核對的參數合約`。診斷時加回該行，前6項單獨轉綠 | 綠 |
| 2 本次同步造成：`clear_turn` 覆寫 | 2（單獨驗證） | migrationClosure（幽魔鏈）、migrationClearedReaction 等 | cassiusShan.ts 在 OPS 尾端以 `...cassiusShanOperations(...)` 覆蓋既有 `clear_turn`：只看 side==='self'，否則一律 targetSide，丟掉 both／auto 與日誌。刪覆寫後兩項單獨轉綠 | 綠 |
| 1+2 合計 | 20 | 另外 collectionOperations、maxHpChange、astralContainerContract、stageGuardMigration、dormantBladeMigration、electricTraitMigration、typeDamageFloor、checkedDrain、destinyLegacyFixes.ui、destinyWheelB.ui、migrate_5009_jjgc、migrate_5000_puni_soul | 兩項修正同時套用後轉綠（歸因為合併驗證，未逐項拆分） | 綠 |
| 3 本次同步造成：全域山神守護定義 | 1 | migrationStageSkill（999840 !== 999740） | statusRegistry 把山神守護由「攻擊傷害-80%」改為「技能傷害降至1/10＋累計2次解除」；還原此檔即轉綠。官方文字是1/10，故是測試與 ElfEditor.tsx:294 的舊「80%」說明過期，但等於改動所有持有山神守護的精靈 | 綠 |
| 4 本次同步造成：產生檔未重產 | 2 | audit_block_coverage --check、audit_effect_implementation --check | 新增 ops／kit 後 `docs/audits/積木解析與執行統計.json/.md`、效果核對 JSON 過期（`npm run audit:blocks`、`npm run audit:implementation`） | 綠 |
| 5 本次同步造成：defaultElves 新增 5041 | 1 | blockPresetWorkflow（第94行 source:'skill' vs 'soulmark'） | 只換入 PC 版 defaultElves 即紅；5041 技能句型來源與預期不一致 | 綠 |
| 6 基準本來就紅 | 8 | bossTraits、portableSkillMarks、descriptionStructure、skillTypePresentation、migrate_5025_fear_soul、readerGapClosure、rosterIdentity.ui、check_migration_release.mjs | 在 7de1f47e 也紅，與卡修斯無關（成因未查，疑為 Linux 環境或舊債） | 紅 |
| 7 環境限制 | 5 | launcherWindow.ps1（PowerShell）、petAnimation／petBattle .browser（瀏覽器）、electronServerPackaging、buildWorkspace | Linux 雲端無 powershell／瀏覽器／Electron 打包環境，未重跑單獨驗證 | 未驗 |

（20＋1＋2＋1＋8＋5 = 37。）

另：PC 的 `battleSpriteFacing.semantic.test.ts` 目前綠，但綠的原因是規則被繞過（front→left），見 §7。

## 4. 逐句驗收（官方文字 vs 實作）

標記：✅ 正確／⚠ 近似或語意改變、尚無證據／❌ 未實作或不會觸發。證據來自 `tests/_probe/*`（未提交）以真實 kit 跑 createBattleEngine。

| # | 區 | 官方句 | 結果 | 證據／說明 |
|---|---|---|---|---|
| 1 | 魂印 | 位於出戰背包時：自身與己方其他精靈護盾因攻擊傷害扣減時減少量減半 | ❌ | 探針E：後備有/無卡修斯，護盾吸收量同為142，減半未生效 |
| 2 | 魂印 | 超額非真實傷害＞當前護盾：對手無法造成本次傷害 | ✅ | 探針G：固傷2000＞盾300，被抵消 |
| 3 | 魂印 | 戰鬥階段結束消耗當前護盾50%，恢復在場精靈消耗量25%體力 | ✅ | 探針G：盾300→150，回復37（150×25%取整） |
| 4 | 魂印 | 超額真實傷害＞護盾且致死：100%重生1次 | ✅ | 探針F：致死真傷後重生，hp回滿 |
| 5 | 魂印 | 山神守護時：異常無法被轉化為控制類、弱化類 | ⚠ | 實作為「常駐」且只列8個狀態（麻痺、石化、害怕、睡眠、冰封、疲憊、癱瘓、沉默）；非條件式、弱化類未涵蓋（statusRegistry 控制類16項／弱化類20餘項） |
| 6 | 魂印 | 取消控制類與弱化類原有效果 | ⚠ | 只有 isElfActionDisabled 對『控制類無法行動』放行（旗標 suppressControlWeakeningWhileMountainGuard）；弱化類原效果（減傷、降能力等）無處理 |
| 7 | 魂印 | 改為1回合內選擇使用技能不受PP限制；技能後令對手1回合技能附加效果失效 | ❌ | 探針cas4：有／無守護 PP 消耗與對手附加效果無差異；ops 內 doubleBelowHalf 等狀態無讀取端 |
| 8 | 魂印 | 回合開始：本次在場累計回合數≤1 → 召喚額外精靈炫彩山神加入己方 | ⚠ | 召喚成功（cond field_rounds 讀 turnsInBattle）；但能力值算法與id錯誤，見額外精靈段 |
| 9 | 魂印 | （重複段）山神守護時異常無法被轉化 | ⚠ | 同上，與第5句同一實作 |
| 10 | 魂印 | 取消控制／弱化類附加效果 | ⚠ | 同第6句 |
| 11 | 魂印 | 改為1回合選擇技能不受當前PP值限制 | ❌ | 同第7句，無讀取端 |
| 12 | 魂印 | 自身護盾每次消失：炫彩山神死亡以清除本次在場累計回合數 | ❌ | 探針cas1：卡修斯護盾1400仍在，回合結束即觸發『護盾消失、山神退場』誤殺山神（cond field_shield absent 判定錯誤）；累計回合數清除亦無讀取證據 |
| 13 | 魂印 | 攻擊技能：忽略對手防禦40% | ✅ | 日誌『忽略對手雙防40%』，探針cas5/6 |
| 14 | 魂印 | 雙方任一方有護盾：額外令對手先制-2且100%石化 | ⚠ | 石化有生效（有盾時；對照組無盾無石化）；先制-2無日誌／無出手順序證據 |
| 15 | 魂印 | 屬性技能：使用後無效對手下次攻擊技能 | ✅ | 日誌『對手下1次攻擊技能無效』，普攻被擋 |
| 16 | 魂印 | 雙方任一方有護盾：自身使用技能不消耗PP | ⚠ | 未能在探針取得獨立證據（PP欄位被屬性技能與守護混雜） |
| 17 | 魂印 | 技能使用時額外吸取雙方護盾值70%體力 | ⚠ | drain_shield_ratio 有登錄，探針未驗得實際回血量 |
| 18 | 額外精靈 | 普通系、字母 id | ❌ | type=普通 ✅；id 為 extra_炫彩山神_<時間>_<亂數>：createExtraElf 在 spread 後以 uniqueId 覆蓋 overrides.id，brinkk.ts 傳的 id:'shancaishen' 被吃掉 |
| 19 | 額外精靈 | 能力值等同敵我雙方岳峙淵渟.卡修斯中能力最高者 | ❌ | summon_extra_elf statFromTeamRatio:1 statSource:'team'：把『整隊』能力加總（探針：體力4000＋友3000＝7000、攻擊700），非『卡修斯最高者』，且不含對手 |
| 20 | 額外精靈 | 己方卡修斯以外其他精靈登場後死亡 | ❌ | ally_entered→self_destroy 已寫，探針cas9：友登場後 山神 hp 7000/7000 持續存活 |
| 21 | 額外精靈 | 被加入：解除自身異常 | ⚠ | 寫在卡修斯 round_start 內聯；額外精靈自己的 on_entered 無獨立執行證據 |
| 22 | 額外精靈 | 被加入：為卡修斯附加最大體力½護盾 | ⚠ | 同上（內聯；shield 值正確） |
| 23 | 額外精靈 | 被加入：為卡修斯附加3回合山神守護 | ✅ | 日誌『陷入了山神守護』，狀態回合數正確 |
| 24 | 額外精靈 | 死亡：消除對手在場精靈回合類效果 | ⚠ | clear_turn 被 cassiusShan 覆寫（只看 side==='self' 否則 targetSide，丟掉 both／auto）；且觸發時機本身會誤殺（見魂印第12句） |
| 25 | 額外精靈 | 死亡：消除對手能力提升 | ⚠ | 隨死亡鏈執行，但誤觸發 |
| 26 | 額外精靈 | 死亡：令對手所有技能PP歸0 | ✅ | 探針cas1：對手 pp=0/0（但因誤殺而過早發生） |
| 27 | 山神守護 | 受到技能傷害降至原始傷害1/10 | ⚠ | damageReduction 有定義；探針cas5 T3 有守護時單次傷害未明顯降至1/10（樣本小，待單測） |
| 28 | 山神守護 | 累計受到2次技能傷害時解除 | ⚠ | STATUS_HIT_RELEASE 計數在無守護時也累加（hitCount 1,2,3），第3次之後才解除，疑似多算一次 |
| 29 | 萬壑崩摧 | 必中、先制+1 | ✅ | desc 與 priority 相符 |
| 30 | 萬壑崩摧 | 5回合每回合結束：解除自身能力下降並附加給對手 | ❌ | timed_status_transfer_down 內部 op stat_transfer_down 在 OPS 中不存在（ops 探針 MISSING）；探針中自身 atk-2 全程不變 |
| 31 | 萬壑崩摧 | 消除雙方護盾護罩並吸取消除量等量體力；消除量＞400則本場體力上限+100 | ✅ | 日誌『消除量500超過400，體力上限+100』 |
| 32 | 萬壑崩摧 | 5回合內使用技能後吸取對手300體力；低於½翻倍 | ✅ | 對手每回合-301（吸取300＋普攻），自身回血 |
| 33 | 萬壑崩摧 | 吸取後體力未減少：附加300真傷且下2回合對手無法恢復體力 | ⚠ | 嵌套 op no_heal_turns 為 MISSING，無法恢復部分疑似不執行；300真傷未驗 |
| 34 | 萬壑崩摧 | 令對手所有技能PP-1；對手當回合所選技能PP為0則無法行動 | ✅ | 日誌『所選技能PP為0，無法行動』 |
| 35 | 群山許諾 | 必中；攻擊、防禦、特防、速度、命中+1 | ✅ | 日誌正確 |
| 36 | 群山許諾 | 自身附加3回合山神守護 | ✅ | 日誌正確 |
| 37 | 群山許諾 | 擁有山神守護時改為『守護回合結束時其他異常同時解除』 | ⚠ | 未見分支切換證據 |
| 38 | 群山許諾 | 5回合內使用技能吸取最大體力⅓，低於½翻倍；未減少→300真傷＋300護罩 | ⚠ | 吸取有登錄；嵌套 barrier op MISSING，300護罩疑似不執行 |
| 39 | 群山許諾 | 3回合內對手用攻擊技能→下2回合屬性技能附加效果失效 | ✅ | 日誌『2回合內對手屬性技能無效』 |
| 40 | 群山許諾 | 附加400護盾；消失時400真傷＋100%令雙方依序進入束縛、星贖3回合（最後一句） | ⚠ | 文字（cassiusShanText.json）與官方一致；探針未出現破盾事件，無法確認真的執行；timed_shield_break_reaction 登錄 OK |
| 41 | 歸塵 | 威力90、先制+3、必中 | ✅ | desc eq；日誌正常 |
| 42 | 歸塵 | 無視對手免疫受到的攻擊效果；成功則下次攻擊亦無視 | ⚠ | 日誌『下次攻擊技能無視攻擊免疫』；ignore_next 僅支援『攻擊免疫』一種，其他免疫不吃 |
| 43 | 歸塵 | 消除對手回合類；成功→100%疲憊；未觸發→下次受到攻擊傷害轉為自身體力 | ❌ | 探針B：無疲憊；damageToHealNext 全專案無讀取端；clear_turn 被覆寫 |
| 44 | 歸塵 | 吸取對手最大體力40%，每次使用+5%，上限60% | ❌ | 日誌顯示40/45/50%，但對手 hp 只減普通傷害（-94），未見吸取；escalating_drain 只寫日誌 |
| 45 | 歸塵 | 3回合內對手使用攻擊技能時100%石化 | ⚠ | 石化出現但來源與魂印句重疊，無法分離 |
| 46 | 破影 | 威力90、先制+3、必中 | ✅ | desc eq |
| 47 | 破影 | 無視對手攻擊傷害限制；成功則下次攻擊亦無視 | ⚠ | ignore 『傷害限制』→blkIgnoreLimit 有讀取端（battleEngine:3505）；『下次』只支援攻擊免疫 |
| 48 | 破影 | 3回合內令對手防禦、特防-1；未觸發→下2回合對手受技能傷害提升150% | ⚠ | 防禦、特防-1 逐回合疊加 ✅；dmg_taken_boost 分支未驗 |
| 49 | 破影 | 先出手則對手當回合攻擊技能無效 | ✅ | 日誌『1回合內對手攻擊技能無效』 |
| 50 | 破影 | 4回合內使用技能吸取對手最大體力¼ | ✅ | 對手 hp 每回合-25% |
| 51 | 炫彩.山殞垣頹 | 威力160、先制0、必中 | ✅ | desc eq |
| 52 | 炫彩.山殞垣頹 | 傷害不出現微弱（微弱改普通） | ⚠ | 文字改寫為『克制關係為微弱時都變成普通』≠官方『微弱改普通』；no_weak_damage 讀取端存在（noResistedThisAction）但未驗 |
| 53 | 炫彩.山殞垣頹 | 消除對手能力提升；成功→進入山神守護，已處於→恢復最大體力⅓ | ✅ | 探針D：山神守護:2 出現 |
| 54 | 炫彩.山殞垣頹 | 己方其他精靈下次登場時免疫下次受到的異常 | ❌ | teamNextEntryStatusImmuneCount 只寫入、全專案無讀取端 |
| 55 | 炫彩.山殞垣頹 | 吸取對手最大體力50%並附加等量護盾 | ✅ | 探針D：護盾45e9＝90e9×50% |
| 56 | 炫彩.山殞垣頹 | 之後下次己方精靈護盾消失→對手下回合無法主動切換 | ❌ | cassiusShieldBreakNoSwitchTurns 無讀取端 |
| 57 | 炫彩.山殞垣頹 | 自身擁有護盾時技能威力翻倍 | ✅ | power_multiplier 有讀取端（powerMultiplierThisAction） |

合計：✅ 22／⚠ 23／❌ 12。

## 5. 最嚴重 10 項

1. 【共用迴歸】sequenceContract 刪除未知參數攔截（全域放寬合約），讓 6 個既有測試轉紅（skillStonesSplit、markProgram、typeViewMigration、blockRecoveryMigration、damageImmunityQuery、instantKillBlocks）。
1b. 【共用迴歸】`clear_turn` 被 cassiusShan.ts 覆寫，用 `side:'both'`／auto 的既有精靈（幽魔鏈等）行為改變；migrationClosure、migrationClearedReaction 紅。
2. 【確定錯誤】炫彩山神在卡修斯護盾仍在時被誤殺（`shield_break_mountain_god_death` 的 `field_shield absent` 判定錯），隨即清空對手回合類、增益與 PP，整個召喚機制失去意義。
3. 炫彩山神永不因「己方其他精靈登場」死亡（`self_destroy` 已寫但探針中山神持續存活）。
4. 炫彩山神能力值算成「整隊加總」，非「敵我雙方卡修斯最高者」；體力、攻擊皆過高（7000／700 vs 預期 4000／400）。
5. 額外精靈 id 非字母：`createExtraElf` 在 spread 後以 `id: uniqueId` 覆蓋 overrides.id，傳入 `id:'shancaishen'` 無效；且 brinkk.ts 同時依賴此 id 做 EXTRA_ELF_KITS 對應，只靠名稱。
6. 歸塵「吸取40%每次+5%」只寫日誌不吸血（escalating_drain），整招核心效果失效；另「下次受到攻擊傷害轉體力」無讀取端。
7. 萬壑崩摧「每回合結束解除自身能力下降並附加對手」：內部 `stat_transfer_down` 不存在於 OPS；嵌套 `no_heal_turns`、`barrier`、`dmg_if_no_hp_loss` 同樣 MISSING，群山許諾的300護罩與萬壑的無法恢復疑似不執行。
8. 魂印第一句（背包內護盾扣減減半）完全沒生效；「山神守護時改為不受PP限制＋附加效果失效」無讀取端。
9. 山神守護：status_conversion_ban 只列8個狀態且為常駐（非山神守護條件）；2次技能傷害解除疑似多算一次（計數在無守護時也累加）。
10. 朝向：3568／798 以「已目視為正面」的證據卻登記 left，並把動畫登記 `facing:'left',facingVerified:true` 而無實際核對紀錄；為了讓測試轉綠而改 front→left，違反 AGENTS.md「證據不符不得登記」。

## 6. 共用改動影響

| 改動 | 影響 | 驗證 |
|---|---|---|
| `runtime.ts` 尾端 `...cassiusShanOperations` | 同名 `clear_turn` 覆寫既有實作（見上）。其餘20個 op 名稱無重名。`runtime.ts` 還有一處縮排／換行合併（`ok;    return ok;`），語意不變。 | 只換 runtime.ts＋新檔即重現 migrationClosure 紅 |
| `sequenceContract.ts` 刪除 `paramsIssue` 中「`尚無已核對的參數合約`」未知參數攔截 | 全域放寬：任何 op 帶未登記參數都不再被擋，等於關掉合約防呆；是為了讓卡修斯 kit 的未登記參數通過。 | 還原該行後 6 個紅測轉綠（§3.1 第5–10項） |
| `kitValidation.ts` pp_op 欄位增加 | 影響所有使用 pp_op 的精靈；只加欄位，無破壞。 | newElves、wuweiTimedSkills 綠 |
| `ELF_TRAIT_FLAGS`／`types.ts`／`battleHelpers.isElfActionDisabled` | 新旗標 suppressControlWeakeningWhileMountainGuard 只對帶旗標精靈生效；`thunderGod.ts:49` 同步加旗標名。 | 綠 |
| `brinkk.ts`：summon_extra_elf ＋ EXTRA_ELF_KITS.set('炫彩山神') | 召喚能力值加總整隊；id 被覆蓋。對既有 summon_extra_elf 使用者（斯嘉麗、克薩等）未改預設。 | finalExtraTraits 綠 |
| 全域 `山神守護` 定義（statusRegistry＋damageReduction＋battleEngine STATUS_HIT_RELEASE） | 原為「攻擊傷害-80%」，改為「技能傷害降至1/10＋累計2次解除」；所有持有山神守護的精靈同受影響，ElfEditor.tsx:294 說明仍寫80%；計數問題見 §4 第27–28項。 | **migrationStageSkill 紅**（§3.1 第3組）；damageReduction*、hamo* 綠 |
| `Arena14 無極` 魂印：stat_reverse → flag_set（oppBoostAsDropThisAction 等） | 行為改變；與卡修斯無關，屬夾帶改動。 | wujiResources／wujiDili 綠 |
| `wuxu-shiyan/registry.ts` ＋45行、`damageCalculator` 2行、`contextBuilders` ＋27行 | 蝕言特防減傷夾帶改動；與卡修斯無關。 | wuxuCarrierSide、wuxuPpMigration、hamoShiyan 綠 |
| `defaultElves.ts` 新增 5041 | 使 blockPresetWorkflow 紅（§3.1）；ELF_TEXT 描述與魂印文字與官方一致（572字）。ID 5041 唯一，等級／種族值（850：204/160/145/60/145/136）與官方一致。 | 探針cas8 |

## 7. 素材、朝向、皮膚、動畫

讀取依據：AGENTS.md「立繪朝向固定基準」「皮膚與備用立繪驗收補充」、tests/battleSpriteFacing.semantic.test.ts（225–264 行）、seerAssets.ts（66、156–160、182–185 行）、elfSkins.ts、petAnimationAssets.ts（21–22 行）。

- 現況：`SEER_ID_OVERRIDES["岳峙淵渟.卡修斯"]=3568`；`BATTLE_SPRITE_FACING[卡修斯]="left"`；`BODY_SOURCE_FACING["/seer/body/3568.png"|"798.png"]="left"`；動畫 cassiusShandi／cassiusOriginal 皆 `facing:'left',facingVerified:true`；皮膚 cassius-shandi（3568）／cassius-original（798）。
- (a) 實際朝向（已目視 public/seer/body）：3568 近乎正面（身體對稱、臉朝觀眾，僅微偏左，尾巴在右後）；798 為左偏3/4（臉與身體朝畫面左，尾巴在右）。兩者並非明確的「朝左」；3568 應屬 front，798 可登記 left。
- (b) 前人違規：seerAssets.ts 在同一處同時留下兩組互相矛盾的註解——「原圖朝左，P1 鏡射」與「為正面（已目視核對 3568／798），不需鏡射」，再加第三組「原圖為正面，但專案規則不允許 /seer/body 內建素材標 front；以 left 登記」。也就是明知是正面，為通過 `battleSpriteFacing` 測試（禁止 /seer/body 標 front）改填 left；結果 3568 在 P1 會被鏡射成朝左（錯），P2 反而不鏡射（錯）。這是用不實證據通過測試，屬違規。
- (c) 正確作法：不要造假。3568 若確為正面，就要修規則而非資料：在 `STATIC_FRONT_EVIDENCE` 登記 `/seer/body/3568.png` 的視覺證據並放寬測試對 /seer/body 的 front 禁令（需使用者決定）；或若判為斜面朝左則照 left 並更新註解。798 登記 left（P1翻、P2不翻，使 P1 朝右、P2 朝左）。動畫朝向需讀 `3568.pet`／`798.pet` 實際播放畫面分別登記，不繼承靜態圖；動畫尺寸（battleScale）不得小於靜態圖（3568 atlas 4096×2048，靜態 1456×1104；798 atlas 2048×2048，靜態 396×663）——目前兩筆都沒設 battleScale，是否小於靜態需實機量測，本次無法量。
- (d) 原版皮膚（798）為何沒載入：程式路徑看不出缺口——`petAnimationBinding` 有 skinId 時走 `skin.animationAssetId`，cassius-original → cassiusOriginal 已登記，bundle 大小與登錄相符（504,034）。未能證實根因。可疑點（待查，未證實）：①選了皮膚後 elf.skinId 是否寫入對戰用的 elf 副本；②skin 的 `body` 靜態圖 798.png（396×663）遠小於 3568.png，靜態 fallback 看起來像沒換；③伺服端對 798 bundle 的取得／sha256（`.seer-cache` 檔案在，但 PC 目前跑的是否為此版本不明）。
- (e) 動畫登記完整度：petAnimationAssets 兩筆含 hash／size／sha256／atlas／fps；sequences、facing 的可播放性未能驗證（未 stage bundle，這是任務限制）；因 facingVerified 為 true 但無核對紀錄，視為「待重驗」，不能宣稱通過。

## 8. 修正清單（可平行分組）

**A 卡修斯本體與技能**
1. 歸塵 escalating_drain 實際吸血；damageToHealNext 加讀取端。
2. 魂印第1句（背包內護盾減半）接上傷害管線讀取。
3. 魂印「山神守護時PP不受限＋對手附加效果失效」補讀取端（doubleBelowHalf 同）。
4. 補齊 OPS 缺漏的嵌套 op：stat_transfer_down、no_heal_turns、barrier、dmg_if_no_hp_loss。
5. 炫彩.山殞垣頹 文字改回官方「微弱改普通」；補 team_next_entry_status_immune、shield_break_no_switch 讀取端。
6. 魂印先制-2、不消耗PP、70%吸取補單測。

**B 額外精靈通用事件入口與炫彩山神**
1. createExtraElf 尊重 overrides.id（字母 id）；EXTRA_ELF_KITS 以 id 對應。
2. summon_extra_elf 能力值改為「敵我卡修斯最高者」（新增 statSource 如 'highest_of_name'）。
3. 修 `field_shield absent` 誤判與山神死亡時機；補額外精靈自己的 on_entered 實際執行與 ally_entered 自毀。
4. 內聯於卡修斯 round_start 的 cure／shield／山神守護與 on_entered 擇一，避免雙重。

**C 山神守護與狀態機制**
1. status_conversion_ban 改為條件式（山神守護中）且涵蓋控制類＋弱化類全清單。
2. STATUS_HIT_RELEASE 只在有該狀態時計數，並以單測鎖「累計2次」。
3. 取消控制／弱化「原有效果」補弱化類。

**D 立繪朝向、皮膚、動畫**
1. 還原 seerAssets 的矛盾註解；3568 依實況登記並補視覺證據（需決策是否放寬 /seer/body front 禁令）；798 登記 left。
2. 動畫朝向以播放畫面分別核對後登記，facingVerified 在核對前設 false。
3. 實機驗原版皮膚 798 載入路徑（skinId 寫入、bundle 取得）；量測動畫與靜態圖尺寸。

**E 建置與測試**
1. 刪除 PC `.desktop-releases/update.lock`（先確認無進程）；desktop_update.mjs 失敗路徑要確保 finally 解鎖。
2. 刪除 cassiusShan.ts 的 `clear_turn` 覆寫，改用既有 OPS。
3. 還原 sequenceContract 的未知參數攔截（已驗證可使 6 測轉綠），改為登記卡修斯需要的參數。
4. `npm run audit:blocks`、`npm run audit:implementation` 重產統計；修 blockPresetWorkflow（5041 句型來源）；migrationStageSkill 的80%期望與 ElfEditor.tsx:294 說明改成1/10。
5. 剝離夾帶改動（Arena14 無極、蝕言）另案審查。

## 9. 限制

- 檔案大小比對：tests／scripts 以 mtime 抽樣，未全量 stage。
- 動畫朝向、動畫尺寸未視覺驗證（依指示未 stage bundle）。
- 原版皮膚未載入的根因未證實。
- 山神守護1/10與2次解除僅小樣本探針；`invalid_turns` 在卡修斯 kit 內無 side 參數，探針中目標為對手，與預期相符，未能確認是否為前人刪改。
- 組6（基準本就紅）8項與組7環境5項成因未深查。

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NpxLMqfDTA2UuvyD3VUCyT

## D 組複核（2026-11-01）：卡修斯立繪朝向／皮膚／動畫

- 靜態：3568 近正面但頭冠面甲略朝畫面左、前腳跨向左、尾巴在右後，且與原生動畫互為鏡像 → 登記 left（微偏，不是 front，沒有 front 證據）；798 左偏 3/4 → left。移除先前矛盾註解。`/seer/body 禁 front` 測試維持原樣。
- 動畫：以正式 PetActionSprite 在 Chromium（WebGL）播放電腦端 `.seer-cache/pet-anim` 的 3568／798 bundle（sha256 與登記相符；另需 materials bundle b9a969aa…），P1／P2 逐側截圖；兩款原生動畫皆朝畫面右（尾巴／火焰翼在左後、前腳向右）→ `facing:'right'`、`facingVerified:true`。待機影格實際推進。
- 尺寸：待機框高度 486.0 = 靜態可見高度 486.1（3568）／493.5 對 486.0 以 sizeRefHeight 對齊（798，戰鬥畫面內為 493.5＝靜態）；未設 battleScale，動態不小於靜態（寬度因網格略窄 1–2%）。
- 798 載入：靜態／動畫路徑實測可載入；唯一會丟失皮膚的缺口是圖紙匯入白名單缺 `skinId`（已補）；另動畫朝向原誤登 left，P2 會背對對手（已修）。
- 驗收頁：`tests/fixtures/cassiusBattlePreview.*`（正式 BattleScreen）、`cassiusAnimPreview.*`（單隻動畫）；測試：`tests/cassiusSkins.ui.test.tsx`。

## 整合複核（cas-int，2026-11-01）：A／B／D 合併後各項狀態

整合分支 cas-int 由 d8c9a592 起合併 cas-A、cas-B、cas-D 並接線。以下只列原稿標 ⚠／❌ 的句，狀態以合併後的真實引擎測試（`npm run test:cassius` 102 項、`npm run test:cassius-extra`，P1／P2 皆驗）為證；「—」表示原稿該列已是 ✅。

| 原列 | 內容 | 狀態 | 證據／原因 |
|---|---|---|---|
| 1 | 背包卡修斯：護盾扣減量減半 | ✅ | cassiusShan：後備有／無卡修斯對照，減半只對攻擊傷害 |
| 5、9 | 山神守護：異常不可轉化為控制／弱化類 | ✅ | 改用狀態分類（CONTROL／WEAKENING）而非寫死名單；石化到期不轉凍傷，對照無守護則轉化 |
| 6、10 | 取消控制／弱化類原效果 | ⚠ | 控制類原效果取消（照常行動）已有測試；弱化類各別原效果（減傷、降能力等）未逐項測，僅由分類規則涵蓋 |
| 7、11 | 改為1回合內選技不受PP限制＋技能後令對手附加效果失效 | ✅ | statusRules／replacement_invalidate_opp，對照無控制異常時 PP0 技能不可用 |
| 8 | 回合開始召喚炫彩山神 | ✅ | 召喚子句改用 B 的參數（id x_shancaishen、statSource highest_of_name）；無內聯重複效果；背包卡修斯不召喚（新增測試，P1／P2），換上後才召喚 |
| 12 | 護盾每次消失：山神死亡並清除在場回合數 | ✅ | 魂印子句改為 shield_lost_watch → kill_owned_extra{x_shancaishen, ownerShield:'gone', resetOwnerRounds:true}。新增測試（P1／P2）：護盾僅被扣減不誤殺；清盾後死亡一次並觸發死亡效果；下回合再召喚；第二次護盾消失再死亡一次（每次消失各一次） |
| 14 | 有護盾：對手先制-2且100%石化 | ✅ | 出手順序與石化皆有對照測試 |
| 16、17 | 有護盾：不消耗PP；吸取雙方護盾70% | ✅ | PP 5／4 對照；吸取量 (100+300)×70%=280 |
| 18 | 額外精靈普通系、字母 id | ✅ | id x_shancaishen（docs/rules/額外精靈id標準.md），createExtraElf 尊重明確 id |
| 19 | 能力值等同敵我卡修斯中最高者 | ✅ | highest_of_name，預設 statMode:total（整隻照抄總和最高者），另提供 each。⚠ 規格歧義見下 |
| 20 | 己方卡修斯以外其他精靈登場後死亡 | ✅ | ally_entered＋entered_not_owner＋extra_die，同隊另一隻卡修斯登場不死、其他精靈登場才死 |
| 21、22、23 | 被加入：解除異常／½護盾／3回合山神守護 | ✅ | 由山神自己的 on_entered Kit 執行（extra_cure_self／extra_owner_shield／extra_owner_status），卡修斯子句不再內聯 |
| 24、25 | 死亡：消除對手回合類／能力提升／PP歸0 | ✅ | 不再誤殺；cassiusShan.ts 已無覆寫 clear_turn。見下「技能無效計時」說明 |
| 27、28 | 山神守護 1/10 與累計2次解除 | ✅ | 無守護時不計數；上守護後第1、2次約1/10，第3次全額 |
| 30、33、38、40 | 萬壑崩摧／群山許諾 巢狀 op | ✅ | stat_transfer_down、no_heal、barrier_add 等已補齊並有數值測試 |
| 37 | 群山許諾：已有守護→守護結束時解除其他異常 | ✅ | 分支切換有對照 |
| 42、47 | 歸塵／破影 無視免疫／傷害限制，成功則下次亦無視 | ✅ | ignore_next 支援傷害限制，成功／未成功皆有測試 |
| 43、44 | 歸塵 疲憊／轉傷為自身回復、吸取40%+5%遞增 | ✅ | 實際扣血與回復有測試 |
| 45、48 | 歸塵石化視窗、破影防特-1／受傷×2.5 | ✅ | 對照測試 |
| 52 | 山殞垣頹：不出現微弱 | ⚠ | 行為已測（微弱改普通）；技能文字為「攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）」，與官方原文逐字是否一致需使用者對照確認 |
| 54、56 | 山殞垣頹：下次登場免疫異常、護盾消失後對手無法切換 | ✅ | 已有讀取端與測試 |

### 本次整合處理的 B 組備註

- 背包卡修斯誤召喚：在真實引擎重現（P1／P2，前鋒回合數=1 的回合開始、換前鋒二後），背包卡修斯並未召喚，回合開始廣播不會把在場者的計數交給背包持有者，故不需改共用條件；已加回歸測試鎖住此行為。
- 「技能無效」計時不被 clear_turn 清除：該計時來自魂印「使用技能後無效對手下次攻擊技能」，是「下 N 次」次數類（kind=use_counter），依 timers.ts 的定義不屬回合類，不應被「消除回合類效果」清除；回合類的技能無效（`invalid_turns`／next）則會被清除。屬正確行為，不修；新增測試鎖定兩者（P1／P2）。
- B 組 kill_owned_extra 經 runtime 靜態引入 battle/extraElfKit 造成 `audit:bundle` 打包區塊循環（ai-block-runtime ↔ effectRunner），改由 ctx.killExtraElf 注入後解除。
- 移除過時 op：shield_owner_ratio、status_owner、self_destroy、clear_field_rounds（皆無 Kit 引用；shield_break_mountain_god_death 已不存在）。

### 基準紅燈處理摘要

見提交訊息與回報：portableSkillMarks（ᚱᚷ 標記槽 0PP 無法選招；死亡剝離符文早於 ON_KILL）、descriptionStructure 與 skillTypePresentation（測試對象搬移，斷言語意不變）已修；migrate_5025_fear_soul、readerGapClosure、rosterIdentity.ui、petAnimationRetarget、bossTraits 仍紅，原因見回報。

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NpxLMqfDTA2UuvyD3VUCyT
