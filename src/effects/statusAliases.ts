/** 從既有 battleHelpers 原表搬出，不猜測新增別名；可獨立供引擎與 UI 使用。 */
export const STATUS_NAMES_MAP: Record<string, string> = {
  poisoned: "中毒", burned: "燒傷", frostbite: "凍傷", paralyzed: "麻痺",
  paralyzed_lock: "癱瘓", ice_sealed: "冰封", infected: "感染", feared: "害怕",
  fatigued: "疲憊", incinerated: "焚燼", confused: "混亂", suffocated: "窒息",
  // 舊戰鬥代號 frozen 是不衍化的石化；冰封使用 ice_sealed，結束後轉為凍傷。
  furious: "狂暴", fanatic: "狂信", submit: "臣服", sleep: "睡眠", deep_sleep: "沉睡", frozen: "石化", petrified: "石化", cutting: "切割", shackled: "束縛",
  凍結: "冰封", 冰凍: "冰封",
  silenced: "沉默", stupefied: "失神", gradual_freeze: "漸凍", bleeding: "流血", cursed: "詛咒", trance: "神游",
  xingshu: "星贖", shiming: "失明", shuairuo: "衰弱", flame_curse: "烈焰詛咒", weakness_curse: "虛弱詛咒", out_of_control_curse: "失控詛咒", fatal_curse: "致命詛咒",
  烈焰詛咒: "烈焰詛咒", 虛弱詛咒: "虛弱詛咒", 失控詛咒: "失控詛咒", 致命詛咒: "致命詛咒",
  star_gift: "星賜", star_bearer: "星執者", 星執者: "星執者",
  石化: "石化", 癱瘓: "癱瘓", 狂信: "狂信", 沉睡: "沉睡", 冰封: "冰封", 焚燼: "焚燼", 感染: "感染", 神游: "神游", 空定: "空定",
  寄生: "寄生", 凍傷: "凍傷", 混亂: "混亂", 衰弱: "衰弱", 易燃: "易燃", 流血: "流血", 失明: "失明", 束縛: "束縛", 失神: "失神", 沉默: "沉默", 臣服: "臣服", 沸湧: "沸湧", 繳械: "繳械", 腐朽: "腐朽", 失溫: "失溫", 遲鈍: "遲鈍", 窒息: "窒息",
  山神守護: "山神守護", 狂暴: "狂暴", 神話: "神話", 免疫: "免疫", 異常抵抗: "異常抵抗", status_immune: "異常抵抗", 星賜: "星賜", 星哲: "星哲", 超頻: "超頻", 砥礪: "砥礪", 星贖: "星贖", 雷解: "雷解", 漸凍: "漸凍", 星佑: "星佑", 星護: "星護", 平靜: "平靜"
};
