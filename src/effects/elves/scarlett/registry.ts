import { multiplyDamageReduction, addDamageReduction } from '../../../battle/damageReduction';
import { BattleEventContext, BattleSkillHandler, EffectTiming } from '../../types';
import { createExtraElf } from '../../../utils/extraElf';
import { Elf } from '../../../types';
import { getStatuses, isAuxiliaryStatus, isControlStatus, removeStatusEffect, addStatusEffect } from '../../../utils/battleHelpers';

// ───────── 聖光斯嘉麗（5014）：魂印【燦】＋ 珀妮 ＋ 燦界聖芒 ＋ 五技能 ─────────
// 詳細子句對照見 docs/聖光斯嘉麗實裝_20261004.md

type Side = "p1" | "p2";
const other = (s: Side): Side => (s === "p1" ? "p2" : "p1");
const idOf = (e: any) => String(e?.battleId || e?.id);
const STAT_KEYS = ["atk", "def", "spatk", "spdef", "speed", "accuracy"] as const;
const DEFAULT_STATUS_TURNS = 3; // 未寫回合數的異常預設 3 回合
const MARK_ID = "scarlett_holy_light";
const MARK_DESC = "己方在場精靈每次受到失明後將當前所處異常狀態轉化為星贖且直到戰鬥階段結束前能力上升狀態無法被消除；己方戰鬥階段結束時敵我雙方每有1回合星贖則己方在場精靈控制類異常狀態的回合數降低燦界聖芒層數2倍（最低1回合）；對方技能戰鬥階段結束時敵我雙方每有1回合星贖降低對手所有技能燦界聖芒層數點PP（最低1點），降低後PP不大於1的技能PP上限歸1。上限3層，下場後保留。";

/** 同一回合內讀取場上最新精靈（ctx.activeP1/P2 是建立 ctx 當下的快照） */
function liveActive(ctx: BattleEventContext, side: Side): Elf {
  const base = side === "p1" ? ctx.activeP1 : ctx.activeP2;
  return (ctx.getFullTeam(side) || []).find(e => idOf(e) === idOf(base)) || base;
}
const layersOf = (ctx: BattleEventContext) => Math.min(3, Math.max(0, ctx.getPlayerState("chanStacks") || 0));
const xingshuOf = (e: any) => getStatuses(e)["星贖"] || 0;
const stageAbsSum = (e: any) => STAT_KEYS.reduce((a, k) => a + Math.abs(Number(e?.statStages?.[k]) || 0), 0);

function isPuniAlive(ctx: BattleEventContext, side: Side) {
  const p = (ctx.getFullTeam(side) || []).find(e => e.isExtra && e.name.includes("珀妮"));
  return !!(p && !p.isVanished && p.currentHp > 0);
}

/** 星贖：不存在則附加 base 回合；已存在則回合數 +add */
function addOrExtendXingshu(ctx: BattleEventContext, side: Side, add: number, base: number) {
  const cur = xingshuOf(liveActive(ctx, side));
  return ctx.applyStatusWithImmunityCheck(side, "星贖", cur > 0 ? cur + add : base).success;
}

/**
 * 將在場精靈當前所處異常狀態（非附屬類）轉化為星贖。
 * 回合數取「轉化前各異常回合數合計」（多個轉為同一個時回合數相加；併入既有星贖）。
 * incoming：這次受到、尚未附加的異常（BEFORE_STATUS_APPLY 時）一併計入。
 */
function convertToXingshu(ctx: BattleEventContext, side: Side, incoming?: { status: string; duration: number }): number {
  const elf: any = liveActive(ctx, side);
  const st = getStatuses(elf);
  const clone: any = { ...elf, effects: [...(elf.effects || [])], battleStatuses: { ...(elf.battleStatuses || {}) } };
  let total = incoming ? Math.max(1, incoming.duration || DEFAULT_STATUS_TURNS) : 0;
  const names: string[] = incoming ? [incoming.status] : [];
  for (const [k, v] of Object.entries(st)) {
    if (k === "星贖" || isAuxiliaryStatus(k)) continue;
    total += v; names.push(k);
    removeStatusEffect(clone, k);
  }
  if (total <= 0) return 0;
  const merged = xingshuOf(elf) + total;
  removeStatusEffect(clone, "星贖");
  addStatusEffect(clone, "星贖", merged);
  ctx.updateElf(side, { battleId: elf.battleId, id: elf.id, effects: clone.effects, battleStatuses: clone.battleStatuses, battleStatus: clone.battleStatus, battleStatusDuration: clone.battleStatusDuration } as any);
  ctx.addLog(`✨ 【${elf.name}】的【${names.join("、")}】轉化為星贖（${merged}回合）！`, "status");
  return merged;
}

