# 蝕言受擊護書試作

內建 image_gen。編輯原圖 public/elf-art/wuxu_shiyan_body.png；輸出 exec-219711ee-3299-4935-a4ca-51ee17497230.png，專案副本 hurt-guard-source.png。

生成腳位沒有可靠遵守原圖，故不直接使用整張；只取對齊腰帶的上身，原下身與靴保留，詳見 prepare_shiyan_hurt_pilot.mjs。尚未通過美術驗收。

## 完整提示詞

### 回正中間姿勢

輸出 exec-5bd78545-8c2a-44f8-8136-587b930fb449.png，專案副本 hurt-recover-source.png。編輯參考為受擊原稿與最初原圖。

Use case: identity-preserve precise-object-edit. Image 1 is the HIT GUARD pose to edit. Image 2 is the original neutral character, reference only. Produce ONE intermediate recovery keyframe halfway from image1 to image2, same painterly black-grey embroidery and muted lavender spirit texture. Keep image1's exact character identity, grimoire design, metallic gloves, boots, canvas, camera and scale. Man straightens his upper torso half way back upright, lifts chin slightly, shoulders relax, lowers the guarded open grimoire from chest toward waist but still holds it with both hands. No casting gesture, no pointing, no magic circle. Pelvis and both boots remain exactly where image1 puts them, no step. Ghost wisps settle towards the neutral shape but remain behind the man. Keep original long dark hair and stern pale face, crisp intricate silver etched details. Transparent background, full head and both boots, single portrait, no labels, no extra objects. Keep same monochrome coat and restrained lavender; no blue neon or white halo. This must visibly be a recovery BETWEEN the two reference poses, not another extreme guarding pose.

### 受擊姿勢

Use case: identity-preserve precise-object-edit. Edit target: supplied full-body 2D game character. Make ONE restrained HIT-REACTION keyframe, NOT a new design and not a sprite sheet. Preserve the exact original man: long charcoal-black hair, stern pale face, dark grey embroidered long coat with ragged tails, silver segmented metal gloves, ornate open black grimoire, belt, dark trousers and boots, same fine painterly line detail. Preserve the large tangled lavender-black ghost behind him and its eye arrangement. Motion: a hit came from screen LEFT; the man's upper torso recoils 8 degrees toward screen RIGHT at waist, shoulders hunch, chin tucks, the open grimoire and both hands pull closer against his chest as a guard. Keep BOTH boot soles and pelvis in the exact original location, same full-body proportions and camera, no overall reposition or rescale. Coat tips and ghost wisps lag slightly to the left. Spirit recoils subtly behind the man, not exploding. No new objects, no beam, no circle, no spark, no damage numbers, no background, no contact shadow. Muted charcoal and lavender only, no oversaturated blue or white halo. Keep fine native-style detail and original face rather than a simpler cartoon. Complete head, book, all coat tips and both boots visible with transparent safety margins. Output ONE full-body portrait on genuinely transparent background, same composition as original, no grid or text.
