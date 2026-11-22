# 異境神霆·雷伊 預設立繪「降 AI 感」整理（草稿）：
# 1 去白霧與幽影（低飽和高亮的大片柔光、淡紫半透明拖影）
# 2 收邊：半透明毛邊收斂成實邊
# 3 色彩：金色降霓虹感、統一冷暖兩色系，增加明暗對比
# 4 描線：外輪廓深色線＋內部大轉折細線（賽爾號立繪的賽璐珞風格）
# 5 分層輸出：金色本體＋羽翼、藍色雷刃浮游砲、冰晶背景，供之後分層動畫使用
import cv2, numpy as np, sys, os
src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
bgr = im[..., :3].copy(); a = im[..., 3].astype(np.float32) / 255
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32); h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
# 1 白霧
white = np.clip((70 - s) / 25, 0, 1) * np.clip((v - 150) / 50, 0, 1)
# 淡紫拖影（偏紫、低飽和、半透明）
wisp = ((h > 115) & (h < 165) & (s < 90)).astype(np.float32) * np.clip((0.85 - a) / .5, 0, 1)
kill = cv2.GaussianBlur(np.maximum(white, wisp), (0, 0), 1.5)
a = a * (1 - kill)
# 2 收邊：alpha 曲線（0.25 以下消失、0.6 以上全實）
a = np.clip((a - .25) / .35, 0, 1)
# 碎屑：小於 900 像素的孤立碎片刪除；羽翼內被白霧挖出的小洞補回（閉運算）
solid = (a > .5).astype(np.uint8)
solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
n, lab, st, _ = cv2.connectedComponentsWithStats(solid)
keep = np.zeros(n, bool); keep[1:] = st[1:, 4] >= 900
solid = keep[lab]
a = np.where(solid, np.maximum(a, cv2.GaussianBlur(solid.astype(np.float32), (0, 0), 1.2) * (im[..., 3] / 255 > .05)), 0)
a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), .6)
# 補洞：被白霧挖空、四周皆為實體的小區域（羽翼內的黑點）以周邊顏色修補
closed = cv2.morphologyEx((a > .5).astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
holes = (closed > 0) & (a <= .5)
n, lab, st, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8))
small = np.zeros(n, bool); small[1:] = st[1:, 4] < 450
holes = small[lab]
bgr = cv2.inpaint(bgr, holes.astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
a = np.where(holes, 1.0, a).astype(np.float32)
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32); h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
# 3 色彩：金色降飽和、壓暗中間調；藍色加深
gold = ((h >= 8) & (h <= 35) & (s > 60)).astype(np.float32)
blue = ((h >= 85) & (h <= 130) & (s > 50)).astype(np.float32)
s2 = s * (1 - .18 * gold) + 25 * blue
v2 = v.copy()
curve = lambda x: 255 * (np.clip(x / 255, 0, 1) ** 1.25)  # 中間調壓暗、亮部保留
v2 = curve(v2) * (1 - .1 * blue)
hsv2 = np.dstack([h, np.clip(s2, 0, 255), np.clip(v2, 0, 255)]).astype(np.uint8)
col = cv2.cvtColor(hsv2, cv2.COLOR_HSV2BGR)
# 銳化（去掉 AI 圖常見的糊亮）
blur = cv2.GaussianBlur(col, (0, 0), 2)
col = cv2.addWeighted(col, 1.6, blur, -.6, 0)
# 4 描線
gray = cv2.cvtColor(col, cv2.COLOR_BGR2GRAY)
inner = cv2.Canny(cv2.bilateralFilter(gray, 7, 40, 5), 70, 160)
inner = (cv2.GaussianBlur(inner.astype(np.float32) / 255, (0, 0), .6) * .55)
sil = (a > .5).astype(np.uint8)
outer = cv2.dilate(sil, np.ones((5, 5), np.uint8)) - sil
outer = cv2.GaussianBlur(outer.astype(np.float32), (0, 0), .8)
ink = np.array([52, 28, 22], np.float32)
line = np.clip(np.maximum(inner * (a > .5), outer), 0, 1)
out = col.astype(np.float32) * (1 - line[..., None]) + ink * line[..., None]
alpha = np.clip(np.maximum(a, outer), 0, 1)
full = np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8)
cv2.imwrite(os.path.join(outdir, 'body_clean.png'), full)
# 5 分層
def layer(mask, name):
    m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1)
    o = full.copy(); o[..., 3] = (full[..., 3].astype(np.float32) * m).astype(np.uint8); cv2.imwrite(os.path.join(outdir, name), o)
hard = (alpha > .05)
layer(hard & (gold > 0) | (hard & (s < 60) & (v < 140)), 'part_gold.png')
layer(hard & (blue > 0), 'part_blue.png')
