import { Elf } from '../types';
import { BattleEventContext, EffectTiming } from '../effects/types';
import { getElfAdvancedMechanics, hasAuthoredAdvancedMechanic, AdvancedTraitMechanics } from '../data/traitsRegistry';
import { isStatusActive } from './statusManager';
import { getStatuses } from './battleHelpers';
import { checkControlImmunity } from '../effects/ailmentEngine';
import { StatusRegistry } from '../effects/statusRegistry';
import { sameStatus, canonicalStatusName } from '../effects/statusIdentity';
import { getTypeMatchup } from './statCalculator';
import { applyAdvancedDamageModifiers } from '../battle/advancedDamageModifiers';
import { reductionPolicy } from '../battle/damageReduction';
import { distinctStoneCount, hasStoneThrowerMythic, isSkillStone } from '../data/skillStones';
import { alive, changePp, identity } from '../effects/newElfOperations';
import { skillSlot } from '../battle/skillSlot';
import { createExtraElf } from './extraElf';
import { clearStatuses } from '../effects/semanticOperations';
import { getMaxPp } from './battleHelpers';
import {runFinalExtraSoulLifecycle} from '../battle/finalExtraSoulMechanics';

const authoredCompanion=(elf:any)=>hasAuthoredAdvancedMechanic(elf,'cyberWraithSummon');
const ownedCompanion=(ctx:BattleEventContext)=>(ctx.getFullTeam(ctx.actor)||[]).find(e=>e.isExtra&&
  e.summonerId===identity(ctx.self)&&(e as any).mechanicRole==='curse_companion'&&!e.isVanished&&e.currentHp>0);
let repairDepth=0;

function wraithOwnerOnField(ctx: BattleEventContext): boolean {
  const active = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
  return !!active && alive(ctx.self) && identity(ctx.self) === identity(active);
}

export class TraitsEngine {
  /**
   * 判定並套用：當精靈登場 (ON_ENTRANCE) 時的特質效果
   */
  static triggerOnEntrance(ctx: BattleEventContext) {
    const mechanics = getElfAdvancedMechanics(ctx.self);
    const selfSide = ctx.actor; // "p1" or "p2"
    const elfName = ctx.self.name;

    // 1. 【咒術師】召喚賽博怨靈
    if (mechanics.cyberWraithSummon) {
      ctx.setPlayerState(`${selfSide}_cyberWraithActive`, true);
      ctx.setPlayerState(`${selfSide}_cyberWraithHp`, ctx.self.maxHp);
      ctx.setPlayerState(`${selfSide}_cyberWraithMaxHp`, ctx.self.maxHp);
      ctx.setPlayerState(`${selfSide}_cyberWraithHasSubbed`, false); // 每場登場限1次替死
      ctx.addLog(`👻 【${elfName}】的【咒術師】特質發動！召喚與自身能力值相等的「賽博怨靈」降臨戰場！`, "effect");
      if(authoredCompanion(ctx.self)){
        // 本體只繼承能力值；不繼承持有者的 Kit、身分或異常。每次登場重新建立一次。
        const existing=ownedCompanion(ctx);if(existing)ctx.vanishElf(selfSide,existing);
        ctx.addExtraElf(selfSide,createExtraElf(ctx.self,{
          name:'賽博怨靈',type:'機械.暗影',maxHp:ctx.self.maxHp,currentHp:ctx.self.maxHp,
          calculatedStats:{...ctx.self.calculatedStats},mechanicRole:'curse_companion',
          soulMark:{name:'額外精靈',description:'與召喚者能力值相同；特防持續同步；召喚者下場時消逝。',effectType:'none',effectValue:0},
        } as any));
        ctx.setPlayerState(`${selfSide}_cyberWraithRegistryManaged`,false);
        ctx.setPlayerState(`${selfSide}_wraithSubUsed`,false);
        ctx.setPlayerState(`${selfSide}_wraithDamageDoubled`,false);
      }
    }
    if(mechanics.enterGainConceal)ctx.updateElf(selfSide,{isConcealed:true});

    // 3. 【投石者】檢查 4 個技能石並激活神話狀態
    if (mechanics.isStoneThrower) {
      const stoneCount = distinctStoneCount(ctx.self);
      ctx.setPlayerState(`${selfSide}_stoneCount`, stoneCount);
      if (stoneCount >= 4 && !isStatusActive(ctx.self, '神話')) {
        const result = ctx.applyStatusWithImmunityCheck(selfSide, '神話', 999);
        if (result.success) {
          ctx.addLog(`🔮 【${elfName}】攜帶了 4 個技能石，解鎖特質【神話】狀態！免疫所有異常、能力下降，且 PP 值無限！`, "effect");
        }
      }
    }
  }