/** 回合類效果（由技能附加）：顯示用計時器，宣告對應的登錄狀態鍵，被「消除回合類效果」時一併歸零 */
function turnEffect(ctx: BattleEventContext, id: string, name: string, turns: number, keys: string[], pending = false) {
  ctx.addTimerTo(ctx.actor, {
    id, name, kind: "turn_effect", source: "skill", remaining: turns, tickAt: "round_end", stackRule: "refresh",
    pendingActivation: pending || undefined, displayChar: name[0], description: name, payload: { mirrorRegistryKeys: keys },
  } as any, false);
}

/** S6：S4／S5 執行後雙方能力等級絕對值總和 ≤10 → 2回合弱點傷害＋對手星贖1回合（已存在則+1） */
function checkWeakPoint(ctx: BattleEventContext) {
  const sum = stageAbsSum(liveActive(ctx, "p1")) + stageAbsSum(liveActive(ctx, "p2"));
  if (sum > 10) return;
  ctx.setPlayerState("weakPointDefenseTurns", 2);
  ctx.setPlayerState("weakPointDefenseRatio", 0.6);
  addOrExtendXingshu(ctx, ctx.targetSide, 1, 1);
  ctx.addLog(`✨ 【燦】：雙方能力變化 ${sum} 級（≤10），2回合內攻擊以弱點傷害計算，對手星贖！`, "effect");
}

/** S2：受到非真實傷害降至⅓、恢復最大體力⅓，恢復量累計到當回合結束造成百分比傷害 */
function guardReduce(ctx: BattleEventContext, comp: any, healer: Elf, stack: boolean) {
  multiplyDamageReduction(comp, 1 / 3);
  const heal = Math.floor((healer.maxHp || 0) / 3);
  if (stack) {
    const stacks = Math.min(3, (ctx.getPlayerState("chanStacks") || 0) + 1);
    ctx.setPlayerState("chanStacks", stacks);
    ctx.setMark({ id: MARK_ID, displayChar: "芒", count: stacks, name: "燦界聖芒", description: MARK_DESC, source: "聖光斯嘉麗 / 燦", unit: "層", maxCount: 3, scope: "team", persistsOffField: true, polarity: "positive" } as any);
  }
  // 恢復在該次傷害結算後執行（ON_DAMAGED），避免滿血時先恢復再扣血而白白浪費
  ctx.setPlayerState("teamGuardHealPending", (ctx.getPlayerState("teamGuardHealPending") || 0) + heal);
  const round = ctx.roundNumber ?? 0;
  const prev = ctx.getPlayerState("teamGuardHealRound") === round ? (ctx.getPlayerState("teamGuardHealAmount") || 0) : 0;
  ctx.setPlayerState("teamGuardHealRound", round);
  ctx.setPlayerState("teamGuardHealAmount", prev + heal);
  ctx.addLog(`✨ 【燦】：傷害降至⅓，恢復 ${heal} 體力${stack ? `（燦界聖芒 ${Math.min(3, ctx.getPlayerState("chanStacks") || 0)} 層）` : ""}！`, "effect");
}

/** S2 恢復：待該次傷害結算後（或回合結束時）恢復在場精靈 */
function flushGuardHeal(ctx: BattleEventContext) {
  const pending = ctx.getPlayerState("teamGuardHealPending") || 0;
  if (pending <= 0) return;
  ctx.setPlayerState("teamGuardHealPending", 0);
  if (liveActive(ctx, ctx.actor).currentHp > 0) ctx.applyHeal(ctx.actor, pending);
}

/** 己方在場精靈受到麻痺（珀妮）／K1 下次異常：BEFORE_STATUS_APPLY */
function onStatusIncoming(ctx: BattleEventContext, data: any, own: boolean) {
  const status = String(data?.status || "");
  if (!status || status === "星贖" || isAuxiliaryStatus(status)) return;
  const side = ctx.actor;
  if ((status === "麻痺" || status === "麻痹") && isPuniAlive(ctx, side)) {
    data.prevent = true;
    convertToXingshu(ctx, side, { status, duration: data.duration });
    ctx.setPlayerState("turnEffectsUnclearableTurns", 1);
    ctx.addLog(`✨ 【珀妮】：麻痺轉化為星贖，當回合回合類效果無法被消除！`, "effect");
    return;
  }
  if (own && ctx.getPlayerState("nextStatusToXingshu")) {
    data.prevent = true;
    ctx.setPlayerState("nextStatusToXingshu", false);
    const cur = xingshuOf(liveActive(ctx, side));
    const dur = cur + Math.max(1, data.duration || DEFAULT_STATUS_TURNS);
    const elf: any = liveActive(ctx, side);
    const clone: any = { ...elf, effects: [...(elf.effects || [])], battleStatuses: { ...(elf.battleStatuses || {}) } };
    removeStatusEffect(clone, "星贖"); addStatusEffect(clone, "星贖", dur);
    ctx.updateElf(side, { battleId: elf.battleId, id: elf.id, effects: clone.effects, battleStatuses: clone.battleStatuses, battleStatus: clone.battleStatus, battleStatusDuration: clone.battleStatusDuration } as any);
    ctx.addLog(`✨ 【純白聖翎】：受到的【${status}】轉化為星贖（${dur}回合）！`, "status");
  }
}

