# 動畫載入與掛載輔助

- preparationScheduler.ts：將逐格準備拆成可取消的短工作片段。
- preparedGeometry.ts：逐份解碼結果共用可見框，弱參照快取不延長圖集壽命。
- playerMount.ts：依序建立 WebGL 播放器，原始圖集分塊、分批上傳，不縮圖。包含套件私有欄位相容層；升級套件須跑真實瀏覽器換皮測試。

既有穩定入口仍在上一層 petAnimationLoader.ts、petClipPool.ts、petFxPolicy.ts；畫面與戰鬥演出均使用同一條載入路徑。這裡不處理技能、傷害或魂印。