  /**
   * 判定並套用：當精靈下場 (SWITCH_OUT) 時的特質效果
   */
  static triggerOnSwitchOut(ctx: BattleEventContext,incomingElf?:any) {
    const mechanics = getElfAdvancedMechanics(ctx.self);
    const selfSide = ctx.actor;
    const elfName = ctx.self.name;

    // 1. 【咒術師】下場怨靈死亡並消逝
    if (mechanics.cyberWraithVanishOnSwitch) {
      const active = ctx.getPlayerState(`${selfSide}_cyberWraithActive`);
      if (active) {
        ctx.setPlayerState(`${selfSide}_cyberWraithActive`, false);
        ctx.addLog(`💨 【${elfName}】被召回，召喚的「賽博怨靈」隨之消逝在虛空中...`, "info");
      }
      if(authoredCompanion(ctx.self)){
        const extra=ownedCompanion(ctx);if(extra){ctx.updateAnyElf(selfSide,identity(extra),{currentHp:0});ctx.vanishElf(selfSide,extra);}
        ctx.setPlayerState(`${selfSide}_wraithCastSpellPending`,false);
      }
    }

    // 2. 【戰士】下場，恢復下一隻出戰精靈 PP 並附加隱匿印記
    if (mechanics.switchOutInheritConceal) {
      ctx.setPlayerState(`${selfSide}_isConcealed`, false);
      
      // 計算己方隊伍中目前已獲得隱匿的精靈數 (安全閥：不超過 3 個)
      const team = ctx.getEligibleTeam(selfSide);
      const concealCount = team.filter((e: any) => e.isConcealed || isStatusActive(e, 'concealed')).length;

      if (concealCount <= 3) {
        if(incomingElf){
          changePp(ctx,selfSide,incomingElf,s=>getMaxPp(s,incomingElf),true,'restore');
          ctx.updateAnyElf(selfSide,identity(incomingElf),{isConcealed:true});
        }else ctx.setPlayerState(`${selfSide}_nextElfGainConcealAndPP`, true);
        ctx.addLog(`🔄 【${elfName}】退場！【戰士】傳承激活：恢復下一隻精靈所有技能 PP 值並附加【隱匿印記】！`, "effect");
      }
    }
  }

  /** 共用生命週期入口；由 SoulMarkRegistry 的正式 dispatcher 呼叫，與舊魂印是否存在無關。 */
  static triggerAuthoredLifecycle(ctx:BattleEventContext,event:EffectTiming|string,data?:any):void {
    runFinalExtraSoulLifecycle(ctx);
    if(event===EffectTiming.ON_SWITCH_OUT&&(hasAuthoredAdvancedMechanic(ctx.self,'switchOutInheritConceal')||authoredCompanion(ctx.self)))
      this.triggerOnSwitchOut(ctx,data?.incomingElf);
    const mechanics=getElfAdvancedMechanics(ctx.self);
    if(authoredCompanion(ctx.self)&&mechanics.cyberWraithSummon){
      const companion=ownedCompanion(ctx);
      if(companion&&event===EffectTiming.ENFORCE&&companion.calculatedStats.spdef!==ctx.self.calculatedStats.spdef)
        ctx.updateAnyElf(ctx.actor,identity(companion),{calculatedStats:{...companion.calculatedStats,spdef:ctx.self.calculatedStats.spdef}});
      if(companion&&mechanics.wraithExistCurseNoReduce&&event===EffectTiming.BEFORE_STATUS_TICK&&/詛咒|curse/i.test(data?.status||''))data.skipTick=true;
    }
    if(event!==EffectTiming.SELF_STATUS_APPLIED||repairDepth||!data?.status)return;
    const entry=StatusRegistry[canonicalStatusName(data.status)]||StatusRegistry[data.status];
    if(!entry?.categories.includes('EVOLUTIONARY'))return;
    const transforms=entry.mechanics?.filter(m=>m.type==='EVOLUTION_TRANSFORM')||[];
    if(!transforms.length)return;
    const target=ctx.self;
    const owners=ctx.getFullTeam(ctx.actor).filter(e=>identity(e)!==identity(target)&&alive(e)&&
      getElfAdvancedMechanics(e).repairOnOtherDeriveStatus&&hasAuthoredAdvancedMechanic(e,'repairOnOtherDeriveStatus'));
    if(!owners.length)return;
    repairDepth++;
    try{
      clearStatuses(ctx,ctx.actor,target,name=>sameStatus(name,data.status));
      for(const transformation of transforms){
        const p=transformation.params||{};
        const next=p.nextStatus||(p.randomPool?.length?p.randomPool[Math.floor((ctx.rng||Math.random)()*p.randomPool.length)]:undefined);
        if(p.statDebuff)ctx.applyStatChange(ctx.actor,p.statDebuff);
        if(next)ctx.applyStatusWithImmunityCheck(ctx.actor,next,p.nextDuration||3);
      }
      for(const owner of owners){
        const config=getElfAdvancedMechanics(owner);
        for(const member of [owner,target]){
          const amount=config.repairHealAmount||0;
          ctx.applyHealToElf?.(ctx.actor,identity(member),amount);
          changePp(ctx,ctx.actor,member,s=>Math.min(getMaxPp(s,member),s.pp+(config.repairPpRestore||0)),true,'restore');
        }
      }
    }finally{repairDepth--;}
  }