/** 燦界聖芒：己方在場精靈受到失明後 */
function onStatusApplied(ctx: BattleEventContext, data: any) {
  if (String(data?.status) !== "失明" || layersOf(ctx) <= 0) return;
  convertToXingshu(ctx, ctx.actor);
  ctx.setPlayerState("statBoostUnclearableTurns", 1);
  ctx.addLog(`✨ 【燦界聖芒】：失明轉化為星贖，戰鬥階段結束前能力上升無法被消除！`, "effect");
}

/** 隊伍觀察：斯嘉麗不在場時，己方在場精靈的事件 */
function handleTeamObserved(ctx: BattleEventContext, event: string, data: any, me: Elf) {
  switch (event) {
    case EffectTiming.BEFORE_DAMAGE: {
      // S3 繼承：下一隻出戰精靈獲得降傷與回合結束百分比傷害（不疊燦界聖芒）
      if (!data?.isIncoming || data.damageCategory === "true" || !(data.base > 0)) return;
      if ((ctx.getPlayerState("teamInheritGuardTurns") || 0) <= 0) return;
      const active = ctx.self;
      const bound = ctx.getPlayerState("teamInheritGuardElfId");
      if (bound && bound !== idOf(active)) return;
      if (!bound) ctx.setPlayerState("teamInheritGuardElfId", idOf(active));
      guardReduce(ctx, data, active, false);
      return;
    }
    case EffectTiming.ON_DAMAGED: flushGuardHeal(ctx); return;
    case EffectTiming.BEFORE_STATUS_APPLY: onStatusIncoming(ctx, data, false); return;
    case "SELF_STATUS_APPLIED": onStatusApplied(ctx, data); return;
    case EffectTiming.OPPONENT_ACTION: ctx.setPlayerState("teamOppSkillRound", ctx.roundNumber ?? 0); return;
  }
  void me;
}

