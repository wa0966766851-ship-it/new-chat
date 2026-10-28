# BOSS 特性圖示對應（bosseffect）

## 資料來源

- 圖示：`https://raw.githubusercontent.com/SeerAPI/seer-unity-assets/main/newseer/assets/art/ui/assets/battleeffect/bosseffect/<iconId>.png`（30 張，本機 `public/seerapi/bosseffect/`）
- 對照依據：**官方 F 端 `bossEffectIcon_767ccada.json`**（86 筆條目、29 個 iconId），其 `tips` 欄位直接寫特性名

## 統計

共 37 條：existing 1／guess 12／none 9／sure 15

- **確定（sure）**：與官方 `bossEffectIcon` 的 `tips` 一對一相符
- **推測（guess）**：官方無同名條目，依圖形語意推斷
- **無圖（none）**：官方 `bossEffectIcon` 無此特性，改用文字徽記 SVG
- **既有（existing）**：神話沿用 `seer/abnormal/17.png`

## 對照表

| 特性 | 代號 | 分類 | 圖示 | 信心 | 備註 |
|---|---|---|---|---|---|
| 神話 | myth | 基本 | seer/abnormal/17.png | existing |  |
| 迅捷 | swift | 先制 | bosseffect/1.png | guess | 依圖形語意推測 |
| 疾行 | rush | 先制 | bosseffect/2.png | guess | 依圖形語意推測 |
| 增傷 | amp | 增傷 | 徽記「增」 | none | 官方無此特性 |
| 減傷 | guard | 增傷 | bosseffect/28.png | guess | 依圖形語意推測 |
| 要害探尋 | weakpoint | 增傷 | bosseffect/10.png | sure | 官方 tips 直接對應 |
| 致盲 | blind | 閃避 | bosseffect/12.png | sure | 官方 tips 直接對應 |
| 封魔 | sealmagic | 免疫 | bosseffect/15.png | guess | 依圖形語意推測 |
| 格擋 | block | 免疫 | bosseffect/5.png | guess | 依圖形語意推測 |
| 技能無效 | nullify | 免疫 | bosseffect/27.png | guess | 依圖形語意推測 |
| 戒備 | vigilance | 免疫 | bosseffect/8.png | sure | 官方 tips 直接對應 |
| 消除回合 | clearturn | 免疫 | 徽記「斷回」 | none | 官方無此特性 |
| 堅毅 | fortitude | 免疫 | bosseffect/20.png | sure | 官方 tips 直接對應 |
| 免傷 | immune | 免疫 | bosseffect/25.png | sure | 官方 tips 直接對應 |
| 反傷 | thorns | 免疫 | bosseffect/26.png | sure | 官方 tips 直接對應 |
| 進化 | evolve | 強化弱化 | bosseffect/3.png | guess | 依圖形語意推測 |
| 腐化 | corrupt | 強化弱化 | bosseffect/4.png | sure | 官方 tips 直接對應 |
| 強化 | empower | 強化弱化 | 徽記「強」 | none | 官方無此特性 |
| 弱化 | weaken | 強化弱化 | 徽記「弱化」 | none | 官方無此特性 |
| 驅散 | dispel | 強化弱化 | bosseffect/11.png | sure | 官方 tips 直接對應 |
| 消除強化 | devour | 強化弱化 | 徽記「奪強」 | none | 官方無此特性 |
| 嫉妒 | envy | 強化弱化 | bosseffect/19.png | guess | 依圖形語意推測 |
| 貪婪 | greed | 強化弱化 | bosseffect/23.png | sure | 官方 tips 直接對應 |
| 硬化 | harden | 暴擊 | bosseffect/7.png | sure | 官方 tips 直接對應 |
| 恢復 | recover | 暴擊 | bosseffect/6.png | guess | 依圖形語意推測 |
| 鎖定 | lock | 暴擊 | bosseffect/13.png | sure | 官方 tips 直接對應 |
| 秒殺 | instakill | 暴擊 | 徽記「殺」 | none | 官方無此特性 |
| 覺醒 | awaken | 暴擊 | bosseffect/22.png | guess | 依圖形語意推測 |
| 鋒銳 | sharp | 固傷回血 | bosseffect/16.png | guess | 依圖形語意推測 |
| 吸血 | vampire | 固傷回血 | 徽記「吸」 | none | 官方無此特性 |
| 生命汲取 | drain | 固傷回血 | bosseffect/17.png | sure | 官方 tips 直接對應 |
| 癒合 | mend | 固傷回血 | bosseffect/18.png | sure | 官方 tips 直接對應 |
| 暴食 | gluttony | 體力上限 | bosseffect/21.png | guess | 依圖形語意推測 |
| 減PP | reducepp | 控場 | 徽記「減PP」 | none | 官方無此特性 |
| 施加異常 | inflict | 控場 | 徽記「附」 | none | 官方無此特性 |
| 系別變化 | typeswap | 控場 | bosseffect/14.png | sure | 官方 tips 直接對應 |
| 復甦 | revive | 多命 | bosseffect/9.png | sure | 官方 tips 直接對應 |

## 已修正的錯誤配對（2026-10-29）

原本有 4 個 iconId 被重複使用，且多筆與官方不符：

| 特性 | 原本 | 官方正確 | 處理 |
|---|---|---|---|
| 要害探尋 | 29 | **10** | 已改 |
| 戒備 | 20 | **8** | 已改 |
| 堅毅 | 8 | **20** | 已改 |
| 腐化 | 11 | **4** | 已改 |
| 驅散 | 24 | **11** | 已改 |
| 貪婪 | 無圖 | **23** | 已改 |
| 硬化 | 25 | **7** | 已改 |
| 生命汲取 | 無圖 | **17** | 已改 |
| 免傷 | 26 | **25** | 已改 |
| 反傷 | 7 | **26** | 已改 |
| 增傷 | 0 | 官方 iconId 0 是「神話」 | 改文字徽記「增」 |
| 強化 | 4 | 與腐化衝突 | 改文字徽記「強」 |
| 吸血 | 10 | 與要害探尋衝突 | 改文字徽記「吸」 |
| 施加異常 | 17 | 與生命汲取衝突 | 改文字徽記「附」 |
| 秒殺 | 23 | 與貪婪衝突 | 改文字徽記「殺」 |