  /**
   * 判定並套用：當精靈受到異常狀態時的特質干預 (無我、投石者、戰士等免疫判定)
   * 返回 true 表示異常被成功免疫或轉化，阻止原本的狀態附加
   */
  static filterStatusInflict(ctx: BattleEventContext, side: "p1" | "p2", status: string, duration: number): { handled: boolean, overrideStatus?: string, overrideDuration?: number } {
    const targetElf = side===ctx.actor?ctx.self:side===ctx.targetSide?ctx.target:side==='p1'?ctx.activeP1:ctx.activeP2;
    const mechanics = getElfAdvancedMechanics(targetElf);
    const stateSide = side;

    const statusEntry = StatusRegistry[canonicalStatusName(status)] || StatusRegistry[status];
    const isAuxiliaryOrBoss = statusEntry?.categories?.some(c => c === 'AUXILIARY' || c === 'BOSS_ONLY' || c === 'NO_EFFECT');

    // 0.00 恐懼之種/恐懼之花免疫
    const targetMarks = ctx.getMarks(side) || [];
    const seedMark = targetMarks.find(m => m.id === "fear_seed");
    if (seedMark && (status === "害怕" || status === "feared")) {
      // 寫到持有印記的一方（戰鬥引擎在其出手時讀 fearSeedDrainPP／fearSeedDrainReason）。
      // 過去寫成 setPlayerState(regKey, {...})，鍵落在巢狀物件裡，引擎讀不到（2026-10-10 修正）。
      const setSide = side === ctx.actor ? ctx.setPlayerState : ctx.setOpponentState;
      setSide("fearSeedDrainPP", true);
      setSide("fearSeedDrainReason", "恐懼之種");
      ctx.addLog(`😨 【恐懼之種】：免疫害怕，但將令技能PP歸零！`, "effect");
      return { handled: true };
    }

    const flowerMark = targetMarks.find(m => m.id === "fear_flower");
    if (flowerMark && !isAuxiliaryOrBoss) {
      ctx.addLog(`🌸 【恐懼之花】：無法附加異常狀態【${status}】！`, "status");
      return { handled: true };
    }

    // 0.0 控制類異常專屬免疫 (奧丁決鬥場地、魔王咒怨5層、控免回合等)
    const controlCheck = checkControlImmunity(ctx, side, status);
    if (controlCheck.immune) {
      ctx.addLog(controlCheck.reason || `🛡️ 【免疫控制】：免疫了控制類異常【${status}】！`, "status");
      return { handled: true };
    }

    // 抗性骰判定 (附屬類、BOSS專用、無效果類不進行抗性骰判定)
    if (!isAuxiliaryOrBoss) {
      const resistCfg = targetElf.resistances?.statusResist;
      if (resistCfg?.slots) {
        const slot = resistCfg.slots.find(s => sameStatus(s.status, status));
        if (slot) {
          const totalRate = slot.rate + (resistCfg.allImmune ? 5 : 0);
          const rngFunc = ctx.rng || Math.random;
          if (rngFunc() * 100 < totalRate) {
            if (status === "窒息") {
              ctx.addLog(`💀 【抗性抵抗】：【${targetElf.name}】抵抗了窒息，但觸發了缺氧致死！`, "status");
              ctx.applyTrueDamage(side, targetElf.maxHp, "缺氧致死");
            }
            ctx.addLog(`🛡️ 【抗性抵抗】：【${targetElf.name}】抵抗了【${status}】，轉化為異常抵抗！`, "status");
            return { handled: true, overrideStatus: "異常抵抗", overrideDuration: 1 };
          }
        }
      }
    }

    // 0.0 次數級別異常狀態免疫 (如 沉寂・永夜悼亡)
    const immuneStatusCount = ctx.getPlayerState(`${side}_immuneStatusCount`) || 0;
    if (immuneStatusCount > 0) {
      ctx.setPlayerState(`${side}_immuneStatusCount`, immuneStatusCount - 1);
      ctx.addLog(`🛡️ 【異常免疫】：【${targetElf.name}】消耗 1 次免疫次數（剩餘 ${immuneStatusCount - 1} 次），免疫了 【${status}】！`, "status");
      return { handled: true };
    }

    // 0. 自身具備免疫並反彈所有異常狀態 (例如 靜刃止水)
    
    const immuneStatusTurns = ctx.getPlayerState(`${side}_immuneStatusTurns`) || ctx.getPlayerState("immuneStatusTurns") || ctx.getPlayerState("p1ImmuneStatusTurns") || 0;
    if (immuneStatusTurns > 0) {
      ctx.addLog(`🛡️ 【異常免疫】：【${targetElf.name}】處於免疫狀態 (剩餘 ${immuneStatusTurns} 回合)，免疫了 【${status}】！`, "status");
      return { handled: true };
    }
    const immuneAndReflectTurns = ctx.getPlayerState(`${side}_immuneAndReflectStatusTurns`) || ctx.getPlayerState("immuneAndReflectStatusTurns") || 0;
    if (immuneAndReflectTurns > 0) {
      ctx.addLog(`🛡️ 【免疫反彈】：【${targetElf.name}】處於免疫反彈狀態 (剩餘 ${immuneAndReflectTurns} 回合)，免疫了 【${status}】！`, "status");
      const oppSide = side === 'p1' ? 'p2' : 'p1';
      ctx.addLog(`⚡ 【免疫反彈】：反彈 【${status}】 異常狀態至對手！`, "status");
      // 避免反彈造成無窮遞迴
      const oppImmuneTurns = ctx.getPlayerState(`${oppSide}_immuneAndReflectStatusTurns`) || ctx.getPlayerState("immuneAndReflectStatusTurns") || 0;
      if (oppImmuneTurns <= 0) {
        ctx.applyStatusWithImmunityCheck(oppSide, status, duration);
      } else {
        ctx.addLog(`🛡️ 【免疫反彈】：對手同樣處於免疫反彈狀態，反彈被抵消。`, "status");
      }
      return { handled: true };
    }

    // 0.1 雙方無法附加任何異常狀態 (靜刃止水 解除成功後的真空領域)
    const preventStatusP1 = ctx.getPlayerState("p1_preventStatusInflict") || 0;
    const preventStatusP2 = ctx.getPlayerState("p2_preventStatusInflict") || 0;
    if (preventStatusP1 > 0 || preventStatusP2 > 0) {
      ctx.addLog(`🧘 【真空領域】：目前處於無法附加任何異常狀態的真空領域中，免疫了 【${status}】！`, "status");
      return { handled: true };
    }

    // 1. 【投石者】神話狀態免疫所有異常
    if (mechanics.isStoneThrower && status !== '神話') {
      const stoneCount = distinctStoneCount(targetElf);
      if (stoneCount >= 4) {
        ctx.addLog(`🛡️ 【${targetElf.name}】處於【神話】狀態下，免疫了 【${status}】 異常！`, "status");
        return { handled: true };
      }
    }

    // 3. 【無我】特質異常轉化為平靜
    if (mechanics.convertStatusToSerenity && status !== 'serenity' && status !== '平靜') {
      let finalDuration = duration;
      const isFurious = status === 'furious' || status === '狂暴' || status.includes('狂');
      if (isFurious && mechanics.doubleSerenityTurnsIfFurious) {
        finalDuration = duration * 2;
        ctx.addLog(`🧘 【${targetElf.name}】受到了帶有狂暴的異常【${status}】，觸發【無我】將其轉化並令【平靜】回合數翻倍！`, "effect");
      } else {
        ctx.addLog(`🧘 【${targetElf.name}】受到了異常【${status}】，觸發【無我】立即將其轉化為【平靜】狀態！`, "effect");
      }
      return { handled: true, overrideStatus: '平靜', overrideDuration: finalDuration };
    }

    return { handled: false };
  }

