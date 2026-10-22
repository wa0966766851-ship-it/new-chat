import assert from "node:assert/strict";
import { SHELL_FEATURES, aegisCanRender, aegisNavFeatures, getFeature } from "../src/shell/features";
import { resolveShellMode, readShellPreference, AUTO_AEGIS_MAX_WIDTH } from "../src/shell/shellMode";
import { PALETTES, paletteToCssVars, paletteForBattleOutcome } from "../src/design/palette";
import { CUES, cueMs, cueCss, unmeteredCues } from "../src/design/cues";

// ── 功能註冊表：雙殼不得落後 ──
{
  const ids = SHELL_FEATURES.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length, "功能 id 不得重複");

  for (const f of SHELL_FEATURES) {
    assert.ok(f.id && f.label && f.short, `${f.id} 缺少必填欄位`);
    assert.ok(f.short.length <= 12, `${f.id} 的 short 太長，窄版導航會爆版`);
    assert.ok(["screen", "overlay", "action"].includes(f.kind));
    assert.ok(["play", "roster", "data", "system"].includes(f.group));
    // 鐵則：Legacy 有的，Aegis 一定要能顯示（live 或 delegated）
    if (f.legacy) {
      assert.ok(
        aegisCanRender(f.id),
        `${f.id} 在 Legacy 已實作，Aegis 卻是 ${f.aegis.status} —— 這違反「舊版不得落後」`,
      );
    }
    // planned 必須標明階段，否則沒人知道什麼時候做
    if (f.aegis.status === "planned") {
      assert.ok(typeof f.aegis.phase === "number", `${f.id} 標為 planned 但沒有 phase`);
    }
  }
}

// ── Aegis 導航：只列可渲染的 screen，且數量足以涵蓋主要入口 ──
{
  const nav = aegisNavFeatures();
  assert.ok(nav.length >= 4, "Aegis 導航少於 4 項，主入口會缺");
  assert.ok(nav.every(f => f.kind !== "overlay"), "overlay 不該出現在主導航");
  assert.ok(nav.every(f => aegisCanRender(f.id)));
  assert.ok(nav.some(f => f.id === "start"), "主導航必須有首頁");
  assert.ok(nav.some(f => f.id === "battle"), "主導航必須有戰鬥");
  assert.equal(getFeature("不存在的功能"), undefined);
}

// ── 殼模式：auto 依寬度決定，明確偏好優先 ──
{
  assert.equal(resolveShellMode("legacy", 390), "legacy", "明確選 legacy 就該是 legacy");
  assert.equal(resolveShellMode("aegis", 1600), "aegis", "明確選 aegis 就該是 aegis");
  assert.equal(resolveShellMode("auto", 390), "aegis", "手機 auto 應落到 aegis");
  assert.equal(resolveShellMode("auto", 1600), "legacy", "桌面 auto 應落到 legacy");
  assert.equal(resolveShellMode("auto", AUTO_AEGIS_MAX_WIDTH), "aegis", "斷點本身算手機");
  assert.equal(resolveShellMode("auto", AUTO_AEGIS_MAX_WIDTH + 1), "legacy");
  // 無 window 時（Node）不得拋錯
  assert.equal(readShellPreference(), "auto");
}

