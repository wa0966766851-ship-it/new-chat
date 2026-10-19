import { addDamageIncrease } from '../../../battle/damagePipeline';
import { queueActionPowerMultiplier } from '../../../battle/actionDamageModifiers';
import { benchSkip } from '../../fieldGuard';
import { bypassesAttackDefense } from '../../../battle/attackDefense';
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from "../../types";
import { isAbnormal, getMaxPp, clampSkillPp } from "../../../utils/battleHelpers";
import { StatusRegistry } from "../../statusRegistry";

// ── 譜尼／聖靈譜尼共用：虛無、能量（兩隻都可攜帶）────────────────
/** 回合開始：重置「本回合所受技能傷害」（能量用） */
const puniSharedRoundStart = (context: BattleEventContext) => {
  context.setPlayerState("puniSkillDmgTakenThisTurn", 0);
};
/** 受到技能傷害：累計本回合所受的技能傷害（能量用） */
const puniSharedOnDamaged = (context: BattleEventContext, extraData: any) => {
  if (extraData?.targetSide && extraData.targetSide !== context.actor) return;
  if (extraData?.damageType !== "skill_attack") return;
  const amt = Math.floor(Number(extraData?.amount ?? extraData?.damage ?? 0));
  if (amt > 0) context.setPlayerState("puniSkillDmgTakenThisTurn", (context.getPlayerState("puniSkillDmgTakenThisTurn") || 0) + amt);
};
/** 出手前：虛無（2回合內若自身先出手，則對手技能失效） */
const puniSharedBeforeAction = (context: BattleEventContext) => {
  if ((context.getPlayerState("puniXuWuTurns") || 0) > 0 && context.moveIndex === 0) {
    context.setPlayerState("globalSkillInvalidTurns", 1);
    context.setPlayerState("globalSkillInvalidReason", "【虛無】");
    context.addLog(`✨ 【虛無】：自身先出手，對手技能失效！`, "status");
  }
};
/** 回合結束：虛無回合數遞減 */
const puniSharedRoundEnd = (context: BattleEventContext) => {
  const t = context.getPlayerState("puniXuWuTurns") || 0;
  if (t > 0) context.setPlayerState("puniXuWuTurns", t - 1);
};

/**
 * 聖靈譜尼 (Holy Spirit Puni) 專屬註冊表 [神]
 */
/**
 * 璨靈聖光／聖光吟誦的持續狀態（300 譜尼與 5000 聖靈譜尼共用；2026-10-11 由聖靈譜尼抽出，基礎譜尼過去完全沒有）。
 * - 2回合內免疫對手的攻擊傷害（只限攻擊傷害）
 * - 下2回合攻擊威力翻倍（威力屬公式輸入）
 * - 下2回合對手受到的傷害提高150%
 */
const puniSkillStateEffects = (context: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { getPlayerState, addLog } = context;
  if (event === EffectTiming.BEFORE_SKILL && context.skill && context.skill.category !== "屬性" && getPlayerState("puniDoubleDamageTurns") > 0) {
    queueActionPowerMultiplier(context, 2);
  }
  if (event === EffectTiming.BEFORE_DAMAGE && extraData) {
    if (extraData.isIncoming === true) {
      if (extraData.damageCategory === "skill_attack" && getPlayerState("puniVoidShieldTurns") > 0 && !bypassesAttackDefense(extraData, 'block')) {
        extraData.multiplier = 0;
        addLog(`✨ 【璨靈聖光】：免疫攻擊傷害！`, "status");
      }
    } else if (getPlayerState("puniDamageBoostTurns") > 0) {
      addDamageIncrease(extraData, 1.5);
    }
  }
};

export const handleShenglingPuniSoulMark = (_context: BattleEventContext, _event: EffectTiming | string, _extraData?: any) => {
  // 5000 魂印「神」已遷真 Kit（migratedGroup5HolyPuniSoulKit.ts；DSH 20261018 組 5）——規則3.3 空殼化。
  return false;
};

/**
 * 譜尼 (Puni Base) 專屬註冊表 [聖]
 */
