// legacy_handler 包裝（unconnected-73 計畫 (c) 類 47 份）：整份定義以單一唯讀「專屬機制」區塊接通。
// 執行仍由原 handler／特質引擎完成（effectRoute 例外，見 effects/effectConnection.ts），不拆解、不雙重執行。
// 稽核標 legacyWrapped，不計 semanticallyAccepted。每拆出一個通用機制，就把對應定義移出本檔。
// 本檔由 (name, description) 逐字比對精靈資料；原文變更即不再套用。
import { buildWrappedKit } from '../blocks/ops/legacyWrappedKit';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

type Kind = 'skill' | 'soul' | 'trait';
type Wrapped = ReviewedSequenceSkill & { kind?: 'soul' | 'trait' };
const w = (kind: Kind, elf: string, key: string, name: string, description: string, label: string): Wrapped =>
  ({ ...(kind === 'skill' ? {} : { kind }), elfIds: [elf], name, description, kit: buildWrappedKit(kind, elf, key, description, label) });
export const MIGRATED_LEGACY_WRAPPED_KITS: Wrapped[] = [
  // 5002 帝皇之盾 魂印「盾」已拆成真積木（migratedImperialShieldSoulKit.ts；DSH 20261018）：移出本清單。
  // 5007 魂印「濁」已拆成真 Kit（migrated5007BrinkkSoulKit.ts；DSH 20261018）：移出本清單。
  // 5009 魂印「獅」已拆成真 Kit（migratedFinalOdinDeluBelienteKits.ts MIGRATED_FINAL_DELU_SOUL_KIT；DSH 20261018）：移出本清單。
  // 5000 魂印「神」已拆成真積木（migratedGroup5HolyPuniSoulKit.ts；DSH 20261018 組 5）：移出本清單。
  // 5012 魂印「冰」已拆成真積木（migratedKeldSoulKit.ts；DSH 20261017）：移出本清單。
  // 5013 魂印「凕」已拆成真積木（migratedKeerhodeSoulKit.ts；DSH 20261017）：移出本清單。
  // 5014 魂印「燦」已拆成真 Kit（migrated5014CanSoulKit.ts；DSH 20261018）：移出本清單。
  // 5015 魂印「夜」已拆成真積木（migratedNightSoulKit.ts；DSH 20261018 第十一批·第一波）：移出本清單。
  // 5016 魂印「械」已拆成真 Kit（migrated5016MechSoulKit.ts；DSH 20261019）：移出本清單。最後一份。
  // 5018 魂印「后」已拆成真積木（migratedOpeiaSoulKit.ts；DSH 20261018 第十三批·第一波）：移出本清單。
  // 5019 魂印「ᛏ」已拆成真 Kit（migrated5019TiwazSoulKit.ts；DSH 20261018）：移出本清單。
  // 5019 ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ 已拆成真 Kit（migratedFinalOdinDeluBelienteKits.ts MIGRATED_FINAL_ODIN_RAVEN_KIT；DSH 20261018）：移出本清單。
  // 5019 ᚱᚨᚷᚾᚨᚱᛟᚲ 已拆成真 Kit（migratedOdinRagnarokKit.ts；DSH 20261018）：移出本清單。
  // 5021 魂印「龍」已拆成真 Kit（migratedFinalMarsLanDragonKits.ts MIGRATED_FINAL_DRAGON_SOUL_KIT；DSH 20261018）：移出本清單。
  // 5021 遺典.妄世律裁 已拆成真 Kit（migratedDimensionalWangshiKit.ts；DSH 20261018）：移出本清單。
  // 5022 專屬特性 已拆成真 Kit（migratedFinalExtraTraitKits.ts；DSH 20261018）：移出本清單。
  // 5022 無我／戰士 已拆成真 Kit（migratedFinalExtraTraitKits.ts；DSH 20261018）：移出本清單。
  // 5023 魂印「蝕言」 已拆成真 Kit（migratedFinalExtraTraitKits.ts；DSH 20261018）：移出本清單。
  // 5023 修復／咒術師 已拆成真 Kit（migratedFinalExtraTraitKits.ts；DSH 20261018）：移出本清單。
  // 5025 魂印「懼」已拆成真積木（migratedZhakesiFearSoulKit.ts；DSH 20261018 第十三批·第一波）：移出本清單。
  // 5026 豪邁／投石者 已拆成真 Kit（migratedFinalExtraTraitKits.ts；DSH 20261018）：移出本清單。
  // 5027 魂印「蓓」已拆成真 Kit（migratedFinalOdinDeluBelienteKits.ts MIGRATED_FINAL_BELIENTE_SOUL_KIT；DSH 20261018）：移出本清單。
  // 5028 魂印「瀾」已拆成真 Kit（migrated5028LanSoulKit.ts；DSH 20261018）：移出本清單。
  // 5029 神明已拆成真 Kit（migratedReyKits.ts；子代理D 20261018）：移出本清單。
  // 5035 魂印「鱗」已拆成真 Kit（migratedHamoLinSoulKit.ts；DSH 20261018）：移出本清單。
  // 5035 逐波 已拆成真 Kit（migratedHamoElementalKits.ts；DSH 20261018）：移出本清單。
  // 5035 燼世 已拆成真 Kit（migratedHamoElementalKits.ts；DSH 20261018）：移出本清單。
  // 5035 纏根 已拆成真 Kit（migratedHamoElementalKits.ts；DSH 20261018）：移出本清單。
  // 5035 龍神·御天陣 已拆成真 Kit（migratedHamoYutianzhenKit.ts；DSH 20261018）：移出本清單。
  // arena_12 無為之境 已拆成真 Kit（migratedArena12SkillKits.ts；DSH 20261018）：移出本清單。
  // arena_12 千秋虔 已拆成真 Kit（migratedArena12SkillKits.ts；DSH 20261018 第十六批）：移出本清單。
  // arena_12 百法拜 已拆成真 Kit（migratedArena12SkillKits.ts；DSH 20261018 第十六批）：移出本清單。
  // arena_12 十玄釋 已拆成真 Kit（migratedArena12SkillKits.ts；DSH 20261018 第十六批）：移出本清單。
  // arena_12 孑身誡 已拆成真 Kit（migratedArena12SkillKits.ts；DSH 20261018 第十六批）：移出本清單。
  // arena_12 無相諦 已拆成真 Kit（migratedArena12SkillKits.ts；DSH 20261018 第十六批）：移出本清單。
  // arena_13 魂印「專屬特性」已拆成真積木（migratedArena13SoulKit.ts；DSH 20261017）：移出本清單。
  // arena_13 鋒毫浸血雨 已拆成真 Kit（migratedArena13FenghaoKit.ts；DSH 20261018）：移出本清單。
  // 艷羅劍典 已拆成真積木（migratedArena13SkillKits.ts；DSH 20261017）。
  // 萬蒼書帝錄 已拆成真積木（migratedArena13SkillKits.ts；DSH 20261017）。
  // arena_14 魂印「無極聖武」已拆成真 Kit（migratedArena14WujiSoulKit.ts；DSH 20261018）：移出本清單。
  // arena_15 命運龍輪 專屬特性已拆成真積木（migratedMoiraiSoulKit.ts；DSH 20261018）：移出本清單。
  // arena_16 魂印「龍之治癒」已拆成真 Kit（migratedArena16DragonHealingSoulKit.ts；DSH 20261018）：移出本清單。
  // 剛莖棍壓已拆成真積木（migratedArena16SkillKits.ts；DSH 20261017）：移出本清單。
  // arena_16 挨打要立正 已拆成真 Kit（migratedArena16AidaKit.ts；DSH 20261018）：移出本清單。
  // arena_16 幽魔相嘯 已拆成真 Kit（migratedArena16YoumoKit.ts；DSH 20261018）：移出本清單。
  // arena_16 雅髯獅嘯 已拆成真 Kit（migratedArena16YaranKit.ts；DSH 20261018）：移出本清單。
  // arena_16 但願不會是個怪物 已拆成真 Kit（migratedArena16MonsterKit.ts；DSH 20261018）：移出本清單。
  // 5010 魂印「海」已拆成真積木（migratedGroup5SeaSoulKit.ts；DSH 20261018 組 5）：移出本清單。
  // 王·鏽腑喰心已拆成真積木（migratedOpeiaSkillKits.ts；DSH 20261017）：移出本清單。
  // 5022 終焉·六花斬已拆成真 Kit（migratedExtraElfKits.ts；子代理G 20261018）：移出本清單。
  // 5029 魂印「異」已拆成真 Kit（migratedReyKits.ts；子代理D 20261018）：移出本清單。
  // 5029 雷神已拆成真 Kit（migratedReyKits.ts；子代理D 20261018）：移出本清單。
  // 5029 霆·禁雷敕令已拆成真 Kit（migratedReySkillKits.ts；子代理D 20261018）：移出本清單。
  // 5030 聖靈邁爾斯「聖」已拆成真 Kit（migratedHolyMilesKits.ts；DSH 20261018 第十三批）：移出本清單。
  // 5030 聖靈邁爾斯「淨世洗禮頌」已拆成真 Kit（migratedHolyMilesKits.ts；DSH 20261018 第十三批）：移出本清單。
  // 5031 六界神王 魂印「界」已拆成真 Kit（migratedLiujieSoulKit.ts；DSH 20261018 讀法B裁定＋描述改寫）：移出本清單。
  // 辟冥·鎮獄斷已拆成真積木（migratedDeluSkillKits.ts；DSH 20261017）：移出本清單。
  // 王·夜予寒吟已拆成真積木（migratedKeerhodeSkillKits.ts；DSH 20261017）：移出本清單。
  // 5016 核心重構 已拆成真 Kit（migratedFinalMarsLanDragonKits.ts；DSH 20261018）：移出本清單。
  // 5016 王·超限共頻 已拆成真 Kit（migratedFinalMarsLanDragonKits.ts；DSH 20261018）：移出本清單。
  // 械律·置換已拆成真積木（migratedWuxuShiyanSkillKits.ts；DSH 20261017）：移出本清單。
];
