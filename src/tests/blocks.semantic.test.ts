import assert from "node:assert";
import { DEFAULT_ELVES } from "../data/defaultElves";
import { getSkillProgram, getSoulProgram } from "../blocks/registry";
import { SKILL_MODE, SOUL_MODE } from "../blocks/specs";
import { runSkillProgram, runSoulProgram } from "../blocks/runtime";

let pass = 0;
let fail = 0;

function t(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (error: any) {
    fail++;
    console.log(`  ❌ ${name}\n     ${error.message}`);
  }
}

const baseStages = () => ({ atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 });

function makeElf(overrides: Record<string, any> = {}) {
  return {
    id: "test",
    name: "測試精靈",
    type: "普通",
    currentHp: 600,
    maxHp: 1000,
    shield: 0,
    barrier: 0,
    statStages: baseStages(),
    battleStatuses: {},
    battleStatus: "normal",
    effects: [],
    skills: [{ name: "測試技能", category: "物理", pp: 5, maxPp: 5 }],
    calculatedStats: { atk: 200, def: 200, spatk: 200, spdef: 200, speed: 200 },
    ...overrides,
  };
}

function makeBlockContext(selfOverrides: Record<string, any> = {}, targetOverrides: Record<string, any> = {}) {
  const self = makeElf({ name: "我方", ...selfOverrides });
  const target = makeElf({ name: "對手", ...targetOverrides });
  const playerState: Record<string, any> = {};
  const opponentState: Record<string, any> = {};
  const statuses: Record<string, string[]> = { p1: [], p2: [] };
  const marks: Record<string, any[]> = { p1: [], p2: [] };
  const timers: Record<string, any[]> = { p1: [], p2: [] };
  const damage = { pink: 0, fixed: 0, true: 0, skill: 0, absorbed: 0 };

  const elfAt = (side: "p1" | "p2") => side === "p1" ? self : target;
  const ctx: any = {
    actor: "p1",
    targetSide: "p2",
    self,
    target,
    activeP1: self,
    activeP2: target,
    p1FullTeam: [self],
    p2FullTeam: [target],
    p1Timers: timers.p1,
    p2Timers: timers.p2,
    skill: { name: "測試技能", category: "物理", description: "" },
    rng: () => 0,
    addLog: () => {},
    trackCodeExec: () => {},
    showPopup: () => {},
    getStatuses: (elf: any) => elf.battleStatuses || {},
    applyStatusWithImmunityCheck: (side: "p1" | "p2", status: string, duration: number) => {
      const elf = elfAt(side);
      elf.battleStatuses = { ...(elf.battleStatuses || {}), [status]: duration };
      statuses[side].push(status);
      return { success: true, immune: false };
    },
    applyHeal: (side: "p1" | "p2", amount: number) => {
      const elf = elfAt(side);
      elf.currentHp = Math.min(elf.maxHp, elf.currentHp + Math.floor(amount));
    },
    applyShield: (side: "p1" | "p2", amount: number) => {
      const elf = elfAt(side);
      elf.shield = (elf.shield || 0) + Math.floor(amount);
    },
    applyStatChange: (side: "p1" | "p2", changes: Record<string, number>, ppChanges?: Record<string, number>) => {
      const elf = elfAt(side);
      for (const [key, value] of Object.entries(changes)) {
        elf.statStages[key] = Math.max(-6, Math.min(6, (elf.statStages[key] || 0) + value));
      }
      if (ppChanges?.all) elf.skills = elf.skills.map((skill: any) => ({ ...skill, pp: Math.max(0, Math.min(skill.maxPp ?? 99, (skill.pp || 0) + ppChanges.all)) }));
    },
    updateElf: (side: "p1" | "p2", patch: Record<string, any>) => Object.assign(elfAt(side), patch),
    updateAnyElf: () => {},
    applyPinkDamage: (_side: string, amount: number) => (damage.pink += Math.floor(amount), Math.floor(amount)),
    applyFixedDamage: (_side: string, amount: number) => (damage.fixed += Math.floor(amount), Math.floor(amount)),
    applyTrueDamage: (_side: string, amount: number) => (damage.true += Math.floor(amount), Math.floor(amount)),
    applySkillTypeDamage: (_side: string, amount: number) => (damage.skill += Math.floor(amount), Math.floor(amount)),
    applyPercentDamage: (_side: string, ratio: number) => (damage.pink += Math.floor(target.maxHp * ratio)),
    applyAbsorb: (_side: string, amount: number) => { damage.absorbed += Math.floor(amount); },
    adjustHp: () => {},
    applyDeathImmunity: () => {},
    getPlayerState: (key: string) => playerState[key],
    setPlayerState: (key: string, value: any) => { playerState[key] = value; },
    getOpponentState: (key: string) => opponentState[key],
    setOpponentState: (key: string, value: any) => { opponentState[key] = value; },
    clearTurnEffectsOf: () => true,
    hasTurnEffectOn: () => true,
    addTimerTo: (side: "p1" | "p2", timer: any) => {
      timers[side].push(timer);
      ctx[`${side}Timers`] = timers[side];
    },
    consumeTimer: () => {},
    queueExtraAction: () => {},
    setMark: (mark: any, side: "p1" | "p2" = "p2") => {
      const entry = { ...mark, source: mark.source || self.name };
      const index = marks[side].findIndex(existing => existing.id === entry.id);
      if (index >= 0) marks[side][index] = entry;
      else marks[side].push(entry);
    },
    clearMark: (id: string, side: "p1" | "p2" = "p2") => {
      marks[side] = marks[side].filter(mark => mark.id !== id);
    },
    getMarks: (side: "p1" | "p2") => marks[side],
    shuffleArray: (items: any[]) => items,
    getEligibleTeam: (side: "p1" | "p2") => [elfAt(side)],
    getFullTeam: (side: "p1" | "p2") => [elfAt(side)],
    getFirstStarter: (side: "p1" | "p2") => elfAt(side),
    getNthElf: (side: "p1" | "p2") => elfAt(side),
    getAdjacentElves: () => [],
    getSeparatedElves: () => [],
    vanishElf: () => {},
    addExtraElf: () => {},
  };

  return { ctx, self, target, playerState, opponentState, statuses, marks, timers, damage };
}

