# 精靈專屬實裝

一般／家族模組列在modules.json，index.ts明確匯入；不能直接改成遞迴glob，避免備份或重複匯出也被執行。

常用位置：

| 精靈 | 實裝位置 | 資料來源 |
| --- | --- | --- |
| 5035 御天龍神·哈莫 | hamo/registry.ts | src/data/hamo.ts、elf_source_files/elf_files TXT |
| 5034 邪靈主宰·摩哥斯 | mogos/registry.ts | 新精靈資料及TXT |
| 5032／5033 艾斯菲亞／艾斯菲格 | astral-twins/registry.ts | 新精靈資料及TXT；共享幻化／記憶機制 |
| 5023 無序·蝕言 | wuxu-shiyan/registry.ts | 不再借六刃分支執行 |
| 無序六刃／墜星 | wuxu/registry.ts、stoneThrowerSoul.ts | 家族實裝與投石者魂印 |
| 帝辛 | dixin/registry.ts、formation.ts | 八荒／伏魔與天陣 |
| 競技場五隻 | staged-arena/index.ts與各專屬Registry | 明確註冊單元，不重複加入一般清單 |

其他完整位置見modules.json。只供單隻使用的函式放同目錄；跨精靈的傷害、PP、生命周期等仍放src/battle或effects共同層。描述拆解資料留src/data/elfProfiles，不能讓首頁為了讀描述而載入戰鬥handler。

新增精靈須同步更新modules.json與index.ts，先拆觸發／條件／目標／行為，再加後台語意斷言。搬移兼容快照不是新增技能的驗收依據；若正當新增註冊鍵，須人工確認並更新快照，不能為了讓測試過而自動重建。
