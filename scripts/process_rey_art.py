"""以傳統色鍵／邊界連通去背處理異境神霆·雷伊美術，不使用生成模型。"""

from __future__ import annotations

from collections import deque
from pathlib import Path
import sys

import numpy as np
from PIL import Image


def connected_white_background(rgb: np.ndarray) -> np.ndarray:
    """只移除與畫布邊界連通的近白區，避免抹掉角色內部的白色鎧甲。"""
    minimum = rgb.min(axis=2)
    maximum = rgb.max(axis=2)
    candidate = (minimum >= 238) & ((maximum - minimum) <= 20)
    height, width = candidate.shape
    background = np.zeros_like(candidate)
    queue: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if candidate[y, x] and not background[y, x]:
            background[y, x] = True
            queue.append((y, x))

    for x in range(width):
        seed(0, x)
        seed(height - 1, x)
    for y in range(height):
        seed(y, 0)
        seed(y, width - 1)

    while queue:
        y, x = queue.popleft()
        if y > 0:
            seed(y - 1, x)
        if y + 1 < height:
            seed(y + 1, x)
        if x > 0:
            seed(y, x - 1)
        if x + 1 < width:
            seed(y, x + 1)
    return background


def dilate(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    result = mask.copy()
    for _ in range(iterations):
        padded = np.pad(result, 1, mode="constant")
        result = np.logical_or.reduce([
            padded[1:-1, 1:-1], padded[:-2, 1:-1], padded[2:, 1:-1],
            padded[1:-1, :-2], padded[1:-1, 2:],
            padded[:-2, :-2], padded[:-2, 2:], padded[2:, :-2], padded[2:, 2:],
        ])
    return result


def remove_white_matte(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    background = connected_white_background(rgb)
    fringe = dilate(background, 3) & ~background

    alpha = np.full(rgb.shape[:2], 255, dtype=np.float32)
    alpha[background] = 0
    # 白底合成圖的邊緣透明度：離純白越遠越不透明，保留淺藍電光的柔邊。
    distance_from_white = 255.0 - rgb.astype(np.float32).min(axis=2)
    fringe_alpha = np.clip(distance_from_white / 24.0, 0.0, 1.0) * 255.0
    alpha[fringe] = np.minimum(alpha[fringe], fringe_alpha[fringe])

    # 將半透明邊緣中的白色底色反合成掉，避免深色戰鬥背景上出現白邊。
    a = alpha[..., None] / 255.0
    restored = rgb.astype(np.float32)
    partial = (alpha > 0) & (alpha < 255)
    if np.any(partial):
        safe_a = np.maximum(a, 1 / 255.0)
        unmatted = (restored - 255.0 * (1.0 - a)) / safe_a
        restored[partial] = np.clip(unmatted[partial], 0, 255)

    rgba = np.dstack((restored.astype(np.uint8), alpha.astype(np.uint8)))
    return Image.fromarray(rgba, "RGBA")


def square_head_crop(body: Image.Image) -> Image.Image:
    """以角色頭部與上半身為中心裁成 512px 頭像，保留透明背景。"""
    # 本張 1330×1182 原圖的頭部約位於 (655, 515)。
    center_x = round(body.width * 0.493)
    center_y = round(body.height * 0.445)
    side = round(min(body.width, body.height) * 0.43)
    left = max(0, center_x - side // 2)
    top = max(0, center_y - side // 2)
    crop = body.crop((left, top, left + side, top + side))
    return crop.resize((512, 512), Image.Resampling.LANCZOS)


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: process_rey_art.py INPUT BODY_OUTPUT HEAD_OUTPUT")
    source, body_path, head_path = map(Path, sys.argv[1:])
    body = remove_white_matte(Image.open(source))
    body_path.parent.mkdir(parents=True, exist_ok=True)
    body.save(body_path, optimize=True)
    square_head_crop(body).save(head_path, optimize=True)
    print(f"body={body_path} size={body.size}")
    print(f"head={head_path} size=512x512")


if __name__ == "__main__":
    main()
