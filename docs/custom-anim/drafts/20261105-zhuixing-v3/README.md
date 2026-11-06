# 墜星第三輪來源

motion-source.png：內建 ImageGen exec-8569fa9a-36fc-4423-958b-42b77095935b.png，1254×1254、3×3，以 v2 原角色為參考。要求朝左、完整頭、砲口與腳，禁止切開關節。

前兩列六張待機關鍵圖，頭髮與紅束帶變化、砲身保持重量感、藍色核心小幅亮暗；最後一列中招／後仰抬砲／回復。用 prepare_drawn_motion_v3.mjs import.json --sheet-only 提取前兩列為 idle-clean-source.png。

import.json 保存來源審查、腳底與砲口對齊。角色沒有綠色設計，minGreenRegion:1 去除生成綠幕碎點；六刃綠色設計不能套此設定。

重做：提取 idle sheet → experiment_idle_flow.mjs 本目錄/idle-clean-source.png --id wuxu_zhuixing --draft 本目錄 --remove-green-islands → prepare_drawn_motion_v3.mjs 本目錄/import.json → build_pose_animation.mjs 草稿 → 肉眼審查 → publish_custom_animation.mjs。

idle-flow-review.json 是離線 APNG 草稿，不是 public 發佈狀態。保留 v2 向上開砲、對手位置自上而下轟炸與六段爆炸；沒有更改戰鬥傷害規則。正式驗收見第三輪報告，不宣稱官方品質。
