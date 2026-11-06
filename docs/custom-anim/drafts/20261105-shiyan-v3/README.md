# 蝕言第三輪來源

內建 ImageGen 以既有 v2 角色完整姿勢為參考，保留角色造型；不是 Seer 官方素材。

- idle-clean-source.png：exec-43bda99f-6336-48ad-a5a8-218be97eb986.png，1536×1024、3×2 六張完整待機關鍵圖。衣襬與頭髮右向延遲，幽影輕微形狀變化，不整圈旋轉。
- hit-source.png：exec-6c869af7-71a4-4440-86a6-c89e7d8196f2.png，2×2，待機／收書中招／後仰／回復。
- import.json：已看過來源的朝左、完整頭腳、書本與幽影；對齊尺寸與腳底。來源審查不等於官方品質。
- 本角色沒有綠色設計，minGreenRegion:1 去除零碎綠幕；此設定不可盲套六刃的綠色刀光。

重做：先執行 experiment_idle_flow.mjs，參數為本目錄 idle-clean-source.png、--id wuxu_shiyan、--draft 本目錄、--remove-green-islands；再執行 prepare_drawn_motion_v3.mjs 本目錄/import.json。最後以 build_pose_animation.mjs 建草稿，肉眼檢查後才 publish_custom_animation.mjs。

idle-flow-review.json 是離線 APNG 草稿記錄，不代表 public 最終圖集的發佈狀態。原本額外行動與出招仍沿用 v2。正式驗收與限制在第三輪報告。
