import { prdChance } from "../utils/prd";
import { queueActionPowerMultiplier } from "../battle/actionDamageModifiers";
import { addDamageReduction } from "../battle/damageReduction";
import { timed } from "./newElfOperations";
import { BattleEventContext, EffectTiming } from "./types";

/**
 * 雷伊 → 雷神雷伊 (Thunder Ray, SeerAPI id 2394) 進化型強化組合
 * 官方：雷神天明閃 10825 (威力160/必中/10%概率4倍, args:[10,4])；
 * 雷神斷天斬 15895 (威力160, 血<1/3則下回合必定暴擊)。
 * 布萊克保留使用者加強版，本檔其他三隻以官方數值為準。
 */
export const handleRaySoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const actor = ctx.actor;
  // 血量低於 1/3：下回合必定暴擊（雷神斷天斬 15895 官方效果）
  if (event === EffectTiming.ROUND_END) {
    if (ctx.self.currentHp > 0 && ctx.self.currentHp < ctx.self.maxHp / 3) {
      ctx.setPlayerState("nextTurnCrit", true);
      ctx.addLog("⚡【雷神】：體力低於 1/3，下回合必定致命一擊！", "effect");
    }
    return;
  }
  if (event === EffectTiming.AFTER_ACTION) {
    // 麻痺主題延續（舊「雷」魂印行為保留為進化組合一部分）
    ctx.addLog("⚡【雷】：雷神降世，萬雷奔騰！");
    ctx.applyStatusWithImmunityCheck(ctx.targetSide, "麻痺", 1);
  }
  // 先制出手：當回合對手技能無法造成技能傷害且附加效果失效
  // （官方原廠寫「技能無效」，實際定義＝無法造成傷害＋附加失效，見 BattleScreen 2700-2925 判定鏈）
  if (event === EffectTiming.BEFORE_DAMAGE) {
    const comp = extraData?.damageComp || extraData;
    if (comp && comp.isIncoming && comp.damageCategory === "skill_attack" && ctx.getPlayerState("thunderSealActive")) {
      comp.multiplier = 0;
      ctx.setPlayerState("thunderSealActive", false);
      ctx.addLog("⚡【雷神壓制】：對手本回合技能無法造成傷害！", "effect");
    }
  }
  if (event === EffectTiming.BEFORE_SKILL && ctx.goesFirst) {
    ctx.setPlayerState("thunderSealActive", true);
  }
  void actor;
};

/**
 * 蓋亞 → 三形態合體：常態【戰】＋ 王·蓋亞 (SeerAPI id 3242, soulmark 568 完全體) ＋ 戰神蓋亞 (id 1845)
 * 官方 568：異常時對手每回合4項-1、傷害-60%、每回合回已損失35%、按損失血量概率威力翻倍。
 * 常態底保留：體力低於 50% 攻擊提升 30%。
 */
export const handleGaiaSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const self = ctx.self;
  const lostRatio = self.maxHp > 0 ? Math.max(0, (self.maxHp - self.currentHp) / self.maxHp) : 0;
  const isAbnormal = Object.values(ctx.getStatuses ? ctx.getStatuses(self) : {}).some((v: any) => (v as number) > 0);
  // 常態底：低血增傷
  if (event === EffectTiming.BEFORE_DAMAGE && !extraData?.isIncoming) {
    const comp = extraData?.damageComp || extraData;
    if (self.currentHp < self.maxHp / 2) {
      comp.increasePercent = (comp.increasePercent || 0) + 0.3;
      ctx.addLog("💥【戰】：戰神之怒，力量爆發！", "effect");
    }
    // 按已損失體力百分比概率威力翻倍（王·蓋亞 568 官方效果，PRD 保證長期概率）
    if (lostRatio > 0 && prdChance(`${ctx.actor}:${self.battleId || self.id}:gaia-double`, lostRatio)) {
      queueActionPowerMultiplier(ctx, 2);
      ctx.addLog("💥【王·戰意】：損失體力共鳴，威力翻倍！", "effect");
    }
  }
  // 王·蓋亞完全體：異常時壓制（ROUND_START 觸發，每回合）
  if (event === EffectTiming.ROUND_START && isAbnormal && self.currentHp > 0) {
    ctx.applyStatChange(ctx.targetSide, { atk: -1, def: -1, spatk: -1, spdef: -1 });
    const comp = extraData?.damageComp;
    if (comp && comp.isIncoming) addDamageReduction(comp, 0.6);
    else ctx.setPlayerState("gaiaAbnormalReduction", true);
    ctx.addLog("💥【王·聖勇】：異常中反壓，對手 4 項 -1、傷害 -60%！", "effect");
  }
  if (event === EffectTiming.BEFORE_DAMAGE && ctx.getPlayerState("gaiaAbnormalReduction")) {
    const comp = extraData?.damageComp || extraData;
    if (comp && comp.isIncoming) { addDamageReduction(comp, 0.6); ctx.setPlayerState("gaiaAbnormalReduction", false); }
  }
  // 每回合恢復已損失體力的 35%（王·蓋亞 568 完全體數值）
  if (event === EffectTiming.ROUND_END && self.currentHp > 0 && lostRatio > 0) {
    const amt = Math.floor((self.maxHp - self.currentHp) * 0.35);
    if (amt > 0) { ctx.applyHeal(ctx.actor, amt); ctx.addLog(`💚【王·聖勇】：恢復已損失體力的 35%（${amt} 點）！`, "heal"); }
  }
};