/** 回合結束：S2 百分比傷害、燦界聖芒 M3／M4、K2 未觸發、重生倒數 */
function onRoundEnd(ctx: BattleEventContext) {
  const { self, actor } = ctx;
  const opp = other(actor);
  const round = ctx.roundNumber ?? 0;
  const oppElf = liveActive(ctx, opp);
  const oppAlive = !!oppElf && oppElf.currentHp > 0;

  if (ctx.getPlayerState("lastScarlettRoundEnd") !== round) {
    ctx.setPlayerState("lastScarlettRoundEnd", round);
    // 未經 ON_DAMAGED 結算的恢復（例如傷害被抵擋）於回合結束補上：在場精靈
    if ((ctx.getPlayerState("teamGuardHealPending") || 0) > 0) {
      const pending = ctx.getPlayerState("teamGuardHealPending");
      ctx.setPlayerState("teamGuardHealPending", 0);
      const act = liveActive(ctx, actor);
      if (act.currentHp > 0) ctx.applyHeal(actor, pending);
    }
    // S2：當回合恢復量 → 回合結束造成等量百分比傷害
    if (ctx.getPlayerState("teamGuardHealRound") === round) {
      const total = ctx.getPlayerState("teamGuardHealAmount") || 0;
      ctx.setPlayerState("teamGuardHealAmount", 0);
      if (total > 0 && oppAlive) {
        ctx.applyPinkDamage(opp, total, "燦", undefined, undefined, "percent");
        ctx.addLog(`✨ 【燦】：回合結束造成等同恢復量 ${total} 的百分比傷害！`, "effect");
      }
    }
    const layers = layersOf(ctx);
    const N = xingshuOf(liveActive(ctx, "p1")) + xingshuOf(liveActive(ctx, "p2"));
    // M3：己方在場精靈控制類異常回合數降低 N×(層數×2)，最低1回合
    if (layers > 0 && N > 0) {
      const mine: any = liveActive(ctx, actor);
      const st = getStatuses(mine);
      const cut = N * layers * 2;
      const ctrl = Object.keys(st).filter(k => isControlStatus(k) && st[k] > 1);
      if (ctrl.length) {
        const bs = { ...(mine.battleStatuses || {}) };
        const effects = (mine.effects || []).map((e: any) => ctrl.includes(e.id) ? { ...e, duration: Math.max(1, e.duration - cut) } : e);
        for (const k of ctrl) if (k in bs) bs[k] = Math.max(1, bs[k] - cut);
        ctx.updateElf(actor, { battleId: mine.battleId, id: mine.id, effects, battleStatuses: bs } as any);
        ctx.addLog(`✨ 【燦界聖芒】：星贖 ${N} 回合，己方控制類異常回合數 -${cut}（最低1）！`, "effect");
      }
    }
    // M4：對方本回合使用過技能 → 對手所有技能 PP 降低 N×層數（最低1）；降低後PP≤1的技能PP上限歸1
    if (layers > 0 && N > 0 && oppAlive && ctx.getPlayerState("teamOppSkillRound") === round) {
      const cut = N * layers;
      const skills = (oppElf.skills || []).map((sk: any) => {
        const pp = sk.pp ?? 0;
        const next = pp > 1 ? Math.max(1, pp - cut) : pp;
        return next <= 1 ? { ...sk, pp: next, maxPp: 1, ppMaxOffset: 0 } : { ...sk, pp: next };
      });
      ctx.updateElf(opp, { battleId: oppElf.battleId, id: oppElf.id, skills } as any);
      ctx.addLog(`✨ 【燦界聖芒】：對手所有技能 PP -${cut}（最低1），PP≤1 的技能上限歸1！`, "effect");
    }
  }

  // K2：3回合內回合類效果未被消除 → 敵方下2回合無法主動切換
  if (ctx.getPlayerState("clearWatchTurns") === 1 && !ctx.getPlayerState("clearWatchFired")) {
    ctx.setOpponentState("noSwitchTurns", Math.max(2, ctx.getOpponentState("noSwitchTurns") || 0));
    ctx.addLog(`✨ 【晨曦昭世】：回合類效果未被消除，敵方下2回合無法主動切換精靈！`, "effect");
  }

  if ((ctx.getPlayerState("puniDamageBoostTurns") || 0) > 0) ctx.setPlayerState("puniDamageBoostTurns", ctx.getPlayerState("puniDamageBoostTurns") - 1);

  if (ctx.getPlayerState("scarlettReviveActive")) {
    // 重生由珀妮（斯嘉麗攜帶的光系額外精靈）執行：珀妮不在或已倒下則無法重生
    if (!isPuniAlive(ctx, actor)) {
      ctx.setPlayerState("scarlettReviveActive", false);
      ctx.addLog(`✨ 【聖光斯嘉麗】：珀妮已不在，重生中斷。`, "info");
      return;
    }
    const activeElf = actor === "p1" ? ctx.activeP1 : ctx.activeP2;
    const isMeActive = activeElf.id === self.id;
    if (!isMeActive || self.currentHp <= 0) {
      const countdown = (ctx.getPlayerState("scarlettReviveCountdown") || 0) - 1;
      ctx.setPlayerState("scarlettReviveCountdown", countdown);
      if (countdown <= 0) {
        const origMaxHp = ctx.getPlayerState("scarlettOriginalMaxHp") || self.maxHp || 2000;
        ctx.updateElf(actor, { id: self.id, maxHp: origMaxHp, currentHp: origMaxHp, isVanished: false });
        ctx.addLog(`✨ 【珀妮】：重生時間到！斯嘉麗於背包內重生，體力全滿！`, "effect");
        ctx.setPlayerState("scarlettReviveActive", false);
      } else {
        ctx.addLog(`✨ 【聖光斯嘉麗】：背包重生倒數剩餘 ${countdown} 回合。`, "info");
      }
    }
  }
}

