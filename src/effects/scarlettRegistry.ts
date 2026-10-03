import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';
import { createExtraElf } from '../utils/extraElf';

export const handleScarlettSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyTrueDamage, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 戰鬥開始或登場時初始化珀妮 (Puni) 作為額外精靈加入己方
  if (!getPlayerState("puniInitialized")) {
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
        description: "珀妮:光系額外精靈，所有能力值均為斯嘉麗⅓，己方在場精靈每次受到麻痺時將當前所處異常轉化為星贖2回合；斯嘉麗在場期間每次出手流程結束後進行一次額外行動造成對方最大體力⅓的光系傷害，100%附加失明，若未觸發則消除對手回合類效果並提升斯嘉麗下2次造成的攻擊傷害150%",
        effectType: "none",
        effectValue: 0
      }
    });
    ctx.addExtraElf(actor, puniElf);
    addLog(`✨ 【燦】：珀妮作為光系額外精靈加入己方與斯嘉麗共同作戰（所有能力值為斯嘉麗⅓）！`, "effect");
  }

  const puniElf = ctx.getFullTeam(actor).find(e => e.name.includes("珀妮"));
  const isPuniAlive = !!(puniElf && !puniElf.isVanished && puniElf.currentHp > 0);

  switch (event) {
    case EffectTiming.FATAL_RESIST: {
      if (!getPlayerState("scarlettReviveActive")) {
        setPlayerState("scarlettOriginalMaxHp", self.maxHp);
        
        self.currentHp = 0;
        self.maxHp = 0;
        
        const layers = Math.min(3, Math.max(0, (getPlayerState("canjieShengmangLayers") || getPlayerState("chanStacks") || 0)));
        const countdown = Math.max(1, 4 - layers);
        
        setPlayerState("scarlettReviveCountdown", countdown);
        setPlayerState("scarlettReviveActive", true);
        
        addLog(`✨ 【聖光斯嘉麗】倒下！進入重生倒數，將於 ${countdown} 回合後在背包內重生！（珀妮依然存在於陣容中）`, "effect");
        return true;
      }
      return false;
    }

    case EffectTiming.BEFORE_DAMAGE:
      // 每次受到非真實傷害降低至原始傷害的 1/3
      if (extraData?.isIncoming && extraData?.damageCategory !== "true") {
        extraData.multiplier *= (1 / 3);
        addLog(`✨ 【燦】：聖光護體，傷害削減至 1/3！`, "effect");
        
        // 每次降低成功則令己方附加 1 層燦界聖芒，同時恢復最大體力 1/3
        const stacks = Math.min(3, (getPlayerState("chanStacks") || 0) + 1);
        setPlayerState("chanStacks", stacks);
        ctx.setMark({
          id: "scarlett_holy_light",
          displayChar: "芒",
          count: stacks,
          name: "燦界聖芒",
          description: "己方在場精靈每次受到失明後將當前所處異常狀態轉化為星贖且直到戰鬥階段結束前能力上升狀態無法被消除；己方戰鬥階段結束時敵我雙方每有1回合星贖則己方在場精靈控制類異常狀態的回合數降低燦界聖芒層數2倍，最高3層下場保留。",
          source: "聖光斯嘉麗 / 燦"
        });
        applyHeal(actor, Math.floor(self.maxHp / 3));
      }
      
      // 珀妮：斯嘉麗下2次造成的攻擊傷害提升150%（次數）
      if (!extraData?.isIncoming && extraData?.damageCategory === "skill_attack" && !extraData?.isTypedSkill && (getPlayerState("puniBoostUses") || 0) > 0) {
        extraData.increasePercent += 1.5;
        setPlayerState("puniBoostUses", getPlayerState("puniBoostUses") - 1);
      }
      break;

    case EffectTiming.ACTION_END:
      // 斯嘉麗在場期間每次出手流程結束後（含選擇技能因故未能出手）：珀妮進行一次額外行動
      // 造成對方最大體力⅓的光系傷害且100%令對手失明；未觸發失明或對手已處於失明則消除對手回合類效果且令斯嘉麗下2次造成的攻擊傷害提升150%
      if (isPuniAlive && extraData?.actor === actor && ctx.queueExtraAction) {
        ctx.queueExtraAction(actor, {
          label: "珀妮：光系傷害",
          amount: Math.floor(ctx.target.maxHp / 3),
          elem: "光",
          after: (c) => {
            const opp = c.actor === "p1" ? "p2" : "p1";
            const already = ((c.getStatuses(c.target) || {})["失明"] || 0) > 0;
            const res = already ? { success: false } : c.applyStatusWithImmunityCheck(opp, "失明", 2);
            if (!res.success) {
              c.clearTurnEffectsOf(opp);
              c.setPlayerState("puniBoostUses", 2);
              c.addLog(`✨ 【珀妮】：消除對手回合類效果，斯嘉麗下 2 次造成的攻擊傷害提升 150%！`, "effect");
            }
          },
        });
      }
      break;

    case EffectTiming.BEFORE_STATUS_APPLY:
      // 己方在場精靈每次受到麻痺時，若珀妮存在，將當前所處異常轉化為星贖
      if (isPuniAlive && extraData?.status === "麻痺" && extraData?.side === actor) {
        extraData.prevent = true;
        ctx.applyStatusWithImmunityCheck(actor, "星贖", 2);
        addLog(`✨ 【珀妮】：庇佑發生作用，將麻痺轉化為星贖狀態！`, "status");
      }
      break;

    case EffectTiming.ROUND_END: {
      if (getPlayerState("puniDamageBoostTurns") > 0) {
        setPlayerState("puniDamageBoostTurns", getPlayerState("puniDamageBoostTurns") - 1);
      }

      if (getPlayerState("scarlettReviveActive")) {
        // 重生由珀妮（斯嘉麗攜帶的光系額外精靈）執行：珀妮不在或已倒下則無法重生
        if (!isPuniAlive) {
          setPlayerState("scarlettReviveActive", false);
          addLog(`✨ 【聖光斯嘉麗】：珀妮已不在，重生中斷。`, "info");
          break;
        }
        const activeElf = actor === "p1" ? ctx.activeP1 : ctx.activeP2;
        const isMeActive = activeElf.id === self.id;

        // 斯嘉麗不在場（或雖仍在場但已陣亡、隊伍無人可換）時遞減；過去在場陣亡時永不遞減，重生永遠不發生
        if (!isMeActive || self.currentHp <= 0) {
          const countdown = (getPlayerState("scarlettReviveCountdown") || 0) - 1;
          setPlayerState("scarlettReviveCountdown", countdown);
          
          if (countdown <= 0) {
            const origMaxHp = getPlayerState("scarlettOriginalMaxHp") || self.maxHp || 2000;
            ctx.updateElf(actor, {
              id: self.id,
              maxHp: origMaxHp,
              currentHp: origMaxHp,
              isVanished: false
            });
            addLog(`✨ 【珀妮】：重生時間到！斯嘉麗於背包內浴火重生，體力恢復至滿血！`, "effect");
            setPlayerState("scarlettReviveActive", false);
          } else {
            addLog(`✨ 【聖光斯嘉麗】：背包重生倒數剩餘 ${countdown} 回合。`, "info");
          }
        }
      }
      break;
    }

    case "CHECK_REBIRTH_PENDING":
      // 倒數中的斯嘉麗仍是陣亡狀態，不算存活；隊伍全滅即結束。
      return false;
  }

  return false;
};

export const SCARLETT_SKILLS: Record<string, BattleSkillHandler> = {
  "純白聖翎": (ctx) => {
    const { actor, addLog, setOpponentState } = ctx;
    addLog(`✨ 【純白聖翎】：聖潔之羽，消除一切增益！`, "effect");
    setOpponentState("statChanges", { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 });
  },
  "晨曦昭世": (ctx) => {
    const { actor, addLog, setPlayerState } = ctx;
    addLog(`✨ 【晨曦昭世】：晨曦之光，免疫一切侵蝕！`, "effect");
    setPlayerState("immuneStatusTurns", 5);
  }
};

export { ScarlettDeconstructedProfile } from "../data/elfProfiles/scarlettRegistry";
