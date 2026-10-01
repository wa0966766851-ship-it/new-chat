import assert from 'node:assert/strict';
import type { Elf } from '../types';
import type { BattleEventContext } from '../effects/types';
import { EffectTiming } from '../effects/types';
import { STAGED_ARENA_ELVES } from '../data/stagedArenaElves';
import { STAGED_ARENA_SKILLS, STAGED_ARENA_SOULS } from '../effects/stagedArena';
import { read } from '../effects/stagedArena/shared';
import { awake } from '../effects/stagedArena/dragonHealingRegistry';
import { finishMoiraiCounter, finishMoiraiFifth, settleYinYangHit } from '../effects/stagedArena/moiraiRegistry';
import { invertPP, transformWuweiSkill, wuweiPower } from '../effects/stagedArena/wuweiRegistry';
import { resolvePetIds, SEER_ID_OVERRIDES } from '../battle/seerAssets';

function setup(name: string) {
  const seed = STAGED_ARENA_ELVES.find(e => e.name === name)!;
  const self = { ...seed, battleId: seed.id, maxHp: 400, currentHp: 400,
    calculatedStats: { hp: 400, atk: 100, spatk: 120, def: 110, spdef: 110, speed: 140 },
    skills: seed.skills.map(s => ({ ...s })) } as Elf;
  const target = { ...self, id: 'foe', battleId: 'foe', name: '對手', maxHp: 600, currentHp: 600, shield: 0, barrier: 0,
    skills: [{ ...self.skills[0], name: '對手技能', pp: 5, currentPp: 5, maxPp: 5 }] } as Elf;
  const state = new Map<string, any>(), damage: Array<{ amount: number; kind: string }> = [], marks: any[] = [];
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
  } as unknown as BattleEventContext;
  return { c, self, target, damage, marks, state };
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
  const { c, self, damage } = setup('命運龍輪 莫伊萊');
  finishMoiraiFifth(c, 301, false);
  assert.deepEqual(damage[0], { amount: 100, kind: 'percent' });
  assert.equal(self.statusImmuneTurns, 1);
  finishMoiraiFifth(c, 299, true);
  assert.deepEqual(damage[1], { amount: 100, kind: 'true' });
  assert.equal(settleYinYangHit(c), true); // deterministic 0.1 < 0.2
  assert.deepEqual(damage[2], { amount: 100, kind: 'fixed' });
  c.setPlayerState(`arena.${self.battleId}.counterPending`, 1);
  finishMoiraiCounter(c, 75, false);
  assert.deepEqual(damage[3], { amount: 75, kind: 'percent' });
}
{
  const { c, self, damage } = setup('鎮世龍魂・龍之治癒');
  assert.equal(awake(c, 0), 1);
  assert.equal(awake(c, 0), 1);
  assert.equal(self.maxHp, 500); // only one +25% temporary max HP
  STAGED_ARENA_SKILLS['剛莖棍壓'](c);
  assert.deepEqual(damage[0], { amount: 100, kind: 'percent' });
}
for (const [name, id] of Object.entries({ '無為龍者': 4661, '龍錄天鋒': 4903, '無極聖武': 4800, '命運龍輪 莫伊萊': 4275 })) {
  assert.equal(SEER_ID_OVERRIDES[name], id);
  assert.equal(resolvePetIds({ name, id: 'arena' })[0], id);
}
assert.equal(SEER_ID_OVERRIDES['鎮世龍魂・龍之治癒'], undefined);
console.log('Staged Arena: five registries, PP, entry, random branches, awakening, damage type, image mapping passed.');