  /**
   * 判定並套用：傷害計算時 (防禦值與傷害加成判定點)
   */
  static modifyDefenseAndDamage(
    ctx: BattleEventContext,
    attacker: Elf,
    defender: Elf,
    baseDmg: number,
    skill: any
  ): { finalDamage: number, defenderDefenseOverride?: number } {
    const atkMechanics = getElfAdvancedMechanics(attacker);
    const defMechanics = getElfAdvancedMechanics(defender);
    let finalDamage = baseDmg;
    let defDefenseOverride: number | undefined = undefined;

    // 1. 【豪邁】忽略對手 50% 雙防值
    if (atkMechanics.ignoreDefPercent) {
      const isPhysical = skill.category === '物理' || skill.category === 'physical';
      const originalDef = isPhysical ? (defender.calculatedStats?.def || defender.baseStats.def) : (defender.calculatedStats?.spdef || defender.baseStats.spdef);
      defDefenseOverride = originalDef * (1 - atkMechanics.ignoreDefPercent);
      ctx.addLog(`🔥 【${attacker.name}】的【豪邁】特質觸發：忽略對手 50% 的防禦力進行攻擊！`, "effect");
    }

    // 2. 【戰士】弱點傷害計算：以對手雙防中較低者的 60% 作為防禦值
    if (atkMechanics.alwaysWeaknessDamage) {
      const originalDef = defender.calculatedStats?.def || defender.baseStats.def;
      const originalSpdef = defender.calculatedStats?.spdef || defender.baseStats.spdef;
      let lowerDefense = Math.min(originalDef, originalSpdef) * 0.6;

      // 若對方每存在 1 點護盾或 1% 減傷，對手剩餘雙防降低 1% (最低降至 1)
      const hasShield = (defender.shield || 0) + (defender.barrier || 0) > 0;
      if (hasShield) {
        lowerDefense = Math.max(1, lowerDefense * 0.4); // 額外大幅削防
      }
      
      defDefenseOverride = lowerDefense;
      ctx.addLog(`🎯 【${attacker.name}】的【戰士】特質：鎖定對手防禦弱點！始終以較低防禦力 60% 計算傷害！`, "effect");
    }

    // 舊相容入口共用新結算規則；主戰鬥管線不另外呼叫此方法，避免重複減傷。
    const side = ctx.actor === 'p1' ? 'p2' : 'p1';
    const category = skill.category === '屬性' ? 'skill_attribute' as const : 'skill_attack' as const;
    const comp = { base: finalDamage, increasePercent: 0, decreasePercent: 0, multiplier: 1, damageCategory: category,
      reductionPolicy: reductionPolicy({ p1Timers: ctx.p1Timers || [], p2Timers: ctx.p2Timers || [], p1Marks: ctx.getMarks('p1'), p2Marks: ctx.getMarks('p2') }, side, defender, category) };
    applyAdvancedDamageModifiers(comp, attacker, defender);
    finalDamage = comp.base * (1 + comp.increasePercent) * comp.multiplier;

    // 5. 【無序星魂使徒】對異能精靈造成傷害翻倍
    const isTargetAlien = defender.isAlienElf || defMechanics.alwaysAlienElf;
    if (atkMechanics.doubleDamageToAlienElf && isTargetAlien) {
      finalDamage = finalDamage * 2.0;
      ctx.addLog(`🌑 【${attacker.name}】的【無序星魂使徒】爆發！對異能精靈 【${defender.name}】 造成傷害翻倍！`, "damage");
    }

    return { finalDamage, defenderDefenseOverride: defDefenseOverride };
  }

