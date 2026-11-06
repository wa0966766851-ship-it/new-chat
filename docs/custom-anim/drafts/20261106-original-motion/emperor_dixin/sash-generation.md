# 衣帶遮擋補底研究，未驗收

內建 image_gen，來源 exec-fd42731f-ada2-4946-97c4-808a87834977.png。保存在 sash-underpaint-source.png。參考 ready-clean.png。
生成結果自帶光暈，且重畫人物，因此不可整張替換原圖。prepare_dixin_idle_layers.mjs 僅擷取原衣帶遮擋區，其他像素完全使用原圖；外側尾端補透明背景。須檢查局部露出時的材質與顏色差。

完整提示：
Use case: precise-object-edit. Animation hidden underpainting of the provided exact emperor sprite. Remove ONLY the long foreground purple-and-gold sash / robe strip which starts near the character's belt at image x=650,y=600 and sweeps down toward the far right edge around x=1000,y=1250 (source 1024x1536). Fill behind that removed foreground sash with plausible continuation of the black/dark embroidered robe or transparent empty background as appropriate. This patch will ONLY be shown underneath the original extracted sash when it sways. Preserve all remaining anatomy, face, crown, white hair, gold sword at left, hands, floating gold rings and all other layers. Do not add effects, no colored halo or mist. Do not repaint or simplify the original character. Keep canvas size and standing pose identical, exact black gold dark purple palette and fine texture. The foreground right lower purple sash must disappear in the underpaint, without cutting the head, body or shoes. Single full-body transparent sprite, no scene or shadow.
