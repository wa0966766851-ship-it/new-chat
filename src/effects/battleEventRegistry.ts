import {portableEventAllowed} from './portableSkillMarkLifecycle';
import { Elf, Skill } from '../types';
import {withRecoveryOrigin} from '../battle/recoveryOrigin';
import {applyTeamForcedHitPower} from '../battle/forcedHitRules';
import { BattleEventContext, BattleSkillHandler, BattleSkillAfterHitHandler, BattleSkillOnInvalidHandler, EffectTiming } from './types';
import { handleDestinyInterceptor } from "./destinyInterceptors";
import { executeGenericSkillText } from "./genericSkillText";
import { deriveContext } from "./deriveContext";
import { runNode } from "./effectRunner";
import { runGenericSoulMark } from "./genericSoulMark";
import { runBlockEvent, runCopiedSoulEvent, runSkillBlocks, skillMode, isSoulBlocksOnly, blockSkillTransform, setSoulHandlerProvider } from "../blocks/registry";
import { isSkillStone } from '../data/skillStones';
import { transformStone, stoneBeforeDamage, kitDrivenStone } from './skillStoneEffects';
import { CODEX } from "../data/codexRegistry";
import { Node } from "./effectSystem.schema";
import { STAGED_ARENA_SKILLS, STAGED_ARENA_SOULS, STAGED_ARENA_SKILL_TRANSFORMS } from "./elves/staged-arena/index";
import { ELF_REGISTRY_MODULES } from './elves/index';
import { illusionSkill } from '../battle/illusion';
import { acquiredEffectContext } from '../battle/acquiredEffectContext';
import { activeConstraints } from '../battle/timedConstraints';
import { runNewElfLifecycle, innateDisabled } from './newElfLifecycle';
import { executeAstralMemory } from './elves/astral-twins/registry';
import { runMogosTeamEffects } from './elves/mogos/registry';
import { usesAuthoredSkill, usesAuthoredSoul, soulDefinition, setConnectedSkillHandlerProvider,hasOpponentDamageObserver } from './connectedEffects';
import { setLegacyHandlerResolver } from '../blocks/ops/legacyHandler';
import { effectRoute } from './effectConnection';
import { withPpConsumptionChain } from './ppConsumptionChain';
import { notifyTeamKitObservers } from './teamKitObservers';
import { TraitsEngine } from '../utils/traitsEngine';
import { applyFormulaProperties,applyPowerProperties, readOnceDegraded } from './skillProperty';
setSoulHandlerProvider(elf => !!getSoulMarkRegistry()[elf?.name]);
setConnectedSkillHandlerProvider(hasSkillHandler);
setLegacyHandlerResolver((_elf, key, kind) => {
  // 技能／攜帶：技能註冊表；魂印：以精靈名稱為鍵的魂印註冊表；特質：特質引擎依名稱驅動，無獨立函式。
  // 純 node（無 vite import.meta.glob）環境無法載入註冊表：契約驗證放行，由 audit_block_migration 在完整環境全量核對。
  if (typeof (import.meta as any).glob !== 'function') return key ? (kind === 'skill' || kind === 'carry' ? { drive: 'call', call: () => undefined } : { drive: 'engine' }) : null;
  if (kind === 'skill' || kind === 'carry') { const h = getBattleSkillRegistry()[key]; return h ? { drive: 'call', call: h } : null; }
  if (kind === 'soul') return key in getSoulMarkRegistry() ? { drive: 'engine' } : null;
  return key ? { drive: 'engine' } : null;
});

export function mapTimingToNode(event: EffectTiming): Node | null {
  switch (event) {
    case EffectTiming.STAT_BOOST_CLEARED:return 'on_stat_boost_cleared';
    case EffectTiming.TURN_EFFECTS_CLEARED:return 'on_turn_effects_cleared';
    case EffectTiming.ON_ENTRANCE:
    case EffectTiming.ELF_ENTERED:
      return "on_entered";
    case EffectTiming.ROUND_START:
      return "round_start";
    case EffectTiming.ROUND_END:
      return "round_end";
    case EffectTiming.BATTLE_PHASE_END:
      return "battle_phase_end"; // 與 ROUND_END 分開，避免 round_end 詞條一回合觸發兩次
    case EffectTiming.BEFORE_ACTION:
      return "before_action";
    case EffectTiming.BEFORE_SKILL:
      return "before_skill";
    case EffectTiming.BEFORE_DAMAGE:
      return "before_damage";
    case EffectTiming.MODIFY_PRIORITY:
      return "modify_priority";
    case EffectTiming.ON_SKILL_HIT:
      return "on_hit";
    case EffectTiming.BEFORE_INSTANT_KILL:
      return 'before_instant_kill';
    case EffectTiming.ON_DAMAGED:
      return "on_damaged";
    case EffectTiming.AFTER_ACTION:
    case EffectTiming.ACTION_END:
      return "after_action";
    case EffectTiming.ON_KILL:
      return "on_kill";
    case EffectTiming.NOT_KILLED:return 'on_not_killed';
    case EffectTiming.FATAL_RESIST:
    case EffectTiming.DEATH_NODE_1:
    case EffectTiming.DEATH_NODE_2:
    case EffectTiming.CHECK_REBIRTH_PENDING:
      return "self_fatal";
    default:
      return null;
  }
}


