import { multiplyDamageReduction } from '../../../battle/damageReduction';
import type { BattleSkillHandler, DamageComputation } from '../../types';
import { EffectTiming } from '../../types';
import { bypassesAttackDefense } from '../../../battle/attackDefense';
import { calculateDamage } from '../../../utils/damageCalculator';
import { STATS, activeUntil, bump, damagePercentOfTarget, hasBoost, hasDrop, live, modify, percent, read, restorePP, status, transferBoosts, until, write, type ArenaContext } from './shared';

export function awake(c: ArenaContext, index: number): number {
  const bit = 1 << index;
  const current = read(c, 'dragons');
  if (current & bit) return current;
  const next = current | bit;
  write(c, 'dragons', next);
  const base = c.self.calculatedStats;
  const extraHp = Math.floor(base.hp * .25);
  c.updateElf(c.actor, {
    maxHp: c.self.maxHp + extraHp, currentHp: c.self.currentHp + extraHp,
    calculatedStats: { ...base, atk: Math.floor(base.atk * 1.25), spatk: Math.floor(base.spatk * 1.25), def: Math.floor(base.def * 1.25), spdef: Math.floor(base.spdef * 1.25), speed: Math.floor(base.speed * 1.25) },
  });
  return next;
}
export const awakeCount = (mask: number) => [1, 2, 4, 8].filter(bit => mask & bit).length;

export function handleDragonHealingSoulMark(c: ArenaContext, event: EffectTiming, data?: any): void {
  if (!live(c)) return;
  if (event === EffectTiming.ROUND_START) bump(c, 'round');
  if (event === EffectTiming.BEFORE_SKILL && c.skill) {
    const index = c.self.skills.findIndex(s => s.name === c.skill.name);
    if (index >= 0 && index < 4) awake(c, index);
    if (index === 4 && read(c, 'dragons') === 15) write(c, 'trueDragon', 1);
    if (read(c, 'trueDragon') && data?.ppCostComp) data.ppCostComp.base = 0;
    if (read(c, 'soulPower') && c.skill.category !== '屬性') applySoulPower(c);
  }
  // 但願不會是個怪物：使用前已擁有龍魂之力 → 對手先制等級無法高於自身。
  if (event === EffectTiming.MODIFY_PRIORITY && c.skill?.name === '但願不會是個怪物' && read(c, 'soulPower')) c.setPlayerState('capOpponentPriorityThisTurn', true);
  if (event === EffectTiming.BEFORE_DAMAGE && data?.damageComp) {
    const d = data.damageComp as DamageComputation;
    const count = awakeCount(read(c, 'dragons'));
    if (!d.isIncoming && d.damageCategory === 'skill_attack') d.multiplier *= 1 + count * .5;
    if (d.isIncoming && d.damageCategory !== 'true') multiplyDamageReduction(d, Math.max(.4, 1 - count * .15));
    if (d.isIncoming && d.damageCategory === 'skill_attack' && (read(c, 'dragons') & 4) && !bypassesAttackDefense(d, 'conversion')) {
      bump(c, 'redStored', Math.min(d.base, Math.max(0, c.self.maxHp - read(c, 'redStored'))));
      d.multiplier = 0;
    }
    if (!d.isIncoming && ['fixed', 'percent'].includes(d.damageCategory) && activeUntil(c, 'specialBoost')) d.multiplier *= 1.5;
  }
  if (event === EffectTiming.ROUND_END) {
    const n = awakeCount(read(c, 'dragons'));
    if (n) { c.applyHeal(c.actor, Math.floor(c.self.maxHp * n / 10)); siphonPP(c, n); }
    // 龍魂之源（挨打要立正）：3 回合內每回合結束吸取對手最大體力 1/3；未造成百分比傷害時改為等量真實傷害並吸取。
    if (activeUntil(c, 'drain') && c.target.currentHp > 0) {
      let dealt = damagePercentOfTarget(c, 1 / 3, '龍魂之源');
      if (!dealt) dealt = Number(c.applyTrueDamage(c.targetSide, Math.floor(c.target.maxHp / 3), '龍魂之源') || 0);
      if (dealt > 0) c.applyHeal(c.actor, dealt);
    }
  }
  if (event === EffectTiming.SKILL_INVALID && !data?.isIncoming && data?.skill?.name === '幽魔相嘯') addSoulMark(c);
  if (event === EffectTiming.ON_SWITCH_OUT) { write(c, 'redStored', 0); write(c, 'redTrue', 0); }
  if (event === EffectTiming.AFTER_ACTION && c.skill?.category !== '屬性') settleRedDragon(c);
  if (event === EffectTiming.AFTER_ACTION && c.skill) triggerDragonSoulMarks(c);
  if (event === EffectTiming.AFTER_ACTION && read(c, 'trueDragon') && c.skill) {
    triggerTrueDragonEffects(c);
    queueTrueDragonEcho(c);
  }
}

