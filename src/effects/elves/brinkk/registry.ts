import { multiplyDamageReduction, addDamageReduction } from '../../../battle/damageReduction';
import { BattleEventContext, BattleSkillHandler, EffectTiming } from "../../types";
import { createExtraElf } from "../../../utils/extraElf";
import { getMaxPp } from "../../../utils/battleHelpers";
import { StatusRegistry } from "../../statusRegistry";
import { sameStatus } from "../../statusIdentity";
import type { Elf, Skill } from "../../../types";
import { getTypeMatchup } from '../../../utils/statCalculator';
import { queueHpDrain } from '../../../battle/hpDrain';

const identity = (elf: Elf) => elf.battleId || elf.id;
const activeTimers = (ctx: BattleEventContext) => (ctx.actor === "p1" ? ctx.p1Timers : ctx.p2Timers) || [];
const timerOn = (ctx: BattleEventContext, id: string) => activeTimers(ctx).some(t => t.id === id && t.remaining > 0 && !t.pendingActivation && (!t.ownerBattleId || t.ownerBattleId === identity(ctx.self)));
const addSkillTimer = (ctx: BattleEventContext, id: string, name: string, turns: number, payload: Record<string, any> = {}, next = false) => ctx.addTimerTo(ctx.actor, {
  id, name, kind: "turn_effect", source: "skill", remaining: turns, tickAt: "round_end", pendingActivation: next, payload,
}, ctx.moveIndex === 1);

/** 解除指定異常的所有儲存形式，保留未指定的附屬類異常。 */
export function clearBrinkkStatuses(ctx: BattleEventContext, elf: Elf, pick: (name: string) => boolean): void {
  const side = identity(elf) === identity(ctx.self) ? ctx.actor : ctx.targetSide;
  const current = ctx.getFullTeam(side).find(e => identity(e) === identity(elf)) || elf;
  const patch: Partial<Elf> = {
    battleStatuses: Object.fromEntries(Object.entries(current.battleStatuses || {}).filter(([name]) => !pick(name))),
    effects: (current.effects || []).filter(effect => !pick(effect.name)),
    ...(pick(current.battleStatus || "normal") ? { battleStatus: "normal" as const, battleStatusDuration: 0 } : {}),
  };
  Object.assign(elf, patch);
  ctx.updateAnyElf(side, identity(elf), patch);
}

/** 固有威力變化；強化吸取／反轉仍在命中 handler 中先於傷害公式執行。 */
export const BRINKK_DAMAGE_TRANSFORMS = {
  "溺咒之握": (ctx: BattleEventContext, skill: Skill): Skill => ctx.self.isInherentInvalid ? skill : {
    ...skill, power: (skill.power || 0) + Math.floor(ctx.target.maxHp / 3) + (ctx.self.ivs?.hp ?? 31),
  },
};
export const BRINKK_SKILL_TRANSFORMS = {
  "深潛者盛宴": (ctx: BattleEventContext, skill: Skill): Skill => {
    if (!ctx.self.isInherentInvalid) {
      ctx.setPlayerState("blkTypeOverride", ["水", "混沌", "水.混沌", "普通"]);
      ctx.setPlayerState("blkTypeOverrideUses", 1);
      ctx.setPlayerState("blkTypeOverrideCurrentAction", true);
      ctx.setPlayerState("blkTypeOverrideExtend", 2);
    }
    return skill;
  },
};

/**
 * 混濁海妖·布林克克 (Brinkk)
 * 魂印：濁
 * 
 * 遵循「語義分詞與實裝協定」與「永久性防範與開發自我檢查規則」，
 * 所有精靈的專屬機制（包括克塔亞特的狀態、汲取、獻祭與消逝等）全部封裝於此註冊表中，
 * 不入侵或硬編碼主戰鬥控制器 BattleScreen.tsx。
 */

// 判定對手是否為天敵
const isNaturalEnemy = (targetType: string): boolean => {
  if (!targetType) return false;
  return getTypeMatchup(targetType, "混沌.水") > 1;
};

