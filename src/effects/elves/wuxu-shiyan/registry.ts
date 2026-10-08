import type { BattleEventContext as C, BattleSkillHandler } from '../../types';
import type { Skill } from '../../../types';
import { EffectTiming as E } from '../../types';
import { createExtraElf } from '../../../utils/extraElf';
import { clearStatuses } from '../../semanticOperations';
import { StatusRegistry } from '../../statusRegistry';
import { EffectTiming } from '../../types';
import { allStages, alive, changePp, clearStages, drain, identity, restorePp, timed } from '../../newElfOperations';
import { skillSlot } from '../../../battle/skillSlot';

/** 攜帶詞條的觸發是PP消耗，不是技能命中。五招不在普通handler再執行一次。 */
const carried: Record<string, (c: C) => void> = {
  '影契·噬滅': c => {
    for (const side of [c.actor, c.targetSide]) {
      c.clearTurnEffectsOf(side); clearStages(c, side, true); clearStages(c, side, false);
      c.applyStatusWithImmunityCheck(side, '害怕', 3); c.applyStatusWithImmunityCheck(side, '詛咒', 3);
    }
    c.applyStatChange(c.targetSide, allStages(-1));
    drain(c, c.target.maxHp / 4 * (c.self.currentHp < c.self.maxHp / 2 ? 2 : 1), 'percent');
  },
  '械律·置換': c => {
    const amount = Math.floor(((c.self.shield || 0) + (c.self.barrier || 0) + (c.target.shield || 0) + (c.target.barrier || 0)) * .7);
    c.updateElf(c.actor, { shield: 0, barrier: 0 }); c.updateElf(c.targetSide, { shield: 0, barrier: 0 });
    drain(c, amount, 'fixed'); restorePp(c, c.actor, c.self);
    timed(c, c.targetSide, 'pp_skill_switch_lock', 2, { lockSwitch: true }, true);
    c.useBattleItem?.(c.targetSide, 'hp_150', c.actor);
  },
  '血稅迴轉': c => {
    c.applyStatChange(c.actor, { def: 2, spdef: 2, speed: 2, accuracy: 2, atk: -1, spatk: -1 });
    timed(c, c.actor, 'round_drain_ratio', 4, { roundDrainSpec: { ratio: 1 / 3, doubleBelowHalf: true, benchHealIfNoLoss: 200 } }, false, 'skill', false);
    timed(c, c.actor, 'use_fixed_damage', 3, { afterUseDamage: { amount: 300, type: 'fixed', trueIfNoLoss: 300 } }, false, 'skill', false);
    timed(c, c.actor, 'skill_priority', 2, { block: { prio: 2 } }, true);
  },
  '啟蟄·冥土荒蕪': c => {
    if (!c.applyStatusWithImmunityCheck(c.targetSide, '腐朽', 3).success) c.applyStatusWithImmunityCheck(c.targetSide, '癱瘓', 3);
    timed(c, c.targetSide, 'use_skill_category_reaction', 3, { skillUseReaction: { attackRandomStatuses: 2, utilityNextAttackInvalidRounds: 2 } }, false, 'skill', false);
    timed(c, c.actor, 'stat_drop_immunity', 3, { immuneStatDown: true }, false, 'skill', false);
  },
  '安息契': c => {
    changePp(c, c.targetSide, c.target, s => s.category === '屬性' ? s.pp : 0, false, 'clear');
    timed(c, c.targetSide, 'utility_skill_invalid', 2, { block: { invalid: '屬性' } }, false, 'skill', false);
    timed(c, c.actor, 'opponent_status_immunity', 2, { immuneStatus: true, statusGuardSourceSide: c.targetSide }, false, 'skill', false);
    changePp(c, c.actor, c.self, s => Math.max(0, s.pp - 1));
    const amount = Math.floor(c.self.maxHp * .4 * (c.target.currentHp > c.target.maxHp / 2 ? 2 : 1));
    c.applyPinkDamage(c.targetSide, amount, undefined, undefined, undefined, 'percent'); c.applyHeal(c.actor, amount);
    c.setPlayerState('nextKillStatus', { status: '詛咒', duration: 3 });
  },
};
export const SHIYAN_SKILLS: Record<string, BattleSkillHandler> = Object.fromEntries(Object.keys(carried).map(name => [name, () => {}]));
export const SHIYAN_SKILL_TRANSFORMS: Record<string, (c: C, s: Skill) => Skill> = {
  '影契·噬滅': (c, s) => {
    if (!c.self.isInherentInvalid) c.setPlayerState('oppBoostAsDropThisAction', true);
    return s;
  },
  '械律·置換': (c, s) => {
    if (!c.self.isInherentInvalid) c.setPlayerState('oppBoostAsDropThisAction', true);
    return s;
  },
  '安息契': (c, s) => {
    if (!c.self.isInherentInvalid) c.setPlayerState('selfDropAsOppDropThisAction', true);
    return s;
  },
};
function runShiyanSoul(ctx: C, event: E, extraData?: any): any {
  const { self, actor, setPlayerState, getPlayerState, addLog } = ctx;
  const oppSide = ctx.targetSide;
    if ([EffectTiming.ENFORCE, EffectTiming.ON_ENTRANCE, EffectTiming.DEATH_NODE_2].includes(event)) {
      const originals: Record<string, number> = getPlayerState('shiyanOriginalSpdef') || {};
      const active = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
      if (self.currentHp > 0 && !self.isVanished) {
        const original = originals[self.battleId || self.id] ?? self.calculatedStats.spdef;
        const adjusted = Math.ceil(original / 10);
        for (const e of ctx.getFullTeam(actor)) {
          const id = e.battleId || e.id;
          originals[id] ??= e.calculatedStats.spdef;
          // 其他隊員上場後不再是「場下精靈」，必須還原，不可沿用板凳時的特防。
          const value = identity(e) !== identity(self) && identity(e) === identity(active) ? originals[id] : adjusted;
          if (e.calculatedStats.spdef !== value) ctx.updateAnyElf(actor, id, { calculatedStats: { ...e.calculatedStats, spdef: value } });
        }
        setPlayerState('shiyanOriginalSpdef', originals);
      } else {
        for (const e of ctx.getFullTeam(actor)) {
          const original = originals[e.battleId || e.id];
          if (original !== undefined) ctx.updateAnyElf(actor, e.battleId || e.id, { calculatedStats: { ...e.calculatedStats, spdef: original } });
        }
        setPlayerState('shiyanOriginalSpdef', {});
      }
    }
    const wraithElf = ctx.getFullTeam(actor).find(e => e.name.includes("賽博怨靈") && !e.isVanished
      && (!e.summonerId || String(e.summonerId) === identity(self)));
    const isWraithActive = !!(wraithElf && wraithElf.currentHp > 0);

    if (event === EffectTiming.ON_ENTRANCE) {
      setPlayerState(`${actor}_cyberWraithRegistryManaged`, true);
      addLog(`🌑 【咒術師】：召喚與自身能力值相等的賽博怨靈作為額外精靈加入己方！`, "effect");
      const adjustedSpdef = Math.ceil((getPlayerState('shiyanOriginalSpdef')?.[self.battleId || self.id] ?? self.calculatedStats.spdef) / 10);
      const newWraith = createExtraElf(self, {
        name: "賽博怨靈",
        type: "機械·暗影",
        maxHp: self.maxHp,
        currentHp: self.maxHp,
        baseStats: {
          ...self.baseStats,
          spdef: adjustedSpdef
        },
        badge: "👻",
        skills: [],
        soulMark: {
          name: "賽博怨靈（額外精靈）",
          description: "特防與蝕言魂印調整後特防一致；蝕言下場時怨靈死亡並消逝；每次登場可替死一次，令蝕言保留20%體力；怨靈陣亡後，蝕言存活且在場時仍可發動魔咒；替死後魔咒對敵方場下的真實傷害比例翻倍。",
          effectType: "none",
          effectValue: 0
        }
      });
      ctx.addExtraElf(actor, newWraith);
      setPlayerState(`${actor}_cyberWraithActive`, true);
      setPlayerState(`${actor}_wraithSubUsed`, false);
      setPlayerState(`${actor}_cyberWraithHasSubbed`, false);
      setPlayerState(`${actor}_wraithDamageDoubled`, false);
    }

    if (event === EffectTiming.ON_SWITCH_OUT) {
      if (wraithElf) {
        addLog(`🌑 【咒術師】：自身下場，賽博怨靈死亡並消逝...`, "effect");
        ctx.vanishElf(actor, wraithElf);
        setPlayerState(`${actor}_cyberWraithActive`, false);
      }
      setPlayerState(`${actor}_wraithSubUsed`, false);
      setPlayerState(`${actor}_wraithCastSpellPending`, false);
    }

    if (event === EffectTiming.FATAL_RESIST) {
      // 1. 賽博怨靈替死
      const subUsed = !!getPlayerState(`${actor}_wraithSubUsed`);
      if (isWraithActive && !subUsed) {
        addLog(`👻 【咒術師】：賽博怨靈代替自身死亡！保留無序·蝕言最大體力20%！`, "effect");
        ctx.updateAnyElf(actor, identity(wraithElf), { currentHp: 0 });
        setPlayerState(`${actor}_cyberWraithActive`, false);
        setPlayerState(`${actor}_wraithSubUsed`, true);
        setPlayerState(`${actor}_cyberWraithHasSubbed`, true);
        setPlayerState(`${actor}_cyberWraithHp`, 0);
        setPlayerState(`${actor}_wraithDamageDoubled`, true);
        ctx.updateElf(actor, { currentHp: Math.floor(self.maxHp * 0.2) });
        return true;
      }

    }

    if (event === EffectTiming.ON_KILL && extraData?.defeatedElf) {
       const deadElf = extraData.defeatedElf;
       const isDeadAlien = deadElf.isAlienElf || (deadElf.soulMark?.trait_warrior);
       if (isDeadAlien) {
         addLog(`🌑 【無序星魂使徒】：徹底終結了異能精靈 【${deadElf.name}】！`, "effect");
         ctx.vanishElf(oppSide, deadElf);
       }
    }

    if (event === EffectTiming.ROUND_START) {
      // 只有蝕言自己是現役精靈時，詛咒才會生效（候補時不觸發）
      const isActive = identity(self) === identity(actor === 'p1' ? ctx.activeP1 : ctx.activeP2);
      if (isActive) {
        const statuses = ctx.getStatuses(self);
        if (!statuses['詛咒']) {
          addLog(`🌑 【蝕】：深淵詛咒蔓延！`, "effect");
          ctx.applyStatusWithImmunityCheck(actor, "詛咒", 3);
          ctx.applyStatusWithImmunityCheck(oppSide, "詛咒", 3);
        }
      }
    }

    if (event === EffectTiming.BEFORE_STATUS_TICK && wraithElf && /詛咒|curse/i.test(extraData?.status || '')) extraData.skipTick = true;
    if (event === EffectTiming.BATTLE_PHASE_END) {
      const active = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
      if ((active.battleId || active.id) !== (self.battleId || self.id) || self.currentHp <= 0) return false;
      const statuses = ctx.getStatuses(self);
      const oldCurse = statuses['詛咒'] || 0;
      const convertible = Object.entries(statuses).filter(([name,n]) => n > 0 && name !== '詛咒' && StatusRegistry[name] && !StatusRegistry[name].categories.includes('AUXILIARY'));
      if (convertible.length || oldCurse > 0) {
        // 先確認新異常附加成功，再移除舊異常，避免免疫時吞掉原狀態。
        const turns = oldCurse > 0 ? oldCurse * 2 : 6;
        if (ctx.applyStatusWithImmunityCheck(actor, '詛咒', turns).success) {
          const names = new Set(convertible.map(([name])=>name));
          clearStatuses(ctx, actor, self, name=>names.has(name));
          setPlayerState(actor + '_curseTurns', turns);
        }
      }
    }
}
export function handleShiyanSoulMark(c: C, event: E, data?: any): any {
  const result = runShiyanSoul(c, event, data);
  if (event === E.ON_PP_CONSUME || event === E.PP_CHANGED && data?.removed > 0) {
    const slots: number[] = data?.consumedSlots || [skillSlot(c.self, c.skill)];
    runCarriedPpChain(c, slots);
  }
  return result;
}

/** 使用者確認：同一串連鎖每個技能槽一次；外部新事件重新建立連鎖。 */
function runCarriedPpChain(c: C, slots: number[]): void {
  const existing: { seen: number[] } | undefined = c.getPlayerState('ppCarryChain');
  const chain = existing || { seen: [] };
  if (!existing) c.setPlayerState('ppCarryChain', chain);
  try {
    for (const slot of slots) {
      const action = carried[c.self.skills[slot]?.name];
      if (!action || chain.seen.includes(slot)) continue;
      chain.seen.push(slot);
      // 寫回共享連鎖，讓正式context重建後的PP_CHANGED仍能看到同一因果鏈。
      c.setPlayerState('ppCarryChain', chain);
      const carriedContext = Object.create(c) as C;
      carriedContext.skill = c.self.skills[slot];
      action(carriedContext);
    }
  } finally {
    if (!existing) c.setPlayerState('ppCarryChain', undefined);
  }
}
