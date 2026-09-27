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
            addLog(`✨ 【聖光斯嘉麗】：重生時間到！於背包內浴火重生，體力恢復至滿血！`, "effect");
            setPlayerState("scarlettReviveActive", false);
          } else {
            addLog(`✨ 【聖光斯嘉麗】：背包重生倒數剩餘 ${countdown} 回合。`, "info");
          }
        }
      }
      break;
    }

    case "CHECK_REBIRTH_PENDING":
      return getPlayerState("scarlettReviveActive") && getPlayerState("scarlettReviveCountdown") === 1;
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

export const ScarlettDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'holy_light_scarlett',
  name: '聖光斯嘉麗',
  soulMark: {
    can: {
      id: 'mark.holy_light_scarlett',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '燦',
        description: '燦: 戰鬥開始時，珀妮作為額外精靈加入己方與斯嘉麗共同作戰；自身每次受到非真實傷害降低至原始傷害的⅓，每次降低成功則令己方附加1層燦界聖芒，同時恢復最大體力1/3於當回合結束時造成對手等同於恢復量的百分比傷害，之後自身下場後，則1回合內令己方下隻出戰精靈登場前1回合獲得上述降低傷害效果與回合結束時恢復效果，每有1層燦界聖芒則延長1回合；自身使用技能時令自身特攻、速度+2、命中+1並附加對手特防、速度-2、命中-1，對手使用技能時令對手雙攻、速度-2、命中-1並附加自身雙防、速度、命中+1，前述效果執行時若雙方能力等級變化不高於10則2回合內自身攻擊技能計算傷害時以弱點傷害計算並附加對手星贖1回合，已存在星贖則改為回合數+1。(珀妮:光系額外精靈，所有能力值均為斯嘉麗⅓，己方在場精靈每次受到麻痺時後將當前所處異常狀態轉化為星贖且當回合直到戰鬥階段結束前回合類效果無法被消除；斯嘉麗在場期間每次出手流程結束後(含斯嘉麗選擇技能因故未能出手)進行一次額外行動造成對方等同於最大體力⅓的光系傷害且100%令對手失明，未觸發失明或對手已處於失明則消除對手回合類效果且令斯嘉麗下2次造成的攻擊傷害提升150%；己方斯嘉麗死亡4回合後在背包內重生，己方每有1層燦界聖芒則重生所需回合降低1回合。燦界聖芒:己方在場精靈每次受到失明後將當前所處異常狀態轉化為星贖且直到戰鬥階段結束前能力上升狀態無法被消除；己方戰鬥階段結束時敵我雙方每有1回合星贖則己方在場精靈控制類異常狀態的回合數降低燦界聖芒層數2倍，異常回合數最高降至1回合；對方技能戰鬥階段結束時敵我雙方每有1回合星贖降低對手等同於燦界聖芒層數所有技能等量技能PP值，最多降低至1點PP值，若對手被降低後PP值不大於1時額外令對手PP值該技能PP值上限歸1(上限3層，下場後保留)。弱點傷害:計算傷害以對手當前雙防值中較低者的60%作為對手的防禦值或特防值計算)',
        combatLog: '✨ 聖光斯嘉麗與摯友珀妮攜手降臨！聖靈之芒照耀宇宙，開啟燦界聖芒！'
      },
      mechanics: {
        trigger: 'BATTLE_START',
        damageReductionToThird: true,
        healRatio: 0.33,
        summonPuniPartner: true,
        statBoostOnUse: true,
        statDebuffOnOpponentUse: true,
        weaknessDamageCalculation: true
      }
    }
  },
  skills: {
    '純白聖翎': [
      {
        id: 'scarlett.skill1.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '純白聖翎特效',
          description: '先制+3；消除對手能力提升狀態，消除成功則令對手所有攻擊技能PP值歸0；3回合內對手屬性技能無效且使用後令該技能PP值歸0；技能無效時恢復自身最大體力½且下次受到異常狀態時轉化為星贖'
        },
        mechanics: { priority: 3, clearOpponentBuffs: true, ppZeroOnClear: true, sealStatusTurns: 3, healOnMissRatio: 0.5 }
      }
    ],
    '晨曦昭世': [
      {
        id: 'scarlett.skill2.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '晨曦昭世特效',
          description: '先制+1；必中；5回合內自身免疫並反彈所有異常狀態；4回合內，自身使用技能則附加對手等同於自身最大體力20%的真實傷害；2回合內自身免疫受到的攻擊，雙方每存在異常狀態1回合則額外延長1回合；3回合內，自身回合類效果被消除時令敵我雙方星贖，已存在星贖則改為回合數+2，未觸發則敵方下2回合無法主動切換精靈'
        },
        mechanics: { priority: 1, alwaysHit: true, immuneAndReflectStatusTurns: 5, trueDamageTurns: 4, trueDamageRatio: 0.2, immuneAttacksTurns: 2 }
      }
    ],
    '暮光舞動': [
      {
        id: 'scarlett.skill3.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '暮光舞動特效',
          description: '必中；令自身特攻、雙防、速度+2、命中+1；5回合內自身使用技能恢復自身最大體力1/3並造成等量百分比傷害，自身體力低於最大體力½時效果翻倍；將對手屬性變為暗影系，若對手識別屬性為暗影系則令對手下次技能無效；下2回合自身所有技能先制+2；技能無效時，下2次攻擊將對手視為暗影系，自身攻擊視為光系'
        },
        mechanics: { priority: 0, alwaysHit: true, statUp: { spatk: 2, def: 2, spdef: 2, speed: 2, accuracy: 1 }, healAndDamageTurns: 5, healRatio: 0.33, changeOpponentType: '暗影', nextPriorityTurns: 2, priorityBonus: 2 }
      }
    ],
    '王·凰歌盡霄': [
      {
        id: 'scarlett.skill4.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '王·凰歌盡霄特效',
          description: '必中；自身處於能力下降時當回合先制+3；與對手交換自身低於對手的能力等級，交換成功則令自身無效下次對手的攻擊技能且當回合與下次造成攻擊傷害提升150%；技能威力提升75%，敵我雙方每有1個技能當前PP值低於1時提升30%；吸取對手等同於當回合自身造成攻擊傷害100%的體力'
        },
        mechanics: { priority: 0, alwaysHit: true, swapLowerStats: true, powerBoostRatio: 0.75, absorbDamageRatio: 1.0 }
      }
    ],
    '王·聖璨天潔': [
      {
        id: 'scarlett.skill5.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '王·聖璨天潔特效',
          description: '必中；攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；消除對手回合類效果，消除成功則對手麻痺，未觸發則自身免疫下1次受到的異常狀態；附加自身最大體力30%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/3則恢復效果和百分比傷害翻倍；附加對手最大體力1/3的百分比傷害，未擊敗對手則恢復自身等量體力值'
        },
        mechanics: { priority: 0, alwaysHit: true, isFifthSkill: true, kingPrivilegeNoWeak: true, clearOpponentTurnEffects: true, inflictParalysisOnClear: true, hpDamageRatio: 0.3, healRatio: 0.3 }
      }
    ]
  }
};
