import { BattleEventContext, BattleSkillHandler, EffectTiming } from "../../types";
import { isStatusActive } from "../../../utils/statusManager";
import { isAbnormal } from "../../../utils/battleHelpers";
import { makeRng } from "../../../utils/rng";
import { turnEffect } from "../../../battle/timers";

export const handleDeluSoulMark = (context: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, getOpponentState, setOpponentState, addLog, applyPinkDamage, applyStatusWithImmunityCheck } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 1. 戰鬥開始/出場：調整體力為 3,000,000 並附加 5 道枷鎖
  if (event === EffectTiming.ON_ENTRANCE) {
    if (!getPlayerState("deluInitialized")) {
      self.maxHp = 3000000;
      self.currentHp = 3000000;
      context.setMark({
        id: "delu_shackles",
        displayChar: "枷",
        count: 5,
        name: "魔軀枷鎖",
        description: "每有1道則受到攻擊傷害與重量提升10%，每次受到真實傷害時轉移1道魔軀枷鎖給對手，最多5道（下場後保留）。",
        source: "誑獅魔軀.魔獅迪露 / 獅",
        effects: {
          damageTakenIncreasePercentPerStack: 0.1,
          weightIncreasePercentPerStack: 0.1
        }
      });
      setPlayerState("deluInitialized", true);
      addLog(`🦁 【獅】：【${self.name}】降臨！體力調整為 3,000,000，附加 5 道魔軀枷鎖！`, "effect");
    }
  }

  
  if (event === EffectTiming.ON_STATUS_IMMUNIZED) {
     const count = getPlayerState("DeluNextStatusImmuneCount") || 0;
     if (count > 0) {
        setPlayerState("DeluNextStatusImmuneCount", count - 1);
        addLog(`🛡️ 【劫盡歸塵】：成功免疫異常狀態！恢復體力並造成等量百分比傷害！`, "effect");
        const healAmt = Math.floor(self.maxHp / 3);
        context.applyHeal(actor, healAmt);
        applyPinkDamage(oppSide, healAmt, "【劫盡歸塵】百分比傷害", context.activeP1, context.activeP2, "百分比傷害");
     }
  }
  
  if (event === "ON_STATUS_ENDED") {
     if (getPlayerState("DeluStatusEndHeal")) {
        addLog(`✨ 【劫盡歸塵】：異常狀態結束或解除，恢復全部體力！`, "heal");
        context.applyHeal(actor, self.maxHp);
        setPlayerState("DeluStatusEndHeal", false);
     }
  }

  if (event === EffectTiming.MODIFY_PRIORITY) {
     if (getPlayerState("DeluNextSkillPriorityBoost2")) {
        extraData?.priorityComp && (extraData.priorityComp.bonus += 2);
        setPlayerState("DeluNextSkillPriorityBoost2", false);
        addLog(`⚡ 【辟冥·鎮獄斷】：先制額外 +2！`, "effect");
     }
  }

  // 2. 受到傷害後：受到真實傷害時轉移 1 道枷鎖給對手 (ON_DAMAGED)
  if (event === EffectTiming.ON_DAMAGED && extraData?.damageType === "true") {
    const mySide = actor;
    const myMarks = context.getMarks(mySide);
    const oppMarks = context.getMarks(oppSide);
    
    const myShackleMark = myMarks.find(m => m.id === "delu_shackles");
    const oppShackleMark = oppMarks.find(m => m.id === "delu_shackles");
    
    const shackles = myShackleMark?.count || 0;
    if (shackles > 0) {
      const nextShackles = shackles - 1;
      const opponentShackles = oppShackleMark?.count || 0;
      const nextOppShackles = Math.min(5, opponentShackles + 1);
      
      // 更新自身印記
      if (nextShackles > 0) {
        context.setMark({
          id: "delu_shackles",
          displayChar: "枷",
          count: nextShackles,
          name: "魔軀枷鎖",
          description: "每有1道則受到攻擊傷害與重量提升10%，每次受到真實傷害時轉移1道魔軀枷鎖給對手，最多5道（下場後保留）。",
          source: "誑獅魔軀.魔獅迪露 / 獅",
          effects: {
            damageTakenIncreasePercentPerStack: 0.1,
            weightIncreasePercentPerStack: 0.1
          }
        }, mySide);
      } else {
        context.clearMark("delu_shackles", mySide);
      }
      
      // 更新對手印記
      context.setMark({
        id: "delu_shackles",
        displayChar: "枷",
        count: nextOppShackles,
        name: "魔軀枷鎖",
        description: "每有1道則受到攻擊傷害與重量提升10%，每次受到真實傷害時轉移1道魔軀枷鎖給對手，最多5道（下場後保留）。",
        source: "誑獅魔軀.魔獅迪露 / 獅",
        effects: {
          damageTakenIncreasePercentPerStack: 0.1,
          weightIncreasePercentPerStack: 0.1
        }
      }, oppSide);
      
      addLog(`🦁 【魔軀枷鎖】：受到真實傷害，轉移 1 道枷鎖給對手！(自身剩餘 ${nextShackles} 道，對手持有 ${nextOppShackles} 道)`, "effect");
    }
  }

  // 3. 致命抗性：僅在受到真實傷害瀕死時觸發強制存活 (FATAL_RESIST)
  if (event === EffectTiming.FATAL_RESIST) {
    if (extraData?.damageType === "true") {
       self.currentHp = 1;
       self.battleStatus = "normal";          // 解除自身異常狀態
       self.battleStatusDuration = 0;
       self.battleStatuses = {};
       self.effects = [];
       addLog(`🦁 【獅】：受到致死真實傷害，強制存活保留 1 點體力並解除異常狀態！`, "effect");
       return true;
    }
    return false;
  }

  // 4. 效果強制執行 (ENFORCE)
  if (event === EffectTiming.ENFORCE) {
    if (isAbnormal(self)) {
      self.battleStatus = "normal";
      self.battleStatuses = {};
      self.effects = [];
      addLog(`🦁 【獅】：魔軀金剛不壞，免疫異常！`, "status");
    }
    const stages = self.statStages || { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
    let cleared = false;
    for (const k in stages) {
      const key = k as keyof typeof stages;
      if ((stages[key] || 0) < 0) {
        (stages as any)[key] = 0;
        cleared = true;
      }
    }
    if (cleared) {
      self.statStages = { ...stages };
      addLog(`🦁 【獅】：魔軀堅如磐石，免疫能力下降！`, "effect");
    }
  }

  return false;
};

