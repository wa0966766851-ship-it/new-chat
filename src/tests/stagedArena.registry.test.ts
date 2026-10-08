import assert from 'node:assert/strict';
import type { Elf } from '../types';
import type { BattleEventContext } from '../effects/types';
import { EffectTiming } from '../effects/types';
import { STAGED_ARENA_ELVES } from '../data/stagedArenaElves';
import { STAGED_ARENA_SKILLS, STAGED_ARENA_SOULS } from '../effects/elves/staged-arena/index';
import { read } from '../effects/elves/staged-arena/shared';
import { awake, triggerDragonSoulMarks } from '../effects/elves/staged-arena/dragonHealingRegistry';
import { giveWujiMark, wujiMarkRounds, WUJI_MARK_DEFS } from '../effects/elves/staged-arena/wujiRegistry';
import { statusChanceBlocked } from '../battle/statusChanceRules';
import { finishMoiraiCounter, finishMoiraiFifth, settleYinYangHit } from '../effects/elves/staged-arena/moiraiRegistry';
import { invertPP, transformWuweiSkill, wuweiPower } from '../effects/elves/staged-arena/wuweiRegistry';
import { resolvePetIds, SEER_ID_OVERRIDES } from '../battle/seerAssets';

function setup(name: string) {
  const seed = STAGED_ARENA_ELVES.find(e => e.name === name)!;
  const self = { ...seed, battleId: seed.id, maxHp: 400, currentHp: 400,
    calculatedStats: { hp: 400, atk: 100, spatk: 120, def: 110, spdef: 110, speed: 140 },
    skills: seed.skills.map(s => ({ ...s })) } as Elf;
  const target = { ...self, id: 'foe', battleId: 'foe', name: '對手', maxHp: 600, currentHp: 600, shield: 0, barrier: 0,
    skills: [{ ...self.skills[0], name: '對手技能', pp: 5, currentPp: 5, maxPp: 5 }] } as Elf;
  const state = new Map<string, any>(), damage: Array<{ amount: number; kind: string }> = [], marks: any[] = [], extras: any[] = [];
  const c = {
    self, target, activeP1: self, activeP2: target, actor: 'p1', targetSide: 'p2', skill: self.skills[0],
    getPlayerState: (k: string) => state.get(k), setPlayerState: (k: string, v: any) => state.set(k, v),
    getOpponentState: (k: string) => state.get(`opp.${k}`), setOpponentState: (k: string, v: any) => state.set(`opp.${k}`, v),
    getFullTeam: (side: string) => side === 'p1' ? [self] : [target],
    getStatuses: (elf: Elf) => elf.battleStatuses || {},
    updateElf: (side: string, patch: Partial<Elf>) => Object.assign(side === 'p1' ? self : target, patch),
    applyStatChange: (side: string, changes: Record<string, number>) => {
      const elf = side === 'p1' ? self : target;
      elf.statStages ||= { atk: 0, spatk: 0, def: 0, spdef: 0, speed: 0, accuracy: 0 };
      for (const [stat, n] of Object.entries(changes)) (elf.statStages as any)[stat] = Math.max(-6, Math.min(6, ((elf.statStages as any)[stat] || 0) + n));
    },
    applyPinkDamage: (_side: string, amount: number, _label: string, _p1: unknown, _p2: unknown, kind: string) => { damage.push({ amount, kind }); return amount; },
    applyTrueDamage: (_side: string, amount: number) => { damage.push({ amount, kind: 'true' }); return amount; },
    applyFixedDamage: (_side: string, amount: number) => { damage.push({ amount, kind: 'fixed' }); return amount; },
    applyAbsorb: (_side: string, amount: number) => { target.currentHp -= amount; self.currentHp += amount; },
    applyHeal: (_side: string, amount: number) => { self.currentHp = Math.min(self.maxHp, self.currentHp + amount); },
    adjustHp: (_side: string, amount: number) => { self.currentHp += amount; },
    applyShield: (_side: string, amount: number) => { self.shield = (self.shield || 0) + amount; },
    clearTurnEffectsOf: () => true,
    applyStatusWithImmunityCheck: () => ({ success: true, immune: false }),
    setMark: (m: unknown) => { marks.push(m); }, clearMark: () => {},
    rng: () => .1, addLog: () => {},
    applySkillTypeDamage: (_side: string, amount: number, _label: string, opts: any) => { damage.push({ amount, kind: opts?.category === 'skill_extra_action' ? 'extra' : `typed:${opts?.elem}` }); target.currentHp -= amount; return amount; },
    queueExtraAction: (_owner: string, action: any) => { extras.push(action); },
    updateAnyElf: (side: string, _id: string, patch: Partial<Elf>) => Object.assign(side === 'p1' ? self : target, patch),
    getMarks: () => marks,
  } as unknown as BattleEventContext;
  return { c, self, target, damage, marks, state, extras };
}

