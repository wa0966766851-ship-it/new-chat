import { multiplyDamageReduction, addDamageReduction } from '../../../battle/damageReduction';
import { benchSkip } from '../../fieldGuard';
import { ElfDeconstructedProfile, EffectTiming, BattleEventContext, BattleSkillHandler } from '../../types';
import { queueHpDrain } from '../../../battle/hpDrain';
import { skillSlot } from '../../../battle/skillSlot';

/** 出招技能是暫存副本，充能必須寫回選中的原槽；moveIndex是出手順序，不能當槽號。 */
function setSkillCharge(ctx: BattleEventContext, charge: number): void {
  const index = skillSlot(ctx.self, ctx.skill);
  ctx.skill.charge = Math.max(0, charge);
  if (index < 0) return; // 同名而無槽資訊不猜第一格。
  const skills = ctx.self.skills.map((skill, slot) => slot === index ? { ...skill, charge: ctx.skill.charge } : skill);
  ctx.updateElf(ctx.actor, { id: ctx.self.id, battleId: ctx.self.battleId, skills });
}

export const handleMarsSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  if (benchSkip(ctx, event)) return; // 場下不觸發回合節點效果（例：聖・回合結束回復）
  const isP1 = ctx.actor === "p1";
  const self = ctx.self;
  const target = ctx.target;
  
  switch (event) {
    case EffectTiming.ON_ENTRANCE: {
      // 登場時啟動堅壁機甲並與極速機甲組合
      ctx.setPlayerState("marsMechaMode", "speed"); // Combined with極速機甲
      ctx.setPlayerState("marsShieldActive", true);
      
      const shieldAmt = Math.floor(self.maxHp / 3);
      self.shield = (self.shield || 0) + shieldAmt;
      self.barrier = (self.barrier || 0) + shieldAmt;
      if (ctx.updateElf) {
        ctx.updateElf(ctx.actor, { id: self.id, shield: self.shield, barrier: self.barrier });
      }
      
      ctx.addLog(`⚙️ 變革·馬爾修斯登場，啟動【堅壁機甲】！獲得最大體力⅓的機械護盾與護罩 (${shieldAmt} 點)！`, "effect");
      ctx.addLog(`⚡ 變革·馬爾修斯與【極速機甲】組合！所有技能先制額外+2！`, "effect");
      break;
    }
    
    case EffectTiming.ROUND_START: {
      // 回合開始時：
      // 1. 堅壁機甲：附加等同於自身最大體力⅓的護盾與護罩且護盾與護罩存在時自身首次受到的非真實傷害減半1次；
      const shieldAmt = Math.floor(self.maxHp / 3);
      self.shield = shieldAmt;
      self.barrier = shieldAmt;
      if (ctx.updateElf) {
        ctx.updateElf(ctx.actor, { id: self.id, shield: self.shield, barrier: self.barrier });
      }
      ctx.setPlayerState("marsShieldDamageHalvedUsed", false);
      ctx.addLog(`⚙️ 【堅壁機甲】回合開始重置：獲得 ${shieldAmt} 點機械護盾與護罩！`, "effect");

      // 2. 極速機甲：回合開始效果額外附加使用所有技能時先制額外+2 (同時令己方變為被挑戰方)；
      const mode = ctx.getPlayerState("marsMechaMode") || "speed";
      if (mode === "speed") {
        if (ctx.skill) {
          ctx.skill.priority = (ctx.skill.priority || 0) + 2;
          ctx.addLog(`⚡ 【極速機甲】使當前技能【${ctx.skill.name}】先制額外+2！`, "effect");
        }
      }
      break;
    }
    
    case EffectTiming.BEFORE_ACTION: {
      const mode = ctx.getPlayerState("marsMechaMode") || "speed";
      
      // 1. 每次選擇使用第五技能時則吸取對手最大體力的⅓，
      // 若與極速機甲組合時則於使用技能後切換成與毀滅機甲進行組合，
      // 若與毀滅機甲組合時則於使用技能後切換成與極速機甲進行組合進行戰鬥(吸取體力效果boss無效，其餘Boss有效)
      if (ctx.skill && ctx.skill.isFifthSkill) {
        // 吸取對手最大體力的1/3 (boss無效)
        const isBoss = target.name.includes("魔獅迪露") || target.maxHp > 100000;
        if (!isBoss) {
          const drainAmt = Math.floor(target.maxHp / 3);
          const actualDrain = queueHpDrain(ctx, ctx.targetSide, drainAmt, 'percent', '王·超限共頻');
          ctx.addLog(`⚙️ 【王·超限共頻】超限汲取：吸取對手最大體力⅓ (${actualDrain} 點)！`, "heal");
        } else {
          ctx.addLog(`⚙️ 由於對手為Boss，【王·超限共頻】最大體力⅓汲取效果無效！`, "info");
        }
        
        // 切換組合
        const nextMode = mode === "speed" ? "destroy" : "speed";
        ctx.setPlayerState("marsMechaMode", nextMode);
        ctx.addLog(`⚙️ 變革·馬爾修斯使用第五技能，切換組合模式為【${nextMode === "speed" ? "極速機甲" : "毀滅機甲"}】！`, "effect");
      }
      
      // 2. 極速機甲在場效果: "先出手時攻擊傷害結算前使對手全屬性-1，馬爾修斯處於速度能力提升狀態時效果翻倍；"
      if (mode === "speed") {
        const isGoingFirst = ctx.goesFirst;
        if (isGoingFirst) {
          // Check if speed stage is positive
          const speedStage = self.statStages?.speed || 0;
          const decreaseAmt = speedStage > 0 ? 2 : 1;
          ctx.addLog(`⚡ 【極速機甲】先出手：攻擊傷害結算前使對手全屬性 -${decreaseAmt}！`, "effect");
          
          const oppStages = { ...target.statStages };
          for (const k in oppStages) {
            oppStages[k] = Math.max(-6, (oppStages[k] || 0) - decreaseAmt);
          }
          target.statStages = oppStages;
        } else {
          // "後出手則下2回合對手先制效果失效且執行附加控制類異常效果時令堅壁機甲紀錄該異常"
          ctx.addLog(`⚡ 【極速機甲】後出手：記錄被動效果！`, "effect");
          ctx.setPlayerState("oppPriorityDisabledTurns", 2);
        }
      }
      
      // 3. 毀滅機甲在場效果: "所有攻擊技能威力提升100%，每次使用額外提升10%，最高170%；"
      if (mode === "destroy" && ctx.skill && ctx.skill.power > 0) {
        let extraBoost = ctx.getPlayerState("marsDestroyPowerBoost") || 1.0;
        ctx.skill.power = Math.floor(ctx.skill.power * (1.0 + extraBoost));
        ctx.addLog(`💥 【毀滅機甲】增幅：【${ctx.skill.name}】威力提升 ${Math.round(extraBoost * 100)}% (威力變為 ${ctx.skill.power})！`, "effect");
        
        // 每次使用額外提升 10%，最高 1.7
        const nextBoost = Math.min(1.7, extraBoost + 0.1);
        ctx.setPlayerState("marsDestroyPowerBoost", nextBoost);
      }

      // PP Consumption Multiplier (王·肅正協議效果)
      if (ctx.getPlayerState("attackPpCostMultiplierTurns") > 0 && ctx.skill && ctx.skill.category !== "屬性") {
        if (extraData?.ppCostComp) {
          extraData!.ppCostComp.multiplier *= 20;
          ctx.addLog(`⚙️ 【王·肅正協議】壓制：攻擊技能 PP 消耗量提升 20 倍！`, "effect");
        }
      }
      
      // 4. "戰鬥階段結束時，若自身本回合未選擇第五技能或第五技能無效，則下回合使用攻擊技能時消耗該技能所有充能值並汲取對手等同於15倍消耗值的體力值且當回合攻擊技能造成傷害提升150%(boss有效)"
      if (ctx.skill && ctx.skill.power > 0 && ctx.getPlayerState("marsEndTurnChargeStrike")) {
        const currentCharge = ctx.skill.charge !== undefined ? ctx.skill.charge : ctx.skill.pp;
        if (currentCharge > 0) {
          // 消耗該技能所有充能值
          setSkillCharge(ctx, 0);
          
          // 汲取對手等同於15倍消耗值的體力值
          const drainAmt = currentCharge * 15;
          const actualDrain = queueHpDrain(ctx, ctx.targetSide, drainAmt, 'true', '充能極限打擊');
          
          // 當回合攻擊技能造成傷害提升150%
          ctx.setPlayerState("marsChargeStrikeBoost", 1.5); // 當回合攻擊技能傷害提升150%（回合結束清除）
          ctx.addLog(`💥 馬爾修斯充能超頻！消耗了 【${ctx.skill.name}】 全部 ${currentCharge} 點充能，汲取對手 ${actualDrain} 點體力，且當回合技能傷害提升 150%！`, "effect");
        }
        ctx.setPlayerState("marsEndTurnChargeStrike", false); // consume the strike
      }
      break;
    }
    
    case EffectTiming.BEFORE_DAMAGE: {
      const isIncoming = extraData?.isIncoming;
      
      // 1. 堅壁機甲："護盾與護罩存在時自身首次受到的非真實傷害減半1次"
      if (isIncoming && (self.shield || 0) > 0 && (self.barrier || 0) > 0 && !ctx.getPlayerState("marsShieldDamageHalvedUsed")) {
        if (extraData && extraData.damageCategory !== "true") {
          multiplyDamageReduction(extraData, 0.5);
          ctx.setPlayerState("marsShieldDamageHalvedUsed", true);
          ctx.addLog(`🛡️ 【堅壁機甲】首次受防禦護航：受到的傷害減半！`, "effect");
        }
      }
      
      // 兩個「提升X%」各自獨立（相乘），只限攻擊技能傷害
      if (!isIncoming && extraData && extraData.damageCategory === "skill_attack") {
        const strike = Number(ctx.getPlayerState("marsChargeStrikeBoost")) || 0;
        if (strike > 0) extraData.increasePercent += strike; // 當回合有效
        const protocol = Number(ctx.getPlayerState("marsProtocolBoostThisAction")) || 0;
        if (protocol > 0) { extraData.increasePercent += protocol; ctx.setPlayerState("marsProtocolBoostThisAction", 0); }
      }
      break;
    }
    
    case EffectTiming.AFTER_ACTION: {
      const mode = ctx.getPlayerState("marsMechaMode") || "speed";
      // 對手已經死亡（血量為0）時，整段機甲判斷直接跳過
      if (target.currentHp <= 0) break;

      // 毀滅機甲出手後判定：
      // "每次出手後若對手體力低於30%則消耗對手所有體力與該技能1點充能值以提升自身所有能力值30%；"
      // "每次出手後若對手體力高於30%則消耗該技能1點充能值以附加對手最大體力30%的百分比傷害並恢復自身等量體力；"
      if (mode === "destroy" && ctx.skill) {
        const currentCharge = ctx.skill.charge !== undefined ? ctx.skill.charge : ctx.skill.pp;
        if (currentCharge > 0) {
          const oppHpRatio = target.currentHp / target.maxHp;
          if (oppHpRatio < 0.3) {
            // Low Hp execution: "消耗對手所有體力與該技能1點充能值以提升自身所有能力值30%"
            setSkillCharge(ctx, currentCharge - 1);
            
            ctx.addLog(`💥 【毀滅機甲】弱者斬殺！消耗 1 點充能與對手所有生命！`, "effect");
            ctx.applyTrueDamage(ctx.actor === "p1" ? "p2" : "p1", target.currentHp, "毀滅斬殺", ctx.activeP1, ctx.activeP2);
            
            // 提升自身所有能力值 30%
            const selfStages = { ...self.statStages };
            for (const k in selfStages) {
              selfStages[k] = Math.min(6, (selfStages[k] || 0) + 2);
            }
            self.statStages = selfStages;
          } else {
            // High Hp percentage drain: "消耗該技能1點充能值以附加對手最大體力30%的百分比傷害並恢復自身等量體力"
            setSkillCharge(ctx, currentCharge - 1);
            
            const drainAmt = Math.floor(target.maxHp * 0.3);
            const actualDrain = queueHpDrain(ctx, ctx.targetSide, drainAmt, 'percent', '毀滅機甲');
            ctx.addLog(`💥 【毀滅機甲】超頻：消耗 1 點充能，附加對手最大體力 30% 百分比傷害 (${actualDrain} 點) 並恢復等量體力！`, "effect");
          }
        }
      }
      break;
    }
    
    case EffectTiming.ROUND_END: {
      ctx.setPlayerState("marsChargeStrikeBoost", 0);
      ctx.setPlayerState("marsProtocolBoostThisAction", 0);
      // 1. 堅壁機甲："回合結束時恢復自身最大體力的⅓並附加對手等量百分比傷害，若護盾護罩消失時則額外提前觸發1次(回合結束時可再次觸發)"
      const healAmt = Math.floor(self.maxHp / 3);
      ctx.applyHeal(ctx.actor, healAmt);
      // 「等量」引用本次恢復請求，不另取對手最大體力⅓，也不因自身滿血而變0。
      const splashDmg = healAmt;
      ctx.applyPinkDamage(ctx.actor === "p1" ? "p2" : "p1", splashDmg, "堅壁被動反噬", ctx.activeP1, ctx.activeP2, "percent");
      ctx.addLog(`⚙️ 【堅壁機甲】修復與被動反噬：恢復 ${healAmt} 點體力，並附加對手等量 (${splashDmg} 點) 傷害！`, "effect");

      // 2. "戰鬥階段結束時，若自身本回合未選擇第五技能或第五技能無效，則下回合使用攻擊技能時..."
      // Check if 5th skill was used this turn
      const usedFifth = ctx.skill && ctx.skill.isFifthSkill;
      if (!usedFifth) {
        ctx.setPlayerState("marsEndTurnChargeStrike", true);
        ctx.addLog(`⚙️ 【充能系統】本回合未啟動超限共頻。下回合使用攻擊技能將觸發【充能極限打擊】！`, "info");
      } else {
        ctx.setPlayerState("marsEndTurnChargeStrike", false);
      }

      // TXT 的「所有技能+5充能」只屬於第五技能附加效果，不在回合末自動執行。
      break;
    }
    
    default:
      break;
  }
};