  /**
   * 判定並套用：當精靈選擇技能並準備消耗 PP 時 (咒術師、投石者、修復等觸發)
   */
  static triggerBeforeAction(ctx: BattleEventContext) {
    if (!wraithOwnerOnField(ctx)) return;
    const mechanics = getElfAdvancedMechanics(ctx.self);
    const selfSide = ctx.actor;
    const elfName = ctx.self.name;

    // 投石者的 PP 無限由 isPpCostFree 判定，不改技能數字或第五技能 PP。

    // 2. 【咒術師】在詛咒狀態下，選擇技能時額外消耗該技能 1 點 PP
    if (mechanics.cursePpTax && ctx.skill) {
      const statuses = getStatuses(ctx.self);
      const hasCurse = Object.entries(statuses).some(([name,n])=>n>0&&/詛咒|curse/i.test(canonicalStatusName(name)));
      if (hasCurse) {
        if (ctx.getPlayerState('selectionPpTaxRound') === ctx.roundNumber) return;
        ctx.setPlayerState('selectionPpTaxRound', ctx.roundNumber);
        const slot = skillSlot(ctx.self, ctx.skill);
        if (slot < 0) return;
        changePp(ctx, selfSide, ctx.self, (s, i) => i === slot ? Math.max(0, s.pp - mechanics.cursePpTax) : s.pp);
        ctx.addLog(`👻 【${elfName}】處於【詛咒】狀態下，【咒術師】魂印額外消耗了該技能 1 點 PP 值！`, "effect");
        
        // 觸發賽博怨靈的行動魔咒準備
        ctx.setPlayerState(`${selfSide}_wraithCastSpellPending`, true);
      }
    }
  }

  /**
   * 判定並套用：行動階段結束時，呼叫賽博怨靈或投石者的額外行動效果
   */
  static triggerActionPhaseEnd(ctx: BattleEventContext) {
    if (!wraithOwnerOnField(ctx)) { ctx.setPlayerState(`${ctx.actor}_wraithCastSpellPending`, false); return; }
    const mechanics = getElfAdvancedMechanics(ctx.self);
    const selfSide = ctx.actor;
    const oppSide = selfSide === 'p1' ? 'p2' : 'p1';
    const elfName = ctx.self.name;

    // 1. 【咒術師】賽博怨靈發動魔咒
    if (mechanics.wraithActionSpell && (ctx.getPlayerState(`${selfSide}_cyberWraithActive`) || ctx.getPlayerState(`${selfSide}_wraithSubUsed`))) {
      const isPending = ctx.getPlayerState(`${selfSide}_wraithCastSpellPending`);
      if (isPending) {
        ctx.setPlayerState(`${selfSide}_wraithCastSpellPending`, false);
        
        // 魔咒主體是技能傷害；只有場下餘波才是真實傷害。
        const curseTurns = Math.max(0, ...Object.entries(ctx.getStatuses(ctx.self)).filter(([name]) => /詛咒|curse/i.test(name)).map(([, n]) => n));
        const n = curseTurns;
        const skillPower = ctx.skill?.power ?? 0;
        ctx.addLog(`👻 【咒術師】召喚的賽博怨靈於行動階段發動了【魔咒】！`, "effect");
        this.queueWraithExtraAction(ctx, `賽博怨靈·魔咒`, skillPower + n, n);
      }
    }

  }

  /** 主攻擊傷害結算後；場下傷害不再用威力估算，也不直接改隊員引用。 */
  static triggerSkillDamageSettled(ctx: BattleEventContext, damage: number) {
    const mechanics = getElfAdvancedMechanics(ctx.self);
    if (!mechanics.isStoneThrower || !isSkillStone(ctx.skill) || !(damage > 0)) return;
    const activeId = ctx.target.battleId || ctx.target.id;
    for (const member of ctx.getEligibleTeam(ctx.targetSide)) {
      if ((member.battleId || member.id) === activeId || member.currentHp <= 0) continue;
      const amount = Math.floor(damage * (mechanics.stoneUseOfffieldTrueDamagePercent || .25) * getTypeMatchup(ctx.skill.type, member.type));
      if (amount > 0) ctx.applyTrueDamageToElf?.(ctx.targetSide, member.battleId || member.id, amount, '真實傷害');
    }
  }

  static triggerBattlePhaseEnd(ctx: BattleEventContext) {
    const mechanics = getElfAdvancedMechanics(ctx.self);
    if (mechanics.turnEndHeal4Stones && hasStoneThrowerMythic(ctx.self) && ctx.self.currentHp > 0) {
      ctx.applyHeal(ctx.actor, Math.floor(ctx.self.maxHp * mechanics.turnEndHeal4Stones));
    }
    if(authoredCompanion(ctx.self)&&wraithOwnerOnField(ctx)&&mechanics.wraithEndSpellIfNoSkill&&
      (ownedCompanion(ctx)||ctx.getPlayerState(`${ctx.actor}_wraithSubUsed`))&&
      (!ctx.skill||['待機','使用道具','切換精靈'].includes(ctx.skill.name))){
      const n=Math.max(0,...Object.entries(ctx.getStatuses(ctx.self)).filter(([name])=>/詛咒|curse/i.test(name)).map(([,v])=>v));
      this.queueWraithExtraAction(ctx,'賽博怨靈·滅靈魔咒',Math.max(0,...ctx.self.skills.map(s=>s.power||0))+n,n);
    }
  }