export const handleScarlettSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  if (extraData?.teamObserver) return handleTeamObserved(ctx, event, extraData, extraData.teamObserver);
  const { self, actor, setPlayerState, getPlayerState, addLog, applyHeal } = ctx;
  const oppSide = other(actor);

  // 戰鬥開始：珀妮作為額外精靈加入己方
  if (!getPlayerState("puniInitialized") && !(ctx.getFullTeam(actor) || []).some(e => e.isExtra && e.summonerId === idOf(self))) {
    setPlayerState("puniInitialized", true);
    const puniHp = Math.max(100, Math.floor((self.maxHp || 1000) / 3));
    const puniElf = createExtraElf(self, {
      name: "珀妮",
      type: "光",
      maxHp: puniHp,
      currentHp: puniHp,
      baseStats: {
        hp: Math.floor((self.baseStats?.hp || 1000) / 3),
        atk: Math.floor((self.baseStats?.atk || 300) / 3),
        def: Math.floor((self.baseStats?.def || 300) / 3),
        spatk: Math.floor((self.baseStats?.spatk || 300) / 3),
        spdef: Math.floor((self.baseStats?.spdef || 300) / 3),
        speed: Math.floor((self.baseStats?.speed || 300) / 3),
      },
      badge: "✨",
      skills: [],
      soulMark: {
        name: "珀妮（光系額外精靈）",
        description: "珀妮:光系額外精靈，所有能力值均為斯嘉麗⅓，己方在場精靈每次受到麻痺時後將當前所處異常狀態轉化為星贖且當回合直到戰鬥階段結束前回合類效果無法被消除；斯嘉麗在場期間每次出手流程結束後(含斯嘉麗選擇技能因故未能出手)進行一次額外行動造成對方等同於最大體力⅓的光系傷害且100%令對手失明，未觸發失明或對手已處於失明則消除對手回合類效果且令斯嘉麗下2次造成的攻擊傷害提升150%；己方斯嘉麗死亡4回合後在背包內重生，己方每有1層燦界聖芒則重生所需回合降低1回合。",
        effectType: "none",
        effectValue: 0
      }
    });
    ctx.addExtraElf(actor, puniElf);
    addLog(`✨ 【燦】：珀妮作為光系額外精靈加入己方（能力值為斯嘉麗⅓）！`, "effect");
  }

  switch (event) {
    case EffectTiming.ON_ENTRANCE:
      // 斯嘉麗回到場上：繼承效果結束
      if (getPlayerState("teamInheritGuardTurns")) { setPlayerState("teamInheritGuardTurns", 0); setPlayerState("teamInheritGuardElfId", ""); }
      break;

    case EffectTiming.ON_SWITCH_OUT: {
      // S3：主動下場 → 下一隻出戰精靈 (1+層數) 回合內獲得降傷與回合結束百分比傷害
      if (self.currentHp > 0 && !getPlayerState("scarlettReviveActive")) {
        const turns = 1 + layersOf(ctx);
        setPlayerState("teamInheritGuardTurns", turns);
        setPlayerState("teamInheritGuardElfId", "");
        addLog(`✨ 【燦】：斯嘉麗下場，下一隻出戰精靈 ${turns} 回合內獲得聖光護體！`, "effect");
      }
      break;
    }

    case EffectTiming.FATAL_RESIST: {
      if (!getPlayerState("scarlettReviveActive")) {
        setPlayerState("scarlettOriginalMaxHp", self.maxHp);
        self.currentHp = 0;
        self.maxHp = 0;
        const layers = layersOf(ctx);
        const countdown = Math.max(1, 4 - layers);
        setPlayerState("scarlettReviveCountdown", countdown);
        setPlayerState("scarlettReviveActive", true);
        // S3：死亡下場 → 下一隻出戰精靈登場後 (1+層數) 回合（死亡換人在回合結束後，故多計1）
        setPlayerState("teamInheritGuardTurns", 2 + layers);
        setPlayerState("teamInheritGuardElfId", "");
        addLog(`✨ 【聖光斯嘉麗】倒下！${countdown} 回合後由珀妮於背包內重生；下一隻出戰精靈 ${1 + layers} 回合內獲得聖光護體。`, "effect");
        return true;
      }
      return false;
    }

    case EffectTiming.BEFORE_DAMAGE: {
      // S2：受到非真實傷害降至⅓
      if (extraData?.isIncoming && extraData?.damageCategory !== "true" && (extraData?.base || 0) > 0) {
        guardReduce(ctx, extraData, self, true);
      }
      if (!extraData?.isIncoming && extraData?.damageCategory === "skill_attack") {
        // 珀妮：斯嘉麗下2次造成的攻擊傷害提升150%
        if ((getPlayerState("puniBoostUses") || 0) > 0) {
          extraData.increasePercent += 1.5;
          setPlayerState("puniBoostUses", getPlayerState("puniBoostUses") - 1);
          addLog(`✨ 【珀妮】：攻擊傷害提升150%（剩餘 ${getPlayerState("puniBoostUses")} 次）！`, "effect");
        }
        // K4：交換成功 → 當回合與下次攻擊傷害提升150%
        if ((getPlayerState("selfAttackBoostUses") || 0) > 0) {
          extraData.increasePercent += 1.5;
          setPlayerState("selfAttackBoostUses", getPlayerState("selfAttackBoostUses") - 1);
          addLog(`✨ 【王·凰歌盡霄】：攻擊傷害提升150%（剩餘 ${getPlayerState("selfAttackBoostUses")} 次）！`, "effect");
        }
      }
      break;
    }

    case EffectTiming.BEFORE_ACTION: {
      // S4：自身使用技能時
      ctx.applyStatChange(actor, { spatk: 2, speed: 2, accuracy: 1 });
      ctx.applyStatChange(oppSide, { spdef: -2, speed: -2, accuracy: -1 });
      addLog(`✨ 【燦】：自身特攻、速度+2、命中+1；對手特防、速度-2、命中-1！`, "effect");
      checkWeakPoint(ctx);
      break;
    }

    case EffectTiming.OPPONENT_ACTION: {
      // S5：對手使用技能時
      setPlayerState("teamOppSkillRound", ctx.roundNumber ?? 0);
      ctx.applyStatChange(oppSide, { atk: -2, spatk: -2, speed: -2, accuracy: -1 });
      ctx.applyStatChange(actor, { def: 1, spdef: 1, speed: 1, accuracy: 1 });
      addLog(`✨ 【燦】：對手雙攻、速度-2、命中-1；自身雙防、速度、命中+1！`, "effect");
      checkWeakPoint(ctx);
      break;
    }

    case EffectTiming.MODIFY_PRIORITY: {
      // K4：自身處於能力下降時當回合先制+3
      if (ctx.skill?.name === "王·凰歌盡霄" && STAT_KEYS.some(k => (Number((self.statStages as any)?.[k]) || 0) < 0) && extraData?.priorityComp) {
        extraData.priorityComp.bonus += 3;
      }
      break;
    }

    case EffectTiming.AFTER_ACTION: {
      // K2：4回合內自身使用技能 → 對手受到自身最大體力20%真實傷害
      const me = liveActive(ctx, actor);
      const opp = liveActive(ctx, oppSide);
      if (opp.currentHp <= 0) break;
      if ((getPlayerState("selfSkillTrueDmgTurns") || 0) > 0) {
        if (getPlayerState("selfSkillTrueDmgSkip")) setPlayerState("selfSkillTrueDmgSkip", false);
        else { ctx.applyTrueDamage(oppSide, Math.floor(me.maxHp * 0.2), "晨曦昭世"); addLog(`✨ 【晨曦昭世】：附加自身最大體力20%的真實傷害！`, "effect"); }
      }
      // K3：5回合內自身使用技能 → 恢復最大體力⅓並造成等量百分比傷害；體力低於½時翻倍
      if ((getPlayerState("selfSkillHealTurns") || 0) > 0) {
        if (getPlayerState("selfSkillHealSkip")) setPlayerState("selfSkillHealSkip", false);
        else {
          const dbl = me.currentHp < me.maxHp / 2;
          const amt = Math.floor(me.maxHp / 3) * (dbl ? 2 : 1);
          applyHeal(actor, amt);
          ctx.applyPinkDamage(oppSide, amt, "暮光舞動", undefined, undefined, "percent");
          addLog(`✨ 【暮光舞動】：恢復 ${amt} 體力並造成等量百分比傷害${dbl ? "（翻倍）" : ""}！`, "effect");
        }
      }
      break;
    }

    case EffectTiming.AFTER_ATTACK_HIT: {
      // K5：附加對手最大體力⅓的百分比傷害，未擊敗對手則恢復等量體力
      if (extraData?.skill?.name !== "王·聖璨天潔" || extraData.hitIndex !== 0 || extraData.additionalEffectsEnabled === false) break;
      const opp = liveActive(ctx, oppSide);
      if (!opp || opp.currentHp <= 0) break;
      const dealt = Number(ctx.applyPercentDamage(oppSide, 1 / 3) || 0);
      if (opp.currentHp - dealt > 0) {
        applyHeal(actor, dealt);
        addLog(`✨ 【王·聖璨天潔】：未擊敗對手，恢復 ${dealt} 體力！`, "heal");
      }
      break;
    }

    case EffectTiming.SKILL_INVALID: {
      // K1：3回合內對手屬性技能無效且使用後該技能PP歸0
      if (extraData?.isIncoming && extraData.skill?.category === "屬性" && (getPlayerState("invalidUtilityPpZeroTurns") || 0) > 0) {
        const opp = liveActive(ctx, oppSide);
        const skills = (opp.skills || []).map((sk: any) => sk.name === extraData.skill.name ? { ...sk, pp: 0 } : sk);
        ctx.updateElf(oppSide, { battleId: opp.battleId, id: opp.id, skills } as any);
        addLog(`✨ 【純白聖翎】：對手【${extraData.skill.name}】PP歸0！`, "effect");
      }
      break;
    }

    case EffectTiming.TURN_EFFECTS_CLEARED: {
      // K2：3回合內自身回合類效果被消除 → 敵我雙方星贖（已存在則+2）
      if ((getPlayerState("clearWatchTurns") || 0) > 0 && !getPlayerState("clearWatchFired")) {
        setPlayerState("clearWatchFired", true);
        addOrExtendXingshu(ctx, actor, 2, DEFAULT_STATUS_TURNS);
        addOrExtendXingshu(ctx, oppSide, 2, DEFAULT_STATUS_TURNS);
        addLog(`✨ 【晨曦昭世】：回合類效果被消除，敵我雙方星贖！`, "effect");
      }
      break;
    }

    case EffectTiming.ON_DAMAGED:
      flushGuardHeal(ctx);
      break;

    case EffectTiming.BEFORE_STATUS_APPLY:
      onStatusIncoming(ctx, extraData, true);
      break;

    case "SELF_STATUS_APPLIED":
      onStatusApplied(ctx, extraData);
      break;

    case EffectTiming.ACTION_END:
      // 珀妮：斯嘉麗在場期間每次出手流程結束後（含未能出手）進行一次額外行動
      if (isPuniAlive(ctx, actor) && extraData?.actor === actor && ctx.queueExtraAction) {
        ctx.queueExtraAction(actor, {
          label: "珀妮：光系傷害",
          amount: Math.floor(ctx.target.maxHp / 3),
          elem: "光",
          after: (c) => {
            const opp = other(c.actor);
            const already = ((c.getStatuses(liveActive(c, opp)) || {})["失明"] || 0) > 0;
            const res = already ? { success: false } : c.applyStatusWithImmunityCheck(opp, "失明", 2);
            if (!res.success) {
              const cleared = c.clearTurnEffectsOf(opp);
              c.addLog(`✨ 【珀妮】：${already ? "對手已失明" : "未觸發失明"}，${cleared ? "消除對手回合類效果" : "對手無回合類效果可消除"}！`, "effect");
            }
            c.setPlayerState("puniBoostUses", 2);
            c.addLog(`✨ 【珀妮】：斯嘉麗下2次造成的攻擊傷害提升150%！`, "effect");
          },
        });
      }
      break;

    case EffectTiming.ROUND_END:
      onRoundEnd(ctx);
      break;

    case "CHECK_REBIRTH_PENDING":
      // 倒數中的斯嘉麗仍是陣亡狀態，不算存活；隊伍全滅即結束。
      return false;
  }

  return false;
};