export function settleRedDragon(c: ArenaContext): number {
  if (!(read(c, 'dragons') & 4)) return 0;
  const amount = read(c, 'redStored');
  write(c, 'redStored', 0);
  const trueDamage = !!read(c, 'redTrue');
  write(c, 'redTrue', 0);
  if (amount <= 0 || c.target.currentHp <= 0) return 0;
  return trueDamage ? c.applyTrueDamage(c.targetSide, amount, '赤龍') : Number(c.applyFixedDamage(c.targetSide, amount, '赤龍') || 0);
}

/** 剝離對手屬性（轉為普通系）：每剝離一種隨機附加 1 種異常；任一次附加失敗，自身 +1 層龍魂印記。下場時恢復（stateScopes）。 */
export function peelTypes(c: ArenaContext): number {
  // 依來源站：已剝離者不重複剝離；剝離後轉化為普通系（普通系本身不可剝離）。
  if (c.target.typePeeled) return 0;
  const types = String(c.target.type || '').split('.').filter(t => t && t !== '普通' && t !== '無屬性');
  if (!types.length) return 0;
  c.updateElf(c.targetSide, { type: '普通', typePeeled: true, originalType: c.target.originalType || c.target.type });
  c.addLog(`🐉 【挨打要立正】：剝離對手 ${types.join('、')} 屬性！`, 'effect');
  const pool = ['燒傷', '凍傷', '中毒', '麻痺', '害怕', '睡眠'];
  let failed = false;
  for (let i = 0; i < types.length; i++) {
    const name = pool[Math.floor((c.rng?.() ?? Math.random()) * pool.length)];
    if (!status(c, name)) failed = true;
  }
  if (failed) addSoulMark(c);
  return types.length;
}

/** 龍魂印記：層數；效果（每次使用技能後 150 點龍系直接傷害 × 層數 × 已喚醒龍數）由技能後結算處理。 */
export function addSoulMark(c: ArenaContext): number {
  const n = bump(c, 'soulMark');
  c.setMark?.({ id: 'arena.dragonSoulMark', name: '龍魂印記', displayChar: '魂', source: '鎮世龍魂・龍之治癒',
    ownerBattleId: c.self.battleId, count: n, persistsOffField: true, clearable: false, polarity: 'positive',
    description: '每次使用技能後：層數 × 已喚醒龍數 次，每次 150 點龍系直接傷害（龍魂之源每龍 +50）；真龍喚醒後按最高克制' } as any);
  return n;
}

/** 回合結束每條甦醒之龍：隨機吸取對手 1 個技能 1 點 PP，並恢復自身 1 個未滿技能 1 點 PP（來源站程式）。 */
export function siphonPP(c: ArenaContext, n: number): void {
  let foe = c.target.skills.map(s => ({ ...s })), own = c.self.skills.map(s => ({ ...s }));
  for (let i = 0; i < n; i++) {
    const avail = foe.filter(s => (s.currentPp ?? s.pp) > 0);
    if (!avail.length) break;
    const m = avail[Math.floor((c.rng?.() ?? Math.random()) * avail.length)];
    m.currentPp = m.pp = (m.currentPp ?? m.pp) - 1;
    const missing = own.filter(s => (s.currentPp ?? s.pp) < (s.maxPp ?? s.pp));
    if (missing.length) { const o = missing[Math.floor((c.rng?.() ?? Math.random()) * missing.length)]; o.currentPp = o.pp = (o.currentPp ?? o.pp) + 1; }
  }
  c.updateElf(c.targetSide, { skills: foe });
  c.updateElf(c.actor, { skills: own });
}

