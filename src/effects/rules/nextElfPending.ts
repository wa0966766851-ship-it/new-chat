// 通用「下一隻上場精靈」待生效效果（由各魂印／特質設定 RegistryState 的 nextElf* 鍵）。
// 原寫在 BattleScreen 的 applyEntranceBlessings（2026-10-10 搬出）；鍵與行為不變，日誌改為通用文字。
import { registerBattleRule } from '../../engine/battleRules';
import { changePp } from '../newElfOperations';
import { getMaxPp } from '../../utils/battleHelpers';

registerBattleRule({
  id: 'generic:next-elf-pending',
  entered(_api, side, elf, ctx, regState) {
    const updates: Record<string, any> = {};
    const nextShield = regState.nextElfShield || regState[side + "_nextElfShield"] || 0;
    if (nextShield > 0) {
      ctx.applyShield(side, nextShield);
      ctx.addLog(`🛡️ 為上場精靈賦予 ${nextShield} 點護罩！`, "effect");
      updates.nextElfShield = 0; updates[side + "_nextElfShield"] = 0;
    }
    const nextImmune = regState.nextElfImmunityTurns || regState[side + "_nextElfImmunityTurns"] || 0;
    if (nextImmune > 0) {
      ctx.setPlayerState("immuneStatusTurns", nextImmune);
      ctx.addLog(`🛡️ 為上場精靈賦予 ${nextImmune} 回合異常免疫！`, "effect");
      updates.nextElfImmunityTurns = 0; updates[side + "_nextElfImmunityTurns"] = 0;
    }
    const concealPP = regState.nextElfGainConcealAndPP || regState[side + "_nextElfGainConcealAndPP"];
    if (concealPP) {
      changePp(ctx,side,elf,s=>getMaxPp(s,elf),true,'restore');
      ctx.updateAnyElf(side,elf.battleId||elf.id,{isConcealed:true});
      elf.isConcealed=true;
      ctx.setPlayerState(`${side}_isConcealed`, true);
      ctx.addLog(`🔄 為新上場的【${elf.name}】恢復所有技能 PP 並附加【隱匿印記】！`, "effect");
      updates.nextElfGainConcealAndPP = false; updates[side + "_nextElfGainConcealAndPP"] = false;
    }
    return Object.keys(updates).length ? updates : undefined;
  },
});
