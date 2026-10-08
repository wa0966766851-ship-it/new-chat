import type { BattleSkillHandler, DamageComputation } from '../../types';
import { EffectTiming } from '../../types';
import { StatusRegistry } from '../../statusRegistry';
import { STATS, clearStatuses, activeUntil, bump, damagePercentOfTarget, grantStatusImmunity, live, modify, read, restorePP, reverseDrops, status, until, write, type ArenaContext } from './shared';

const HERO = 'arena.heroGlory';
const WUZHU = 'arena.wuzhu';
const LIANGJIE = 'arena.liangjie';
const WEIYUE = 'arena.weiyue';
const LEDGER = 'teamArenaWujiLedger';
const PENDING = 'teamArenaWujiDili';
type Side = 'p1' | 'p2';
type Entry = { id: string; side: Side; owner: string; rounds: number };

/** 官方定義（SeerAPI 名詞表）；三者皆為印記，不是異常狀態。 */
export const WUJI_MARK_DEFS: Record<string, { name: string; displayChar: string; polarity: 'positive' | 'negative'; description: string; effects: Record<string, any> }> = {
  [WUZHU]: { name: '武誅', displayChar: '誅', polarity: 'negative',
    description: '對手為無極聖武時所有技能先制-2；自身體力高於1/2時受到的攻擊傷害額外提升50%，低於1/2時造成的攻擊傷害額外減少50%',
    effects: { priorityBonus: -2, vsOpponentName: '無極聖武', attackTakenMultAboveHalfHp: 1.5, attackDealtMultBelowHalfHp: 0.5 } },
  [LIANGJIE]: { name: '亮節', displayChar: '節', polarity: 'positive',
    description: '自身機率不高於50%的異常狀態附加效果機率下降至0；每回合結束時，為對手PP值為0的技能恢復5點PP值',
    effects: { statusChanceZeroAtMost50: true } },
  [WEIYUE]: { name: '威怯', displayChar: '怯', polarity: 'negative',
    description: '自身造成的非真實傷害額外減少60%',
    effects: { nonTrueDamageDealtMultiplier: 0.4 } },
};

const idOf = (e: { battleId?: string; id: string }) => e.battleId || e.id;
const ledger = (c: ArenaContext): Entry[] => { const v = c.getPlayerState(LEDGER); return Array.isArray(v) ? v : []; };
const pendingList = (c: ArenaContext): { side: Side; owner: string }[] => { const v = c.getPlayerState(PENDING); return Array.isArray(v) ? v : []; };
const activeOf = (c: ArenaContext, side: Side) => side === 'p1' ? c.activeP1 : c.activeP2;
const sideState = (c: ArenaContext, side: Side, key: string) => side === c.actor ? c.getPlayerState(key) : c.getOpponentState(key);
const setSideState = (c: ArenaContext, side: Side, key: string, v: any) => side === c.actor ? c.setPlayerState(key, v) : c.setOpponentState(key, v);

function showMark(c: ArenaContext, side: Side, owner: string, id: string, rounds: number): void {
  c.setMark({ ...WUJI_MARK_DEFS[id], id, source: '無極聖武', ownerBattleId: owner, count: Math.max(0, rounds),
    unit: '回合', clearable: false, persistsOffField: true } as any, side);
}
/** 賦予／覆寫印記回合數。 */
export function giveWujiMark(c: ArenaContext, side: Side, owner: string, id: string, rounds: number): void {
  if (rounds <= 0) return;
  const list = ledger(c).filter(e => !(e.id === id && e.side === side && e.owner === owner));
  c.setPlayerState(LEDGER, [...list, { id, side, owner, rounds }]);
  showMark(c, side, owner, id, rounds);
  c.addLog(`⚔️ 【無極聖武】：令 ${(c.getFullTeam(side).find(e => idOf(e) === owner) || { name: '精靈' }).name} 獲得 ${rounds} 回合【${WUJI_MARK_DEFS[id].name}】。`, 'effect');
}
export function wujiMarkRounds(c: ArenaContext, side: Side, owner: string, id: string): number {
  return ledger(c).find(e => e.id === id && e.side === side && e.owner === owner)?.rounds || 0;
}
function removeWujiMark(c: ArenaContext, side: Side, owner: string, id: string): void {
  c.setPlayerState(LEDGER, ledger(c).filter(e => !(e.id === id && e.side === side && e.owner === owner)));
  showMark(c, side, owner, id, 0);
}

