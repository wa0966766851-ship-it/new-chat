import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { HOLY_MILES_SEED, HOLY_MILES_SKILLS } from "../src/data/holyMiles";
import { HOLY_MILES_SKILLS as handlers, handleHolyMilesSoulMark } from "../src/effects/holyMilesRegistry";
import { CUSTOM } from "../src/blocks/custom";
import { EffectTiming } from "../src/effects/types";
import type { BattleEventContext } from "../src/effects/types";

const makeContext = () => {
  const own: Record<string, any> = {};
  const opp: Record<string, any> = {};
  const events: string[] = [];
  const timers: any[] = [];
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
    addTimerTo: (_: string, t: any) => { timers.push(t); },
    consumeTimer: (_: string, id: string) => { const i = timers.findIndex((t: any) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    addLog: () => {},
  } as unknown as BattleEventContext;
  return { ctx, own, opp, events, timers, self, target };
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

test("淨世洗禮頌 adds percent damage equal to actual skill damage against an abnormal opponent", () => {
  const { ctx, events, target } = makeContext();
  ctx.skill = HOLY_MILES_SKILLS[3];
  target.battleStatuses = { 燒傷: 2 };
  handleHolyMilesSoulMark(ctx, EffectTiming.ON_DAMAGED, { targetSide: "p2", amount: 345, damageType: "skill_attack" });
  assert.ok(events.includes("pink:345"));
});

test("聖怒 doubles incoming skill damage when own percent damage fails to reduce HP", () => {
  const { ctx, self, target } = makeContext();
  target.currentHp = 100;
  self.currentHp = 100;
  handleHolyMilesSoulMark(ctx, EffectTiming.ROUND_START);
  handleHolyMilesSoulMark(ctx, EffectTiming.OPPONENT_DAMAGE, { damageType: "percent", sourceElfName: self.name, hpReduced: 0 });
  const damageComp = { multiplier: 1, damageCategory: "skill_attack", isIncoming: true };
  handleHolyMilesSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, { damageComp });
  assert.equal(damageComp.multiplier, 1); // 八荒減半2次；聖怒翻倍2次
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

test("淨世洗禮頌：ROUND_START預掛無效重結算timer＋handler快照HP%翻倍", () => {
  const { ctx, own, timers } = makeContext();
  handleHolyMilesSoulMark(ctx, EffectTiming.ROUND_START);
  const t = timers.find((x: any) => x.id === "blk_p1_baptism_invalid");
  assert.ok(t, "應預掛 baptism_invalid timer");
  assert.equal(t.payload.block.trig, "self_invalid");
  ctx.skill = HOLY_MILES_SKILLS[3];
  handlers["淨世洗禮頌"](ctx);
  assert.equal(own["holyMiles.baptismDoubles"], 8); // 對手800/1000
});

test("淨世洗禮頌：正常命中吃HP%翻倍（BEFORE_DAMAGE主乘區）", () => {
  const { ctx, own, timers } = makeContext();
  ctx.skill = HOLY_MILES_SKILLS[3];
  handlers["淨世洗禮頌"](ctx); // 快照 doubles=8
  const damageComp: any = { multiplier: 1, floor: 0, damageCategory: "skill_attack", isIncoming: false };
  handleHolyMilesSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, { damageComp });
  assert.equal(damageComp.floor, 280);
  assert.equal(damageComp.multiplier, 2 ** 6); // cap 6 → ×64
  assert.ok(!timers.some((t: any) => t.id === "blk_p1_baptism_invalid"), "正常命中應消耗預掛timer");
});

test("淨世洗禮頌：無效重結算只認淨世，非淨世不消耗", () => {
  const { ctx, events } = makeContext();
  (ctx as any).skill = { name: "八荒憫淚" };
  const r = CUSTOM["__baptism_invalid_hit"].run(ctx, { last: null, lastAmount: 0 });
  assert.equal(r, false);
  assert.ok(!events.some(e => e.startsWith("pink:")), "非淨世不應打出粉傷");
});

test("淨世洗禮頌：無效重結算打出保底粉傷（滿血×64封頂）", () => {
  const { ctx, own, events } = makeContext();
  (ctx as any).skill = { name: "淨世洗禮頌" };
  own["holyMiles.baptismDoubles"] = 10;
  const r = CUSTOM["__baptism_invalid_hit"].run(ctx, { last: null, lastAmount: 0 });
  assert.equal(r, true);
  assert.ok(events.includes("pink:17920"), `實際=${events}`);
});

test("四象：cleansePending觸發先制失效（blkNoPosPrioTurns）", () => {
  const { ctx, own, opp, self } = makeContext();
  self.battleStatuses = { 燒傷: 2 };
  own["holyMiles.cleansePending"] = 1;
  opp["priorityBoostTurns"] = 3;
  handleHolyMilesSoulMark(ctx, EffectTiming.ROUND_START);
  assert.equal(opp["priorityBoostTurns"], 0);
  assert.equal(opp["blkNoPosPrioTurns"], 2);
});
