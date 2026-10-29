import { hasTurnEffect } from "../../../battle/timers";
import { multiplyDamageReduction, addDamageReduction } from '../../../battle/damageReduction';
import { BattleEventContext, BattleSkillHandler, EffectTiming } from "../../types";
import { isAbnormal } from "../../../utils/battleHelpers";
import { getMark } from "../../../battle/marks";

const POEM_DESCRIPTION = "紀錄持有者精靈的體力上限，當持有精靈死亡時，詩章將轉移給存活狀態的治癒.龍魂再臨 次元龍以增加其等量體力上限，治癒.龍魂再臨 次元龍若存在複數精靈則會同時轉移相同數量給予所有治癒.龍魂再臨 次元龍(每篇詩章獨立計算且無上限，下場後保留)";

export const handleDimensionalSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, addLog, applyTrueDamage, applyPinkDamage, applySkillTypeDamage, applyHeal, setMark, getMarks } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  const curMarks = getMarks ? getMarks(actor) : [];
  let poemMark = getMark(curMarks, "poem_chapter");
  
  if (!poemMark) {
    const initSnapshots = [self.maxHp || 1000];
    poemMark = {
      id: "poem_chapter",
      displayChar: "詩",
      count: 1,
      name: "詩章",
      description: POEM_DESCRIPTION,
      source: self.name,
      effects: { poemHpSnapshots: initSnapshots }
    };
    if (setMark) setMark(poemMark, actor);
  }

  const poemHpSnapshots = poemMark?.effects?.poemHpSnapshots || [self.maxHp || 1000];
  const stacks = poemHpSnapshots.length;
  const isDragonSoul = getPlayerState("dimensionalDragonSoul") || false;

  // 技能增傷只在本次行動有效（未命中、無效時不殘留）
  if (event === EffectTiming.AFTER_ACTION || event === EffectTiming.ROUND_END) {
    if ((getPlayerState("dragonSkillBoostsThisAction") || []).length) setPlayerState("dragonSkillBoostsThisAction", []);
  }
  switch (event) {
    case EffectTiming.ON_ENTRANCE:
      addLog(`🐉 【龍】：次元龍帝臨世！時空詩章共 ${stacks} 篇！`, "effect");
      break;

    case EffectTiming.BEFORE_ACTION:
      // 1:每有1篇詩章先制+1。
      if (extraData && stacks >= 1) {
        extraData.priority = (extraData.priority || 0) + stacks;
        if (isDragonSoul && ctx.skill?.name === "閱世") {
          extraData.priority += 999; // 龍魂:無視對手正先制等級 (高優先度)
        }
      }
      break;

    case EffectTiming.BEFORE_SKILL:
      // 2:使用技能無視PP值限制並吸取對手所有技能1點PP值
      if (stacks >= 2) {
        addLog(`🐉 【龍】：詩章之力充盈，吸取對手技能 1 點 PP！`, "effect");
        target.skills.forEach(s => {
          if (s.pp !== undefined && s.pp > 0) {
            s.pp = Math.max(0, s.pp - 1);
          }
        });
        // 無視 PP 限制：由 isZeroPpExempt（詩章≥2）判定，不再竄改技能 PP 值
      }
      break;

    case EffectTiming.ROUND_START: {
      /**
       * 2026-10-30：每回合疊加詩章。
       *
       * 魂印描述：「自身位於出戰背包內（無論是否為出戰/場下/額外精靈），
       * 敵我雙方所有精靈（無論是否為出戰/場下/額外精靈）所有回合開始效果時額外所有精靈附加 1 篇詩章」。
       *
       * 原本完全沒有這段，所以詩章永遠停在 1 篇（看起來像被鎖上限）。
       * 這裡在回合開始時，為雙方每一隻存活精靈各加 1 篇獨立詩章，
       * 並同步把該篇的體力上限加到持有者身上。
       */
      for (const sd of ["p1", "p2"] as const) {
        for (const e of ctx.getFullTeam?.(sd) || []) {
          if (e.isVanished || (e.currentHp || 0) <= 0) continue;
          const bid = String(e.battleId || e.id);
          const exist = (getMarks(sd) || []).find(m => m.id === "poem_chapter" && m.ownerBattleId === bid);
          const oldSnaps: number[] = exist?.effects?.poemHpSnapshots || [];
          const nextSnaps = [...oldSnaps, e.maxHp || 1000];
          ctx.setMark?.({
            id: "poem_chapter", displayChar: "詩", name: "詩章",
            count: nextSnaps.length,
            description: POEM_DESCRIPTION, source: self.name,
            scope: "elf", persistsOffField: true, clearable: false,
            ownerBattleId: bid,
            effects: { poemHpSnapshots: nextSnaps },
          } as any, sd);
          ctx.updateAnyElf?.(sd, bid, { maxHp: (e.maxHp || 0) + (e.maxHp || 1000) });
        }
      }
      // 重算自身詩章數（剛加過）
      const liveMarks = getMarks(actor) || [];
      const livePoem = getMark(liveMarks, "poem_chapter");
      const liveStacks = livePoem?.effects?.poemHpSnapshots?.length || 0;

      // 3:回合開始時解除自身所處的異常狀態，詩章大於3則自身免疫所有異常狀態
      if (liveStacks >= 3) {
        if (self.battleStatus && self.battleStatus !== "normal") {
          self.battleStatus = "normal";
          self.battleStatusDuration = 0;
          addLog(`🐉 【龍】：詩章共鳴（${liveStacks} 篇），解除自身所有異常狀態！`, "effect");
        }
      }
      if (liveStacks > 3) {
        setPlayerState("immuneStatusTurns", 1);
      }
      break;
    }

    case EffectTiming.BEFORE_DAMAGE:
      if (extraData?.isIncoming && String(extraData.damageCategory).startsWith("skill")) {
        // 5:每有1篇詩章，受到技能傷害減少10%
        if (stacks >= 5) {
          const reduction = Math.min(1.0, stacks * 0.10);
          multiplyDamageReduction(extraData, 1 - reduction);
          addLog(`🐉 【龍】：受到技能傷害減免 ${Math.round(reduction * 100)}%！`, "effect");
        }
        // 4:減少下次受到的技能傷害40% (配合每2篇+10%的額外加成)
        const nextRed = getPlayerState("dimensionalDmgReduction") || 0;
        if (nextRed > 0) {
          multiplyDamageReduction(extraData, 1 - nextRed);
          addLog(`🐉 【龍】：下次傷害減免觸發，減免 ${Math.round(nextRed * 100)}%！`, "effect");
          setPlayerState("dimensionalDmgReduction", 0);
        }
      } else if (!extraData?.isIncoming && extraData?.damageCategory === "skill_attack") {
        // 5:每有1篇詩章，攻擊傷害提升20%（只限攻擊技能）
        if (stacks >= 5) {
          extraData.increasePercent += stacks * 0.20;
        }
        // 技能本身的增傷（技能 handler 在傷害前執行並寫入，這裡消耗）
        const skillBoosts: number[] = getPlayerState("dragonSkillBoostsThisAction") || [];
        for (const b of skillBoosts) extraData.increasePercent += b;
        if (skillBoosts.length) setPlayerState("dragonSkillBoostsThisAction", []);
        // 8:無視對手攻擊免疫效果，無視傷害限制效果，無視成功時攻擊技能所造成的技能傷害提升100%
        if (stacks >= 8 && getPlayerState("attackImmunityIgnoredThisAction")) {
          extraData.increasePercent += 1;
          addLog(`🐉 【詩章8】：無視攻擊免疫成功，技能傷害提升100%！`, "effect");
        }
        // 6:雙方每有50點精靈護盾、精靈護罩，自身攻擊技能威力額外提升50點
        if (stacks >= 6) {
          const totalShield = (self.shield || 0) + (self.barrier || 0) + (target.shield || 0) + (target.barrier || 0);
          const powerBoost = Math.floor(totalShield / 50) * 50;
          if (powerBoost > 0) {
            const basePower = ctx.skill?.power || 85;
            const ratio = (basePower + powerBoost) / basePower;
            extraData.multiplier *= ratio;
          }
        }
      }
      break;

    case EffectTiming.ON_SKILL_HIT:
      // 4:使用技能吸取對手最大體力的40%並減少下次受到的技能傷害40%；每持有2篇詩章效果吸取效果額外提升10%
      if (stacks >= 4) {
        const extraRatio = 0.40 + Math.floor(stacks / 2) * 0.10;
        const drainAmt = Math.floor(target.maxHp * extraRatio);
        const actualDrain = applyPinkDamage(oppSide, drainAmt, "詩章吸血");
        applyHeal(actor, actualDrain);
        setPlayerState("dimensionalDmgReduction", 0.4);
        addLog(`🐉 【龍】：吸取對手最大體力 ${Math.round(extraRatio * 100)}% (${actualDrain} 點)，下次受到技能傷害減少40%！`, "effect");
      }
      break;

    case EffectTiming.AFTER_DAMAGE:
      // 9:為自身賦予等於自身攻擊傷害的護盾與護罩(可疊加無上限)
      if (stacks >= 9 && extraData?.side !== actor && extraData?.amount > 0) {
        const dmg = extraData.amount;
        self.shield = (self.shield || 0) + dmg;
        self.barrier = (self.barrier || 0) + dmg;
        addLog(`🐉 【龍】：獲得等同於攻擊傷害 ${dmg} 點的護盾與護罩！`, "heal");
      }
      break;

    case EffectTiming.AFTER_ATTACK_HIT: {
      const factor = Number(ctx.getPlayerState("wangshiHealFactor") || 0);
      if (factor > 0 && Number(extraData?.damage) > 0) ctx.applyHeal(ctx.actor, Math.floor(Number(extraData.damage) * factor));
      break;
    }
    case EffectTiming.AFTER_ACTION:
      if (getPlayerState("wangshiHealFactor")) setPlayerState("wangshiHealFactor", 0);
      if (extraData?.actor === actor) {
        // 7:攻擊附加雙方體力差值的真實傷害
        if (stacks >= 7) {
          const diff = Math.abs((self.currentHp || 0) - (target.currentHp || 0));
          if (diff > 0) {
            applyTrueDamage(oppSide, diff, "體力差值真傷");
          }
        }
        // 10以上:攻擊附加等同對方最大體力值的技能傷害
        if (stacks >= 10) {
          applySkillTypeDamage(oppSide, target.maxHp, "終章最大體力技能傷害", { node: "attack_damage" });
        }
      }
      break;

    case EffectTiming.FATAL_RESIST: {
      const used = getPlayerState("dimensionalFatalResistUsed");
      if (!used) {
        setPlayerState("dimensionalFatalResistUsed", true);
        setPlayerState("dimensionalDragonSoul", true);
        self.currentHp = 1;
        self.battleStatus = "normal";
        self.battleStatusDuration = 0;
        setPlayerState("immuneStatusTurns", 1);
        addLog(`🐉 【龍魂再臨】：受到致死傷害觸發！保留 1 點體力，解控免控並覺醒【龍魂】！`, "effect");
        if (extraData) extraData.survived = true;
        return true;
      }
      return false;
    }

    /**
     * 2026-10-30：詩章的死亡轉交與消逝。
     *
     * 描述：「當持有精靈死亡時，詩章將轉移給存活狀態的治癒.龍魂再臨 次元龍以增加其等量體力上限，
     * 若存在複數精靈則會同時轉移相同數量給予所有治癒.龍魂再臨 次元龍（每篇詩章獨立計算且無上限，下場後保留）」
     *
     * 原本完全沒有這段實作，所以死亡時詩章不會轉交、原持有精靈也不會消逝。
     */
    case EffectTiming.DEATH_NODE_1: {
      const deadMarks = getMarks(actor) || [];
      const deadPoem = getMark(deadMarks, "poem_chapter");
      const snapshots: number[] = deadPoem?.effects?.poemHpSnapshots || [];
      if (!snapshots.length) return false;

      const deadName = self.name;
      // 找出所有「治癒.龍魂再臨 次元龍」接收者（含場下存活）
      const receivers: { side: "p1" | "p2"; elf: any }[] = [];
      for (const sd of ["p1", "p2"] as const) {
        for (const e of ctx.getFullTeam?.(sd) || []) {
          if (e === self || e.isVanished) continue;
          if ((e.currentHp || 0) <= 0) continue;
          const n = String(e.name || "");
          if (n.includes("次元龍") || n.includes("龍魂再臨")) receivers.push({ side: sd, elf: e });
        }
      }

      if (receivers.length) {
        const total = snapshots.reduce((n, v) => n + (Number(v) || 0), 0);
        for (const r of receivers) {
          // 每篇詩章獨立計算：逐篇加到接收者的體力上限
          ctx.updateAnyElf?.(r.side, String(r.elf.battleId || r.elf.id), { maxHp: (r.elf.maxHp || 0) + total });
          const exist = (getMarks(r.side) || []).find(m => m.id === "poem_chapter" && m.ownerBattleId === String(r.elf.battleId || r.elf.id));
          const old = exist?.effects?.poemHpSnapshots || [];
          ctx.setMark?.({
            id: "poem_chapter", displayChar: "詩", name: "詩章",
            count: old.length + snapshots.length,
            description: POEM_DESCRIPTION, source: deadName,
            scope: "elf", persistsOffField: true, clearable: false,
            ownerBattleId: String(r.elf.battleId || r.elf.id),
            effects: { poemHpSnapshots: [...old, ...snapshots] },
          } as any, r.side);
          addLog(`🐉 【詩章】：${deadName} 陣亡，${snapshots.length} 篇詩章轉交 ${r.elf.name}，體力上限 +${total}！`, "effect");
        }
      }

      // 轉交後原持有精靈消逝（只清詩章，避免波及其他印記）
      ctx.clearMark?.("poem_chapter", actor, String(self.battleId || self.id));
      if (receivers.length) {
        ctx.updateAnyElf?.(actor, String(self.battleId || self.id), { isVanished: true } as any);
        addLog(`🐉 【詩章】：詩章已轉交，${deadName} 消逝。`, "effect");
      }
      return true;
    }
  }

  return false;
};

