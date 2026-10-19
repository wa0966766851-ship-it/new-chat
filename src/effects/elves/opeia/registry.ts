import { BattleEventContext, BattleSkillHandler } from "../../types";
import { abilityKeys, abilityLevels, absorbBoosts } from '../../semanticOperations';
import { opeiaHasType as isType, opeiaAlive, opeiaSwarm } from '../../opeiaTimedEffects';
import { opeiaToxicAttack } from '../../opeiaAttackSkills';

// 5018 蟲后·奧佩婭 魂印「后」已遷移為真 Kit（src/data/migratedOpeiaSoulKit.ts；DSH 20261018 第十三批·第一波）——
// 舊 handleOpeiaSoulMark 整份空殼化（規則3.3）。全部子句由 Kit 通用積木表達：
// 登場（roster_query OR 篩選→temp_stats_by_last／attack_combo_uses_by_last／counter_from_last、
// bench_type_stat_transfer＋chain→attack_bypass_until_switch）、受方威力（counter_power_ratio）、
// 對手使用技能（add_invalid_next 附加失效封印／heal／damage_multiplier_turns／
// seal_used_skill_pp_phase_end＋pp_zero_seal／reduction_override_turns）、
// 自身使用技能（pp_no_cost／status 100%中毒→chain:fail clear_turn＋status chanceHpRatio 害怕／
// pending_counter＋counter_spend 中毒轉感染／pp_op drain）、下場（temp_stats_restore＋
// until_switch_keys_clear＋timer_consume_all）。王·鏽腑喰心的登場疊層讀通用 teamEntranceHistory
// （recordBattleEntrance）——引擎機制，未動。
// 五技已全數為真 Kit（migratedOpeiaSkillKits／migratedRandomStageSkillKits／migratedFinalCKits／
// migratedDeferredDamageSkillKits）；OPEIA_SKILLS 舊 handler 僅保留註冊表鍵（elfRegistryBeforeMove 基準），
// 正式 5018 資料已由 (elfIds, name, description) 逐字匹配套用 Kit、走 kit 路由，不會再執行舊分支。

const TEMP_STATS = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const;
/** 使用者確認：含體力的六維總和×n×10%，該總和同時加到每一維，不平均分配。 */
export function opeiaTemporaryStats(stats: NonNullable<BattleEventContext['self']['calculatedStats']>, n: number) {
  const bonus = Math.floor(TEMP_STATS.reduce((sum, key) => sum + stats[key], 0) * n / 10);
  const next = { ...stats };
  for (const key of TEMP_STATS) next[key] += bonus;
  return { bonus, stats: next };
}
export const countOpeiaTeam = (team: any[], enemy = false) => team.filter(e => !e.isVanished && (enemy ? !opeiaAlive(e) || isType(e, '蟲') : opeiaAlive(e) || isType(e, '蟲'))).length;
/** 魂印「后」已由真 Kit（migratedOpeiaSoulKit）承接；保留匯出名僅供舊引用解析，不再執行任何戰鬥行為。 */
export const handleOpeiaSoulMark = (_ctx: any, _event: any, _extra?: any) => false;

export const OPEIA_SKILLS: Record<string, BattleSkillHandler> = {
  "毒噬魂絲": (ctx) => {
    const hadBoosts = abilityLevels(ctx.target, true) > 0;
    const absorbed = absorbBoosts(ctx);
    if (absorbed > 0) ctx.applyStatusWithImmunityCheck(ctx.targetSide, '沉默', 3);
    if (!hadBoosts) ctx.applyStatChange(ctx.targetSide, Object.fromEntries(abilityKeys.map(k=>[k,-1])));
    const amount = Math.floor(ctx.target.maxHp / 3) * (ctx.target.currentHp > ctx.target.maxHp / 2 ? 2 : 1);
    const dealt = ctx.applyPinkDamage(ctx.targetSide, amount, '毒噬魂絲·吸取', undefined, undefined, 'percent');
    ctx.applyHeal(ctx.actor, dealt);
  },
  "蟲群庇護": opeiaSwarm,
  "王.噬心毒蝕": opeiaToxicAttack,
  "王·噬心毒蝕": opeiaToxicAttack,
};

export { OpeiaDeconstructedProfile } from "../../../data/elfProfiles/opeiaRegistry";
