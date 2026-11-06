# 帝辛第三輪來源

motion-source.png：內建 ImageGen exec-9bca78c3-ee99-4270-ae68-96f7f5180b9c.png，1254×1254，3×3。參考既有 v2 角色，要求朝左、完整冠冕劍尖與衣襬，不拆肢體。

前兩列六張為待機關鍵圖：頭髮與紫色衣帶延遲變化，劍、掌中日輪與站位保持穩定，背環不整圈旋轉。最後一列為中招／後仰／回復。prepare_drawn_motion_v3.mjs import.json --sheet-only 提取前兩列為 idle-clean-source.png。

import.json 保存來源視覺審查與對齊。角色沒有綠色設計，minGreenRegion:1 清除綠幕碎點；不要盲套其他角色。

重做：提取 idle sheet → experiment_idle_flow.mjs 本目錄/idle-clean-source.png --id emperor_dixin --draft 本目錄 --remove-green-islands → prepare_drawn_motion_v3.mjs 本目錄/import.json → build_pose_animation.mjs 草稿 → 肉眼審查 → publish_custom_animation.mjs。

idle-flow-review.json 只描述離線 APNG 草稿。正式素材以 public/elf-anim/emperor_dixin 與第三輪驗收報告為準。既有近戰斬擊、其他出招與戰鬥規則保留；不宣稱官方品質。