export const DELU_SKILLS: Record<string, BattleSkillHandler> = {
  "狻猊噬": (ctx) => {
    const { actor, target, self, activeP1, activeP2, addLog, applyPinkDamage, applyStatusWithImmunityCheck, getPlayerState, setPlayerState, getOpponentState, setOpponentState } = ctx;
    let cleared = false;
    
    const oppDamageBoostTurns = getOpponentState("DamageBoostTurns") as number;
    const oppDeepSeaTurns = getOpponentState("DeepSeaTurns") as number;
    const oppPuniDamageAmplifyTurns = getOpponentState("PuniDamageAmplifyTurns") as number;
    const oppDeluNonTrueDmgBoostTurns = getOpponentState("DeluNonTrueDmgBoostTurns") as number;
    const oppImmuneReflectTurns = getOpponentState("ImmuneReflectTurns") as number;
    
    if (oppDamageBoostTurns > 0 || oppDeepSeaTurns > 0 || oppPuniDamageAmplifyTurns > 0 || oppDeluNonTrueDmgBoostTurns > 0 || oppImmuneReflectTurns > 0 || (target.shield || 0) > 0) {
      cleared = true;
    }
    
    setOpponentState("DamageBoostTurns", 0);
    setOpponentState("DeepSeaTurns", 0);
    setOpponentState("PuniDamageAmplifyTurns", 0);
    setOpponentState("DeluNonTrueDmgBoostTurns", 0);
    setOpponentState("ImmuneReflectTurns", 0);
    target.shield = 0;
    
    if (cleared) {
      addLog(`🧹 【狻猊噬】破陣：成功消除對手回合類效果！`, "effect");
      target.currentHp = target.maxHp;
      addLog(`🩸 【狻猊噬】反噬：消除成功，恢復對手全部體力！`, "heal");
    }
    
    if (self.currentHp < self.maxHp) {
      const drain = Math.floor(target.maxHp / 3);
      const actualDrain = applyPinkDamage(actor === "p1" ? "p2" : "p1", drain, "狻猊噬(吸取)", activeP1, activeP2, "百分比傷害");
      self.currentHp = Math.min(self.maxHp, self.currentHp + actualDrain);
      addLog(`🩸 【狻猊噬】嗜血：自身體力未滿，吸取對手 ${actualDrain} 點體力！`, "heal");
      applyStatusWithImmunityCheck(actor === "p1" ? "p2" : "p1", "infected", 2);
    }
  },
  
  "負岳勢": (ctx) => {
    const { self, target, actor, setOpponentState, setPlayerState, addLog } = ctx;
    
    const myStages = { ...self.statStages };
    const oppStages = { ...target.statStages };
    let transferred = false;
    for (const key in myStages) {
      const k = key as keyof typeof myStages;
      if ((myStages[k] || 0) < 0) {
        const drop = myStages[k] || 0;
        oppStages[k] = Math.max(-6, (oppStages[k] || 0) + drop);
        myStages[k] = 0;
        transferred = true;
      }
    }
    if (transferred) {
      self.statStages = myStages as any;
      target.statStages = oppStages as any;
      setOpponentState("nextSkillInvalid", true);
      addLog(`📉 【負岳勢】重壓：將自身下降能力附加給對手，對手下回合技能無效！`, "effect");
    }
    
    let boost = 1;
    const hpDiff = self.currentHp - target.currentHp;
    if (hpDiff > 0) {
      boost += Math.floor(hpDiff / 1000000);
    }
    const newStages = { ...self.statStages };
    for (const key in newStages) {
      const k = key as keyof typeof newStages;
      newStages[k] = Math.min(6, (newStages[k] || 0) + boost);
    }
    self.statStages = newStages as any;
    addLog(`📈 【負岳勢】山岳：全屬性提升 ${boost} 級！`, "effect");
    
    setPlayerState("DamageBoostTurns", 2);
    setPlayerState("dmgDoubleTurns", 2);
    ctx.addTimerTo(actor, turnEffect("delu_damage_boost", "負岳勢-增傷", 2, { 
      payload: { double: true },
      displayChar: "增",
      description: "下 2 回合傷害提升 100%"
    }), ctx.goesFirst === false);
    
    self.priorityBoostTurns = 2;
    self.priorityBoostAmount = 2;
    addLog(`🦁 【負岳勢】：下 2 回合傷害提升 100%，先制 +2！`, "effect");
  },
  
  "目瘴淵禁": (ctx) => {
    const { self, target, actor, setPlayerState, setOpponentState, addLog, applyStatusWithImmunityCheck } = ctx;
    
    setPlayerState("ImmuneReflectTurns", 4);
    addLog(`🛡️ 【目瘴淵禁】深淵：4 回合內免疫並反彈所有異常！`, "effect");
    
    const wasPoisonedBefore = isStatusActive(target, "poisoned") || target.battleStatus === "poisoned";
    const poisonRes = applyStatusWithImmunityCheck(actor === "p1" ? "p2" : "p1", "poisoned", 2);
    
    if (!poisonRes.success || wasPoisonedBefore) {
      target.cannotUseAttackSkillsTurns = 2;
      addLog(`🚫 【目瘴淵禁】禁錮：未觸發中毒或對手已中毒，對手 2 回合內攻擊技能無效！`, "effect");
    }
    
    // We handle the conversion logic directly here instead of using convertElfStatus from BattleScreen
    if (isStatusActive(target, "poisoned") || target.battleStatus === "poisoned") {
      target.battleStatus = "infected";
      target.battleStatuses = target.battleStatuses || {};
      const turns = target.battleStatuses["poisoned"] || 2;
      delete target.battleStatuses["poisoned"];
      target.battleStatuses["infected"] = turns;
      addLog(`🦠 【目瘴淵禁】變異：將對手的異常轉化為「感染（控制類）」！`, "status");
    }
    
    self.drainHpSkillTurns = 3;
    self.drainHpSkillAmount = 1/3;
    addLog(`🩸 【目瘴淵禁】餘威：下 3 回合使用技能將吸取對手 ⅓ 體力！`, "effect");
  },
  
  "劫盡歸塵": (ctx) => {
    const { self, target, actor, setPlayerState, setOpponentState, addLog, applyStatusWithImmunityCheck, clearTurnEffectsOf, shuffleArray } = ctx;
    
    clearTurnEffectsOf(actor);
    clearTurnEffectsOf(actor === "p1" ? "p2" : "p1");
    addLog(`🧹 【劫盡歸塵】萬物歸塵：清除了雙方的回合類效果！`, "effect");
    
    const statuses: Array<"poisoned" | "frostbite" | "burned"> = ["poisoned", "frostbite", "burned"];
    statuses.forEach(s => {
      applyStatusWithImmunityCheck(actor === "p1" ? "p1" : "p2", s, 2, true);
      const res = applyStatusWithImmunityCheck(actor === "p1" ? "p2" : "p1", s, 2);
      if (res.immune) {
        addLog(`🛡️ 對手免疫「${s}」，【劫盡歸塵】觸發補償：令其「感染」！`, "status");
        applyStatusWithImmunityCheck(actor === "p1" ? "p2" : "p1", "infected", 2);
      }
    });
    addLog(`🔥 【劫盡歸塵】：使雙方同時陷入「中毒」、「凍傷」、「燒傷」！`, "status");
    
    setPlayerState("DeluStatusEndHeal", true);
    setPlayerState("immuneStatusCount", 2);
    setPlayerState("DeluNextStatusImmuneCount", 2);
    addLog(`🛡️ 【劫盡歸塵】：自身免疫下 2 次異常，免疫成功時恢復體力並造成傷害！`, "effect");
    
    if (target.skills) {
      let drained = 0;
      const shuffled = shuffleArray ? shuffleArray([...target.skills]) : [...target.skills].sort(() => Math.random() - 0.5);
      shuffled.forEach(s => {
        if (s.pp !== undefined && s.pp > 0 && drained < 3) {
          s.pp = 0;
          drained++;
        }
      });
      addLog(`📉 【劫盡歸塵】凋零：隨機扣除了對手 3 個技能的全部 PP！`, "effect");
    }
  },
  
  "辟冥·鎮獄斷": (ctx) => {
    const { self, target, actor, setPlayerState, addLog, applyStatusWithImmunityCheck } = ctx;
    
    const oppStages = { ...target.statStages };
    let cleared = false;
    for (const key in oppStages) {
      if ((oppStages[key as keyof typeof oppStages] || 0) > 0) {
        oppStages[key as keyof typeof oppStages] = 0;
        cleared = true;
      }
    }
    if (cleared) {
      target.statStages = oppStages as any;
      addLog(`🧹 【辟冥·鎮獄斷】破極：消除對手能力提升！`, "effect");
      const targetSide = actor === "p1" ? "p2" : "p1";
      applyStatusWithImmunityCheck(targetSide, "infected", 2);
      applyStatusWithImmunityCheck(targetSide, "ice_sealed", 2);
      applyStatusWithImmunityCheck(targetSide, "incinerated", 2);
      addLog(`🦠 【辟冥·鎮獄斷】威靈：依序為對手施加「感染」、「冰封」與「焚燼」狀態！`, "status");
    }
    
    if (target.currentHp > 0) {
      setPlayerState("DeluNextSkillPriorityBoost2", true);
    }
  }
};