export const handleBrinkkSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const {
    self,
    target,
    actor,
    setPlayerState,
    getPlayerState,
    getOpponentState,
    setOpponentState,
    addLog,
    applyHeal,
    applyTrueDamage,
    applyStatusWithImmunityCheck,
    clearTurnEffectsOf,
    vanishElf,
    getFullTeam
  } = ctx;

  const oppSide = actor === "p1" ? "p2" : "p1";

  // 1. 戰鬥開始或首次登場初始化克塔亞特 (Cthyaat)
  if (!getPlayerState("cthyaatInitialized")) {
    setPlayerState("cthyaatInitialized", true);
    
    // 克塔亞特：水系額外精靈，加入時複製己方所有精靈能力值的總和一半作為自身能力值
    const myFullTeam = getFullTeam(actor);
    let sumHp = 0;
    let sumAtk = 0;
    let sumDef = 0;
    let sumSpatk = 0;
    let sumSpdef = 0;
    let sumSpeed = 0;

    myFullTeam.forEach(elf => {
      sumHp += elf.maxHp || 1000;
      sumAtk += elf.calculatedStats.atk;
      sumDef += elf.calculatedStats.def;
      sumSpatk += elf.calculatedStats.spatk;
      sumSpdef += elf.calculatedStats.spdef;
      sumSpeed += elf.calculatedStats.speed;
    });
    
    const cthyaatMaxHp = Math.max(1, Math.floor(sumHp / 2));
    setPlayerState("cthyaatHp", cthyaatMaxHp);
    setPlayerState("cthyaatMaxHp", cthyaatMaxHp);
    setPlayerState("cthyaatActive", true);

    const cthyaatElf = createExtraElf(self, {
      name: "克塔亞特",
      type: "水",
      maxHp: cthyaatMaxHp,
      currentHp: cthyaatMaxHp,
      baseStats: {
        hp: cthyaatMaxHp,
        atk: Math.floor(sumAtk / 2),
        def: Math.floor(sumDef / 2),
        spatk: Math.floor(sumSpatk / 2),
        spdef: Math.floor(sumSpdef / 2),
        speed: Math.floor(sumSpeed / 2),
      },
      calculatedStats: { hp: cthyaatMaxHp, atk: Math.floor(sumAtk / 2), def: Math.floor(sumDef / 2), spatk: Math.floor(sumSpatk / 2), spdef: Math.floor(sumSpdef / 2), speed: Math.floor(sumSpeed / 2) },
      badge: "🦑",
      skills: [],
      soulMark: {
        name: "克塔亞特（水系額外精靈）",
        description: "克塔亞特:水系額外精靈，加入時複製己方所有精靈能力值的總和一半作為自身能力值；己方精靈每次出戰時令其漸凍1回合，未觸發則3回合內造成非真實傷害減半n次(n=本次在場期間所受到真實傷害次數)；己方精靈任意戰鬥階段節點結算時自身額外汲取己方在場精靈當前體力¼；本場戰鬥結束時，令己方所有已死亡精靈與隨機1隻背包內存活精靈消逝，自身不計入勝負計算時的精靈數判定；自身死亡時消逝，並令己方所有精靈失去自身當前體力上限⅛的體力上限",
        effectType: "none",
        effectValue: 0
      }
    });

    ctx.addExtraElf(oppSide, cthyaatElf);

    addLog(`🦑 【濁】：深海古神「克塔亞特」作為額外精靈降臨敵方陣營！複製己方能力總和之一半（體力 ${cthyaatMaxHp} HP）！`, "effect");
  }

  // 取得克塔亞特當前狀態

  // 己方精靈任意戰鬥階段節點結算時自身額外汲取己方在場精靈當前體力¼。
  // 抽為共用函式，掛到所有「場下克塔亞特能收到」的全隊廣播節點（回合開始/回合結束/戰鬥階段結束）。
  // 同步回寫 team 內真正的克塔亞特 Elf.currentHp，避免 playerState 與可視血條脫節（雙軌）。
  const runNodeDrain = (nodeLabel: string) => {
    const cActive = getPlayerState("cthyaatActive");
    const liveExtra = getFullTeam(oppSide).find(e => e.isExtra && e.name === "克塔亞特");
    const cHp = liveExtra?.currentHp ?? (getPlayerState("cthyaatHp") || 0);
    const cMax = liveExtra?.maxHp ?? (getPlayerState("cthyaatMaxHp") || 1000);
    if (!cActive || cHp <= 0) return;
    const oppActiveElf = actor === "p1" ? ctx.activeP2 : ctx.activeP1;
    if (!oppActiveElf || oppActiveElf.currentHp <= 0) return;
    const drainRaw = Math.floor(oppActiveElf.currentHp / 4);
    if (drainRaw <= 0) return;
    // 以真實傷害對己方在場精靈施加汲取（oppSide = 克塔亞特所在陣營）
    const dealt = applyTrueDamage(oppSide, drainRaw, `克塔亞特汲取·${nodeLabel}`);
    const gained = dealt > 0 ? dealt : drainRaw;
    const newCthyaatHp = Math.min(cMax, cHp + gained);
    setPlayerState("cthyaatHp", newCthyaatHp);
    const cthyaatElf = getFullTeam(oppSide).find(e => e.isExtra && e.name === "克塔亞特");
    if (cthyaatElf) { cthyaatElf.maxHp = cMax; cthyaatElf.currentHp = newCthyaatHp; }
    addLog(`🦑 【克塔亞特】：[${nodeLabel}] 古神以真實傷害汲取 ${oppActiveElf.name} 當前體力 ¼ (${gained} HP)！當前體力：${newCthyaatHp} / ${cMax} HP。`, "effect");
  };

  // C5：克塔亞特「自身死亡時」消逝，並令己方（克塔亞特所在陣營 oppSide）所有精靈
  // 失去「克塔亞特當前體力上限⅛」的體力上限。注意 base 為克塔亞特體力上限，非各精靈自身。
  const onCthyaatDeath = () => {
    const cMax = getPlayerState("cthyaatMaxHp") || 1000;
    const loss = Math.floor(cMax / 8);
    setPlayerState("cthyaatActive", false);
    setPlayerState("cthyaatHp", 0);
    const cthTeam = getFullTeam(oppSide);
    cthTeam.forEach(elf => {
      if (elf.isExtra && elf.name === "克塔亞特") return;
      {
        elf.maxHp = Math.max(1, elf.maxHp - loss);
        elf.currentHp = Math.min(elf.currentHp, elf.maxHp);
      }
    });
    const cthyaatElf = cthTeam.find(e => e.isExtra && e.name === "克塔亞特");
    if (cthyaatElf) vanishElf(oppSide, cthyaatElf);
    addLog(`💀 【克塔亞特】：古神殞落消逝！其所在陣營所有精靈體力上限永久降低 ${loss}（克塔亞特體力上限⅛）！`, "defeat");
  };

  const liveCthyaat = getFullTeam(oppSide).find(e => e.isExtra && e.name === "克塔亞特");
  if (liveCthyaat && getPlayerState("cthyaatActive")) {
    setPlayerState("cthyaatHp", liveCthyaat.currentHp);
    setPlayerState("cthyaatMaxHp", liveCthyaat.maxHp);
    if (liveCthyaat.currentHp <= 0) onCthyaatDeath();
  }
  const cthyaatActive = getPlayerState("cthyaatActive");
  const cthyaatHp = getPlayerState("cthyaatHp") || 0;
  const cthyaatMaxHp = getPlayerState("cthyaatMaxHp") || 1000;

  switch (event) {
    case EffectTiming.MODIFY_PRIORITY: {
      const comp = extraData?.priorityComp;
      if (!comp || self.isInherentInvalid) break;
      if (ctx.skill?.name === "不淨者之約" && isNaturalEnemy(target.type)) comp.bonus += 3;
      break;
    }
    case EffectTiming.BEFORE_ACTION: {
      if (timerOn(ctx, "brinkk_deepsea")) {
        const ratio = self.currentHp < self.maxHp / 2 ? 2 / 3 : 1 / 3;
        queueHpDrain(ctx, oppSide, Math.floor(target.maxHp * ratio), 'percent', "深海働哭·持續吸取");
      }
      break;
    }
    case EffectTiming.OPPONENT_DAMAGE: {
      if (extraData?.hpReduced === 0 && extraData?.label === "深海働哭·持續吸取") applyTrueDamage(oppSide, 300, "深海働哭·吸取未減少");
      if (extraData?.hpReduced === 0 && extraData?.label === "深潛者盛宴·獨立吸取" && getPlayerState("brinkkFeastAbsorbFallbackPending")) {
        setPlayerState("brinkkFeastAbsorbFallbackPending", false);
        ctx.applyAbsorb(oppSide, Math.floor(target.currentHp / 4), "深潛者盛宴·吸取未減少");
      }
      break;
    }
    case EffectTiming.OPPONENT_ACTION: {
      if (timerOn(ctx, "brinkk_chiyu") && !Object.entries(ctx.getStatuses(target)).some(([name, duration]) => duration > 0 && StatusRegistry[name]?.categories.includes("CONTROL"))) {
        ctx.setOpponentState("next2AtkInvalid", (ctx.getOpponentState("next2AtkInvalid") || 0) + 1);
        ctx.setOpponentState("attackInvalidSource", "癡愚之觸");
        setPlayerState("chiyuExtraPending", true);
      }
      break;
    }
    case EffectTiming.SKILL_INVALID: {
      if (extraData?.isIncoming && extraData.reason?.includes("癡愚之觸") && getPlayerState("chiyuExtraPending")) {
        setPlayerState("chiyuExtraPending", false);
        setOpponentState("next2AtkInvalid", (getOpponentState("next2AtkInvalid") || 0) + 1);
      }
      break;
    }
    case EffectTiming.ON_ENTRANCE: {
      const activeElf = actor === "p1" ? ctx.activeP1 : ctx.activeP2;
      const isBrinkkActive = activeElf?.id === self.id;
      
      if (isBrinkkActive) {
        addLog(`🦑 【濁】：混濁海妖·布林克克破浪登場，古神之影籠罩全場！`, "effect");
        setPlayerState("turnsInField", 1);
      }
      break;
    }

    case EffectTiming.ELF_ENTERED: {
      // C2：克塔亞特「己方精靈每次出戰時令其漸凍1回合；未觸發則3回合內造成非真實傷害減半n次」。
      // 己方 = 克塔亞特所在陣營 oppSide。（ON_ENTRANCE 僅通知進場者自己，故改用全隊廣播 ELF_ENTERED）
      if (!getPlayerState("cthyaatActive") || (getPlayerState("cthyaatHp") || 0) <= 0) break;
      if (extraData?.enteredSide !== oppSide) break;
      const enteredElf = getFullTeam(oppSide).find(e => e.id === extraData?.enteredId);
      if (!enteredElf || (enteredElf.isExtra && enteredElf.name === "克塔亞特")) break;
      setOpponentState("brinkkTrueDamageTakenCount", 0);
      addLog(`🦑 【克塔亞特】：${enteredElf.name} 出戰，古神寒氣侵襲！`, "effect");
      const frostRes = applyStatusWithImmunityCheck(oppSide, "漸凍", 1);
      if (!frostRes.success) {
        const trueDamageTaken = getOpponentState("brinkkTrueDamageTakenCount") || 0;
        ctx.addTimerTo(oppSide, { id: "cthyaat_half_damage", name: "克塔亞特·非真實傷害減半", kind: "round_counter", source: "soulmark", remaining: 3, tickAt: "round_end", payload: { block: { dmgOutMult: 0.5, kind: "非真實", powRegistryKey: "brinkkTrueDamageTakenCount" }, polarity: "negative" } }, false);
        addLog(`🦑 【克塔亞特】：漸凍未觸發，附加 3 回合內非真實傷害減半 ${trueDamageTaken} 次！`, "effect");
      }
      break;
    }

    case EffectTiming.BEFORE_DAMAGE: {
      // 判斷傷害方向與類型
      if (extraData?.isIncoming) {
        // 受到傷害
        if (extraData?.damageCategory !== "true") {
          // 自身位於場下期間，對手每次受到真實傷害時降低自身受到非真實傷害4% (最多疊加16次)
          const isBrinkkActive = (actor === "p1" ? ctx.activeP1 : ctx.activeP2)?.id === self.id;
          if (isBrinkkActive) {
            const offFieldStacks = getPlayerState("brinkkOffFieldTrueDamageStacks") || 0;
            if (offFieldStacks > 0) {
              const reduction = 0.04 * offFieldStacks;
              multiplyDamageReduction(extraData, 1 - reduction);
              addLog(`🦑 【濁】：位於場下的海妖護庇，受到的非真實傷害降低 ${offFieldStacks * 4}%！`, "effect");
            }
          }
        }
      } else {
        // 造成傷害
        if (extraData?.damageCategory !== "true") {
          // 自身在場期間，對手每次受到真實傷害提升造成非真實傷害4% (最多疊加32次)
          const isBrinkkActive = (actor === "p1" ? ctx.activeP1 : ctx.activeP2)?.id === self.id;
          if (isBrinkkActive) {
            const onFieldStacks = getPlayerState("brinkkOnFieldTrueDamageStacks") || 0;
            if (onFieldStacks > 0) {
              extraData.increasePercent = (extraData.increasePercent || 0) + (0.04 * onFieldStacks);
              addLog(`🦑 【濁】：在場海妖凝聚痛苦，本次非真實傷害提升 ${onFieldStacks * 4}%！`, "effect");
            }

          }
        }
      }
      break;
    }

    case EffectTiming.TRUE_DAMAGE_TAKEN: {
      const isBrinkkActive = (actor === "p1" ? ctx.activeP1 : ctx.activeP2)?.id === self.id;
      // 對手受到真實傷害時
      if (extraData?.damageType === "true" && extraData?.side !== actor) {
        if (isBrinkkActive) {
          // 自身在場期間，增加自身等量體力並造成非真實傷害提升4%(最多32次)
          const healAmt = extraData.damage;
          applyHeal(actor, healAmt);
          
          const onFieldStacks = Math.min(32, (getPlayerState("brinkkOnFieldTrueDamageStacks") || 0) + 1);
          setPlayerState("brinkkOnFieldTrueDamageStacks", onFieldStacks);
          addLog(`🦑 【濁】：對手承受真實傷害！海妖吸取 ${healAmt} 體力，造成的非真實傷害提升 ${onFieldStacks * 4}% (已疊加 ${onFieldStacks} 次)！`, "heal");
        } else {
          // 自身位於場下期間，消耗自身當前體力1/8，受到非真實傷害降低4%(最多16次，若判斷體力降為0時不執行)
          const hpCost = Math.floor(self.currentHp / 8);
          if (self.currentHp - hpCost > 0) {
            self.currentHp -= hpCost;
            const offFieldStacks = Math.min(16, (getPlayerState("brinkkOffFieldTrueDamageStacks") || 0) + 1);
            setPlayerState("brinkkOffFieldTrueDamageStacks", offFieldStacks);
            addLog(`🦑 【濁】：位於場下的海妖遠端共鳴，消耗 ${hpCost} 體力，受到的非真實傷害降低 ${offFieldStacks * 4}% (已疊加 ${offFieldStacks} 次)！`, "effect");
          }
        }

        // 累計真實傷害次數，用於克塔亞特的非真實傷害減半次數
        const count = (getOpponentState("brinkkTrueDamageTakenCount") || 0) + 1;
        setOpponentState("brinkkTrueDamageTakenCount", count);
      }
      break;
    }

    case EffectTiming.ROUND_START: {
      const activeElf = actor === "p1" ? ctx.activeP1 : ctx.activeP2;
      const isBrinkkActive = activeElf?.id === self.id;

      if (isBrinkkActive) {
        // 回合開始時，若場上存在本次在場期間不大於2回合或在場超過8回合以上的精靈，則自身體力上限提升20%並恢復自身全部體力與pp值
        const brinkkTurns = ctx.roundNumber === undefined ? getPlayerState("turnsInField") || 1 : ctx.roundNumber - (getPlayerState("fieldEntryTurn") ?? 1) + 1;
        const oppTurns = ctx.roundNumber === undefined ? getOpponentState("turnsInField") || 1 : ctx.roundNumber - (getOpponentState("fieldEntryTurn") ?? 1) + 1;
        
        if (brinkkTurns <= 2 || brinkkTurns > 8 || oppTurns <= 2 || oppTurns > 8) {
          // 體力上限提升 20%
          self.maxHp = Math.floor(self.maxHp * 1.2);
          self.currentHp = self.maxHp;
          // 恢復全部 pp
          self.skills.forEach(s => {
            if (s.pp !== undefined) s.pp = getMaxPp(s, self);
          });
          addLog(`🦑 【濁】：回合開始時場上存在本次在場期間不大於2回合或超過8回合的精靈（己方 ${brinkkTurns} / 對方 ${oppTurns} 回合），體力上限提升 20%，體力與 PP 全部恢復全滿！`, "heal");
        }

        setPlayerState("turnsInField", brinkkTurns + 1);
      }

      // 己方精靈任意戰鬥階段節點結算時自身額外汲取己方在場精靈當前體力¼（回合開始節點）
      runNodeDrain("回合開始");
      break;
    }

    case EffectTiming.ROUND_END: {
      // 己方精靈任意戰鬥階段節點結算時自身額外汲取¼（回合結束節點）
      runNodeDrain("回合結束");

      // 處理克塔亞特的漸凍減半回合遞減
      const halfTurns = getPlayerState("cthyaatDmgHalfTurns") || 0;
      if (halfTurns > 0) {
        setPlayerState("cthyaatDmgHalfTurns", halfTurns - 1);
      }

      // 深海働哭 延遲冰封與清除效果
      if (timerOn(ctx, "brinkk_freeze_pending")) {
        ctx.consumeTimer?.(actor, "brinkk_freeze_pending");
        if (getPlayerState("deepSeaFreezeTarget") !== identity(target)) break;
        setPlayerState("deepSeaFreezePending", false);
        clearTurnEffectsOf(oppSide);
        applyStatusWithImmunityCheck(oppSide, "冰封", 3); // 描述未寫回合數：預設 3
        addLog(`🌊 【深海働哭】：古神之怨引發回合末冰封與消除回合類效果！`, "status");
      }
      break;
    }

    case EffectTiming.BATTLE_PHASE_END: {
      // 己方精靈任意戰鬥階段節點結算時自身額外汲取¼（戰鬥階段結束節點）
      runNodeDrain("戰鬥階段結束");
      break;
    }

    case EffectTiming.EXTRA_ELF_NODE: {
      // 出手流程各節點（出手流程開始/結束、死亡節點、擊敗對手等）由主控制器全隊廣播而來，
      // 讓場下的克塔亞特也能在這些節點汲取¼。
      runNodeDrain(extraData?.node || "戰鬥階段節點");
      break;
    }

    case EffectTiming.BATTLE_END: {
      // C4：本場戰鬥結束時，令己方（克塔亞特所在陣營 oppSide）所有已死亡精靈與隨機1隻背包內存活精靈消逝。
      if (!getPlayerState("cthyaatInitialized")) break;
      const cthTeam = getFullTeam(oppSide);
      const activeElf = oppSide === "p1" ? ctx.activeP1 : ctx.activeP2;
      const isCthyaat = (e: any) => e.isExtra && e.name === "克塔亞特";
      const deadElves = cthTeam.filter(e => !isCthyaat(e) && e.currentHp <= 0);
      const benchAlive = cthTeam.filter(e => !isCthyaat(e) && e.currentHp > 0 && e.id !== activeElf?.id);
      deadElves.forEach(e => vanishElf(oppSide, e));
      let picked: any = null;
      if (benchAlive.length > 0) {
        picked = benchAlive[Math.floor(Math.random() * benchAlive.length)];
        vanishElf(oppSide, picked);
      }
      if (deadElves.length > 0 || picked) {
        addLog(`🌊 【克塔亞特】：本場戰鬥落幕，古神拖曳 ${deadElves.length} 隻亡魂${picked ? `與存活的 ${picked.name}` : ""}沉入深淵消逝！`, "effect");
      }
      break;
    }

    case EffectTiming.FATAL_RESIST: {
      const hasContractSkill = self.skills.some(s => s.name === "不淨者之約");
      if (hasContractSkill) {
        if (cthyaatActive && cthyaatHp > 0) {
          const cost = Math.floor(cthyaatMaxHp * 0.4);
          if (cthyaatHp >= cost) {
            const newCthHp = cthyaatHp - cost;
            setPlayerState("cthyaatHp", newCthHp);
            const cthyaatElf = getFullTeam(oppSide).find(e => e.isExtra && e.name === "克塔亞特");
            if (cthyaatElf) { cthyaatElf.currentHp = newCthHp; }
            self.currentHp = self.maxHp;
            // 解除異常狀態
            clearBrinkkStatuses(ctx, self, name => name !== "normal");
            if (newCthHp <= 0) onCthyaatDeath();
            addLog(`🔮 【不淨者之約】：古神之約重組軀殼！消耗克塔亞特 40% 體力 (${cost} HP)，布林克克滿血重生！`, "effect");
          } else {
            onCthyaatDeath();
            self.currentHp = self.maxHp;
            // 解除異常狀態
            clearBrinkkStatuses(ctx, self, name => name !== "normal");
            addLog(`🔮 【不淨者之約】：克塔亞特殘存生命燃燒殆盡！古神消逝，布林克克借屍重生！`, "effect");
          }
          if (extraData) extraData.cancelFatal = true;
          return true;
        }
      }

      // 自身死亡時消逝
      addLog(`💀 【濁】：混濁海妖·布林克克被擊敗而消逝！`, "defeat");
      vanishElf(actor, self);
      break;
    }
  }

  return false;
};

