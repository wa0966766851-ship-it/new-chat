# 墜星待機修整草稿 v2

2026-11-05。僅草稿，未替換正式動畫，未更新桌面／網站。

## 已完成

- 後環從每兩秒旋轉一圈，改為保持原方向。
- 停止根節點漂移及腿部擺動。砲不再另行旋轉／平移，跟隨軀幹的微量呼吸。
- 兩側裝置只微量上下懸停，不再大角度搖擺；披風輕微延遲跟隨。
- 待機循環改為3秒，取消額外蓄力光暈，保留原稿本身的藍光。
- 製作器新增單片段、無光效、獨立預覽目錄，並記錄來源雜湊，避免混看新舊版本。

`standby.gif` 是這次產出的72幀、24 fps預覽。PNG是抽樣影格；`preview-source.json`記錄來源及設定。看過中間影格，主要頭部與輪廓完整；尚未以正式戰場的P1／P2慢放逐幀驗收接縫與大小。

確認來源圖：砲由雙手支撐，不是獨立浮游砲。因此不應單獨大幅旋轉砲來假裝抬砲。

## 尚未完成及原因

原定六個無光效出招新姿勢尚未產出。內建 imagegen 工具回傳 `404 Unsupported gateway route`，沒有產生任何新圖。未改用其他模型或自訂API，未將舊姿勢變形冒充補畫。生成請求保存在同目錄 `pose-generation-request.txt`；不是成功產圖紀錄。

下一步：圖像工具恢復後補畫相同角色的六個姿勢，先核對持砲手、肩肘關係、裝甲和臉的一致性；通過無光效姿勢檢查後，才接開火、飛行與受擊時間軸。原廠兩招逐幀畫面比較也仍待完成。

## 重現與驗證

```powershell
node scripts/build_zhuixing_skeletal.mjs --preview --sequence standby --no-fx --scale 0.26 --gif-height 440 --preview-out docs/custom-anim/drafts/20261105-quiet-idle
node tests/customRig.semantic.test.mjs
node --check scripts/build_zhuixing_skeletal.mjs
node --check scripts/lib/skeletalRig/motion.mjs
```

以上驗證通過。測試涵蓋來源像素歸屬、循環復位、根節點／腿／後環穩定與砲跟隨軀幹；不代表出招美術已通過。正式資源仍使用既有manifest，新的72幀僅在製作來源／草稿，尚未發佈。
