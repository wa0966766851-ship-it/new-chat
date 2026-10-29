/** 套裝／眼鏡立繪對照表：套裝 id → 圖片路徑（SeerAPI 原廠 suiticon，或以原廠圖換色的 suit_custom）。 */
const ICON = (n: number) => `/seerapi/suiticon/${n}.png`;
const CUSTOM = (id: string) => `/seerapi/suit_custom/${id}.png`;

export const SUIT_ART: Record<string, string> = {
  // 同名原廠圖
  dark_angel: ICON(448), morning_star: ICON(447), sky_cloud: ICON(446), venom_armor: ICON(404),
  future_armor: ICON(403), corrupter: ICON(387), space_time: ICON(391), proud_peak: ICON(393),
  phoenix_wings: ICON(382), emperor_armor: ICON(377), silver_knight: ICON(365), destiny_armor: ICON(435),
  imperial_armor: ICON(429), shadow_judgment: ICON(462), holy_sanctuary: ICON(476),
  // 原廠圖換色的專屬版本（製作記錄見 docs/data/seerapi/suit_art_map.md）
  eternal_starlight: CUSTOM("eternal_starlight"), starlight_guardian: CUSTOM("starlight_guardian"),
  berserker: CUSTOM("berserker"), void_traveler: CUSTOM("void_traveler"), nuclear_armor: CUSTOM("nuclear_armor"),
  shadow_slayer: CUSTOM("shadow_slayer"), crystal_barrier: CUSTOM("crystal_barrier"), inferno_mecha: CUSTOM("inferno_mecha"),
  abyssal_walker: CUSTOM("abyssal_walker"), fate_defier: CUSTOM("fate_defier"),
  // 眼鏡
  roamer_as: CUSTOM("roamer_as"), roamer_ah: CUSTOM("roamer_ah"), roamer_s: CUSTOM("roamer_s"),
  hanged_mask: CUSTOM("hanged_mask"), demon_wind: CUSTOM("demon_wind"),
};

/** 立繪來源（依序嘗試）：既有 suit_<id>.png 優先，其次對照表，最後退回徽記。 */
export function suitPortraitUrls(id: string): string[] {
  const art = SUIT_ART[id];
  return [`/elf-art/suit_${id}.png`, `/seer/suit/${id}.png`, ...(art ? [art] : [])];
}