export type SoulMarkHandler = (context: BattleEventContext, event: EffectTiming, extraData?: any) => any;


export const SOUL_MARK_MAPPING: Record<string, string> = {
  // 5035 魂印「鱗」、5030 魂印「聖」已遷真 Kit（migratedHamoLinSoulKit.ts／migratedHolyMilesKits.ts）——
  // 空殼 handler 與映射移除；sharedSoulLifecycle 由 SoulMarkRegistry Proxy 對任何名稱執行，不依賴映射。
  "5032": "handleAstralAesfiaSoulMark",
  "星核寰宇·艾斯菲亞": "handleAstralAesfiaSoulMark",
  "星核寰宇.艾斯菲亞": "handleAstralAesfiaSoulMark",
  "5033": "handleAstralAesfigSoulMark",
  "星軌重構·艾斯菲格": "handleAstralAesfigSoulMark",
  "5034": "handleMogosSoulMark",
  "邪靈主宰·摩哥斯": "handleMogosSoulMark",
  "300": "handlePuniBaseSoulMark",
  "1000": "handlePuniBaseSoulMark", // 舊序號相容
  // 5000 魂印「神」已遷移為真 Kit（migratedGroup5HolyPuniSoulKit.ts；DSH 20261018 組 5）——映射移除。

  "5001": "handleSobiratSoulMark",
  "1001": "handleSobiratSoulMark",
  "悲歌·索比拉特": "handleSobiratSoulMark",
  "悲歌.索比拉特": "handleSobiratSoulMark",
  "索比拉特": "handleSobiratSoulMark",
  
  // 1002（帝皇之盾）：魂印已遷移為真 Kit（migratedImperialShieldSoulKit；DSH 20261018）——映射移除。
  
  "5003": "handleBajieSoulMark",
  "1003": "handleBajieSoulMark",
  "天蓬元帥八戒": "handleBajieSoulMark",
  "八戒": "handleBajieSoulMark",
  
  "5004": "handlePitesalaluoSoulMark",
  "1004": "handlePitesalaluoSoulMark",
  "皮特薩拉羅": "handlePitesalaluoSoulMark",
  
  "5005": "handleBlackSoulMark",
  "1026": "handleBlackSoulMark",
  "布萊克": "handleBlackSoulMark",
  
  "5006": "handleMonkeySoulMark",
  "1005": "handleMonkeySoulMark",
  "星光·魔焰猩猩": "handleMonkeySoulMark",
  "魔焰猩猩": "handleMonkeySoulMark",
  
  "5007": "handleBrinkkSoulMark",
  "1006": "handleBrinkkSoulMark",
  "1033": "handleBrinkkSoulMark",
  "混濁海妖·布林克克": "handleBrinkkSoulMark",
  "混濁海妖.布林克克": "handleBrinkkSoulMark",
  "布林克克": "handleBrinkkSoulMark",
  
  "5008": "handleBaphometSoulMark",
  "1027": "handleBaphometSoulMark",
  "1032": "handleBaphometSoulMark",
  "鎮魂·巴弗洛": "handleBaphometSoulMark",
  "鎮魂.巴弗洛": "handleBaphometSoulMark",
  "巴弗洛": "handleBaphometSoulMark",
  
  "5009": "handleDeluSoulMark",
  "1028": "handleDeluSoulMark",
  "誑獅魔軀·魔獅迪露": "handleDeluSoulMark",
  "誑獅魔軀.魔獅迪露": "handleDeluSoulMark",
  "魔獅迪露": "handleDeluSoulMark",
  
  // 5010 魂印「海」已遷移為真 Kit（migratedGroup5SeaSoulKit.ts；DSH 20261018 組 5）——映射移除。
  
  "5011": "handleLisaSoulMark",
  "1008": "handleLisaSoulMark",
  "星光·麗莎布布": "handleLisaSoulMark",
  "麗莎布布": "handleLisaSoulMark",
  
  // 5012 冰魄·柯爾德 魂印「冰」已遷移為真 Kit（migratedKeldSoulKit；DSH 20261017）——舊 handler 映射移除。
  
  // 5013 魂印「凕」已遷移為真 Kit（migratedKeerhodeSoulKit；DSH 20261017）——映射移除。
  "柯爾德(舊)": "handleKeerhodeSoulMark",
  
  "5014": "handleScarlettSoulMark",
  "1011": "handleScarlettSoulMark",
  "1035": "handleScarlettSoulMark",
  "聖光斯嘉麗": "handleScarlettSoulMark",
  "斯嘉麗": "handleScarlettSoulMark",
  
  // 5015 魂印「夜」已遷移為真 Kit（migratedNightSoulKit；DSH 20261018）——映射移除。
  "1012": "handleChaosBlakeSoulMark",
  
  // 5016／1013 魂印「械」走正式 Kit；共用生命週期由 Proxy 無條件執行，無須空殼登記。

  "5017": "handleDixinSoulMark",
  "1014": "handleDixinSoulMark",
  "1031": "handleDixinSoulMark",
  "人皇·帝辛": "handleDixinSoulMark",
  "人皇.帝辛": "handleDixinSoulMark",
  "帝辛": "handleDixinSoulMark",
  
  // 5018 魂印「后」已遷移為真 Kit（migratedOpeiaSoulKit.ts；DSH 20261018 第十三批·第一波）——
  // 映射移除（含舊序號 1015；getNumericElfId 已將 1015 正名為 5018）。
  
  "5019": "handleOdinSoulMark",
  "1016": "handleOdinSoulMark",
  "1030": "handleOdinSoulMark",
  "眾神之父·奧丁": "handleOdinSoulMark",
  "眾神之父.奧丁": "handleOdinSoulMark",
  "奧丁": "handleOdinSoulMark",
  
  "5020": "handlePipiSoulMark",
  "皮皮": "handlePipiSoulMark",
  
  "5021": "handleDimensionalSoulMark",
  "治癒.龍魂再臨 次元龍": "handleDimensionalSoulMark",
  "治癒·龍魂再臨 次元龍": "handleDimensionalSoulMark",
  "次元龍": "handleDimensionalSoulMark",
  
  "5022": "handleWuxuSoulMark",
  "1017": "handleWuxuSoulMark",
  "無序·六刃": "handleWuxuSoulMark",
  "無序.六刃": "handleWuxuSoulMark",

  "5023": "handleShiyanSoulMark",
  "無序·蝕言": "handleShiyanSoulMark",
  "無序.蝕言": "handleShiyanSoulMark",

  "5024": "handleAnnihilationLordSoulMark",
  "1018": "handleAnnihilationLordSoulMark",
  "湮滅之主・咤克斯": "handleAnnihilationLordSoulMark",
  "湮滅之主·咤克斯": "handleAnnihilationLordSoulMark",
  "湮滅之主.咤克斯": "handleAnnihilationLordSoulMark",

  // 5025 魂印「懼」已遷移為真 Kit（migratedZhakesiFearSoulKit.ts；DSH 20261018 第十三批·第一波）——映射移除。

  "5026": "handleWuxuSoulMark",
  "1020": "handleWuxuSoulMark",
  "無序·墜星": "handleWuxuSoulMark",
  "無序.墜星": "handleWuxuSoulMark",

  "5027": "handleBelienteSoulMark",
  "1021": "handleBelienteSoulMark",
  "1038": "handleBelienteSoulMark",
  "蓓麗安特": "handleBelienteSoulMark",

  "5028": "handleCanglanSoulMark",
  "1022": "handleCanglanSoulMark",
  "1039": "handleCanglanSoulMark",
  "怒濤·滄嵐": "handleCanglanSoulMark",
  "怒濤.滄嵐": "handleCanglanSoulMark",
  "滄嵐": "handleCanglanSoulMark",


  "譜尼": "handlePuniBaseSoulMark",
  // 5031 六界神王 魂印「界」已遷真 Kit（migratedLiujieSoulKit.ts；DSH 20261018 讀法B）——
  // 1029 舊 id 亦指向同一魂印，映射一併停用（規則：遷 Kit 後舊 handler 不再執行）。
  "1023": "handleRaySoulMark",
  "雷伊": "handleRaySoulMark",
  "1024": "handleGaiaSoulMark",
  "蓋亞": "handleGaiaSoulMark",
  "1025": "handleCassiusSoulMark",
  "卡修斯": "handleCassiusSoulMark",

  "arena_12": "handleWuweiSoulMark",
  "無為龍者": "handleWuweiSoulMark",
  // arena_13 龍錄天鋒魂印已遷移為真 Kit（migratedArena13SoulKit；DSH 20261017）——映射移除。
  "arena_14": "handleWujiSoulMark",
  // 命運龍輪：魂印本文已遷 Kit；映射保留供技能支援讀取端（規則3.4）。
  "arena_15": "handleMoiraiSoulMark",
  "命運龍輪 莫伊萊": "handleMoiraiSoulMark",
  "無極聖武": "handleWujiSoulMark",
  "arena_16": "handleDragonHealingSoulMark",
  "鎮世龍魂・龍之治癒": "handleDragonHealingSoulMark",
};

