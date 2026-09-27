// src/tests/battle.units.test.ts
// 執行期單元測試 —— 不依賴 React / 引擎,可 headless 直接跑。
// 存在理由:tsc 通過 ≠ 正確(statuses.some 當初就是「編譯 100% 通過」然後執行時炸掉)。
// 跑法: npx esbuild src/tests/battle.units.test.ts --bundle --platform=node --outfile=/tmp/t.cjs && node /tmp/t.cjs

import assert from "node:assert";
import { drainExtraActionQueue } from "../battle/extraActions";
import {
  addTimer, tickTimers, clearTurnEffects, hasTurnEffect, consumeUse,
  remainingOf, turnEffect, roundCounter, useCounter, type Timer,
} from "../battle/timers";
import { decideAction, decideForcedSwitch, AI_HARD, type AIContext, type AIDeps } from "../battle/ai";
import { runNode } from "../effects/effectRunner";
import { CODEX } from "../data/codexRegistry";
import { normalizeDamageType, settleDamageAbsorption } from "../battle/damageSemantics";
import type { KitEntry } from "../effects/effectSystem.schema";

let pass = 0, fail = 0;
function t(name: string, fn: () => void) {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e: any) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); }
}

console.log("\n=== 計時器分類 ===");

t("回合類效果可被清除;其他兩類不受影響", () => {
  let L: Timer[] = [];
  L = addTimer(L, turnEffect("dmgUp", "傷害提升", 2));
  L = addTimer(L, roundCounter("marsShield", "堅壁機甲", 3, "soulmark"));
  L = addTimer(L, useCounter("fatalResist", "免死", 1, "soulmark"));
  const [after, cleared] = clearTurnEffects(L);
  assert.strictEqual(cleared, 1, "應只清除 1 個回合類效果");
  assert.strictEqual(after.length, 2, "魂印計時器應保留");
  assert.ok(after.find(x => x.id === "marsShield"), "魂印回合計數不該被清");
  assert.ok(after.find(x => x.id === "fatalResist"), "次數類不該被清");
});

t("hasTurnEffect 只響應回合類效果", () => {
  const onlySoul = [roundCounter("x", "魂印效果", 3, "soulmark")];
  assert.strictEqual(hasTurnEffect(onlySoul), false, "魂印效果不該觸發「處於回合類效果」");
  assert.strictEqual(hasTurnEffect([...onlySoul, turnEffect("y", "技能效果", 1)]), true);
});

t("後手補償:後出手且當回合無收益 → 回合數 +1(略過一次 tick)", () => {
  let L = addTimer([], turnEffect("shield", "減傷", 2), { isLateMover: true, benefitAlreadyMissed: true });
  assert.strictEqual(L[0].lateMoverPending, true);
  L = tickTimers(L, "round_end");
  assert.strictEqual(remainingOf(L, "shield"), 2, "補償回合不應遞減");
  assert.strictEqual(L[0].lateMoverPending, false, "補償只給一次");
  L = tickTimers(L, "round_end");
  assert.strictEqual(remainingOf(L, "shield"), 1, "之後應正常遞減");
});

t("先手附加不補償", () => {
  let L = addTimer([], turnEffect("a", "效果", 2), { isLateMover: false });
  L = tickTimers(L, "round_end");
  assert.strictEqual(remainingOf(L, "a"), 1);
});

t("次數類不隨回合流失,只能被消耗", () => {
  let L = addTimer([], useCounter("dodge", "閃避", 2, "skill"));
  L = tickTimers(L, "round_end");
  assert.strictEqual(remainingOf(L, "dodge"), 2, "次數不該被回合結束扣掉");
  const [L2, ok] = consumeUse(L, "dodge");
  assert.ok(ok); assert.strictEqual(remainingOf(L2, "dodge"), 1);
  const [L3] = consumeUse(L2, "dodge");
  assert.strictEqual(remainingOf(L3, "dodge"), 0, "耗盡應移除");
});

t("歸零即移除,不留殘留(計時器與效果同物件)", () => {
  let L = addTimer([], turnEffect("a", "效果", 1));
  L = tickTimers(L, "round_end");
  assert.strictEqual(L.length, 0);
});

t("tickAt 分流:action_end 不被 round_end 扣到", () => {
  let L = addTimer([], turnEffect("a", "行動後效果", 2, { tickAt: "action_end" }));
  L = tickTimers(L, "round_end");
  assert.strictEqual(remainingOf(L, "a"), 2);
  L = tickTimers(L, "action_end");
  assert.strictEqual(remainingOf(L, "a"), 1);
});

console.log("\n=== AI 決策 ===");

const mkElf = (o: Partial<any> = {}): any => ({
  name: "測試精靈", type: "火", currentHp: 500, maxHp: 500,
  skills: [
    { name: "普通攻擊", type: "火", category: "物理", power: 90, pp: 5, priority: 0 },
    { name: "強化", type: "火", category: "屬性", power: 0, pp: 5, priority: 0 },
  ],
  statStages: {}, battleStatus: "normal", soulMark: { name: "測試" }, ...o,
});