  /**
   * 判定並套用：戰鬥階段結束 (ROUND_END) 時的效果
   */
  static triggerRoundEnd(ctx: BattleEventContext) {
    const mechanics = getElfAdvancedMechanics(ctx.self);
    const selfSide = ctx.actor;
    const elfName = ctx.self.name;

    // 投石者的恢復改由 BATTLE_PHASE_END 經正常恢復管線執行一次。

    // 2. 【咒術師】若未選擇使用技能，發動 1 次滅靈魔咒
    if (!authoredCompanion(ctx.self) && wraithOwnerOnField(ctx) && mechanics.wraithEndSpellIfNoSkill && (ctx.getPlayerState(`${selfSide}_cyberWraithActive`) || ctx.getPlayerState(`${selfSide}_wraithSubUsed`))) {
      const selectedNoSkill = !ctx.skill || ctx.skill.name === '待機' || ctx.skill.name === '使用道具' || ctx.skill.name === '切換精靈';
      if (selectedNoSkill) {
        ctx.addLog(`🌌 【${elfName}】當前回合未選擇主動使用技能，賽博怨靈發動了【滅靈魔咒】！`, "effect");
        const curseTurns = Math.max(0, ...Object.entries(ctx.getStatuses(ctx.self)).filter(([name]) => /詛咒|curse/i.test(name)).map(([, n]) => n));
        const n = curseTurns;
        // 威力取最高技能威力
        const maxPower = Math.max(0, ...ctx.self.skills.map(s => s.power || 0));
        this.queueWraithExtraAction(ctx, `賽博怨靈·滅靈魔咒`, maxPower + n, n);
      }
    }

    // 3. 靜刃止水 / 異常狀態免疫反彈與技能附加效果失效回合遞減
    const immuneAndReflectTurns = ctx.getPlayerState(`${selfSide}_immuneAndReflectStatusTurns`) || ctx.getPlayerState("immuneAndReflectStatusTurns") || 0;
      const immuneStatDownTurns = ctx.getPlayerState("immuneStatDownTurns") || 0;
      if (immuneStatDownTurns > 0) {
        ctx.setPlayerState("immuneStatDownTurns", immuneStatDownTurns - 1);
      }
      const immuneStatusTurns = ctx.getPlayerState(`${selfSide}_immuneStatusTurns`) || ctx.getPlayerState("immuneStatusTurns") || 0;
      if (immuneStatusTurns > 0) {
        const nextTurns = immuneStatusTurns - 1;
        ctx.setPlayerState(`${selfSide}_immuneStatusTurns`, nextTurns);
        ctx.setPlayerState("immuneStatusTurns", nextTurns);
        if (nextTurns === 0) {
           ctx.addLog(`💨 【狀態結束】：【${elfName}】的免疫異常狀態已結束。`, "effect");
        }
      }
    if (immuneAndReflectTurns > 0) {
      const nextTurns = immuneAndReflectTurns - 1;
      ctx.setPlayerState(`${selfSide}_immuneAndReflectStatusTurns`, nextTurns);
      ctx.setPlayerState("immuneAndReflectStatusTurns", nextTurns);
      if (nextTurns === 0) {
        ctx.addLog(`🧘 【靜刃止水】：免疫反彈異常狀態效果已結束。`, "info");
      }
    }

    const preventStatusP1 = ctx.getPlayerState("p1_preventStatusInflict") || 0;
    const preventStatusP2 = ctx.getPlayerState("p2_preventStatusInflict") || 0;
    if (selfSide === "p1" && preventStatusP1 > 0) {
      const nextTurns = preventStatusP1 - 1;
      ctx.setPlayerState("p1_preventStatusInflict", nextTurns);
      if (nextTurns === 0) {
        ctx.addLog(`🧘 【靜刃止水】：無法附加異常狀態的真空領域 (P1) 已結束。`, "info");
      }
    }
    if (selfSide === "p2" && preventStatusP2 > 0) {
      const nextTurns = preventStatusP2 - 1;
      ctx.setPlayerState("p2_preventStatusInflict", nextTurns);
      if (nextTurns === 0) {
        ctx.addLog(`🧘 【靜刃止水】：無法附加異常狀態的真空領域 (P2) 已結束。`, "info");
      }
    }

    const sealAddEffects = ctx.getPlayerState(`${selfSide}_sealSkillAdditionalEffects`) || 0;
    if (sealAddEffects > 0) {
      const nextTurns = sealAddEffects - 1;
      ctx.setPlayerState(`${selfSide}_sealSkillAdditionalEffects`, nextTurns);
      if (nextTurns === 0) {
        ctx.addLog(`🧘 【靜刃止水】：對手技能附加效果失效限制已結束。`, "info");
      }
    }

    // 4. 六刃碎界斷 / 對手體力恢復量下降限制遞減
    const noHealTurns = ctx.getPlayerState(`${selfSide}_noHealTurns`) || 0;
    if (noHealTurns > 0) {
      const nextTurns = noHealTurns - 1;
      ctx.setPlayerState(`${selfSide}_noHealTurns`, nextTurns);
      if (nextTurns === 0) {
        ctx.addLog(`🧘 【六刃碎界斷】：體力恢復量限制已結束。`, "info");
      }
    }

    // 5. 蟄刃復歸 / 先制 +6 與每回合體力恢復與百分比傷害結算
    const priorityTurns = ctx.getPlayerState(`${selfSide}_nextPriorityTurns`) || 0;
    if (priorityTurns > 0) {
      const nextTurns = priorityTurns - 1;
      ctx.setPlayerState(`${selfSide}_nextPriorityTurns`, nextTurns);
      if (nextTurns === 0) {
        ctx.setPlayerState(`${selfSide}_nextTurnPriority`, 0);
        ctx.addLog(`⚡ 【蟄刃復歸】：先制 +6 效果已結束。`, "info");
      }
    }

    const healDamageTurns = ctx.getPlayerState(`${selfSide}_healAndDamageTurns`) || 0;
    if (healDamageTurns > 0) {
      const nextTurns = healDamageTurns - 1;
      ctx.setPlayerState(`${selfSide}_healAndDamageTurns`, nextTurns);

      const halfHp = ctx.self.currentHp < (ctx.self.maxHp / 2);
      const ratio = halfHp ? (2 / 3) : (1 / 3);
      const healAmount = Math.floor(ctx.self.maxHp * ratio);

      ctx.applyHeal(selfSide, healAmount);
      ctx.addLog(`🌑 【蟄刃復歸】：每回合體力恢復，自身恢復了 ${healAmount} 點體力！${halfHp ? "(體力低於 1/2，效果翻倍!)" : ""}`, "heal");

      const oppSide = selfSide === "p1" ? "p2" : "p1";
      ctx.applyTrueDamage(oppSide, healAmount, "蟄刃復歸(每回合百分比傷害)");

      if (nextTurns === 0) {
        ctx.addLog(`🌑 【蟄刃復歸】：每回合生命恢復與百分比傷害效果已結束。`, "info");
      }
    }

    // 6. Generic Skill Invalidation Turn Tick Downs
    const globalSkillInvalidTurns = ctx.getPlayerState(`${selfSide}_globalSkillInvalidTurns`) || ctx.getPlayerState("globalSkillInvalidTurns") || 0;
    if (globalSkillInvalidTurns > 0) {
      const nextTurns = globalSkillInvalidTurns - 1;
      ctx.setPlayerState(`${selfSide}_globalSkillInvalidTurns`, nextTurns);
      ctx.setPlayerState("globalSkillInvalidTurns", nextTurns);
    }

    const utilitySkillInvalidTurns = ctx.getPlayerState(`${selfSide}_utilitySkillInvalidTurns`) || ctx.getPlayerState("utilitySkillInvalidTurns") || 0;
    if (utilitySkillInvalidTurns > 0) {
      const nextTurns = utilitySkillInvalidTurns - 1;
      ctx.setPlayerState(`${selfSide}_utilitySkillInvalidTurns`, nextTurns);
      ctx.setPlayerState("utilitySkillInvalidTurns", nextTurns);
    }

    const attackSkillInvalidTurns = ctx.getPlayerState(`${selfSide}_attackSkillInvalidTurns`) || ctx.getPlayerState("attackSkillInvalidTurns") || 0;
    if (attackSkillInvalidTurns > 0) {
      const nextTurns = attackSkillInvalidTurns - 1;
      ctx.setPlayerState(`${selfSide}_attackSkillInvalidTurns`, nextTurns);
      ctx.setPlayerState("attackSkillInvalidTurns", nextTurns);
    }
  }