// ── 色票：六態齊全、角色齊全、可轉 CSS 變數 ──
{
  const states = ["idle", "lobby", "battle", "victory", "defeat", "error"] as const;
  const roles = ["bg", "panel", "raised", "line", "text", "sub", "mute", "accent", "accentHot", "accentDim", "warn", "glow", "sat"];
  for (const s of states) {
    const p = PALETTES[s];
    for (const r of roles) assert.ok(p[r as keyof typeof p] !== undefined, `${s} 缺少 ${r}`);
    assert.ok(p.glow >= 0 && p.glow <= 1.5, `${s}.glow 超出範圍`);
    assert.ok(p.sat >= 0 && p.sat <= 1, `${s}.sat 超出範圍`);
  }
  const vars = paletteToCssVars("battle");
  assert.equal(vars["--p-bg"], PALETTES.battle.bg);
  assert.equal(vars["--p-accent"], PALETTES.battle.accent);
  assert.ok(Object.keys(vars).length >= 13, "CSS 變數數量不足");

  // 勝負對應：主場贏 = victory、客場贏 = defeat、平手 = defeat
  assert.equal(paletteForBattleOutcome("p1", "p1"), "victory");
  assert.equal(paletteForBattleOutcome("p2", "p1"), "defeat");
  assert.equal(paletteForBattleOutcome("draw", "p1"), "defeat");
  assert.equal(paletteForBattleOutcome(null, "p1"), "battle");
}

// ── 拍點表：每個值都要有來源，且數值合理 ──
{
  const names = Object.keys(CUES) as (keyof typeof CUES)[];
  assert.ok(names.length >= 10, "拍點表太少");
  for (const n of names) {
    const c = CUES[n];
    assert.ok(c.ms > 0 && c.ms < 5000, `${n} 的時長不合理：${c.ms}`);
    assert.ok(["measured", "spec", "initial"].includes(c.source), `${n} 缺少來源標記`);
  }
  assert.equal(cueMs("sidebar"), 220, "側欄時長必須與 App.tsx 一致");
  assert.equal(cueCss("sidebar"), "220ms");
  assert.equal(cueMs("battleEnter"), 300, "進戰鬥轉場必須與 handleStartBattle 一致");
  // 未實測清單必須真的只列出非 measured
  for (const { cue } of unmeteredCues()) assert.notEqual(cue.source, "measured");
}

// ── Phase 2/3 進度鎖：live 的功能不得悄悄退回 delegated ──
{
  const liveIds = SHELL_FEATURES.filter(f => f.aegis.status === "live").map(f => f.id);
  assert.ok(liveIds.includes("start"), "首頁必須是原生大廳（Phase 2 已交付）");
  assert.ok(liveIds.includes("custom"), "編成必須是原生畫面（Phase 3 已交付）");
  assert.ok(liveIds.includes("bag"), "背包必須是原生畫面（Phase 3 已交付）");
  // live 的功能不得有 requires 指向未實作者
  for (const f of SHELL_FEATURES) {
    if (f.aegis.status !== "live") continue;
    for (const dep of f.requires ?? []) {
      assert.ok(getFeature(dep), `${f.id} 依賴不存在的功能 ${dep}`);
    }
  }
}

// ── 新功能必須登記才可能出現在導航 ──
{
  const navIds = aegisNavFeatures().map(f => f.id);
  for (const id of ["start", "custom", "battle"]) {
    assert.ok(navIds.includes(id), `導航缺少 ${id}，主入口會不見`);
  }
  // 背包刻意不進主導航（從「編成」進），但仍必須是可渲染的 live 功能
  assert.ok(!navIds.includes("bag"), "背包不應出現在主導航（使用者要求收進編成）");
  assert.ok(aegisCanRender("bag"), "背包雖然不在導航，仍必須能從程式內導航到達");
  assert.equal(getFeature("bag")?.aegis.status, "live", "背包必須是原生畫面");
  // 背包被收起來後，必須有明確的進入點（編成頁的「背包」按鈕）
  assert.equal(getFeature("bag")?.hideFromNav, true, "背包必須標記為不進主導航");
  // 導航標籤必須是中文（避免又混回英文）
  for (const f of aegisNavFeatures()) {
    assert.ok(/[\u4e00-\u9fa5]/.test(f.short), `${f.id} 的導航標籤「${f.short}」不是中文`);
    assert.ok(f.short.length <= 4, `${f.id} 的導航標籤「${f.short}」超過 4 字，窄版會爆`);
  }
}

console.log("雙殼架構：功能註冊表、殼模式、六態色票、拍點表通過");