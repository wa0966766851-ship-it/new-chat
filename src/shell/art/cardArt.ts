/**
 * 卡面素材表 — 從 SeerAPI 抓下來的 autocard 卡面
 *
 * 來源：{SEER_REMOTE}/autocard/texture/cards/card_{n}.png
 * 實際下載到 public/aegis/cards/（340×512，直式）
 *
 * 為什麼用它：
 *   手遊的副本入口不是純色方塊，是「有場景的插圖 + 標題帶」。
 *   這批卡面自帶場景（深海／火山／森林／沙漠／太空），
 *   正是「每個副本看起來不一樣」最省力的做法。
 *
 * 使用原則：
 *   - 直式素材放進橫向卡片時，用 object-fit: cover + 靠上對齊，
 *     標題帶壓在底部 40%，避免切到角色臉。
 *   - 每張卡都加暗色漸層，確保標題可讀。
 */

export interface CardArt {
  /** public 路徑 */
  src: string;
  /** 主色調（用於卡片光暈與標籤） */
  tone: string;
  /** 場景描述（給 title 屬性） */
  scene: string;
}

/** 22 張可用卡面（已下載），依色調分組 */
export const CARD_ART: CardArt[] = [
  { src: "/aegis/cards/c4.png", tone: "#38BDF8", scene: "深海" },
  { src: "/aegis/cards/c7.png", tone: "#FB923C", scene: "火山" },
  { src: "/aegis/cards/c10.png", tone: "#F472B6", scene: "秘境" },
  { src: "/aegis/cards/c18.png", tone: "#4ADE80", scene: "綠洲" },
  { src: "/aegis/cards/c26.png", tone: "#FBBF24", scene: "沙暴" },
  { src: "/aegis/cards/c40.png", tone: "#FB7185", scene: "熔岩" },
  { src: "/aegis/cards/c1.png", tone: "#34D399", scene: "森林" },
  { src: "/aegis/cards/c13.png", tone: "#60A5FA", scene: "雷遺跡" },
  { src: "/aegis/cards/c19.png", tone: "#22D3EE", scene: "冰原" },
  { src: "/aegis/cards/c22.png", tone: "#A78BFA", scene: "星海" },
  { src: "/aegis/cards/c27.png", tone: "#FCA5A5", scene: "荒原" },
  { src: "/aegis/cards/c30.png", tone: "#93C5FD", scene: "高空" },
  { src: "/aegis/cards/c34.png", tone: "#2DD4BF", scene: "潮間" },
  { src: "/aegis/cards/c35.png", tone: "#C084FC", scene: "幻境" },
  { src: "/aegis/cards/c38.png", tone: "#FDBA74", scene: "烈陽" },
  { src: "/aegis/cards/c42.png", tone: "#818CF8", scene: "夜幕" },
  { src: "/aegis/cards/c43.png", tone: "#F87171", scene: "赤岩" },
  { src: "/aegis/cards/c47.png", tone: "#5EEAD4", scene: "淺灘" },
  { src: "/aegis/cards/c51.png", tone: "#FCD34D", scene: "金原" },
  { src: "/aegis/cards/c55.png", tone: "#7DD3FC", scene: "雲海" },
  { src: "/aegis/cards/c58.png", tone: "#BEF264", scene: "草原" },
  { src: "/aegis/cards/c59.png", tone: "#F0ABFC", scene: "極光" },
];

/** 依索引取卡（循環，不會 undefined） */
export function cardAt(index: number): CardArt {
  return CARD_ART[Math.abs(index) % CARD_ART.length];
}

/** 副本 → 指定卡面（讓每個入口有固定的視覺記憶點） */
export const OPERATION_ART: Record<string, number> = {
  free: 0,           // 深海
  solo: 1,           // 火山
  peak6: 5,          // 熔岩
  peak3: 4,          // 沙暴
  destiny: 9,        // 星海
  interstellar: 11,  // 高空
};
