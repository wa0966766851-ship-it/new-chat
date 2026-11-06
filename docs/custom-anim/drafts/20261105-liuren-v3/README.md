# 六刃第三輪：受擊關鍵畫面與待機候選

內建 ImageGen 產製，原參考為 v2 的 wuxu_liuren-ready-left.png。
hit-source.png：2×2，從左上依序為待機、中招、後仰、回復。去除純綠幕後整張對齊；沒有拆肢體。
來源 exec-ae840b68-123b-48c8-9b29-4913f4da936a.png。提示要求朝左、同服裝、腳底固定、衣襬延遲、無特效。
idle-source-CANDIDATE.png：3×2，吸氣、右向衣襬波浪、呼氣、回到起點。來源 exec-a871b80d-c08e-461b-bbb8-e330a20cf90b.png。
去霧綠幕來源為 exec-da782700-c768-4a9b-8e2c-caff784e64a0.png，留存於 idle-clean-source.png；此六張關鍵圖經離線補過渡，最終為 47 個不同圖像格，持有與回圈共 96 格。已接入本機正式素材。
本目錄 wuxu_liuren.json 是「受擊中間 spec」，不可直接覆蓋完整待機版本。最終入口為 scripts/prepare_liuren_idle_v3.mjs，輸出 build/custom-idle-v3-poses/wuxu_liuren.json。
已於實際 BattleScreen 驗證雙側待機、受擊與回復；不宣稱官方品質。細刀鏈補幀仍可能變形。最新證據見 docs/audits/2026-11-05_自製待機與受擊_第三輪.md。