const mkDeps = (over: Partial<AIDeps> = {}): AIDeps => ({
  estimateDamage: () => 100,
  getTypeMatchup: () => 1,
  getStatuses: () => ({}),
  isSkillUsable: () => true,
  isControlStatus: () => false,
  rng: () => 0.5,
  ...over,
});

const mkCtx = (over: Partial<AIContext> = {}): AIContext => {
  const self = mkElf(); const opponent = mkElf({ name: "對手" });
  return { self, opponent, team: [self, mkElf({ name: "隊友" })], activeIndex: 0,
           items: [], canSwitch: true, canUseItem: true, turnNumber: 3, ...over };
};

t("能一擊斬殺時,選擇攻擊而非鋪場/換人/吃藥", () => {
  const ctx = mkCtx({ opponent: mkElf({ name: "殘血對手", currentHp: 50 }),
                      items: [{ id: "hp_300", name: "超級體力藥劑", description: "", type: "hp", value: 300 }] });
  ctx.self.currentHp = 200; // 自己也殘血,誘惑去吃藥
  const d = mkDeps({ estimateDamage: (_a, _b, s) => (s.category === "屬性" ? 0 : 100) });
  const r = decideAction(ctx, d, AI_HARD)!;
  assert.strictEqual(r.action.kind, "skill", `應選技能收人頭,實際: ${r.action.kind}`);
  assert.ok(r.reason.includes("擊敗"), `理由應提到斬殺: ${r.reason}`);
});

t("補血也擋不住斬殺時,不吃藥(v3 完全沒有此判斷)", () => {
  const ctx = mkCtx({ items: [{ id: "hp_50", name: "微量體力藥劑", description: "", type: "hp", value: 50 }] });
  ctx.self.currentHp = 60;
  // 對手能打 400,補 50 也是死
  const d = mkDeps({ estimateDamage: (a) => (a.name === "對手" ? 400 : 30) });
  const r = decideAction(ctx, d, AI_HARD)!;
  assert.notStrictEqual(r.action.kind, "item", "補了也會死,不該浪費回合吃藥");
});

t("補血後可撐過攻擊 → 吃藥", () => {
  const ctx = mkCtx({ items: [{ id: "hp_300", name: "超級體力藥劑", description: "", type: "hp", value: 300 }] });
  ctx.self.currentHp = 120; ctx.canSwitch = false;
  const d = mkDeps({ estimateDamage: (a) => (a.name === "對手" ? 200 : 30) });
  const r = decideAction(ctx, d, AI_HARD)!;
  assert.strictEqual(r.action.kind, "item", `應吃藥續命,實際: ${r.action.kind} / ${r.reason}`);
});

t("受控且無法作為時,換人止損", () => {
  const ctx = mkCtx();
  ctx.self.currentHp = 100;
  const d = mkDeps({
    estimateDamage: (a) => (a.name === "對手" ? 300 : 10),
    getStatuses: (e) => (e.name === "測試精靈" ? { paralyzed: 2 } : {}),
    isControlStatus: (s) => s === "paralyzed",
  });
  const r = decideAction(ctx, d, AI_HARD)!;
  assert.strictEqual(r.action.kind, "switch", `應換人,實際: ${r.action.kind} / ${r.reason}`);
});

t("知道「切換」是一個選項(v3 只有 12% 隨機切)", () => {
  const ctx = mkCtx();
  ctx.self.currentHp = 30;
  ctx.team[1].type = "水"; // 隊友對火有抗性
  // mock 必須前後一致:抗性隊友承受的傷害要真的比較低
  const d = mkDeps({
    estimateDamage: (a, b) => (a.name === "對手" ? (b.type === "水" ? 100 : 500) : 10),
    getTypeMatchup: (_atk, def) => (def === "水" ? 0.5 : 2),
  });
  const r = decideAction(ctx, d, AI_HARD)!;
  assert.strictEqual(r.action.kind, "switch", `瀕危應換上抗性隊友,實際: ${r.action.kind} / ${r.reason}`);
});

t("候選人同樣扛不住時,不犧牲更健康的戰力", () => {
  const ctx = mkCtx();
  ctx.self.currentHp = 30;          // 我快死了
  ctx.team[1].currentHp = 500;      // 隊友很健康
  // 對手打誰都是 500 → 換誰上去都死,那就別浪費健康隊友
  const d = mkDeps({ estimateDamage: (a) => (a.name === "對手" ? 500 : 10) });
  const r = decideAction(ctx, d, AI_HARD)!;
  assert.notStrictEqual(r.action.kind, "switch", `不該把健康隊友換上去送死: ${r.reason}`);
});