export const MARS_SKILLS: Record<string, BattleSkillHandler> = {
  '革新已至': (ctx) => {
    const isP1 = ctx.actor === "p1";
    const self = ctx.self;
    const target = ctx.target;
    
    // 吸取對手能力提升狀態
    const oppStages = target.statStages;
    let anyAbsorbed = false;
    const newSelfStages = { ...self.statStages };
    const newOppStages = { ...oppStages };
    for (const k in oppStages) {
      const v = oppStages[k as keyof typeof oppStages] || 0;
      if (v > 0) {
        newSelfStages[k as keyof typeof newSelfStages] = Math.min(6, (newSelfStages[k as keyof typeof newSelfStages] || 0) + v);
        newOppStages[k as keyof typeof newOppStages] = 0;
        anyAbsorbed = true;
      }
    }
    if (anyAbsorbed) {
      self.statStages = newSelfStages;
      target.statStages = newOppStages;
      ctx.addLog(`🧹 【革新已至】成功吸取對手的所有能力強化！`, "effect");
      // 下2回合對手受到攻擊必定致命
      ctx.setOpponentState("alwaysBeCritTurns", 2);
    }
    
    // 吸取對手當前體力1/4 (若PP/充能為滿時則為1/2)
    // 魂印令PP永遠視為滿；充能可以為0或超出上限，不能拿充能判斷PP。
    const isFull = ctx.self.name === '變革·馬爾修斯' || !!ctx.skill && ctx.skill.pp === ctx.skill.maxPp;
    const ratio = isFull ? 0.5 : 0.25;
    const drainAmt = Math.floor(target.currentHp * ratio);
    if (drainAmt > 0) {
      const actualDrain = queueHpDrain(ctx, ctx.targetSide, drainAmt, 'percent', '革新已至');
      ctx.addLog(`⚙️ 【革新已至】吸取對手當前體力的 ${isFull ? "50%" : "25%"} (${actualDrain} 點)！`, "heal");
    }
    
    // 無效對手下次攻擊技能
    ctx.setOpponentState("nextAttackInvalid", true);
    ctx.addLog(`🛡️ 【革新已至】無效對手下次攻擊技能！`, "effect");
  },
  
  '源生壁壘': (ctx) => {
    const isP1 = ctx.actor === "p1";
    const self = ctx.self;
    const target = ctx.target;
    
    // 3回合內自身使用技能對手每回合速度-2、命中-2，未觸發則2回合內對手無法切換精靈
    ctx.setPlayerState("marsWallDebuffTurns", 3);
    
    // 4回合內對手每次使用攻擊技能時吸取對手最大體力1/3
    ctx.setPlayerState("marsWallDrainTurns", 4);
    
    // 4回合內對手使用攻擊技能時100%使對手癱瘓
    ctx.setPlayerState("marsWallParalyzeTurns", 4);
    
    // 抵擋下1次攻擊，抵擋成功則附加對手等量真實傷害並恢復自身等量體力
    ctx.setPlayerState("marsWallBlockActive", true);
    ctx.addLog(`🛡️ 【源生壁壘】建構完成：啟動 4 回合能量汲取、癱瘓干擾與抵擋護航！`, "effect");
  },
  
  '核心重構': (ctx) => {
    const isP1 = ctx.actor === "p1";
    const self = ctx.self;
    const target = ctx.target;
    
    // 必中且解除自身異常
    ctx.clearTurnEffectsOf(ctx.actor, self);
    // 5回合內自身使用技能恢復自身體力1/3並附加對手等量百分比傷害，自身體力低於1/2時效果翻倍
    ctx.setPlayerState("marsRestoreAndSplashTurns", 5);
    
    // 5回合內自身使用技能吸取對手350點固定體力，對手受到固定傷害後體力未減少則附加300點真實傷害
    ctx.setPlayerState("marsFixedDrainTurns", 5);
    
    // 3回合內若對手使用攻擊技能則100%令對手隨機2個技能PP歸0，並補充充能
    ctx.setPlayerState("marsOppPpDrainTurns", 3);
    ctx.addLog(`⚙️ 【核心重構】自檢完成：清空異常狀態，啟動 5 回合生命自愈與充能掠奪！`, "effect");
  },
  
  '王·超限共頻': (ctx) => {
    const isP1 = ctx.actor === "p1";
    const self = ctx.self;
    const target = ctx.target;
    
    // 消除雙方回合類效果
    ctx.clearTurnEffectsOf("p1", ctx.activeP1);
    ctx.clearTurnEffectsOf("p2", ctx.activeP2);
    ctx.addLog(`🧼 【王·超限共頻】淨化：消除了雙方的所有回合類效果！`, "effect");
    
    // 消除雙方能力上升、下降狀態、護盾與護罩，消除任意一項則吸取對手等同於對手最大體力70%的百分比傷害
    let anyCleared = false;
    // Clear stages
    if (Object.values(self.statStages).some(v => v !== 0) || Object.values(target.statStages).some(v => v !== 0)) {
      self.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
      target.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
      anyCleared = true;
    }
    if (self.shield || self.barrier || target.shield || target.barrier) {
      self.shield = 0;
      self.barrier = 0;
      target.shield = 0;
      target.barrier = 0;
      if (ctx.updateElf) {
        ctx.updateElf(ctx.actor, { id: self.id, shield: 0, barrier: 0 });
        ctx.updateElf(isP1 ? "p2" : "p1", { id: target.id, shield: 0, barrier: 0 });
      }
      anyCleared = true;
    }
    
    if (anyCleared) {
      const isBoss = target.name.includes("魔獅迪露") || target.maxHp > 100000;
      if (!isBoss) {
        const drainAmt = Math.floor(target.maxHp * 0.7);
        const actualDrain = queueHpDrain(ctx, ctx.targetSide, drainAmt, 'percent', '王·超限共頻');
        ctx.addLog(`💥 【王·超限共頻】超限湮滅：消除雙方強化與防壁，吸取對手最大體力 70% (${actualDrain} 點)！`, "heal");
      }
    }
    
    // 3回合內對手體力恢復量下降100%
    ctx.setOpponentState("healReducedTurns", 3);
    
    // 特攻+1、防禦+1、特防+1、速度+1、命中+1 (存在充能時效果翻倍, 補滿充能)
    const hasCharge = self.skills.some((s: any) => (s.charge !== undefined ? s.charge : s.pp) > 0);
    const multiplier = hasCharge ? 2 : 1;
    const stages = { ...self.statStages };
    stages.spatk = Math.min(6, (stages.spatk || 0) + 1 * multiplier);
    stages.def = Math.min(6, (stages.def || 0) + 1 * multiplier);
    stages.spdef = Math.min(6, (stages.spdef || 0) + 1 * multiplier);
    stages.speed = Math.min(6, (stages.speed || 0) + 1 * multiplier);
    stages.accuracy = Math.min(6, (stages.accuracy || 0) + 1 * multiplier);
    self.statStages = stages;
    ctx.addLog(`📈 自身全能力 +${multiplier}！`, "effect");

    // 只在成功執行這份附加效果時補充；不補到上限，保留超上限充能。
    if (self.skills.some(skill => (skill.charge ?? skill.pp) === 0)) {
      const skills = self.skills.map(skill => ({ ...skill, charge: Math.max(0, skill.charge ?? skill.pp) + 5 }));
      ctx.updateElf(ctx.actor, { id: self.id, battleId: self.battleId, skills });
    }
    
    // 5回合內免疫並反彈所有異常狀態
    ctx.setPlayerState("immuneAndReflectStatusTurns", 5);
  }
};

export { MarsDeconstructedProfile } from "../../../data/elfProfiles/marsRegistry";