/**
 * 卡修斯 → 王·卡修斯 (SeerAPI id 3170, soulmark 529 完全體)
 * 官方：先出手時對手當回合技能無效；後出手時回合結束+250盾、下回合先制+2。
 * 「技能無效」實際定義＝無法造成技能傷害＋附加效果失效（官方原廠文字簡寫）。
 * 舊 isFaster bug 修復：改讀 ctx.goesFirst（全 repo 唯一先後手真相）。
 */
export const handleCassiusSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  switch (event) {
    case EffectTiming.BEFORE_SKILL: {
      // 王·卡修斯 529：先出手封鎖（當回合對手技能無法造成傷害＋附加失效）
      if (ctx.goesFirst) {
        ctx.addLog("🌍【王·地】：極速壓制，對手當回合技能無法造成傷害且附加效果失效！");
        // 無法造成傷害：走帝辛同款 preventAttackDamage 門（BattleScreen 3222 歸零）
        timed(ctx, ctx.targetSide, "king_cassius_seal", 1,
          { preventAttackDamage: true, block: { addInvalid: "all" } }, false, "soulmark", false);
        ctx.setOpponentState("allHitEffectNullTurns", 1);
        ctx.setOpponentState("attackSkillInvalidReason", "【王·地之極速壓制】");
      } else {
        // 後出手：官方 529 完全體 +250 盾（舊 300 是假數值，改回官方）＋下回合先制+2
        ctx.applyShield(ctx.actor, 250);
        ctx.setPlayerState("priorityBoostTurns", 2);
        ctx.setPlayerState("priorityBoostValue", 2);
        ctx.setPlayerState("priorityBoostAttackOnly", false);
        ctx.addLog("🌍【王·地】：厚土屏障 +250 護盾，下回合先制+2！");
      }
      break;
    }
    case EffectTiming.BEFORE_DAMAGE: {
      // 封鎖當回合：對手打來的技能傷害歸零（配合上面的 preventAttackDamage 雙保險）
      const comp = extraData?.damageComp || extraData;
      if (comp && comp.isIncoming && ctx.getPlayerState("kingCassiusSealRound") === ctx.roundNumber) {
        comp.multiplier = 0;
      }
      break;
    }
    case EffectTiming.BEFORE_ACTION: {
      if (ctx.goesFirst) ctx.setPlayerState("kingCassiusSealRound", ctx.roundNumber);
      break;
    }
  }
  void extraData;
};

/**
 * 布萊克 (Black) - B Rank
 * 魂印：魔
 */
export const handleBlackSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  switch (event) {
    case EffectTiming.BEFORE_DAMAGE:
      // 造成的攻擊傷害提升 50%
      if (!extraData?.isIncoming) {
        extraData.multiplier *= 1.5;
        ctx.addLog("🌙【魔】：黑夜的主宰，傷害提升 50%！", "effect");
      }
      break;
    case EffectTiming.FATAL_RESIST:
      // 本場戰鬥僅限一次，死亡時保留1點體力並消除對手回合類效果，同時100%令對手害怕
      if (!ctx.getPlayerState("blackFatalResist")) {
        ctx.addLog("🌙【魔】：夜魔涅槃，幽冥重生！");
        ctx.setPlayerState("blackFatalResist", true);
        ctx.self.currentHp = 1;
        ctx.setOpponentState("turnEffects", []);
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 1);
        if (extraData) extraData.cancelFatal = true;
        return true;
      }
      return false;
  }
};