export const BRINKK_SKILLS: Record<string, BattleSkillHandler> = {
  "溺咒之握": (ctx) => {
    const { self, target, actor, setOpponentState, applyStatChange, applyTrueDamage, applyStatusWithImmunityCheck, getStatuses, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";

    addLog(`🌊 布林克克使用【溺咒之握】！`, "info");

    // 1. 吸取並反轉對手能力提升狀態
    const oppStages = target.statStages || { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
    const myChanges: Record<string, number> = {};
    const oppChanges: Record<string, number> = {};
    let stolen = false;

    Object.entries(oppStages).forEach(([stat, val]) => {
      if (val > 0) {
        myChanges[stat] = val;
        oppChanges[stat] = -val * 2; // +val -> -val, changes is -2 * val
        stolen = true;
      }
    });

    if (stolen) {
      applyStatChange(actor, myChanges);
      applyStatChange(oppSide, oppChanges);
      addLog(`🌊 【溺咒之握】：海妖之握吸取並反轉了對手的能力提升！`, "effect");
    }

    // 固有威力由 BRINKK_SKILL_TRANSFORMS 提供，不能換成增傷或真實傷害。

    // 3. 將對手所處的凍傷狀態轉化為冰封，轉化成功則附加等同於對手最大體力⅛的真實傷害
    const oppStatuses = getStatuses(target);
    if (oppStatuses["凍傷"] > 0) {
      const result = applyStatusWithImmunityCheck(oppSide, "冰封", 3); // 描述未寫回合數：預設 3
      if (!result.success) return;
      clearBrinkkStatuses(ctx, target, name => sameStatus(name, "凍傷"));
      addLog(`🌊 【溺咒之握】：將對手的「凍傷」轉化為「冰封」！`, "status");
      
      const trueDmg = Math.floor(target.maxHp / 8);
      applyTrueDamage(oppSide, trueDmg, "溺咒之握-冰封轉化");
    }
  },

  "癡愚之觸": (ctx) => {
    const { target, actor, setOpponentState, clearTurnEffectsOf, applyTrueDamage, applyStatusWithImmunityCheck, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";

    addLog(`🌊 布林克克使用【癡愚之觸】！`, "info");

    // 1. 消除對手回合類效果，消除成功則附加等同於對手最大體力20%的真實傷害
    const cleared = clearTurnEffectsOf(oppSide);
    if (cleared) {
      addLog(`🌊 【癡愚之觸】：成功消除對手回合類效果！`, "effect");
      const trueDmg = Math.floor(target.maxHp * 0.2);
      applyTrueDamage(oppSide, trueDmg, "癡愚之觸-消除成功");
    }

    // 2. 命中後100%令對方中毒，未觸發則100%令對手感染
    const poisonRes = applyStatusWithImmunityCheck(oppSide, "中毒", 3);
    if (!poisonRes.success) {
      applyStatusWithImmunityCheck(oppSide, "感染", 3);
      addLog(`🌊 【癡愚之觸】：對手免疫了中毒！改為 100% 令其感染混沌病毒！`, "status");
    }

    // 3. 3回合內，若對手使用技能時不處於控制類異常狀態，則無效對手下次攻擊，觸發無效成功則額外無效對手下次攻擊
    addSkillTimer(ctx, "brinkk_chiyu", "癡愚之觸·攻擊封鎖", 3);
    addLog(`🌊 【癡愚之觸】：混沌結界籠罩，3 回合內對手不處於控制異常時，將無效其下一次攻擊！`, "effect");
  },

  "深海働哭": (ctx) => {
    const { self, target, actor, setPlayerState, applyStatChange, adjustHp, applyHeal, applyStatusWithImmunityCheck, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";

    addLog(`🌊 布林克克使用屬性特技【深海働哭】！`, "info");

    // 1. 自身攻擊、雙防、速度、命中+2
    applyStatChange(actor, { atk: 2, def: 2, spdef: 2, speed: 2, accuracy: 2 });

    // 2. 汲取對手當前體力¼
    const drainAmt = Math.floor(target.currentHp / 4);
    ctx.applyAbsorb(oppSide, drainAmt);
    addLog(`🌊 【深海働哭】：汲取對手當前生命 1/4 (${drainAmt} HP)！`, "heal");

    // 3. 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，吸取後對手體力未減少則額外附加對手300點真實傷害
    addSkillTimer(ctx, "brinkk_deepsea", "深海働哭·持續吸取", 5);

    // 4. 命中時令對手100%漸凍1回合，未觸發或對手已處於漸凍則回合結束時消除對手回合類效果並令對手100%冰封，同時解除自身所有非附屬類異常狀態
    const hasFrost = ctx.getStatuses(target)["漸凍"] > 0;
    const frostRes = applyStatusWithImmunityCheck(oppSide, "漸凍", 1);
    if (!frostRes.success || hasFrost) {
      setPlayerState("deepSeaFreezeTarget", identity(target));
      ctx.addTimerTo(actor, { id: "brinkk_freeze_pending", name: "深海働哭·回合末冰封", kind: "turn_effect", source: "skill", remaining: 1, tickAt: "never" }, false);
    }

    // 解除自身異常狀態
    clearBrinkkStatuses(ctx, self, name => !!StatusRegistry[name] && !StatusRegistry[name].categories.includes("AUXILIARY"));
    addLog(`🌊 【深海働哭】：淨化全身！解除自身所有的非附屬異常狀態。`, "effect");
  },

  "不淨者之約": (ctx) => {
    const { self, target, actor, setPlayerState, setOpponentState, applyStatChange, applyStatusWithImmunityCheck, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";

    addLog(`🔮 布林克克締結【不淨者之約】！`, "info");

    // 1. 5回合內自身免疫並反彈所有非附屬類異常狀態
    setPlayerState("immuneAndReflectStatusTurns", 5);

    // 2. 對手為自身天敵時額外先制+3
    if (isNaturalEnemy(target.type)) {
      addLog(`🔮 【不淨者之約】：對手為天敵屬性！先制力突破！`, "effect");
    }

    // 3. 令對手全屬性-1、凍傷，任一項未觸發或均觸發則100%令對手冰封
    applyStatChange(oppSide, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
    applyStatusWithImmunityCheck(oppSide, "凍傷", 3);
    applyStatusWithImmunityCheck(oppSide, "冰封", 3); // 描述未寫回合數：預設 3

    // 4. 令自身100%狂暴
    applyStatusWithImmunityCheck(actor, "狂暴", 3);

    // 5. 下2回合對手所有技能先制-2，若對手當前速度高於自身則改為先制-3
    ctx.addTimerTo(oppSide, { id: "brinkk_contract_priority", name: "不淨者之約·先制下降", kind: "turn_effect", source: "skill", remaining: 2, tickAt: "round_end", pendingActivation: true,
      payload: { block: { prio: target.calculatedStats.speed > self.calculatedStats.speed ? -3 : -2, src: "不淨者之約" }, polarity: "negative" } }, false);
    addLog(`🔮 【不淨者之約】：詛咒契約已成！下 2 回合對手技能先制降低！`, "effect");
  }
};
