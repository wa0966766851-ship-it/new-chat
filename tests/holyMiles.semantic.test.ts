import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { HOLY_MILES_SEED, HOLY_MILES_SKILLS } from "../src/data/holyMiles";
import { HOLY_MILES_SKILLS as handlers, handleHolyMilesSoulMark } from "../src/effects/holyMilesRegistry";
import { EffectTiming } from "../src/effects/types";
import type { BattleEventContext } from "../src/effects/types";

const makeContext = () => {
  const own: Record<string, any> = {};
  const opp: Record<string, any> = {};
  const events: string[] = [];
  const self = { ...HOLY_MILES_SEED, currentHp: 500, maxHp: 1000, calculatedStats: { def: 200, spdef: 200 }, statStages: {}, battleStatuses: {}, effects: [], skills: HOLY_MILES_SKILLS.map(s => ({ ...s })) } as any;
  const target = { id: "enemy", currentHp: 800, maxHp: 1000, statStages: {}, skills: [{ name: "敵方技能", pp: 2, currentPp: 2 }] } as any;
  const ctx = {
    self, target, actor: "p1", targetSide: "p2", activeP1: self, activeP2: target,
    skill: HOLY_MILES_SKILLS[0], opponentSkill: target.skills[0],
    getPlayerState: (k: string) => own[k], setPlayerState: (k: string, v: any) => { own[k] = v; },
    getOpponentState: (k: string) => opp[k], setOpponentState: (k: string, v: any) => { opp[k] = v; },
    getFullTeam: (s: string) => s === "p1" ? [self] : [target],
    getStatuses: (e: any) => e.battleStatuses || {},
    applyAbsorb: (_: string, v: number) => { events.push(`absorb:${v}`); },
    applyTrueDamage: (_: string, v: number) => { events.push(`true:${v}`); return v; },
    applyPinkDamage: (_: string, v: number) => { events.push(`pink:${v}`); return v; },
    applyHeal: (_: string, v: number) => { events.push(`heal:${v}`); },
    applyPercentDamage: (_: string, v: number) => { events.push(`percent:${v}`); },
    applyStatusWithImmunityCheck: (_: string, s: string) => { events.push(`status:${s}`); return { success: true, immune: false }; },
    applyStatChange: (_: string, v: object) => { events.push(`stats:${JSON.stringify(v)}`); },
    clearTurnEffectsOf: () => true,
    updateElf: (_: string, v: object) => { Object.assign(target, v); },
    addLog: () => {},
  } as unknown as BattleEventContext;
  return { ctx, own, opp, events, self, target };
};

test("base stats, skills and original-form sprite files", () => {
  assert.equal(Object.values(HOLY_MILES_SEED.baseStats).reduce((a, b) => a + b, 0), 815);
  assert.equal(HOLY_MILES_SEED.seerId, 1204);
  assert.deepEqual([HOLY_MILES_SEED.height, HOLY_MILES_SEED.weight], [178, 87]);
  assert.equal(HOLY_MILES_SKILLS.length, 5);
  for (const skill of HOLY_MILES_SKILLS) assert.ok(handlers[skill.name], skill.name);
  for (const kind of ["head", "body"]) assert.ok(readFileSync(`public/seer/${kind}/1204.png`).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
});

test("八荒憫淚 blocks attack and punishes two opposing utility moves", () => {
  const { ctx, own, events } = makeContext();
  handlers["八荒憫淚"](ctx);
  assert.equal(own.blockAttackCount, 1);
  for (let i = 0; i < 3; i++) handleHolyMilesSoulMark(ctx, EffectTiming.OPPONENT_ACTION, { skill: { category: "屬性" } });
  assert.deepEqual(events.filter(x => x === "true:300"), ["true:300", "true:300"]);
});

test("八荒 halves nontrue damage by current HP steps and 天佑 repeats at round end", () => {
  const { ctx, events } = makeContext();
  handleHolyMilesSoulMark(ctx, EffectTiming.ROUND_START);
  const damageComp = { multiplier: 1, damageCategory: "skill_attack", isIncoming: true };
  handleHolyMilesSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, { damageComp });
  assert.equal(damageComp.multiplier, 1 / 64); // base half plus five 10% steps
  handleHolyMilesSoulMark(ctx, EffectTiming.ROUND_END);
  assert.equal(events.filter(x => x === "heal:100").length, 6);
  assert.equal(events.filter(x => x === "percent:0.1").length, 6);
});

test("fifth skill accumulates drain, removes one PP from every enemy move and locks depleted choice", () => {
  const { ctx, own, opp, target, events } = makeContext();
  target.skills[0].pp = 1; target.skills[0].currentPp = 1;
  handlers["聖靈乾坤斷"](ctx);
  assert.equal(opp.nextSkillInvalid, true);
  assert.equal(target.skills[0].pp, 0);
  assert.ok(events.includes("true:300"));
  assert.ok(events.includes("absorb:200"));
  for (let i = 0; i < 4; i++) handlers["聖靈乾坤斷"](ctx);
  assert.equal(own["holyMiles.fifthUses"], 5);
  assert.ok(events.includes("absorb:500"));
});
