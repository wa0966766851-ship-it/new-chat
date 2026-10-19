// 5028 瀾 魂印「瀾」通用件（DSH 20261018 第二十二批）。
// 缺口：
//   ① shield_change_mark{perStep,markId,...}：護盾值每次變化時，每達到 N 點附加 1 道印記給對手。
//      引擎沒有「護盾變化」事件，改為在 Kit 的回合事件中依「當前護盾 / perStep - 已發放」補發，
//      以 registry 鍵記錄已發放步數（避免重複發放）。
//   ② conditional_rebirth{afterRounds,ratio}：條件重生（引擎既有 effects/conditionalRebirth.ts 的
//      armConditionalRebirth／runConditionalRebirth 通用件，本檔只做 Kit op 包裝）。
import type { BattleEventContext } from '../../effects/types';
import { armConditionalRebirth } from '../../effects/conditionalRebirth';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const SHIELD_MARK_ACTION_FIELDS: Record<string, readonly string[]> = {
  shield_change_mark: ['perStep', 'markId', 'markName', 'displayChar', 'maxCount', 'side'],
  conditional_rebirth: ['afterRounds', 'ratio'],
};

export function shieldMarkActionIssue(op: string, p: any): string | null {
  if (op === 'shield_change_mark') {
    if (!Number.isInteger(p.perStep) || p.perStep < 1 || p.perStep > 10000) return '護盾變化發放需1至10000的步進點數';
    if (typeof p.markId !== 'string' || !p.markId) return '護盾變化發放需印記識別碼';
    if (typeof p.markName !== 'string' || !p.markName) return '護盾變化發放需印記名稱';
    if (p.maxCount !== undefined && (!Number.isInteger(p.maxCount) || p.maxCount < 1)) return '護盾變化發放印記上限需正整數';
    if (p.side !== undefined && !['self', 'opp'].includes(p.side)) return '護盾變化發放對象僅支援自身或對手';
    return null;
  }
  if (op === 'conditional_rebirth') {
    if (!Number.isInteger(p.afterRounds) || p.afterRounds < 0 || p.afterRounds > 100) return '條件重生需0至100回合';
    if (!(p.ratio > 0 && p.ratio <= 1)) return '條件重生需0至100%復活體力比例';
    return null;
  }
  return null;
}

export function shieldMarkOperations(helpers: { liveElf: (ctx: BattleEventContext, side: S) => any }) {
  return {
    // 護盾值每達 perStep 點 → 附加 1 道印記給指定對象。
    // 以「已發放步數」記錄，本次步數 - 已發放 = 需補發道數（護盾減少時不回收，符合「每達到」語意）。
    shield_change_mark: (ctx: BattleEventContext, p: any): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      if (!elf) return false;
      const total = Math.max(0, Number(elf.shield) || 0) + Math.max(0, Number(elf.barrier) || 0);
      const steps = Math.floor(total / p.perStep);
      const key = 'shieldMarkSteps_' + p.markId;
      const prev = Number((ctx as any).getPlayerState?.(key) || 0);
      if (steps <= prev) return false;
      const gain = steps - prev;
      (ctx as any).setPlayerState?.(key, steps);
      const side: S = p.side === 'self' ? ctx.actor : ctx.targetSide;
      for (let i = 0; i < gain; i++) {
        (ctx as any).addMark?.(side, {
          id: p.markId, name: p.markName, displayChar: p.displayChar || '記',
          unit: '道', count: 1, maxCount: p.maxCount ?? 99,
          description: p.markName + '（護盾變化累積）',
        });
      }
      return true;
    },
    // 條件重生：掛上重生契約（引擎 conditionalRebirth 通用件）。
    conditional_rebirth: (ctx: BattleEventContext, p: any): boolean => armConditionalRebirth(ctx, p),
  };
}
