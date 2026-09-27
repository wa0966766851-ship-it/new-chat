import { BattleEventContext, BattleSkillHandler, EffectTiming } from "./types";
import { isStatusActive } from "../utils/statusManager";

/**
 * 蟲后·奧佩婭 (Opeia) A級專屬註冊表 [后]
 */

export const handleOpeiaSoulMark = (context: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, addLog, applyTrueDamage, applyStatusWithImmunityCheck, activeP1, activeP2 } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";

  const isHighStat = (elf: any) => {
    const stats = elf.baseStats || {};
    const sum = (stats.hp || 0) + (stats.atk || 0) + (stats.def || 0) + (stats.spatk || 0) + (stats.spdef || 0) + (stats.speed || 0);
    return sum >= 700;
  };

  // 1. 登場效果 (ON_ENTRANCE) / 檢查蟲類 (BEFORE_ACTION)
  if (event === EffectTiming.ON_ENTRANCE || event === EffectTiming.BEFORE_ACTION) {
    const selfIsInsect = isHighStat(self);
    const targetIsInsect = isHighStat(target);
    
    if (selfIsInsect) setPlayerState("isInsect", true);
    if (targetIsInsect) context.setOpponentState("isInsect", true);
    
    if (event === EffectTiming.ON_ENTRANCE) {
      addLog(`🦋 【后】：萬蟲之母降臨，令場上所有強大精靈 (總和>=700) 視為昆蟲類！`, "effect");
    }
  }

  // 2. 減傷邏輯 (BEFORE_DAMAGE)
  if (event === EffectTiming.BEFORE_DAMAGE) {
    const isInsect = getPlayerState("isInsect");
    if (extraData?.isIncoming && isInsect && extraData.damageCategory !== "true") {
      const reduction = Math.floor(extraData.base * 0.5);
      extraData.decreasePercent += 0.5;
      addLog(`🦋 【昆蟲類】：受到的攻擊傷害減少 50% (${reduction})！`, "effect");
    }
  }

  // 3. 真實傷害 (AFTER_ACTION)
  if (event === EffectTiming.AFTER_ACTION) {
    const isInsect = getPlayerState("isInsect");
    const isAttack = extraData?.skill?.category === "物理" || extraData?.skill?.category === "特殊";
    if (isInsect && isAttack) {
      applyTrueDamage(oppSide, 200, "昆蟲類附加傷害", activeP1, activeP2);
      addLog(`🦋 【昆蟲類】：攻擊附加 200 點真實傷害！`, "damage");
    }
  }

  // 4. 其他邏輯 (可擴展...)
  // 自身使用技能不消耗 PP (常駐)
  if (event === EffectTiming.BEFORE_SKILL && extraData?.actor === actor) {
    // 邏輯在 BattleScreen 處理 PP 扣除前檢查
  }

  return false;
};

export const OPEIA_SKILLS: Record<string, BattleSkillHandler> = {
  "毒噬魂絲": (ctx) => {
    const { target, addLog, applyPinkDamage } = ctx;
    addLog(`🕸️ 使用【毒噬魂絲】：吸取對手最大體力 1/3！`, "damage");
    const drain = Math.floor(target.maxHp / 3);
    applyPinkDamage(ctx.actor === "p1" ? "p2" : "p1", drain, "毒噬魂絲", ctx.activeP1, ctx.activeP2, "百分比傷害");
  },
  "蟲群庇護": (ctx) => {
    const { self, addLog } = ctx;
    addLog(`🛡️ 使用【蟲群庇護】：5 回合內免疫並反彈所有異常狀態！`, "status");
    ctx.setPlayerState("immuneStatusTurns", 5);
  },
  "蟲后之冠": (ctx) => {
    const { addLog } = ctx;
    addLog(`👑 使用【蟲后之冠】：全屬性提升！`, "effect");
  },
  "王.噬心毒蝕": (ctx) => {
    const { target, addLog, applyPinkDamage } = ctx;
    addLog(`💔 使用【王.噬心毒蝕】：附加對手已損失體力 50% 的傷害！`, "damage");
    const bonus = Math.floor((target.maxHp - target.currentHp) * 0.5);
    applyPinkDamage(ctx.actor === "p1" ? "p2" : "p1", bonus, "噬心毒蝕", ctx.activeP1, ctx.activeP2, "百分比傷害");
  },
  "王·鏽腑喰心": (ctx) => {
    const { addLog } = ctx;
    addLog(`⚔️ 使用【王·鏽腑喰心】：忽視對手 25% 特防！`, "effect");
  }
};

export const OpeiaDeconstructedProfile: any = {
  id: 'opeia',
  name: '蟲后·奧佩婭',
  soulMark: {
    hou: {
      id: 'mark.hou',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '后',
        description: '登場時：己方背包內所有精靈每有n隻存活或識別帶有蟲系的精靈則自身直到下場獲得等同於所有能力值n*10%總和的臨時能力值且前n次自身攻擊技能連擊次數+1；敵方背包內所有精靈每有一隻陣亡或識別帶有蟲系的精靈則直到下場前對手使用攻擊技能時攻擊威力降低10%；前述效果觸發時若敵我雙方存在識別帶有混沌系的精靈，則場下所有帶有混沌系精靈所有能力值降低60%並附加給自身，自身直到下場前無視對手攻擊免疫效果、攻擊免疫/抵擋/轉化傷害效果、攻擊傷害限制效果；對手使用技能時：若該技能為攻擊技能時令對手下次屬性技能附加效果失效(下場後保留)，若該技能為屬性技能時令對手下次攻擊技能附加效果失效(下場後保留)；每次觸發前述效果時，恢復自身最大體力50%，令對手當回合造成的非真實傷害降低50%且當回合戰鬥階段結束時令使用的技能PP值歸0；該技能為攻擊技能則額外令對手所有相同類型的技能PP值歸0；該技能為屬性技能則額外令2回合內自身受到非真實傷害降低效果觸發時比例變為99%；自身使用技能時：不消耗技能PP值；100%令對手中毒，未觸發則消除對手回合類效果並有等同於自身體力當前百分比機率令對手害怕；若該技能PP值為滿或為屬性技能，則當回合出手流程結束時將對手所處的中毒異常狀態轉化為感染；若該技能PP值不為滿或為攻擊技能，吸取對手所有技能2點PP值',
      }
    }
  },
  skills: {}
};
