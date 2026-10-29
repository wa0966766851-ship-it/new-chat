import type { BattleEventContext } from '../effects/types';
import { EffectTiming } from '../effects/types';
import { TITLE_CATALOG } from '../data/titles';

/**
 * 稱號的事件效果（資料驅動，引擎不認得任何精靈或稱號名稱）：
 *  - BATTLE_START：effects.battleStartItems 放入己方道具欄位（每場一次）
 *  - ON_ENTRANCE：在場精靈名稱符合 effects.entranceItems[].elfNames 時放入（每次登場都放）
 * ctx 為己方上下文；self 為剛登場的精靈。
 */
export function runTitleEffects(ctx: BattleEventContext, titleId: string | undefined, event: EffectTiming): void {
  const effects = titleId ? TITLE_CATALOG[titleId]?.effects : undefined;
  if (!effects || !ctx.grantBattleItem) return;
  if (event === EffectTiming.BATTLE_START) {
    for (const grant of effects.battleStartItems ?? []) ctx.grantBattleItem(ctx.actor, grant.itemId, grant.count);
  }
  if (event === EffectTiming.ON_ENTRANCE) {
    for (const grant of effects.entranceItems ?? []) if (grant.elfNames.includes(ctx.self.name)) ctx.grantBattleItem(ctx.actor, grant.itemId, grant.count);
  }
}