function elfById(id: string) {
  const elf = DEFAULT_ELVES.find(item => String(item.id) === id);
  assert.ok(elf, `找不到精靈 ${id}`);
  return elf!;
}

function skillByName(name: string) {
  for (const elf of DEFAULT_ELVES) {
    const skill = elf.skills?.find(item => item.name === name);
    if (skill) return skill;
  }
  assert.fail(`找不到技能 ${name}`);
}

console.log("\n=== 積木登記完整性 ===");

t("12 個積木技能的所有子句皆可解析", () => {
  assert.strictEqual(Object.keys(SKILL_MODE).length, 12);
  for (const name of Object.keys(SKILL_MODE)) {
    const program = getSkillProgram(skillByName(name));
    const unparsed = program.clauses.filter(clause => !clause.parsed);
    assert.deepStrictEqual(unparsed.map(clause => clause.raw), [], `${name} 仍有未解析子句`);
  }
});

t("6 個積木魂印的所有子句皆可解析", () => {
  assert.strictEqual(Object.keys(SOUL_MODE).length, 6);
  for (const id of Object.keys(SOUL_MODE)) {
    const elf = elfById(id);
    const program = getSoulProgram(elf);
    const unparsed = program.clauses.filter(clause => clause.marker !== "§" && !clause.parsed);
    assert.deepStrictEqual(unparsed.map(clause => clause.raw), [], `${elf.name} 魂印仍有未解析子句`);
  }
});

console.log("\n=== 積木技能語意 ===");

