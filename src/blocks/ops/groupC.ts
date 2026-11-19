import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { calculateDamage } from '../../utils/damageCalculator';
import { queueHpDrain } from '../../battle/hpDrain';
import { extraTargetPool, isPreparedExtraTarget } from '../../battle/extraAttackTargets';

/**
 * C 組（未接通 73 項）專屬通用動作。
 * 欄位表與檢查函數在 groupCContract.ts（純資料）；執行端以工廠接收 runtime 輔助函數（避免循環匯入）。
 */
type S = 'p1' | 'p2';
type OpFn = (ctx: BattleEventContext, p: any, st: RunState) => boolean | void;

const idOf = (e: any) => String(e?.battleId || e?.id || '');
import { battleTypeParts } from '../../utils/typeQuery';
const hasType = (e: any, type: string) => battleTypeParts(e?.type).includes(type);
const dead = (e: any) => !!e?.isVanished || (e?.currentHp ?? 0) <= 0;

export function groupCOperations(h: { liveElf: (ctx: BattleEventContext, side: S) => any; ops: () => Record<string, OpFn> }): Record<string, OpFn> {
  return {
    extra_random_target: (ctx, p, st) => {
      const oppSide = ctx.targetSide, actor = ctx.actor;
      const active = h.liveElf(ctx, oppSide), self = h.liveElf(ctx, actor);
      const write = (value: any) => ctx.updateAnyElf(actor, idOf(self), { preparedExtraAttack: value });
      if (p.mode === 'clear') { write(undefined); return true; }
      const pool = extraTargetPool(ctx.getFullTeam(oppSide) || [], active, p.pool);
      const rng = ctx.rng ?? Math.random;
      if (p.mode === 'prepare') {
        const ids: string[] = [];
        for (let n = 0; n < p.count && pool.length; n++) ids.push(idOf(pool.splice(Math.floor(rng() * pool.length), 1)[0]));
        write({ side: oppSide, ids });
        return true;
      }
      const skill: any = ctx.skill;
      if (!skill || skill.category === '屬性' || !skill.power || !ctx.applyDamageToElf) return false;
      if (p.prepared) {
        const dealt = ctx.mainSkillSettledAmount ?? st.event?.data?.settledDamage ?? st.event?.data?.damageDealt ?? 0;
        if (!(dealt > 0) || ctx.isHit === false || st.event?.data?.hit === false) return false;
      }
      const victims = p.prepared ? pool.filter(victim => isPreparedExtraTarget(self, oppSide, victim, active)) : [];
      let hit = false;
      for (let n = 0; n < p.count && (p.prepared ? victims.length : pool.length); n++) {
        const victim = p.prepared ? victims.shift()! : pool.splice(Math.floor(rng() * pool.length), 1)[0];
        const res = calculateDamage(self, victim, skill, actor, undefined, undefined, (217 + rng() * 38) / 255);
        const amount = Math.floor(res.damage);
        if (amount <= 0) continue;
        ctx.addLog(`💥 【${self.name}】的攻擊波及敵方【${victim.name}】！`, 'effect');
        // 攻擊公式已套用技能克制；結算端只處理防護／傷害鉤子，不再乘持有者屬性的克制。
        ctx.applyDamageToElf(oppSide, idOf(victim), amount, 'skill_attack', { label: skill.name, elem: skill.type, applyTypeMatchup: false });
        hit = true;
      }
      return hit;
    },
    roster_query: (ctx, p, st) => {
      let count = 0;
      for (const side of p.sides as ('self' | 'opp')[]) {
        const real: S = side === 'self' ? ctx.actor : ctx.targetSide;
        const active = h.liveElf(ctx, real);
        const typeHit = (e: any) => p.types.some((t: string) => hasType(e, t));
        for (const e of ctx.getFullTeam(real) || []) {
          if (e.isVanished || (p.scope === 'bench' && idOf(e) === idOf(active))) continue;
          // OR 篩選（5018 后「存活或識別帶蟲系／陣亡或識別帶蟲系」）：存活條件與屬性條件取聯集，不重複計數。
          if (p.filter === 'alive_or_type') { if (dead(e) && !typeHit(e)) continue; count++; continue; }
          if (p.filter === 'dead_or_type') { if (!dead(e) && !typeHit(e)) continue; count++; continue; }
          if (p.filter === 'alive' && dead(e)) continue;
          if (p.filter === 'dead' && !dead(e)) continue;
          if (p.types.length && !typeHit(e)) continue;
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
      const types=p.fromCarried?[...new Set(ctx.self.skills.flatMap((s:any)=>s.type.split(/[.·・]/)).filter((t:string)=>!['無','無屬性'].includes(t)))]:p.types;
      if(!types.length)return false;
      ctx.setPlayerState('blkTypeOverride', [...types]);
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
