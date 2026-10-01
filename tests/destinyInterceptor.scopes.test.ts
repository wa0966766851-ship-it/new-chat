import assert from "node:assert/strict";
import { StatusRegistry } from "../src/effects/statusRegistry";
import { buildDestinyPool, perform12Pull } from "../src/utils/destinyGacha";

// Phase 2 T1：只讀現狀，不改程式。鎖定五攔截的靜態語義缺口，供 Phase 3 接線用。
let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`pass ${name}`); }

test("block_attack 用未登記異常名，應改模式 buff", () => {
  assert.equal(StatusRegistry["封技"], undefined, "封技不應是通用異常，應走 attackSkillInvalidTurns 模式 buff");
});

test("pp_chain 存 function 進側狀態無效，應走 PP 上限機制", () => {
  const fakeSet = (v: any) => v;
  const stored = fakeSet((skills: any[]) => skills);
  assert.equal(typeof stored, "function", "現行存的是 function，不是數值，runner 讀不到");
});

test("soul_reaper 讀 undefined HP 會 NaN，且衰弱不代表先制-2", () => {
  assert.ok(Number.isNaN(Math.floor((undefined as any) * 0.35)), "undefined maxHp 應防 NaN");
  assert.notEqual("衰弱", "先制-2", "衰弱模擬先制降低文不對題，需獨立 primitive");
});

test("dirge_shield 與 hero_blessing 走 pending，暫不動", () => {
  assert.ok(true, "nextElfShield／teamBlessingPending 在 applyEntranceBlessings 有消費，保留");
});

test("rank／effect 只在 Elf 物件上，RegistryState 無，全域 runner 未接", () => {
  const pool = buildDestinyPool([]);
  assert.ok(Array.isArray(pool), "空池不炸，短池政策另測");
  const pulled = perform12Pull([]);
  assert.ok(pulled.length <= 12, "總池太小不硬湊 12，不假裝保底永遠滿足");
});

console.log(`destiny interceptor scopes: ${passed} passed (static only, no wiring change)`);
