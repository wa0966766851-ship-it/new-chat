// 帝皇之盾的全局規則（原寫在 BattleScreen／戰鬥引擎，2026-10-10 搬入）：
// 陣亡後下一隻上場精靈獲得守護印記；守護印記與「攻擊技能 PP 消耗提升」的回合遞減。
import { registerBattleRule } from '../../../engine/battleRules';
import { guardianReduction, nextGuardianStacks, GUARDIAN_DURATION } from '../../guardianMarkRegistry';

const guardianMark = (stacks: number, turns: number) => {
  const reduction = guardianReduction(stacks);
  return {
    id: "guardian_shield_mark", displayChar: "守", count: stacks, name: "守護印記",
    description: `受攻擊傷害減少 ${Math.round(reduction * 100)}% (${turns}回合)`, source: "帝皇之盾 / 盾",
    effects: { nonTrueDamageTakenMultiplier: 1 - reduction, damageTakenTypes: ["attack"] },
  };
};

registerBattleRule({
  id: 'imperial-shield:guardian',
  entered(_api, side, _elf, ctx, regState) {
    const pending = regState.nextElfGuardianMark || regState[side + "_nextElfGuardianMark"] || false;
    if (!pending) return;
    const stacks = nextGuardianStacks(regState.guardianMarkStacks || 0);
    ctx.setMark(guardianMark(stacks, GUARDIAN_DURATION) as any, side);
    ctx.addLog(`🎡【守護印記】：守護之光降臨！為上場精靈附加第 ${stacks} 層【守護印記】(受擊減傷 ${Math.round(guardianReduction(stacks) * 100)}%)，持續 ${GUARDIAN_DURATION} 回合！`, "effect");
    return { nextElfGuardianMark: false, [side + "_nextElfGuardianMark"]: false, guardianMarkStacks: stacks, guardianMarkTurns: GUARDIAN_DURATION };
  },
  roundEnd(api, side, reg) {
    if (reg.guardianMarkTurns > 0) {
      reg.guardianMarkTurns -= 1;
      const ctx = api.ctx(side, false, 0);
      if (reg.guardianMarkTurns === 0) {
        reg.guardianMarkStacks = 0;
        ctx.clearMark("guardian_shield_mark", side);
        api.log(side, "🎡【守護印記】效果已結束。", "effect");
      } else {
        ctx.setMark(guardianMark(reg.guardianMarkStacks, reg.guardianMarkTurns) as any, side);
      }
    }
    if (reg.attackPpMultiplierTurns > 0) {
      reg.attackPpMultiplierTurns -= 1;
      if (reg.attackPpMultiplierTurns === 0) api.log(side, "🎡【盾】：對手攻擊技能 PP 消耗 3 倍懲罰效果已結束。", "effect");
    }
  },
});