export const DIMENSIONAL_SKILLS: Record<string, BattleSkillHandler> = {
  "閱世": (ctx) => {
    const { self, target, actor, setPlayerState, getPlayerState, addLog, clearTurnEffectsOf } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const isDragonSoul = getPlayerState("dimensionalDragonSoul") || false;

    addLog(`🐉 使用【閱世】：閱盡紅塵萬載，洞悉因果！`, "effect");

    // 若對手處於回合類效果則傷害提升100%並消除回合類效果（龍魂：傷害額外提升100%）
    const oppTimers = (oppSide === "p1" ? ctx.p1Timers : ctx.p2Timers) || [];
    const boosts: number[] = [];
    if (hasTurnEffect(oppTimers) || ((target as any).turnEffects?.length > 0)) {
      boosts.push(1);
      clearTurnEffectsOf(oppSide, target);
      addLog(`🐉 【閱世】：對手處於回合類效果，傷害提升100%並消除！`, "effect");
    }
    if (isDragonSoul) boosts.push(1);
    setPlayerState("dragonSkillBoostsThisAction", boosts);

    // 吸取能力提升
    let sucked = false;
    if (target.statStages) {
      const newSelfStages = { ...self.statStages };
      const newTargetStages = { ...target.statStages };
      for (const k of Object.keys(newTargetStages)) {
        const key = k as keyof typeof newTargetStages;
        if ((newTargetStages[key] || 0) > 0) {
          newSelfStages[key] = Math.min(6, (newSelfStages[key] || 0) + (newTargetStages[key] || 0));
          newTargetStages[key] = 0;
          sucked = true;
        }
      }
      self.statStages = newSelfStages as any;
      target.statStages = newTargetStages as any;
    }

    if (sucked) {
      ctx.setOpponentState("sealPropertyTurns", 2); // 封屬（設在對手身上＝對手的屬性技能無效）
      addLog(`🐉 【閱世】：吸取對手能力提升，並令對手下 2 次屬性技能無效！`, "effect");
    } else {
      const newSelfStages = { ...self.statStages };
      for (const k of ["atk", "def", "spatk", "spdef", "speed", "accuracy"]) {
        newSelfStages[k as keyof typeof newSelfStages] = Math.min(6, (newSelfStages[k as keyof typeof newSelfStages] || 0) + 1);
      }
      self.statStages = newSelfStages as any;
      addLog(`🐉 【閱世】：未能吸取強化，轉為自身全屬性 +1！`, "effect");
    }

    if (isDragonSoul) addLog(`🐉 【閱世】(龍魂)：傷害額外提升 100%！`, "effect");
  },

  "敕界歸元": (ctx) => {
    const { self, target, actor, setPlayerState, getPlayerState, addLog, applyStatusWithImmunityCheck, setMark, getMarks } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const isDragonSoul = getPlayerState("dimensionalDragonSoul") || false;

    addLog(`🐉 使用【敕界歸元】：敕令世界法則，萬法歸元！`, "effect");
    setPlayerState("immuneStatusTurns", 5); // 5回合免控

    const res = applyStatusWithImmunityCheck(oppSide, "害怕", 1);
    if (!res.success) {
      const poemMark = getMark(getMarks(actor), "poem_chapter");
      const snapshots = poemMark?.effects?.poemHpSnapshots || [self.maxHp];
      const newSnapshots = [...snapshots, self.maxHp];
      setMark({
        id: "poem_chapter",
        displayChar: "詩",
        count: newSnapshots.length,
        name: "詩章",
        description: POEM_DESCRIPTION,
        source: self.name,
        // 2026-10-30：補 ownerBattleId。原本沒帶，ctx.setMark 會用 bindMarkToElf 綁，
        // 但若同一精靈先前已由別的來源（積木）建立過印記，鍵不同就會出現兩個同名詩章。
        ownerBattleId: String(self.battleId || self.id),
        scope: "elf", persistsOffField: true, clearable: false,
        effects: { poemHpSnapshots: newSnapshots }
      }, actor);
      addLog(`🐉 【敕界歸元】：對手免控，未觸發害怕，轉為自身附加 1 篇詩章！`, "effect");
    }

    // 3回合內對手使用屬性技能後吸取生命
    setPlayerState("chijieDrainTurns", 3);

    if (isDragonSoul) {
      if (isAbnormal(target)) {
        setPlayerState("immuneStatusTurns", (getPlayerState("immuneStatusTurns") || 0) + 2);
        addLog(`🐉 【敕界歸元】(龍魂)：對手處於異常狀態，自身免疫下 2 次異常狀態！`, "effect");
      } else {
        setPlayerState("dmgBarrier", 10000); // 1回合抵擋非真實傷害
        addLog(`🐉 【敕界歸元】(龍魂)：對手無異常，1回合內自身抵擋所有非真實傷害！`, "effect");
      }
    }
  },

  "告命詩途": (ctx) => {
    const { self, target, actor, setPlayerState, getPlayerState, addLog, applyPinkDamage, applyHeal, setMark, getMarks } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const isDragonSoul = getPlayerState("dimensionalDragonSoul") || false;

    const poemMark = getMark(getMarks(actor), "poem_chapter");
    const p = poemMark?.effects?.poemHpSnapshots?.length || 0;
    const boost = p > 0 ? 2 : 1;

    addLog(`🐉 使用【告命詩途】：翻開命運詩篇，宣告終途！`, "effect");
    // 下2回合對手受到的攻擊傷害提升150%（引擎讀取 attackTakenBoostTurns／Rate，設在對手）
    ctx.setOpponentState("attackTakenBoostRate", 1.5);
    ctx.setNextTurns?.("opp", "attackTakenBoostTurns", 2);

    const newSelfStages = { ...self.statStages };
    for (const k of ["atk", "def", "spatk", "spdef", "speed", "accuracy"]) {
      newSelfStages[k as keyof typeof newSelfStages] = Math.min(6, (newSelfStages[k as keyof typeof newSelfStages] || 0) + boost);
    }
    self.statStages = newSelfStages as any;

    if (p === 0) {
      const newSnapshots = [self.maxHp, self.maxHp, self.maxHp, self.maxHp];
      setMark({
        id: "poem_chapter",
        displayChar: "詩",
        count: 4,
        name: "詩章",
        description: POEM_DESCRIPTION,
        source: self.name,
        ownerBattleId: String(self.battleId || self.id),
        scope: "elf", persistsOffField: true, clearable: false,
        effects: { poemHpSnapshots: newSnapshots }
      }, actor);
      addLog(`🐉 【告命詩途】：自身無詩章，為自身書寫 4 篇詩章！`, "effect");
    }

    const drainRatio = p > 3 ? 2/3 : 1/3;
    const drainAmt = Math.floor(target.maxHp * drainRatio);
    const actual = applyPinkDamage(oppSide, drainAmt, "告命詩途");
    applyHeal(actor, actual);

    setPlayerState("priorityBoostTurns", 2);
    setPlayerState("priorityBoostAmount", p > 0 ? 3 : 2);

    if (isDragonSoul) {
      let oppPp = 0;
      target.skills.forEach(s => { oppPp += (s.pp || 0); });
      let dmg = oppPp * 50;

      let fullPpCount = 0;
      self.skills.forEach(s => { if (s.pp === s.maxPp) fullPpCount++; });
      target.skills.forEach(s => { if (s.pp === s.maxPp) fullPpCount++; });

      if (fullPpCount > 0) dmg *= Math.pow(2, fullPpCount);
      // 「附加50點次元龍系技能傷害」：直接造成 X 系技能傷害（吃次元龍系克制），不是粉傷。
      ctx.applySkillTypeDamage(oppSide, dmg, "告命詩途(龍魂)", { elem: "次元龍" } as any);
    }
  },

  "神懺福音之章": (ctx) => {
    const { self, target, actor, setPlayerState, getPlayerState, addLog, applyPinkDamage } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const isDragonSoul = getPlayerState("dimensionalDragonSoul") || false;

    addLog(`🐉 使用【神懺福音之章】：神明懺悔之音，福音唱罷！`, "effect");

    let hasDebuff = false;
    if (self.statStages) {
      for (const val of Object.values(self.statStages)) {
        if (val < 0) hasDebuff = true;
      }
    }

    if (hasDebuff) {
      setPlayerState("nextAttackInvalid", true);
      addLog(`🐉 【神懺福音之章】：自身有能力下降，令對手下回合攻擊無效！`, "effect");
    }

    if (target.currentHp > 0) {
      setPlayerState("priorityBoostTurns", 2);
      setPlayerState("priorityBoostAmount", 2);
    }

    if (isDragonSoul) {
      let totalPp = 0;
      self.skills.forEach(s => { totalPp += (s.pp || 0); });
      target.skills.forEach(s => { totalPp += (s.pp || 0); });
      let dmg = totalPp * 50;

      const oppAllFull = target.skills.every(s => s.pp === s.maxPp);
      if (oppAllFull) dmg *= 2;

      applyPinkDamage(oppSide, dmg, "神懺福音(龍魂)");
      setPlayerState("dimensionalNextKillFullHeal", true);
    }
  },

  // 遺典.妄世律裁已遷真 Kit（migratedDimensionalWangshiKit.ts；DSH 20261018）——規則3.3 由技能表移除。
};

export const DIMENSIONAL_SKILLS_SKILLS = DIMENSIONAL_SKILLS;