export const RAY_SKILLS = {
  // 官方 10825：威力160/必中/PP3，10%概率傷害為4倍（args:[10,4] 實錘）
  "雷神天明閃": (ctx: BattleEventContext) => {
    if (prdChance(`${ctx.actor}:${ctx.self.battleId || ctx.self.id}:tianshan`, 0.1)) {
      queueActionPowerMultiplier(ctx, 4);
      ctx.addLog("⚡【雷神天明閃】：觸發 4 倍傷害！", "effect");
    }
  },
  // 官方 15895：威力160，血<1/3則下回合必定暴擊
  "雷神斷天斬": (ctx: BattleEventContext) => {
    if (ctx.self.currentHp < ctx.self.maxHp / 3) {
      ctx.setPlayerState("nextTurnCrit", true);
      ctx.addLog("⚡【雷神斷天斬】：絕境爆發，下回合必定致命一擊！", "effect");
    }
  },
};

export const GAIA_SKILLS = {
  // 官方 10715：威力150，消除對手能力提升（舊寫成消護盾是錯的）
  "石破天驚": (ctx: BattleEventContext) => {
    const st = { ...(ctx.target.statStages || {}) };
    let cleared = false;
    for (const k of Object.keys(st)) { if ((st[k] as number) > 0) { (st[k] as number) = 0; cleared = true; } }
    if (cleared) { ctx.updateElf(ctx.targetSide, { statStages: st as any }); ctx.addLog("💥【石破天驚】：消除對手能力提升！", "effect"); }
    else ctx.addLog("💥【石破天驚】：對手無能力提升可消除。", "info");
  },
  // 官方 30158 王·聖勇戰意：無微弱＋吸取提升成功則吸300體＋對手提升時先制+2
  "王·聖勇戰意": (ctx: BattleEventContext) => {
    const st = { ...(ctx.target.statStages || {}) };
    let absorbed = false;
    const self = { ...(ctx.self.statStages || {}) };
    for (const k of Object.keys(st)) {
      if ((st[k] as number) > 0) { (self[k] as any) = Math.min(6, ((self[k] as number) || 0) + (st[k] as number)); (st[k] as number) = 0; absorbed = true; }
    }
    if (absorbed) {
      ctx.updateElf(ctx.actor, { statStages: self as any });
      ctx.updateElf(ctx.targetSide, { statStages: st as any });
      ctx.applyFixedDamage(ctx.targetSide, 300, "聖勇吸取");
      ctx.addLog("💥【王·聖勇戰意】：吸取對手提升並附加 300 點傷害！", "effect");
    }
    const oppBuffed = Object.values(ctx.target.statStages || {}).some((v: any) => (v as number) > 0);
    if (oppBuffed) {
      ctx.setPlayerState("priorityBoostTurns", 2);
      ctx.setPlayerState("priorityBoostValue", 2);
      ctx.addLog("💥【王·聖勇戰意】：對手處於提升，先制+2！", "effect");
    }
  },
};

export const CASSIUS_SKILLS = {
  // 官方 11924：使對手的能力提升效果轉化到自己身上（舊寫成自己負轉正是錯的）
  "乾坤反轉": (ctx: BattleEventContext) => {
    const st = { ...(ctx.target.statStages || {}) };
    const self = { ...(ctx.self.statStages || {}) };
    let moved = false;
    for (const k of Object.keys(st)) {
      if ((st[k] as number) > 0) { (self[k] as any) = Math.min(6, ((self[k] as number) || 0) + (st[k] as number)); (st[k] as number) = 0; moved = true; }
    }
    if (moved) {
      ctx.updateElf(ctx.actor, { statStages: self as any });
      ctx.updateElf(ctx.targetSide, { statStages: st as any });
      ctx.addLog("🌍【乾坤反轉】：對手提升轉化到自己身上！", "effect");
    } else ctx.addLog("🌍【乾坤反轉】：對手無提升可轉化。", "info");
  },
  // 官方 19843 王·大地無極：無微弱＋消回合成功則2回合屬性無效＋附加50%當前體力傷害
  "王·大地無極": (ctx: BattleEventContext) => {
    if (ctx.clearTurnEffectsOf(ctx.targetSide)) {
      ctx.setOpponentState("utilitySkillInvalidTurns", 2);
      ctx.setOpponentState("utilitySkillInvalidReason", "【王·大地無極】");
      ctx.addLog("🌍【王·大地無極】：消回合成功，對手 2 回合屬性技能無效！", "effect");
    }
    const bonus = Math.floor(ctx.self.currentHp * 0.5);
    if (bonus > 0) { ctx.applyFixedDamage(ctx.targetSide, bonus, "大地無極"); ctx.addLog(`🌍【王·大地無極】：附加 ${bonus} 點傷害！`, "damage"); }
  },
};

export const BLACK_SKILLS = {
  "雙重暗影": (ctx: BattleEventContext) => {
    ctx.addLog("🌙【雙重暗影】：幽冥之眼，看穿弱點！");
    ctx.applyStatChange(ctx.targetSide, { def: -1 });
    ctx.applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 1);
  }
};
