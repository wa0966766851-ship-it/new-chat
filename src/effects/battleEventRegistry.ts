import { Elf, Skill } from '../types';
import { BattleEventContext, BattleSkillHandler, EffectTiming } from './types';
import { handleDestinyInterceptor } from "./destinyInterceptors";
import { executeGenericSkillText } from "./genericSkillText";
import { runNode } from "./effectRunner";
import { runGenericSoulMark } from "./genericSoulMark";
import { runBlockEvent, runSkillBlocks, skillMode, isSoulBlocksOnly } from "../blocks/registry";
import { CODEX } from "../data/codexRegistry";
import { Node } from "./effectSystem.schema";
import { STAGED_ARENA_SKILLS, STAGED_ARENA_SOULS, STAGED_ARENA_SKILL_TRANSFORMS } from "./stagedArena/index";

export function mapTimingToNode(event: EffectTiming): Node | null {
  switch (event) {
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
    case EffectTiming.ON_DAMAGED:
      return "on_damaged";
    case EffectTiming.AFTER_ACTION:
    case EffectTiming.ACTION_END:
      return "after_action";
    case EffectTiming.ON_KILL:
      return "on_kill";
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
  "5030": "handleHolyMilesSoulMark",
  "聖靈邁爾斯": "handleHolyMilesSoulMark",
  "300": "handlePuniBaseSoulMark",
  "1000": "handlePuniBaseSoulMark", // 舊序號相容
  "5000": "handleShenglingPuniSoulMark",

  "5001": "handleSobiratSoulMark",
  "1001": "handleSobiratSoulMark",
  "悲歌·索比拉特": "handleSobiratSoulMark",
  "悲歌.索比拉特": "handleSobiratSoulMark",
  "索比拉特": "handleSobiratSoulMark",
  
  "5002": "handleImperialShieldSoulMark",
  "1002": "handleImperialShieldSoulMark",
  "帝皇之盾": "handleImperialShieldSoulMark",
  
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
  
  "5010": "handleStarlightRusSoulMark",
  "1007": "handleStarlightRusSoulMark",
  "星光·魯斯王": "handleStarlightRusSoulMark",
  "魯斯王": "handleStarlightRusSoulMark",
  
  "5011": "handleLisaSoulMark",
  "1008": "handleLisaSoulMark",
  "星光·麗莎布布": "handleLisaSoulMark",
  "麗莎布布": "handleLisaSoulMark",
  
  "5012": "handleKeldSoulMark",
  "1009": "handleKeldSoulMark",
  "1034": "handleKeldSoulMark",
  "冰魄·柯爾德": "handleKeldSoulMark",
  "冰魄.柯爾德": "handleKeldSoulMark",
  "柯爾德": "handleKeldSoulMark",
  
  "5013": "handleKeerhodeSoulMark",
  "1010": "handleKeerhodeSoulMark",
  "柯爾霍德": "handleKeerhodeSoulMark",
  "柯爾德(舊)": "handleKeerhodeSoulMark",
  
  "5014": "handleScarlettSoulMark",
  "1011": "handleScarlettSoulMark",
  "1035": "handleScarlettSoulMark",
  "聖光斯嘉麗": "handleScarlettSoulMark",
  "斯嘉麗": "handleScarlettSoulMark",
  
  "5015": "handleChaosBlakeSoulMark",
  "1012": "handleChaosBlakeSoulMark",
  "混沌·布萊克": "handleChaosBlakeSoulMark",
  
  "5016": "handleMarsSoulMark",
  "1013": "handleMarsSoulMark",
  "變革·馬爾修斯": "handleMarsSoulMark",
  "馬爾修斯": "handleMarsSoulMark",
  "mars_reform": "handleMarsSoulMark",
  
  "5017": "handleDixinSoulMark",
  "1014": "handleDixinSoulMark",
  "1031": "handleDixinSoulMark",
  "人皇·帝辛": "handleDixinSoulMark",
  "人皇.帝辛": "handleDixinSoulMark",
  "帝辛": "handleDixinSoulMark",
  
  "5018": "handleOpeiaSoulMark",
  "1015": "handleOpeiaSoulMark",
  "蟲后·奧佩婭": "handleOpeiaSoulMark",
  "蟲后": "handleOpeiaSoulMark",
  
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

  "5023": "handleWuxuSoulMark",
  "無序·蝕言": "handleWuxuSoulMark",
  "無序.蝕言": "handleWuxuSoulMark",

  "5024": "handleAnnihilationLordSoulMark",
  "1018": "handleAnnihilationLordSoulMark",
  "湮滅之主・咤克斯": "handleAnnihilationLordSoulMark",
  "湮滅之主·咤克斯": "handleAnnihilationLordSoulMark",
  "湮滅之主.咤克斯": "handleAnnihilationLordSoulMark",

  "5025": "handleFearIncarnationSoulMark",
  "1019": "handleFearIncarnationSoulMark",
  "1037": "handleFearIncarnationSoulMark",
  "恐懼的化身·咤克斯": "handleFearIncarnationSoulMark",
  "恐懼的化身.咤克斯": "handleFearIncarnationSoulMark",
  "咤克斯": "handleFearIncarnationSoulMark",

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

  "5029": "handleOtherworldReySoulMark",
  "異境神霆·雷伊": "handleOtherworldReySoulMark",
  "異境神霆.雷伊": "handleOtherworldReySoulMark",

  "聖靈譜尼": "handleShenglingPuniSoulMark",
  "譜尼": "handlePuniBaseSoulMark",
  "1029": "handleLiujieSoulMark",
  "六界神王": "handleLiujieSoulMark",
  "1023": "handleRaySoulMark",
  "雷伊": "handleRaySoulMark",
  "1024": "handleGaiaSoulMark",
  "蓋亞": "handleGaiaSoulMark",
  "1025": "handleCassiusSoulMark",
  "卡修斯": "handleCassiusSoulMark",

  "arena_12": "handleWuweiSoulMark",
  "無為龍者": "handleWuweiSoulMark",
  "arena_13": "handleTianfengSoulMark",
  "龍錄天鋒": "handleTianfengSoulMark",
  "arena_14": "handleWujiSoulMark",
  "無極聖武": "handleWujiSoulMark",
  "arena_15": "handleMoiraiSoulMark",
  "命運龍輪 莫伊萊": "handleMoiraiSoulMark",
  "arena_16": "handleDragonHealingSoulMark",
  "鎮世龍魂・龍之治癒": "handleDragonHealingSoulMark",
};

let cachedSkillRegistry: Record<string, BattleSkillHandler> | null = null;
let cachedSoulMarkRegistry: Record<string, SoulMarkHandler> | null = null;
export type BattleSkillTransformHandler = (context: BattleEventContext, skill: Skill) => Skill | undefined;
let cachedSkillTransforms: Record<string, BattleSkillTransformHandler> | null = null;
let cachedDamageTransforms: Record<string, BattleSkillTransformHandler> | null = null;

function initializeRegistries() {
  if (cachedSkillRegistry && cachedSoulMarkRegistry && cachedSkillTransforms) return;
  
  cachedSkillRegistry = {};
  cachedSoulMarkRegistry = {};
  cachedSkillTransforms = {};
  cachedDamageTransforms = {};
  
  // @ts-ignore
  const modules = import.meta.glob('./*Registry.ts', { eager: true });
  
  for (const [path, mod] of Object.entries(modules)) {
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
}

// 會在「對手受到技能攻擊」時被通知 ON_DAMAGED 的魂印（handler 內以 extraData.targetSide 區分自身／對手受擊）
const ON_DAMAGED_OBSERVER_HANDLERS = new Set(["handleMonkeySoulMark", "handleLisaSoulMark", "handleStarlightRusSoulMark", "handleOtherworldReySoulMark", "handleHolyMilesSoulMark"]);
export function observesOpponentDamage(elfName: string): boolean {
  return ON_DAMAGED_OBSERVER_HANDLERS.has(SOUL_MARK_MAPPING[elfName]);
}

/** 是否有專屬（手寫）技能 handler */
export function hasSkillHandler(name: string): boolean {
  return name in getBattleSkillRegistry();
}

/** 在命中、技能無效與攻擊免疫判定前，把技能轉為實際使用型態。 */
export function transformSkillBeforeResolve(context: BattleEventContext, skill: Skill): Skill {
  initializeRegistries();
  return cachedSkillTransforms?.[skill.name]?.(context, skill) || skill;
}

/** 使用當前狀態計算威力：命中時的吸取／消強／反轉先完成，再進入傷害公式。 */
export function transformSkillBeforeDamage(context: BattleEventContext, skill: Skill): Skill {
  initializeRegistries();
  const transformed = cachedDamageTransforms?.[skill.name]?.(context, skill) || skill;
  const powerComp = { power: transformed.power || 0 };
  SoulMarkRegistry[context.self.name]?.(context, EffectTiming.MODIFY_POWER, { skill: transformed, powerComp });
  const opposingContext = { ...context, self: context.target, target: context.self, actor: context.targetSide, targetSide: context.actor,
    getPlayerState: context.getOpponentState, setPlayerState: context.setOpponentState,
    getOpponentState: context.getPlayerState, setOpponentState: context.setPlayerState };
  SoulMarkRegistry[context.target.name]?.(opposingContext, EffectTiming.MODIFY_POWER, { skill: transformed, powerComp, isIncoming: true });
  return { ...transformed, power: powerComp.power };
}

export function getBattleSkillRegistry(): Record<string, BattleSkillHandler> {
  initializeRegistries();
  return cachedSkillRegistry!;
}

export function getSoulMarkRegistry(): Record<string, SoulMarkHandler> {
  initializeRegistries();
  return cachedSoulMarkRegistry!;
}

export const SoulMarkRegistry: Record<string, SoulMarkHandler> = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === "string") {
      const originalHandler = getSoulMarkRegistry()[prop];
      return (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
        let res = undefined;
        const elf = (ctx.self && ctx.self.name === prop)
          ? ctx.self
          : (ctx.activeP1 && ctx.activeP1.name === prop)
            ? ctx.activeP1
            : (ctx.activeP2 && ctx.activeP2.name === prop)
              ? ctx.activeP2
              : null;
        const soulBlocks = !!elf && isSoulBlocksOnly(elf);
        if (originalHandler && !soulBlocks) {
          res = originalHandler(ctx, event, extraData);
        } else if (elf && (elf as any).soulMark?.effectType && (elf as any).soulMark.effectType !== "none") {
          // 自訂精靈：依 soulMark.effectType / effectValue 執行
          res = runGenericSoulMark(ctx, event, extraData, elf);
        }
        // 積木：側邊持續效果（N回合內…）與登記為積木的魂印子句
        try { if (runBlockEvent(ctx, event, extraData, elf || ctx.self)) res = true; } catch (e) { console.error("[blocks]", e); }
        // 已有手寫魂印 handler 的精靈（譜尼等），kit 只是描述用資料，不再重複執行
        if (!originalHandler && elf && elf.kit && elf.kit.length > 0) {
          const node = mapTimingToNode(event);
          if (node) {
            // extraData（damageComp / priorityComp 等）併入 ctx，傷害與先制修正原子才拿得到
            const kitCtx = extraData && typeof extraData === "object" ? Object.assign(Object.create(ctx), extraData) : ctx;
            runNode(node, elf.kit.filter((e: any) => e.source !== "skill"), CODEX, kitCtx);
          }
        }
        return res;
      };
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
      const value = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
        const originalHandler = reg[prop];
        let res = undefined;
        const elf = (ctx.self && ctx.self.name === prop)
          ? ctx.self
          : (ctx.activeP1 && ctx.activeP1.name === prop)
            ? ctx.activeP1
            : (ctx.activeP2 && ctx.activeP2.name === prop)
              ? ctx.activeP2
              : null;
        const soulBlocks = !!elf && isSoulBlocksOnly(elf);
        if (originalHandler && !soulBlocks) {
          res = originalHandler(ctx, event, extraData);
        } else if (elf && (elf as any).soulMark?.effectType && (elf as any).soulMark.effectType !== "none") {
          // 自訂精靈：依 soulMark.effectType / effectValue 執行
          res = runGenericSoulMark(ctx, event, extraData, elf);
        }
        // 積木：側邊持續效果（N回合內…）與登記為積木的魂印子句
        try { if (runBlockEvent(ctx, event, extraData, elf || ctx.self)) res = true; } catch (e) { console.error("[blocks]", e); }
        // 已有手寫魂印 handler 的精靈（譜尼等），kit 只是描述用資料，不再重複執行
        if (!originalHandler && elf && elf.kit && elf.kit.length > 0) {
          const node = mapTimingToNode(event);
          if (node) {
            // extraData（damageComp / priorityComp 等）併入 ctx，傷害與先制修正原子才拿得到
            const kitCtx = extraData && typeof extraData === "object" ? Object.assign(Object.create(ctx), extraData) : ctx;
            runNode(node, elf.kit.filter((e: any) => e.source !== "skill"), CODEX, kitCtx);
          }
        }
        return res;
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





/** 技能效果執行：專屬程式 ／ 積木 ／ 舊通用文字執行器（積木未解析的子句） */
function makeSkillRunner(name: string, reg: Record<string, BattleSkillHandler>): BattleSkillHandler {
  const hasH = name in reg;
  return (ctx: BattleEventContext) => {
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
        if (ctx.skill && ctx.skill.kit && ctx.skill.kit.length > 0) {
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
        if (ctx.skill && ctx.skill.kit && ctx.skill.kit.length > 0) {
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