t("天河衝擊：消強後全屬性-1，消回合後禁療2回合", () => {
  const h = makeBlockContext({}, { statStages: { ...baseStages(), atk: 2, speed: 1 } });
  h.ctx.skill = skillByName("天河衝擊");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.deepStrictEqual(h.target.statStages, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
  assert.strictEqual(h.opponentState.p2_noHealTurns, 2);
});

t("殘軀鎖命：強化翻倍、傷害上限、回復計時與易傷均寫入戰鬥狀態", () => {
  const h = makeBlockContext({ statStages: { ...baseStages(), atk: 1 } });
  h.ctx.skill = skillByName("殘軀鎖命");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.deepStrictEqual(h.self.statStages, { atk: 3, def: 2, spatk: 2, spdef: 2, speed: 2, accuracy: 2 });
  assert.strictEqual(h.playerState.incomingSkillDmgCapTurns, 4);
  assert.strictEqual(h.playerState.incomingSkillDmgCap, 200);
  assert.strictEqual(h.opponentState.damageTakenBoostTurns, 3);
  assert.ok(h.timers.p1.some(timer => timer.payload.block.trig === "round_end" && timer.remaining === 4));
});

t("萬鈞鎮魂：高體力目標受到1/4固定傷害，未擊敗時全屬性-1", () => {
  const h = makeBlockContext({ currentHp: 500 }, { currentHp: 800, maxHp: 1000 });
  h.ctx.skill = skillByName("萬鈞鎮魂");
  const program = getSkillProgram(h.ctx.skill);
  runSkillProgram(h.ctx, program, "use");
  runSkillProgram(h.ctx, program, "after_hit");
  assert.strictEqual(h.playerState.vampireRatio, 0.4);
  assert.strictEqual(h.damage.fixed, 250);
  assert.deepStrictEqual(h.target.statStages, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
});

t("混元護體：異常反彈、害怕、傷害上限與攻擊先制均生效", () => {
  const h = makeBlockContext();
  h.ctx.skill = skillByName("混元護體");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.strictEqual(h.playerState.reflectStatusTurns, 4);
  assert.ok(h.statuses.p2.includes("害怕"));
  assert.strictEqual(h.playerState.incomingSkillDmgCapTurns, 3);
  assert.strictEqual(h.playerState.incomingSkillDmgCap, 280);
  assert.strictEqual(h.playerState.priorityBoostTurns, 3);
  assert.strictEqual(h.playerState.priorityBoostValue, 2);
  assert.strictEqual(h.playerState.priorityBoostAttackOnly, true);
});

t("淨·天河倒懸：消回合後禁療與屬性失效，低體力時傷害翻倍並吸血", () => {
  const h = makeBlockContext({ currentHp: 400 }, { currentHp: 800 });
  h.ctx.skill = skillByName("淨·天河倒懸");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.strictEqual(h.opponentState.p2_noHealTurns, 3);
  assert.strictEqual(h.opponentState.utilitySkillInvalidTurns, 3);
  assert.strictEqual(h.playerState.skillDamageBoost, 2);
  assert.strictEqual(h.playerState.vampireRatio, 1);
});

t("翎萬羽歸宗：異常目標使攻擊翻倍並啟用等量回血", () => {
  const h = makeBlockContext({}, { battleStatuses: { 麻痺: 2 } });
  h.ctx.skill = skillByName("翎萬羽歸宗");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use", [3]);
  assert.strictEqual(h.playerState.skillDamageBoost, 2);
  assert.strictEqual(h.playerState.vampireRatio, 1);
});

t("雙重暗影：實際降低防禦並施加害怕", () => {
  const h = makeBlockContext();
  h.ctx.skill = skillByName("雙重暗影");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.strictEqual(h.target.statStages.def, -1);
  assert.ok(h.statuses.p2.includes("害怕"));
});

t("深潛者盛宴：異常存在時3回合技能增傷由50%翻倍為100%", () => {
  const h = makeBlockContext({ battleStatuses: { 混亂: 2 } });
  h.ctx.skill = skillByName("深潛者盛宴");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use", [5]);
  assert.strictEqual(h.timers.p1.length, 1);
  assert.strictEqual(h.timers.p1[0].payload.block.dmgOut, 1);
});

t("星光·音速火拳：消回合後降先制且機率增傷實際寫入狀態", () => {
  const h = makeBlockContext();
  h.ctx.skill = skillByName("星光·音速火拳");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.strictEqual(h.opponentState.priorityBoostValue, -3);
  assert.strictEqual(h.opponentState.priorityBoostTurns, 2);
  assert.strictEqual(h.playerState.skillDamageBoost, 2);
});

t("星光·冥想：免疫反彈、免降、焚燼與3回合追傷均生效", () => {
  const h = makeBlockContext();
  h.ctx.skill = skillByName("星光·冥想");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.strictEqual(h.playerState.reflectStatusTurns, 4);
  assert.strictEqual(h.playerState.immuneStatDownTurns, 4);
  assert.ok(h.statuses.p2.includes("焚燼"));
  assert.ok(h.timers.p1.some(timer => timer.remaining === 3 && timer.payload.block.trig === "self_attack"));
});

t("星光·不滅之火：消強固傷、星火增傷、暴擊回滿與持續追傷均生效", () => {
  const h = makeBlockContext({ currentHp: 100 }, { statStages: { ...baseStages(), atk: 2 } });
  h.ctx.skill = skillByName("星光·不滅之火");
  h.ctx.setMark({ id: "blk_星火之灼", name: "星火之灼", count: 1 }, "p2");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.strictEqual(h.target.statStages.atk, 0);
  assert.strictEqual(h.damage.fixed, 400);
  assert.strictEqual(h.playerState.skillDamageBoost, 2.5);
  assert.ok(h.timers.p1.some(timer => timer.remaining === 3 && timer.payload.block.trig === "self_skill"));
  h.playerState.blkLastCrit = true;
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "after_hit");
  assert.strictEqual(h.self.currentHp, 1000);
});

t("星光·覺醒：先手強化翻倍並建立回血追傷、增傷與先制效果", () => {
  const h = makeBlockContext();
  h.ctx.goesFirst = true;
  h.ctx.skill = skillByName("星光·覺醒");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.deepStrictEqual(h.self.statStages, { atk: 2, def: 2, spatk: 2, spdef: 2, speed: 2, accuracy: 2 });
  assert.ok(h.timers.p1.some(timer => timer.remaining === 4 && timer.payload.block.trig === "self_skill"));
  assert.ok(h.timers.p1.some(timer => timer.remaining === 3 && timer.payload.block.dmgOut === 1.5));
  assert.strictEqual(h.playerState.priorityBoostValue, 2);
  assert.strictEqual(h.playerState.priorityBoostTurns, 3);
});

t("星光·魔焰裂空：消強回血、星火增傷、弱化計時、必暴與封屬性均生效", () => {
  const h = makeBlockContext({ currentHp: 100 }, { currentHp: 900, statStages: { ...baseStages(), def: 2 } });
  h.ctx.skill = skillByName("星光·魔焰裂空");
  h.ctx.setMark({ id: "blk_星火之灼", name: "星火之灼", count: 1 }, "p2");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.strictEqual(h.self.currentHp, 500);
  assert.strictEqual(h.target.statStages.def, 0);
  assert.strictEqual(h.playerState.skillDamageBoost, 2.5);
  assert.ok(h.timers.p1.some(timer => timer.remaining === 3 && timer.payload.block.trig === "self_attack"));
  assert.strictEqual(h.opponentState.utilitySkillInvalidTurns, 2);
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "after_hit");
  assert.ok(h.timers.p1.some(timer => timer.kind === "use_counter" && timer.remaining === 2 && timer.payload.block.crit));
});

