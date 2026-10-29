import type { BattleEventContext } from '../../effects/types';
import { createExtraElf } from '../../utils/extraElf';

const idOf = (elf: any) => String(elf?.battleId || elf?.id || '');
const stats = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'];
export const OWNER_LINK_ACTION_FIELDS = {
  summon_fixed_extra: ['name', 'type', 'value', 'gender', 'description'],
  retire_summoned_extra: ['name', 'trueDamage', 'gender'],
  combine_panel_stats: ['stats', 'mode', 'key'],
  record_round_user: ['side', 'key'],
};
export const OWNER_LINK_CONDITION_FIELDS = { round_first_user: ['side', 'key'] };
export function ownerLinkConditionIssue(c: any): string | null {
  if (c.c !== 'round_first_user') return null;
  return ['self', 'opp', 'none'].includes(c.p?.side) && typeof c.p?.key === 'string' && c.p.key.length > 0 ? null : '出手紀錄需自身／對手／均未出手與紀錄鍵';
}
export function ownerLinkActionIssue(op: string, p: any, trig?: string): string | null {
  if (op === 'retire_summoned_extra' && trig !== 'defeated') return '召喚者死亡連動只能接確認陣亡，不能接致死抵擋';
  if (op === 'summon_fixed_extra') {
    if (!p.name || !p.type || !Number.isSafeInteger(p.value) || p.value < 1 || p.value > 1000000 || !['雄性', '雌性', '無性別'].includes(p.gender) || typeof p.description !== 'string') return '固定能力額外精靈需名稱、屬性、正整數能力、性別及描述';
  }
  if (op === 'retire_summoned_extra' && (!p.name || p.trueDamage !== undefined && (!Number.isSafeInteger(p.trueDamage) || p.trueDamage <= 0) || p.gender !== undefined && !['雄性', '雌性', '無性別'].includes(p.gender))) return '召喚物退場需名稱與有效傷害／性別';
  if (op === 'combine_panel_stats' && (!Array.isArray(p.stats) || p.stats.length < 2 || p.stats.some((k: string) => !stats.includes(k) || k === 'hp') || new Set(p.stats).size !== p.stats.length || !['max', 'sum', 'restore'].includes(p.mode) || typeof p.key !== 'string' || !p.key)) return '能力合併需不重複非體力能力、最大值／總和／還原及快照鍵';
  if (op === 'record_round_user' && (!['self', 'opp'].includes(p.side) || typeof p.key !== 'string' || !p.key)) return '出手紀錄需自身／對手及紀錄鍵';
  return null;
}
export function ownerLinkCondition(ctx: BattleEventContext, c: any): boolean | undefined {
  if (c.c !== 'round_first_user') return undefined;
  const saved = ctx.getPlayerState(c.p.key);
  const first = saved?.round === ctx.roundNumber ? saved.first : undefined;
  return c.p.side === 'none' ? !first : first === (c.p.side === 'self' ? ctx.actor : ctx.targetSide);
}
export function ownerLinkOperations() {
  return {
    summon_fixed_extra: (ctx: BattleEventContext, p: any) => {
      if (ctx.getFullTeam(ctx.actor).some(e => e.isExtra && e.name === p.name && e.summonerId === idOf(ctx.self))) return false;
      const fixed = Object.fromEntries(stats.map(k => [k, p.value])) as any;
      const extra = createExtraElf(ctx.self, { name: p.name, type: p.type, gender: p.gender, baseStats: { ...fixed }, calculatedStats: fixed, currentHp: p.value, maxHp: p.value,
        soulMark: { name: '額外精靈', description: p.description, effectType: 'none', effectValue: 0 } });
      ctx.addExtraElf(ctx.actor, extra);
      ctx.addLog(`【${ctx.self.name}】召喚額外精靈【${p.name}】。`, 'effect');
      return true;
    },
    retire_summoned_extra: (ctx: BattleEventContext, p: any) => {
      let found = false;
      for (const elf of ctx.getFullTeam(ctx.actor)) {
        if (!elf.isExtra || elf.name !== p.name || elf.summonerId !== idOf(ctx.self) || elf.currentHp <= 0 || elf.isVanished) continue;
        const onceKey=`retiredSummon:${idOf(ctx.self)}:${idOf(elf)}`;
        if(ctx.getPlayerState(onceKey))continue;
        ctx.setPlayerState(onceKey,true);
        if (p.trueDamage) ctx.applyTrueDamageToElf?.(ctx.actor, idOf(elf), p.trueDamage, '召喚者陣亡連動');
        if (p.gender) ctx.updateAnyElf(ctx.actor, idOf(elf), { gender: p.gender });
        // 排在真傷之後結算；不可先清HP，否則已排隊的傷害會失去實際扣血對象。
        ctx.adjustHpToElf?.(ctx.actor, idOf(elf), -elf.currentHp);
        ctx.addLog(`【${p.name}】隨召喚者陣亡。`, 'effect');
        found = true;
      }
      return found;
    },
    combine_panel_stats: (ctx: BattleEventContext, p: any) => {
      const key = `panelOriginal:${idOf(ctx.self)}:${p.key}`;
      const live = ctx.getFullTeam(ctx.actor).find(e => idOf(e) === idOf(ctx.self)) || ctx.self;
      const current = live.calculatedStats;
      let original = ctx.getPlayerState(key);
      if (!original && p.mode === 'restore') return false;
      if (!original) { original = Object.fromEntries(p.stats.map((k: string) => [k, (current as any)[k]])); ctx.setPlayerState(key, original); }
      const value = p.mode === 'max' ? Math.max(...Object.values(original) as number[]) : (Object.values(original) as number[]).reduce((a, b) => a + b, 0);
      const next = { ...current };
      for (const k of p.stats) (next as any)[k] = p.mode === 'restore' ? original[k] : value;
      ctx.updateElf(ctx.actor, { calculatedStats: next });
      if (p.mode === 'restore') ctx.setPlayerState(key, null);
      return true;
    },
    record_round_user: (ctx: BattleEventContext, p: any) => {
      const previous = ctx.getPlayerState(p.key);
      if (previous?.round === ctx.roundNumber) return false;
      ctx.setPlayerState(p.key, { round: ctx.roundNumber, first: p.side === 'self' ? ctx.actor : ctx.targetSide });
      return true;
    },
  };
}
