# BOSS 特性圖示對應（bosseffect）

## 資料來源

- 圖示：原廠彩色圖 `public/seerapi/bosseffect-color/<iconId>.png`（百度百科 29 張，96×96）優先；沒有彩色的編號用藍白色 `public/seerapi/bosseffect/<iconId>.png`（官方 battleeffect/bosseffect，30 張，本專案不改動）。
- 原廠依據（2026-11-15 起）：**百度百科《BOSS特性》29 條**（iconId 0–28，`docs/data/seerapi/boss_traits_baike.csv`）。圖示編號與百度 iconId 同號。
- 沒有原廠條目的特性＝**擴展**，一律用文字徽記 SVG（`public/status-icons/boss-trait/<id>.svg`，佔位用，可日後換圖）。

## 統計

共 41 條：existing 1／sure 27／guess 0／none 13

- **sure**：與百度 iconId 一對一
- **none**：擴展特性，文字徽記
- **existing**：神話沿用 `seer/abnormal/17.png`（原廠 #0）

## 對照表

| 特性 | 代號 | 分類 | 圖示 | 信心 | 原廠對應 | 層數表 | 類型 |
|---|---|---|---|---|---|---|---|
| 神話 | myth | 基本 | seer/abnormal/17.png | existing | 原廠 #0「神話」 |  |  |
| 迅捷 | swift | 先制 | bosseffect/1.png | sure | 原廠 #1「迅捷」 | 1／2／3／6 |  |
| 疾行 | rush | 先制 | bosseffect/2.png | sure | 原廠 #2「疾行」 |  |  |
| 增傷 | amp | 增傷 | 徽記「增」 | none | 擴展（原廠百科未收錄） |  |  |
| 減傷 | guard | 增傷 | 徽記「減」 | none | 擴展（原廠百科未收錄） |  |  |
| 要害探尋 | weakpoint | 增傷 | bosseffect/10.png | sure | 原廠 #10「要害探尋」 | 5／15／20｜5／10 |  |
| 致盲 | blind | 閃避 | bosseffect/12.png | sure | 原廠 #12「致盲」 | 15／20／25／30／40／50／70／100 |  |
| 封魔 | sealmagic | 免疫 | bosseffect/15.png | sure | 原廠 #15「封魔」 |  |  |
| 格擋 | block | 免疫 | bosseffect/5.png | sure | A 型＝原廠 #5「物攻格擋」；B 型＝原廠 #6「特攻格擋」 |  | A＝物攻格擋；B＝特攻格擋（bosseffect/6.png）；AB＝物攻＋特攻格擋【擴展】 |
| 技能無效 | nullify | 免疫 | bosseffect/27.png | sure | C 型＝原廠 #27「後手無效」 |  | A＝技能無效（獅盔型）【擴展】；B＝先制無效（龍威型）【擴展】；C＝後手無效 |
| 戒備 | vigilance | 免疫 | bosseffect/8.png | sure | 原廠 #8「戒備」 |  |  |
| 先手免傷 | firstguard | 免疫 | bosseffect/28.png | sure | 原廠 #28「先手免傷」 |  |  |
| 消除回合 | clearturn | 免疫 | 徽記「斷回」 | none | 擴展（原廠百科未收錄） |  |  |
| 堅毅 | fortitude | 免疫 | bosseffect/20.png | sure | 原廠 #20「堅毅」 |  |  |
| 免傷 | immune | 免疫 | bosseffect/25.png | sure | 原廠 #25「免疫低於傷害」 | 200／300／400／500／1000／2000／3000／4000 | A＝免疫低於 X 點；B＝免疫大於 X 點 |
| 威力免傷 | powerguard | 免疫 | 徽記「威」 | none | 擴展（原廠百科未收錄） |  |  |
| 免疫反彈致命 | critreflect | 免疫 | bosseffect/26.png | sure | 原廠 #26「免疫反彈致命」 |  |  |
| 反傷 | thorns | 免疫 | 徽記「反」 | none | 擴展（原廠百科未收錄） |  |  |
| 進化 | evolve | 強化弱化 | bosseffect/3.png | sure | 原廠 #3「進化」 |  |  |
| 腐化 | corrupt | 強化弱化 | bosseffect/4.png | sure | 原廠 #4「腐化」 |  |  |
| 強化 | empower | 強化弱化 | 徽記「強」 | none | 擴展（原廠百科未收錄） |  |  |
| 弱化 | weaken | 強化弱化 | 徽記「弱化」 | none | 擴展（原廠百科未收錄） |  |  |
| 驅散 | dispel | 強化弱化 | bosseffect/11.png | sure | 原廠 #11「驅散」 |  |  |
| 消除強化 | devour | 強化弱化 | 徽記「奪強」 | none | 擴展（原廠百科未收錄） |  |  |
| 嫉妒 | envy | 強化弱化 | bosseffect/19.png | sure | 原廠 #19「嫉妒」 |  |  |
| 貪婪 | greed | 強化弱化 | bosseffect/23.png | sure | 原廠 #23「貪婪」 |  |  |
| 侵染 | infect | 強化弱化 | bosseffect/24.png | sure | 原廠 #24「侵染」 |  |  |
| 硬化 | harden | 暴擊 | bosseffect/7.png | sure | 原廠 #7「硬化」 |  |  |
| 恢復 | recover | 暴擊 | 徽記「復」 | none | 擴展（原廠百科未收錄） |  |  |
| 鎖定 | lock | 暴擊 | bosseffect/13.png | sure | 原廠 #13「鎖定」 | 2／4／8／16 |  |
| 秒殺 | instakill | 暴擊 | 徽記「殺」 | none | 擴展（原廠百科未收錄） |  |  |
| 覺醒 | awaken | 暴擊 | bosseffect/22.png | sure | 原廠 #22「覺醒」 |  |  |
| 鋒銳 | sharp | 固傷回血 | bosseffect/16.png | sure | 原廠 #16「鋒銳」 | 220／300／350／500 |  |
| 吸血 | vampire | 固傷回血 | 徽記「吸」 | none | 擴展（原廠百科未收錄） |  |  |
| 生命汲取 | drain | 固傷回血 | bosseffect/17.png | sure | 原廠 #17「生命汲取」 | 200／250／300／350／400／500／1000 |  |
| 癒合 | mend | 固傷回血 | bosseffect/18.png | sure | 原廠 #18「癒合」 | 10／4／2 | A＝比例恢復；B＝定點恢復 |
| 暴食 | gluttony | 體力上限 | bosseffect/21.png | sure | 原廠 #21「暴食」 |  |  |
| 減PP | reducepp | 控場 | 徽記「減PP」 | none | 擴展（原廠百科未收錄） |  |  |
| 施加異常 | inflict | 控場 | 徽記「附」 | none | 擴展（原廠百科未收錄） |  |  |
| 屬性反轉 | typeswap | 控場 | bosseffect/14.png | sure | 原廠 #14「屬性反轉」 |  |  |
| 復甦 | revive | 多命 | bosseffect/9.png | sure | 原廠 #9「復甦」 | 1／2／3／4 |  |

## 變體規則

- 有數值高低之別 → **層數**（層數＝層數表的第幾個值；不在表內的數值屬擴展）。
- 無數值高低之別 → **A／B 類型**；同一家族共用圖示，類型可另有專用圖（格擋 B 型＝6）。