  private static queueWraithExtraAction(ctx: BattleEventContext, label: string, skillDamage: number, curseTurns: number) {
    const owner = ctx.actor;
    const ownerId = identity(ctx.self);
    const targetSide = owner === 'p1' ? 'p2' : 'p1';
    ctx.queueExtraAction?.(owner, {
      label,
      run: (c) => {
        // 排隊後仍須確認原持有者存活且仍在場；不能換人後由下一隻代放。
        if (!wraithOwnerOnField(c) || identity(c.self) !== ownerId) return 0;
        const target = targetSide === 'p1' ? c.activeP1 : c.activeP2;
        const elem = ['機械.暗影', '機械', '暗影'].reduce((best, candidate) =>
          getTypeMatchup(candidate, target.type) > getTypeMatchup(best, target.type) ? candidate : best
        );
        const dealt = c.applySkillTypeDamage(targetSide, skillDamage, label, {
          elem, category: 'skill_extra_action', node: 'extra_action'
        });
        c.updateElf(owner, { shield: (c.self.shield || 0) + dealt, barrier: (c.self.barrier || 0) + dealt });
        c.applyHeal(owner, dealt);
        c.addLog(`🛡️ ${label}以${elem}最佳克制造成 ${dealt} 點技能傷害，並轉化為等量護盾、護罩與體力！`, 'heal');

        const factor = c.getPlayerState(`${owner}_wraithDamageDoubled`) ? 2 : 1;
        const eligible = c.getEligibleTeam(targetSide).filter(e => alive(e) && identity(e) !== identity(target));
        if (eligible.length > 0) {
          const randomTarget = eligible[Math.floor((c.rng ?? Math.random)() * eligible.length)];
          const offFieldDmg = Math.floor(randomTarget.maxHp * curseTurns * 0.5 * factor);
          if (c.applyTrueDamageToElf) c.applyTrueDamageToElf(targetSide, randomTarget.battleId || randomTarget.id, offFieldDmg, label);
          else c.updateAnyElf(targetSide, randomTarget.battleId || randomTarget.id, { currentHp: Math.max(0, randomTarget.currentHp - offFieldDmg) });
          c.addLog(`💥 ${label}餘波令場下【${randomTarget.name}】受到 ${offFieldDmg} 點真實傷害！`, 'damage');
        }
        return dealt;
      }
    });
  }