t("強制換場:挑抗性佳且能反打的", () => {
  const ctx = mkCtx();
  ctx.team = [mkElf({ name: "倒下", currentHp: 0 }), mkElf({ name: "脆皮", type: "草" }), mkElf({ name: "抗性佳", type: "水" })];
  ctx.activeIndex = 0;
  const d = mkDeps({ getTypeMatchup: (_atk, def) => (def === "水" ? 0.5 : 2) });
  assert.strictEqual(decideForcedSwitch(ctx, d), 2, "應選抗性佳者");
});

t("同 rng 種子下決策可重現(golden 友善)", () => {
  const mk = () => { let i = 0; const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]; return () => seq[i++ % seq.length]; };
  const a = decideAction(mkCtx(), mkDeps({ rng: mk() }), AI_HARD)!;
  const b = decideAction(mkCtx(), mkDeps({ rng: mk() }), AI_HARD)!;
  assert.deepStrictEqual(a.action.kind, b.action.kind);
  assert.strictEqual(a.score, b.score, "同種子分數應完全相同");
});

t("無可用技能時回傳 null,不會硬回 skills[0]", () => {
  const ctx = mkCtx({ canSwitch: false, canUseItem: false });
  const r = decideAction(ctx, mkDeps({ isSkillUsable: () => false }), AI_HARD);
  assert.strictEqual(r, null, "應誠實回 null 讓呼叫端處理");
});

t("執行 runNode 並代入 resolveParams 參數且對手被施加麻痺", () => {
  const logs: string[] = [];
  const p2Statuses: string[] = [];

  const ctx: any = {
    actor: "p1",
    activeP1: { name: "我方" },
    activeP2: { name: "對手" },
    p1: "p1",
    p2: "p2",
    addLog: (msg: string) => logs.push(msg),
    applyStatusWithImmunityCheck: (side: string, statusName: string, chance: any, duration: number) => {
      if (side === "p2") {
        p2Statuses.push(statusName);
      }
    }
  };

  const kit = [{ codeId: "0010", params: { "0": 100 }, node: "round_start", source: "soulmark", order: 0 }] satisfies KitEntry[];

  runNode("round_start", kit, CODEX, ctx);

  assert.strictEqual(p2Statuses.includes("麻痺"), true, "對手應獲得「麻痺」狀態");
});

console.log("\n=== 傷害語意 ===");

t("額外行動傷害屬於技能傷害並由護盾吸收", () => {
  const result = settleDamageAbsorption(300, "skill_extra_action", 120, 80);
  assert.deepStrictEqual(result, {
    amount: 180,
    shield: 0,
    barrier: 80,
    shieldAbsorbed: 120,
    barrierAbsorbed: 0,
  });
});

t("X系技能傷害有獨立分類並由護盾吸收", () => {
  const result = settleDamageAbsorption(300, "skill_attribute", 120, 80);
  assert.strictEqual(result.amount, 180);
  assert.strictEqual(result.shield, 0);
  assert.strictEqual(result.barrier, 80);
});

t("無視護盾只略過技能護盾，不會消耗護盾", () => {
  const result = settleDamageAbsorption(300, "skill_attack", 120, 80, true);
  assert.strictEqual(result.amount, 300);
  assert.strictEqual(result.shield, 120);
  assert.strictEqual(result.barrier, 80);
});

t("固定與百分比傷害由護罩吸收，真實傷害不受護罩影響", () => {
  const fixed = settleDamageAbsorption(100, "fixed", 50, 70);
  assert.strictEqual(fixed.amount, 30);
  assert.strictEqual(fixed.barrier, 0);
  const real = settleDamageAbsorption(100, "true", 50, 70);
  assert.strictEqual(real.amount, 100);
  assert.strictEqual(real.shield, 50);
  assert.strictEqual(real.barrier, 70);
});

t("歷史傷害名稱會正規化，不把額外行動降級成未知類型", () => {
  assert.strictEqual(normalizeDamageType({ damageType: "true_damage" }), "true");
  assert.strictEqual(normalizeDamageType({ damageType: "skill_extra_action" }), "skill_extra_action");
});

console.log("\n=== 額外行動 ===");

await (async () => {
  let queue: Array<{ owner: "p1" | "p2"; id: string }> = [
    { owner: "p1", id: "a" },
    { owner: "p2", id: "enemy" },
  ];
  const order: string[] = [];
  const result = await drainExtraActionQueue({
    owner: "p1",
    readQueue: () => queue,
    writeQueue: next => { queue = next; },
    canContinue: () => true,
    execute: action => {
      order.push(action.id);
      if (action.id === "a") queue = [...queue, { owner: "p1", id: "nested" }];
    },
  });
  t("額外行動會結算途中新增的同方連鎖，且保留另一方佇列", () => {
    assert.deepStrictEqual(order, ["a", "nested"]);
    assert.deepStrictEqual(queue, [{ owner: "p2", id: "enemy" }]);
    assert.deepStrictEqual(result, { resolved: 2, truncated: false });
  });
})();

console.log(`\n${"=".repeat(40)}\n通過: ${pass}  失敗: ${fail}\n${"=".repeat(40)}`);
if (fail > 0) process.exit(1);
