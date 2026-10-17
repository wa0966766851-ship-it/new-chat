import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { calculateDamage } from '../../utils/damageCalculator';
import { queueHpDrain } from '../../battle/hpDrain';

/**
 * C 組（未接通 73 項）專屬通用動作。
 * 欄位表與檢查函數在 groupCContract.ts（純資料）；執行端以工廠接收 runtime 輔助函數（避免循環匯入）。
 */
type S = 'p1' | 'p2';
type OpFn = (ctx: BattleEventContext, p: any, st: RunState) => boolean | void;

const idOf = (e: any) => String(e?.battleId || e?.id || '');
const hasType = (e: any, type: string) => String(e?.type || '').replace(/系/g, '').split(/[.·・]/).includes(type);
const dead = (e: any) => !!e?.isVanished || (e?.currentHp ?? 0) <= 0;

export function groupCOperations(h: { liveElf: (ctx: BattleEventContext, side: S) => any; ops: () => Record<string, OpFn> }): Record<string, OpFn> {
  return {
    extra_random_target: (ctx, p) => {
      const oppSide = ctx.targetSide, actor = ctx.actor;
      const skill: any = ctx.skill;
      if (!skill || skill.category === '屬性' || !skill.power || !ctx.applyDamageToElf) return false;
      const active = h.liveElf(ctx, oppSide), self = h.liveElf(ctx, actor);
      const pool = (ctx.getFullTeam(oppSide) || []).filter((e: any) => idOf(e) !== idOf(active) && !dead(e) &&
        (e.isExtra ? p.pool.includes('foe_extra') : p.pool.includes('foe_bench')));
      const rng = ctx.rng ?? Math.random;
      let hit = false;
      for (let n = 0; n < p.count && pool.length; n++) {
        const victim = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        const res = calculateDamage(self, victim, skill, actor, undefined, undefined, (217 + rng() * 38) / 255);
        const amount = Math.floor(res.damage);
        if (amount <= 0) continue;
        ctx.addLog(`💥 【${self.name}】的攻擊波及敵方【${victim.name}】！`, 'effect');
        ctx.applyDamageToElf(oppSide, idOf(victim), amount, 'skill_attack', { label: skill.name });
        hit = true;
      }
      return hit;
    },
    roster_query: (ctx, p, st) => {
      let count = 0;
      for (const side of p.sides as ('self' | 'opp')[]) {
        const real: S = side === 'self' ? ctx.actor : ctx.targetSide;
        const active = h.liveElf(ctx, real);
        for (const e of ctx.getFullTeam(real) || []) {
          if (e.isVanished || (p.scope === 'bench' && idOf(e) === idOf(active))) continue;
          if (p.filter === 'alive' && dead(e)) continue;
          if (p.filter === 'dead' && !dead(e)) continue;
          if (p.types.length && !p.types.some((t: string) => hasType(e, t))) continue;
          count++;
        }
      }
      st.lastAmount = count;
      return count > 0;
    },
    stat_by_last: (ctx, p, st) => {
      const n = Math.floor(st.lastAmount || 0);
      if (n <= 0) return false;
      return h.ops().stat(ctx, { side: p.side, stats: p.stats, v: n }, st) !== false;
    },
    consume_extra_hp: (ctx, p) => {
      const extra = (ctx.getFullTeam(ctx.targetSide) || []).find((e: any) => e.isExtra && e.name === p.name && !dead(e));
      if (!extra || !ctx.updateAnyElf) return false;
      const cost = Math.floor(extra.maxHp * p.ratio);
      ctx.updateAnyElf(ctx.targetSide, idOf(extra), { currentHp: extra.currentHp >= cost ? extra.currentHp - cost : 0 } as any);
      return true;
    },
    type_best_of: (ctx, p) => {
      ctx.setPlayerState('blkTypeOverride', [...p.types]);
      ctx.setPlayerState('blkTypeOverrideUses', 1);
      ctx.setPlayerState('blkTypeOverrideCurrentAction', true);
      ctx.setPlayerState('blkTypeOverrideExtend', p.extend);
      return true;
    },
    drain_repeat_independent: (ctx, p, st) => {
      const stageKinds = (e: any) => Object.values(e?.statStages || {}).filter((v: any) => typeof v === 'number' && v !== 0).length;
      const extra = p.repeat ? stageKinds(h.liveElf(ctx, ctx.actor)) + stageKinds(h.liveElf(ctx, ctx.targetSide)) : 0;
      const amounts = [...Array(extra).fill(p.repeat?.amount ?? 0), p.flat];
      let fallbackDone = false, total = 0;
      for (const amount of amounts) {
        const settled = queueHpDrain(ctx, ctx.targetSide, amount, 'fixed', '獨立吸取', {
          onSettled: (r: any) => {
            // 只認實際扣血；名目值或護盾承受量不算「體力減少」。
            if (r?.hpLost > 0 || fallbackDone || !p.fallback) return;
            fallbackDone = true;
            const cur = h.liveElf(ctx, ctx.targetSide)?.currentHp ?? 0;
            queueHpDrain(ctx, ctx.targetSide, Math.floor(cur * p.fallback.ratioCur), 'true', '獨立吸取未減少·汲取');
          },
        } as any);
        total += settled;
      }
      st.lastAmount = total;
      st.lastDealt = total;
      return total > 0;
    },
  };
}