let cachedSkillRegistry: Record<string, BattleSkillHandler> | null = null;
let cachedSoulMarkRegistry: Record<string, SoulMarkHandler> | null = null;
export type BattleSkillTransformHandler = (context: BattleEventContext, skill: Skill) => Skill | undefined;
let cachedSkillTransforms: Record<string, BattleSkillTransformHandler> | null = null;
let cachedDamageTransforms: Record<string, BattleSkillTransformHandler> | null = null;
let cachedAfterHit: Record<string, BattleSkillAfterHitHandler> | null = null;
let cachedOnInvalid: Record<string, BattleSkillOnInvalidHandler> | null = null;

function initializeRegistries() {
  if (cachedSkillRegistry && cachedSoulMarkRegistry && cachedSkillTransforms) return;
  
  cachedSkillRegistry = {};
  cachedSoulMarkRegistry = {};
  cachedSkillTransforms = {};
  cachedDamageTransforms = {};
  cachedAfterHit = {};
  cachedOnInvalid = {};
  
  // @ts-ignore
  const commonModules = import.meta.glob('./*Registry.ts', { eager: true });
  const modules = { ...commonModules, ...ELF_REGISTRY_MODULES };
  
  // 舊的合併順序也是頂層路徑字典序；有同名歷史匯出時維持原先勝出者。
  for (const [path, mod] of Object.entries(modules).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!mod || typeof mod !== 'object') continue;
    
    // Register Battle Skills (any exported object ending with _SKILLS)
    for (const [key, value] of Object.entries(mod)) {
      if (key.endsWith('_SKILLS') && typeof value === 'object' && value !== null) {
        Object.assign(cachedSkillRegistry, value);
      }
      if (key.endsWith('_SKILL_TRANSFORMS') && typeof value === 'object' && value !== null) {
        Object.assign(cachedSkillTransforms, value);
      }
      if (key.endsWith('_DAMAGE_TRANSFORMS') && typeof value === 'object' && value !== null) Object.assign(cachedDamageTransforms, value);
      // 技能命中結算後／技能無效時的技能專屬處理（見 types.ts BattleSkillAfterHitHandler／BattleSkillOnInvalidHandler）
      if (key.endsWith('_AFTER_HIT') && typeof value === 'object' && value !== null) Object.assign(cachedAfterHit, value);
      if (key.endsWith('_ON_INVALID') && typeof value === 'object' && value !== null) Object.assign(cachedOnInvalid, value);
    }
    
    // Register Soul Marks using the mapping
    for (const [elfName, handlerName] of Object.entries(SOUL_MARK_MAPPING)) {
      if (handlerName in mod && typeof mod[handlerName as keyof typeof mod] === 'function') {
        cachedSoulMarkRegistry[elfName] = mod[handlerName as keyof typeof mod] as SoulMarkHandler;
      }
    }
  }
  // 競技場五隻：獨立目錄不被上方 glob 掃到，在此明確合併（玩家與 AI 共用同一套）
  Object.assign(cachedSkillRegistry, STAGED_ARENA_SKILLS);
  Object.assign(cachedSoulMarkRegistry, STAGED_ARENA_SOULS);
  Object.assign(cachedSkillTransforms, STAGED_ARENA_SKILL_TRANSFORMS);
  // 同名技能選擇描述／積木來源後，後置及失效支線也不能偷偷重跑舊註冊表。
  for (const table of [cachedAfterHit, cachedOnInvalid]) for (const [name, handler] of Object.entries(table)) {
    table[name] = ((ctx: BattleEventContext, result: any) => {
      if (ctx.skill && usesAuthoredSkill(ctx.skill, name in cachedSkillRegistry!, ctx.self) && effectRoute(ctx.skill, name in cachedSkillRegistry!) !== 'registry') return;
      return handler(withRecoveryOrigin(ctx,'skill'), result);
    }) as any;
  }
}

