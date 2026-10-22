import React from "react";

/**
 * FigurePlate — 立繪底版
 *
 * 為什麼需要它：
 *   本機只有部分精靈有全身圖（public/elf-art、public/seer/body），
 *   其餘會 404。大廳若直接掛 ElfAvatar，右半邊就是一片空白。
 *
 * 做法：
 *   先畫一塊「幾何剪影底版」——人形輪廓 + 屬性色 + 軌道環，
 *   再把 ElfAvatar 疊上去。圖載入成功 → 看到立繪；
 *   圖 404 → 看到底版，仍然是一個完整的構圖，不會像壞掉。
 */

/** 屬性 → 色相（沿用賽爾號的屬性語彙，但用低飽和金屬色） */
const TYPE_HUE: Record<string, number> = {
  暗影: 268, 光: 48, 火: 14, 水: 205, 草: 128, 電: 52, 冰: 190,
  地面: 32, 飛行: 200, 超能: 288, 戰鬥: 8, 神秘: 262, 龍: 224,
  機械: 210, 自然: 120, 次元: 250, 聖靈: 46, 混沌: 300, 無屬性: 210,
};

export function typeColor(type: string, fallback = "var(--p-accent)"): string {
  const hue = TYPE_HUE[type];
  return hue === undefined ? fallback : `hsl(${hue} 62% 62%)`;
}

export function FigurePlate({ type, name }: { type: string; name: string }) {
  const c = typeColor(type);
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg viewBox="0 0 200 260" className="h-full w-auto opacity-[0.5]" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="fp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.42" />
            <stop offset="100%" stopColor={c} stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="fp-line" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.85" />
            <stop offset="100%" stopColor={c} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* 背後的同心圓 */}
        <g stroke={c} fill="none" opacity="0.28">
          <circle cx="100" cy="120" r="86" strokeWidth="0.6" />
          <circle cx="100" cy="120" r="66" strokeWidth="0.4" strokeDasharray="3 6" />
          <line x1="100" y1="8" x2="100" y2="30" strokeWidth="0.6" />
          <line x1="100" y1="212" x2="100" y2="232" strokeWidth="0.6" />
          <line x1="6" y1="120" x2="26" y2="120" strokeWidth="0.6" />
          <line x1="174" y1="120" x2="194" y2="120" strokeWidth="0.6" />
        </g>

        {/* 人形剪影：頭 + 肩 + 軀幹 + 下擺，全部幾何化 */}
        <g>
          <ellipse cx="100" cy="52" rx="19" ry="21" fill="url(#fp-fill)" stroke="url(#fp-line)" strokeWidth="0.9" />
          <path
            d="M100 74 L126 86 L136 132 L128 190 L116 236 L100 244 L84 236 L72 190 L64 132 L74 86 Z"
            fill="url(#fp-fill)"
            stroke="url(#fp-line)"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* 肩甲切線 */}
          <path d="M74 92 L58 118 L62 140" fill="none" stroke={c} strokeOpacity="0.55" strokeWidth="0.7" />
          <path d="M126 92 L142 118 L138 140" fill="none" stroke={c} strokeOpacity="0.55" strokeWidth="0.7" />
          {/* 胸口徽記 */}
          <path d="M100 118 L112 128 L100 146 L88 128 Z" fill="none" stroke={c} strokeOpacity="0.75" strokeWidth="0.9" />
          <circle cx="100" cy="131" r="3" fill={c} fillOpacity="0.75" />
        </g>

        {/* 底部基座 */}
        <ellipse cx="100" cy="248" rx="58" ry="7" fill={c} fillOpacity="0.12" />
        <ellipse cx="100" cy="248" rx="58" ry="7" fill="none" stroke={c} strokeOpacity="0.35" strokeWidth="0.6" />
      </svg>
    </div>
  );
}