  /**
   * 判定並套用：遭受致死傷害時 (FATAL_RESIST)
   * 返回 true 表示成功擋下致死傷害 (保留 1 點血或觸發替死)
   */
  static triggerFatalResist(ctx: BattleEventContext): boolean {
    const mechanics = getElfAdvancedMechanics(ctx.self);
    const selfSide = ctx.actor;
    const elfName = ctx.self.name;

    // 1. 【咒術師】賽博怨靈替死
    const wraithHp = ctx.getPlayerState(`${selfSide}_cyberWraithHp`) ?? ctx.getPlayerState(`${selfSide}_cyberWraithMaxHp`) ?? 0;
    // 專屬註冊表已管理實體怨靈，不得再用舊虛擬HP入口替死第二次。
    if (authoredCompanion(ctx.self) && mechanics.wraithSubstituteDeathOnce && !ctx.getPlayerState(`${selfSide}_wraithSubUsed`)) {
      const companion=ownedCompanion(ctx);
      if(companion){
        ctx.updateAnyElf(selfSide,identity(companion),{currentHp:0});
        ctx.setPlayerState(`${selfSide}_cyberWraithHp`,0);
        ctx.setPlayerState(`${selfSide}_cyberWraithActive`,false);
        ctx.setPlayerState(`${selfSide}_wraithSubUsed`,true);
        ctx.setPlayerState(`${selfSide}_wraithDamageDoubled`,!!mechanics.wraithSpellDamageDoubleAfterSub);
        ctx.updateElf(selfSide,{currentHp:Math.max(1,Math.floor(ctx.self.maxHp*(mechanics.wraithSubstituteDeathHpRatio||0)))});
        return true;
      }
    }
    if (!authoredCompanion(ctx.self) && !ctx.getPlayerState(`${selfSide}_cyberWraithRegistryManaged`) && mechanics.wraithSubstituteDeathOnce
      && !ctx.getPlayerState(`${selfSide}_wraithSubUsed`) && ctx.getPlayerState(`${selfSide}_cyberWraithActive`) && wraithHp > 0) {
      ctx.setPlayerState(`${selfSide}_cyberWraithHp`, 0);
      const hasSubbed = ctx.getPlayerState(`${selfSide}_cyberWraithHasSubbed`);
      if (!hasSubbed) {
        ctx.setPlayerState(`${selfSide}_cyberWraithHasSubbed`, true);
        ctx.setPlayerState(`${selfSide}_wraithSubUsed`, true);
        ctx.setPlayerState(`${selfSide}_cyberWraithActive`, false); // 怨靈死亡
        ctx.setPlayerState(`${selfSide}_wraithDamageDoubled`, true); // 後續真實傷害翻倍

        const retainHp = Math.floor(ctx.self.maxHp * mechanics.wraithSubstituteDeathHpRatio!);
        ctx.updateElf(selfSide, { currentHp: retainHp });

        ctx.addLog(`💖 【${elfName}】即將重傷倒下！「賽博怨靈」代為承受了全部致命傷害並消逝！`, "effect");
        ctx.addLog(`✨ 賽博怨靈替死守護成功！【${elfName}】保留了 ${retainHp} 點 (20%) 體力！`, "heal");
        return true;
      }
    }

    // 投石者 TXT 沒有「首次」限制；每次致死保留1。只走此入口，不再由魂印重複抵擋。
// 2026-10-28 使用者裁定：根性只在「該段傷害 >= 當前體力」時才保留 1 點；
// 小於當前體力的多段傷害、以及消耗體力（非傷害）都不觸發。ctx.fatalDamage 由引擎在致死判定時帶入。
if (mechanics.firstFatalSurviveAt1Hp) {
const dmg = Number((ctx as any).fatalDamage);
const hp = Number(ctx.self.currentHp);
const isDamage = (ctx as any).fatalIsDamage !== false;
if (isDamage && (!Number.isFinite(dmg) || !Number.isFinite(hp) || dmg >= hp)) {
ctx.updateElf(selfSide, { currentHp: 1 });
ctx.addLog(`🌟 【${elfName}】的【投石者】：承受致死傷害（${Number.isFinite(dmg)?dmg:"?"} ≥ ${Number.isFinite(hp)?hp:"?"}），保留 1 點體力！`, "effect");
return true;
}
}
    return false;
  }
}