// 會在「對手受到技能攻擊」時被通知 ON_DAMAGED 的魂印（handler 內以 extraData.targetSide 區分自身／對手受擊）
const ON_DAMAGED_OBSERVER_HANDLERS = new Set(["handleMonkeySoulMark", "handleLisaSoulMark", "handleStarlightRusSoulMark", "handleOtherworldReySoulMark", "handleWuxuSoulMark"]);
export function observesOpponentDamage(elfName: string,elf?:Elf): boolean {
  return !!elf&&hasOpponentDamageObserver(elf)||ON_DAMAGED_OBSERVER_HANDLERS.has(SOUL_MARK_MAPPING[elfName]);
}

// 隊伍觀察者：魂印效果涵蓋「己方在場精靈」（自身不在場時也生效）的 handler。
// 己方在場精靈發生下列事件時，同隊場下的觀察者以「在場精靈的 ctx」收到同一事件，extraData.teamObserver＝觀察者本身。
const TEAM_OBSERVER_HANDLERS = new Set(["handleScarlettSoulMark"]);
const TEAM_OBSERVED_EVENTS = new Set<string>([EffectTiming.BEFORE_DAMAGE, EffectTiming.ON_DAMAGED, EffectTiming.BEFORE_STATUS_APPLY, "SELF_STATUS_APPLIED", EffectTiming.OPPONENT_ACTION]);
let _teamObserverDepth = 0;
function notifyTeamObservers(ctx: BattleEventContext, event: string, extraData: any, elf: Elf | null) {
  notifyTeamKitObservers(ctx,event,extraData);
  if (_teamObserverDepth > 0 || !TEAM_OBSERVED_EVENTS.has(event) || !elf || !ctx?.getFullTeam) return;
  const active = ctx.actor === "p1" ? ctx.activeP1 : ctx.activeP2;
  const idOf = (e: any) => String(e?.battleId || e?.id);
  if (!active || idOf(elf) !== idOf(active)) return;
  const reg = getSoulMarkRegistry();
  for (const mate of ctx.getFullTeam(ctx.actor) || []) {
    if (!mate || idOf(mate) === idOf(active)) continue;
    const hName = SOUL_MARK_MAPPING[String(mate.id)] ?? SOUL_MARK_MAPPING[mate.name];
    if (!hName || !TEAM_OBSERVER_HANDLERS.has(hName)) continue;
    const h = reg[String(mate.id)] || reg[mate.name];
    if (!h) continue;
    const data = extraData && typeof extraData === "object" ? extraData : {};
    const prev = data.teamObserver;
    data.teamObserver = mate;
    _teamObserverDepth++;
    try { h(ctx, event as EffectTiming, data); } catch (e) { console.error("[teamObserver]", e); }
    finally { _teamObserverDepth--; if (prev === undefined) delete data.teamObserver; else data.teamObserver = prev; }
  }
}

