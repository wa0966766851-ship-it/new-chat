import assert from "node:assert/strict";
import {
  summarizeTeam, buildTeamSummary, ACTIVE_SLOTS, STANDBY_SLOTS, hpPercent,
} from "../src/shell/lastTeam";

/**
 * 隊伍摘要的回歸測試
 *
 * 為什麼要有這個檔：
 *   2026-10-21 Aegis 大廳崩潰（Cannot read properties of undefined (reading 'length')），
 *   原因是「預覽隊伍」用手拼物件，漏了 active / standby。
 *   這裡鎖住：**任何路徑產生的 TeamSummary 都必須有這兩個陣列**。
 *
 * 同時鎖住出戰／待命的語義：
 *   前 6 隻 = 出戰（會上場）
 *   後 6 隻 = 待命（BP 備用池，不入場）
 *   這與「額外精靈（isExtra，戰鬥中召喚）」是不同概念，不得混用。
 */

const mkElf = (n: number) => ({
  id: `e${n}`, name: `精靈${n}`, battleId: `e${n}_inst`,
  type: "暗影", level: 100, maxHp: 100, currentHp: 100,
  calculatedStats: { hp: 100, atk: 10, def: 10, spatk: 10, spdef: 10, speed: 10 },
  skills: [],
}) as any;

// ── 空紀錄 ──
{
  const s = summarizeTeam(null);
  assert.equal(s.hasTeam, false);
  assert.deepEqual(s.active, [], "空紀錄的 active 必須是空陣列，不能是 undefined");
  assert.deepEqual(s.standby, [], "空紀錄的 standby 必須是空陣列，不能是 undefined");
  assert.equal(s.active.length + s.standby.length, 0);
}

// ── 只有 3 隻：全部算出戰，待命為空 ──
{
  const team = [1, 2, 3].map(mkElf);
  const s = summarizeTeam({ team, starterId: "e1_inst" });
  assert.equal(s.active.length, 3);
  assert.equal(s.standby.length, 0, "不足 6 隻時不該有待命");
  assert.equal(s.starter?.name, "精靈1");
}

// ── 剛好 6 隻：全出戰 ──
{
  const team = [1, 2, 3, 4, 5, 6].map(mkElf);
  const s = summarizeTeam({ team, starterId: "e1_inst" });
  assert.equal(s.active.length, 6);
  assert.equal(s.standby.length, 0);
}

// ── 12 隻：前 6 出戰、後 6 待命 ──
{
  const team = Array.from({ length: 12 }, (_, i) => mkElf(i + 1));
  const s = summarizeTeam({ team, starterId: "e1_inst" });
  assert.equal(s.active.length, ACTIVE_SLOTS, "出戰必須 6 隻");
  assert.equal(s.standby.length, STANDBY_SLOTS, "待命必須 6 隻");
  assert.equal(s.count, 12);
  assert.equal(s.capacity, 12);
  // 語義鎖：第 7 隻起是待命，不得出現在出戰
  assert.ok(!s.active.some((e) => e.name === "精靈7"), "第 7 隻必須在待命，不能進出戰");
  assert.ok(s.standby.some((e) => e.name === "精靈7"), "第 7 隻必須在待命");
  // 首發不得是待命精靈
  assert.ok(!s.standby.some((e) => e.battleId === s.starter?.battleId), "首發不能是待命精靈");
}

// ── 超過 12 隻：截到 capacity ──
{
  const team = Array.from({ length: 20 }, (_, i) => mkElf(i + 1));
  const s = summarizeTeam({ team, starterId: "e1_inst" });
  assert.equal(s.count, 12, "超過上限要截斷");
  assert.equal(s.members.length, 12);
}

// ── 壞資料：不能拋錯 ──
{
  const s = summarizeTeam({ team: [null, undefined, {}, mkElf(1)] as any, starterId: "" });
  assert.ok(Array.isArray(s.active));
  assert.ok(Array.isArray(s.standby));
  assert.equal(s.members.length, 1, "只保留有 calculatedStats 的項目");
}

// ── buildTeamSummary：預覽隊伍也必須有 active/standby（這就是崩潰點）──
{
  const members = Array.from({ length: 12 }, (_, i) => mkElf(i + 1));
  const s = buildTeamSummary(members, { hasTeam: false });
  assert.equal(s.hasTeam, false);
  assert.equal(s.active.length, 6, "預覽隊伍的出戰必須是 6");
  assert.equal(s.standby.length, 6, "預覽隊伍的待命必須是 6");
  assert.equal(s.starter?.name, "精靈1", "預覽首發取第一個");

  // 空池也不能崩
  const empty = buildTeamSummary([]);
  assert.deepEqual(empty.active, []);
  assert.deepEqual(empty.standby, []);
  assert.equal(empty.starter, null);
}

// ── 首發查找：battleId 優先，其次 id，最後 fallback 第一隻 ──
{
  const team = Array.from({ length: 12 }, (_, i) => mkElf(i + 1));
  assert.equal(summarizeTeam({ team, starterId: "e5_inst" }).starter?.name, "精靈5", "用 battleId 找");
  assert.equal(summarizeTeam({ team, starterId: "e5" }).starter?.name, "精靈5", "用 id 找");
  assert.equal(summarizeTeam({ team, starterId: "不存在" }).starter?.name, "精靈1", "找不到就取第一隻");
}

// ── HP 百分比：邊界安全 ──
{
  assert.equal(hpPercent({ maxHp: 100, currentHp: 100, calculatedStats: { hp: 100 } } as any), 100);
  assert.equal(hpPercent({ maxHp: 100, currentHp: 0, calculatedStats: { hp: 100 } } as any), 0);
  assert.equal(hpPercent({ maxHp: 100, currentHp: 250, calculatedStats: { hp: 100 } } as any), 100, "超過上限要夾住");
  assert.equal(hpPercent({ maxHp: 100, currentHp: -50, calculatedStats: { hp: 100 } } as any), 0, "負值要夾住");
}

console.log("隊伍摘要：出戰／待命語義、預覽隊伍完整性、首發查找、HP 邊界通過");