// ───────── 技能 ─────────
export const SCARLETT_SKILLS: Record<string, BattleSkillHandler> = {
  // K1 純白聖翎（技能無效時子句由積木 SKILL_MODE＋CUSTOM 執行）
  "純白聖翎": (ctx) => {
    const { actor, targetSide, addLog } = ctx;
    const opp = liveActive(ctx, targetSide);
    const ups = STAT_KEYS.filter(k => (Number((opp.statStages as any)?.[k]) || 0) > 0);
    let cleared = false;
    if (ups.length) {
      const next: any = { ...(opp.statStages || {}) };
      for (const k of ups) next[k] = 0;
      ctx.updateElf(targetSide, { battleId: opp.battleId, id: opp.id, statStages: next } as any);
      const after = liveActive(ctx, targetSide);
      cleared = ups.every(k => (Number((after.statStages as any)?.[k]) || 0) <= 0);
    }
    if (cleared) {
      const o = liveActive(ctx, targetSide);
      ctx.updateElf(targetSide, { battleId: o.battleId, id: o.id, skills: (o.skills || []).map((sk: any) => sk.category !== "屬性" ? { ...sk, pp: 0 } : sk) } as any);
      addLog(`✨ 【純白聖翎】：消除對手能力提升，對手所有攻擊技能PP歸0！`, "effect");
    }
    ctx.setPlayerState("incomingUtilityInvalidTurns", 3);
    ctx.setPlayerState("incomingUtilityInvalidReason", "純白聖翎");
    ctx.setPlayerState("invalidUtilityPpZeroTurns", 3);
    turnEffect(ctx, `${actor}_scarlett_k1`, "純白聖翎：對手屬性技能無效", 3, ["incomingUtilityInvalidTurns", "invalidUtilityPpZeroTurns"]);
    addLog(`✨ 【純白聖翎】：3回合內對手屬性技能無效，使用後PP歸0！`, "effect");
  },

  // K2 晨曦昭世
  "晨曦昭世": (ctx) => {
    const { actor, targetSide, addLog, setPlayerState } = ctx;
    setPlayerState("reflectStatusTurns", 5);
    turnEffect(ctx, `${actor}_scarlett_k2_reflect`, "晨曦昭世：免疫並反彈異常", 5, ["reflectStatusTurns"]);
    setPlayerState("selfSkillTrueDmgTurns", 4);
    setPlayerState("selfSkillTrueDmgSkip", true); // 本次使用不算
    turnEffect(ctx, `${actor}_scarlett_k2_true`, "晨曦昭世：使用技能附加真實傷害", 4, ["selfSkillTrueDmgTurns"]);
    const statusTurns = [liveActive(ctx, actor), liveActive(ctx, targetSide)]
      .reduce((a, e) => a + Object.values(getStatuses(e)).reduce((x, v) => x + (v > 0 ? v : 0), 0), 0);
    const immune = 2 + statusTurns;
    setPlayerState("immuneAttackTurns", Math.max(immune, ctx.getPlayerState("immuneAttackTurns") || 0));
    turnEffect(ctx, `${actor}_scarlett_k2_immune`, "晨曦昭世：免疫攻擊", immune, ["immuneAttackTurns"]);
    setPlayerState("clearWatchTurns", 3);
    setPlayerState("clearWatchFired", false);
    addLog(`✨ 【晨曦昭世】：5回合免疫並反彈異常；4回合使用技能附加真傷；${immune}回合免疫攻擊（含異常回合 ${statusTurns}）！`, "effect");
  },

  // K3 暮光舞動（技能無效時子句由積木 SKILL_MODE＋CUSTOM 執行）
  "暮光舞動": (ctx) => {
    const { actor, targetSide, addLog, setPlayerState } = ctx;
    ctx.applyStatChange(actor, { spatk: 2, def: 2, spdef: 2, speed: 2, accuracy: 1 });
    setPlayerState("selfSkillHealTurns", 5);
    setPlayerState("selfSkillHealSkip", true); // 本次使用不算
    turnEffect(ctx, `${actor}_scarlett_k3_heal`, "暮光舞動：使用技能恢復並造成百分比傷害", 5, ["selfSkillHealTurns"]);
    const opp: any = liveActive(ctx, targetSide);
    const isShadow = String(opp.type || "").replace(/系$/, "").split(/[.·・]/).includes("暗影");
    if (isShadow) {
      ctx.setOpponentState("nextSkillInvalid", true);
      ctx.setOpponentState("nextSkillInvalidReason", "暮光舞動");
      addLog(`✨ 【暮光舞動】：對手為暗影系，下次技能無效！`, "effect");
    } else {
      ctx.updateElf(targetSide, { battleId: opp.battleId, id: opp.id, type: "暗影", originalType: opp.originalType || opp.type, typeChangedUntilSwitch: true } as any);
      addLog(`✨ 【暮光舞動】：對手屬性變為暗影系（下場前）！`, "effect");
    }
    setPlayerState("priorityBoostTurns", 3); // 下2回合（本回合結束後才開始計）
    setPlayerState("priorityBoostValue", 2);
    setPlayerState("priorityBoostAttackOnly", false);
    turnEffect(ctx, `${actor}_scarlett_k3_prio`, "暮光舞動：先制+2", 2, ["priorityBoostTurns"], true);
    addLog(`✨ 【暮光舞動】：下2回合自身所有技能先制+2！`, "effect");
  },

  // K4 王·凰歌盡霄（先制+3 於魂印 MODIFY_PRIORITY）
  "王·凰歌盡霄": (ctx) => {
    const { actor, targetSide, addLog, setPlayerState } = ctx;
    const me: any = liveActive(ctx, actor);
    const opp: any = liveActive(ctx, targetSide);
    const mine: any = { ...(me.statStages || {}) };
    const theirs: any = { ...(opp.statStages || {}) };
    const swapped: string[] = [];
    for (const k of STAT_KEYS) {
      const a = Number(mine[k]) || 0, b = Number(theirs[k]) || 0;
      if (a < b) { mine[k] = b; theirs[k] = a; swapped.push(k); }
    }
    if (swapped.length) {
      ctx.updateElf(actor, { battleId: me.battleId, id: me.id, statStages: mine } as any);
      ctx.updateElf(targetSide, { battleId: opp.battleId, id: opp.id, statStages: theirs } as any);
      setPlayerState("nextAttackSkillInvalid", true);
      setPlayerState("nextAttackSkillInvalidReason", "王·凰歌盡霄");
      setPlayerState("selfAttackBoostUses", 2);
      addLog(`✨ 【王·凰歌盡霄】：交換 ${swapped.length} 項能力等級！無效對手下次攻擊技能，當回合與下次攻擊傷害提升150%！`, "effect");
    }
    const zeroPp = [...(me.skills || []), ...(opp.skills || [])].filter((sk: any) => (sk.pp ?? 0) < 1).length;
    const mult = 1 + 0.75 + 0.3 * zeroPp;
    setPlayerState("powerMultiplierThisAction", (ctx.getPlayerState("powerMultiplierThisAction") ?? 1) * mult);
    setPlayerState("vampireRatio", 1);
    addLog(`✨ 【王·凰歌盡霄】：威力 ×${mult.toFixed(2)}（PP<1 技能 ${zeroPp} 個），吸取等同攻擊傷害的體力！`, "effect");
  },

  // K5 王·聖璨天潔（擊後百分比傷害於魂印 AFTER_ATTACK_HIT）
  "王·聖璨天潔": (ctx) => {
    const { actor, targetSide, addLog, setPlayerState } = ctx;
    setPlayerState("noResistedThisAction", true);
    const cleared = ctx.hasTurnEffectOn(targetSide) && ctx.clearTurnEffectsOf(targetSide);
    if (cleared) {
      const r = ctx.applyStatusWithImmunityCheck(targetSide, "麻痺", DEFAULT_STATUS_TURNS);
      addLog(`✨ 【王·聖璨天潔】：消除對手回合類效果${r.success ? "，對手麻痺" : ""}！`, "effect");
    } else {
      setPlayerState("blkImmuneStatusCount", (ctx.getPlayerState("blkImmuneStatusCount") || 0) + 1);
      addLog(`✨ 【王·聖璨天潔】：未消除回合類效果，自身免疫下1次異常狀態！`, "effect");
    }
    const me = liveActive(ctx, actor);
    const dbl = me.currentHp < me.maxHp / 3;
    const amt = Math.floor(me.maxHp * 0.3) * (dbl ? 2 : 1);
    const dealt = ctx.applyPinkDamage(targetSide, amt, "王·聖璨天潔", undefined, undefined, "percent");
    ctx.applyHeal(actor, dealt);
    addLog(`✨ 【王·聖璨天潔】：附加 ${dealt} 百分比傷害並恢復等量體力${dbl ? "（翻倍）" : ""}！`, "effect");
  },
};

export { ScarlettDeconstructedProfile } from "../../../data/elfProfiles/scarlettRegistry";