export const handlePuniBaseSoulMark = (context: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  if (benchSkip(context, event)) return; // 場下不觸發回合節點效果（例：聖・回合結束回復）
  const { self, actor, getPlayerState, setPlayerState, addLog } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";
  if (event === EffectTiming.ROUND_START) puniSharedRoundStart(context);
  if (event === EffectTiming.BEFORE_ACTION) puniSharedBeforeAction(context);

  // 1. BEFORE_STATUS_APPLY: 天生免疫每次受到的異常狀態 (M1)
  if (event === EffectTiming.BEFORE_STATUS_APPLY && extraData) {
    extraData.prevented = true;
    extraData.prevent = true;
    addLog(`✨ 【聖】：天生免疫異常狀態【${extraData.status}】！`, "status");
  }

  // 2. BEFORE_ACTION: 聖光氣致命一擊觸發
  if (event === EffectTiming.BEFORE_ACTION) {
    if (getPlayerState("puniShengGuangQiTurns") > 0) {
      setPlayerState("nextTurnCrit", true);
      addLog(`✨ 【聖光氣】：致命一擊效果觸發！`, "effect");
    }
  }

  // 3. BEFORE_DAMAGE: 虛無無效化對手攻擊
  puniSkillStateEffects(context, event, extraData);

  // 4. ON_DAMAGED: 能量傷害反饋
  if (event === EffectTiming.ON_DAMAGED && extraData) {
    puniSharedOnDamaged(context, extraData);
  }

  // 5. ROUND_END: 魂印效果 + 各種計數器更新與效果結算
  if (event === EffectTiming.ROUND_END) {
    // 魂印效果：每回合結束時恢復最大體力25%與所有技能1點PP值
    const heal = Math.floor(self.maxHp * 0.25);
    self.currentHp = Math.min(self.maxHp, self.currentHp + heal);
    self.skills.forEach((s: any) => {
      if (s.pp !== undefined) {
        s.pp = clampSkillPp(s, s.pp + 1, self);
      }
    });
    addLog(`✨ 【聖】：回合結束，恢復最大體力25%並補充所有技能1點PP！`, "heal");

    // 技能計數器更新與結算
    puniSharedRoundEnd(context);
    for (const key of ["puniVoidShieldTurns", "puniDoubleDamageTurns", "puniAlwaysFirstTurns", "puniDamageBoostTurns"]) {
      if (getPlayerState(key) > 0) setPlayerState(key, getPlayerState(key) - 1);
    }
    if (getPlayerState("puniShengGuangQiTurns") > 0) {
      setPlayerState("puniShengGuangQiTurns", getPlayerState("puniShengGuangQiTurns") - 1);
    }
    if (getPlayerState("puniShengJieMissTurns") > 0) {
      setPlayerState("puniShengJieMissTurns", getPlayerState("puniShengJieMissTurns") - 1);
    }

  }

  return false;
};