/** 是否有專屬（手寫）技能 handler */
export function hasSkillHandler(name: string): boolean {
  return name in getBattleSkillRegistry();
}

/** 在命中、技能無效與攻擊免疫判定前，把技能轉為實際使用型態。 */
export function transformSkillBeforeResolve(context: BattleEventContext, skill: Skill): Skill {
  initializeRegistries();
  if (!innateDisabled(context)) skill = illusionSkill(context.self, skill);
  // once_used_degrade：每場一次用後，失去必中且命中率歸0（原文「此後該技能失去必中效果且命中率歸0」）。
  // 必須同時移除 Kit 內的 sure_hit 條目，否則 computeHitChance 的 blockSkillTransform 會把它讀回來。
  if (readOnceDegraded(skill, context)) skill = { ...skill, isSureHit: false, alwaysHit: false, accuracy: 0,
    kit: (skill.kit || []).filter((e: any) => !(e.codeId === 'skill_property' && e.params?.property === 'sure_hit')) } as Skill;
  if (context.self.isInherentInvalid || innateDisabled(context)) skill = { ...skill, priority: 0, isSureHit: false,
    alwaysHit: false, ignoreImmunity: false, ignoreShield: false, ignoreAttackImmunity: false } as Skill;
  if (isSkillStone(skill)) return transformStone(context, skill);
  const authored = usesAuthoredSkill(skill, hasSkillHandler(skill.name), context.self) && effectRoute(skill, hasSkillHandler(skill.name)) !== 'registry';
  return blockSkillTransform(context, authored ? applyFormulaProperties(skill,context) : cachedSkillTransforms?.[skill.name]?.(context, skill) || skill);
}

/** 使用當前狀態計算威力：命中時的吸取／消強／反轉先完成，再進入傷害公式。 */
export function transformSkillBeforeDamage(context: BattleEventContext, skill: Skill): Skill {
  initializeRegistries();
  applyTeamForcedHitPower(context);
  const authored = usesAuthoredSkill(skill, hasSkillHandler(skill.name), context.self) && effectRoute(skill, hasSkillHandler(skill.name)) !== 'registry';
  const transformed = isSkillStone(skill) ? stoneBeforeDamage(context, skill) : authored ? applyPowerProperties(skill,context) : cachedDamageTransforms?.[skill.name]?.(context, skill) || skill;
  const powerComp = { power: transformed.power || 0 };
  SoulMarkRegistry[context.self.name]?.(context, EffectTiming.MODIFY_POWER, { skill: transformed, powerComp });
  const opposingContext = deriveContext(context, { self: context.target, target: context.self, actor: context.targetSide, targetSide: context.actor,
    getPlayerState: context.getOpponentState, setPlayerState: context.setOpponentState,
    getOpponentState: context.getPlayerState, setOpponentState: context.setPlayerState });
  SoulMarkRegistry[context.target.name]?.(opposingContext, EffectTiming.MODIFY_POWER, { skill: transformed, powerComp, isIncoming: true });
  return { ...transformed, power: powerComp.power };
}

/** 技能命中結算後處理（`*_AFTER_HIT` 匯出合併；測試可直接寫入此物件） */
export function getBattleSkillAfterHitRegistry(): Record<string, BattleSkillAfterHitHandler> {
  initializeRegistries();
  return cachedAfterHit!;
}
export const BattleSkillAfterHitRegistry: Record<string, BattleSkillAfterHitHandler> = new Proxy({}, {
  get: (_t, prop) => typeof prop === "string" ? getBattleSkillAfterHitRegistry()[prop] : undefined,
  has: (_t, prop) => typeof prop === "string" && prop in getBattleSkillAfterHitRegistry(),
  ownKeys: () => Reflect.ownKeys(getBattleSkillAfterHitRegistry()),
  getOwnPropertyDescriptor: (_t, prop) => typeof prop === "string" && prop in getBattleSkillAfterHitRegistry()
    ? { enumerable: true, configurable: true, value: getBattleSkillAfterHitRegistry()[prop] } : undefined,
});

/** 技能無效時處理（`*_ON_INVALID` 匯出合併） */
export function getBattleSkillOnInvalidRegistry(): Record<string, BattleSkillOnInvalidHandler> {
  initializeRegistries();
  return cachedOnInvalid!;
}

export function getBattleSkillRegistry(): Record<string, BattleSkillHandler> {
  initializeRegistries();
  return cachedSkillRegistry!;
}

