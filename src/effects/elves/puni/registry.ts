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

export const handleShenglingPuniSoulMark = (context: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  if (benchSkip(context, event)) return; // 場下不觸發回合節點效果（例：聖・回合結束回復）
  const priorityComp = extraData?.priorityComp;
  const { self, target, actor, setPlayerState, getPlayerState, setOpponentState, addLog, clearTurnEffectsOf, applyStatusWithImmunityCheck, applyPinkDamage, skill, updateElf, applyFixedDamage } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";
  if (event === EffectTiming.ROUND_START) puniSharedRoundStart(context);
  if (event === EffectTiming.BEFORE_ACTION) puniSharedBeforeAction(context);

  // 0. BEFORE_TURN_RESOLVE: 聖靈譜尼「輪迴」時點備份
  if (event === EffectTiming.BEFORE_TURN_RESOLVE) {
    setPlayerState("puniTurnSnapshot", {
      hp: self.currentHp,
      statStages: { ...self.statStages },
      skills: self.skills.map(s => ({ name: s.name, pp: s.pp }))
    });
  }

  // BEFORE_STATUS_APPLY: 聖潔-a (天生免疫所有異常狀態)
  if (event === EffectTiming.BEFORE_STATUS_APPLY && extraData) {
    extraData.prevented = true;
    extraData.prevent = true;
    addLog(`✨ 【聖潔】：天生免疫異常狀態【${extraData.status}】！`, "status");
  }

  // MODIFY_PRIORITY: 永恆 (必定先手) + 夢/屬性技能先制
  if (event === EffectTiming.MODIFY_PRIORITY && priorityComp) {
    const comp = priorityComp;

    // 永恆：回合開始時若自身體力高於對手則當回合必定先手
    if (self.currentHp > target.currentHp) {
      comp.forcedFirst = true;
    }

    // 2. 聖潔：必定先出 (非屬性技能)
    if (skill && skill.category !== "屬性" && getPlayerState("puniAlwaysFirstTurns") > 0) {
      comp.bonus += 10;
    }

    // 3. 夢/啟示 先制
    if (getPlayerState("puniMengPriorityTurns") > 0) {
      comp.bonus += 2;
    }
    if (getPlayerState("puniQiShiPriorityTurns") > 0) {
      comp.bonus += 3;
    }

    // 4. 璨靈聖光 bonus
    if (skill && skill.name === "璨靈聖光") {
      const isCounter = target.type.includes("混沌") || target.type.includes("神秘") || target.type.includes("邪靈");
      if (isCounter) {
        comp.bonus += 1;
      }
    }
  }

  // ENFORCE: 聖潔-b (天生免疫能力下降狀態) & 聖潔-a (異常清除) & 常駐能力下降免疫
  if (event === EffectTiming.ENFORCE) {
    setPlayerState("immuneStatDownTurns", 99);

    if (isAbnormal(self)) {
      self.battleStatus = "normal";
      self.battleStatuses = {};
      self.effects = (self.effects || []).filter(e => {
        const entry = StatusRegistry[e.id];
        return entry?.categories?.includes('AUXILIARY');
      });
      addLog(`✨ 【聖潔】：天生免疫所有異常狀態！`, "status");
    }

    const stages = self.statStages || { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
    let debuffCleared = false;
    for (const key in stages) {
      const k = key as keyof typeof stages;
      if ((stages[k] || 0) < 0) {
        (stages as any)[k] = 0;
        debuffCleared = true;
      }
    }
    if (debuffCleared) {
      self.statStages = { ...stages };
      addLog(`✨ 【聖潔】：天生免疫所有能力下降狀態！`, "effect");
    }
  }

  // ON_ENTRANCE: 元素-a (消除對手回合類效果) & 元素-b (消除成功對手下次技能無效)
  if (event === EffectTiming.ON_ENTRANCE) {
    setPlayerState("immuneStatDownTurns", 99);
    const cleared = clearTurnEffectsOf(oppSide);
    if (cleared) {
      addLog(`✨ 【元素】：登場時，消除了對手的所有回合類效果！`, "effect");
      setOpponentState("nextSkillInvalid", true);
      setOpponentState("nextSkillInvalidReason", "【元素】技能失效");
      addLog(`✨ 【元素】：消除成功！使對手下一次使用的技能無效！`, "effect");
    } else {
      addLog(`✨ 【元素】：登場時，對手沒有可消除的回合類效果。`, "info");
    }
  }

  puniSkillStateEffects(context, event, extraData);

  // BEFORE_DAMAGE: 虛無 (受到攻擊傷害時，免疫下 1 次受到的攻擊傷害) & 其它無效化
  if (event === EffectTiming.BEFORE_DAMAGE && extraData) {
    if (extraData.isIncoming === true) {
      if (extraData.damageCategory === "skill_attack" && getPlayerState("puniNextAttackImmune") && !bypassesAttackDefense(extraData, 'block')) {
        extraData.multiplier = 0;
        setPlayerState("puniNextAttackImmune", false);
        addLog(`✨ 【虛無】：化身虛無，使對手本次攻擊無效化！`, "effect");
      }
      
    } else {
      // 自身造成傷害
    }
  }

  // ON_DAMAGED: 虛無 (受傷附加免疫下一次攻擊傷害 flag) & 反彈效果
  if (event === EffectTiming.ON_DAMAGED && extraData) {
    if (extraData.damageType === "skill_attack") {
      setPlayerState("puniNextAttackImmune", true);
      addLog(`✨ 【虛無】：受到攻擊傷害，下一次受到的攻擊傷害將被免疫！`, "effect");
    }

    puniSharedOnDamaged(context, extraData);
    if (getPlayerState("puniYinSongReflectTurns") > 0) {
      const reflectDmg = Math.floor(target.maxHp / 3);
      applyPinkDamage(oppSide, reflectDmg, "【聖光吟誦】百分比傷害", undefined, undefined, "percent");
      addLog(`✨ 【聖光吟誦】：受到攻擊，附加對手最大體力 1/3 的百分比傷害 (${reflectDmg})！`, "damage");
    }
  }

  // AFTER_ACTION: 光榮之夢（3回合內每回合使用技能吸取對手能力提升狀態）、神靈救世光追加
  if (event === EffectTiming.AFTER_ACTION) {
    if (getPlayerState("puniMengStealTurns") > 0) {
      let stolen = false;
      const nextOppStages = { ...target.statStages };
      const nextSelfStages = { ...self.statStages };
      for (const key in nextOppStages) {
        if ((nextOppStages as any)[key] > 0) {
          (nextSelfStages as any)[key] = Math.min(6, ((nextSelfStages as any)[key] || 0) + (nextOppStages as any)[key]);
          (nextOppStages as any)[key] = 0;
          stolen = true;
        }
      }
      if (stolen) {
        updateElf(actor, { statStages: nextSelfStages });
        updateElf(oppSide, { statStages: nextOppStages });
        addLog(`✨ 【光榮之夢】：使用技能，吸取了對手的能力提升狀態！`, "effect");
      }
    }
    if (getPlayerState("puniJiuShiNextAttackBuff") && target.currentHp > 0) {
      if (skill) { // 新描述：下1次自身技能（不限攻擊）
        setPlayerState("puniJiuShiNextAttackBuff", false);
        const extraDmg = Math.floor(self.maxHp / 3);
        applyPinkDamage(oppSide, extraDmg, "【神靈救世光】追傷", undefined, undefined, "percent");
        addLog(`✨ 【神靈救世光】：消耗下次攻擊補償效果，附加了自身最大體力 1/3 (${extraDmg}) 的百分比傷害！`, "damage");
      }
    }
  }

  // FATAL_RESIST: 輪迴-a (殘留 1 血)
  if (event === EffectTiming.FATAL_RESIST) {
    const currentActiveActor = getPlayerState("currentActiveActor");
    const isOpponentTurn = currentActiveActor !== actor;
    
    if (isOpponentTurn) {
      const reincarnationTriggered = !!getPlayerState("puniReincarnationTriggered");
      if (!reincarnationTriggered) {
        addLog(`✨ 【輪迴】：對手出手回合遭受致命傷害！保留 1 點體力，並將在回合結束後回滾至選擇操作後狀態！`, "effect");
        setPlayerState("puniReincarnationTriggered", true);
        setPlayerState("puniReincarnationPendingRollback", true);
        updateElf(actor, { currentHp: 1 });
        return true; // 抵抗瀕死
      }
    }
  }

  // BATTLE_PHASE_END: 能量 (已損體力50%百分比傷害) & 生命-a (恢復1/4) & 生命-b (恢復 PP)
  if (event === EffectTiming.BATTLE_PHASE_END) {
    // 能量：戰鬥階段結束時附加自身已損失體力50%百分比傷害
    const lostHp = self.maxHp - self.currentHp;
    if (lostHp > 0) {
      const energyDmg = Math.floor(lostHp * 0.5);
      if (energyDmg > 0) {
        applyPinkDamage(oppSide, energyDmg, "【能量】百分比傷害", undefined, undefined, "percent");
        addLog(`✨ 【能量】：戰鬥階段結束，附加了自身已損失體力 50% (${energyDmg}) 的百分比傷害！`, "damage");
      }
    }

    // 生命-a：戰鬥階段結束恢復自身最大體力1/4
    const shengMingHeal = Math.floor(self.maxHp * 0.25);
    self.currentHp = Math.min(self.maxHp, self.currentHp + shengMingHeal);
    addLog(`✨ 【生命】：戰鬥階段結束，恢復了自身最大體力 1/4 (${shengMingHeal})！`, "heal");

    // 生命-b：戰鬥階段結束隨機2個未滿PP技能+1PP
    const unfilledSkills = self.skills.filter(s => s.pp !== undefined && (s.pp < (s.maxPp ?? 5)));
    if (unfilledSkills.length > 0) {
      const shuffled = [...unfilledSkills].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 2);
      selected.forEach(s => {
        s.pp = (s.pp ?? 0) + 1;
        addLog(`✨ 【生命】：隨機恢復技能【${s.name}】1 點 PP！`, "heal");
      });
    }
  }

  // ROUND_END: 輪迴-b (快照回滾) & 其它狀態計數更新
  if (event === EffectTiming.ROUND_END) {
    // 輪迴狀態回滾
    if (getPlayerState("puniReincarnationPendingRollback")) {
      setPlayerState("puniReincarnationPendingRollback", false);
      const snapshot = getPlayerState("puniTurnSnapshot");
      if (snapshot) {
        addLog(`✨ 【輪迴】：時空倒流！體力、PP 值與能力等級返回至當回合選擇操作後的狀態！`, "effect");
        self.currentHp = snapshot.hp;
        self.statStages = { ...snapshot.statStages };
        self.skills.forEach(s => {
          const snapSkill = snapshot.skills.find((sk: any) => sk.name === s.name);
          if (snapSkill) {
            s.pp = snapSkill.pp;
          }
        });
        addLog(`✨ 【輪迴】：體力恢復為 ${self.currentHp}！`, "heal");
      }
    }

    // 更新其它技能狀態計數
    puniSharedRoundEnd(context);
    if (getPlayerState("puniVoidShieldTurns") > 0) setPlayerState("puniVoidShieldTurns", getPlayerState("puniVoidShieldTurns") - 1);
    if (getPlayerState("puniCanLingHealTurns") > 0) {
      setPlayerState("puniCanLingHealTurns", getPlayerState("puniCanLingHealTurns") - 1);
      const heal = Math.floor(self.maxHp / 3);
      self.currentHp = Math.min(self.maxHp, self.currentHp + heal);
      addLog(`✨ 【璨靈聖光】：每回合恢復 1/3 體力 (${heal})！`, "heal");
    }
    if (getPlayerState("puniDoubleDamageTurns") > 0) setPlayerState("puniDoubleDamageTurns", getPlayerState("puniDoubleDamageTurns") - 1);
    if (getPlayerState("puniAlwaysFirstTurns") > 0) setPlayerState("puniAlwaysFirstTurns", getPlayerState("puniAlwaysFirstTurns") - 1);
    if (getPlayerState("puniShengGuangQiTurns") > 0) setPlayerState("puniShengGuangQiTurns", getPlayerState("puniShengGuangQiTurns") - 1);
    if (getPlayerState("puniYinSongReflectTurns") > 0) setPlayerState("puniYinSongReflectTurns", getPlayerState("puniYinSongReflectTurns") - 1);
    if (getPlayerState("puniDamageBoostTurns") > 0) setPlayerState("puniDamageBoostTurns", getPlayerState("puniDamageBoostTurns") - 1);
    
    if (getPlayerState("oppUtilitySealedTurns") > 0) {
      const nextTurns = getPlayerState("oppUtilitySealedTurns") - 1;
      setPlayerState("oppUtilitySealedTurns", nextTurns);
      if (nextTurns === 0) {
        addLog(`✨ 【聖光吟誦】：屬性技能失效狀態已結束。`, "info");
      }
    }
    if (getPlayerState("oppHalfUtilitySealedTurns") > 0) {
      const nextTurns = getPlayerState("oppHalfUtilitySealedTurns") - 1;
      setPlayerState("oppHalfUtilitySealedTurns", nextTurns);
      if (nextTurns === 0) {
        setPlayerState("utilitySkillInvalidChance", 0);
      }
    }
    if (getPlayerState("oppSealHealTurns") > 0) {
      const nextTurns = getPlayerState("oppSealHealTurns") - 1;
      setPlayerState("oppSealHealTurns", nextTurns);
      if (nextTurns === 0) {
        addLog(`✨ 封印恢復體力狀態已結束。`, "info");
      }
    }
    if (getPlayerState("puniShengJieMissTurns") > 0) {
      setPlayerState("puniShengJieMissTurns", getPlayerState("puniShengJieMissTurns") - 1);
    }

    if (getPlayerState("puniMengStealTurns") > 0) {
      setPlayerState("puniMengStealTurns", getPlayerState("puniMengStealTurns") - 1);
    }
    if (getPlayerState("puniMengPriorityTurns") > 0) setPlayerState("puniMengPriorityTurns", getPlayerState("puniMengPriorityTurns") - 1);

    if (getPlayerState("puniShengYingBuffIfAlive")) {
      setPlayerState("puniShengYingBuffIfAlive", false);
      if (target.currentHp > 0) {
        self.statStages.spatk = Math.min(6, (self.statStages.spatk || 0) + 1);
        self.statStages.speed = Math.min(6, (self.statStages.speed || 0) + 1);
        addLog(`✨ 【聖影流光破】：未擊敗對手，自身特攻、速度+1！`, "effect");
      }
    }
    if (getPlayerState("puniJiuShiPursuit")) {
      setPlayerState("puniJiuShiPursuit", false);
      if (target.currentHp > 0) {
        setPlayerState("puniJiuShiNextAttackBuff", true);
        addLog(`✨ 【神靈救世光】：當回合未擊敗對手，使自身下次攻擊附加自身最大體力 1/3 的百分比傷害！`, "info");
      }
    }
    if (getPlayerState("puniQiShiPriorityTurns") > 0) {
      setPlayerState("puniQiShiPriorityTurns", getPlayerState("puniQiShiPriorityTurns") - 1);
    }
  }

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