// ==============================================================
// 技能全表 (27 個技能) - 已完全消除 hardcoded 'p1' 或 'p2'
// ==============================================================
export const PUNI_SKILLS: Record<string, BattleSkillHandler> = {
  "虛無": (ctx) => {
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：【虛無】的附加效果失效！`, "info");
      return;
    }
    // 🎯 2回合內若自身先出手，則對手技能失效（本回合起算；之後每回合於出手前判定）
    const { setPlayerState, addLog, goesFirst } = ctx;
    setPlayerState("puniXuWuTurns", 2);
    addLog(`✨ 【虛無】：2 回合內若自身先出手，則對手技能失效！`, "status");
    if (goesFirst) {
      setPlayerState("globalSkillInvalidTurns", 1);
      setPlayerState("globalSkillInvalidReason", "【虛無】");
    }
  },
  "元素": (ctx) => {
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：【元素】的附加效果失效！`, "info");
      return;
    }
    const { applyTrueDamage, addLog, targetSide, activeP1, activeP2 } = ctx;
    applyTrueDamage(targetSide, 200, "【元素】額外傷害", activeP1, activeP2);
    addLog(`✨ 【元素】：額外附加 200 點真實傷害！`, "damage");
  },
  "能量": (ctx) => {
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：【能量】的附加效果失效！`, "info");
      return;
    }
    // ■ 無視對手抵擋傷害效果、傷害限制效果
    // 🎯 將本次所受的技能傷害2倍以技能傷害形式反饋給對手（不小於本次所受技能傷害2倍）
    const { getPlayerState, addLog, actor } = ctx;
    const taken = Math.floor(getPlayerState("puniSkillDmgTakenThisTurn") || 0);
    if (taken <= 0) {
      addLog(`✨ 【能量】：本回合未受到技能傷害，沒有可反饋的傷害。`, "info");
      return;
    }
    const want = taken * 2;
    ctx.applySkillTypeDamage(actor === "p1" ? "p2" : "p1", want, "【能量】反饋", { ignoreBlock: true, ignoreLimit: true, floor: want, node: "attack_damage" });
    addLog(`✨ 【能量】：將本回合所受的 ${taken} 點技能傷害 2 倍反饋給對手！`, "damage");
  },
  "靈光之怒": (ctx) => {
    const { target, addLog, applyFixedDamage, targetSide } = ctx;
    let sum = 0;
    for (const key in target.statStages) {
       sum += Math.max(0, target.statStages[key]);
    }
    if (sum > 0) {
      const bonusDmg = sum * 40;
      applyFixedDamage(targetSide, bonusDmg);
      addLog(`✨ 【靈光之怒】：對手能力等級總和為 +${sum}，額外附加 ${bonusDmg} 點固定傷害！`, "damage");
    }
  },
  "斷空破": (ctx) => {
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：【斷空破】的附加效果失效！`, "info");
      return;
    }
    const { applyTrueDamage, addLog, targetSide } = ctx;
    applyTrueDamage(targetSide, 30, '斷空破');
    addLog(`✨ 【斷空破】：額外附加 30 點真實傷害！`, "damage");
  },
  "輪迴": (ctx) => {
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：【輪迴】的附加效果失效！`, "info");
      return;
    }
    const { self, addLog } = ctx;
    self.currentHp = self.maxHp;
    addLog(`✨ 【輪迴】：恢復全部體力！`, "heal");
  },
  "靈魂干涉": (ctx) => {
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：【靈魂干涉】的附加效果失效！`, "info");
      return;
    }
    const { applyStatusWithImmunityCheck, addLog, targetSide } = ctx;
    const res = applyStatusWithImmunityCheck(targetSide, "疲憊", 2);
    if (res.success) addLog(`✨ 【靈魂干涉】：令對手疲憊 2 回合！`, "status");
  },
  "聖堂之門": (ctx) => {
    const { target, addLog } = ctx;
    let cleared = false;
    for (const key in target.statStages) {
      if (target.statStages[key] > 0) {
        target.statStages[key] = 0;
        cleared = true;
      }
    }
    if (cleared) addLog(`✨ 【聖堂之門】：消除了對手能力提升狀態！`, "effect");
  },
  "聖潔": (ctx) => {
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：【聖潔】的附加效果失效！`, "info");
      return;
    }
    const { setPlayerState, addLog } = ctx;
    setPlayerState("puniShengJieMissTurns", 5);
    // 「對自身使用的屬性技能無效」：用 incoming 鍵，避免連自己的屬性技能也被判定失效
    setPlayerState("incomingUtilityInvalidTurns", 5);
    setPlayerState("incomingUtilityInvalidReason", "【聖潔】屬性免疫");
    addLog(`✨ 【聖潔】：5 回合內屬性技能對自身必定 MISS！`, "status");
  },
  "千烈虛光閃": (ctx) => {
    const { self, addLog } = ctx;
    let cleared = false;
    for (const key in self.statStages) {
      if (self.statStages[key] < 0) {
        self.statStages[key] = 0;
        cleared = true;
      }
    }
    if (cleared) addLog(`✨ 【千烈虛光閃】：解除了自身的能力下降狀態！`, "effect");
  },
  "聖靈魔閃光": (ctx) => {
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：【聖靈魔閃光】的附加效果失效！`, "info");
      return;
    }
    const { target, applyPinkDamage, addLog, targetSide } = ctx;
    const dmg = Math.floor(target.maxHp / 8);
    applyPinkDamage(targetSide, dmg, "【聖靈魔閃光】百分比", undefined, undefined, 'percent');
    addLog(`✨ 【聖靈魔閃光】：降低對手 1/8 的 HP！`, "damage");
  },
  // Exclusive skills
  "璨靈聖光": (ctx) => {
    const { setPlayerState, addLog } = ctx;
    // B effects:
    // 「下2回合」：本回合不生效，之後 2 個回合（ctx.setNextTurns 於回合結束遞減後才寫入）
    ctx.setNextTurns?.("self", "puniDoubleDamageTurns", 2);
    ctx.setNextTurns?.("self", "puniAlwaysFirstTurns", 2);

    // C effects:
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：璨靈聖光的回合免傷和回血附加效果失效！`, "info");
    } else {
      setPlayerState("puniVoidShieldTurns", 2);
      setPlayerState("puniCanLingHealTurns", 5);
      addLog(`✨ 【璨靈聖光】：2 回合免傷、5 回合回血、下 2 回合必定先手且傷害翻倍！`, "status");
    }
  },
  "聖靈悲魂曲": (ctx) => {
    const { setPlayerState, addLog, target, goesFirst, targetSide } = ctx;
    // B effects: none (先制+1 handled in system)

    // C effects:
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：聖靈悲魂曲的附加效果失效！`, "info");
    } else {
      setPlayerState("oppHalfUtilitySealedTurns", 3);
      setPlayerState("utilitySkillInvalidChance", 0.5);
      setPlayerState("utilitySkillInvalidChanceReason", "【聖靈悲魂曲】屬性失效判定");
      addLog(`✨ 【聖靈悲魂曲】：3 回合內 50% 機率使對手屬性技能失效！`, "status");
      if (goesFirst) {
        target.skills.forEach(s => {
          if (s.pp !== undefined) s.pp = Math.max(0, s.pp - 2);
        });
        addLog(`✨ 先出手，降低了對手所有技能 2 點 PP！`, "effect");
      }
    }
  },
  "聖影流光破": (ctx) => {
    const { self, target, addLog, clearTurnEffectsOf, applyFixedDamage, getPlayerState, setPlayerState, targetSide } = ctx;
    // B effects:
    const cleared = clearTurnEffectsOf(targetSide);

    // C effects:
    const sealed = ctx.getPlayerState("additionalEffectsSealed") || ctx.getPlayerState(`${ctx.actor}_sealSkillAdditionalEffects`) > 0;
    if (sealed) {
      ctx.addLog(`🚫 【附加效果失效】：聖影流光破的附加效果失效！`, "info");
    } else {
      if (cleared) {
        setPlayerState("oppSealHealTurns", 2);
        addLog(`✨ 【聖影流光破】：消除對手回合類效果成功，封印對手恢復 HP 能力 2 回合！`, "status");
      }
      let count = (getPlayerState("puniShengYingCount") || 0) + 1;
      setPlayerState("puniShengYingCount", count);
      const steal = Math.min(350, 150 + (count - 1) * 100);
      applyFixedDamage(targetSide, steal);
      self.currentHp = Math.min(self.maxHp, self.currentHp + steal);
      addLog(`✨ 吸取對手 ${steal} 點固定體力！`, "heal");
      setPlayerState("puniShengYingBuffIfAlive", true);
    }
  },
  "聖光吟誦": (ctx) => {
    const { applyStatusWithImmunityCheck, addLog, setPlayerState, setOpponentState, targetSide } = ctx;
    
    // 100% 令對手疲憊 3 回合
    const res = applyStatusWithImmunityCheck(targetSide, "疲憊", 3); // 描述未寫回合數，沿用 3
    if (!res.success) {
      // 未觸發：對手 2 回合屬性技能無效
      setOpponentState("utilitySkillInvalidTurns", 2);
      setOpponentState("utilitySkillInvalidReason", "聖光吟誦效果");
      addLog(`✨ 【聖光吟誦】：對手未陷入疲憊，2 回合屬性技能無效！`, "status");
    } else {
      addLog(`✨ 【聖光吟誦】：成功使對手陷入 3 回合疲憊狀態！`, "status");
    }

    // 4 回合內受到攻擊時反擊對手最大體力 1/3
    setPlayerState("puniYinSongReflectTurns", 4);

    // 下 2 回合對手受到傷害提升 150%
    ctx.setNextTurns?.("self", "puniDamageBoostTurns", 2); // 下2回合

    addLog(`✨ 【聖光吟誦】：附加 4 回合受擊反彈對手最大體力 1/3 傷害，下 2 回合對手受到傷害提升 150% 的特殊效果！`, "effect");
  },
  "神神之門": (ctx) => {
    const { target, addLog } = ctx;
    let cleared = false;
    for (const key in target.statStages) {
      if (target.statStages[key] > 0) {
        target.statStages[key] = 0;
        cleared = true;
      }
    }
    if (cleared) addLog(`✨ 【神神之門】：消除了對手能力提升狀態！`, "effect");
  },
  "神靈救世光": (ctx) => {
    const { self, target, addLog, clearTurnEffectsOf, setPlayerState, targetSide, adjustHp, applyHeal, actor } = ctx;
    
    // B effects (命中前): 消除對手回合類效果
    const cleared = clearTurnEffectsOf(targetSide);
    if (cleared) {
      addLog(`✨ 【神靈救世光】：消除了對手的所有回合類效果！`, "effect");
      
      // [消除成功] 3 回合對手無法用技能恢復體力
      setPlayerState("oppSealHealTurns", 3);
      addLog(`✨ 【神靈救世光】：消除成功，封印對手恢復體力能力 3 回合！`, "status");
    } else {
      addLog(`✨ 【神靈救世光】：對手沒有可消除的回合類效果。`, "info");
    }

    // C effects (命中後):
    // [未擊敗] 下回合附加自身最大體力 1/3 固傷
    setPlayerState("puniJiuShiPursuit", true);
    
    // 吸取對手 200 體力，自身 < 1/2 時翻倍
    const steal = self.currentHp < self.maxHp / 2 ? 400 : 200;
    adjustHp(targetSide, -steal);
    applyHeal(actor, steal);
    addLog(`✨ 【神靈救世光】：吸取對手 ${steal} 點體力！`, "heal");
  }
};

export { PuniBaseDeconstructedProfile } from "../../../data/elfProfiles/puniRegistry";

export { ShenglingPuniDeconstructedProfile } from "../../../data/elfProfiles/puniRegistry";