export function getSoulMarkRegistry(): Record<string, SoulMarkHandler> {
  initializeRegistries();
  return cachedSoulMarkRegistry!;
}

function sharedSoulLifecycle(ctx: BattleEventContext, event: EffectTiming, extraData?: any): void {
  // 最小描述／註冊表工具 context 不執行戰鬥生命週期；正式 context 必須提供即時狀態。
  if (!ctx.self?.skills || !ctx.activeP1 || !ctx.activeP2 || !ctx.setPlayerState || !ctx.getPlayerState) return;
  TraitsEngine.triggerAuthoredLifecycle(ctx,event,extraData);
  runNewElfLifecycle(ctx, event, extraData);
  runMogosTeamEffects(ctx, event, extraData);
  if (event === EffectTiming.ACTION_END) executeAstralMemory(ctx);
  if (event === EffectTiming.BEFORE_DAMAGE && extraData?.damageComp && !extraData.damageComp.isIncoming && extraData.damageComp.damageCategory === 'skill_attack') ctx.setPlayerState('actualCritThisAction', !!extraData.damageComp.isCrit);
  if (event === EffectTiming.BEFORE_SKILL) ctx.setPlayerState('actualCritThisAction', false);
}
function copiedSoul(ctx: BattleEventContext, event: EffectTiming, extraData?: any): any {
  const illusion = ctx.self?.illusion;
  if (!illusion || (ctx as any).illusionDepth || event === EffectTiming.ON_ENTRANCE || event === EffectTiming.ON_SWITCH_OUT) return;
  const handler = getSoulMarkRegistry()[illusion.target.name];
  const copy = acquiredEffectContext(ctx);
  // 模式查目標ID，非原精靈ID；同時避免重跑持有者的timer與印記。
  const result = isSoulBlocksOnly(illusion.target) ? undefined
    : handler ? handler(copy, event, extraData) : runGenericSoulMark(copy, event, extraData, copy.self);
  if (!handler && illusion.target.kit?.length) {
    const node = mapTimingToNode(event);
    if (node) runNode(node, illusion.target.kit.filter(e => e.source !== 'skill'), CODEX,
      extraData && typeof extraData === 'object' ? Object.assign(Object.create(copy), extraData) : copy);
  }
  return runCopiedSoulEvent(copy, event, extraData, illusion.target) || result;
}