assert.equal(STAGED_ARENA_ELVES.length, 5);
assert.equal(Object.keys(STAGED_ARENA_SKILLS).length, 25);
for (const e of STAGED_ARENA_ELVES) {
  assert.equal(e.skills.length, 5);
  assert.ok(STAGED_ARENA_SOULS[e.name]);
  for (const s of e.skills) assert.ok(STAGED_ARENA_SKILLS[s.name], s.name);
}
assert.equal(invertPP(1, 8), 7);
assert.equal(wuweiPower(0, 6, false), 470);
{
  const { c, self } = setup('無為龍者');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ON_ENTRANCE);
  assert.equal(self.maxHp, 490); // (400 + 100 + 120 + 110 + 110 + 140) / 2
  const ppCostComp = { base: 1 };
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_SKILL, { ppCostComp });
  assert.equal(ppCostComp.base, 0);
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.equal(self.skills[0].currentPp, 0); // 8/8 PP swaps with 0 missing PP
  c.skill = self.skills[4];
  assert.equal(transformWuweiSkill(c, self.skills[4]).power, 170);
  assert.equal(transformWuweiSkill(c, self.skills[4]).isSureHit, true);
}
{
  const { c, self } = setup('龍錄天鋒');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ON_ENTRANCE);
  assert.equal(read(c, 'cap'), 2);
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ON_ENTRANCE);
  assert.equal(read(c, 'attack'), 2);
  for (let i = 0; i < 4; i++) STAGED_ARENA_SOULS[self.name](c, EffectTiming.ON_ENTRANCE);
  assert.equal(read(c, 'cap'), 0); // sixth activation clears earlier effects
}
{
  const { c, self, marks } = setup('無極聖武');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ON_ENTRANCE);
  assert.equal(marks[0].id, 'arena.heroGlory');
}
{
  const { c, self, target } = setup('命運龍輪 莫伊萊');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_START);
  assert.equal(self.statStages?.atk, 1);
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_END);
  assert.equal(self.shield, 200); // opponent did not use a skill: both start branches
  assert.equal(target.skills[0].currentPp, 0); // plus both end branches
}
{
  const { c, self, damage, state } = setup('命運龍輪 莫伊萊');
  finishMoiraiFifth(c, 301);
  assert.deepEqual(damage[0], { amount: 100, kind: 'percent' });
  assert.equal(state.get('blkImmuneStatusCount'), 1, '高於300：免疫下一次異常（次數型）');
  (c as any).applyPinkDamage = () => 0; // 對手免疫百分比傷害
  finishMoiraiFifth(c, 299);
  assert.deepEqual(damage[1], { amount: 100, kind: 'true' }, '百分比被免疫時轉真實傷害');
  assert.equal(read(c, 'critFrom'), 1, '低於300：下2回合必定致命一擊');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_START);
  c.skill = self.skills[0];
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_SKILL);
  assert.equal(state.get('mustCrit'), true);
}
{
  const { c, self, damage } = setup('命運龍輪 莫伊萊');
  assert.equal(settleYinYangHit(c), true); // deterministic 0.1 < 0.2
  assert.deepEqual(damage[0], { amount: 100, kind: 'fixed' });
  c.skill = self.skills[3];
  STAGED_ARENA_SKILLS['陰陽三合'](c);
  assert.equal(c.getPlayerState('attackHitCountThisAction'), 5, '5～10 次攻擊交給通用逐擊流程');
  for (let i = 0; i < 5; i++) STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ATTACK_HIT, { skill: self.skills[3], hitIndex: i, hitCount: 5, damage: 10, additionalEffectsEnabled: true });
  assert.equal(damage.filter(d => d.kind === 'fixed').length, 6, '每次實際命中各判定一次 20%');
  // 日月安屬：抵擋下一次攻擊並反擊抵擋前傷害 100% 百分比傷害
  c.setPlayerState(`arena.${self.battleId}.counter`, 1);
  const damageComp = { base: 200, increasePercent: .5, decreasePercent: 0, multiplier: 1, damageCategory: 'skill_attack', isIncoming: true };
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_DAMAGE, { damageComp });
  assert.equal(damageComp.multiplier, 0);
  assert.deepEqual(damage.at(-1), { amount: 300, kind: 'percent' });
  assert.equal(finishMoiraiCounter(c, 75), 0, '只觸發一次');
  // 恆·蒼穹斗轉：攻擊結算後用累計實際傷害判 300
  c.skill = self.skills[4];
  STAGED_ARENA_SKILLS['恆·蒼穹斗轉'](c);
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ATTACK_HIT, { skill: self.skills[4], hitIndex: 0, hitCount: 1, damage: 350, additionalEffectsEnabled: true });
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.equal(c.getPlayerState('blkImmuneStatusCount'), 1);
  assert.deepEqual(damage.at(-1), { amount: 100, kind: 'percent' });
}
{
  const { c, self, damage } = setup('龍錄天鋒');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_START);
  c.skill = self.skills[0];
  STAGED_ARENA_SKILLS['鋒毫浸血雨'](c);
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ATTACK_HIT, { skill: self.skills[0], hitIndex: 0, hitCount: 1, damage: 100 });
  assert.equal(damage.length, 0, '本回合施放不觸發，下1回合才觸發');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_START);
  const hp = self.currentHp;
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ATTACK_HIT, { skill: self.skills[2], hitIndex: 0, hitCount: 1, damage: 100 });
  assert.equal(self.currentHp, hp - Math.floor(hp / 2));
  assert.deepEqual(damage[0], { amount: Math.floor(hp / 2), kind: 'percent' });
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ATTACK_HIT, { skill: self.skills[2], hitIndex: 0, hitCount: 1, damage: 100 });
  assert.equal(damage.length, 1, '只觸發一次');
}
{
  const { c, self, damage } = setup('鎮世龍魂・龍之治癒');
  assert.equal(awake(c, 0), 1);
  assert.equal(awake(c, 0), 1);
  assert.equal(self.maxHp, 500); // only one +25% temporary max HP
  STAGED_ARENA_SKILLS['剛莖棍壓'](c);
  assert.deepEqual(damage[0], { amount: 100, kind: 'percent' });
}
{
  const { c, self, target, marks } = setup('鎮世龍魂・龍之治癒');
  target.type = '火.龍'; target.originalType = '火.龍';
  (c as any).applyStatusWithImmunityCheck = () => ({ success: false, immune: true });
  c.skill = self.skills[1];
  STAGED_ARENA_SKILLS['挨打要立正'](c);
  assert.equal(target.type, '普通'); assert.equal(target.typePeeled, true);
  STAGED_ARENA_SKILLS['挨打要立正'](c);
  assert.equal(read(c, 'soulMark'), 1, '已剝離不重複剝離');
  assert.equal(read(c, 'soulMark'), 1, '附加失敗：龍魂印記 +1（只 +1 層）');
  assert.equal(marks.at(-1).name, '龍魂印記');
  const { switchBattleSide } = await import('../battle/stateScopes');
  const foeTeam = [target, { ...target, id: 'b', battleId: 'b', type: '水', typePeeled: false }];
  const st: any = { p2: target, p2Team: foeTeam, p2ActiveIndex: 0, p2RegistryState: {}, p2ElfState: {}, p2Timers: [], p2Marks: [] };
  const next = switchBattleSide(st, 'p2', 1);
  assert.equal(next.p2Team[0].type, '火.龍', '下場恢復原屬性');
  assert.equal(next.p2Team[0].typePeeled, false);
}
{
  const { c, self, target, damage, extras } = setup('鎮世龍魂・龍之治癒');
  self.calculatedStats = { hp: 400, atk: 100, spatk: 120, def: 110, spdef: 110, speed: 140 } as any;
  target.calculatedStats = { ...self.calculatedStats } as any;
  c.setPlayerState(`arena.${self.battleId}.dragons`, 15);
  c.setPlayerState(`arena.${self.battleId}.trueDragon`, 1);
  c.skill = self.skills[3]; // 雅髯獅嘯（攻擊）
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.equal(extras.length, 1, '真龍：排入一個額外行動節點');
  target.currentHp = 99999; target.maxHp = 99999;
  extras[0].run(c);
  assert.equal(damage.filter(d => d.kind === 'extra').length, 4, '額外使用 4 次');
  c.skill = self.skills[1]; // 屬性技能
  const before = damage.length;
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.deepEqual(damage.slice(before).map(d => d.kind), ['percent', 'typed:龍', 'typed:龍', 'typed:龍', 'typed:龍'], '真龍：蒼龍 50% 百分比吸取＋屬性技能每條龍 150 龍系');
}
{
  // 無極聖武：砥礪 → 亮節／威怯；三者為印記（官方定義）
  const { c, self, target, marks, state } = setup('無極聖武');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ELF_ENTERED, { enteredSide: 'p2', enteredId: 'foe' });
  c.setOpponentState('teamDiliOutcome.foe', 'success');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_END);
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.liangjie'), 3, '砥礪觸發成功 → 3 回合亮節');
  assert.equal(marks.at(-1).name, '亮節');
  assert.equal(statusChanceBlocked({ actor: 'p2', getMarks: () => marks.filter((m: any) => m.count > 0) } as any, 30), true, '亮節：≤50% 異常機率降為 0');
  assert.equal(statusChanceBlocked({ actor: 'p2', getMarks: () => marks.filter((m: any) => m.count > 0) } as any, 60), false);
  (c as any).applyStatusWithImmunityCheck = () => ({ success: false, immune: true });
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ELF_ENTERED, { enteredSide: 'p2', enteredId: 'foe' });
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.weiyue'), 3, '砥礪未成功 → 3 回合威怯');
  assert.equal(WUJI_MARK_DEFS['arena.weiyue'].effects.nonTrueDamageDealtMultiplier, 0.4);
  for (let i = 0; i < 3; i++) STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_END);
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.weiyue'), 0, '3 回合後消失');
  // 武誅：攻擊時已有武誅 → ①每回合 +20%，使用後消除；無視攻擊免疫成功 → 威怯
  giveWujiMark(c, 'p2', 'foe', 'arena.wuzhu', 2);
  c.skill = self.skills[0];
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_SKILL);
  assert.equal(state.get('oppBoostAsDropThisAction'), true);
  const damageComp = { base: 100, multiplier: 1, increasePercent: 0, decreasePercent: 0, damageCategory: 'skill_attack', isIncoming: false };
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_DAMAGE, { damageComp });
  assert.ok(Math.abs(damageComp.multiplier - 1.4) < 1e-9);
  c.setPlayerState('attackImmunityIgnoredThisAction', true);
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.wuzhu'), 0);
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.weiyue'), 3);
  void target;
}
{
  const { c, self, damage } = setup('鎮世龍魂・龍之治癒');
  c.setPlayerState(`arena.${self.battleId}.dragons`, 3);
  c.setPlayerState(`arena.${self.battleId}.soulMark`, 2);
  (c as any).target.maxHp = 99999; (c as any).target.currentHp = 99999;
  triggerDragonSoulMarks(c);
  assert.deepEqual(damage.map(d => [d.amount, d.kind]), Array(4).fill([150, 'typed:龍']), '2 層 × 2 條龍 = 4 次 150 龍系');
  c.setPlayerState(`arena.${self.battleId}.dragonSoulSource`, 1);
  triggerDragonSoulMarks(c);
  assert.equal(damage.at(-1)!.amount, 250, '龍魂之源：每條已喚醒龍 +50');
}
for (const [name, id] of Object.entries({ '無為龍者': 4661, '龍錄天鋒': 4903, '無極聖武': 4800, '命運龍輪 莫伊萊': 4275 })) {
  assert.equal(SEER_ID_OVERRIDES[name], id);
  assert.equal(resolvePetIds({ name, id: 'arena' })[0], id);
}
assert.equal(SEER_ID_OVERRIDES['鎮世龍魂・龍之治癒'], undefined);
console.log('Staged Arena: five registries, PP, entry, random branches, awakening, damage type, image mapping passed.');