/**
 * 特性描述是否含「機率不高於 50% 的異常狀態附加效果」（例：帶電 8% 使對方麻痺、30% 令對手害怕）。
 * 只看「使／令對方陷入異常狀態」且機率 ≤ 50%；能力等級變化、秒殺、免死、反彈等不算。
 */
export function hasLowChanceStatusTrait(desc: string): boolean {
  const names = [...Object.keys(StatusRegistry).filter(k => k.length >= 2 && !/[.*+?^${}()|[\]\\]/.test(k)), '異常狀態', '異常'];
  const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%[^。；;\\n%]{0,16}?(?:使|令|讓)?(?:對方|對手)?(?:陷入|進入|處於)?(?:${names.join('|')})`, 'g');
  for (const m of desc.matchAll(re)) if (Number(m[1]) <= 50 && !/解除|消除|免疫|抵抗|自身|己方/.test(m[0])) return true;
  return false;
}

/** 英雄之耀檢測的「特性」：專屬特性（魂印）與通用特性；不含二代／專屬／異能特質。 */
export function heroGloryTraitTexts(e: { soulMark?: { description?: string }; trait?: { description?: string }; alienTraits?: { generalTrait?: { description?: string } } }): string[] {
  return [e.soulMark?.description, e.trait?.description, e.alienTraits?.generalTrait?.description].filter((d): d is string => !!d);
}
export const countsAgainstHeroGlory = (e: Parameters<typeof heroGloryTraitTexts>[0]) => heroGloryTraitTexts(e).some(hasLowChanceStatusTrait);

export const heroGloryGain = (atk: number, spatk: number, layers: number) => Math.floor(Math.abs((atk || 0) - (spatk || 0)) * 0.15 * Math.max(0, layers));

/** 英雄之耀（官方）：每有1層，自身其他能力值提升自身雙攻差值的15%。 */
export function applyHeroGloryStats(c: ArenaContext, layers: number): void {
  if (layers <= 0) return;
  const st = c.self.calculatedStats;
  const gain = heroGloryGain(st.atk, st.spatk, layers);
  write(c, 'heroGain', gain); write(c, 'heroDiff', Math.abs((st.atk || 0) - (st.spatk || 0)));
  if (!gain) return;
  c.updateElf(c.actor, {
    calculatedStats: { ...st, hp: (st.hp || 0) + gain, def: st.def + gain, spdef: st.spdef + gain, speed: st.speed + gain },
    maxHp: c.self.maxHp + gain, currentHp: c.self.currentHp + gain,
  });
  c.addLog(`⚔️ 【英雄之耀】×${layers}：體力、防禦、特防、速度各提升 ${gain}！`, 'effect');
}

function roundEnd(c: ArenaContext): void {
  // 1. 亮節：持有者在場時，回合結束為對手 PP 為 0 的技能恢復 5 點 PP。
  for (const e of ledger(c).filter(e => e.id === LIANGJIE)) {
    const holder = activeOf(c, e.side);
    if (!holder || idOf(holder) !== e.owner || holder.currentHp <= 0) continue;
    const foeSide: Side = e.side === 'p1' ? 'p2' : 'p1';
    const foe = activeOf(c, foeSide);
    if (!foe || foe.currentHp <= 0) continue;
    let restored = 0;
    const skills = foe.skills.map(s => {
      if ((s.currentPp ?? s.pp) !== 0) return s;
      const pp = Math.min(s.maxPp ?? 5, 5); restored += pp;
      return { ...s, pp, currentPp: pp };
    });
    if (restored) { c.updateAnyElf(foeSide, idOf(foe), { skills }); c.addLog(`⚔️ 【亮節】：為 ${foe.name} 的 0 PP 技能恢復 PP。`, 'effect'); }
  }
  // 2. 回合遞減。
  const next: Entry[] = [];
  for (const e of ledger(c)) {
    const rounds = e.rounds - 1;
    showMark(c, e.side, e.owner, e.id, rounds);
    if (rounds > 0) next.push({ ...e, rounds });
  }
  c.setPlayerState(LEDGER, next);
  // 3. 砥礪判定：成功（觸發恢復）→ 3 回合亮節；未觸發／失敗 → 3 回合威怯。砥礪 1 回合，於登場當回合結束判定。
  for (const p of pendingList(c)) {
    const key = `teamDiliOutcome.${p.owner}`;
    const outcome = sideState(c, p.side, key);
    setSideState(c, p.side, key, undefined);
    giveWujiMark(c, p.side, p.owner, outcome === 'success' ? LIANGJIE : WEIYUE, 3);
  }
  c.setPlayerState(PENDING, []);
}

export function handleWujiSoulMark(c: ArenaContext, event: EffectTiming, data?: any): void {
  if (event === EffectTiming.ELF_ENTERED && data?.enteredSide) {
    // 自身位於出戰背包時，任意一方精靈登場：僅令該次登場的精靈受到 1 回合【砥礪】。
    const side = data.enteredSide as Side;
    if (c.self.currentHp <= 0 || data.enteredId === idOf(c.self)) return;
    const entered = activeOf(c, side);
    if (!entered || idOf(entered) !== data.enteredId) return;
    const res = c.applyStatusWithImmunityCheck(side, '砥礪', 1);
    if (res.success) c.setPlayerState(PENDING, [...pendingList(c).filter(p => p.owner !== data.enteredId), { side, owner: data.enteredId }]);
    else giveWujiMark(c, side, data.enteredId, WEIYUE, 3);
    return;
  }
  if (event === EffectTiming.ROUND_END) roundEnd(c);
  if (!live(c)) return;
  if (event === EffectTiming.ON_ENTRANCE) {
    if (!read(c, 'initialized')) {
      const own = c.getFullTeam(c.actor).filter(e => idOf(e) !== idOf(c.self));
      const layers = own.reduce((n, e) => n + (countsAgainstHeroGlory(e) ? -1 : 1), 0);
      write(c, 'hero', Math.max(0, layers)); write(c, 'initialized', 1);
      applyHeroGloryStats(c, read(c, 'hero'));
      // 英雄之耀達到 3 層：烈武天徵、亂武天傀、鋭武銘戈不受 PP 值限制。
      if (read(c, 'hero') >= 3) c.updateElf(c.actor, { skills: c.self.skills.map(s => HERO_FREE_SKILLS.includes(s.name) ? { ...s, ignorePpLimit: true } as any : s) });
    }
    c.setMark({ id: HERO, name: '英雄之耀', displayChar: '耀', source: '無極聖武', ownerBattleId: idOf(c.self), count: read(c, 'hero'),
      unit: '層', persistsOffField: true, clearable: false, polarity: 'positive',
      description: heroGloryDescription(read(c, 'hero'), read(c, 'heroGain'), read(c, 'heroDiff')) } as any, c.actor);
    // 官方：自身登場時，每層為對手附加 1 回合武誅。
    if (read(c, 'hero') && c.target.currentHp > 0) giveWujiMark(c, c.targetSide, idOf(c.target), WUZHU, read(c, 'hero'));
  }
  if (event === EffectTiming.ROUND_START) bump(c, 'round');
  if (event === EffectTiming.MODIFY_PRIORITY && c.skill?.name === '鋭武銘戈' && read(c, 'hero') >= 3 && data?.priorityComp) data.priorityComp.bonus += 1;
  if (event === EffectTiming.BEFORE_SKILL && c.skill && c.skill.category !== '屬性') {
    // 自身攻擊無視對手的能力提升效果、護盾效果與攻擊技能免疫效果。
    c.setPlayerState('ignoreAttackImmunityThisAction', true);
    c.setPlayerState('ignoreShieldThisAction', true);
    c.setPlayerState('ignoreOppBuffThisAction', true);
    const armed = wujiMarkRounds(c, c.targetSide, idOf(c.target), WUZHU);
    write(c, 'armed', armed);
    if (armed) {
      c.setPlayerState('oppBoostAsDropThisAction', true);   // ②
      c.setPlayerState('selfDropAsOppDropThisAction', true); // ③
    }
  }
  if (event === EffectTiming.BEFORE_DAMAGE && data?.damageComp) {
    const d = data.damageComp as DamageComputation;
    const armed = read(c, 'armed');
    if (!d.isIncoming && d.damageCategory === 'skill_attack' && armed) {
      const shieldSteps = Math.min(10, Math.floor(((c.target.shield || 0) + (c.target.barrier || 0)) / 100));
      d.multiplier *= (1 + armed * .2) * (1 + shieldSteps * .1); // ①④
    }
  }
  if (event === EffectTiming.AFTER_ACTION && c.skill && c.skill.category !== '屬性') {
    const armed = read(c, 'armed');
    write(c, 'armed', 0);
    if (armed) {
      removeWujiMark(c, c.targetSide, idOf(c.target), WUZHU);
      if (c.getPlayerState('attackImmunityIgnoredThisAction') && c.target.currentHp > 0) giveWujiMark(c, c.targetSide, idOf(c.target), WEIYUE, 3); // ⑤
    } else if (read(c, 'hero') && c.target.currentHp > 0) giveWujiMark(c, c.targetSide, idOf(c.target), WUZHU, read(c, 'hero'));
  }
}

/** 英雄之耀印記說明：層數與實際加成綁定顯示。 */
export function heroGloryDescription(layers: number, gain: number, diff: number): string {
  const base = '每有1層，自身其他能力值提升自身雙攻差值的15%且自身登場時為對手附加1回合武誅';
  const now = layers > 0
    ? `目前 ${layers} 層：體力、防禦、特防、速度各 +${gain}（雙攻差 ${diff} × 15% × ${layers}）；登場附加 ${layers} 回合武誅`
    : '目前 0 層：無能力加成';
  return `${base}\n${now}${layers >= 3 ? '\n已達 3 層：烈武天徵、亂武天傀、鋭武銘戈強化' : ''}`;
}

const HERO_FREE_SKILLS = ['烈武天徵', '亂武天傀', '鋭武銘戈'];

export const WUJI_SKILLS: Record<string, BattleSkillHandler> = {
  '極武稜殺': c => { c.setPlayerState('ignoreDamageLimitThisAction', true); until(c, 'nextDamageBoost', 1); },
  '烈武天徵': c => {
    if (read(c, 'hero') >= 3) c.clearTurnEffectsOf(c.actor); // 英雄之耀3層：選擇使用時消除自身回合類效果
    modify(c, c.actor, c.self.currentHp > c.self.maxHp / 2 ? 2 : 1);
    grantStatusImmunity(c, c.actor, 4); until(c, 'statusReflect', 4); until(c, 'priority', 2);
  },
  '亂武天傀': c => {
    if (read(c, 'hero') >= 3) clearStatuses(c, c.actor); // 英雄之耀3層：選擇使用時解除自身異常狀態
    const removed = c.clearTurnEffectsOf(c.targetSide);
    if (removed) c.applyHeal(c.actor, c.self.maxHp);
    if (c.self.currentHp < c.target.currentHp) c.setPlayerState('blockAttackCount', 1);
    else if (c.self.currentHp > c.target.currentHp) giveWujiMark(c, c.targetSide, idOf(c.target), WEIYUE, 3);
    const missing = c.self.skills.reduce((n, s) => n + Math.max(0, (s.maxPp ?? s.pp) - (s.currentPp ?? s.pp)), 0);
    restorePP(c, c.actor, 1000);
    if (missing) c.applyAbsorb(c.targetSide, missing * 40);
  },
  '鋭武銘戈': c => {
    if (c.clearTurnEffectsOf(c.targetSide)) c.setOpponentState('priorityPenaltyTurns', 2);
    let levels = 0;
    for (const s of STATS) levels += Math.max(0, c.target.statStages?.[s] || 0);
    if (levels) {
      c.applyStatChange(c.targetSide, Object.fromEntries(STATS.map(s => [s, -Math.max(0, c.target.statStages?.[s] || 0)])));
      c.applyFixedDamage(c.targetSide, levels * 40, '鋭武銘戈');
    }
    if (reverseDrops(c, c.actor)) c.setOpponentState('attackSkillInvalidTurns', 1);
  },
  '聖武·虛極拓世': c => {
    if (c.goesFirst) c.setPlayerState('mustCrit', true);
    const turns = wujiMarkRounds(c, c.targetSide, idOf(c.target), WEIYUE);
    if (turns) c.setOpponentState('allSkillInvalidTurns', turns);
    until(c, 'nextDamageBoost', 1);
    const dealt = damagePercentOfTarget(c, 1 / 3, '聖武·虛極拓世');
    if (dealt > 0 && c.target.currentHp > 0) c.applyHeal(c.actor, dealt);
    if (c.target.currentHp <= 0) grantStatusImmunity(c, c.actor, 2);
  },
};