t("贖魂讚詩：消回合成功後施加流血", () => {
  const h = makeBlockContext();
  h.ctx.skill = skillByName("贖魂讚詩");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use", [1]);
  assert.ok(h.statuses.p2.includes("流血"));
});

console.log("\n=== 積木魂印語意 ===");

t("天蓬元帥八戒魂印：受擊消強，高低體力分別減傷25%與50%", () => {
  const elf = elfById("5003");
  const high = makeBlockContext({ id: elf.id, name: elf.name, currentHp: 800 }, { statStages: { ...baseStages(), atk: 2 } });
  runSoulProgram(high.ctx, getSoulProgram(elf), ["damaged_attack"], {});
  assert.strictEqual(high.target.statStages.atk, 0);
  const highDamage = { base: 400, damageCategory: "skill_attack", isIncoming: true, isTypedSkill: false, increasePercent: 0, decreasePercent: 0, multiplier: 1 };
  runSoulProgram(high.ctx, getSoulProgram(elf), ["passive"], highDamage);
  assert.strictEqual(highDamage.decreasePercent, 0.25);

  const low = makeBlockContext({ id: elf.id, name: elf.name, currentHp: 400 });
  const lowDamage = { ...highDamage, decreasePercent: 0 };
  runSoulProgram(low.ctx, getSoulProgram(elf), ["passive"], lowDamage);
  assert.strictEqual(lowDamage.decreasePercent, 0.5);
});