/** 龍魂之力（來源站程式）：攻擊無視傷害限制、攻擊免疫與抵擋傷害效果。 */
export function applySoulPower(c: ArenaContext): void {
  c.setPlayerState('ignoreDamageLimitThisAction', true);
  c.setPlayerState('ignoreAttackImmunityThisAction', true);
  c.setPlayerState('blkIgnoreBlock', true);
}

/** 龍魂印記（來源站程式）：每次使用技能後，層數 × 已喚醒龍數次，每次 150 點龍系直接傷害；
 *  擁有龍魂之源時每次額外 + 本場已喚醒過的龍數 × 50；真龍・治癒喚醒後按最高克制（4 倍）計算。 */
export function triggerDragonSoulMarks(c: ArenaContext): number {
  const marks = read(c, 'soulMark');
  const dragons = awakeCount(read(c, 'dragons'));
  if (!marks || !dragons || c.target.currentHp <= 0) return 0;
  const base = 150 + (read(c, 'dragonSoulSource') ? dragons * 50 : 0);
  const hits = marks * dragons;
  let dealt = 0;
  for (let i = 0; i < hits; i++) {
    const foe = c.actor === 'p1' ? c.activeP2 : c.activeP1;
    if (!foe || foe.currentHp <= 0) break;
    dealt += read(c, 'trueDragon')
      ? Number(c.applySkillTypeDamage(c.targetSide, Math.floor(base * 4), '龍魂印記（最高克制）', { elem: '普通' } as any) || 0)
      : Number(c.applySkillTypeDamage(c.targetSide, base, '龍魂印記', { elem: '龍' } as any) || 0);
  }
  c.addLog(`🐉 【龍魂印記】×${marks}：${dragons} 條龍共攻擊 ${hits} 次（每次基礎 ${base}）。`, 'effect');
  return dealt;
}

/** 真龍・治癒取消四龍追加效果的觸發條件（來源站程式）：使用技能後無條件觸發
 *  赤龍（屬性技能時結算累計值）→ 金龍消除對手回合類效果 → 玄龍下 3 回合固定／百分比傷害提升 50% → 蒼龍吸取對手最大體力 50% → 屬性技能每條龍 150 龍系傷害。 */
export function triggerTrueDragonEffects(c: ArenaContext): void {
  if (c.skill?.category === '屬性') settleRedDragon(c);
  c.clearTurnEffectsOf(c.targetSide);
  until(c, 'specialBoost', 3);
  if (c.target.currentHp > 0) {
    const drained = percent(c, Math.floor(c.target.maxHp * .5), '蒼龍');
    if (drained > 0) c.applyHeal(c.actor, drained);
  }
  if (c.skill?.category === '屬性') dragonTypeDamage(c);
}

/** 真龍・治癒：使用技能時額外使用 4 次（額外行動節點；不扣 PP、不再觸發額外使用）。 */
export function queueTrueDragonEcho(c: ArenaContext): void {
  const skill = c.skill;
  if (!skill || !c.queueExtraAction) return;
  const name = skill.name;
  c.queueExtraAction(c.actor, {
    label: `真龍・治癒：${name} ×4`,
    run: cx => {
      let dealt = 0;
      const opp = cx.actor === 'p1' ? 'p2' : 'p1';
      for (let i = 0; i < 4; i++) {
        const self = cx.actor === 'p1' ? cx.activeP1 : cx.activeP2;
        const foe = cx.actor === 'p1' ? cx.activeP2 : cx.activeP1;
        if (!self || !foe || self.currentHp <= 0 || foe.currentHp <= 0) break;
        const use = Object.create(cx); use.skill = skill; use.self = self; use.target = foe;
        DRAGON_HEALING_SKILLS[name]?.(use);
        if (skill.category !== '屬性' && skill.power) {
          const res = calculateDamage(self, foe, skill, cx.actor, undefined, undefined, (217 + (cx.rng?.() ?? Math.random()) * 38) / 255);
          dealt += Number(cx.applySkillTypeDamage(opp, Math.max(0, Math.floor(res.damage)), `${name}（額外使用 ${i + 1}/4）`, { elem: skill.type, category: 'skill_extra_action' } as any) || 0);
        } else {
          dealt += dragonTypeDamage(use);
        }
      }
      return dealt;
    },
  });
}

