/**
 * 星蝕回廊：商店「失與得」以物易物。純資料與純函式，無 React／引擎依賴。
 *
 * 防套利：所有物品都有一個「基準價值」（＝商店底價，未乘章節係數）。每條配方都必須滿足
 *   getValue ≤ BARTER_RHO × giveValue（以允許的最低給出價值、最高得到價值比較），
 * 任何兌換循環（含「到商店買進再兌換」）的總價值只會遞減。兌換的數量不隨章節係數膨脹，
 * 所以不同章節的商店之間也無法低買高賣。測試：tests/eclipseBarter.semantic.test.ts。
 */
import { RELIC_PRICE, SHARD_SHOP_PRICE, tokenBasePrice, type Tier, type TokenSpec } from "./recruit";
import type { RelicRarity } from "./relics";

export type BarterKind = "relic" | "potion" | "shard" | "beans" | "token";
/** 單一藥劑的商店底價（rollShop 的藥劑欄） */
export const POTION_PRICE = 45;
/** 配方價值比上限：得到的價值不得超過給出價值的這個比例 */
export const BARTER_RHO = 0.75;
/** 每家商店的兌換次數、每條配方在同一家店的次數上限 */
export const barterLimit = (n: number): number => n >= 12 ? 1 : n >= 6 ? 2 : 3;
export const BARTER_MAX_USES = 2;
/** 每家商店擺出的配方數 */
export const BARTER_SHOWN = 6;

export interface BarterGive { kind: BarterKind; qty: number; /** 遺物限定稀有度 */ rarities?: RelicRarity[]; /** 令限定：底價下限（不含重複令時 repeat=false） */ minTokenPrice?: number }
export interface BarterGet { kind: BarterKind; qty: number; /** 取得招募令時的款式與強度上限 */ tokenTier?: Tier }
export interface BarterRecipe { id: string; name: string; minAct: number; give: BarterGive; get: BarterGet }

/** 兌換表（N0 的基礎數量；N 等級見 recipeAt） */
export const BARTER_RECIPES: BarterRecipe[] = [
  { id: "relic_c_beans", name: "普通遺物換賽爾豆", minAct: 1, give: { kind: "relic", qty: 1, rarities: ["common"] }, get: { kind: "beans", qty: 55 } },
  { id: "relic_r_beans", name: "稀有遺物換賽爾豆", minAct: 1, give: { kind: "relic", qty: 1, rarities: ["rare"] }, get: { kind: "beans", qty: 100 } },
  { id: "relic_r_shard", name: "稀有遺物換星晶", minAct: 1, give: { kind: "relic", qty: 1, rarities: ["rare"] }, get: { kind: "shard", qty: 1 } },
  { id: "relic_l_shard", name: "傳說遺物換星晶", minAct: 2, give: { kind: "relic", qty: 1, rarities: ["legendary", "boss"] }, get: { kind: "shard", qty: 2 } },
  { id: "potion_token", name: "藥劑換單屬性令", minAct: 1, give: { kind: "potion", qty: 3 }, get: { kind: "token", qty: 1, tokenTier: "mid" } },
  { id: "potion_token_hi", name: "藥劑換高階單屬性令", minAct: 3, give: { kind: "potion", qty: 5 }, get: { kind: "token", qty: 1, tokenTier: "high" } },
  { id: "shard_token", name: "星晶換單屬性令", minAct: 1, give: { kind: "shard", qty: 2 }, get: { kind: "token", qty: 1, tokenTier: "mid" } },
  { id: "shard_beans", name: "星晶換賽爾豆", minAct: 1, give: { kind: "shard", qty: 1 }, get: { kind: "beans", qty: 48 } },
  { id: "shard_potion", name: "星晶換藥劑", minAct: 1, give: { kind: "shard", qty: 1 }, get: { kind: "potion", qty: 1 } },
  { id: "token_shard", name: "招募令換星晶", minAct: 1, give: { kind: "token", qty: 1, minTokenPrice: 100 }, get: { kind: "shard", qty: 1 } },
  { id: "beans_shard", name: "賽爾豆換星晶", minAct: 1, give: { kind: "beans", qty: 120 }, get: { kind: "shard", qty: 1 } },
  { id: "beans_token", name: "賽爾豆換單屬性令", minAct: 2, give: { kind: "beans", qty: 240 }, get: { kind: "token", qty: 1, tokenTier: "mid" } },
];
export const BARTER_BY_ID: Record<string, BarterRecipe> = Object.fromEntries(BARTER_RECIPES.map(r => [r.id, r]));

/**
 * N 等級調整：賽爾豆的量隨 N 每階 ±2%（拿到的變少、要付的變多）；N9 起藥劑換令多收 1 瓶。
 * 離散物品的數量不變，所以 N 只會讓配方更差，不會破壞防套利。
 */
export function recipeAt(r: BarterRecipe, n: number): BarterRecipe {
  const give = { ...r.give }, get = { ...r.get };
  if (give.kind === "beans") give.qty = Math.ceil(give.qty * (1 + .02 * n));
  if (get.kind === "beans") get.qty = Math.floor(get.qty * Math.max(.4, 1 - .02 * n));
  if (n >= 9 && give.kind === "potion" && get.kind === "token") give.qty += 1;
  return { ...r, give, get };
}
export const recipesFor = (act: number): BarterRecipe[] => BARTER_RECIPES.filter(r => r.minAct <= act);

/** 令的基準價值（取最低可能款式：任一屬性令的底價以下限計） */
const TOKEN_FLOOR = 90;
/** 各種物品每單位的基準價值（最低值＝給出方估算；最高值＝得到方估算） */
function unitValue(kind: BarterKind, side: "give" | "get", s: BarterGive | BarterGet): number {
  switch (kind) {
    case "beans": return 1;
    case "shard": return SHARD_SHOP_PRICE;
    case "potion": return POTION_PRICE;
    case "relic": {
      const rs = (s as BarterGive).rarities ?? ["common"];
      const vals = rs.map(r => RELIC_PRICE[r]);
      return side === "give" ? Math.min(...vals) : Math.max(...vals);
    }
    case "token": {
      if (side === "give") return Math.max(TOKEN_FLOOR, (s as BarterGive).minTokenPrice ?? TOKEN_FLOOR);
      const tier = (s as BarterGet).tokenTier ?? "mid";
      // 得到的是單屬性令（has）；最貴情況取該強度的底價
      return tokenBasePrice({ kind: "types", types: ["x"], match: "has", tier });
    }
  }
}
/** 一條配方給出／得到的基準價值（給出取最低可能、得到取最高可能） */
export const giveValue = (r: BarterRecipe): number => r.give.qty * unitValue(r.give.kind, "give", r.give);
export const getValue = (r: BarterRecipe): number => r.get.qty * unitValue(r.get.kind, "get", r.get);
/** 價值比：得到 ÷ 給出，永遠 ≤ BARTER_RHO */
export const barterRatio = (r: BarterRecipe): number => getValue(r) / giveValue(r);

/** 令能不能作為給出品：重複令與雙屬性令（底價 90）不收；需達到配方的底價下限 */
export function tokenAccepted(spec: TokenSpec, r: BarterRecipe): boolean {
  return !spec.repeat && tokenBasePrice(spec) >= (r.give.minTokenPrice ?? TOKEN_FLOOR + 1);
}

/** 每家商店的兌換狀態（隨商店場景存檔） */
export interface BarterState { offers: string[]; left: number; uses: Record<string, number> }
