# 帝辛受擊單張來源

內建 image_gen；來源圖 ready-clean.png，原生朝左。未發布。

第一張 exec-554fc95d-86a1-4d45-8ca4-d564eb392f89.png 保存為 hurt-source-v1.png，1024×1536。產圖預覽看似有金紫霧，但實際 alpha 合成到深色底後沒有大片霧；不可把透明像素的隱藏 RGB 誤判成可見背景。臉部表情、頭髮與衣帶姿勢已變；需要實播檢查與原圖的切換差異。

完整提示：

```text
Use case: identity-preserve.
Asset type: one high-detail transparent 2D battle sprite keyframe, matching the supplied original game character exactly.
Input image 1 is the EDIT TARGET and immutable identity/style/material reference. It is the original ready pose of the white-haired Chinese emperor 帝辛.
Primary edit: create ONE restrained but clearly readable HIT-REACTION key drawing, not a new attack and not a new design. Keep both feet and the hem at exactly the reference baseline and keep his overall standing height. He is struck from screen LEFT; shoulders recoil slightly toward screen RIGHT, upper torso leans back around 8 degrees, head pulls back slightly and eyes narrow in pain. His sword-bearing arm tenses and brings the same sword modestly across the lower front of his body to brace. His open palm still holds the same golden orb, slightly nearer his chest. Hair and the long purple ribbons trail to the LEFT from inertia. Preserve his stern elegant adult male face, same small crown, very long silver hair, black-and-gold embroidered Chinese robes, white inner skirts, purple/gold sashes, exactly two arms, original sword and gold ornaments.
Composition: full figure, native source faces LEFT, tall 1024x1536 canvas, preserve source camera and proportions, generous transparent safety margins around crown, blade tip, hair and robe. No cropping. No perspective closeup.
Style: reproduce source fine sharp inked lines, intricate crisp gold embroidery, muted rich material shading, original black/gold/purple/white palette; do not simplify into cartoon armor or plastic 3D.
Keep gold orbit ornaments recognizable and limited to the same existing design. No new runes, no new weapons, no impact flash, no mist, no floor, no shadow blob, no white bloom, no painted background, no text, no sheet or multiple poses. Actual transparent alpha background. This is one subtle recoil pose that will briefly display between the original ready pose and recovery, so continuity matters more than spectacle.
```

第二張 exec-dd794e23-ab8f-438d-bc94-e7c0a50d0619.png 是針對誤判霧背景的重試，未接入。不能據此聲稱清背成功或第一張有霧。

重試完整提示：

```text
Use case: background-extraction. Edit target is the supplied full-body emperor recoil keyframe. Change ONLY alpha/background treatment: remove the broad translucent gold/purple/gray fog and all backdrop haze between and around body/ribbons/ornaments. Return the exact existing character, his sword, fine hair, gold orbit lines, dangling gold ornaments, clothing and pose on genuinely CLEAR transparent alpha. The physical body, skin, black robe, white fabric, gold metal and solid purple ribbons must have opaque pixels, not a globally translucent subject. Preserve sharp original detail and every body contour. Keep only crisp inked gold arcs already present; no glow clouds, no colored gradients filling empty space, no shadow or floor. Do not redraw or move the face, crown, hands, sword, feet or embroidery. Keep the full figure on the same 1024x1536 canvas and baseline. No style change, no extra effects, no checkerboard.
```