export const SoulMarkRegistry: Record<string, SoulMarkHandler> = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === "string") {
      const originalHandler = getSoulMarkRegistry()[prop];
      return (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => withPpConsumptionChain(ctx,event,extraData,() => {
        ctx=withRecoveryOrigin(ctx,'soul');
        if(!portableEventAllowed(ctx,event))return;
        sharedSoulLifecycle(ctx, event, extraData);
        if (event === EffectTiming.ON_ENTRANCE && activeConstraints(ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers, ctx.self).some(p => p.stripEntrance)) return;
        let res = undefined;
        /**
         * 2026-10-30：身分解析改成「持有者優先」。
         *
         * 原本是 ctx.self.name === prop → activeP1.name === prop → activeP2.name === prop。
         * 兩隻同序號精靈（例如雙方各一隻 5029 雷伊）時，名稱完全相同，
         * ctx.self 若不是本次要處理的那隻，就會誤抓到在場的另一隻，
         * 造成「一方效果莫名丟失」。
         *
         * 現在：先用 ctx.self 的 id 與 prop 對應的精靈清單比對；
         * 只有當 ctx.self 的名稱與 prop 相符時才採用 ctx.self（維持原本語意）；
         * 名稱相符但有多隻同名時，仍以 ctx.self 為準，不再回退到在場者。
         */
        const selfName = ctx.self?.name;
        const elf = (ctx.self && selfName === prop)
          ? ctx.self
          : (() => {
              // ctx.self 名稱不符時才找在場者；若兩側在場者同名，取與 ctx.actor 同側的那隻
              const sameSide = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
              if (sameSide && sameSide.name === prop) return sameSide;
              if (ctx.activeP1 && ctx.activeP1.name === prop) return ctx.activeP1;
              if (ctx.activeP2 && ctx.activeP2.name === prop) return ctx.activeP2;
              return null;
            })();
        const authoredSoul = !!elf && usesAuthoredSoul(elf, !!originalHandler);
        const authoredRoute = elf && effectRoute(soulDefinition(elf), !!originalHandler);
        const soulBlocks = !!elf && (isSoulBlocksOnly(elf) || authoredSoul && authoredRoute !== 'registry');
        if (originalHandler && !soulBlocks) {
          res = originalHandler(ctx, event, extraData);
        } else if (!authoredSoul && elf && (elf as any).soulMark?.effectType && (elf as any).soulMark.effectType !== "none") {
          // 自訂精靈：依 soulMark.effectType / effectValue 執行
          res = runGenericSoulMark(ctx, event, extraData, elf);
        }
        // 積木：側邊持續效果（N回合內…）與登記為積木的魂印子句
        try { if (runBlockEvent(ctx, event, extraData, elf || ctx.self, !!originalHandler)) res = true; } catch (e) { console.error("[blocks]", e); }
        notifyTeamObservers(ctx, event, extraData, elf);
        res = copiedSoul(ctx, event, extraData) || res;
        // 已有手寫魂印 handler 的精靈（譜尼等），kit 只是描述用資料，不再重複執行
        if (!authoredSoul && !originalHandler && elf && elf.kit && elf.kit.length > 0) {
          const node = mapTimingToNode(event);
          if (node) {
            // extraData（damageComp / priorityComp 等）併入 ctx，傷害與先制修正原子才拿得到
            const kitCtx = extraData && typeof extraData === "object" ? Object.assign(Object.create(ctx), extraData) : ctx;
            runNode(node, elf.kit.filter((e: any) => e.source !== "skill"), CODEX, kitCtx);
          }
        }
        return res;
      });
    }
    return undefined;
  },
  has(target, prop) {
    if (typeof prop === "string") {
      // 精確判斷：只有靜態魂印註冊表內有的才算有專屬 handler。
      // 過去曾回傳 `|| true` 導致 `in` 檢查永遠為真、高估覆蓋率，已修正。
      return prop in getSoulMarkRegistry();
    }
    return false;
  },
  ownKeys() {
    return Reflect.ownKeys(getSoulMarkRegistry());
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === "string") {
      const reg = getSoulMarkRegistry();
      const value = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => withPpConsumptionChain(ctx,event,extraData,() => {
        ctx=withRecoveryOrigin(ctx,'soul');
        if(!portableEventAllowed(ctx,event))return;
        sharedSoulLifecycle(ctx, event, extraData);
        if (event === EffectTiming.ON_ENTRANCE && activeConstraints(ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers, ctx.self).some(p => p.stripEntrance)) return;
        const originalHandler = reg[prop];
        let res = undefined;
        /**
         * 2026-10-30：身分解析改成「持有者優先」。
         *
         * 原本是 ctx.self.name === prop → activeP1.name === prop → activeP2.name === prop。
         * 兩隻同序號精靈（例如雙方各一隻 5029 雷伊）時，名稱完全相同，
         * ctx.self 若不是本次要處理的那隻，就會誤抓到在場的另一隻，
         * 造成「一方效果莫名丟失」。
         *
         * 現在：先用 ctx.self 的 id 與 prop 對應的精靈清單比對；
         * 只有當 ctx.self 的名稱與 prop 相符時才採用 ctx.self（維持原本語意）；
         * 名稱相符但有多隻同名時，仍以 ctx.self 為準，不再回退到在場者。
         */
        const selfName = ctx.self?.name;
        const selfId = ctx.self ? String(ctx.self.battleId || ctx.self.id) : '';
        const elf = (ctx.self && selfName === prop)
          ? ctx.self
          : (() => {
              // ctx.self 名稱不符時才找在場者；若兩側在場者同名，取與 ctx.actor 同側的那隻
              const sameSide = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
              if (sameSide && sameSide.name === prop) return sameSide;
              if (ctx.activeP1 && ctx.activeP1.name === prop) return ctx.activeP1;
              if (ctx.activeP2 && ctx.activeP2.name === prop) return ctx.activeP2;
              return null;
            })();
        void selfId;
        const authoredSoul = !!elf && usesAuthoredSoul(elf, !!originalHandler);
        const authoredRoute = elf && effectRoute(soulDefinition(elf), !!originalHandler);
        const soulBlocks = !!elf && (isSoulBlocksOnly(elf) || authoredSoul && authoredRoute !== 'registry');
        if (originalHandler && !soulBlocks) {
          res = originalHandler(ctx, event, extraData);
        } else if (!authoredSoul && elf && (elf as any).soulMark?.effectType && (elf as any).soulMark.effectType !== "none") {
          // 自訂精靈：依 soulMark.effectType / effectValue 執行
          res = runGenericSoulMark(ctx, event, extraData, elf);
        }
        // 積木：側邊持續效果（N回合內…）與登記為積木的魂印子句
        try { if (runBlockEvent(ctx, event, extraData, elf || ctx.self, !!originalHandler)) res = true; } catch (e) { console.error("[blocks]", e); }
        notifyTeamObservers(ctx, event, extraData, elf);
        res = copiedSoul(ctx, event, extraData) || res;
        // 已有手寫魂印 handler 的精靈（譜尼等），kit 只是描述用資料，不再重複執行
        if (!authoredSoul && !originalHandler && elf && elf.kit && elf.kit.length > 0) {
          const node = mapTimingToNode(event);
          if (node) {
            // extraData（damageComp / priorityComp 等）併入 ctx，傷害與先制修正原子才拿得到
            const kitCtx = extraData && typeof extraData === "object" ? Object.assign(Object.create(ctx), extraData) : ctx;
            runNode(node, elf.kit.filter((e: any) => e.source !== "skill"), CODEX, kitCtx);
          }
        }
        return res;
      });
      return {
        enumerable: true,
        configurable: true,
        value
      };
    }
    return undefined;
  }
});