/** 真龍喚醒後使用屬性技能：每條龍額外造成 150 點龍系直接傷害。 */
export function dragonTypeDamage(c: ArenaContext): number {
  const n = awakeCount(read(c, 'dragons'));
  let dealt = 0;
  for (let i = 0; i < n; i++) {
    if (c.target.currentHp <= 0) break;
    dealt += Number(c.applySkillTypeDamage(c.targetSide, 150, '真龍・治癒', { elem: '龍' } as any) || 0);
  }
  return dealt;
}

export const DRAGON_HEALING_SKILLS: Record<string, BattleSkillHandler> = {
  '剛莖棍壓': c => {
    // Own max HP is the value base. Category and immunity are percentage damage.
    const value = Math.floor(c.self.maxHp * .2);
    if (!percent(c, value, '剛莖棍壓') && c.target.currentHp > 0) c.applyTrueDamage(c.targetSide, value, '剛莖棍壓');
  },
  '挨打要立正': c => {
    write(c, 'dragonSoulSource', 1); modify(c, c.actor, 1);
    until(c, 'drain', 3); until(c, 'priority', 2);
    peelTypes(c);
  },
  '幽魔相嘯': c => {
    const hadBoost = hasBoost(c.self) || hasBoost(c.target);
    const hadDrop = hasDrop(c.self) || hasDrop(c.target);
    const removedShield = (c.self.shield || 0) + (c.self.barrier || 0) + (c.target.shield || 0) + (c.target.barrier || 0);
    for (const side of [c.actor, c.targetSide]) {
      const e = side === c.actor ? c.self : c.target;
      c.applyStatChange(side, Object.fromEntries(STATS.map(s => [s, -(e.statStages?.[s] || 0)])));
      c.clearTurnEffectsOf(side);
      c.updateElf(side, { shield: 0, barrier: 0 });
    }
    if (hadBoost) { c.applyStatusWithImmunityCheck(c.actor, '狂暴', 3); status(c, '狂暴', 3); }
    if (hadDrop) write(c, 'redTrue', 1);
    if (c.self.currentHp < c.self.maxHp) {
      const amount = c.self.maxHp - c.self.currentHp;
      c.applyHeal(c.actor, amount);
      percent(c, amount * (c.self.currentHp < c.self.maxHp / 2 ? 2 : 1), '幽魔相嘯');
    }
    if (removedShield) c.applyFixedDamage(c.targetSide, removedShield, '幽魔相嘯');
  },
  '雅髯獅嘯': c => {
    const absorbed = transferBoosts(c);
    if (absorbed) c.applyStatusWithImmunityCheck(c.actor, '狂暴', 3);
    const selfCleansed = Object.values(c.getStatuses(c.self)).filter(n => n > 0).length;
    if (selfCleansed) { c.updateElf(c.actor, { battleStatuses: {}, battleStatus: 'normal' }); c.setOpponentState('allHitEffectNullTurns', 2); }
    const removed = Object.values(c.getStatuses(c.target)).filter(n => n > 0).length;
    if (removed) {
      c.updateElf(c.targetSide, { battleStatuses: {}, battleStatus: 'normal' });
      c.applyFixedDamage(c.targetSide, removed * 200 * (c.self.currentHp > c.target.currentHp ? 2 : 1), '雅髯獅嘯');
    }
  },
  '但願不會是個怪物': c => {
    const already = !!read(c, 'soulPower');
    write(c, 'soulPower', 1);
    applySoulPower(c);
    // 使用前已擁有龍魂之力：本技能固定按最高克制倍率（4 倍）計算；對手先制上限於 MODIFY_PRIORITY 處理。
    if (already) c.setPlayerState('fixedTypeMultThisAction', 4);
    if (c.clearTurnEffectsOf(c.targetSide)) {
      for (const name of ['疲憊', '害怕', '睡眠']) status(c, name, 3);
    }
  },
};
