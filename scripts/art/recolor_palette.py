# 異境神霆·雷伊 預設立繪：依指定配色重整（不刪除任何元素、透明度不變）
#   黃：本體、翅膀　　淡藍：雷伊的倒影、劍　　白：翅膀與身體連接處　　輔色：暗部改用琥珀／深藍，不用黑灰
import cv2, numpy as np, sys
src, out = sys.argv[1], sys.argv[2]
cx, cy, R = (float(v) for v in (sys.argv[3:6] if len(sys.argv) > 5 else (690, 560, 190)))
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
bgr = im[..., :3].astype(np.float32) / 255; a = im[..., 3]
hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2HSV).astype(np.float32); h, s, v = hsv[..., 0], hsv[..., 1] / 255, hsv[..., 2] / 255
lum = (.114 * bgr[..., 0] + .587 * bgr[..., 1] + .299 * bgr[..., 2])
H, W = lum.shape
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
# 區域色系：附近以金色為主或藍色為主（大範圍平滑），決定暗部與白色要改成哪個輔色
gold = ((h >= 8) & (h <= 35) & (s > .3) & (a > 40)).astype(np.float32)
blue = ((h >= 85) & (h <= 130) & (s > .2) & (a > 40)).astype(np.float32)
g = cv2.GaussianBlur(gold, (0, 0), 28); b = cv2.GaussianBlur(blue, (0, 0), 28)
warm = g / (g + b + 1e-4)
# 細節：高頻亮度（給大片白色加回晶面層次，避免一片糊白）
detail = lum - cv2.GaussianBlur(lum, (0, 0), 6)

def tone(color, l):  # 依亮度把顏色從暗到亮鋪開：暗處偏深、亮處趨白
    c = np.array(color, np.float32)[None, None, :]
    l3 = l[..., None]
    return np.where(l3 < .5, c * (l3 * 2), c + (1 - c) * ((l3 - .5) * 2))

# 色票（BGR）
GOLD_DEEP = (0.10, 0.42, 0.78)   # 琥珀（金色暗部）
GOLD = (0.16, 0.72, 0.98)        # 金黃
PALE_BLUE = (1.0, 0.86, 0.66)    # 淡藍（倒影、白霧）
AZURE = (0.80, 0.52, 0.22)       # 藍（劍身、藍色暗部）
WHITE = (0.93, 0.97, 1.0)        # 連接處的暖白
outc = bgr.copy()
# 1 暗部（黑灰、AI 擅自加的暗色）→ 依區域改琥珀或深藍
dark = cv2.GaussianBlur(np.clip((.42 - v) / .2, 0, 1) * np.clip((.5 - s) / .3, 0, 1), (0, 0), 1.5)
dark_col = tone(GOLD_DEEP, .42 + lum * .8) * warm[..., None] + tone(AZURE, .4 + lum * .8) * (1 - warm[..., None])
outc = outc * (1 - dark[..., None]) + dark_col * dark[..., None]
# 2 白色與白霧：中心連接處保留白，其餘轉淡藍並加回晶面細節
whiteish = cv2.GaussianBlur(np.clip((.35 - s) / .25, 0, 1) * np.clip((v - .5) / .25, 0, 1), (0, 0), 2.5)
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
keep_white = cv2.GaussianBlur(np.clip((R * 1.3 - dist) / (R * .6), 0, 1), (0, 0), 8)
sd = cv2.GaussianBlur(detail, (0, 0), 1.2)
pale = tone(PALE_BLUE, np.clip(.58 + lum * .32 + sd * 1.3, 0, 1))
junction = np.clip(np.array(WHITE)[None, None, :] * (0.9 + lum[..., None] * .1) + sd[..., None] * 1.0, 0, 1)
white_col = junction * keep_white[..., None] + pale * (1 - keep_white[..., None])
outc = outc * (1 - whiteish[..., None]) + white_col * whiteish[..., None]
# 3 淡紫陰影 → 淡藍灰陰影
lav = cv2.GaussianBlur(((h > 120) & (h < 165)).astype(np.float32) * np.clip((.5 - s) / .3, 0, 1), (0, 0), 2)
outc = outc * (1 - lav[..., None]) + tone(PALE_BLUE, .35 + lum * .5) * lav[..., None]
# 4 金色：降一點霓虹飽和、暗部偏琥珀（輔色），保留亮部
gold_t = cv2.GaussianBlur(np.clip((s - .25) / .2, 0, 1) * ((h >= 8) & (h <= 35)), (0, 0), 1.2)
gold_col = tone(GOLD, np.clip(lum * 1.02 + sd * .8, 0, 1)) * .55 + bgr * .45
outc = outc * (1 - gold_t[..., None] * .6) + gold_col * gold_t[..., None] * .6
# 5 藍色劍身：統一成淡藍到藍
blue_t = cv2.GaussianBlur(np.clip((s - .2) / .2, 0, 1) * ((h >= 85) & (h <= 130)), (0, 0), 1.2)
blue_col = tone(AZURE, np.clip(.3 + lum * .9 + sd * .6, 0, 1))
outc = outc * (1 - blue_t[..., None] * .55) + blue_col * blue_t[..., None] * .55
res = np.dstack([np.clip(outc, 0, 1) * 255, a.astype(np.float32)]).astype(np.uint8)
cv2.imwrite(out, res)
