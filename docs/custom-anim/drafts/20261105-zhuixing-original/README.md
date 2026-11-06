# 墜星最初原稿：唯一視覺基準

original-user.png：使用者於本輪提供，1086×1448，白底完整角色。原檔逐位元複製，未改動。source-review.json 保存 hash。先前 public/elf-art/wuxu_zhuixing_body.png 為不完整去背圖，不得繼續當最初原稿。

cutout-candidate.png：內建 ImageGen exec-52d96024-f904-4197-b888-b1c0815e7ed7，要求只去除白底、保留畫風、臉、槍械、頭後完整光環、浮游武器和能量絲帶、不改姿勢。結果仍有 RGB 改動，所以不能當直接輸出。

original-color-matte-v3.png：以候選遮罩輔助，重新取回原圖 RGB 的離線試作。1086×1448；保護區 603,164 像素 RGB 改動為零。外緣去白與藍色能量透明度是估計，不是原始圖層恢復。需要淺底、深底和實際場景驗證，尚未替換 public，也不是完成動畫。

original-color-matte.png 為拒用的第一版（白邊），original-color-matte-v2.png 為拒用的第二版（透明不均）。不要依檔名挑第一張。

重現目前候選：

```powershell
node scripts/restore_original_rgb.mjs docs/custom-anim/drafts/20261105-zhuixing-original/original-user.png docs/custom-anim/drafts/20261105-zhuixing-original/cutout-candidate.png docs/custom-anim/drafts/20261105-zhuixing-original/original-color-matte-v3.png
```

後續規格：待機以原畫製作局部頭髮／衣物／呼吸，不重繪整個角色、不整張平移、不旋轉整個光環。出招才切換同畫風補畫；每一姿勢單獨高解析度製作，不再用九格 sheet 降低角色像素。原畫與動作圖先同尺寸對照臉、配色、紋理、武器比例，再接播放器；不能靠放大低解析圖補畫質。
