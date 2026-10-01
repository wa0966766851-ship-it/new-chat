import assert from "node:assert/strict";
import fs from "node:fs";

// Phase 2 T2：只讀 App 轉接層，不碰 BattleScreen（禁區）。鎖定結算斷線現狀。
const appSrc = fs.readFileSync("src/App.tsx", "utf8");
let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`pass ${name}`); }

test("星際轉接應透傳 onBattleEnd（現狀：只到 format）", () => {
  const seg = appSrc.slice(appSrc.indexOf("InterstellarHub"));
  assert.ok(seg.includes("onStartBattle"), "星際有 onStartBattle 轉接");
  assert.ok(!seg.includes("onBattleEnd"), "現狀未透傳 onBattleEnd，待 Phase 3 修（需持久層冪等，不只補 prop）");
});

test("BattleScreen 有 onBattleEnd prop 但 App 未給（現狀）", () => {
  const bs = fs.readFileSync("src/components/BattleScreen.tsx", "utf8");
  assert.ok(bs.includes("onBattleEnd"), "prop 存在");
  const battleSeg = appSrc.slice(appSrc.indexOf('view === "battle"'), appSrc.indexOf('view === "battle"') + 3000);
  assert.ok(!battleSeg.includes("onBattleEnd"), "App 未傳，待 Phase 3 接線");
});

console.log(`interstellar settlement wiring: ${passed} passed (static only, no BattleScreen change)`);