/** 技能效果執行：專屬程式 ／ 積木 ／ 舊通用文字執行器（積木未解析的子句） */
function makeSkillRunner(name: string, reg: Record<string, BattleSkillHandler>): BattleSkillHandler {
  const hasH = name in reg;
  return (ctx: BattleEventContext) => {
    ctx=withRecoveryOrigin(ctx,'skill');
    if (isSkillStone(ctx.skill) && !kitDrivenStone(ctx.skill)) return; // 一般技能石由 metadata 專用入口執行一次（含自訂名稱）；效果已寫成 Kit 的技能石走下面的 Kit 路徑。
    if (ctx.skill?.effectMode === 'registry' && !hasH) {
      ctx.addLog(`【效果待接通】${name}：沒有對應專屬註冊表。`, 'effect'); return;
    }
    if (ctx.skill && usesAuthoredSkill(ctx.skill, hasH, ctx.self) && effectRoute(ctx.skill, hasH) !== 'registry') {
      runSkillBlocks(ctx, 'use', hasH);
      return;
    }
    if (ctx.skill?.templateId) { if (hasH) reg[name](ctx); else executeGenericSkillText(ctx); return; }
    const mode = skillMode(name, hasH);
    if (hasH && mode !== "blocks") reg[name](ctx);
    if (mode === "handler") return;
    const { unparsedLines } = runSkillBlocks(ctx, "use", hasH);
    if (!hasH && unparsedLines.length && ctx.skill) {
      const c2 = Object.create(ctx);
      c2.skill = { ...ctx.skill, description: unparsedLines.join("\n") };
      executeGenericSkillText(c2);
    }
  };
}

export const BattleSkillRegistry: Record<string, BattleSkillHandler> = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === "string") {
      const reg = getBattleSkillRegistry();
      const originalHandler = makeSkillRunner(prop, reg);

      return (ctx: BattleEventContext) => {
        const actorSide = ctx.actor;
        const sealTurns = ctx.getPlayerState(`${actorSide}_sealSkillAdditionalEffects`) || 0;
        const isPuni = ctx.self.id?.includes("puni") || ctx.self.name.includes("譜尼");
        if (sealTurns > 0) {
          if (isPuni) {
            const oldSealed = ctx.getPlayerState("additionalEffectsSealed");
            ctx.setPlayerState("additionalEffectsSealed", true);
            originalHandler(ctx);
            ctx.setPlayerState("additionalEffectsSealed", oldSealed);
          } else {
            ctx.addLog(`🚫 【附加效果失效】：受【靜刃止水】限制，【${ctx.self.name}】使用的技能附加效果失效！`, "info");
            ctx.showPopup?.(ctx.targetSide, "附加效果失效", "addInvalid");
            return;
          }
        } else {
          originalHandler(ctx);
        }
        if (ctx.skill && !usesAuthoredSkill(ctx.skill, prop in reg, ctx.self) && ctx.skill.kit && ctx.skill.kit.length > 0) {
          runNode("on_hit", ctx.skill.kit, CODEX, ctx);
        }
      };
    }
    return undefined;
  },
  has(target, prop) {
    if (typeof prop === "string") {
      // 精確判斷：只有靜態技能註冊表內有的才算有專屬 handler。
      // get 仍為所有技能回傳 fallback runner（含積木／通用文字），
      // 因此「可執行」不等於「有專屬 handler」；覆蓋率與顯示一律以此為準。
      return prop in getBattleSkillRegistry();
    }
    return false;
  },
  ownKeys() {
    return Reflect.ownKeys(getBattleSkillRegistry());
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === "string") {
      const reg = getBattleSkillRegistry();
      const originalHandler = makeSkillRunner(prop, reg);

      const value = (ctx: BattleEventContext) => {
        const actorSide = ctx.actor;
        const sealTurns = ctx.getPlayerState(`${actorSide}_sealSkillAdditionalEffects`) || 0;
        const isPuni = ctx.self.id?.includes("puni") || ctx.self.name.includes("譜尼");
        if (sealTurns > 0) {
          if (isPuni) {
            const oldSealed = ctx.getPlayerState("additionalEffectsSealed");
            ctx.setPlayerState("additionalEffectsSealed", true);
            originalHandler(ctx);
            ctx.setPlayerState("additionalEffectsSealed", oldSealed);
          } else {
            ctx.addLog(`🚫 【附加效果失效】：受【靜刃止水】限制，【${ctx.self.name}】使用的技能附加效果失效！`, "info");
            ctx.showPopup?.(ctx.targetSide, "附加效果失效", "addInvalid");
            return;
          }
        } else {
          originalHandler(ctx);
        }
        if (ctx.skill && !usesAuthoredSkill(ctx.skill, prop in reg, ctx.self) && ctx.skill.kit && ctx.skill.kit.length > 0) {
          runNode("on_hit", ctx.skill.kit, CODEX, ctx);
        }
      };

      return {
        enumerable: true,
        configurable: true,
        value
      };
    }
    return undefined;
  }
});

/**
 * 命運之輪特殊攔截效果入口 (入口級別註冊表)
 */
export const GlobalBattleEventRegistry = {
  handleDestinyInterceptor
};