t("天蓬元帥八戒魂印：低於1/4回合末回血並令對手全屬性-1", () => {
  const elf = elfById("5003");
  const h = makeBlockContext({ id: elf.id, name: elf.name, currentHp: 200 });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["round_end"], {});
  assert.strictEqual(h.self.currentHp, 533);
  assert.deepStrictEqual(h.target.statStages, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
});

t("天蓬元帥八戒魂印：死亡依弱化種類線性削減體力上限並延長禁療", () => {
  const elf = elfById("5003");
  const h = makeBlockContext(
    { id: elf.id, name: elf.name },
    { currentHp: 900, maxHp: 1000, statStages: { ...baseStages(), atk: -1, def: -2 } },
  );
  runSoulProgram(h.ctx, getSoulProgram(elf), ["defeated"], {});
  assert.strictEqual(h.target.maxHp, 400);
  assert.strictEqual(h.target.currentHp, 400);
  assert.strictEqual(h.opponentState.p2_noHealTurns, 4);
});

t("星光·魔焰猩猩登場：為對手附加星火之灼", () => {
  const elf = elfById("5006");
  const h = makeBlockContext({ id: elf.id, name: elf.name });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["entrance"], {});
  assert.ok(h.marks.p2.some(mark => mark.name === "星火之灼" && mark.effects.blkTurns === 3));
});

t("星光·魔焰猩猩物攻後：回血、等量百分比傷害與PP恢復皆生效", () => {
  const elf = elfById("5006");
  const h = makeBlockContext({ id: elf.id, name: elf.name, currentHp: 300, skills: [{ name: "測試物攻", category: "物理", pp: 0, maxPp: 5 }] });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["self_after_attack", "self_after_physical"], { skill: h.ctx.skill });
  assert.strictEqual(h.self.currentHp, 633);
  assert.strictEqual(h.damage.pink, 333);
  assert.strictEqual(h.self.skills[0].pp, 1);
});

t("星光·魔焰猩猩特攻後：先附加1/3最大體力傷害，再依成功量回血", () => {
  const elf = elfById("5006");
  const h = makeBlockContext({ id: elf.id, name: elf.name, currentHp: 300, skills: [{ name: "測試特攻", category: "特殊", pp: 0, maxPp: 5 }] });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["self_after_attack", "self_after_special"], { skill: h.ctx.skill });
  assert.strictEqual(h.damage.pink, 333);
  assert.strictEqual(h.self.currentHp, 633);
  assert.strictEqual(h.self.skills[0].pp, 1);
});

t("鎮魂.巴弗洛登場：對手窒息且自身混亂", () => {
  const elf = elfById("5008");
  const h = makeBlockContext({ id: elf.id, name: elf.name });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["entrance"], {});
  assert.ok(h.statuses.p2.includes("窒息"));
  assert.ok(h.statuses.p1.includes("混亂"));
});

t("星光·麗莎布布登場：為對手附加星芳之纏", () => {
  const elf = elfById("5011");
  const h = makeBlockContext({ id: elf.id, name: elf.name });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["entrance"], {});
  assert.ok(h.marks.p2.some(mark => mark.name === "星芳之纏" && mark.effects.blkTurns === 3));
});

console.log(`\n${"=".repeat(40)}\n積木語意通過: ${pass}  失敗: ${fail}\n${"=".repeat(40)}`);
if (fail > 0) process.exit(1);
